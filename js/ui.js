// ui.js — „TartuOS“: töölaud, aknad, tegumiriba ja Seadete äpp
window.TB = window.TB || {};
(function (TB) {
  'use strict';
  const $ = id => document.getElementById(id);
  const UI = TB.UI = TB.UI || {};
  const S = TB.S, V = TB.Vision, AI = TB.AI, H = TB.Hands;

  // ---------- aknahaldur ----------
  let z = 30;
  UI.open = function (id) {
    const w = $(id); if (!w) return; w.classList.add('open'); w.style.zIndex = ++z; renderTasks();
    if (id === 'winTeach') { TB.Teach.open(); TB.Game.camera(); }
    if (id === 'winGun') TB.Game.camera();
    if (id === 'winSettings') { renderSettings(); if (curSec === 'Juhtimine' || curSec === 'AI andmed') TB.Game.camera(); }
  };
  UI.close = function (id) { $(id).classList.remove('open'); renderTasks(); };
  UI.anyOpen = () => document.querySelectorAll('.win.open').length > 0;
  function makeDraggable(w) {
    const bar = w.querySelector('.titlebar'); let d = null;
    bar.addEventListener('pointerdown', e => { if (e.target.closest('button') || w.classList.contains('max')) return; const r = w.getBoundingClientRect(); w.style.left = r.left + 'px'; w.style.top = r.top + 'px'; w.style.transform = 'none'; d = { x: e.clientX - w.offsetLeft, y: e.clientY - w.offsetTop }; w.style.zIndex = ++z; bar.setPointerCapture(e.pointerId); });
    bar.addEventListener('pointermove', e => { if (!d) return; w.style.left = Math.max(0, Math.min(innerWidth - 120, e.clientX - d.x)) + 'px'; w.style.top = Math.max(0, Math.min(innerHeight - 80, e.clientY - d.y)) + 'px'; w.style.transform = 'none'; });
    bar.addEventListener('pointerup', () => d = null);
    bar.addEventListener('dblclick', () => w.classList.toggle('max'));
    w.addEventListener('pointerdown', () => { w.style.zIndex = ++z; });
    w.querySelector('.wclose').onclick = () => UI.close(w.id);
    const mx = w.querySelector('.wmax'); if (mx) mx.onclick = () => w.classList.toggle('max');
  }
  function renderTasks() {
    const names = { winSettings: '⚙️ Seaded', winTeach: '🎓 Õpeta ratast', winHelp: '❔ Abi', winGun: '🔫 Täpsuslask' };
    $('tasks').innerHTML = [...document.querySelectorAll('.win.open')].map(w => `<button data-w="${w.id}">${names[w.id] || w.id}</button>`).join('');
    $('tasks').querySelectorAll('button').forEach(b => b.onclick = () => { const w = $(b.dataset.w); w.style.zIndex = ++z; });
  }
  setInterval(() => { const d = new Date(); $('clock').textContent = d.toLocaleTimeString('et-EE', { hour: '2-digit', minute: '2-digit' }); $('clockDate').textContent = d.toLocaleDateString('et-EE'); }, 1000);
  UI.onVisionFrame = function () {
    const dot = $('trayCam'); if (dot) dot.className = 'tray-dot ' + (V.active ? 'on' : '');
    const hd = $('trayHand'); if (hd) { hd.className = 'tray-dot ' + (H.status === 'ready' ? 'on' : H.status === 'loading' ? 'warn' : H.status === 'error' ? 'err' : ''); hd.title = 'Käte AI: ' + H.status + (H.error ? ' – ' + H.error : ''); }
    if (curSec === 'Juhtimine' && $('winSettings').classList.contains('open')) {
      const set = (id, v) => { const e = $(id); if (e) e.style.width = (v * 100) + '%'; };
      set('lvB', V.val.brake); set('lvG', V.val.gas); const s = $('lvS'); if (s) s.style.left = (50 + V.val.steer * 48) + '%';
      const hs = $('handstat'); if (hs) hs.textContent = H.status === 'ready' ? `Käte AI töötab · ${H.fps} kaadrit/s · pidurikäsi ${H.roleB ? '✓' : '–'} · gaasikäsi ${H.roleG ? '✓' : '–'}` : H.status === 'loading' ? 'Käte AI laeb…' : H.status === 'error' ? '⚠ ' + H.error : 'Käte AI väljas';
    }
    if (curSec === 'AI andmed' && $('winSettings').classList.contains('open')) for (const k of ['brake', 'gas', 'steer']) { const p = V.ai[k], el = $('pred-' + k); if (el) el.textContent = p ? AI.CONTROLS[k].classes.map((c, i) => c + ' ' + Math.round(p[i] * 100) + '%').join(' · ') : (AI.models[k] ? 'ei näe' : 'treenimata'); }
  };

  // ---------- seaded ----------
  const SCHEMA = [
    { sec: 'Juhtimine', icon: '🎮', desc: 'Kaamera, käte AI ja tundlikkus', items: [
      { custom: 'preview' },
      { k: 'handsAI', t: 'toggle', label: 'Käte jälgimise AI', hint: 'Google MediaPipe – 21 punkti kummalgi käel' },
      { k: 'steerSrc', t: 'seg', label: 'Rool', opts: [['bar', '🚲 Lenksu keeramine'], ['hands', '🖐 Käte kalle'], ['head', '🙂 Pea kallutus']], hint: 'Kuhu lenks keerab, sinna ratas sõidab' },
      { k: 'lookCam', t: 'toggle', label: 'Pea juhib kaamerat', hint: 'Kuhu sa vaatad, sinna pöörab mängu kaamera (näo AI)' },
      { k: 'lookSens', t: 'range', label: 'Vaate tundlikkus', min: 0.3, max: 2.5, step: 0.1, fmt: v => v.toFixed(1) + '×' },
      { custom: 'recenter' },
      { k: 'steerSens', t: 'range', label: 'Rooli tundlikkus', min: 0.3, max: 2.5, step: 0.1, fmt: v => v.toFixed(1) + '×' },
      { k: 'deadzone', t: 'range', label: 'Rooli surnud tsoon', min: 0, max: 0.35, step: 0.01, fmt: v => Math.round(v * 100) + '%' },
      { k: 'invert', t: 'toggle', label: 'Pööra rool ümber' },
      { k: 'brakeSens', t: 'range', label: 'Piduri tundlikkus', min: 0.5, max: 2, step: 0.1, fmt: v => v.toFixed(1) + '×' },
      { k: 'gasSens', t: 'range', label: 'Gaasi tundlikkus', min: 0.5, max: 2, step: 0.1, fmt: v => v.toFixed(1) + '×' },
      { k: 'roiSize', t: 'range', label: 'Jälgimisala suurus (pildirežiim)', min: 16, max: 60, step: 2, fmt: v => v + ' px' },
      { k: 'showAR', t: 'toggle', label: 'AR eelvaade mängu ajal', hint: 'Väike kaamerapilt nooltega paremal üleval' },
      { custom: 'teachBtn' }
    ] },
    { sec: 'Graafika', icon: '🖥️', desc: 'Kvaliteet, vaatekaugus, efektid', items: [
      { k: 'quality', t: 'seg', label: 'Kvaliteet', opts: [['low', 'Madal'], ['medium', 'Keskmine'], ['high', 'Kõrge']], hint: 'Digiboksile vali Madal' },
      { k: 'viewDist', t: 'range', label: 'Vaatekaugus', min: 600, max: 5000, step: 100, fmt: v => (v / 1000).toFixed(1) + ' km' },
      { k: 'fov', t: 'range', label: 'Vaateväli (FOV)', min: 55, max: 105, step: 1, fmt: v => v + '°' },
      { k: 'speedLines', t: 'toggle', label: 'Kiirusjooned' },
      { k: 'clouds', t: 'toggle', label: 'Pilved' },
      { k: 'labels', t: 'toggle', label: 'Poodide ja kohtade sildid' }
    ] },
    { sec: 'Maailm', icon: '🗺️', desc: 'Kaart, liiklus, kiirus', items: [
      { k: 'mapMode', t: 'seg', label: 'Kaart', opts: [['builtin', '⚡ Sisseehitatud (kiire)'], ['osm', '🌍 Päris OSM (aeglane)']] },
      { k: 'traffic', t: 'range', label: 'Autode arv', min: 0, max: 200, step: 10, fmt: v => v + ' autot' },
      { k: 'maxSpeed', t: 'range', label: 'Tippkiirus', min: 25, max: 300, step: 5, fmt: v => v + ' km/h' },
      { k: 'battery', t: 'toggle', label: 'Aku tühjeneb' },
      { custom: 'mapInfo' }
    ] },
    { sec: 'Heli', icon: '🔊', desc: 'Helitugevus', items: [
      { k: 'volume', t: 'range', label: 'Helitugevus', min: 0, max: 1, step: 0.05, fmt: v => Math.round(v * 100) + '%' },
      { k: 'motorSound', t: 'toggle', label: 'Mootori heli' }
    ] },
    { sec: 'Kuva', icon: '🧭', desc: 'Minikaart, ühikud, vaade', items: [
      { k: 'minimap', t: 'toggle', label: 'Minikaart' },
      { k: 'units', t: 'seg', label: 'Kiiruse ühik', opts: [['kmh', 'km/h'], ['mph', 'mph']] },
      { k: 'firstPerson', t: 'toggle', label: 'Alusta sõitja silmadest (V vahetab)' },
      { k: 'hudScale', t: 'range', label: 'Näidikute suurus', min: 0.7, max: 1.4, step: 0.05, fmt: v => Math.round(v * 100) + '%' }
    ] },
    { sec: 'AI andmed', icon: '🧠', desc: 'Näited, treenimine, eksport', items: [{ custom: 'ai' }] },
    { sec: 'Teave', icon: 'ℹ️', desc: 'Versioon ja lähtestamine', items: [{ custom: 'about' }] }
  ];
  let curSec = 'Juhtimine';
  function renderSettings() {
    $('setSide').innerHTML = SCHEMA.map(s => `<button class="${s.sec === curSec ? 'sel' : ''}" data-s="${s.sec}"><span class="ic">${s.icon}</span><span><b>${s.sec}</b><small>${s.desc}</small></span></button>`).join('');
    $('setSide').querySelectorAll('button').forEach(b => b.onclick = () => { curSec = b.dataset.s; renderSettings(); if (curSec === 'Juhtimine' || curSec === 'AI andmed') TB.Game.camera(); });
    const sec = SCHEMA.find(s => s.sec === curSec); const box = $('setMain'); box.innerHTML = `<h2>${sec.icon} ${sec.sec}</h2>`;
    for (const it of sec.items) box.appendChild(it.custom ? custom(it.custom) : control(it));
  }
  function row(label, hint, ctrl) { const d = document.createElement('div'); d.className = 'srow'; d.innerHTML = `<div class="sl"><b>${label}</b>${hint ? `<small>${hint}</small>` : ''}</div>`; d.appendChild(ctrl); return d; }
  function changed(k, v) { const reload = TB.setSetting(k, v); if (reload) showReload(); }
  function showReload() { $('reloadBar').style.display = 'flex'; }
  function control(it) {
    const v = S[it.k]; let c;
    if (it.t === 'toggle') { c = document.createElement('label'); c.className = 'switch'; c.innerHTML = `<input type="checkbox" ${v ? 'checked' : ''}><i></i>`; c.querySelector('input').onchange = e => changed(it.k, e.target.checked); }
    else if (it.t === 'range') { c = document.createElement('div'); c.className = 'rng'; c.innerHTML = `<input type="range" min="${it.min}" max="${it.max}" step="${it.step}" value="${v}"><output>${it.fmt ? it.fmt(v) : v}</output>`; const inp = c.querySelector('input'), out = c.querySelector('output'); inp.oninput = () => { const n = parseFloat(inp.value); out.textContent = it.fmt ? it.fmt(n) : n; changed(it.k, n); }; }
    else if (it.t === 'seg') { c = document.createElement('div'); c.className = 'seg'; it.opts.forEach(([val, lab]) => { const b = document.createElement('button'); b.textContent = lab; if (val === v) b.classList.add('sel'); b.onclick = () => { c.querySelectorAll('button').forEach(x => x.classList.remove('sel')); b.classList.add('sel'); changed(it.k, val); }; c.appendChild(b); }); }
    return row(it.label, it.hint, c);
  }
  function custom(kind) {
    const d = document.createElement('div');
    if (kind === 'preview') {
      d.className = 'prevbox';
      d.innerHTML = `<canvas class="campreview" width="480" height="360"></canvas><div class="prevside"><div class="small" id="handstat"></div>
        <div class="lv"><span>Pidur</span><div class="meter"><i id="lvB" style="background:#ff4d5e"></i></div></div>
        <div class="lv"><span>Gaas</span><div class="meter"><i id="lvG" style="background:#3dff8a"></i></div></div>
        <div class="lv"><span>Rool</span><div class="meter" style="position:relative"><i id="lvS" style="position:absolute;left:50%;width:5px;background:#ffd23f"></i></div></div>
        <div id="handbox2" class="small"></div></div>`;
    } else if (kind === 'recenter') {
      d.className = 'srow'; d.innerHTML = `<div class="sl"><b>Vaate keskpunkt</b><small>Vaata otse ekraani ja vajuta (mängus klahv <kbd>L</kbd>)</small></div>`;
      const b = document.createElement('button'); b.textContent = '🎯 Sea otsevaade'; b.onclick = () => { H.recenterLook(); TB.toast('Otsevaade seatud.'); }; d.appendChild(b);
    } else if (kind === 'teachBtn') {
      d.className = 'srow'; d.innerHTML = `<div class="sl"><b>Õpeta ratast uuesti</b><small>Märgi pidur, gaas ja pea ning näita liigutusi</small></div>`;
      const b = document.createElement('button'); b.className = 'primary'; b.textContent = '🎓 Ava õpetaja'; b.onclick = () => UI.open('winTeach'); d.appendChild(b);
    } else if (kind === 'mapInfo') {
      d.className = 'srow'; d.innerHTML = `<div class="sl"><b>Kaardi allikas</b><small id="mapsrc">${TB.Game.mapSource || '–'}</small><small id="mapstats">${TB.Game.mapStats || ''}</small></div>`;
      const b = document.createElement('button'); b.textContent = '💾 Salvesta OSM kaart faili'; b.onclick = TB.Game.saveMap; d.appendChild(b);
    } else if (kind === 'ai') {
      d.innerHTML = `<p class="small">Siin näed ja haldad AI õppenäiteid. Lihtsam viis on <b>🎓 Õpeta ratast</b>.</p><canvas class="campreview" width="320" height="240" style="width:320px;max-width:100%"></canvas><div id="recmsg" class="small"></div><div id="aiControls"></div>
        <div class="row"><button class="primary" id="btnTrain">🧠 Treeni AI</button><button id="btnExport">⬇ Ekspordi AI</button><label class="btn"><input type="file" id="fileImport" accept=".json" hidden>⬆ Impordi AI</label></div>
        <div id="trainmsg" class="small"></div><canvas id="trainchart" width="420" height="90"></canvas>`;
      setTimeout(bindAI, 0);
    } else if (kind === 'about') {
      d.innerHTML = `<div class="about"><div class="logo">🚲</div><h3>Tartu E-Bike 300</h3><p class="small">TartuOS 3.0 · Three.js · Google MediaPipe käte AI · oma närvivõrk brauseris<br>Kaardiandmed: sisseehitatud Tartu / © OpenStreetMapi kaastöötajad</p>
        <div class="row"><button id="btnForget">🗑 Unusta õpetatud ratas</button><button id="btnReset">↺ Lähtesta kõik seaded</button></div></div>`;
      setTimeout(() => { $('btnForget').onclick = () => { if (confirm('Unusta märgid, kalibreerimine ja AI?')) { V.forget(); ['brake', 'gas', 'steer'].forEach(k => AI.clear(k)); TB.toast('Unustatud.'); } }; $('btnReset').onclick = () => { if (confirm('Lähtesta kõik seaded?')) TB.resetSettings(); }; }, 0);
    }
    return d;
  }
  // ---------- AI andmete paneel ----------
  UI.refreshAI = function () {
    const box = $('aiControls'); if (!box) return; box.innerHTML = '';
    for (const k of ['brake', 'gas', 'steer']) {
      const C = AI.CONTROLS[k], dim = V.featureDim(k), d = document.createElement('div'); d.className = 'aictl';
      const inf = AI.info[k], n = AI.data[k].filter(s => s.x.length === dim).length, ok = AI.models[k] && AI.models[k].sizes[0] === dim;
      d.innerHTML = `<h3>${C.name}<span>${ok && inf ? 'treenitud · ' + Math.round(inf.acc * 100) + '% · ' + n + ' näidet' : (n ? n + ' näidet, treenimata' : 'pole näiteid')}</span></h3>`;
      const r = document.createElement('div'); r.className = 'row';
      C.classes.forEach((cl, i) => { const b = document.createElement('button'); b.className = 'rec'; b.textContent = '● ' + cl + ' (' + AI.count(k, i, dim) + ')'; b.onclick = () => recOne(k, i); r.appendChild(b); });
      const del = document.createElement('button'); del.className = 'rec'; del.textContent = '🗑'; del.onclick = () => { if (confirm('Kustuta ' + C.name + ' näited?')) { AI.clear(k); UI.refreshAI(); } }; r.appendChild(del);
      d.appendChild(r); const p = document.createElement('div'); p.className = 'pred'; p.id = 'pred-' + k; d.appendChild(p); box.appendChild(d);
    }
  };
  async function recOne(k, cls) {
    if (V.rec) return; const name = AI.CONTROLS[k].name + ' → ' + AI.CONTROLS[k].classes[cls].toUpperCase();
    for (let t = 3; t > 0; t--) { $('recmsg').textContent = 'Valmistu: ' + name + ' … ' + t; await new Promise(r => setTimeout(r, 1000)); }
    V.onRec = (r, p) => { $('recmsg').textContent = '● Salvestan ' + name + ' ' + Math.round(p * 100) + '% (' + r.n + ')'; };
    const r = await V.record(k, cls, 4000); V.onRec = null;
    $('recmsg').textContent = r.n ? '✅ ' + r.n + ' näidet salvestatud.' : '⚠ Ei näinud midagi – kas käsi on pildis?'; await AI.save(); UI.refreshAI();
  }
  function bindAI() {
    UI.refreshAI();
    $('btnTrain').onclick = async () => {
      if (AI.training) return; AI.training = true; const hist = { brake: [], gas: [], steer: [] }, res = [];
      try {
        for (const k of ['brake', 'gas', 'steer']) {
          const dim = V.featureDim(k); if (!AI.data[k].some(s => s.x.length === dim)) continue;
          try { const inf = await AI.train(k, (ep, n, loss, acc) => { hist[k].push(acc); chart(hist); $('trainmsg').textContent = `${AI.CONTROLS[k].name}: ${ep}/${n} · ${Math.round(acc * 100)}%`; }, 40, dim); res.push(AI.CONTROLS[k].name + ' ' + Math.round(inf.acc * 100) + '%'); } catch (e) { res.push(e.message); }
        }
        $('trainmsg').textContent = res.length ? 'Valmis: ' + res.join(' · ') : 'Pole näiteid.';
      } finally { AI.training = false; UI.refreshAI(); }
    };
    $('btnExport').onclick = () => TB.Game.download('tartu-ebike-ai.json', JSON.stringify(AI.exportAll(V.rois)));
    $('fileImport').onchange = async e => { const f = e.target.files[0]; if (!f) return; try { AI.importAll(JSON.parse(await f.text())); await AI.save(); UI.refreshAI(); TB.toast('AI imporditud!'); } catch (err) { TB.toast('Import ebaõnnestus: ' + err.message); } };
  }
  function chart(hist) {
    const c = $('trainchart'); if (!c) return; const x = c.getContext('2d'); x.clearRect(0, 0, c.width, c.height);
    const cols = { brake: '#ff4d5e', gas: '#3dff8a', steer: '#ffd23f' };
    for (const k in hist) { const h = hist[k]; if (!h.length) continue; x.strokeStyle = cols[k]; x.lineWidth = 2; x.beginPath(); h.forEach((v, i) => { const px = i / Math.max(1, h.length - 1) * (c.width - 10) + 5, py = c.height - 5 - v * (c.height - 10); i ? x.lineTo(px, py) : x.moveTo(px, py); }); x.stroke(); }
  }

  // ---------- käivitus ----------
  UI.init = function () {
    document.querySelectorAll('.win').forEach(makeDraggable);
    document.querySelectorAll('[data-app]').forEach(el => el.onclick = () => {
      const a = el.dataset.app; $('startMenu').classList.remove('open');
      if (a === 'drive') TB.Game.drive(false); else if (a === 'driveCam') TB.Game.drive(true); else UI.open(a);
    });
    $('startBtn').onclick = () => $('startMenu').classList.toggle('open');
    $('reloadNow').onclick = () => location.reload();
    $('desktop').addEventListener('pointerdown', e => { if (!e.target.closest('#startMenu') && !e.target.closest('#startBtn')) $('startMenu').classList.remove('open'); });
    document.documentElement.style.setProperty('--hud', S.hudScale);
    TB.onSetting((k, v) => { if (k === 'hudScale') document.documentElement.style.setProperty('--hud', v); if (k === 'handsAI' && v && TB.Game) TB.Game.camera(); if (k === 'lookCam' && v && H.status === 'ready') H.initFace(); if (k === 'steerSrc') UI.refreshAI(); });
    TB.Teach.init(); TB.Gun.init();
  };
})(window.TB);
