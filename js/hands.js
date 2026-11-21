// hands.js — käte jälgimise AI (Google MediaPipe Hand Landmarker): 21 punkti kummalgi käel, ~30 kaadrit sekundis
// Pidur = parema käe sõrmede kõverdus (hoova tõmbamine), gaas = vasaku pöidla vajutus (käiguvahetaja),
// rool = käte joone kalle (või pea kallutus, vt vision.js)
window.TB = window.TB || {};
(function (TB) {
  'use strict';
  const H = TB.Hands = {
    status: 'off', error: '', landmarker: null, last: 0,
    left: null, right: null,            // {lm:[{x,y,z}] (peegeldatud, 0..1), seen:time}
    metric: { brake: 0, gas: 0, steer: 0 }, // toored mõõdikud
    fps: 0
  };
  const MODEL_URLS = [
    new URL('models/hand_landmarker.task', location.href).href,
    'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'
  ];
  const FACE_URLS = [
    new URL('models/face_landmarker.task', location.href).href,
    'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'
  ];
  H.face = null; H.faceStatus = 'off'; H.look = { yaw: 0, pitch: 0 }; let lookC = { yaw: 0, pitch: 0, n: 0 };
  const BASE = (document.currentScript && document.currentScript.src) || location.href;
  const BUNDLES = [
    { js: new URL('mediapipe/vision_bundle.js', BASE).href, wasm: new URL('mediapipe/wasm', BASE).href },
    { js: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs', wasm: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm' }
  ];
  async function fetchModel(onProgress, urls, label) {
    let lastErr;
    for (const url of (urls || MODEL_URLS)) {
      try {
        const r = await fetch(url); if (!r.ok) throw new Error('HTTP ' + r.status);
        const total = +r.headers.get('content-length') || 7800000;
        const rd = r.body.getReader(); const chunks = []; let n = 0; const t0 = performance.now();
        for (; ;) { const { done, value } = await rd.read(); if (done) break; chunks.push(value); n += value.length; onProgress && onProgress(Math.min(0.99, n / total), (label || 'Laen käte AI mudelit ') + ' ' + (n / 1048576).toFixed(1) + ' / ' + (total / 1048576).toFixed(1) + ' MB', t0); }
        const buf = new Uint8Array(n); let o = 0; for (const c of chunks) { buf.set(c, o); o += c.length; }
        return buf;
      } catch (e) { lastErr = e; console.warn('mudel', url, e); }
    }
    throw new Error('käte AI mudelit ei saanud alla laadida (' + (lastErr && lastErr.message) + ') – kontrolli internetti');
  }
  H.init = async function (onProgress) {
    if (H.status === 'ready' || H.status === 'loading') return H.status === 'ready';
    H.status = 'loading'; H.error = '';
    try {
      let mod = null, wasm = null;
      for (const b of BUNDLES) { try { onProgress && onProgress(0.02, 'Laen MediaPipe teeki…'); mod = await import(b.js); wasm = b.wasm; break; } catch (e) { console.warn('bundle', b.js, e); } }
      if (!mod) throw new Error('MediaPipe teeki ei saanud laadida (ava mäng GitHub Pages lingilt, mitte failist)');
      const model = await fetchModel(onProgress);
      onProgress && onProgress(0.995, 'Käivitan käte AI (WebAssembly)…');
      const fileset = await mod.FilesetResolver.forVisionTasks(wasm);
      const opts = d => ({ baseOptions: { modelAssetBuffer: model, delegate: d }, runningMode: 'VIDEO', numHands: 2, minHandDetectionConfidence: 0.5, minHandPresenceConfidence: 0.5, minTrackingConfidence: 0.5 });
      try { H.landmarker = await mod.HandLandmarker.createFromOptions(fileset, opts('GPU')); }
      catch (e) { console.warn('GPU ei tööta, kasutan CPU', e); H.landmarker = await mod.HandLandmarker.createFromOptions(fileset, opts('CPU')); }
      H.status = 'ready'; onProgress && onProgress(1, 'Käte AI valmis ✓');
      H._mod = mod; H._fileset = fileset;
      if (TB.S && TB.S.lookCam) H.initFace(onProgress);
      return true;
    } catch (e) { H.status = 'error'; H.error = e.message || String(e); console.error(e); return false; }
  };
  // näo AI: kuhu inimene vaatab (pea pööre) -> mängu kaamera
  H.initFace = async function (onProgress) {
    if (H.faceStatus === 'ready' || H.faceStatus === 'loading' || !H._mod) return;
    H.faceStatus = 'loading';
    try {
      const model = await fetchModel(onProgress, FACE_URLS, 'Laen näo AI mudelit');
      const opts = d => ({ baseOptions: { modelAssetBuffer: model, delegate: d }, runningMode: 'VIDEO', numFaces: 1 });
      try { H.face = await H._mod.FaceLandmarker.createFromOptions(H._fileset, opts('GPU')); } catch (e) { H.face = await H._mod.FaceLandmarker.createFromOptions(H._fileset, opts('CPU')); }
      H.faceStatus = 'ready'; onProgress && onProgress(1, 'Näo AI valmis ✓ – pööra pead, kaamera pöörab kaasa');
    } catch (e) { H.faceStatus = 'error'; console.warn('face', e); }
  };
  H.recenterLook = () => { lookC = { yaw: H.look.rawYaw || 0, pitch: H.look.rawPitch || 0, n: 50 }; };
  const d2 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  // 0 = randme, 4 = pöidla ots, 5/9/13/17 = sõrmede alused, 8/12/16/20 = sõrmeotsad
  function handSize(l) { return d2(l[0], l[9]) || 0.1; }
  H.curl = l => { const s = handSize(l); return ((d2(l[8], l[5]) + d2(l[12], l[9]) + d2(l[16], l[13])) / 3) / s; };   // suur = sirge, väike = kõverdatud
  H.thumb = l => { const s = handSize(l); return d2(l[4], l[5]) / s + d2(l[4], l[9]) / s * 0.5; };                     // pöidla kaugus nimetissõrme alusest
  H.tilt = () => { if (!H.left || !H.right) return null; const a = H.left.lm[0], b = H.right.lm[0], c = H.left.lm[9], d = H.right.lm[9]; const ax = (a.x + c.x) / 2, ay = (a.y + c.y) / 2, bx = (b.x + d.x) / 2, by = (b.y + d.y) / 2; return Math.atan2(by - ay, bx - ax); };
  // AI tunnus ühest käest: randmest nihutatud, käe suurusega skaleeritud 21 punkti (x,y,z) = 63 numbrit
  H.handFeature = function (side) {
    const h = side === 'brake' ? H.roleB : side === 'gas' ? H.roleG : H[side]; const f = new Float32Array(63); if (!h) return null;
    const l = h.lm, s = handSize(l), o = l[0];
    for (let i = 0; i < 21; i++) { f[i * 3] = (l[i].x - o.x) / s; f[i * 3 + 1] = (l[i].y - o.y) / s; f[i * 3 + 2] = (l[i].z - o.z) / s * 1.5; }
    return f;
  };
  // rooli tunnus kahest käest: punktid mõlema käe keskpunkti suhtes
  H.steerFeature = function () {
    if (!H.left || !H.right) return null; const f = new Float32Array(84);
    const L = H.left.lm, R = H.right.lm, cx = (L[0].x + R[0].x) / 2, cy = (L[0].y + R[0].y) / 2, s = Math.hypot(L[0].x - R[0].x, L[0].y - R[0].y) || 0.2;
    for (let i = 0; i < 21; i++) { f[i * 2] = (L[i].x - cx) / s; f[i * 2 + 1] = (L[i].y - cy) / s; f[42 + i * 2] = (R[i].x - cx) / s; f[42 + i * 2 + 1] = (R[i].y - cy) / s; }
    return f;
  };
  let frames = 0, fpsT = 0;
  H.tick = function (video, now) {
    if (H.status !== 'ready' || !video || video.readyState < 2) return;
    if (now - H.last < 30) return; H.last = now;
    let res; try { res = H.landmarker.detectForVideo(video, now); } catch (e) { return; }
    frames++; if (now - fpsT > 1000) { H.fps = frames; frames = 0; fpsT = now; }
    const hands = (res && res.landmarks || []).map(lm => lm.map(p => ({ x: 1 - p.x, y: p.y, z: p.z }))); // peegeldame nagu eelvaade
    // vasak/parem ekraani asukoha järgi (peeglis on sinu vasak käsi vasakul)
    hands.sort((a, b) => a[0].x - b[0].x);
    if (hands.length >= 2) { H.left = { lm: hands[0], seen: now }; H.right = { lm: hands[hands.length - 1], seen: now }; }
    else if (hands.length === 1) { const h = hands[0]; if (h[0].x < 0.5) H.left = { lm: h, seen: now }; else H.right = { lm: h, seen: now }; }
    if (H.left && now - H.left.seen > 400) H.left = null;
    if (H.right && now - H.right.seen > 400) H.right = null;
    // rollid: kumb käsi on piduri ja kumb gaasi juures (märgistatud kohtade järgi, muidu parem/vasak)
    const mk = TB.Vision && TB.Vision.marks; const cen = l => ({ x: (l[0].x + l[9].x) / 2, y: (l[0].y + l[9].y) / 2 });
    const dist = (l, m) => { const c = cen(l); return Math.hypot(c.x - m.x, c.y - m.y); };
    let rb = null, rg = null;
    if (mk && mk.brake && mk.gas && hands.length) {
      if (hands.length >= 2) { const a = hands[0], b = hands[hands.length - 1]; if (dist(a, mk.brake) + dist(b, mk.gas) <= dist(b, mk.brake) + dist(a, mk.gas)) { rb = a; rg = b; } else { rb = b; rg = a; } }
      else { const h = hands[0]; if (dist(h, mk.brake) < dist(h, mk.gas)) rb = h; else rg = h; }
      if (rb) H.roleB = { lm: rb, seen: now }; if (rg) H.roleG = { lm: rg, seen: now };
    } else { if (H.right) H.roleB = H.right; if (H.left) H.roleG = H.left; }
    if (H.roleB && now - H.roleB.seen > 400) H.roleB = null;
    if (H.roleG && now - H.roleG.seen > 400) H.roleG = null;
    H.metric.brake = H.roleB ? H.curl(H.roleB.lm) : null;
    H.metric.gas = H.roleG ? H.thumb(H.roleG.lm) : null;
    H.metric.steer = H.tilt();
    // lenksu pööre: lenksu keerates liigub üks käsi kaamerale lähemale (paistab suurem), teine kaugemale
    H.metric.bar = (H.left && H.right) ? Math.log(handSize(H.left.lm) / handSize(H.right.lm)) + H.tilt() * 0.6 : null;
    if (H.face && (frames & 1)) {
      try {
        const fr = H.face.detectForVideo(video, now + 0.5); const f = fr && fr.faceLandmarks && fr.faceLandmarks[0];
        if (f) {
          const P = i => ({ x: 1 - f[i].x, y: f[i].y }); const nose = P(1), eL = P(33), eR = P(263), chin = P(152), top = P(10);
          const ed = Math.hypot(eR.x - eL.x, eR.y - eL.y) || 0.1, mx = (eL.x + eR.x) / 2, my = (eL.y + eR.y) / 2;
          const yaw = (nose.x - mx) / ed, pitch = (nose.y - my) / ed - 0.55 * ((chin.y - top.y) / ed / 3.2);
          H.look.rawYaw = yaw; H.look.rawPitch = pitch;
          if (lookC.n < 30) { lookC.yaw = (lookC.yaw * lookC.n + yaw) / (lookC.n + 1); lookC.pitch = (lookC.pitch * lookC.n + pitch) / (lookC.n + 1); lookC.n++; }
          H.look.yaw += ((yaw - lookC.yaw) - H.look.yaw) * 0.35; H.look.pitch += ((pitch - lookC.pitch) - H.look.pitch) * 0.35; H.look.seen = now; H.facePts = [nose, eL, eR];
        } else if (H.look.seen && now - H.look.seen > 500) { H.look.yaw *= 0.9; H.look.pitch *= 0.9; H.facePts = null; }
      } catch (e) { }
    }
  };
  const BONES = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17]];
  H.draw = function (ctx, w, h) {
    for (const side of ['left', 'right']) {
      const hd = H[side]; if (!hd) continue; const l = hd.lm;
      ctx.strokeStyle = side === 'left' ? '#5cff7a' : '#ff5c5c'; ctx.lineWidth = 2.5; ctx.beginPath();
      for (const [a, b] of BONES) { ctx.moveTo(l[a].x * w, l[a].y * h); ctx.lineTo(l[b].x * w, l[b].y * h); } ctx.stroke();
      ctx.fillStyle = '#fff'; for (const p of l) { ctx.beginPath(); ctx.arc(p.x * w, p.y * h, 2.5, 0, 7); ctx.fill(); }
      ctx.fillStyle = side === 'left' ? '#5cff7a' : '#ff5c5c'; ctx.font = 'bold 13px sans-serif'; 
    }
    if (H.facePts) { const [n, a, b] = H.facePts; ctx.fillStyle = '#6bd6ff'; for (const p of [n, a, b]) { ctx.beginPath(); ctx.arc(p.x * w, p.y * h, 4, 0, 7); ctx.fill(); } ctx.strokeStyle = '#6bd6ff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(n.x * w, n.y * h); ctx.lineTo(n.x * w + H.look.yaw * w * 0.4, n.y * h + H.look.pitch * h * 0.4); ctx.stroke(); ctx.font = 'bold 13px system-ui'; ctx.fillText('VAATAD', n.x * w + 8, n.y * h - 8); }
    if (H.left && H.right) { ctx.strokeStyle = 'rgba(255,210,63,0.8)'; ctx.setLineDash([6, 4]); ctx.beginPath(); ctx.moveTo(H.left.lm[9].x * w, H.left.lm[9].y * h); ctx.lineTo(H.right.lm[9].x * w, H.right.lm[9].y * h); ctx.stroke(); ctx.setLineDash([]); }
  };
})(window.TB);
