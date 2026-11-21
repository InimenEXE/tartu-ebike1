// gun.js — 🔫 Täpsuslask: õpeta AI-le oma püss (sihtimine + päästik), mängi täpsusmängu või juhi TartuOS-i püssiga
// Sihtimine: käte AI punktid -> ridge-regressioon ekraani koordinaatideks (õpitakse 9 sihtmärgist).
// Päästik: väike närvivõrk (MLP) käe punktidest: lahti / tõmmatud.
window.TB = window.TB || {};
(function (TB) {
  'use strict';
  const $ = id => document.getElementById(id);
  const H = TB.Hands, V = TB.Vision, AI = TB.AI;
  const G = TB.Gun = { mode: 'off', aim: { x: 0.5, y: 0.5, ok: false }, trig: 0, pulled: false, model: null, trigModel: null, mark: null, best: 0, mouse: { x: 0.5, y: 0.5, down: false } };
  let cv, ctx, raf = 0, lastShot = 0, hoverEl = null;

  // ---------- püssikäsi ja tunnused ----------
  function gunHand() {
    const hs = [H.left, H.right].filter(Boolean); if (!hs.length) return null;
    if (G.mark) { let best = null, bd = 9; for (const h of hs) { const c = h.lm[9], d = Math.hypot(c.x - G.mark.x, c.y - G.mark.y); if (d < bd) { bd = d; best = h; } } return best.lm; }
    return (H.right || H.left).lm;
  }
  const hsz = l => Math.hypot(l[0].x - l[9].x, l[0].y - l[9].y) || 0.1;
  function aimFeat(l) { const s = hsz(l); return [l[0].x, l[0].y, l[5].x, l[5].y, l[8].x, l[8].y, l[9].x, l[9].y, (l[8].x - l[5].x) / s, (l[8].y - l[5].y) / s, (l[9].x - l[0].x) / s, (l[9].y - l[0].y) / s, 1]; }
  function trigFeat(l) { const s = hsz(l), o = l[0], f = new Float32Array(63); for (let i = 0; i < 21; i++) { f[i * 3] = (l[i].x - o.x) / s; f[i * 3 + 1] = (l[i].y - o.y) / s; f[i * 3 + 2] = (l[i].z - o.z) / s * 1.5; } return f; }
  function rawAim(l) { const tx = l[8].x + (l[8].x - l[5].x) * 1.5, ty = l[8].y + (l[8].y - l[5].y) * 1.5; return { x: 0.5 + (tx - 0.5) * 1.8, y: 0.5 + (ty - 0.5) * 1.8 }; }
  function ruleTrig(l) { const s = hsz(l); const thumb = Math.hypot(l[4].x - l[5].x, l[4].y - l[5].y) / s, idx = Math.hypot(l[8].x - l[5].x, l[8].y - l[5].y) / s; return Math.max(thumb < 0.5 ? 1 : 0, idx < 0.45 ? 1 : 0); }
  // ridge-regressioon
  function ridge(X, Y, lam) {
    const d = X[0].length, A = Array.from({ length: d }, () => new Float64Array(d + 2));
    for (let n = 0; n < X.length; n++) { const x = X[n]; for (let i = 0; i < d; i++) { for (let j = 0; j < d; j++) A[i][j] += x[i] * x[j]; A[i][d] += x[i] * Y[n][0]; A[i][d + 1] += x[i] * Y[n][1]; } }
    for (let i = 0; i < d - 1; i++) A[i][i] += lam;
    for (let c = 0; c < d; c++) { let p = c; for (let r = c + 1; r < d; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;[A[c], A[p]] = [A[p], A[c]]; const v = A[c][c] || 1e-9; for (let k = c; k < d + 2; k++) A[c][k] /= v; for (let r = 0; r < d; r++) if (r !== c) { const f = A[r][c]; if (f) for (let k = c; k < d + 2; k++) A[r][k] -= f * A[c][k]; } }
    return { wx: A.map(r => r[d]), wy: A.map(r => r[d + 1]) };
  }
  const dot = (w, x) => w.reduce((s, v, i) => s + v * x[i], 0);

  // ---------- iga kaader ----------
  function update(now) {
    const l = H.status === 'ready' ? gunHand() : null;
    let ax, ay;
    if (l) {
      if (G.model) { const f = aimFeat(l); ax = dot(G.model.wx, f); ay = dot(G.model.wy, f); } else { const r = rawAim(l); ax = r.x; ay = r.y; }
      let t = ruleTrig(l); if (G.trigModel) { const p = G.trigModel.predict(trigFeat(l)); t = p[1]; }
      G.trig += (t - G.trig) * 0.6; G.aim.ok = true;
    } else if (H.status !== 'ready') { ax = G.mouse.x; ay = G.mouse.y; G.trig = G.mouse.down ? 1 : 0; G.aim.ok = true; }
    else { G.aim.ok = false; G.trig *= 0.8; }
    if (ax != null) { const k = 0.35; G.aim.x += (Math.max(-0.05, Math.min(1.05, ax)) - G.aim.x) * k; G.aim.y += (Math.max(-0.05, Math.min(1.05, ay)) - G.aim.y) * k; }
    const was = G.pulled; G.pulled = was ? G.trig > 0.35 : G.trig > 0.65;
    if (G.pulled && !was && now - lastShot > 220) { lastShot = now; shoot(now); }
  }
  let actx; function snd(f, d, type) { try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); const o = actx.createOscillator(), g = actx.createGain(); o.type = type || 'square'; o.frequency.setValueAtTime(f, actx.currentTime); o.frequency.exponentialRampToValueAtTime(f * 0.3, actx.currentTime + d); g.gain.setValueAtTime(0.15 * (TB.S ? TB.S.volume : 1), actx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + d); o.connect(g); g.connect(actx.destination); o.start(); o.stop(actx.currentTime + d); } catch (e) { } }
  const fx = []; // tabamuse efektid
  function shoot(now) {
    const W = innerWidth, Hh = innerHeight, x = G.aim.x * W, y = G.aim.y * Hh; snd(220, 0.15);
    fx.push({ x, y, t: now, kind: 'shot' });
    if (G.mode === 'game') gameShot(x, y, now);
    else if (G.mode === 'os') { const el = document.elementFromPoint(x, y); const tgt = el && (el.closest('button,[data-app],label,input,.app') || el); if (tgt) { tgt.click(); tgt.focus && tgt.focus(); } }
  }

  // ---------- joonistamine ----------
  function crosshair(x, y, now) {
    const r = 18 + G.trig * 6, c = G.pulled ? '#ff4d5e' : '#3dff8a';
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 5; ring(); ctx.strokeStyle = c; ctx.lineWidth = 2.5; ring();
    function ring() { ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.moveTo(x - r - 10, y); ctx.lineTo(x - r + 6, y); ctx.moveTo(x + r - 6, y); ctx.lineTo(x + r + 10, y); ctx.moveTo(x, y - r - 10); ctx.lineTo(x, y - r + 6); ctx.moveTo(x, y + r - 6); ctx.lineTo(x, y + r + 10); ctx.stroke(); }
    ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, 2.5, 0, 7); ctx.fill();
    if (!G.aim.ok) { ctx.fillStyle = '#ffd23f'; ctx.font = 'bold 16px system-ui'; ctx.textAlign = 'center'; ctx.fillText('Püssi kätt ei näe', x, y + 46); }
  }
  function drawFx(now) { for (let i = fx.length - 1; i >= 0; i--) { const f = fx[i], a = (now - f.t) / 400; if (a > 1) { fx.splice(i, 1); continue; } ctx.strokeStyle = f.kind === 'hit' ? `rgba(255,210,63,${1 - a})` : `rgba(255,255,255,${0.7 - a * 0.7})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(f.x, f.y, 6 + a * (f.kind === 'hit' ? 60 : 22), 0, 7); ctx.stroke(); if (f.txt) { ctx.fillStyle = `rgba(255,210,63,${1 - a})`; ctx.font = 'bold 26px system-ui'; ctx.textAlign = 'center'; ctx.fillText(f.txt, f.x, f.y - 30 - a * 30); } } }
  function loop(now) {
    raf = requestAnimationFrame(loop);
    if (cv.width !== innerWidth || cv.height !== innerHeight) { cv.width = innerWidth; cv.height = innerHeight; }
    update(now); ctx.clearRect(0, 0, cv.width, cv.height);
    const W = cv.width, Hh = cv.height, x = G.aim.x * W, y = G.aim.y * Hh;
    if (G.mode === 'calib') drawCalib(now, W, Hh);
    if (G.mode === 'game') drawGame(now, W, Hh);
    if (G.mode === 'os') { const el = document.elementFromPoint(x, y); const t = el && el.closest('button,[data-app],.app,label'); if (t !== hoverEl) { hoverEl && hoverEl.classList.remove('gunhover'); hoverEl = t; t && t.classList.add('gunhover'); } }
    drawFx(now);
    if (G.mode !== 'calib' || calib.phase === 'trig') crosshair(x, y, now);
    if (G.mode !== 'off') { ctx.fillStyle = 'rgba(10,14,22,0.75)'; ctx.fillRect(W - 210, Hh - 120, 196, 52); ctx.fillStyle = '#fff'; ctx.font = 'bold 13px system-ui'; ctx.textAlign = 'left'; ctx.fillText('Päästik', W - 198, Hh - 98); ctx.fillStyle = '#333'; ctx.fillRect(W - 140, Hh - 108, 116, 12); ctx.fillStyle = G.pulled ? '#ff4d5e' : '#3dff8a'; ctx.fillRect(W - 140, Hh - 108, 116 * G.trig, 12); ctx.fillStyle = '#aaa'; ctx.font = '11px system-ui'; ctx.fillText('Esc = lõpeta', W - 198, Hh - 80); }
  }
  function setMode(m) {
    G.mode = m; const active = m !== 'off'; cv.style.display = active ? 'block' : 'none';
    cv.style.pointerEvents = (m === 'game' || m === 'calib') && H.status !== 'ready' ? 'auto' : 'none';
    if (active && !raf) raf = requestAnimationFrame(loop); if (!active && raf) { cancelAnimationFrame(raf); raf = 0; hoverEl && hoverEl.classList.remove('gunhover'); }
    if (m === 'game' || m === 'calib') TB.UI.close('winGun');
    renderPanel();
  }
  G.stop = () => setMode('off');

  // ---------- õpetamine ----------
  const PTS = []; for (const y of [0.15, 0.5, 0.85]) for (const x of [0.12, 0.5, 0.88]) PTS.push([x, y]);
  const calib = { phase: '', i: 0, t0: 0, X: [], Y: [], msg: '' };
  function drawCalib(now, W, Hh) {
    ctx.fillStyle = 'rgba(5,8,16,0.82)'; ctx.fillRect(0, 0, W, Hh);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = 'bold 28px system-ui'; ctx.fillText(calib.msg, W / 2, Hh / 2 - 120 < 60 ? 60 : 60);
    ctx.font = '16px system-ui'; ctx.fillStyle = '#ffd23f'; ctx.fillText(calib.sub || '', W / 2, 92);
    if (calib.phase === 'aim') {
      const [px, py] = PTS[calib.i], x = px * W, y = py * Hh, el = now - calib.t0, rec = el > 1200, p = Math.min(1, (el - 1200) / 1300);
      for (let r = 40; r > 0; r -= 10) { ctx.beginPath(); ctx.arc(x, y, r + Math.sin(now / 150) * 3, 0, 7); ctx.fillStyle = (r / 10) % 2 ? '#ff4d5e' : '#fff'; ctx.fill(); }
      if (rec) { ctx.strokeStyle = '#3dff8a'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(x, y, 54, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2); ctx.stroke(); }
      PTS.forEach(([a, b], j) => { ctx.fillStyle = j < calib.i ? '#3dff8a' : 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.arc(W / 2 - 80 + j * 20, Hh - 40, 6, 0, 7); ctx.fill(); });
      // eelvaade: kus käsi praegu sihib (toores)
      const l = H.status === 'ready' ? gunHand() : null; if (l) { const r0 = rawAim(l); ctx.strokeStyle = 'rgba(107,214,255,0.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(r0.x * W, r0.y * Hh, 12, 0, 7); ctx.stroke(); }
    }
  }
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  async function teach() {
    if (!(await TB.Game.camera())) return;
    if (H.status !== 'ready') { TB.toast('Püssi õpetamiseks on vaja käte AI-d (Seaded → Juhtimine). Seni saad mängida hiirega.', 7000); return; }
    setMode('calib'); calib.X = []; calib.Y = []; calib.phase = 'aim';
    calib.msg = 'Siht iga märklauda püssiga'; calib.sub = 'Hoia püssi nagu tavaliselt. Sihi märki ja hoia, kuni roheline ring täitub.';
    for (calib.i = 0; calib.i < PTS.length; calib.i++) {
      calib.t0 = performance.now(); snd(660, 0.08, 'sine');
      while (performance.now() - calib.t0 < 2500) { if (G.mode !== 'calib') return; if (performance.now() - calib.t0 > 1200) { const l = gunHand(); if (l) { calib.X.push(aimFeat(l)); calib.Y.push(PTS[calib.i]); } } await sleep(33); }
    }
    if (calib.X.length < 40) { TB.toast('Püssi kätt nähti liiga vähe – proovi uuesti paremas valguses.', 6000); setMode('off'); return; }
    G.model = ridge(calib.X, calib.Y, 0.002);
    // päästik
    calib.phase = 'trig'; const D = [];
    const steps = [['Hoia päästik LAHTI', 0], ['TÕMBA päästikut ja hoia', 1], ['Lase päästik LAHTI', 0], ['TÕMBA uuesti', 1]];
    for (const [say, cls] of steps) {
      calib.msg = say; calib.sub = 'Siht ekraani keskele'; for (let t = 3; t > 0; t--) { calib.sub = 'Valmistu… ' + t; snd(440, 0.06, 'sine'); await sleep(700); if (G.mode !== 'calib') return; }
      calib.sub = '● salvestan'; snd(880, 0.08, 'sine'); const t0 = performance.now();
      while (performance.now() - t0 < 2200) { const l = gunHand(); if (l) { D.push({ x: trigFeat(l), y: cls }); } await sleep(33); }
    }
    calib.msg = 'AI õpib…'; calib.sub = ''; await sleep(50);
    const c0 = D.filter(d => d.y === 0).length, c1 = D.length - c0;
    if (c0 >= 15 && c1 >= 15) {
      const m = new AI.MLP([63, 32, 16, 2]); const wts = [D.length / (2 * c0), D.length / (2 * c1)];
      for (let ep = 0; ep < 40; ep++) { D.sort(() => Math.random() - 0.5); for (let i = 0; i < D.length; i += 16) { const b = D.slice(i, i + 16); m.trainBatch(b.map(s => s.x.map(v => v + (Math.random() - .5) * 0.04)), b.map(s => s.y), wts, 0.003, 1e-4); } calib.sub = 'Päästiku AI ' + Math.round((ep + 1) / 40 * 100) + '%'; if (ep % 5 === 0) await sleep(0); }
      G.trigModel = m;
    } else TB.toast('Päästikut nähti vähe – kasutan lihtsat reeglit (pöial/sõrm kõverdub).', 6000);
    save(); snd(990, 0.2, 'sine'); TB.toast('🔫 Püss õpetatud! Proovi täpsusmängu.'); setMode('off'); TB.UI.open('winGun');
  }

  // ---------- täpsusmäng ----------
  const game = { t0: 0, dur: 45000, targets: [], score: 0, hits: 0, shots: 0, react: [], next: 0, over: false };
  function startGame() {
    Object.assign(game, { t0: performance.now(), targets: [], score: 0, hits: 0, shots: 0, react: [], next: 0, over: false });
    setMode('game'); snd(500, 0.3, 'sine');
  }
  function gameShot(x, y, now) {
    if (game.over) { if (now - game.overT > 1200) startGame(); return; }
    game.shots++; let hit = null;
    for (const t of game.targets) { const d = Math.hypot(x - t.x, y - t.y); if (d < t.r) { hit = t; t.d = d; break; } }
    if (hit) { const acc = 1 - hit.d / hit.r, pts = Math.round(50 + acc * 100 + (hit.r < 40 ? 50 : 0)); game.score += pts; game.hits++; game.react.push(now - hit.born); game.targets.splice(game.targets.indexOf(hit), 1); fx.push({ x: hit.x, y: hit.y, t: now, kind: 'hit', txt: '+' + pts + (acc > 0.8 ? ' 🎯' : '') }); snd(900, 0.12, 'triangle'); }
  }
  function drawGame(now, W, Hh) {
    const el = now - game.t0, left = Math.max(0, game.dur - el);
    ctx.fillStyle = 'rgba(5,10,20,0.55)'; ctx.fillRect(0, 0, W, Hh);
    if (!game.over && left <= 0) { game.over = true; game.overT = now; if (game.score > G.best) { G.best = game.score; save(); } snd(300, 0.5, 'sine'); }
    if (!game.over) {
      if (now > game.next) { const prog = el / game.dur, r = 70 - prog * 40; game.targets.push({ x: 80 + Math.random() * (W - 160), y: 120 + Math.random() * (Hh - 240), r, born: now, life: 2400 - prog * 900 }); game.next = now + 900 - prog * 450; }
      for (let i = game.targets.length - 1; i >= 0; i--) { const t = game.targets[i], a = (now - t.born) / t.life; if (a > 1) { game.targets.splice(i, 1); continue; } const s = a < 0.15 ? a / 0.15 : 1, rr = t.r * s; for (let k = 5; k > 0; k--) { ctx.beginPath(); ctx.arc(t.x, t.y, rr * k / 5, 0, 7); ctx.fillStyle = k % 2 ? '#ff4d5e' : '#fff'; ctx.fill(); } ctx.strokeStyle = 'rgba(255,210,63,0.9)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(t.x, t.y, rr + 6, -Math.PI / 2, -Math.PI / 2 + (1 - a) * Math.PI * 2); ctx.stroke(); }
      ctx.fillStyle = '#fff'; ctx.font = 'bold 30px system-ui'; ctx.textAlign = 'left'; ctx.fillText('🎯 ' + game.score, 24, 44); ctx.font = 'bold 18px system-ui'; ctx.fillText(`Tabamused ${game.hits}/${game.shots} · täpsus ${game.shots ? Math.round(game.hits / game.shots * 100) : 0}%`, 24, 72);
      ctx.textAlign = 'right'; ctx.font = 'bold 30px system-ui'; ctx.fillText(Math.ceil(left / 1000) + ' s', W - 24, 44);
    } else {
      ctx.fillStyle = 'rgba(10,14,22,0.9)'; const bw = 460, bh = 280; ctx.fillRect(W / 2 - bw / 2, Hh / 2 - bh / 2, bw, bh);
      ctx.fillStyle = '#ffd23f'; ctx.textAlign = 'center'; ctx.font = 'bold 34px system-ui'; ctx.fillText('Mäng läbi!', W / 2, Hh / 2 - 80);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 22px system-ui'; ctx.fillText('Punktid: ' + game.score + (game.score >= G.best ? '  🏆 REKORD' : ''), W / 2, Hh / 2 - 30);
      const rt = game.react.length ? Math.round(game.react.reduce((a, b) => a + b, 0) / game.react.length) : 0;
      ctx.font = '18px system-ui'; ctx.fillText(`Täpsus ${game.shots ? Math.round(game.hits / game.shots * 100) : 0}% · tabamusi ${game.hits} · reaktsioon ${rt} ms`, W / 2, Hh / 2 + 10);
      ctx.fillText('Parim: ' + G.best, W / 2, Hh / 2 + 42); ctx.fillStyle = '#aaa'; ctx.fillText('Lase uuesti = uus mäng · Esc = välju', W / 2, Hh / 2 + 90);
    }
  }

  // ---------- paneel ----------
  function renderPanel() {
    const st = $('gunStatus'); if (!st) return;
    st.innerHTML = `Käte AI: <b>${H.status === 'ready' ? 'töötab ✓' : H.status === 'loading' ? 'laeb…' : 'väljas (kasutan hiirt)'}</b> · Sihtimine: <b>${G.model ? 'õpetatud ✓' : 'õpetamata'}</b> · Päästik: <b>${G.trigModel ? 'AI ✓' : 'reegel'}</b> · Rekord: <b>${G.best}</b>`;
    $('gunOS').textContent = G.mode === 'os' ? '🖱 Lõpeta OS-i juhtimine' : '🖱 Juhi TartuOS-i püssiga';
  }
  function save() { try { localStorage.setItem('tb-gun', JSON.stringify({ model: G.model, trig: G.trigModel ? G.trigModel.toJSON() : null, mark: G.mark, best: G.best })); } catch (e) { } }
  function load() { try { const o = JSON.parse(localStorage.getItem('tb-gun') || 'null'); if (o) { G.model = o.model; G.trigModel = o.trig ? AI.MLP.fromJSON(o.trig) : null; G.mark = o.mark; G.best = o.best || 0; } } catch (e) { } }
  G.init = function () {
    cv = $('gunLayer'); ctx = cv.getContext('2d'); load();
    const pv = $('gunCv'); pv._arOpts = { steerGauge: false, highlight: 'none' };
    pv._overlay = (x, W, Hh) => { const l = H.status === 'ready' ? gunHand() : null; if (l) { const t = l[8]; x.strokeStyle = '#ffd23f'; x.lineWidth = 3; x.beginPath(); x.arc(t.x * W, t.y * Hh, 16, 0, 7); x.stroke(); x.fillStyle = '#ffd23f'; x.font = 'bold 15px system-ui'; x.fillText('🔫 PÜSS', t.x * W + 20, t.y * Hh - 10); } if (G.mark) { x.fillStyle = '#ffd23f88'; x.beginPath(); x.arc(G.mark.x * W, G.mark.y * Hh, 8, 0, 7); x.fill(); } };
    pv.addEventListener('click', e => { const r = pv.getBoundingClientRect(); G.mark = { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }; save(); TB.toast('Püssi asukoht märgitud – AI jälgib seda kätt.'); });
    $('gunTeach').onclick = teach; $('gunPlay').onclick = startGame;
    $('gunOS').onclick = () => { if (G.mode === 'os') setMode('off'); else { TB.Game.camera(); setMode('os'); TB.toast('Siht nupule ja tõmba päästikut = klikk. Esc lõpetab.'); } };
    addEventListener('keydown', e => { if (e.code === 'Escape' && G.mode !== 'off') { e.stopPropagation(); setMode('off'); } }, true);
    cv.addEventListener('mousemove', e => { G.mouse.x = e.clientX / innerWidth; G.mouse.y = e.clientY / innerHeight; });
    cv.addEventListener('mousedown', () => G.mouse.down = true); addEventListener('mouseup', () => G.mouse.down = false);
    setInterval(renderPanel, 1000); renderPanel();
  };
})(window.TB);
