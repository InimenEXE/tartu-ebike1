// traffic.js — autod sõidavad päris Tartu tänavavõrgus (ristmikel valivad uue tee)
window.TB = window.TB || {};
(function (TB) {
  'use strict';
  const T = TB.Traffic = { cars: [] };
  const W = TB.World;
  let adj, body, cabin, wheel, tail, head, carRoads;
  const COLORS = [0xc0c0c8, 0x1a1a1a, 0xffffff, 0xa01818, 0x1c3f8c, 0x2f5f3a, 0x7a7a80, 0xd9b23a, 0x5a3a2a, 0x0f6b8a, 0xe0e0e0, 0x303030];
  const SPEED = { hwy: [25, 33], main: [13, 17], street: [8.5, 12], plain: [4, 6.5] };

  T.init = function (scene, quality) {
    const N = Math.max(1, Math.round(TB.S ? TB.S.traffic : (quality === 'high' ? 110 : 40)));
    carRoads = W.roads.filter(r => r.car && r.len > 15);
    adj = new Map();
    for (const r of carRoads) r.n.forEach((id, i) => { let a = adj.get(id); if (!a) { a = []; adj.set(id, a); } a.push({ r, i }); });
    const bodyGeo = new THREE.BoxGeometry(1.86, 0.72, 4.5); bodyGeo.translate(0, 0.62, 0);
    const cabGeo = new THREE.BoxGeometry(1.62, 0.6, 2.4); cabGeo.translate(0, 1.27, -0.2);
    const wGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.26, 12); wGeo.rotateZ(Math.PI / 2);
    const tGeo = new THREE.BoxGeometry(1.6, 0.15, 0.06); tGeo.translate(0, 0.82, -2.26);
    const hGeo = new THREE.BoxGeometry(1.5, 0.14, 0.06); hGeo.translate(0, 0.72, 2.26);
    body = new THREE.InstancedMesh(bodyGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.6, roughness: 0.28 }), N);
    cabin = new THREE.InstancedMesh(cabGeo, new THREE.MeshStandardMaterial({ color: 0x141922, metalness: 0.8, roughness: 0.08 }), N);
    wheel = new THREE.InstancedMesh(wGeo, new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 }), N * 4);
    tail = new THREE.InstancedMesh(tGeo, new THREE.MeshStandardMaterial({ color: 0xff2020, emissive: 0xff0000, emissiveIntensity: 2 }), N);
    head = new THREE.InstancedMesh(hGeo, new THREE.MeshStandardMaterial({ color: 0xffffee, emissive: 0xffffcc, emissiveIntensity: 1.2 }), N);
    const c = new THREE.Color();
    for (let i = 0; i < N; i++) { body.setColorAt(i, c.setHex(COLORS[i % COLORS.length])); T.cars.push({ r: null, s: 0, dir: 1, v: 0, vmax: 10, lane: 2, x: 1e9, z: 1e9, ang: 0 }); }
    [body, cabin, wheel, tail, head].forEach(m => { m.castShadow = quality === 'high'; m.frustumCulled = false; scene.add(m); });
  };
  function setupOnRoad(car, r, s, dir) {
    car.r = r; car.s = s; car.dir = r.oneway ? 1 : dir;
    const sp = SPEED[r.cls] || SPEED.street; car.vmax = sp[0] + Math.random() * (sp[1] - sp[0]); car.v = car.vmax * 0.8;
    car.lane = r.oneway ? (r.lanes > 1 ? r.w / 4 : 0) : (r.cls === 'hwy' ? (Math.random() < 0.5 ? r.w * 0.15 : r.w * 0.36) : Math.max(1.6, r.w / 4));
  }
  function spawn(car, px, pz, forceNear) {
    const cand = []; let tot = 0;
    for (const r of carRoads) { if (r.maxx < px - 800 || r.minx > px + 800 || r.maxz < pz - 800 || r.minz > pz + 800) continue; cand.push(r); tot += Math.min(r.len, 800) * (r.cls === 'hwy' ? 3 : r.cls === 'main' ? 2 : r.cls === 'plain' ? 0.3 : 1); }
    if (!cand.length) { car.r = null; car.x = 1e9; return; }
    for (let tries = 0; tries < 20; tries++) {
      let pick = Math.random() * tot, r = cand[0];
      for (const c of cand) { pick -= Math.min(c.len, 800) * (c.cls === 'hwy' ? 3 : c.cls === 'main' ? 2 : c.cls === 'plain' ? 0.3 : 1); if (pick <= 0) { r = c; break; } }
      const s = Math.random() * r.len, p = W.roadPos(r, s); const d = Math.hypot(p.x - px, p.z - pz);
      if (d > 800 || (d < 90 && tries < 15)) continue;
      setupOnRoad(car, r, s, Math.random() < 0.5 ? 1 : -1); return;
    }
    car.r = null; car.x = 1e9;
  }
  function nextRoad(car) {
    const r = car.r, atEnd = car.dir > 0; const node = atEnd ? r.n[r.n.length - 1] : r.n[0];
    const opts = (adj.get(node) || []).filter(o => !(o.r === r && o.i === (atEnd ? r.n.length - 1 : 0)));
    const valid = [];
    for (const o of opts) {
      const last = o.r.n.length - 1;
      if (o.i < last) valid.push({ r: o.r, s: o.r.cum[o.i], dir: 1 });
      if (o.i > 0 && !o.r.oneway) valid.push({ r: o.r, s: o.r.cum[o.i], dir: -1 });
    }
    if (valid.length) { const v = valid[Math.random() * valid.length | 0]; const keepV = car.v; setupOnRoad(car, v.r, v.s, v.dir); car.dir = v.dir; car.v = Math.min(keepV, car.vmax); return true; }
    if (!r.oneway) { car.dir *= -1; return true; }
    return false;
  }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v3 = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), up = new THREE.Vector3(0, 1, 0), wo = new THREE.Vector3();
  const WP = [[0.86, 0.34, 1.45], [-0.86, 0.34, 1.45], [0.86, 0.34, -1.45], [-0.86, 0.34, -1.45]];
  T.reset = function () { for (const c of T.cars) c.r = null; };
  T.update = function (dt, P) {
    let spawned = 0;
    for (const c of T.cars) {
      if (!c.r) { if (spawned++ < 6) spawn(c, P.x, P.z); if (!c.r) continue; }
      let target = c.vmax;
      const fx = Math.sin(c.ang), fz = Math.cos(c.ang);
      for (const o of T.cars) { if (o === c || !o.r) continue; const dx = o.x - c.x, dz = o.z - c.z; if (dx * dx + dz * dz > 400) continue; const al = dx * fx + dz * fz, sd = Math.abs(-dx * fz + dz * fx); if (al > 0 && al < 16 && sd < 2.2 && Math.cos(o.ang - c.ang) > 0.3) { target = Math.min(target, al < 7 ? 0 : o.v * 0.9); } }
      const px = P.x - c.x, pz = P.z - c.z, al = px * fx + pz * fz, sd = Math.abs(-px * fz + pz * fx);
      if (al > 0 && al < 20 && sd < 2.6) target = Math.min(target, Math.max(0, (al - 6) * 0.8));
      c.v += (target - c.v) * Math.min(1, dt * (target < c.v ? 3 : 0.7));
      c.s += c.v * c.dir * dt;
      if (c.s < 0 || c.s > c.r.len) { c.s = Math.max(0, Math.min(c.r.len, c.s)); if (!nextRoad(c)) { c.r = null; continue; } }
      const p = W.roadPos(c.r, c.s), dfx = p.fx * c.dir, dfz = p.fz * c.dir;
      const nx = p.x - dfz * c.lane, nz = p.z + dfx * c.lane;
      const na = Math.atan2(dfx, dfz); let da = na - c.ang; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
      c.ang += da * Math.min(1, dt * 8); c.x = nx; c.z = nz;
      if (Math.hypot(c.x - P.x, c.z - P.z) > 1100) c.r = null;
    }
    T.cars.forEach((c, i) => {
      if (!c.r) { m4.makeScale(0, 0, 0); body.setMatrixAt(i, m4); cabin.setMatrixAt(i, m4); tail.setMatrixAt(i, m4); head.setMatrixAt(i, m4); for (let k = 0; k < 4; k++)wheel.setMatrixAt(i * 4 + k, m4); return; }
      q.setFromAxisAngle(up, c.ang); m4.compose(v3.set(c.x, 0, c.z), q, one);
      body.setMatrixAt(i, m4); cabin.setMatrixAt(i, m4); tail.setMatrixAt(i, m4); head.setMatrixAt(i, m4);
      WP.forEach((w, k) => { wo.set(w[0], w[1], w[2]).applyQuaternion(q); m4.compose(v3.set(c.x + wo.x, wo.y, c.z + wo.z), q, one); wheel.setMatrixAt(i * 4 + k, m4); });
    });
    body.instanceMatrix.needsUpdate = cabin.instanceMatrix.needsUpdate = wheel.instanceMatrix.needsUpdate = tail.instanceMatrix.needsUpdate = head.instanceMatrix.needsUpdate = true;
  };
})(window.TB);
