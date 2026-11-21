// game.js — mängu põhiloogika: laadimine (edenemisriba + aeg), ratas, füüsika, kaamera, HUD, minikaart, menüüd
window.TB = window.TB || {};
(function (TB) {
  'use strict';
  const $ = id => document.getElementById(id);
  const W = TB.World, V = TB.Vision, AI = TB.AI, H = TB.Hands, BK = TB.Bike;
  const Game = TB.Game = { running: false };
  const S = TB.S; let QUALITY = S.quality, renderer, scene, camera, sun, sky, clouds, worldBuilt = false, mapData = null, firstPerson = S.firstPerson;
  let VMAX = S.maxSpeed / 3.6;

  TB.toast = function (t, ms) { const e = $('toast'); e.textContent = t; e.style.display = 'block'; clearTimeout(e._t); e._t = setTimeout(() => e.style.display = 'none', ms || 5000); };

  // ---------- edenemisriba + hinnanguline aeg ----------
  function makeLoader(boxId, barId, msgId) {
    let t0 = 0, lastF = 0;
    return {
      start() { t0 = performance.now(); lastF = 0; $(boxId).style.display = 'block'; $(barId).style.width = '0%'; },
      set(f, msg) {
        f = Math.max(lastF, Math.min(1, f)); lastF = f; $(barId).style.width = (f * 100).toFixed(1) + '%';
        const el = (performance.now() - t0) / 1000; let eta = '';
        if (f > 0.04 && f < 0.999 && el > 0.4) { const rem = el * (1 - f) / f; eta = rem < 1.5 ? ' · peaaegu valmis' : ' · jäänud ~' + (rem < 60 ? Math.ceil(rem) + ' s' : Math.floor(rem / 60) + ' min ' + Math.ceil(rem % 60) + ' s'); }
        $(msgId).textContent = Math.round(f * 100) + '% · ' + (msg || '') + eta;
      },
      done() { $(boxId).style.display = 'none'; }
    };
  }
  const LOAD = makeLoader('loadbox', 'loadbar', 'loadmsg');
  const HLOAD = makeLoader('handbox', 'handbar', 'handmsg');

  // ---------- renderer, taevas, keskkonnavalgus ----------
  function skyMaterial() {
    return new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: 'varying vec3 vP;void main(){vP=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader: `varying vec3 vP;void main(){float h=vP.y;vec3 top=vec3(0.16,0.38,0.82);vec3 hor=vec3(0.78,0.86,0.95);vec3 c=mix(hor,top,pow(max(h,0.0),0.5));
      vec3 s=normalize(vec3(-0.45,0.55,0.35));float sd=max(dot(vP,s),0.0);c+=vec3(1.0,0.92,0.75)*pow(sd,600.0)*4.0+vec3(1.0,0.85,0.6)*pow(sd,12.0)*0.35+vec3(1.0,0.9,0.8)*pow(sd,3.0)*0.08;
      if(h<0.0)c=mix(hor,vec3(0.42,0.48,0.42),min(-h*8.0,1.0));gl_FragColor=vec4(c,1.0);}`
    });
  }
  function initRenderer() {
    renderer = new THREE.WebGLRenderer({ canvas: $('c'), antialias: QUALITY !== 'low', powerPreference: 'high-performance' });
    renderer.setPixelRatio(QUALITY === 'high' ? Math.min(devicePixelRatio, 2) : QUALITY === 'medium' ? 1 : Math.min(devicePixelRatio, 1) * 0.75);
    renderer.setSize(innerWidth, innerHeight);
    renderer.outputEncoding = THREE.sRGBEncoding; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = QUALITY !== 'low'; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.physicallyCorrectLights = false;
    scene = new THREE.Scene(); Game.scene = scene;
    const far = QUALITY === 'low' ? Math.min(S.viewDist, 1300) : S.viewDist; Game.viewDist = far;
    scene.fog = new THREE.Fog(0xc4d6ea, far * 0.12, far);
    camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.05, 9000); scene.add(camera);
    scene.add(new THREE.HemisphereLight(0xd6eaff, 0x56663a, 0.55));
    sun = new THREE.DirectionalLight(0xfff0d0, 2.6); sun.castShadow = QUALITY !== 'low'; const smz = QUALITY === 'high' ? 4096 : 2048; sun.shadow.mapSize.set(smz, smz);
    const sc = sun.shadow.camera; sc.left = -120; sc.right = 120; sc.top = 120; sc.bottom = -120; sc.near = 1; sc.far = 700; sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.05;
    scene.add(sun, sun.target);
    sky = new THREE.Mesh(new THREE.SphereGeometry(8000, 32, 16), skyMaterial()); sky.renderOrder = -1; scene.add(sky);
    // keskkonnakaart (peegeldused autodel, akendel, veel ja rattal)
    try { const envScene = new THREE.Scene(); envScene.add(new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), skyMaterial())); const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(envScene, 0.02).texture; pm.dispose(); } catch (e) { console.warn('env', e); }
    const NC = QUALITY === 'high' ? 260 : 80; clouds = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 2), new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x9aaabb, emissiveIntensity: 0.4, fog: false }), NC);
    const m4 = new THREE.Matrix4(); let ctr;
    for (let c = 0; c < NC; c++) { if (c % 6 === 0) ctr = { x: (Math.random() - .5) * 14000, z: (Math.random() - .5) * 14000, y: 650 + Math.random() * 350 }; const s = 50 + Math.random() * 130; m4.compose(new THREE.Vector3(ctr.x + (Math.random() - .5) * 360, ctr.y + Math.random() * 50, ctr.z + (Math.random() - .5) * 240), new THREE.Quaternion(), new THREE.Vector3(s * 1.7, s * 0.55, s)); clouds.setMatrixAt(c, m4); }
    scene.add(clouds); clouds.visible = S.clouds;
    // maapind: rohi kahes mõõtkavas
    const gc = document.createElement('canvas'); gc.width = gc.height = 512; const gx = gc.getContext('2d'); gx.fillStyle = '#5b8438'; gx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 40000; i++) { const v = (Math.random() - .5) * 0.2; gx.fillStyle = v > 0 ? `rgba(220,255,160,${v})` : `rgba(0,30,0,${-v})`; gx.fillRect(Math.random() * 512, Math.random() * 512, 1 + Math.random() * 2, 2 + Math.random() * 3); }
    for (let i = 0; i < 70; i++) { gx.fillStyle = `rgba(${70 + Math.random() * 40},${100 + Math.random() * 40},${30 + Math.random() * 20},0.18)`; gx.beginPath(); gx.arc(Math.random() * 512, Math.random() * 512, 15 + Math.random() * 60, 0, 7); gx.fill(); }
    const gt = new THREE.CanvasTexture(gc); gt.wrapS = gt.wrapT = THREE.RepeatWrapping; gt.repeat.set(12000, 12000); gt.encoding = THREE.sRGBEncoding; gt.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(160000, 160000), new THREE.MeshStandardMaterial({ map: gt, roughness: 1, envMapIntensity: 0.3 })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
    addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });
  }

  // ---------- sildid ----------
  const labelPool = [], texCache = new Map();
  function labelTex(name, k) {
    const key = k + name; if (texCache.has(key)) return texCache.get(key);
    if (texCache.size > 400) { for (const t of texCache.values()) t.dispose(); texCache.clear(); }
    const c = document.createElement('canvas'); c.width = 512; c.height = 96; const x = c.getContext('2d'); x.font = 'bold 44px system-ui,sans-serif';
    const txt = name.length > 22 ? name.slice(0, 21) + '…' : name; const w = Math.min(500, x.measureText(txt).width + 40);
    x.fillStyle = k === 'shop' ? 'rgba(200,40,80,0.88)' : k === 'place' ? 'rgba(255,210,63,0.9)' : 'rgba(15,20,30,0.82)'; x.beginPath(); if (x.roundRect) x.roundRect((512 - w) / 2, 10, w, 76, 20); else x.rect((512 - w) / 2, 10, w, 76); x.fill();
    x.fillStyle = k === 'place' ? '#111' : '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(txt, 256, 50);
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; texCache.set(key, t); return t;
  }
  function initLabels() { for (let i = 0; i < (QUALITY === 'high' ? 40 : 16); i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ fog: false, depthTest: true })); s.scale.set(24, 4.5, 1); s.visible = false; scene.add(s); labelPool.push(s); } }
  function updateLabels() {
    if (!S.labels) { labelPool.forEach(s => s.visible = false); return; }
    const near = []; for (const l of W.labels) { const r = l.k === 'place' ? 700 : 280; const d = (l.x - P.x) ** 2 + (l.z - P.z) ** 2; if (d < r * r) near.push([d, l]); }
    near.sort((a, b) => a[0] - b[0]); const used = new Set();
    let j = 0; for (const [, l] of near) { if (j >= labelPool.length) break; const key = l.name + Math.round(l.x / 30); if (used.has(key)) continue; used.add(key); const s = labelPool[j++]; s.material.map = labelTex(l.name, l.k); s.material.needsUpdate = true; s.position.set(l.x, (l.y || 0) + (l.k === 'place' ? 40 : 5), l.z); s.scale.set(l.k === 'place' ? 60 : 24, l.k === 'place' ? 11 : 4.5, 1); s.visible = true; }
    for (; j < labelPool.length; j++) labelPool[j].visible = false;
  }

  // ---------- mängija ----------
  const P = Game.player = { x: 0, z: 0, heading: 0, v: 0, steer: 0, bat: 100, crash: 0, shake: 0, odo: 0 };
  const TELEPORTS = [
    { n: 'Raekoja plats', ll: [58.3801, 26.7224] },
    { n: 'Tallinna maantee – 300 km/h!', ll: [58.4300, 26.6450], hwy: true },
    { n: 'Ihaste', ll: [58.3555, 26.7790] },
    { n: 'Lõunakeskus', ll: [58.3578, 26.6775] },
    { n: 'Annelinn', ll: [58.3715, 26.7620] },
    { n: 'Supilinn', ll: [58.3878, 26.7215] },
    { n: 'Karlova', ll: [58.3700, 26.7270] },
    { n: 'Eesti Rahva Muuseum', ll: [58.3965, 26.7525] },
    { n: 'Riia maantee', ll: [58.3250, 26.6250], hwy: true },
    { n: 'Võru maantee', ll: [58.3150, 26.7600], hwy: true },
    { n: 'Narva maantee', ll: [58.4250, 26.8400], hwy: true },
  ];
  let tpIdx = 0;
  function teleport(t) {
    const p = TB.P(t.ll[0], t.ll[1]); let best = 1e18, br = null, bi = 0;
    for (const r of W.roads) {
      if (!r.car) continue; if (t.hwy && r.cls !== 'hwy' && r.cls !== 'main') continue;
      if (r.maxx < p[0] - 3000 || r.minx > p[0] + 3000 || r.maxz < p[1] - 3000 || r.minz > p[1] + 3000) continue;
      for (let i = 0; i < r.g.length - 2; i += 2) { const d = (r.g[i] - p[0]) ** 2 + (r.g[i + 1] - p[1]) ** 2; if (d < best) { best = d; br = r; bi = i; } }
    }
    if (!br) { P.x = p[0]; P.z = p[1]; }
    else { const dx = br.g[bi + 2] - br.g[bi], dz = br.g[bi + 3] - br.g[bi + 1], l = Math.hypot(dx, dz) || 1; P.x = br.g[bi] - dz / l * br.w * 0.22; P.z = br.g[bi + 1] + dx / l * br.w * 0.22; P.heading = Math.atan2(dx / l, dz / l); }
    P.v = 0; TB.Traffic.reset(); showMsg(t.n); W.updateVisibility(P.x, P.z, Game.viewDist); updateLabels();
  }

  // ---------- sisend ----------
  const keys = {};
  addEventListener('keydown', e => {
    keys[e.code] = true; if (!Game.running) return;
    if (e.code === 'KeyT') { tpIdx = (tpIdx + 1) % TELEPORTS.length; teleport(TELEPORTS[tpIdx]); }
    if (e.code === 'KeyR') { tpIdx = 0; P.bat = 100; teleport(TELEPORTS[0]); }
    if (e.code === 'KeyC') { Game.running = false; $('desktop').style.display = 'block'; $('hud').style.display = 'none'; UI.open('winTeach'); }
    if (e.code === 'KeyV') { firstPerson = !firstPerson; showMsg(firstPerson ? 'Vaade: sõitja silmad' : 'Vaade: tagant'); }
    if (e.code === 'KeyL') { H.recenterLook(); showMsg('Otsevaade seatud'); }
    if (e.code === 'KeyM') miniZoom = miniZoom === 1 ? 3 : miniZoom === 3 ? 10 : 1;
    if (e.code === 'Escape' || e.code === 'Backspace') { Game.running = false; $('desktop').style.display = 'block'; $('hud').style.display = 'none'; }
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  });
  addEventListener('keyup', e => { keys[e.code] = false; });
  function inputs() {
    let gas = 0, brake = 0, steer = 0;
    if (keys.KeyW || keys.ArrowUp) gas = 1; if (keys.KeyS || keys.ArrowDown || keys.Space) brake = 1;
    if (keys.KeyA || keys.ArrowLeft) steer -= 1; if (keys.KeyD || keys.ArrowRight) steer += 1;
    const gp = navigator.getGamepads ? navigator.getGamepads()[0] : null;
    if (gp) { gas = Math.max(gas, gp.buttons[7] ? gp.buttons[7].value : 0); brake = Math.max(brake, gp.buttons[6] ? gp.buttons[6].value : 0); if (!steer && Math.abs(gp.axes[0]) > 0.15) steer = gp.axes[0]; }
    if (V.ready()) { gas = Math.max(gas, V.val.gas); brake = Math.max(brake, V.val.brake); if (!steer) steer = V.val.steer; }
    return { gas, brake, steer };
  }

  // ---------- füüsika ----------
  let locT = 0;
  function update(dt) {
    const inp = inputs();
    P.steer += (inp.steer - P.steer) * Math.min(1, dt * (V.ready() ? 6 : 4));
    const nr = W.nearestRoad(P.x, P.z), onRoad = nr.d < 1.2, inWater = !onRoad && W.waterAt(P.x, P.z);
    let a = 0; const v = P.v;
    if (P.bat > 0 && inp.gas > 0) { a += inp.gas * (9.5 * (1 - Math.pow(v / (VMAX * 1.1), 3)) + (v < 15 ? 3 : 0)); if (S.battery) P.bat = Math.max(0, P.bat - inp.gas * dt * 0.06 * (0.4 + v / VMAX)); }
    a -= inp.brake * 14 * (v > 0 ? 1 : 0); a -= 0.25 + 0.00012 * v * v;
    if (!onRoad) a -= inWater ? 6 + v * 0.3 : 0.6 + v * 0.03;
    P.v = Math.max(0, Math.min(VMAX, P.v + a * dt));
    const yaw = P.steer * (1.6 * 14 / (14 + P.v)) * (P.v > 0.5 ? 1 : P.v * 2); P.heading -= yaw * dt;
    const dist = P.v * dt, steps = Math.max(1, Math.ceil(dist / 1.5));
    for (let s = 0; s < steps; s++) {
      const nx = P.x + Math.sin(P.heading) * dist / steps, nz = P.z + Math.cos(P.heading) * dist / steps;
      if (W.buildingAt(nx + Math.sin(P.heading) * 0.9, nz + Math.cos(P.heading) * 0.9)) { if (P.v > 8) crash('BÄNG! Maja!'); P.v = 0; break; }
      P.odo += dist / steps; P.x = nx; P.z = nz;
    }
    for (const c of TB.Traffic.cars) {
      if (!c.r) continue; const dx = P.x - c.x, dz = P.z - c.z; if (Math.abs(dx) > 4 || Math.abs(dz) > 4) continue;
      const fx = Math.sin(c.ang), fz = Math.cos(c.ang), lz = dx * fx + dz * fz, lx = -dx * fz + dz * fx;
      if (Math.abs(lz) < 2.6 && Math.abs(lx) < 1.3 && (P.v > 3 || c.v > 3)) { crash('KRAHH! Auto!'); P.v *= 0.15; c.v = 0; const sg = Math.sign(lx || 1); P.x += sg * (-fz) * 1.6; P.z += sg * fx * 1.6; }
    }
    P.shake = Math.max(0, P.shake - dt * 2); if (!onRoad) P.shake = Math.max(P.shake, Math.min(0.3, P.v * 0.01));
    if (inWater && Math.random() < dt * 1.5) showMsg('Pläts! Emajõgi 🌊');
    locT -= dt; if (locT < 0) { locT = 0.5; $('loc').textContent = inWater ? 'Emajõgi' : (nr.road && nr.d < 25 ? (nr.road.name || nr.road.h) : 'Tartumaa'); }
    return inp;
  }
  function crash(t) { if (P.crash > 0) return; P.crash = 1.2; P.shake = 1; showMsg(t); sfx(); }
  let msgT = 0; function showMsg(t) { const m = $('msg'); m.textContent = t; m.style.opacity = 1; msgT = 2.2; }

  // ---------- kiirusjooned ----------
  let lines;
  function buildLines() {
    const N = 260, g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 6), 3));
    lines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, fog: false, depthWrite: false })); lines.frustumCulled = false;
    lines.userData.p = []; for (let i = 0; i < N; i++) lines.userData.p.push({ x: (Math.random() - .5) * 16, y: Math.random() * 6 - 1.5, z: -Math.random() * 60 }); camera.add(lines);
  }
  function updateLines(dt) {
    const k = S.speedLines ? Math.max(0, (P.v - 25) / (83.3 - 25)) : 0; lines.material.opacity = k * 0.45; if (k <= 0) return;
    const pos = lines.geometry.attributes.position.array;
    lines.userData.p.forEach((p, i) => { p.z += P.v * dt * 1.2; if (p.z > 0) { p.z = -60; p.x = (Math.random() - .5) * 16; p.y = Math.random() * 6 - 1.5; if (Math.abs(p.x) < 1.2 && Math.abs(p.y) < 0.8) p.x += p.x < 0 ? -2 : 2; } const L = 0.5 + k * 3.5; pos.set([p.x, p.y, p.z, p.x, p.y, p.z - L], i * 6); });
    lines.geometry.attributes.position.needsUpdate = true;
  }

  // ---------- heli ----------
  let AC, motor, motorG, windG, tireG;
  function initAudio() {
    try {
      AC = new (window.AudioContext || window.webkitAudioContext)();
      motor = AC.createOscillator(); motor.type = 'sawtooth'; motorG = AC.createGain(); motorG.gain.value = 0; const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1600; motor.connect(lp); lp.connect(motorG); motorG.connect(AC.destination); motor.start();
      const buf = AC.createBuffer(1, AC.sampleRate * 2, AC.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const wind = AC.createBufferSource(); wind.buffer = buf; wind.loop = true; const bp = AC.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 600; bp.Q.value = 0.6; windG = AC.createGain(); windG.gain.value = 0; wind.connect(bp); bp.connect(windG); windG.connect(AC.destination); wind.start();
      const tire = AC.createBufferSource(); tire.buffer = buf; tire.loop = true; const lp2 = AC.createBiquadFilter(); lp2.type = 'lowpass'; lp2.frequency.value = 300; tireG = AC.createGain(); tireG.gain.value = 0; tire.connect(lp2); lp2.connect(tireG); tireG.connect(AC.destination); tire.start();
    } catch (e) { }
  }
  function updateAudio(inp) { if (!AC) return; const k = P.v / 83.3, on = Game.running ? 1 : 0; motor.frequency.setTargetAtTime(80 + k * 1300, AC.currentTime, 0.05); const vol = S.volume; motorG.gain.setTargetAtTime(on * vol * (S.motorSound ? 0.012 + inp.gas * 0.04 + k * 0.025 : 0), AC.currentTime, 0.08); windG.gain.setTargetAtTime(on * vol * Math.min(0.35, k * k * 0.45), AC.currentTime, 0.1); tireG.gain.setTargetAtTime(on * vol * Math.min(0.15, P.v * 0.006), AC.currentTime, 0.1); }
  function sfx() { if (!AC) return; const o = AC.createOscillator(), g = AC.createGain(); o.type = 'square'; o.frequency.setValueAtTime(140, AC.currentTime); o.frequency.exponentialRampToValueAtTime(30, AC.currentTime + 0.5); g.gain.setValueAtTime(0.3, AC.currentTime); g.gain.exponentialRampToValueAtTime(0.001, AC.currentTime + 0.6); o.connect(g); g.connect(AC.destination); o.start(); o.stop(AC.currentTime + 0.6); }

  // ---------- minikaart ----------
  let miniZoom = 1; const mini = $('mini'), mx = mini.getContext('2d');
  const MCOL = { hwy: '#ffcc33', main: '#ffffff', street: '#d8d8d8', plain: '#a8a8a8', gravel: '#b09a70', paving: '#8a8f80' };
  function drawMini() {
    const S = 240, sc = 0.45 / miniZoom, R = (S / 2) / sc * 1.45;
    mx.save(); mx.fillStyle = '#24361f'; mx.fillRect(0, 0, S, S); mx.translate(S / 2, S / 2); mx.rotate(P.heading + Math.PI); mx.scale(sc, sc); mx.translate(-P.x, -P.z);
    mx.fillStyle = '#3b7fb0'; for (const w of W.waters) { if (w.maxx < P.x - R || w.minx > P.x + R || w.maxz < P.z - R || w.minz > P.z + R) continue; mx.beginPath(); for (let i = 0; i < w.g.length; i += 2) i ? mx.lineTo(w.g[i], w.g[i + 1]) : mx.moveTo(w.g[i], w.g[i + 1]); mx.fill(); }
    if (miniZoom < 5) { mx.fillStyle = '#8c8577'; for (const b of W.buildings) { if (b.maxx < P.x - R || b.minx > P.x + R || b.maxz < P.z - R || b.minz > P.z + R) continue; mx.beginPath(); for (let i = 0; i < b.g.length; i += 2) i ? mx.lineTo(b.g[i], b.g[i + 1]) : mx.moveTo(b.g[i], b.g[i + 1]); mx.fill(); } }
    for (const cls of ['paving', 'gravel', 'plain', 'street', 'main', 'hwy']) {
      if (miniZoom >= 5 && (cls === 'paving' || cls === 'plain' || cls === 'gravel')) continue;
      mx.strokeStyle = MCOL[cls]; mx.lineWidth = (cls === 'hwy' ? 4 : cls === 'main' ? 3 : 1.5) / sc * (cls === 'paving' ? 0.5 : 1); mx.beginPath();
      for (const r of W.roads) { if (r.cls !== cls || r.maxx < P.x - R || r.minx > P.x + R || r.maxz < P.z - R || r.minz > P.z + R) continue; for (let i = 0; i < r.g.length; i += 2) i ? mx.lineTo(r.g[i], r.g[i + 1]) : mx.moveTo(r.g[i], r.g[i + 1]); }
      mx.stroke();
    }
    mx.fillStyle = '#ff4040'; for (const c of TB.Traffic.cars) if (c.r && Math.abs(c.x - P.x) < R && Math.abs(c.z - P.z) < R) mx.fillRect(c.x - 3 / sc, c.z - 3 / sc, 6 / sc, 6 / sc);
    mx.restore(); mx.fillStyle = '#ffd23f'; mx.beginPath(); mx.moveTo(S / 2, S / 2 - 10); mx.lineTo(S / 2 - 7, S / 2 + 8); mx.lineTo(S / 2 + 7, S / 2 + 8); mx.fill();
  }

  // ---------- laadimine ja ehitus ----------
  async function ensureWorld() {
    if (worldBuilt) return true;
    if (Game.building) return Game.building;
    Game.building = (async () => {
      LOAD.start();
      try {
        const isOsm = TB.mapMode() === 'osm', mapShare = isOsm ? 0.6 : 0.3;
        mapData = await TB.loadMap((f, m) => LOAD.set(f * mapShare, m));
        Game.mapSource = mapData.source;
        LOAD.set(mapShare, 'Valmistan graafikat ette…'); await new Promise(r => setTimeout(r, 0));
        initRenderer();
        await W.build(mapData, scene, renderer, QUALITY === 'low' ? 'low' : 'high', (f, m) => LOAD.set(mapShare + f * (0.97 - mapShare), m));
        Game.mapStats = `${W.stats.buildings} maja · ${W.stats.roads} teed · ${W.stats.labels} silti · ${W.stats.trees} puud`;
        LOAD.set(0.97, 'Liiklus ja e-ratas…'); await new Promise(r => setTimeout(r, 0));
        TB.Traffic.init(scene, QUALITY === 'low' ? 'low' : 'high'); BK.build(scene); buildLines(); initLabels();
        worldBuilt = true; teleport(TELEPORTS[0]); $('msg').style.opacity = 0;
        LOAD.set(1, 'Valmis!'); setTimeout(() => LOAD.done(), 400);
        if (mapData.osmFailed) TB.toast('OpenStreetMap ei vastanud – kasutan sisseehitatud Tartut.', 7000);
        requestAnimationFrame(loop); return true;
      } catch (e) { console.error(e); TB.toast('Viga laadimisel: ' + e.message, 10000); return false; }
    })();
    return Game.building;
  }
  function startGame() {
    if (!AC) initAudio(); else if (AC.resume) AC.resume();
    $('desktop').style.display = 'none'; $('hud').style.display = 'block'; $('cam').style.display = V.ready() && S.showAR ? 'block' : 'none';
    Game.running = true; last = performance.now(); showMsg(TELEPORTS[tpIdx].n);
  }
  // kaamera (+ käte AI) käivitamine
  let camLoop = false;
  Game.camera = async function () {
    if (!(await V.start())) return false;
    if (!camLoop) { camLoop = true; const f = t => { V.tick(t); requestAnimationFrame(f); }; requestAnimationFrame(f); }
    if (S.handsAI && H.status !== 'ready' && H.status !== 'loading') startHands();
    return true;
  };
  async function startHands() {
    HLOAD.start();
    const ok = await H.init((f, m) => HLOAD.set(f, m));
    setTimeout(() => HLOAD.done(), ok ? 800 : 6000);
    if (ok) { TB.toast('🖐 Käte AI töötab! Hoia käed kaamera pildis.'); UI.refreshAI && UI.refreshAI(); }
    else { HLOAD.set(1, '⚠ ' + H.error + ' – kasutan pildikaste'); }
  }
  Game.drive = async function (useCam) {
    if (useCam) {
      const ok = await Game.camera(); if (!ok) return;
      if (!V.ready()) { TB.toast('Õpeta enne ratast: märgi pidur ja gaas ning näita liigutusi.'); UI.open('winTeach'); return; }
    }
    if (!(await ensureWorld())) return;
    document.querySelectorAll('.win.open').forEach(w => UI.close(w.id));
    startGame();
  };
  Game.download = function (name, text) { const b = new Blob([text], { type: 'application/json' }), a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); };
  Game.saveMap = async function () { const d = await TB.idbGet('osm-v2'); if (!d) { TB.toast('Päris OSM kaarti pole veel laetud – vali Seaded → Maailm → Päris OSM.'); return; } Game.download('tartu-osm.json', JSON.stringify(d)); };
  const UI = TB.UI;
  TB.onSetting((k, v) => {
    if (k === 'maxSpeed') VMAX = v / 3.6;
    if (k === 'viewDist' && scene) { Game.viewDist = v; scene.fog.far = v; scene.fog.near = v * 0.12; }
    if (k === 'clouds' && clouds) clouds.visible = v;
    if (k === 'showAR') $('cam').style.display = v && V.ready() && Game.running ? 'block' : 'none';
  });

  // ---------- põhitsükkel ----------
  let last = performance.now(), dispT = 0, miniT = 0, visT = 0, labT = 0;
  const lookE = new THREE.Euler(), lookQ = new THREE.Quaternion(), camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), tv = new THREE.Vector3(), tq = new THREE.Quaternion(), fpQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.3, Math.PI, 0, 'YXZ'));
  function placeCamera(dt, now) {
    const root = BK.root; root.position.set(P.x, 0, P.z); root.rotation.y = P.heading; root.updateMatrixWorld();
    if (firstPerson) {
      const sh = P.shake * 0.05, bob = Math.sin(P.odo * 1.1) * 0.008 * Math.min(1, P.v / 5);
      camera.position.copy(root.localToWorld(tv.set((Math.random() - .5) * sh, 1.55 + bob + (Math.random() - .5) * sh, -0.16)));
      root.getWorldQuaternion(tq); camera.quaternion.copy(tq).multiply(fpQ);
      if (S.lookCam && H.faceStatus === 'ready') { lookE.set(Math.max(-0.6, Math.min(0.6, -H.look.pitch * 1.2 * S.lookSens)), Math.max(-1.3, Math.min(1.3, -H.look.yaw * 2.2 * S.lookSens)), 0, 'YXZ'); lookQ.setFromEuler(lookE); camera.quaternion.multiply(lookQ); }
      camPos.copy(camera.position);
    } else {
      const want = root.localToWorld(tv.set(0, 2.4, -5.2)); camPos.lerp(want, Math.min(1, dt * 6)); if (camPos.distanceTo(want) > 30) camPos.copy(want);
      camera.position.copy(camPos); camLook.copy(root.localToWorld(tv.set(0, 1.1, 2.5))); camera.up.set(0, 1, 0); camera.lookAt(camLook);
    }
    const fov = S.fov - (firstPerson ? 0 : 7) + Math.min(1, P.v / 83.3) * 25; if (Math.abs(camera.fov - fov) > 0.1) { camera.fov = fov; camera.updateProjectionMatrix(); }
  }
  function loop(now) {
    requestAnimationFrame(loop);
    if (!camLoop) V.tick(now);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (W.waterTex) { W.waterTex.offset.x += dt * 0.004; W.waterTex.offset.y += dt * 0.002; }
    if (!Game.running) { // menüü taustal aeglane tiir
      BK.update(dt, P, { gas: 0, brake: 0, steer: 0 }, false); BK.root.position.set(P.x, 0, P.z); BK.root.rotation.y = P.heading;
      const a = now * 0.00015; camera.position.set(P.x + Math.sin(a) * 6, 2.2, P.z + Math.cos(a) * 6); camera.lookAt(P.x, 1, P.z);
      sky.position.set(P.x, 0, P.z); sun.position.set(P.x - 140, 200, P.z + 100); sun.target.position.set(P.x, 0, P.z); renderer.render(scene, camera); updateAudio({ gas: 0 }); return;
    }
    const inp = update(dt); TB.Traffic.update(dt, P); P.crash = Math.max(0, P.crash - dt);
    BK.update(dt, P, inp, firstPerson); placeCamera(dt, now);
    sun.position.set(P.x - 140, 200, P.z + 100); sun.target.position.set(P.x, 0, P.z); sky.position.set(P.x, 0, P.z); clouds.position.set(P.x * 0.85, 0, P.z * 0.85);
    visT -= dt; if (visT < 0) { visT = 0.4; W.updateVisibility(P.x, P.z, Game.viewDist); }
    labT -= dt; if (labT < 0) { labT = 0.6; updateLabels(); }
    updateLines(dt); updateAudio(inp);
    renderer.render(scene, camera);
    const kmh = P.v * 3.6; $('spd').textContent = Math.round(S.units === 'mph' ? kmh / 1.609 : kmh); $('spdU').textContent = S.units === 'mph' ? 'mph' : 'km/h'; $('bGas').style.height = (inp.gas * 100) + '%'; $('bBrake').style.height = (inp.brake * 100) + '%'; $('bBat').style.height = P.bat + '%'; $('steerI').style.left = (127 + P.steer * 120) + 'px';
    dispT -= dt; if (dispT < 0) { dispT = 0.15; BK.drawDisplay(kmh, P.bat, V.ready() ? (V.handsOn() ? 'KÄTE AI' : 'KAAMERA') : 'TURBO', kmh > 150 ? 'TURBO 300' : kmh > 60 ? 'SPORT' : 'ECO'); }
    mini.style.display = S.minimap ? 'block' : 'none'; miniT -= dt; if (miniT < 0 && S.minimap) { miniT = QUALITY === 'high' ? 0.06 : 0.15; drawMini(); }
    if (msgT > 0) { msgT -= dt; if (msgT <= 0) $('msg').style.opacity = 0; }
    if (P.bat <= 0 && Math.random() < dt * 0.4) showMsg('Aku tühi! Vajuta R');
  }

  // ---------- käivitus ----------
  V.loadSettings(); UI.init();
  AI.load().then(() => UI.refreshAI && UI.refreshAI());
  Game.teleport = t => teleport(t); Game.TELEPORTS = TELEPORTS;
  ensureWorld();   // ehitame Tartu kohe taustale (kiire)
})(window.TB);
