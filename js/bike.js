// bike.js — realistlik e-ratta 3D mudel (raam, aku, vedrukahvel, kodaratega rattad, ketaspidurid, ekraan, tuled) ja sõitja
// Kohalikud teljed: +z = ette, +y = üles, -x = sõitja parem pool
window.TB = window.TB || {};
(function (TB) {
  'use strict';
  const B = TB.Bike = {};
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const UP = V3(0, 1, 0);
  function tube(a, b, r, mat, seg) {
    const d = new THREE.Vector3().subVectors(b, a), len = d.length();
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg || 10), mat);
    m.position.copy(a).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(UP, d.normalize()); m.castShadow = true; return m;
  }
  // liigutatav jäse (ühikpikkusega silinder)
  function limb(r, mat) { const g = new THREE.CylinderGeometry(r, r * 0.85, 1, 10); g.translate(0, 0.5, 0); const m = new THREE.Mesh(g, mat); m.castShadow = true; return m; }
  function setLimb(m, a, b) { const d = new THREE.Vector3().subVectors(b, a), l = d.length(); m.position.copy(a); m.quaternion.setFromUnitVectors(UP, d.multiplyScalar(1 / (l || 1))); m.scale.set(1, l, 1); }
  function wheel(mats, motor) {
    const g = new THREE.Group();
    const tire = new THREE.Mesh(new THREE.TorusGeometry(0.335, 0.034, 14, 56), mats.rubber); tire.rotation.y = Math.PI / 2; tire.castShadow = true; g.add(tire);
    // turvise muster
    const tread = new THREE.Mesh(new THREE.TorusGeometry(0.352, 0.012, 4, 90), mats.rubberDark); tread.rotation.y = Math.PI / 2; g.add(tread);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.302, 0.013, 8, 56), mats.alu); rim.rotation.y = Math.PI / 2; g.add(rim);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(motor ? 0.085 : 0.025, motor ? 0.085 : 0.025, motor ? 0.07 : 0.1, 20), motor ? mats.black : mats.alu); hub.rotation.z = Math.PI / 2; g.add(hub);
    if (motor) { const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.075, 20), mats.alu); cap.rotation.z = Math.PI / 2; g.add(cap); }
    const rotor = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.012, 4, 32), mats.chrome); rotor.rotation.y = Math.PI / 2; rotor.position.x = -0.045; g.add(rotor);
    // kodarad
    const pos = []; const hr = motor ? 0.07 : 0.022;
    for (let i = 0; i < 32; i++) { const a = i / 32 * Math.PI * 2, b = a + (i % 2 ? 0.35 : -0.35), side = i % 2 ? 0.025 : -0.025; pos.push(side, Math.cos(a) * hr, Math.sin(a) * hr, 0, Math.cos(b) * 0.298, Math.sin(b) * 0.298); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.add(new THREE.LineSegments(sg, new THREE.LineBasicMaterial({ color: 0xb8bcc2 })));
    return g;
  }
  B.build = function (scene) {
    const mats = {
      paint: new THREE.MeshStandardMaterial({ color: 0xff5a1f, metalness: 0.55, roughness: 0.28 }),
      paint2: new THREE.MeshStandardMaterial({ color: 0x15171c, metalness: 0.5, roughness: 0.35 }),
      black: new THREE.MeshStandardMaterial({ color: 0x18191c, metalness: 0.4, roughness: 0.5 }),
      rubber: new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.92 }),
      rubberDark: new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 1 }),
      alu: new THREE.MeshStandardMaterial({ color: 0x9aa0a8, metalness: 0.85, roughness: 0.3 }),
      chrome: new THREE.MeshStandardMaterial({ color: 0xdfe3e8, metalness: 1, roughness: 0.12 }),
      gold: new THREE.MeshStandardMaterial({ color: 0xd4a017, metalness: 0.9, roughness: 0.25 }),
      battery: new THREE.MeshStandardMaterial({ color: 0x2b2e34, metalness: 0.3, roughness: 0.45 }),
      seat: new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.75 }),
      lightOn: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff4d0, emissiveIntensity: 2.5 }),
      redOn: new THREE.MeshStandardMaterial({ color: 0xff2020, emissive: 0xff0000, emissiveIntensity: 2 }),
      skin: new THREE.MeshStandardMaterial({ color: 0xe0ac8a, roughness: 0.7 }),
      jacket: new THREE.MeshStandardMaterial({ color: 0x2456a8, roughness: 0.7 }),
      pants: new THREE.MeshStandardMaterial({ color: 0x23262d, roughness: 0.8 }),
      glove: new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6 }),
      helmet: new THREE.MeshStandardMaterial({ color: 0xf2f2f2, metalness: 0.2, roughness: 0.3 }),
      shoe: new THREE.MeshStandardMaterial({ color: 0x303030, roughness: 0.6 })
    };
    const root = new THREE.Group(); root.rotation.order = 'YXZ';
    const P = { rearAxle: V3(0, 0.335, -0.56), bb: V3(0, 0.29, -0.02), seatTop: V3(0, 0.80, -0.19), headTop: V3(0, 0.93, 0.43), headBot: V3(0, 0.74, 0.485), frontAxle: V3(0, 0.335, 0.63) };
    // --- raam ---
    root.add(tube(P.bb, P.headBot, 0.034, mats.paint, 14));
    root.add(tube(P.seatTop, V3(0, 0.90, 0.42), 0.022, mats.paint, 12));
    root.add(tube(P.bb, P.seatTop, 0.02, mats.paint, 12));
    root.add(tube(P.headBot, P.headTop, 0.028, mats.paint2, 14));
    for (const sx of [0.06, -0.06]) { root.add(tube(V3(sx * 0.5, P.bb.y, P.bb.z), V3(sx, P.rearAxle.y, P.rearAxle.z), 0.013, mats.paint)); root.add(tube(V3(sx * 0.4, P.seatTop.y - 0.04, P.seatTop.z), V3(sx, P.rearAxle.y, P.rearAxle.z), 0.011, mats.paint)); }
    // aku alumisel torul
    { const d = new THREE.Vector3().subVectors(P.headBot, P.bb), len = d.length(); const bat = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.07, len * 0.72), mats.battery); bat.position.copy(P.bb).addScaledVector(d, 0.52); bat.position.y += 0.045; bat.quaternion.setFromUnitVectors(V3(0, 0, 1), d.clone().normalize()); bat.castShadow = true; root.add(bat);
      const led = new THREE.Mesh(new THREE.BoxGeometry(0.087, 0.012, 0.06), new THREE.MeshStandardMaterial({ color: 0x33ff66, emissive: 0x22ff55, emissiveIntensity: 1.5 })); led.position.copy(bat.position); led.position.y += 0.03; led.quaternion.copy(bat.quaternion); root.add(led); }
    // kesk-mootor
    { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.12, 20), mats.black); m.rotation.z = Math.PI / 2; m.position.copy(P.bb).add(V3(0, 0.02, 0.04)); root.add(m); }
    // sadul
    root.add(tube(P.seatTop, V3(0, 0.90, -0.23), 0.014, mats.black));
    { const s = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 10), mats.seat); s.scale.set(0.75, 0.32, 1.45); s.position.set(0, 0.92, -0.24); s.castShadow = true; root.add(s); }
    // pakiraam + tagatuli
    for (const sx of [0.075, -0.075]) { root.add(tube(V3(sx, 0.78, -0.27), V3(sx, 0.80, -0.72), 0.007, mats.black)); root.add(tube(V3(sx, 0.80, -0.70), V3(sx, P.rearAxle.y + 0.02, P.rearAxle.z), 0.007, mats.black)); }
    { const rl = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.035, 0.02), mats.redOn); rl.position.set(0, 0.79, -0.735); root.add(rl); }
    // tagumine porilaud
    { const f = new THREE.Mesh(new THREE.TorusGeometry(0.39, 0.028, 4, 30, Math.PI * 0.85), mats.black); f.rotation.y = Math.PI / 2; f.rotation.x = Math.PI * 0.08; f.position.copy(P.rearAxle); f.scale.set(1, 1, 1.6); root.add(f); }
    // tagaratas (rummumootoriga) + ketiratas
    const rear = wheel(mats, true); rear.position.copy(P.rearAxle); root.add(rear);
    const cog = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.03, 18), mats.chrome); cog.rotation.z = Math.PI / 2; cog.position.copy(P.rearAxle).add(V3(-0.07, 0, 0)); root.add(cog);
    // kett
    root.add(tube(V3(-0.07, P.bb.y + 0.09, P.bb.z), V3(-0.07, P.rearAxle.y + 0.045, P.rearAxle.z), 0.006, mats.gold, 4));
    root.add(tube(V3(-0.07, P.bb.y - 0.09, P.bb.z), V3(-0.07, P.rearAxle.y - 0.045, P.rearAxle.z), 0.006, mats.gold, 4));
    // vändad
    const crank = new THREE.Group(); crank.position.copy(P.bb); root.add(crank);
    { const ring = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.009, 6, 36), mats.chrome); ring.rotation.y = Math.PI / 2; ring.position.x = -0.07; crank.add(ring); }
    const pedals = [];
    for (const [sx, ph] of [[-0.1, 0], [0.1, Math.PI]]) {
      const arm = new THREE.Group(); arm.rotation.x = ph; crank.add(arm);
      const a = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.17, 0.03), mats.black); a.position.set(sx, -0.085, 0); arm.add(a);
      const pd = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.02, 0.07), mats.black); pd.position.set(sx * 1.6, -0.17, 0); arm.add(pd); pedals.push({ arm, sx, ph });
    }
    // --- esiosa (pöördub koos lenksuga) ---
    const steer = new THREE.Group(); steer.position.copy(P.headTop); root.add(steer);
    const axis = new THREE.Vector3().subVectors(P.headTop, P.headBot).normalize();
    const L = v => v.clone().sub(P.headTop); // kohalik steer-grupis
    // vedrukahvel
    steer.add(tube(L(V3(0, 0.98, 0.42)), L(P.headBot), 0.018, mats.black));
    { const crown = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.04, 0.06), mats.black); crown.position.copy(L(P.headBot)).add(V3(0, -0.02, 0)); steer.add(crown); }
    for (const sx of [0.055, -0.055]) {
      const top = L(P.headBot).add(V3(sx, -0.03, 0)), bot = L(P.frontAxle).add(V3(sx, 0, 0)), mid = top.clone().lerp(bot, 0.45);
      steer.add(tube(top, mid, 0.017, mats.chrome)); steer.add(tube(mid, bot, 0.022, mats.black));
    }
    const front = wheel(mats, false); front.position.copy(L(P.frontAxle)); steer.add(front);
    { const f = new THREE.Mesh(new THREE.TorusGeometry(0.39, 0.028, 4, 26, Math.PI * 0.6), mats.black); f.rotation.y = Math.PI / 2; f.rotation.x = Math.PI * 0.25; f.position.copy(L(P.frontAxle)); f.scale.set(1, 1, 1.6); steer.add(f); }
    // lenksupost ja lenks
    const stemEnd = L(V3(0, 0.99, 0.52)); steer.add(tube(L(V3(0, 0.97, 0.43)), stemEnd, 0.017, mats.black));
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.0155, 0.0155, 0.72, 14), mats.black); bar.rotation.z = Math.PI / 2; bar.position.copy(stemEnd); steer.add(bar);
    const grips = [];
    for (const sx of [0.31, -0.31]) { const g = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.13, 14), mats.rubber); g.rotation.z = Math.PI / 2; g.position.copy(stemEnd).add(V3(sx, 0, 0)); steer.add(g); grips.push(g); const end = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.021, 0.012, 14), mats.alu); end.rotation.z = Math.PI / 2; end.position.copy(stemEnd).add(V3(sx * 1.235, 0, 0)); steer.add(end); }
    // pidurihoovad (mõlemal pool) + hüdraulikapaagid
    const levers = {};
    for (const [sx, key] of [[-0.215, 'R'], [0.215, 'L']]) {
      const res = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.025, 0.03), mats.black); res.position.copy(stemEnd).add(V3(sx, 0.022, 0)); steer.add(res);
      const piv = new THREE.Group(); piv.position.copy(stemEnd).add(V3(sx, 0, 0.02)); steer.add(piv);
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.01, 0.016), mats.alu); blade.position.set(Math.sign(sx) * 0.06, -0.005, 0.03); piv.add(blade); levers[key] = piv;
    }
    // käiguvahetaja/gaasihoob vasakul
    const shifter = new THREE.Group(); shifter.position.copy(stemEnd).add(V3(0.19, -0.025, -0.01)); steer.add(shifter);
    { const pod = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 0.04), mats.black); shifter.add(pod); const thumb = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.012, 0.035), new THREE.MeshStandardMaterial({ color: 0x22cc55, metalness: 0.3, roughness: 0.4 })); thumb.position.set(-0.01, -0.012, -0.03); shifter.add(thumb); shifter.userData.thumb = thumb; }
    // ekraan
    const dc = document.createElement('canvas'); dc.width = 256; dc.height = 160; const dTex = new THREE.CanvasTexture(dc); dTex.encoding = THREE.sRGBEncoding;
    const disp = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.07, 0.014), [mats.black, mats.black, mats.black, mats.black, mats.black, new THREE.MeshBasicMaterial({ map: dTex, toneMapped: false })]);
    disp.position.copy(stemEnd).add(V3(0, 0.05, -0.03)); disp.rotation.x = 0.55; disp.rotation.y = Math.PI; steer.add(disp);
    // esituli + kell
    { const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.05, 14), mats.black); lamp.rotation.x = Math.PI / 2; lamp.position.copy(stemEnd).add(V3(0, -0.04, 0.03)); steer.add(lamp); const lens = new THREE.Mesh(new THREE.CircleGeometry(0.02, 14), mats.lightOn); lens.position.copy(lamp.position).add(V3(0, 0, 0.026)); steer.add(lens); }
    { const bell = new THREE.Mesh(new THREE.SphereGeometry(0.02, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mats.chrome); bell.position.copy(stemEnd).add(V3(0.12, 0.015, 0)); steer.add(bell); }
    // telgede kalle (rooli telg)
    steer.userData.axis = axis;

    // --- sõitja ---
    const rider = new THREE.Group(); root.add(rider);
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.42, 6, 12), mats.jacket); torso.castShadow = true; rider.add(torso);
    torso.position.set(0, 1.22, -0.08); torso.rotation.x = 0.55; torso.scale.set(1.15, 1, 0.8);
    const head = new THREE.Group(); head.position.set(0, 1.62, 0.1); rider.add(head);
    { const h = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12), mats.skin); head.add(h); const hel = new THREE.Mesh(new THREE.SphereGeometry(0.135, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), mats.helmet); hel.position.y = 0.02; hel.scale.set(1, 1, 1.25); head.add(hel); const vis = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.02, 0.06), mats.helmet); vis.position.set(0, 0.04, 0.15); head.add(vis); }
    const limbs = { uaL: limb(0.05, mats.jacket), uaR: limb(0.05, mats.jacket), faL: limb(0.042, mats.jacket), faR: limb(0.042, mats.jacket), thL: limb(0.075, mats.pants), thR: limb(0.075, mats.pants), shL: limb(0.055, mats.pants), shR: limb(0.055, mats.pants) };
    Object.values(limbs).forEach(m => rider.add(m));
    const hands = {}; for (const k of ['L', 'R']) { const h = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 8), mats.glove); h.scale.set(1, 0.8, 1.3); h.castShadow = true; rider.add(h); hands[k] = h; }
    const feet = {}; for (const k of ['L', 'R']) { const f = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.07, 0.24), mats.shoe); f.castShadow = true; rider.add(f); feet[k] = f; }
    const body = [torso, head, limbs.thL, limbs.thR, limbs.shL, limbs.shR, limbs.uaL, limbs.uaR, feet.L, feet.R];

    scene.add(root);
    Object.assign(B, { root, mats, P, steer, front, rear, crank, pedals, levers, shifter, dc, dTex, rider, limbs, hands, feet, body, grips, stemEnd, wheelRot: 0, crankRot: 0 });
    return root;
  };
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), tmpQ = new THREE.Quaternion();
  function ik(hip, foot, l1, l2, fwd) { // põlve asukoht
    const d = tmp.subVectors(foot, hip), L = Math.min(d.length(), l1 + l2 - 0.001); const a = (l1 * l1 - l2 * l2 + L * L) / (2 * L), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
    const dir = d.clone().normalize(); const perp = new THREE.Vector3(0, -dir.z, dir.y).multiplyScalar(fwd); return hip.clone().addScaledVector(dir, a).addScaledVector(perp, h);
  }
  B.update = function (dt, P, inp, firstPerson) {
    const v = P.v;
    // rattad
    B.wheelRot += v * dt / 0.37; B.front.rotation.x = B.wheelRot; B.rear.rotation.x = B.wheelRot;
    // vändad (pedaalid) – kadents sõltub kiirusest, kuni ~110 p/min
    const cad = Math.min(11.5, v * 0.55) * (inp.gas > 0.05 || v > 2 ? 1 : 0.2); B.crankRot += cad * dt; B.crank.rotation.x = B.crankRot;
    B.pedals.forEach(p => p.arm.children[1].rotation.x = -(B.crankRot + p.ph)); // pedaal püsib horisontaalne
    // rool
    const sa = -P.steer * 0.38 * (14 / (14 + v)); B.steer.quaternion.setFromAxisAngle(B.steer.userData.axis, sa);
    B.levers.R.rotation.y = -inp.brake * 0.35; B.levers.L.rotation.y = inp.brake * 0.35; B.shifter.userData.thumb.rotation.y = inp.gas * 0.6;
    // kalle
    B.root.rotation.z += ((P.steer * Math.min(1, v / 10) * 0.32) - B.root.rotation.z) * Math.min(1, dt * 5);
    // sõitja käed ja jalad
    const r = B.rider; B.steer.updateMatrix();
    for (const [k, sx] of [['L', 0.31], ['R', -0.31]]) {
      const grip = B.stemEnd.clone().add(new THREE.Vector3(sx, 0.01, -0.005)).applyQuaternion(B.steer.quaternion).add(B.steer.position);
      const shoulder = new THREE.Vector3(sx * 0.62, 1.42, 0.06);
      const elbow = shoulder.clone().lerp(grip, 0.5).add(new THREE.Vector3(sx * 0.12, -0.05, -0.06));
      B.hands[k].position.copy(grip); setLimb(B.limbs['ua' + k], shoulder, elbow); setLimb(B.limbs['fa' + k], elbow, grip);
    }
    for (const p of B.pedals) {
      const k = p.sx < 0 ? 'R' : 'L', ang = B.crankRot + p.ph;
      const foot = new THREE.Vector3(p.sx * 1.6, B.P.bb.y - Math.cos(ang) * 0.17, B.P.bb.z - Math.sin(ang) * 0.17);
      const hip = new THREE.Vector3(p.sx * 1.2, 0.98, -0.2); const knee = ik(hip, foot.clone().add(new THREE.Vector3(0, 0.05, 0)), 0.46, 0.46, -1);
      setLimb(B.limbs['th' + k], hip, knee); setLimb(B.limbs['sh' + k], knee, foot); B.feet[k].position.copy(foot).add(new THREE.Vector3(0, 0.02, 0.03));
    }
    for (const m of B.body) m.visible = !firstPerson;
    B.limbs.uaL.visible = B.limbs.uaR.visible = B.limbs.faL.visible = B.limbs.faR.visible = !firstPerson;
  };
  B.drawDisplay = function (kmh, bat, mode, assist) {
    const x = B.dc.getContext('2d'); const W = 256, H = 160;
    const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0b1018'); g.addColorStop(1, '#05070b'); x.fillStyle = g; x.fillRect(0, 0, W, H);
    x.fillStyle = '#6bf0ff'; x.font = 'bold 74px system-ui,monospace'; x.textAlign = 'center'; x.fillText(Math.round(kmh), W / 2, 96);
    x.font = 'bold 18px system-ui'; x.fillStyle = '#9ab'; x.fillText('km/h', W / 2, 120);
    x.fillStyle = '#333'; x.fillRect(16, 134, 160, 14); x.fillStyle = bat > 20 ? '#3f6' : '#f33'; x.fillRect(16, 134, 160 * bat / 100, 14);
    x.fillStyle = '#fff'; x.font = 'bold 14px system-ui'; x.textAlign = 'left'; x.fillText(Math.round(bat) + '%', 184, 146);
    x.fillStyle = '#ffd23f'; x.font = 'bold 16px system-ui'; x.fillText(mode, 12, 24); x.textAlign = 'right'; x.fillText(assist, W - 12, 24);
    B.dTex.needsUpdate = true;
  };
})(window.TB);
