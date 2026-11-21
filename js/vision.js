// vision.js — veebikaamera juhtimine + AR eelvaade.
// Sa märgid pildil, kus on PIDUR, GAAS ja PEA. Käte AI olemasolul valitakse märgi juurde lähim käsi;
// muidu jälgitakse märgi ümber olevat pildikasti. AR kiht joonistab noolte ja siltidega, kus mis on ja kas on vajutatud.
window.TB = window.TB || {};
(function (TB) {
  'use strict';
  const CW = 160, CH = 120;
  const AI = TB.AI, H = TB.Hands, S = TB.S;
  const V = TB.Vision = {
    stream: null, video: null, pc: null, pctx: null, gray: new Float32Array(CW * CH),
    marks: { brake: null, gas: null, head: null },   // 0..1 peegeldatud pildil
    rois: { brake: { x: 112, y: 76, w: 34, h: 34 }, gas: { x: 12, y: 76, w: 34, h: 34 }, head: { x: 50, y: 6, w: 60, h: 58 } },
    ref: {}, d0: { brake: 0, gas: 0 }, d1: { brake: 20, gas: 20 }, headL: -14,
    hc: { curl0: 1.6, curl1: 1.0, thumb0: 0.9, thumb1: 1.3, tilt0: 0, tiltL: -0.35, bar0: 0, barL: -0.25, ok: false },
    calibrated: false, taught: false,
    val: { brake: 0, gas: 0, steer: 0 }, raw: { brake: 0, gas: 0, shift: 0 }, ai: { brake: null, gas: null, steer: null },
    rec: null, active: false, onRec: null
  };
  V.handsOn = () => H.status === 'ready';
  V.ready = () => !!(V.active && (V.calibrated || V.hc.ok || AI.models.brake || AI.models.gas || AI.models.steer));

  V.start = async function () {
    if (V.stream) return true;
    try {
      const st = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' }, audio: false });
      V.video = document.createElement('video'); V.video.playsInline = true; V.video.muted = true; V.video.srcObject = st; await V.video.play();
      V.pc = document.createElement('canvas'); V.pc.width = CW; V.pc.height = CH; V.pctx = V.pc.getContext('2d', { willReadFrequently: true });
      V.stream = st; V.active = true; return true;
    } catch (e) { TB.toast('Kaamerat ei saanud avada: ' + e.message + '. Kontrolli, et kaamera on ühendatud ja brauser lubab seda.'); return false; }
  };
  function grab() {
    const x = V.pctx; x.save(); x.translate(CW, 0); x.scale(-1, 1); x.drawImage(V.video, 0, 0, CW, CH); x.restore();
    const d = x.getImageData(0, 0, CW, CH).data, g = V.gray; for (let i = 0, j = 0; i < g.length; i++, j += 4) g[i] = d[j] * 0.299 + d[j + 1] * 0.587 + d[j + 2] * 0.114;
  }
  function clampRoi(r) { r.w = Math.max(8, Math.min(CW, Math.round(r.w))); r.h = Math.max(8, Math.min(CH, Math.round(r.h))); r.x = Math.max(0, Math.min(CW - r.w, Math.round(r.x))); r.y = Math.max(0, Math.min(CH - r.h, Math.round(r.y))); }
  function patch(r) { const p = new Float32Array(r.w * r.h); for (let y = 0; y < r.h; y++)for (let x = 0; x < r.w; x++)p[y * r.w + x] = V.gray[(r.y + y) * CW + r.x + x]; return p; }
  function diffVal(r, ref) { if (!ref || ref.length !== r.w * r.h) return 0; let s = 0; for (let y = 0; y < r.h; y++)for (let x = 0; x < r.w; x++)s += Math.abs(V.gray[(r.y + y) * CW + r.x + x] - ref[y * r.w + x]); return s / (r.w * r.h); }
  function headShift() {
    const r = V.rois.head, ref = V.ref.head; if (!ref || ref.length !== r.w * r.h) return 0; let best = 1e18, bx = 0; const R = Math.round(r.w * 0.7);
    for (let dy = -4; dy <= 4; dy += 2)for (let dx = -R; dx <= R; dx++) {
      let s = 0, n = 0;
      for (let y = 0; y < r.h; y += 3) { const yy = r.y + y + dy; if (yy < 0 || yy >= CH) continue; for (let x = 0; x < r.w; x += 3) { const xx = r.x + x + dx; if (xx < 0 || xx >= CW) { s += 60; n++; continue; } s += Math.abs(V.gray[yy * CW + xx] - ref[y * r.w + x]); n++; } }
      s = s / (n || 1) + Math.abs(dx) * 0.02; if (s < best) { best = s; bx = dx; }
    }
    return bx;
  }
  // märk → kast
  V.setMark = function (k, x, y) {
    V.marks[k] = { x, y };
    const s = k === 'head' ? 58 : S.roiSize;
    V.rois[k] = { x: x * CW - s / 2, y: y * CH - s / 2, w: s, h: s }; clampRoi(V.rois[k]);
    if (V.pctx && V.video && V.video.readyState >= 2) { grab(); V.ref[k] = patch(V.rois[k]); }
    V.saveSettings();
  };
  function pixelFeature(roiName, Sz, jitter) {
    const r = V.rois[roiName], out = new Float32Array(Sz * Sz);
    let jx = 0, jy = 0, js = 1; if (jitter) { jx = (Math.random() - .5) * r.w * 0.08; jy = (Math.random() - .5) * r.h * 0.08; js = 1 + (Math.random() - .5) * 0.1; }
    const cx = r.x + r.w / 2 + jx, cy = r.y + r.h / 2 + jy, w = r.w * js, h = r.h * js; let mean = 0;
    for (let y = 0; y < Sz; y++)for (let x = 0; x < Sz; x++) {
      let s = 0; for (let a = 0; a < 2; a++)for (let b = 0; b < 2; b++) { const px = Math.max(0, Math.min(CW - 1, Math.round(cx - w / 2 + (x + 0.25 + a * 0.5) / Sz * w))), py = Math.max(0, Math.min(CH - 1, Math.round(cy - h / 2 + (y + 0.25 + b * 0.5) / Sz * h))); s += V.gray[py * CW + px]; }
      out[y * Sz + x] = s / 4; mean += s / 4;
    }
    mean /= Sz * Sz; let sd = 0; for (let i = 0; i < out.length; i++) sd += (out[i] - mean) ** 2; sd = Math.sqrt(sd / out.length);
    for (let i = 0; i < out.length; i++) out[i] = (out[i] - mean) / (sd + 10);
    return out;
  }
  V.feature = function (k, jitter) {
    if (V.handsOn()) {
      if (k === 'brake') return noise(H.handFeature('brake'), jitter);
      if (k === 'gas') return noise(H.handFeature('gas'), jitter);
      if (k === 'steer' && S.steerSrc !== 'head') return noise(H.steerFeature(), jitter);
    }
    return pixelFeature(k === 'steer' ? 'head' : k, AI.CONTROLS[k].size, jitter);
  };
  V.featureDim = function (k) { if (V.handsOn()) { if (k === 'brake' || k === 'gas') return 63; if (k === 'steer' && S.steerSrc !== 'head') return 84; } const z = AI.CONTROLS[k].size; return z * z; };
  function noise(f, j) { if (!f || !j) return f; for (let i = 0; i < f.length; i++) f[i] += (Math.random() - .5) * 0.04; return f; }
  V.snapshotRefs = function () { for (const k of ['brake', 'gas', 'head']) { clampRoi(V.rois[k]); V.ref[k] = patch(V.rois[k]); } };

  let last = 0;
  V.tick = function (now) {
    if (!V.stream || !V.video || V.video.readyState < 2) return;
    H.tick(V.video, now);
    if (now - last < 45) return; last = now;
    grab();
    if (!V.ref.head) V.snapshotRefs();
    V.raw.brake = diffVal(V.rois.brake, V.ref.brake); V.raw.gas = diffVal(V.rois.gas, V.ref.gas); V.raw.shift = headShift();
    const c01 = v => Math.max(0, Math.min(1, v));
    const simple = { brake: 0, gas: 0, steer: 0 }, c = V.hc;
    if (V.handsOn() && c.ok) {
      if (H.metric.brake != null) simple.brake = c01((c.curl0 - H.metric.brake) / Math.max(0.05, c.curl0 - c.curl1) * 1.1 * S.brakeSens - 0.08);
      if (H.metric.gas != null) simple.gas = c01((H.metric.gas - c.thumb0) / ((c.thumb1 - c.thumb0) || 0.1) * 1.1 * S.gasSens - 0.08);
      if (S.steerSrc === 'hands' && H.metric.steer != null) simple.steer = -(H.metric.steer - c.tilt0) / ((c.tiltL - c.tilt0) || -0.3);
      if (S.steerSrc === 'bar' && H.metric.bar != null) simple.steer = -(H.metric.bar - c.bar0) / ((c.barL - c.bar0) || -0.25);
    } else if (V.calibrated) {
      simple.brake = c01((V.raw.brake - V.d0.brake) / Math.max(4, V.d1.brake - V.d0.brake) * 1.15 * S.brakeSens - 0.08);
      simple.gas = c01((V.raw.gas - V.d0.gas) / Math.max(4, V.d1.gas - V.d0.gas) * 1.15 * S.gasSens - 0.08);
    }
    if (S.steerSrc === 'head' && (V.calibrated || c.ok)) simple.steer = -(V.raw.shift / (V.headL || -14));
    for (const k of ['brake', 'gas', 'steer']) {
      let v = simple[k]; const m = AI.models[k];
      if (m && m.sizes[0] === V.featureDim(k)) {
        const f = V.feature(k, false);
        if (f) { const p = m.predict(f); V.ai[k] = p; v = AI.value(k, p); if (k !== 'steer') v = c01(v * (k === 'brake' ? S.brakeSens : S.gasSens)); }
        else { V.ai[k] = null; v = 0; }
      } else V.ai[k] = null;
      if (k === 'steer') { v *= (S.invert ? -1 : 1) * S.steerSens; const dz = S.deadzone; v = Math.abs(v) < dz ? 0 : Math.sign(v) * Math.min(1, (Math.abs(v) - dz) / (1 - dz)); }
      V.val[k] += (v - V.val[k]) * 0.55;
    }
    if (!V.handsOn() && !V.rec) for (const k of ['brake', 'gas']) if (simple[k] < 0.05 && V.ref[k]) { const r = V.rois[k], ref = V.ref[k]; for (let y = 0; y < r.h; y++)for (let x = 0; x < r.w; x++) { const i = y * r.w + x; ref[i] += (V.gray[(r.y + y) * CW + r.x + x] - ref[i]) * 0.01; } }
    if (V.rec) recTick(now);
    drawAll(now);
  };

  // ================= AR eelvaade =================
  const COL = { brake: '#ff4d5e', gas: '#3dff8a', head: '#ffd23f' };
  const NAME = { brake: 'PIDUR', gas: 'GAAS', head: 'PEA' };
  function anchor(k) {
    if (V.handsOn()) {
      if (k === 'brake' && H.roleB) { const l = H.roleB.lm; return { x: (l[8].x + l[12].x) / 2, y: (l[8].y + l[12].y) / 2, live: true }; }
      if (k === 'gas' && H.roleG) { const l = H.roleG.lm; return { x: l[4].x, y: l[4].y, live: true }; }
    }
    const m = V.marks[k]; if (m) return { x: m.x + (k === 'head' ? V.raw.shift / CW : 0), y: m.y, live: false };
    return null;
  }
  function pill(x, ctx, cx, cy, text, col, fill) {
    x.font = 'bold ' + ctx.fs + 'px system-ui,sans-serif'; const w = x.measureText(text).width + ctx.fs * 1.2, h = ctx.fs * 1.7;
    x.fillStyle = fill || 'rgba(10,14,22,0.82)'; x.beginPath(); if (x.roundRect) x.roundRect(cx - w / 2, cy - h / 2, w, h, h / 2); else x.rect(cx - w / 2, cy - h / 2, w, h); x.fill();
    x.strokeStyle = col; x.lineWidth = 2; x.stroke(); x.fillStyle = col === '#fff' ? '#fff' : (fill ? '#111' : col); x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, cx, cy + 1); return w;
  }
  V.drawAR = function (x, W, Hh, now, opts) {
    opts = opts || {}; const t = now / 1000, fs = Math.max(10, Math.round(W / 34)); const ctx = { fs };
    for (const k of ['brake', 'gas', 'head']) {
      if (k === 'head' && S.steerSrc !== 'head') continue;
      const a = anchor(k); if (!a) continue;
      const px = a.x * W, py = a.y * Hh, v = k === 'head' ? Math.abs(V.val.steer) : V.val[k], on = v > 0.5, col = COL[k];
      if (opts.highlight && opts.highlight !== k) x.globalAlpha = 0.35;
      // kast (kui pildirežiim)
      if (!a.live && k !== 'head') { const r = V.rois[k], s = W / CW; x.setLineDash([5, 4]); x.strokeStyle = col; x.lineWidth = 1.5; x.strokeRect(r.x * s, r.y * s, r.w * s, r.h * s); x.setLineDash([]); }
      if (k === 'head') { const r = V.rois.head, s = W / CW; x.strokeStyle = col; x.lineWidth = 2; x.setLineDash([6, 4]); x.strokeRect(r.x * s + V.raw.shift * s, r.y * s, r.w * s, r.h * s); x.setLineDash([]); }
      // pulseeriv ring
      const R = fs * (0.9 + v * 0.9) + Math.sin(t * 6) * 2;
      x.beginPath(); x.arc(px, py, R, 0, 7); x.fillStyle = on ? col + 'aa' : col + '33'; x.fill(); x.lineWidth = 3; x.strokeStyle = col; x.stroke();
      if (on) { x.beginPath(); x.arc(px, py, R + 6 + (t * 30 % 14), 0, 7); x.strokeStyle = col + '66'; x.lineWidth = 2; x.stroke(); }
      // nool sildist märgini (põrkab)
      const up = py > Hh * 0.35 ? -1 : 1; const bob = Math.sin(t * 4) * fs * 0.35; const ly = py + up * (fs * 4.2) + (up < 0 ? -bob : bob);
      const ay1 = ly - up * fs * 1.1, ay2 = py + up * (R + 4);
      x.strokeStyle = col; x.lineWidth = 4; x.beginPath(); x.moveTo(px, ay1); x.lineTo(px, ay2); x.stroke();
      x.fillStyle = col; x.beginPath(); x.moveTo(px, ay2); x.lineTo(px - fs * 0.55, ay2 - up * fs * 0.8); x.lineTo(px + fs * 0.55, ay2 - up * fs * 0.8); x.fill();
      // silt
      const pct = Math.round(v * 100);
      const txt = k === 'head' ? (V.val.steer < -0.15 ? '◀ VASAKULE' : V.val.steer > 0.15 ? 'PAREMALE ▶' : 'PEA · otse') : NAME[k] + (on ? ' · VAJUTATUD ' : ' · lahti ') + pct + '%';
      const lw = pill(x, ctx, px, ly, txt, col, on ? col : null);
      if (k !== 'head') { x.fillStyle = 'rgba(0,0,0,0.6)'; x.fillRect(px - lw / 2 + 6, ly + fs * 1.0, lw - 12, 4); x.fillStyle = col; x.fillRect(px - lw / 2 + 6, ly + fs * 1.0, (lw - 12) * v, 4); }
      x.globalAlpha = 1;
    }
    // rooli kaar üleval
    if (opts.steerGauge !== false) {
      const cx = W / 2, cy = fs * 3.2, rr = fs * 2.2; x.lineWidth = 5; x.strokeStyle = 'rgba(255,255,255,0.25)'; x.beginPath(); x.arc(cx, cy, rr, Math.PI * 1.15, Math.PI * 1.85); x.stroke();
      const ang = Math.PI * 1.5 + V.val.steer * Math.PI * 0.35; x.strokeStyle = '#ffd23f'; x.lineWidth = 4; x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr); x.stroke();
      x.fillStyle = '#ffd23f'; x.font = 'bold ' + Math.round(fs * 0.8) + 'px system-ui'; x.textAlign = 'center'; x.fillText(S.steerSrc === 'bar' ? 'LENKS' : S.steerSrc === 'hands' ? 'KÄED' : 'PEA', cx, cy + fs * 0.9);
    }
    if (V.handsOn()) H.draw(x, W, Hh);
  };
  function drawAll(now) {
    const list = [...document.querySelectorAll('canvas.campreview')].filter(c => c.offsetParent !== null);
    const cam = document.getElementById('cam'); if (TB.Game && TB.Game.running && V.ready() && S.showAR && cam) list.push(cam);
    for (const cv of list) {
      const x = cv.getContext('2d');
      x.save(); x.translate(cv.width, 0); x.scale(-1, 1); x.drawImage(V.video, 0, 0, cv.width, cv.height); x.restore();
      V.drawAR(x, cv.width, cv.height, now, cv._arOpts);
      if (cv._overlay) cv._overlay(x, cv.width, cv.height, now);
    }
    TB.UI && TB.UI.onVisionFrame && TB.UI.onVisionFrame();
  }

  // ================= salvestamine (AI näited + kalibreerimise mõõdikud) =================
  // V.record(k, cls, ms, tag) -> Promise; kogub AI näiteid ja toorandmeid kalibreerimiseks
  V.samples = {};
  V.record = function (k, cls, ms, tag) {
    return new Promise(res => { V.rec = { k, cls, t0: performance.now(), ms: ms || 3000, n: 0, miss: 0, tag, res, acc: [] }; });
  };
  function recTick(now) {
    const r = V.rec, el = now - r.t0;
    if (r.k) for (let j = 0; j < 2; j++) { const f = V.feature(r.k, true); if (f) { AI.addSample(r.k, f, r.cls); r.n++; } else r.miss++; }
    r.acc.push({ b: V.raw.brake, g: V.raw.gas, s: V.raw.shift, curl: H.metric.brake, th: H.metric.gas, tilt: H.metric.steer, bar: H.metric.bar });
    V.onRec && V.onRec(r, Math.min(1, el / r.ms));
    if (el >= r.ms) { const done = V.rec; V.rec = null; if (done.tag) V.samples[done.tag] = done.acc; done.res(done); }
  }
  const avg = (arr, key) => { const a = (arr || []).map(o => o[key]).filter(v => v != null && !isNaN(v)); return a.length ? a.reduce((x, y) => x + y, 0) / a.length : null; };
  // kalibreerimine õpetamise salvestustest
  V.calibrateFromSamples = function () {
    const s = V.samples, c = V.hc, warn = [];
    const b0 = avg(s.brakeOff, 'b'), b1 = avg(s.brakeOn, 'b'), g0 = avg(s.gasOff, 'g'), g1 = avg(s.gasFull, 'g');
    if (b0 != null) { V.d0.brake = b0; V.d1.brake = Math.max(b0 + 5, b1 * 0.85); }
    if (g0 != null) { V.d0.gas = g0; V.d1.gas = Math.max(g0 + 5, g1 * 0.85); }
    const sl = avg(s.steerLeft, 's'); if (sl != null) V.headL = Math.abs(sl) < 3 ? -14 : sl * 0.8;
    const cu0 = avg(s.brakeOff, 'curl'), cu1 = avg(s.brakeOn, 'curl'), t0 = avg(s.gasOff, 'th'), t1 = avg(s.gasFull, 'th'), ti0 = avg(s.steerCenter, 'tilt'), tiL = avg(s.steerLeft, 'tilt');
    if (cu0 != null && cu1 != null) { c.curl0 = cu0; c.curl1 = cu1; if (Math.abs(cu0 - cu1) < 0.08) warn.push('pidur'); }
    if (t0 != null && t1 != null) { c.thumb0 = t0; c.thumb1 = t1; if (Math.abs(t1 - t0) < 0.06) warn.push('gaas'); }
    const ba0 = avg(s.steerCenter, 'bar'), baL = avg(s.steerLeft, 'bar'); if (ba0 != null) c.bar0 = ba0; if (ba0 != null && baL != null) c.barL = ba0 + (baL - ba0) * 0.8;
    if (ti0 != null) c.tilt0 = ti0; if (tiL != null && ti0 != null) c.tiltL = ti0 + (tiL - ti0) * 0.8;
    if (!V.handsOn()) { if (V.d1.brake - V.d0.brake < 6) warn.push('pidur'); if (V.d1.gas - V.d0.gas < 6) warn.push('gaas'); }
    V.calibrated = true; c.ok = V.handsOn(); V.taught = true; V.saveSettings();
    return [...new Set(warn)];
  };

  // ================= seaded =================
  V.saveSettings = function () { try { localStorage.setItem('tb-vision3', JSON.stringify({ marks: V.marks, rois: V.rois, d0: V.d0, d1: V.d1, headL: V.headL, hc: V.hc, calibrated: V.calibrated, taught: V.taught })); } catch (e) { } };
  V.loadSettings = function () { try { const o = JSON.parse(localStorage.getItem('tb-vision3') || 'null'); if (o) { Object.assign(V.marks, o.marks || {}); Object.assign(V.rois, o.rois || {}); V.d0 = o.d0 || V.d0; V.d1 = o.d1 || V.d1; V.headL = o.headL || V.headL; Object.assign(V.hc, o.hc || {}); V.calibrated = !!o.calibrated; V.taught = !!o.taught; } } catch (e) { } };
  V.forget = function () { V.marks = { brake: null, gas: null, head: null }; V.calibrated = false; V.hc.ok = false; V.taught = false; V.saveSettings(); };
})(window.TB);
