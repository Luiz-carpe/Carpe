import { THREE, clamp, lerp, sstep, easeOut, easeIn, easeInOut, backOut, rnd, V, mat, box, sph, cyl, cone, cap, tor, at, grp, canvasTex, rr, heart, makePhone, makeHuman, talk, blink, look, stdLights, gradientBg, tree } from './lib.js';

const W = 720, H = 1280;
function newCam() { return new THREE.PerspectiveCamera(40, W / H, 0.1, 400); }
function setCam(c, p, l, fov = 40, shake = 0, t = 0) {
  c.position.set(p[0], p[1], p[2]);
  if (shake) { c.position.x += Math.sin(t * 53.1) * shake; c.position.y += Math.sin(t * 71.7) * shake; }
  c.fov = fov; c.updateProjectionMatrix(); c.lookAt(l[0], l[1], l[2]);
}
function wp(o, x = 0, y = 0, z = 0) { o.updateWorldMatrix(true, false); return o.localToWorld(new THREE.Vector3(x, y, z)); }
function onTarget(c, tg, off, fov = 36, shake = 0, t = 0, look = [0, 0, 0]) { setCam(c, [tg.x + off[0], tg.y + off[1], tg.z + off[2]], [tg.x + look[0], tg.y + look[1], tg.z + look[2]], fov, shake, t); }
function blendShot(c, k, A, B, t, shake = 0) {
  k = easeInOut(k);
  setCam(c, A.p.map((v, i) => lerp(v, B.p[i], k)), A.l.map((v, i) => lerp(v, B.l[i], k)), lerp(A.fov ?? 40, B.fov ?? 40, k), shake, t);
}
function stars(scene, n = 1200, R = 120, seed = 3, size = 0.5) {
  const r = rnd(seed), pos = [];
  for (let i = 0; i < n; i++) { const u = r() * 2 - 1, th = r() * Math.PI * 2, s = Math.sqrt(1 - u * u); pos.push(R * s * Math.cos(th), R * u, R * s * Math.sin(th)); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const p = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size, sizeAttenuation: true })); scene.add(p); return p;
}
function ground(scene, color, size = 200, y = 0) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat(color, { r: 0.95 })); m.rotation.x = -Math.PI / 2; m.position.y = y; m.receiveShadow = true; scene.add(m); return m;
}
// flame particle system (deterministic)
function flames(parent, n, colorA = 0xffd34d, colorB = 0xff4a1c) {
  const list = [];
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color(colorA).lerp(new THREE.Color(colorB), i / n), transparent: true, opacity: 0.9, toneMapped: false, fog: false }));
    parent.add(m); list.push(m);
  }
  return list;
}

// ======================= 1. SPACE =======================
export function sceneSpace() {
  const S = new THREE.Scene(); S.background = new THREE.Color(0x02030a);
  const cam = newCam();
  stars(S, 1600, 150, 5, 0.45);
  const L = stdLights(S, { sky: 0x8fa8ff, ground: 0x101020, hi: 0.55, sun: 0xfff4e6, si: 3.2, pos: [8, 6, 6], ss: 6 });
  const rim = new THREE.DirectionalLight(0x6fa8ff, 1.4); rim.position.set(-6, 3, -6); S.add(rim);
  // Earth
  const etex = canvasTex(1024, 512, (c, w, h) => {
    c.fillStyle = '#1f5fbf'; c.fillRect(0, 0, w, h); const r = rnd(11);
    c.fillStyle = '#3f9b4f'; for (let i = 0; i < 28; i++) { c.beginPath(); c.ellipse(r() * w, h * 0.2 + r() * h * 0.6, 30 + r() * 90, 20 + r() * 60, r() * 3, 0, 7); c.fill(); }
    c.fillStyle = '#c9a868'; for (let i = 0; i < 8; i++) { c.beginPath(); c.ellipse(r() * w, h * 0.35 + r() * h * 0.3, 20 + r() * 40, 12 + r() * 25, r() * 3, 0, 7); c.fill(); }
    c.fillStyle = 'rgba(255,255,255,0.85)'; for (let i = 0; i < 40; i++) { c.beginPath(); c.ellipse(r() * w, r() * h, 30 + r() * 70, 5 + r() * 10, r() * 0.4, 0, 7); c.fill(); }
    c.fillStyle = '#eef4ff'; c.fillRect(0, 0, w, 28); c.fillRect(0, h - 28, w, 28);
  });
  const earth = new THREE.Mesh(new THREE.SphereGeometry(26, 64, 40), new THREE.MeshStandardMaterial({ map: etex, roughness: 0.8 }));
  earth.position.set(-8, -22, -48); S.add(earth);
  const atm = new THREE.Mesh(new THREE.SphereGeometry(27.2, 64, 40), new THREE.MeshBasicMaterial({ color: 0x66aaff, transparent: true, opacity: 0.22, side: THREE.BackSide })); atm.position.copy(earth.position); S.add(atm);
  // Station
  const st = grp(S, 5.5, 3.2, -5);
  at(box(5, 0.35, 0.35, 0xb8bcc6, 0.05, { m: 0.4, r: 0.4 }), 0, 0, 0, st);
  at(cyl(0.9, 0.9, 2.4, 0xdfe2ea, { m: 0.3 }), -1.2, 0, 0, st).rotation.z = Math.PI / 2;
  const ptex = canvasTex(256, 128, (c, w, h) => { c.fillStyle = '#1d2f6b'; c.fillRect(0, 0, w, h); c.strokeStyle = '#7f9bd8'; c.lineWidth = 3; for (let x = 0; x <= w; x += 32) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); } for (let y = 0; y <= h; y += 32) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); } });
  for (const s of [-1, 1]) { const p = at(new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.04, 1.3), [mat(0x888888), mat(0x888888), new THREE.MeshStandardMaterial({ map: ptex, metalness: 0.5, roughness: 0.3 }), mat(0x333333), mat(0x888888), mat(0x888888)]), 1.6, 0, 1.0 * s, st); p.castShadow = true; }
  const alarm = at(sph(0.22, 0xff2020, { e: 0xff0000, ei: 2 }), -1.2, 1.0, 0.3, st);
  const alarmLight = new THREE.PointLight(0xff2a2a, 0, 14, 1.5); alarmLight.position.set(4.3, 4.3, -4.5); S.add(alarmLight);
  // Astronaut
  const A = makeHuman({ skin: 0xd9a27a, shirt: 0xf3f3f5, pants: 0xf3f3f5, shoe: 0x9aa0aa, glove: 0xb9bec8, hair: 0x2a1a10, beard: false });
  const ag = A.g; S.add(ag);
  at(box(0.7, 0.85, 0.35, 0xe8e8ee, 0.12), 0, 0.45, -0.38, A.torso);
  at(tor(0.45, 0.08, 0xc8ccd6), 0, 1.0, 0, A.torso).rotation.x = Math.PI / 2;
  const flag = canvasTex(64, 44, (c) => { c.fillStyle = '#1e9e4a'; c.fillRect(0, 0, 64, 44); c.fillStyle = '#ffd400'; c.beginPath(); c.moveTo(32, 4); c.lineTo(60, 22); c.lineTo(32, 40); c.lineTo(4, 22); c.fill(); c.fillStyle = '#1f3c99'; c.beginPath(); c.arc(32, 22, 10, 0, 7); c.fill(); });
  const fp = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.14), new THREE.MeshStandardMaterial({ map: flag })); fp.position.set(0.25, 0.62, 0.245); A.torso.add(fp);
  const glass = at(new THREE.Mesh(new THREE.SphereGeometry(0.72, 32, 24), new THREE.MeshStandardMaterial({ color: 0xbfe0ff, transparent: true, opacity: 0.16, roughness: 0.05, metalness: 0.2, depthWrite: false })), 0, 0.02, 0, A.head);
  // crack: thin bright segments on visor
  const crackM = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
  [[0.25, 0.35, 0.6, 0.0], [0.33, 0.22, 0.4, 1.2], [0.2, 0.18, 0.3, -0.9], [0.38, 0.42, 0.35, 0.5], [0.15, 0.45, 0.25, 2.2]].forEach(([x, y, len, rz]) => {
    const seg = new THREE.Mesh(new THREE.BoxGeometry(len * 0.6, 0.012, 0.012), crackM);
    const dir = V(x, y, 0.62).normalize().multiplyScalar(0.72); seg.position.copy(dir); seg.lookAt(dir.clone().multiplyScalar(2)); seg.rotateZ(rz); A.head.add(seg);
  });
  // phone & tether
  const phone = makePhone(1.0, 'call'); S.add(phone);
  const tmat = mat(0xe8e2cf);
  let tether = new THREE.Mesh(new THREE.BufferGeometry(), tmat); S.add(tether);

  return {
    S, cam, update(t, C) {
      const m = C.m, Ls = C.L;
      const pulse = 0.5 + 0.5 * Math.sin(t * 9);
      alarm.material.emissiveIntensity = 0.5 + pulse * 3; alarmLight.intensity = pulse * 18;
      earth.rotation.y = t * 0.02;
      // astronaut float
      ag.position.set(0, Math.sin(t * 0.8) * 0.08, 0);
      ag.rotation.set(Math.sin(t * 0.6) * 0.08, lerp(0.7, 0.05, sstep(Ls[1].s - 0.6, Ls[1].s + 0.2, t)) + Math.sin(t * 0.4) * 0.05, Math.sin(t * 0.5) * 0.12);
      A.legL.rotation.x = Math.sin(t * 0.9) * 0.2; A.legR.rotation.x = -Math.sin(t * 0.9) * 0.2;
      A.armL.rotation.set(Math.sin(t * 1.1) * 0.3 - 0.2, 0, -0.5);
      blink(A, t);
      const amp = C.amp('TIAGO'); talk(A, amp);
      const shiver = t > m.temp ? 1 : 0;
      A.head.position.x = shiver * Math.sin(t * 70) * 0.012; A.torso.rotation.z = shiver * Math.sin(t * 55) * 0.02;
      for (const b of A.brows) b.position.y = 0.27 + (t > m.temp ? 0.04 : 0);
      look(A, t < m.answer ? 0.4 : 0, t > m.temp ? 0.3 : 0);
      // phone
      const ans = m.answer;
      const reachK = sstep(ans - 0.45, ans + 0.05, t);
      A.armR.rotation.set(lerp(-0.2, -2.55, reachK), 0, lerp(0.5, -0.25, reachK));
      const handW = new THREE.Vector3(); ag.updateMatrixWorld(true); A.handR.getWorldPosition(handW);
      const freeP = V(0.55 + Math.sin(t * 0.7) * 0.06, 2.35 + Math.sin(t * 1.3) * 0.05, 1.0);
      const vib = t < ans ? Math.sin(t * 90) * 0.012 : 0;
      phone.position.lerpVectors(freeP, handW.add(V(0.08, 0.05, 0.05)), reachK); phone.position.x += vib;
      phone.rotation.set(lerp(-0.2, 0.0, reachK), lerp(-0.3, 0.6, reachK) + (1 - reachK) * Math.sin(t * 0.8) * 0.3, lerp(0.3, 0.1, reachK));
      phone.userData.set(t < ans ? 'call' : 'talk');
      // tether
      const back = new THREE.Vector3(); A.torso.localToWorld(back.set(0, 0.45, -0.55));
      const curve = new THREE.CatmullRomCurve3([V(3.6, 3.1, -4.7), V(2.4, 1.2 + Math.sin(t) * 0.3, -3.8), V(1.0, 0.6, -2.2), back]);
      tether.geometry.dispose(); tether.geometry = new THREE.TubeGeometry(curve, 30, 0.025, 6, false);
      // camera
      const sh0 = { p: [0.66, 2.45, 2.15], l: [0.55, 2.36, 1.0], fov: 38 };
      const sh1 = { p: [0.9, 1.9, 7.0], l: [0.3, 1.6, 0], fov: 40 };
      const sh2 = { p: [0.1, 1.95, 4.4], l: [0, 1.85, 0], fov: 38 };
      const sh3 = { p: [1.7, 2.1, 4.0], l: [0.25, 1.9, 0], fov: 38 };
      const sh4 = { p: [0.35, 2.0, 2.6], l: [0, 1.95, 0], fov: 38 };
      const sh5 = { p: [0.1, 1.98, 2.0], l: [0, 1.95, 0], fov: 36 };
      if (t < Ls[1].s) blendShot(cam, sstep(0.9, Ls[1].s - 0.1, t) , sh0, sh1, t);
      else if (t < ans) blendShot(cam, (t - Ls[1].s) / 4, sh2, { ...sh2, p: [0.1, 1.95, 3.8] }, t);
      else if (t < m.temp) blendShot(cam, (t - ans) / 3, sh3, { ...sh3, p: [1.4, 2.05, 3.5] }, t);
      else if (t < Ls[5].s) setCam(cam, sh4.p, sh4.l, sh4.fov, 0.01, t);
      else blendShot(cam, (t - Ls[5].s) / 0.25, sh4, sh5, t);
      return { scene: S, cam };
    }
  };
}

// ======================= 2. BOMB =======================
export function sceneBomb() {
  const S = new THREE.Scene(); S.background = new THREE.Color(0x0d0f14); S.fog = new THREE.Fog(0x0d0f14, 8, 22);
  const cam = newCam();
  const hemi = new THREE.HemisphereLight(0x8899bb, 0x221a14, 0.5); S.add(hemi);
  const spot = new THREE.SpotLight(0xffe2b0, 60, 20, 0.75, 0.5, 1.2); spot.position.set(0, 6.5, 2.5); spot.target.position.set(0, 0, 0.6); spot.castShadow = true; spot.shadow.mapSize.set(1024, 1024); S.add(spot, spot.target);
  const fill = new THREE.DirectionalLight(0x6a86c8, 0.6); fill.position.set(-5, 3, 6); S.add(fill);
  ground(S, 0x3b3e44);
  const wall = at(box(30, 10, 0.5, 0x2a2e36, 0.02), 0, 5, -5, S);
  for (let i = -3; i <= 3; i++) at(box(0.25, 10, 0.3, 0x353a44, 0.02), i * 3, 5, -4.7, S);
  const lamp = at(cone(0.6, 0.4, 0x3a3a3a, { ds: true }), 0, 6.6, 2.5, S); at(sph(0.15, 0xfff2c8, { e: 0xfff2c8, ei: 3 }), 0, 6.4, 2.5, S);
  [[-3.6, -2.5, 1.2], [-4.6, -1.8, 1.0], [-3.9, -2.2, 0.8, 1.15], [3.8, -2.4, 1.3], [4.9, -1.2, 1.0]].forEach(([x, z, s, y]) => { const b = at(box(s, s, s, 0x8a6a40, 0.04), x, (y ?? 0) + s / 2, z, S); b.rotation.y = x * 0.3; });
  [[3.2, 0.2], [3.9, 0.9]].forEach(([x, z]) => at(cyl(0.45, 0.45, 1.3, 0x7a2b22), x, 0.65, z, S));
  // bomb
  const B = grp(S, 0, 0, 1.1);
  at(box(1.3, 0.45, 0.8, 0x3b4a30, 0.06), 0, 0.225, 0, B);
  for (let i = 0; i < 5; i++) { const d = at(cyl(0.11, 0.11, 1.1, 0xc0392b, { r: 0.6 }), 0, 0.56, -0.28 + i * 0.14, B); d.rotation.z = Math.PI / 2; }
  for (const x of [-0.4, 0.4]) { const s = at(box(0.08, 0.28, 0.76, 0x2b2b2b, 0.02), x, 0.56, 0, B); }
  const tc = canvasTex(256, 96, () => { }); const tmesh = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.23), new THREE.MeshBasicMaterial({ map: tc, toneMapped: false }));
  const tbox = at(box(0.72, 0.32, 0.18, 0x15171a, 0.03), 0, 0.82, 0.25, B); tbox.rotation.x = -0.35; tmesh.position.set(0, 0, 0.092); tbox.add(tmesh);
  let lastVal = -1;
  function drawTimer(v, frozen, t) {
    const c = tc.userData.ctx; c.fillStyle = '#120404'; c.fillRect(0, 0, 256, 96);
    c.font = '700 76px DejaVu Sans Mono, monospace'; c.textAlign = 'center'; c.textBaseline = 'middle';
    const on = !frozen || true; c.fillStyle = frozen ? '#ff3b30' : '#ff2d2d'; c.shadowColor = '#ff0000'; c.shadowBlur = 16;
    c.fillText('00:0' + v, 128, 52); c.shadowBlur = 0; tc.needsUpdate = true;
  }
  const tubeM = (col) => new THREE.MeshStandardMaterial({ color: col, roughness: 0.45 });
  const red = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(-0.25, 0.8, 0.35), V(-0.45, 0.55, 0.6), V(-0.3, 0.3, 0.55), V(-0.5, 0.5, 0.2)]), 30, 0.03, 8), tubeM(0xe0302a)); B.add(red); red.castShadow = true;
  const blueA = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(0.25, 0.8, 0.35), V(0.42, 0.62, 0.6), V(0.38, 0.46, 0.62)]), 20, 0.03, 8), tubeM(0x2f6fe6)); B.add(blueA);
  const blueBg = grp(B, 0.38, 0.46, 0.62);
  const blueB = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(0, 0, 0), V(-0.02, -0.15, -0.02), V(0.1, -0.05, -0.4)]), 20, 0.03, 8), tubeM(0x2f6fe6)); blueBg.add(blueB);
  // agents
  const costa = makeHuman({ skin: 0xc68b62, shirt: 0x2b3040, pants: 0x23262e, vest: 0x15161a, belt: 0x0d0d0d, hair: 0x1a120c, shoe: 0x111111 });
  const rib = makeHuman({ skin: 0xe0b08a, shirt: 0x2b3040, pants: 0x23262e, vest: 0x15161a, belt: 0x0d0d0d, hair: 0x4a2e1a, beard: true, shoe: 0x111111 });
  costa.g.position.set(-0.95, -0.4, 0); rib.g.position.set(0.95, -0.4, 0); S.add(costa.g, rib.g);
  costa.g.rotation.y = 0.35; rib.g.rotation.y = -0.35;
  for (const c of [costa, rib]) { c.legL.rotation.x = -1.2; c.legR.rotation.x = -0.6; }
  const phone = makePhone(0.9, 'call'); rib.handL.add(phone); phone.position.set(0, -0.1, 0.08); phone.rotation.set(0, 0, 0);
  const cutters = grp(rib.handR, 0, -0.12, 0.05); at(box(0.05, 0.22, 0.05, 0xd03030, 0.02), -0.03, -0.1, 0, cutters); at(box(0.05, 0.22, 0.05, 0xd03030, 0.02), 0.03, -0.1, 0, cutters); at(box(0.03, 0.12, 0.03, 0xaaaaaa, 0.01, { m: 0.8 }), 0, 0.05, 0, cutters);
  return {
    S, cam, update(t, C) {
      const m = C.m, Ls = C.L; const cut = m.cut;
      const v = t < cut ? Math.max(1, Math.ceil(cut + 0.999 - t)) : 1;
      if (v !== lastVal) { drawTimer(v, t >= cut, t); lastVal = v; }
      tmesh.material.color.setScalar(t >= cut && t < cut + 0.6 ? (Math.sin(t * 30) > 0 ? 1 : 0.4) : 1);
      // costa
      const panic = t < m.answer ? 1 : 0;
      const handsHead = t < Ls[0].e ? 1 : 0;
      costa.armL.rotation.set(handsHead ? -2.7 + Math.sin(t * 9) * 0.1 : -0.4, 0, handsHead ? 0.5 : 0.2);
      costa.armR.rotation.set(handsHead ? -2.7 + Math.sin(t * 9 + 1) * 0.1 : (t > m.ring && t < m.answer + 0.4 ? -1.5 : -0.4), 0, handsHead ? -0.5 : -0.2);
      costa.head.rotation.y = panic * Math.sin(t * 7) * 0.25 + (t > m.ring && t < m.answer ? -0.6 : 0) + (t > Ls[3]?.s - 0.3 ? -0.45 : 0);
      costa.torso.rotation.z = t > Ls[3].s - 0.3 ? -0.25 : 0;
      talk(costa, C.amp('COSTA')); blink(costa, t);
      look(costa, t > m.ring ? 0.8 : 0, -0.2);
      for (const b of costa.brows) b.rotation.z = (b.position.x < 0 ? 1 : -1) * -0.35;
      // ribeiro
      blink(rib, t, 1.3); talk(rib, 0);
      const phoneUp = sstep(m.answer - 0.35, m.answer, t) * (1 - sstep(cut - 0.1, cut + 0.3, t) * 0);
      rib.armL.rotation.set(lerp(-0.3, -2.6, phoneUp), 0, lerp(0.1, -0.35, phoneUp));
      phone.visible = t > m.ring - 0.05; phone.userData.set(t < m.answer ? 'call' : 'talk');
      if (t < m.answer && t > m.ring) phone.position.x = Math.sin(t * 80) * 0.01;
      const cutK = sstep(cut - 0.5, cut - 0.1, t);
      rib.armR.rotation.set(lerp(-0.4, -1.25, cutK), lerp(0, 0.5, cutK), lerp(-0.1, 0.25, cutK));
      look(rib, t > cut - 0.5 && t < cut + 0.6 ? -0.4 : 0, t > cut - 0.5 && t < cut + 0.6 ? -0.8 : 0);
      blueBg.rotation.set(t > cut ? 0.5 : 0, 0, t > cut ? -0.4 : 0); blueBg.position.y = 0.46 - (t > cut ? 0.06 : 0);
      // camera
      const wide = { p: [0, 2.4, 6.8], l: [0, 1.3, 0.5], fov: 40 };
      const tim = { p: [0.15, 1.7, 3.5], l: [0, 0.8, 1.2], fov: 36 };
      const cst = { p: [-0.6, 1.85, 2.9], l: [-0.85, 1.75, 0], fov: 36 };
      const rbs = { p: [0.55, 1.85, 3.1], l: [0.85, 1.7, 0], fov: 36 };
      const two = { p: [0, 2.2, 5.4], l: [0, 1.3, 0.3], fov: 38 };
      if (t < Ls[0].s + 0.9) blendShot(cam, t / (Ls[0].s + 0.9), wide, { ...wide, p: [0, 1.9, 4.6] }, t, 0.01);
      else if (t < m.ring) blendShot(cam, (t - Ls[0].s - 0.9) / 2, tim, { ...tim, p: [0.1, 1.55, 3.0] }, t, 0.006);
      else if (t < m.answer) onTarget(cam, wp(costa.head), [0.9, 0.05, 3.7], 38, 0.015, t, [0, -0.25, 0]);
      else if (t < cut - 0.45) onTarget(cam, wp(rib.head), [-0.7 + (t - m.answer) * 0.05, 0.0, 4.0 - (t - m.answer) * 0.12], 38, 0, t, [0, -0.3, 0]);
      else if (t < Ls[3].s - 0.15) blendShot(cam, (t - cut) / 2, tim, { ...tim, p: [0.1, 1.5, 2.9] }, t);
      else blendShot(cam, (t - Ls[3].s) / 2, two, { ...two, p: [-0.2, 2.0, 4.4] }, t);
      return { scene: S, cam };
    }
  };
}

// ======================= alien builder =======================
function makeAlien(o = {}) {
  const g = new THREE.Group(); const r = { g };
  const skin = o.skin ?? 0x9fb0a8;
  const torso = grp(g, 0, 0.5, 0); r.torso = torso;
  if (o.dress) at(cone(0.55, 1.0, o.dress), 0, 0.3, 0, torso); else at(cap(0.32, 0.4, skin), 0, 0.4, 0, torso);
  for (const s of [-1, 1]) { const arm = grp(torso, 0.33 * s, 0.7, 0); at(cap(0.07, 0.42, skin), 0, -0.26, 0, arm); const hnd = at(sph(0.09, skin), 0, -0.52, 0, arm); r[s < 0 ? 'armL' : 'armR'] = arm; r[s < 0 ? 'handL' : 'handR'] = hnd; }
  for (const s of [-1, 1]) at(cap(0.09, 0.35, skin), 0.15 * s, 0.05, 0, g);
  const head = grp(torso, 0, 1.35, 0); r.head = head;
  at(sph(0.62, skin), 0, 0, 0, head).scale.set(1, 1.12, 0.95);
  r.eyes = [];
  for (const s of [-1, 1]) {
    const e = at(sph(0.22, 0x050505, { r: 0.08, m: 0.2 }), 0.25 * s, 0.02, 0.45, head); e.scale.set(0.85, 1.25, 0.6); e.rotation.z = 0.45 * s;
    const gl = at(sph(0.05, 0xffffff, { e: 0xffffff, ei: 1 }), 0.22 * s, 0.12, 0.6, head); r.eyes.push(gl);
  }
  r.mouth = at(sph(0.06, 0x3a2a35), 0, -0.36, 0.52, head); r.mouth.scale.set(1.5, 0.3, 0.5);
  for (const s of [-1, 1]) { const a = at(cyl(0.02, 0.02, 0.5, skin), 0.22 * s, 0.75, -0.05, head); a.rotation.z = -0.35 * s; at(sph(0.07, o.antBall ?? 0x7cffb0, { e: o.antBall ?? 0x3cff90, ei: 0.8 }), 0.31 * s, 0.98, -0.05, head); }
  if (o.curlers) { const cols = [0xff7eb6, 0x7ec8ff, 0xffe17e, 0xff7eb6, 0x7ec8ff]; cols.forEach((c, i) => { const cu = at(cyl(0.09, 0.09, 0.24, c), -0.36 + i * 0.18, 0.62 - Math.abs(i - 2) * 0.08, -0.1, head); cu.rotation.z = Math.PI / 2; }); }
  return r;
}

// ======================= 3. UFO =======================
export function sceneUfo() {
  // exterior
  const S = new THREE.Scene(); S.background = gradientBg('#070b24', '#2a1d4f', '#141a44'); S.fog = new THREE.Fog(0x161a3d, 18, 60);
  const cam = newCam();
  stars(S, 700, 90, 8, 0.35);
  S.add(new THREE.HemisphereLight(0x6f7fd6, 0x1a1a10, 0.9)); const ufill = new THREE.DirectionalLight(0x9fb4ff, 1.3); ufill.position.set(2, 3, 10); S.add(ufill);
  const moonL = new THREE.DirectionalLight(0xbcd0ff, 1.2); moonL.position.set(-8, 10, 4); moonL.castShadow = true; moonL.shadow.mapSize.set(1024, 1024); Object.assign(moonL.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10 }); S.add(moonL);
  at(sph(2.2, 0xfff6d8, { e: 0xfff6d8, ei: 1.2 }), -14, 22, -50, S);
  ground(S, 0x2e3a22);
  const R = rnd(4); const stalkG = new THREE.ConeGeometry(0.12, 1.9, 5); stalkG.translate(0, 0.95, 0);
  const corn = new THREE.InstancedMesh(stalkG, mat(0x7c9a3a, { flat: true }), 900); let ci = 0; const M4 = new THREE.Matrix4();
  for (let x = -16; x <= 16; x += 0.7) for (let z = -22; z <= 1.2; z += 0.9) { if (Math.hypot(x, z) < 3.2 || ci >= 900) continue; M4.compose(V(x + R() * 0.3, 0, z + R() * 0.3), new THREE.Quaternion().setFromEuler(new THREE.Euler(R() * 0.2 - 0.1, R() * 6, R() * 0.2 - 0.1)), V(1, 0.8 + R() * 0.5, 1)); corn.setMatrixAt(ci++, M4); }
  corn.count = ci; corn.castShadow = true; corn.receiveShadow = true; S.add(corn);
  const barn = grp(S, 9, 0, -16); at(box(4, 3, 3, 0x8a2a22, 0.05), 0, 1.5, 0, barn); const roof = at(cone(3.0, 1.6, 0x4a1a16, {}, 4), 0, 3.8, 0, barn); roof.rotation.y = Math.PI / 4;
  const hay = grp(S, 0, 0, 0.2); const haym = at(sph(1.1, 0xd9b84a, { flat: true }, 12, 8), 0, 0.55, 0, hay); haym.scale.set(1.3, 0.6, 1.1);
  // saucer
  const U = grp(S, 0, 7.6, 0);
  at(sph(2.4, 0xaab3c2, { m: 0.7, r: 0.3 }, 40, 16), 0, 0, 0, U).scale.set(1, 0.24, 1);
  at(sph(1.0, 0x8ff7ff, { op: 0.55, r: 0.05, e: 0x2aa6c0, ei: 0.5 }), 0, 0.45, 0, U).scale.set(1, 0.7, 1);
  const ulights = []; for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; ulights.push(at(sph(0.12, 0xffffff, { e: 0xffee66, ei: 2 }), Math.cos(a) * 2.1, -0.08, Math.sin(a) * 2.1, U)); }
  const beamGeo = new THREE.CylinderGeometry(0.7, 2.0, 7.4, 32, 1, true); beamGeo.translate(0, -3.7, 0);
  const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: 0x9ff6ff, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); U.add(beam);
  const beamL = new THREE.SpotLight(0x9ff6ff, 120, 14, 0.35, 0.6, 1); beamL.position.set(0, 7.3, 0); beamL.target.position.set(0, 0, 0); S.add(beamL, beamL.target);
  // Lucas
  const lucas = makeHuman({ skin: 0xd8a07a, shirt: 0xb7c7a8, pants: 0xe08a3c, flip: true, hair: 0x2a1a10 }); S.add(lucas.g);
  const lphone = makePhone(0.9, 'talk'); lucas.handR.add(lphone); lphone.position.set(0.05, -0.08, 0.08); lphone.rotation.y = -0.6;
  // cockpit
  const S2 = new THREE.Scene(); S2.background = new THREE.Color(0x1a1030);
  const cam2 = newCam();
  S2.add(new THREE.HemisphereLight(0xc7a8ff, 0x2a1a40, 1.0));
  const kl = new THREE.PointLight(0x7cffe0, 18, 10); kl.position.set(0, 2, 2); S2.add(kl);
  const dl = new THREE.DirectionalLight(0xffffff, 1.2); dl.position.set(2, 5, 5); dl.castShadow = true; S2.add(dl);
  const room = at(new THREE.Mesh(new THREE.SphereGeometry(7, 32, 20), mat(0x4a3570, { ds: true })), 0, 1, -1, S2); room.material.side = THREE.BackSide;
  for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; const rib = at(box(0.2, 6, 0.2, 0x6a52a0, 0.05), Math.cos(a) * 6.5, 1.5, -1 + Math.sin(a) * 6.5, S2); }
  const win = at(new THREE.Mesh(new THREE.CircleGeometry(1.6, 32), new THREE.MeshBasicMaterial({ color: 0x0a0f30 })), 0, 2.6, -5.5, S2);
  const glorp = makeAlien(); S2.add(glorp.g); glorp.g.position.set(0, 0, 0);
  const seat = at(box(1.2, 1.4, 0.3, 0x2a2440, 0.1), 0, 1.0, -0.55, S2);
  const console_ = grp(S2, 0, 0, 1.05); at(box(2.6, 0.9, 0.7, 0x5a5f78, 0.12, { m: 0.4 }), 0, 0.45, 0, console_); const panel = at(box(2.6, 0.08, 0.9, 0x2b2f44, 0.03), 0, 0.95, -0.05, console_); panel.rotation.x = 0.4;
  const btns = []; const bc = [0xff4d6d, 0x4dffb8, 0xffd84d, 0x4db8ff, 0xff4dff, 0x4dffb8];
  bc.forEach((c, i) => btns.push(at(cyl(0.08, 0.08, 0.06, c, { e: c, ei: 1 }), -0.9 + i * 0.36, 1.03, -0.05, console_)));
  const big = at(cyl(0.14, 0.14, 0.08, 0xff2222, { e: 0xff0000, ei: 1.2 }), 0.75, 1.06, 0.15, console_);
  const gphone = makePhone(0.75, 'call'); glorp.handL.add(gphone); gphone.position.set(0, -0.08, 0.08);
  // kitchen
  const S3 = new THREE.Scene(); S3.background = new THREE.Color(0xf6e7cc);
  const cam3 = newCam();
  stdLights(S3, { sky: 0xfff3dd, ground: 0x9a7a5a, hi: 1.2, sun: 0xffe7c0, si: 2.4, pos: [-4, 7, 6], ss: 5 });
  ground(S3, 0xc9b28c, 40);
  const ftex = canvasTex(256, 256, (c) => { for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { c.fillStyle = (x + y) % 2 ? '#e9e2d3' : '#c47a5a'; c.fillRect(x * 32, y * 32, 32, 32); } });
  ftex.wrapS = ftex.wrapT = THREE.RepeatWrapping; ftex.repeat.set(4, 4);
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.MeshStandardMaterial({ map: ftex, roughness: 0.8 })); fl.rotation.x = -Math.PI / 2; fl.position.y = 0.01; fl.receiveShadow = true; S3.add(fl);
  at(box(12, 6, 0.3, 0xf3dfb8, 0.02), 0, 3, -3, S3); at(box(12, 1.2, 0.32, 0x7fb3a8, 0.02), 0, 0.6, -2.98, S3);
  const kwin = at(box(2.0, 1.4, 0.1, 0x9fd8ff, 0.04, { e: 0x9fd8ff, ei: 0.4 }), 1.5, 3.0, -2.84, S3); at(box(2.2, 0.12, 0.2, 0xffffff, 0.03), 1.5, 2.25, -2.78, S3);
  at(box(1.8, 1.0, 0.7, 0x6f8f5a, 0.06), -2.8, 0.5, -2.5, S3); at(box(1.9, 0.08, 0.8, 0xece6da, 0.03), -2.8, 1.04, -2.5, S3);
  const tbl = grp(S3, 0, 0, 0); at(cyl(1.0, 1.0, 0.1, 0x9a6a3c), 0, 1.0, 0, tbl); at(cyl(0.1, 0.18, 1.0, 0x7a5030), 0, 0.5, 0, tbl);
  at(cyl(0.12, 0.1, 0.18, 0xffffff), -0.35, 1.14, 0.3, tbl); at(cyl(0.12, 0.1, 0.18, 0xffffff), 0.35, 1.14, -0.3, tbl);
  at(cyl(0.38, 0.32, 0.04, 0xffffff), 0, 1.07, 0.05, tbl); const pr = rnd(9); for (let i = 0; i < 7; i++) at(sph(0.09, 0xf0c060, { r: 0.8 }), Math.cos(i) * 0.2 * pr(), 1.15, 0.05 + Math.sin(i) * 0.2 * pr(), tbl);
  const mom = makeHuman({ skin: 0xd9a07c, shirt: 0xd9534f, pants: 0x5a3d6e, hair: 0x3a2214, hairStyle: 'bun', dress: 0xd9534f }); S3.add(mom.g); mom.g.position.set(0, -0.35, 1.25); mom.g.rotation.y = Math.PI;
  const glorpa = makeAlien({ dress: 0xf28bb8, curlers: true, antBall: 0xff9ad0 }); S3.add(glorpa.g); glorpa.g.position.set(0, 0.25, -1.1);
  for (const c of [mom, glorpa]) {}
  return {
    S, cam, update(t, C) {
      const m = C.m, Ls = C.L;
      if (t < m.cockpit || (t >= m.drop && t < m.kitchen)) {
        // exterior
        const dropT = t - m.drop; const dropped = t >= m.drop;
        U.position.set(0, 7.6 + Math.sin(t * 2) * 0.12, 0); U.rotation.y = t * 1.5;
        const away = sstep(0.45, 1.1, dropT);
        if (dropped) { U.position.add(V(18 * easeIn(away), 14 * easeIn(away), -30 * easeIn(away))); }
        ulights.forEach((l, i) => l.material.emissiveIntensity = (Math.sin(t * 10 + i) > 0 ? 3 : 0.4));
        const beamOn = !dropped || dropT < 0.08 ? 1 : 0; beam.visible = !!beamOn; beamL.intensity = beamOn * 120;
        beam.material.opacity = 0.18 + Math.sin(t * 20) * 0.04;
        let ly = 2.4 + t * 0.35 + Math.sin(t * 3) * 0.1;
        if (dropped) { const ft = clamp(dropT / 0.45); ly = lerp(2.4 + m.drop * 0.35, 1.05, ft * ft); }
        lucas.g.position.set(0, ly, 0.2);
        const fl = dropped ? 0 : 1;
        lucas.g.rotation.set(fl * Math.sin(t * 2) * 0.15, fl * (Math.sin(t * 0.9) * 0.4), fl * Math.sin(t * 2.5) * 0.2);
        lucas.legL.rotation.x = fl * Math.sin(t * 9) * 0.8 + (dropped ? -1.5 : 0); lucas.legR.rotation.x = -fl * Math.sin(t * 9) * 0.8 + (dropped ? -1.5 : 0);
        lucas.armL.rotation.set(fl * Math.sin(t * 11) * 1.2 - (dropped ? 0.3 : 1.4), 0, dropped ? 0.8 : -0.6);
        lucas.armR.rotation.set(-2.6, 0, -0.35);
        if (dropped) { lucas.g.position.z = 0.4; haym.scale.y = 0.6 - 0.12 * Math.exp(-Math.max(0, dropT - 0.45) * 6) * (dropT > 0.45 ? 1 : 0); }
        talk(lucas, C.amp('LUCAS')); blink(lucas, t);
        look(lucas, dropped ? Math.sin(t * 6) * 0.6 : 0, dropped ? 0 : 0.4);
        for (const b of lucas.brows) b.position.y = 0.27 + (dropped ? 0 : 0.05);
        // camera
        if (!dropped) {
          const wide = { p: [0, 1.4, 9.5], l: [0, 4.6, 0], fov: 42 };
          const hw = wp(lucas.head);
          if (t < Ls[0].s) blendShot(cam, t / Ls[0].s, wide, { ...wide, p: [0, 1.2, 8.5] }, t);
          else if (t < Ls[1].s) onTarget(cam, hw, [0.4, -0.5, 3.6], 36, 0.01, t, [0, -0.3, 0]);
          else if (t < Ls[2].s) setCam(cam, [0.4, 1.0, 8.0], [0, 4.6, 0], 42, 0, t);
          else onTarget(cam, hw, [-0.5, -0.6, 3.3], 36, 0.015, t, [0, -0.3, 0]);
        } else {
          const p0 = { p: [0, 1.6, 8.5], l: [0, 3.5, 0], fov: 42 };
          const p1 = { p: [0.5, 2.6, 6.2], l: [0, 2.0, 0.4], fov: 38 };
          blendShot(cam, (dropT - 0.9) / 1.0, p0, p1, t);
        }
        return { scene: S, cam };
      }
      if (t < m.drop) {
        const lt = t - m.cockpit;
        const ansK = sstep(0.3, 0.55, lt);
        glorp.armL.rotation.set(lerp(-0.6, -2.5, ansK), 0, lerp(0.1, -0.3, ansK));
        gphone.userData.set(lt < 0.55 ? 'call' : 'talk');
        if (lt < 0.55) gphone.position.x = Math.sin(lt * 90) * 0.012;
        const roll = sstep(0.0, 0.35, lt) * (1 - sstep(0.7, 0.9, lt));
        glorp.eyes.forEach((e, i) => { e.position.y = 0.12 + roll * 0.15; e.position.x = (i ? 1 : -1) * (0.22 - roll * 0.05); });
        glorp.head.rotation.x = -roll * 0.25; glorp.head.rotation.z = Math.sin(lt * 2) * 0.05;
        const a = C.amp('GLORP'); glorp.mouth.scale.y = 0.3 + a * 1.4;
        const press = sstep(Ls[4].e - 0.35, Ls[4].e - 0.1, t);
        glorp.armR.rotation.set(lerp(-0.4, -1.1, press), 0, lerp(-0.1, 0.35, press));
        big.material.emissiveIntensity = press > 0.9 ? 4 : 1.2;
        btns.forEach((b, i) => b.material.emissiveIntensity = Math.sin(t * 6 + i * 2) > 0 ? 2 : 0.5);
        blendShot(cam2, lt / 2, { p: [0.0, 2.0, 4.6], l: [0, 1.75, 0], fov: 38 }, { p: [0.0, 1.95, 3.7], l: [0, 1.8, 0], fov: 36 }, t);
        return { scene: S2, cam: cam2 };
      }
      // kitchen
      const lt = t - m.kitchen;
      glorpa.armR.rotation.set(-2.5, 0, -0.5 + Math.sin(lt * 10) * 0.35);
      glorpa.armL.rotation.set(-1.2, 0, 0.3);
      glorpa.head.rotation.z = Math.sin(lt * 4) * 0.06; glorpa.mouth.scale.set(2.2, 0.6, 0.5);
      mom.armR.rotation.set(-1.3, 0, 0.2); mom.head.rotation.x = Math.sin(lt * 3) * 0.04;
      blendShot(cam3, lt / 1.5, { p: [2.9, 2.7, 4.6], l: [-0.2, 1.8, -0.9], fov: 40 }, { p: [2.6, 2.6, 4.0], l: [-0.2, 1.9, -1.0], fov: 38 }, t);
      return { scene: S3, cam: cam3 };
    }
  };
}

// ======================= 4. DRAGON =======================
function makeDragon() {
  const g = new THREE.Group(); const r = { g };
  const red = 0xc0392b, belly = 0xf3c26b, horn = 0xf4ead2;
  const body = at(sph(1.1, red), 0, 1.5, 0, g); body.scale.set(1.0, 1.05, 1.35);
  at(sph(0.85, belly), 0, 1.4, 0.55, g).scale.set(0.9, 1.0, 0.6);
  for (const [x, z] of [[-0.6, 0.6], [0.6, 0.6], [-0.6, -0.7], [0.6, -0.7]]) { at(cyl(0.28, 0.32, 0.8, red), x, 0.4, z, g); at(box(0.45, 0.15, 0.55, 0x8e2a1f, 0.06), x, 0.06, z + 0.1, g); }
  let tx = 0, ty = 1.2, tz = -1.3; for (let i = 0; i < 8; i++) { at(sph(0.38 - i * 0.04, red), tx, ty, tz, g); tz -= 0.38; ty -= 0.08; tx += Math.sin(i) * 0.05; }
  at(cone(0.22, 0.5, 0x8e2a1f), tx, ty, tz - 0.2, g).rotation.x = -Math.PI / 2;
  // wings
  const wshape = new THREE.Shape(); wshape.moveTo(0, 0); wshape.lineTo(2.6, 1.6); wshape.lineTo(2.2, 0.2); wshape.lineTo(1.6, 0.6); wshape.lineTo(1.2, -0.2); wshape.lineTo(0.6, 0.2); wshape.lineTo(0, -0.4);
  const wgeo = new THREE.ExtrudeGeometry(wshape, { depth: 0.05, bevelEnabled: false });
  r.wings = [];
  for (const s of [-1, 1]) { const wg = grp(g, 0.6 * s, 2.3, -0.2); const w = new THREE.Mesh(wgeo, mat(0x8e2a1f, { ds: true })); w.castShadow = true; w.rotation.y = s < 0 ? Math.PI : 0; w.rotation.x = -Math.PI / 2 + 0.3; wg.add(w); r.wings.push(wg); }
  // neck & head
  const neck = grp(g, 0, 2.2, 0.8); r.neck = neck;
  for (let i = 0; i < 4; i++) at(sph(0.42 - i * 0.03, red), 0, i * 0.32, i * 0.12, neck);
  const head = grp(neck, 0, 1.35, 0.45); r.head = head;
  at(sph(0.62, red), 0, 0, 0, head).scale.set(1, 0.9, 1);
  at(box(0.7, 0.36, 0.75, red, 0.16), 0, -0.05, 0.6, head);
  const jaw = grp(head, 0, -0.18, 0.2); r.jaw = jaw; at(box(0.62, 0.16, 0.7, belly, 0.07), 0, -0.06, 0.35, jaw);
  for (const s of [-1, 1]) { at(sph(0.05, 0x3a0d08), 0.17 * s, 0.1, 0.98, head); const h1 = at(cone(0.1, 0.55, horn), 0.3 * s, 0.55, -0.2, head); h1.rotation.x = -0.6; h1.rotation.z = -0.3 * s; }
  r.eyes = []; r.pupils = [];
  for (const s of [-1, 1]) { const e = at(sph(0.17, 0xffffff), 0.33 * s, 0.22, 0.38, head); e.scale.set(0.8, 1, 0.6); const p = at(sph(0.09, 0x1a1414), 0.36 * s, 0.22, 0.47, head); r.eyes.push(e); r.pupils.push(p); const lid = at(box(0.3, 0.06, 0.12, 0x8e2a1f, 0.03), 0.33 * s, 0.38, 0.4, head); lid.rotation.z = 0.25 * s; (r.lids ||= []).push(lid); }
  r.nostrils = [V(-0.14, 0.08, 1.0), V(0.14, 0.08, 1.0)];
  // arm holding phone
  const arm = grp(g, 0.75, 1.8, 0.85); r.arm = arm; at(cap(0.15, 0.5, red), 0, -0.3, 0, arm); const claw = at(sph(0.17, red), 0, -0.6, 0, arm); r.claw = claw;
  const arm2 = grp(g, -0.75, 1.8, 0.85); at(cap(0.15, 0.5, red), 0, -0.3, 0, arm2); at(sph(0.17, red), 0, -0.6, 0, arm2); arm2.rotation.x = -0.4;
  return r;
}
export function sceneDragon() {
  const S = new THREE.Scene(); S.background = gradientBg('#1b0b1e', '#d4582a', '#6a1f2a'); S.fog = new THREE.Fog(0x5a2030, 16, 45);
  const cam = newCam();
  stdLights(S, { sky: 0xffb08a, ground: 0x2a1a20, hi: 0.8, sun: 0xffc08a, si: 1.8, pos: [5, 9, 7], ss: 9 });
  const glow = new THREE.PointLight(0xff7a2a, 40, 18); glow.position.set(0, 3, 2); S.add(glow);
  ground(S, 0x3d4a2a);
  const castle = grp(S, 0, 0, -7);
  at(box(12, 4.5, 1.5, 0x8b8f99, 0.05), 0, 2.25, 0, castle);
  for (let i = -5; i <= 5; i++) at(box(0.6, 0.6, 1.5, 0x8b8f99, 0.04), i * 1.1, 4.8, 0, castle);
  for (const x of [-6.5, 6.5, -2.5]) { at(cyl(1.4, 1.5, 7, 0x969aa4), x, 3.5, 0.3, castle); at(cone(1.7, 2.4, 0x7a2430), x, 8.2, 0.3, castle); at(box(0.4, 0.7, 0.1, 0x1a1418, 0.05), x, 5, 1.75, castle); }
  at(box(2.2, 3, 0.2, 0x2a1d16, 0.1), 2, 1.5, 0.8, castle);
  const castleFires = []; [[-6.5, 7.2], [-2.5, 7.4], [3.5, 4.8], [6.5, 6.8], [-4.4, 4.8]].forEach(([x, y]) => { const f = grp(castle, x, y, 1.6); castleFires.push({ g: f, parts: flames(f, 10) }); });
  const D = makeDragon(); S.add(D.g); D.g.position.set(-2.4, 0, 0); D.g.rotation.y = 1.0;
  const dphone = makePhone(0.9, 'call'); D.claw.add(dphone); dphone.position.set(0, -0.1, 0.15);
  const K = makeHuman({ skin: 0xe2b08c, shirt: 0xa7adb8, pants: 0x8a909c, shoe: 0x5b606a, glove: 0x8a909c, sleeve: 0xa7adb8, hair: 0x7a5a30, helmet: 0xb8bec8 });
  S.add(K.g); K.g.position.set(2.5, 0, 0.3); K.g.rotation.y = -1.0;
  const shield = grp(K.armL, 0.0, -0.45, 0.3); at(box(0.95, 1.15, 0.12, 0x2d4fa0, 0.1, { m: 0.2 }), 0, 0, 0, shield); at(box(0.12, 0.9, 0.14, 0xf2c94c, 0.03), 0, 0, 0.02, shield); at(box(0.7, 0.12, 0.14, 0xf2c94c, 0.03), 0, 0.15, 0.02, shield);
  const sword = grp(K.handR, 0, -0.05, 0.05); at(box(0.07, 1.2, 0.03, 0xdfe6ee, 0.01, { m: 0.8, r: 0.2 }), 0, 0.62, 0, sword); at(box(0.3, 0.06, 0.06, 0x8a6a30, 0.02), 0, 0.03, 0, sword);
  const fireG = grp(S); const fire = flames(fireG, 40);
  const smokeG = grp(S); const smoke = []; for (let i = 0; i < 12; i++) { const s = sph(0.2, 0xb8b8b8, { op: 0.7, dw: false }, 10, 8); s.castShadow = false; smokeG.add(s); smoke.push(s); }
  return {
    S, cam, update(t, C) {
      const m = C.m, Ls = C.L;
      castleFires.forEach((cf, k) => cf.parts.forEach((p, i) => { const ph = (t * 1.4 + i / cf.parts.length + k * 0.3) % 1; p.position.set(Math.sin(i * 7 + k) * 0.35 * (1 - ph), ph * 1.6, Math.cos(i * 3) * 0.2); p.scale.setScalar(0.35 * (1 - ph) + 0.05); p.material.opacity = 0.9 * (1 - ph); }));
      glow.intensity = 35 + Math.sin(t * 17) * 8;
      const breathing = t < m.ring + 0.15;
      D.wings.forEach((w, i) => w.rotation.z = (i ? -1 : 1) * (0.2 + Math.sin(t * (breathing ? 4 : 1.5)) * 0.25));
      const shrink = t > Ls[1].s ? sstep(Ls[1].s, Ls[1].s + 0.5, t) : 0;
      D.neck.rotation.x = breathing ? 0.25 : lerp(0.0, 0.35, shrink);
      D.head.rotation.set(breathing ? 0.2 : 0.05 + shrink * 0.2, 0, 0);
      const amp = C.amp('IGNACIO');
      D.jaw.rotation.x = breathing ? 0.55 + Math.sin(t * 20) * 0.05 : amp * 0.4;
      const ansK = sstep(m.ring + 0.1, m.ring + 0.5, t);
      D.arm.rotation.set(lerp(-0.4, -2.4, ansK), lerp(0, -0.4, ansK), lerp(0, 0.3, ansK));
      dphone.visible = t > m.ring; dphone.userData.set(t < Ls[0].s ? 'call' : 'talk');
      const sad = t > Ls[0].s;
      D.lids.forEach(l => l.position.y = sad ? 0.3 : 0.38);
      const away = t > Ls[3].s ? 1 : 0;
      D.pupils.forEach((p, i) => { p.position.y = sad ? 0.16 : 0.22; p.position.x = (i ? 1 : -1) * 0.36 + (away ? 0.06 : 0); });
      D.head.rotation.y = away ? -0.5 : 0;
      // fire stream from mouth to knight
      const mouthW = new THREE.Vector3(); D.g.updateMatrixWorld(true); D.head.localToWorld(mouthW.set(0, -0.1, 1.1));
      const tgt = V(2.1, 1.6, 0.6);
      fire.forEach((p, i) => {
        const ph = (t * 2.2 + i / fire.length) % 1; p.visible = breathing;
        p.position.lerpVectors(mouthW, tgt, ph); p.position.y += Math.sin(i * 13 + t * 9) * 0.25 * ph; p.position.z += Math.cos(i * 7 + t * 11) * 0.25 * ph;
        p.scale.setScalar(0.12 + ph * 0.45); p.material.opacity = 0.95 * (1 - ph * 0.6); p.rotation.set(t * 3 + i, i, t);
      });
      // smoke after swallow
      const sw = t - m.swallow;
      smoke.forEach((s, i) => { const ph = sw - (i % 6) * 0.12; s.visible = sw > 0 && ph > 0 && ph < 1.6; const n = D.nostrils[i % 2].clone(); D.head.localToWorld(n); s.position.copy(n).add(V(0.2 * ph, ph * 0.9, 0.2 * ph)); s.scale.setScalar(0.4 + ph * 1.4); s.material.opacity = 0.65 * (1 - ph / 1.6); });
      if (sw > 0 && sw < 0.3) D.head.scale.set(1 + Math.sin(sw / 0.3 * Math.PI) * 0.15, 1, 1); else D.head.scale.set(1, 1, 1);
      // knight
      const lower = sstep(Ls[2].s - 0.4, Ls[2].s, t);
      K.legL.rotation.x = lerp(-0.6, 0, lower); K.legR.rotation.x = lerp(0.4, 0, lower); K.g.position.y = lerp(-0.3, 0, lower);
      K.armL.rotation.set(lerp(-1.3, -0.3, lower), lerp(0.4, 0, lower), lerp(0.4, 0.1, lower));
      K.armR.rotation.set(lerp(-1.0, -0.2, lower), 0, lerp(0, -0.1, lower));
      K.head.rotation.x = lerp(0.3, 0, lower);
      talk(K, C.amp('CAVALEIRO')); blink(K, t); look(K, 0, lower > 0.5 ? 0 : 0.3);
      // camera
      const wide = { p: [0.3, 2.6, 11.5], l: [0, 2.0, 0], fov: 42 };
      const dclose = { p: [-0.4, 3.7, 5.2], l: [-1.6, 3.6, 0.9], fov: 34 };
      const kclose = { p: [1.0, 2.0, 3.9], l: [2.4, 1.9, 0.3], fov: 34 };
      if (t < m.ring) blendShot(cam, t / m.ring, wide, { ...wide, p: [0.3, 2.4, 10.0] }, t, 0.02);
      else if (t < Ls[2].s - 0.1) onTarget(cam, wp(D.head), [2.6 - (t - m.ring) * 0.1, 0.2, 6.4 - (t - m.ring) * 0.3], 40, t > Ls[1].s && t < Ls[1].e ? 0.025 : 0, t, [0, -0.5, 0]);
      else if (t < Ls[3].s) onTarget(cam, wp(K.head), [-1.8, 0.1, 4.2], 38, 0, t, [0, -0.5, 0]);
      else onTarget(cam, wp(D.head), [2.0, 0.2, 4.6], 38, 0, t, [0, -0.5, 0]);
      return { scene: S, cam };
    }
  };
}

// ======================= 5. SHARK =======================
function makeShark() {
  const g = new THREE.Group(); const r = { g };
  const grey = 0x7f93a6, white = 0xf2f2ee;
  const body = at(sph(0.8, grey), 0, 0, 0, g); body.scale.set(0.85, 0.85, 2.1);
  at(sph(0.7, white), 0, -0.18, 0.15, g).scale.set(0.78, 0.6, 1.9);
  const df = at(cone(0.45, 0.9, grey, {}, 4), 0, 0.85, -0.2, g); df.scale.set(0.2, 1, 1); df.rotation.x = -0.35;
  const tail = grp(g, 0, 0, -1.6); r.tail = tail;
  at(cone(0.38, 0.9, grey), 0, 0, -0.3, tail).rotation.x = -Math.PI / 2;
  const t1 = at(box(0.08, 1.2, 0.35, grey, 0.04), 0, 0.35, -0.8, tail); t1.rotation.x = -0.6; const t2 = at(box(0.08, 0.8, 0.3, grey, 0.04), 0, -0.3, -0.75, tail); t2.rotation.x = 0.7;
  r.fins = [];
  for (const s of [-1, 1]) { const fg = grp(g, 0.55 * s, -0.25, 0.5); const f = at(box(0.7, 0.07, 0.38, grey, 0.03), 0.3 * s, 0, 0, fg); fg.rotation.z = -0.4 * s; r.fins.push(fg); }
  const jaw = grp(g, 0, -0.3, 1.0); r.jaw = jaw; at(box(0.9, 0.2, 0.9, white, 0.1), 0, -0.08, 0.35, jaw);
  const mouthIn = at(sph(0.4, 0x8a2a3a), 0, -0.15, 1.2, g); mouthIn.scale.set(1.1, 0.4, 0.6);
  for (let i = 0; i < 9; i++) { const a = -1 + i / 8 * 2; const tt = at(cone(0.05, 0.14, 0xffffff), a * 0.38, -0.22, 1.55 - Math.abs(a) * 0.35, g); tt.rotation.x = Math.PI; const tb = at(cone(0.045, 0.12, 0xffffff), a * 0.36, 0.0, 0.7 - Math.abs(a) * 0.3, jaw); }
  r.eyes = []; for (const s of [-1, 1]) { const e = at(sph(0.1, 0x0d0d10, { r: 0.1 }), 0.5 * s, 0.22, 1.05, g); r.eyes.push(e); at(sph(0.03, 0xffffff), 0.52 * s, 0.26, 1.13, g); }
  const brow = []; for (const s of [-1, 1]) { const b = at(box(0.26, 0.06, 0.06, 0x5d6d7e, 0.02), 0.45 * s, 0.38, 1.0, g); brow.push(b); } r.brows = brow;
  return r;
}
export function sceneShark() {
  const S = new THREE.Scene(); S.background = gradientBg('#58b6ff', '#d9f2ff'); S.fog = new THREE.Fog(0xcfeeff, 25, 80);
  const cam = newCam();
  stdLights(S, { sky: 0xffffff, ground: 0x2aa6b8, hi: 1.1, sun: 0xfff2d6, si: 2.8, pos: [6, 12, 6], ss: 8 });
  at(sph(3, 0xfff7c2, { e: 0xfff2a0, ei: 2 }), 18, 22, -60, S);
  const seaGeo = new THREE.PlaneGeometry(140, 140, 90, 90); seaGeo.rotateX(-Math.PI / 2);
  const sea = new THREE.Mesh(seaGeo, new THREE.MeshStandardMaterial({ color: 0x1fb3c4, roughness: 0.25, metalness: 0.1, flatShading: true })); sea.receiveShadow = true; S.add(sea);
  const base = seaGeo.attributes.position.array.slice();
  const island = grp(S, -18, 0, -40); at(sph(5, 0xf2d79b), 0, -2, 0, island).scale.set(1.6, 0.6, 1); tree(island, 0, 0, 1.6, 'palm', 3); tree(island, 2.5, 0.5, 1.3, 'palm', 5);
  // surfer prone on board
  const surf = grp(S, 0, 0.1, 1.5);
  const board = at(box(0.6, 0.1, 2.6, 0xffffff, 0.05), 0, 0, 0, surf); at(box(0.12, 0.11, 2.4, 0xff6b3d, 0.03), 0, 0.005, 0, surf);
  const P = makeHuman({ skin: 0xd99a6c, shirt: 0xd99a6c, pants: 0x2f7bd6, flip: false, shoe: 0xd99a6c, hair: 0xe0c060 }); surf.add(P.g);
  P.g.rotation.x = -Math.PI / 2; P.g.position.set(0, 0.32, 0.35); P.head.rotation.x = -1.1;
  const shark = makeShark(); S.add(shark.g);
  const sphone = makePhone(1.2, 'call'); shark.fins[1].add(sphone); sphone.position.set(0.6, 0.12, 0); sphone.rotation.set(0, 0, -0.4);
  // beach set
  const B = grp(S, 60, 0, 0);
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(60, 40), mat(0xf0d9a2, { r: 1 })); sand.rotation.x = -Math.PI / 2; sand.position.y = 0.02; sand.receiveShadow = true; B.add(sand);
  const towelTex = canvasTex(64, 128, (c) => { for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#ffffff' : '#e84a5f'; c.fillRect(0, i * 16, 64, 16); } });
  const towel = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.03, 3.2), new THREE.MeshStandardMaterial({ map: towelTex })); towel.position.set(0, 0.04, 0); towel.receiveShadow = true; B.add(towel);
  const umb = grp(B, -1.3, 0, -0.6); at(cyl(0.04, 0.04, 3.2, 0xffffff), 0, 1.6, 0, umb);
  const utex = canvasTex(256, 32, (c) => { for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#ffffff' : '#2ea3f2'; c.fillRect(i * 32, 0, 32, 32); } });
  const ucone = new THREE.Mesh(new THREE.ConeGeometry(2.0, 0.8, 16, 1, true), new THREE.MeshStandardMaterial({ map: utex, side: THREE.DoubleSide })); ucone.position.y = 3.2; ucone.castShadow = true; umb.add(ucone); umb.rotation.z = 0.15;
  const ball = at(sph(0.3, 0xffd84d), 2.2, 0.3, 1.6, B); const cooler = at(box(0.8, 0.55, 0.5, 0x2ea3f2, 0.08), 1.8, 0.28, -1.0, B);
  const sh2 = makeShark(); B.add(sh2.g); sh2.g.position.set(0.1, 0.72, 0.4); sh2.g.rotation.y = 0.25; sh2.g.scale.setScalar(0.95);
  const watch = grp(sh2.fins[0], -0.45, 0.0, 0); at(tor(0.1, 0.035, 0x222222), 0, 0, 0, watch).rotation.y = Math.PI / 2; at(cyl(0.12, 0.12, 0.05, 0xd4af37, { m: 0.8, r: 0.3 }), 0, 0.06, 0, watch);
  const walker = makeHuman({ skin: 0xd99a6c, shirt: 0xd99a6c, pants: 0x2f7bd6, shoe: 0xd99a6c, hair: 0xe0c060 }); B.add(walker.g);
  const wboard = grp(walker.armR, 0, -0.5, 0); const wb = at(box(0.55, 2.4, 0.1, 0xffffff, 0.05), 0.25, 0.3, 0, wboard);
  return {
    S, cam, update(t, C) {
      const m = C.m, Ls = C.L;
      const pa = seaGeo.attributes.position.array;
      for (let i = 0; i < pa.length; i += 3) { const x = base[i], z = base[i + 2]; pa[i + 1] = Math.sin(x * 0.35 + t * 1.6) * 0.12 + Math.cos(z * 0.4 + t * 1.2) * 0.12; }
      seaGeo.attributes.position.needsUpdate = true; seaGeo.computeVertexNormals();
      if (t < m.beach) {
        // surfer paddling toward camera
        surf.position.set(0, 0.12 + Math.sin(t * 2) * 0.05, 1.5 + t * 0.15);
        P.armL.rotation.x = -1.6 + Math.sin(t * 5) * 1.2; P.armR.rotation.x = -1.6 - Math.sin(t * 5) * 1.2;
        P.armL.rotation.z = 0.3; P.armR.rotation.z = -0.3; blink(P, t); look(P, 0, 0.5);
        const rise = sstep(0.4, 1.0, t);
        const froze = t > m.ring;
        shark.g.position.set(0, lerp(-2.2, 0.9, rise) + (froze ? Math.sin(t * 2) * 0.05 : 0), surf.position.z - 2.6);
        shark.g.rotation.set(lerp(-0.2, -0.75, rise) * (froze ? lerp(1, 0.35, sstep(m.ring, m.ring + 0.4, t)) : 1), 0, 0);
        shark.jaw.rotation.x = froze ? lerp(0.8, 0.15, sstep(m.ring, m.ring + 0.3, t)) : rise * 0.8;
        shark.tail.rotation.y = Math.sin(t * 6) * 0.3;
        const ansK = sstep(m.ring + 0.05, m.ring + 0.4, t);
        shark.fins[1].rotation.set(0, 0, lerp(0.4, 2.0, ansK)); sphone.visible = froze; sphone.userData.set(t < Ls[0].s ? 'call' : 'talk');
        shark.brows.forEach((b, i) => { b.rotation.z = (i ? -1 : 1) * (t > Ls[0].s ? -0.4 : 0.35); b.position.y = t > Ls[0].s ? 0.42 : 0.38; });
        const pre = { p: [1.6, 1.3, surf.position.z + 4.8], l: [0, 0.8, surf.position.z - 1.2], fov: 42 };
        const cl = { p: [0.7, 1.8, surf.position.z + 1.4], l: [0, 1.4, shark.g.position.z], fov: 38 };
        if (t < m.ring) setCam(cam, pre.p, pre.l, 42, 0, t);
        else onTarget(cam, wp(shark.g, 0, 0, 1.0), [2.2, 1.0, 5.6 - (t - m.ring) * 0.25], 40, t > Ls[0].s ? 0.015 : 0, t, [0, -0.3, 0]);
        return { scene: S, cam };
      }
      const lt = t - m.beach;
      sh2.g.rotation.z = Math.sin(lt * 1.5) * 0.04; sh2.g.rotation.x = -0.12;
      const peek = sstep(0.2, 0.5, lt) * (1 - sstep(1.0, 1.3, lt));
      sh2.fins[0].rotation.set(lerp(0, -0.9, peek), lerp(0, 0.6, peek), lerp(0.4, -0.9, peek)); sh2.eyes.forEach(e => e.position.y = 0.22 - peek * 0.05);
      sh2.brows.forEach((b, i) => { b.rotation.z = (i ? -1 : 1) * -0.35; b.position.y = 0.42; });
      sh2.jaw.rotation.x = 0.03;
      const wx = lerp(4.5, -4.0, lt / 1.9); walker.g.position.set(wx, 0, -2.6); walker.g.rotation.y = -Math.PI / 2 + 0.5;
      walker.legL.rotation.x = Math.sin(lt * 9) * 0.5; walker.legR.rotation.x = -Math.sin(lt * 9) * 0.5; walker.armR.rotation.set(0, 0, -0.1); walker.armL.rotation.x = Math.sin(lt * 9) * 0.4;
      walker.head.rotation.y = -0.9; look(walker, 0.6, 0); blink(walker, lt);
      for (const b of walker.brows) b.rotation.z *= 1;
      blendShot(cam, lt / 2, { p: [61.2, 2.6, 6.4], l: [60.1, 1.2, -0.3], fov: 40 }, { p: [61.0, 2.4, 5.6], l: [60.1, 1.2, -0.3], fov: 38 }, t);
      return { scene: S, cam };
    }
  };
}

// ======================= 6. DINO =======================
function makeRex() {
  const g = new THREE.Group(); const r = { g };
  const green = 0x5a9e4b, belly = 0xcfe39a;
  const body = grp(g, 0, 2.0, 0); r.body = body;
  at(sph(1.0, green), 0, 0, 0, body).scale.set(0.95, 1.05, 1.4);
  at(sph(0.8, belly), 0, -0.15, 0.55, body).scale.set(0.85, 0.9, 0.7);
  let ty = -0.1, tz = -1.2; for (let i = 0; i < 9; i++) { at(sph(0.62 - i * 0.06, green), 0, ty, tz, body); tz -= 0.42; ty -= 0.08; }
  for (const s of [-1, 1]) { const lg = grp(g, 0.6 * s, 1.6, -0.1); at(sph(0.55, green), 0, 0, 0, lg).scale.set(0.8, 1, 1.1); at(cyl(0.22, 0.26, 1.2, green), 0, -0.8, 0.15, lg); at(box(0.5, 0.18, 0.7, 0x3f7a35, 0.06), 0, -1.45, 0.35, lg); r[s < 0 ? 'legL' : 'legR'] = lg; }
  // tiny arms
  r.arms = [];
  for (const s of [-1, 1]) { const ar = grp(body, 0.55 * s, 0.25, 1.0); at(cap(0.07, 0.18, green), 0, -0.13, 0.04, ar); for (const c of [-1, 1]) at(cone(0.03, 0.1, 0xf4ead2), c * 0.04, -0.3, 0.06, ar).rotation.x = Math.PI; r.arms.push(ar); }
  const neck = grp(body, 0, 0.7, 1.0); r.neck = neck; at(sph(0.55, green), 0, 0, 0, neck);
  const head = grp(neck, 0, 0.55, 0.35); r.head = head;
  at(box(1.0, 0.75, 1.4, green, 0.3), 0, 0, 0.3, head);
  const jaw = grp(head, 0, -0.28, -0.1); r.jaw = jaw; at(box(0.86, 0.26, 1.25, belly, 0.12), 0, -0.1, 0.55, jaw);
  for (let i = 0; i < 6; i++) for (const s of [-1, 1]) { const tt = at(cone(0.04, 0.12, 0xffffff), 0.38 * s, -0.37, 0.4 + i * 0.16, head); tt.rotation.x = Math.PI; }
  r.eyes = []; r.pupils = [];
  for (const s of [-1, 1]) { const e = at(sph(0.16, 0xffffff), 0.42 * s, 0.22, 0.25, head); e.scale.set(0.6, 1, 1); const p = at(sph(0.08, 0x1a1414), 0.5 * s, 0.22, 0.3, head); r.eyes.push(e); r.pupils.push(p); }
  for (const s of [-1, 1]) at(sph(0.04, 0x2a4a22), 0.15 * s, 0.2, 1.0, head);
  // backwards cap
  const capg = grp(head, 0, 0.36, 0.1); r.cap = capg;
  const dome = at(new THREE.Mesh(new THREE.SphereGeometry(0.48, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xd62f2f)), 0, 0, 0, capg); dome.scale.set(1, 0.6, 1); dome.castShadow = true;
  at(box(0.7, 0.04, 0.55, 0xd62f2f, 0.02), 0, 0.0, -0.62, capg); at(sph(0.06, 0xffffff), 0, 0.29, 0, capg);
  return r;
}
function makeTrico() {
  const g = new THREE.Group(); const r = { g }; const c = 0x5b84c9, fr = 0xf29b4b;
  at(sph(1.0, c), 0, 1.2, 0, g).scale.set(1.0, 0.85, 1.4);
  for (const [x, z] of [[-0.55, 0.7], [0.55, 0.7], [-0.55, -0.7], [0.55, -0.7]]) at(cyl(0.22, 0.25, 0.8, c), x, 0.4, z, g);
  at(cone(0.3, 0.9, c), 0, 1.1, -1.5, g).rotation.x = -Math.PI / 2 - 0.2;
  const head = grp(g, 0, 1.35, 1.3); r.head = head;
  at(sph(0.55, c), 0, 0, 0, head).scale.set(1, 0.9, 1.1);
  const frill = at(cyl(0.95, 0.95, 0.1, fr, {}, 24), 0, 0.35, -0.3, head); frill.rotation.x = Math.PI / 2 - 0.4;
  at(cone(0.08, 0.6, 0xfff4dc), -0.25, 0.45, 0.25, head).rotation.x = 0.9; at(cone(0.08, 0.6, 0xfff4dc), 0.25, 0.45, 0.25, head).rotation.x = 0.9; at(cone(0.07, 0.35, 0xfff4dc), 0, 0.05, 0.6, head).rotation.x = 0.5;
  const beak = at(cone(0.25, 0.4, 0x3f5f99), 0, -0.15, 0.6, head); beak.rotation.x = Math.PI / 2;
  const jaw = grp(head, 0, -0.28, 0.3); r.jaw = jaw; at(box(0.4, 0.1, 0.4, 0x3f5f99, 0.04), 0, 0, 0.1, jaw);
  r.eyes = []; r.pupils = []; for (const s of [-1, 1]) { const e = at(sph(0.14, 0xffffff), 0.3 * s, 0.12, 0.38, head); const p = at(sph(0.07, 0x111111), 0.32 * s, 0.12, 0.5, head); r.eyes.push(e); r.pupils.push(p); }
  return r;
}
function makeRaptor() {
  const g = new THREE.Group(); const r = { g }; const c = 0xc9813a;
  at(sph(0.5, c), 0, 1.3, 0, g).scale.set(0.8, 0.9, 1.3);
  for (const s of [-1, 1]) { const l = grp(g, 0.25 * s, 1.1, 0); at(cap(0.1, 0.8, c), 0, -0.5, 0, l); r[s < 0 ? 'legL' : 'legR'] = l; }
  let tz = -0.6; for (let i = 0; i < 6; i++) { at(sph(0.3 - i * 0.04, c), 0, 1.35, tz, g); tz -= 0.3; }
  const head = grp(g, 0, 1.95, 0.55); r.head = head; at(cap(0.14, 0.3, c), 0, -0.3, 0, head).rotation.x = 0.3;
  at(box(0.4, 0.32, 0.75, c, 0.12), 0, 0, 0.2, head);
  r.eyes = []; for (const s of [-1, 1]) { at(sph(0.08, 0xffffff), 0.19 * s, 0.08, 0.15, head); at(sph(0.045, 0x111111), 0.22 * s, 0.08, 0.2, head); }
  for (let i = 0; i < 4; i++) for (const s of [-1, 1]) at(sph(0.06, 0x7a4a1a), 0.1 * s, 0.17, -0.1 + i * 0.12, head);
  return r;
}
function makeMammal() {
  const g = new THREE.Group(); const r = { g };
  const body = at(sph(0.35, 0x8a5a3a, { r: 1 }), 0, 0.3, 0, g); body.scale.set(1, 0.95, 1);
  for (const s of [-1, 1]) { at(sph(0.12, 0x8a5a3a), 0.22 * s, 0.62, -0.02, g); at(sph(0.07, 0xe8a0a0), 0.22 * s, 0.62, 0.05, g); }
  r.eyes = []; for (const s of [-1, 1]) { const e = at(sph(0.11, 0x111111, { r: 0.1 }), 0.13 * s, 0.38, 0.28, g); at(sph(0.035, 0xffffff, { e: 0xffffff, ei: 1 }), 0.15 * s, 0.42, 0.37, g); r.eyes.push(e); }
  at(sph(0.05, 0xf08a9a), 0, 0.28, 0.35, g);
  r.mouth = at(sph(0.04, 0x3a1010), 0, 0.2, 0.32, g); r.mouth.scale.set(1.3, 0.3, 0.5);
  const arm = grp(g, 0.25, 0.3, 0.15); at(cap(0.05, 0.12, 0x8a5a3a), 0, 0.08, 0, arm); r.arm = arm;
  const ph = makePhone(0.42, 'talk'); arm.add(ph); ph.position.set(0, 0.2, 0.03); r.phone = ph;
  return r;
}
function makeFlipFlop() {
  const g = new THREE.Group();
  const shp = new THREE.Shape(); shp.moveTo(0, -1.8); shp.bezierCurveTo(0.9, -1.8, 0.9, -0.6, 0.75, 0); shp.bezierCurveTo(0.65, 0.8, 1.0, 1.9, 0, 2.0); shp.bezierCurveTo(-1.0, 1.9, -0.65, 0.8, -0.75, 0); shp.bezierCurveTo(-0.9, -0.6, -0.9, -1.8, 0, -1.8);
  const sole = new THREE.Mesh(new THREE.ExtrudeGeometry(shp, { depth: 0.22, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 2 }), mat(0x2f9e5b)); sole.rotation.x = -Math.PI / 2; g.add(sole);
  const top = new THREE.Mesh(new THREE.ExtrudeGeometry(shp, { depth: 0.06, bevelEnabled: false }), mat(0xf2c94c)); top.rotation.x = -Math.PI / 2; top.position.y = 0.26; top.scale.set(0.93, 0.93, 1); g.add(top);
  const strap = (a, b) => { const tb = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([a, V((a.x + b.x) / 2, 0.75, (a.z + b.z) / 2), b]), 16, 0.09, 8), mat(0x2f9e5b)); g.add(tb); };
  strap(V(0, 0.3, -1.25), V(0.72, 0.3, 0.2)); strap(V(0, 0.3, -1.25), V(-0.72, 0.3, 0.2));
  return g;
}
export function sceneDino() {
  const S = new THREE.Scene(); S.background = gradientBg('#5b3d7a', '#ffc27a', '#ff8a5c'); S.fog = new THREE.Fog(0xf0a070, 22, 70);
  const cam = newCam();
  const Lt = stdLights(S, { sky: 0xffd0a0, ground: 0x3a4a20, hi: 1.0, sun: 0xffc890, si: 2.6, pos: [-8, 7, 6], ss: 10 });
  const g0 = ground(S, 0x6f8f3a);
  const volc = grp(S, 10, 0, -38); at(cone(12, 14, 0x5a4636, { flat: true }, 9), 0, 7, 0, volc); at(cone(3.4, 1.5, 0xff6a2a, { e: 0xff4a1a, ei: 1.5 }, 9), 0, 14, 0, volc);
  const vsmoke = []; for (let i = 0; i < 8; i++) { const s = sph(2, 0x7a6a6a, { op: 0.6, dw: false }, 10, 8); s.castShadow = false; S.add(s); vsmoke.push(s); }
  const R = rnd(21);
  [[-6, -6, 1.6, 'palm'], [-9, -2, 1.3, 'palm'], [7, -8, 1.8, 'palm'], [9, -3, 1.2, 'palm'], [-4, -12, 1.5, 'palm'], [3, -14, 1.7, 'palm'], [-12, -10, 2, 'palm'], [13, -12, 2, 'palm']].forEach(([x, z, s, k], i) => tree(S, x, z, s, k, i + 1));
  for (let i = 0; i < 18; i++) tree(S, (R() - 0.5) * 22, -2 - R() * 10, 0.8 + R() * 0.6, 'fern', i);
  const rock = at(sph(0.6, 0x8a8478, { flat: true }, 7, 5), 0.6, 0.12, 2.3, S); rock.scale.set(1.2, 0.45, 1);
  const phone = makePhone(1.1, 'call'); S.add(phone); phone.position.set(0.6, 0.42, 2.3); phone.rotation.set(-Math.PI / 2, 0, 0.3);
  const rex = makeRex(); S.add(rex.g); rex.g.position.set(-0.5, 0, 0); rex.g.rotation.y = 0.45;
  const tri = makeTrico(); S.add(tri.g); tri.g.position.set(3.2, 0, 0.2); tri.g.rotation.y = -0.9;
  const rap = makeRaptor(); S.add(rap.g); rap.g.position.set(2.0, 0, -1.6); rap.g.rotation.y = -0.6;
  const pter = grp(S, 0, 9, -6); at(sph(0.3, 0x9a6a5a), 0, 0, 0, pter).scale.set(0.7, 0.6, 1.6); const pw = []; for (const s of [-1, 1]) { const w = at(box(1.6, 0.04, 0.6, 0x9a6a5a, 0.02), 0.8 * s, 0, 0, pter); pw.push(w); } at(cone(0.12, 0.6, 0x9a6a5a), 0, 0.05, 0.6, pter).rotation.x = Math.PI / 2;
  const burrow = grp(S, 4.2, 0, 3.0); const mound = at(tor(0.45, 0.2, 0x7a5a3a), 0, 0.05, 0, burrow); mound.rotation.x = Math.PI / 2; at(new THREE.Mesh(new THREE.CircleGeometry(0.45, 20), new THREE.MeshBasicMaterial({ color: 0x140c06 })), 0, 0.06, 0, burrow).rotation.x = -Math.PI / 2;
  const mam = makeMammal(); burrow.add(mam.g);
  // meteor
  const ff = makeFlipFlop(); S.add(ff); ff.scale.setScalar(6.5);
  const ffFireG = grp(S); const ffFire = flames(ffFireG, 50, 0xffc21a, 0xff2a00);
  const meteorLight = new THREE.PointLight(0xff8a3a, 0, 120, 1); S.add(meteorLight);
  // ash scene
  const S2 = new THREE.Scene(); S2.background = gradientBg('#4a4446', '#a8988a', '#7a6c66'); S2.fog = new THREE.Fog(0x8a807a, 6, 30);
  const cam2 = newCam();
  stdLights(S2, { sky: 0xb0a8a0, ground: 0x3a3634, hi: 1.0, sun: 0xffc8a0, si: 1.2, pos: [-6, 8, 5], ss: 6 });
  ground(S2, 0x6a6662);
  for (let i = 0; i < 10; i++) { const x = (R() - 0.5) * 18, z = -3 - R() * 12; const tr = at(cyl(0.08, 0.15, 2 + R() * 2, 0x2a2624), x, 1.2, z, S2); tr.rotation.z = (R() - 0.5) * 0.5; }
  for (let i = 0; i < 12; i++) { const rr_ = at(sph(0.3 + R() * 0.6, 0x55504c, { flat: true }, 6, 4), (R() - 0.5) * 14, 0, -1 - R() * 10, S2); rr_.scale.y = 0.5; }
  const burrow2 = grp(S2, 0, 0, 0); const m2 = at(tor(0.45, 0.2, 0x5a5450), 0, 0.05, 0, burrow2); m2.rotation.x = Math.PI / 2; at(new THREE.Mesh(new THREE.CircleGeometry(0.45, 20), new THREE.MeshBasicMaterial({ color: 0x0c0a08 })), 0, 0.06, 0, burrow2).rotation.x = -Math.PI / 2;
  const mam2 = makeMammal(); burrow2.add(mam2.g); mam2.g.traverse(o => { if (o.isMesh && o.material.color && o.material.color.getHex() === 0x8a5a3a) { o.material = o.material.clone(); o.material.color.setHex(0x7a6a60); } });
  const ashG = new THREE.BufferGeometry(); const ap = []; for (let i = 0; i < 700; i++) ap.push((R() - 0.5) * 16, R() * 8, (R() - 0.5) * 12 - 2); ashG.setAttribute('position', new THREE.Float32BufferAttribute(ap, 3)); const ashBase = ap.slice();
  const ash = new THREE.Points(ashG, new THREE.PointsMaterial({ color: 0xdcd6d0, size: 0.06 })); S2.add(ash);
  return {
    S, cam, update(t, C) {
      const m = C.m, Ls = C.L;
      vsmoke.forEach((s, i) => { const ph = (t * 0.15 + i / 8) % 1; s.position.set(10 + ph * 6, 16 + ph * 14, -38); s.scale.setScalar(1 + ph * 3); s.material.opacity = 0.6 * (1 - ph); });
      if (t >= m.ash) {
        const lt = t - m.ash;
        const pa = ashG.attributes.position.array; for (let i = 0; i < pa.length; i += 3) { pa[i + 1] = ((ashBase[i + 1] - lt * 0.6) % 8 + 8) % 8; pa[i] = ashBase[i] + Math.sin(lt + i) * 0.2; } ashG.attributes.position.needsUpdate = true;
        const up = easeOut(sstep(0.0, 0.5, lt)); mam2.g.position.y = lerp(-0.7, -0.05, up);
        mam2.arm.rotation.z = 0.3; mam2.mouth.scale.y = 0.3 + C.amp('ANCESTRAL') * 1.5;
        mam2.eyes.forEach(e => e.scale.y = (lt % 2.3) < 0.1 ? 0.2 : 1);
        const fin = t > m.final ? (t - m.final) : 0;
        blendShot(cam2, lt / 4.5, { p: [0.6, 1.0, 3.0], l: [0, 0.35, 0], fov: 38 }, { p: [0.3, 0.8, 1.8], l: [0, 0.35, 0], fov: 36 }, t);
        return { scene: S2, cam: cam2 };
      }
      // jungle states
      const fleeT = t - m.flee; const fled = fleeT > 0;
      rex.g.position.y = 0;
      const bob = t < m.ring ? Math.sin(t * 6) * 0.08 : 0;
      rex.head.rotation.x = bob; rex.cap.rotation.z = bob * 0.5;
      // reach attempts
      let reach = 0;
      if (t > m.reach && t < m.audio) reach = Math.abs(Math.sin((t - m.reach) / (m.audio - m.reach) * Math.PI * 2));
      if (t > m.count) reach = sstep(m.count, m.silence, t) * (0.8 + Math.sin(t * 30) * 0.03);
      rex.body.rotation.x = reach * 0.55; rex.body.position.y = 2.0 - reach * 0.35;
      rex.arms.forEach((a, i) => { a.rotation.x = -0.4 - reach * 1.1 + Math.sin(t * 25 + i) * 0.15 * (reach > 0.2 ? 1 : 0); a.rotation.z = (i ? -1 : 1) * 0.2; });
      rex.neck.rotation.x = reach * 0.25;
      const lookUp = t > m.silence ? sstep(m.silence, m.silence + 0.5, t) : 0;
      rex.neck.rotation.x -= lookUp * 0.9; rex.head.rotation.x -= lookUp * 0.4;
      rex.jaw.rotation.x = lookUp * 0.5 + (t > Ls[0].e && t < m.count ? 0.08 : 0);
      rex.pupils.forEach((p, i) => { p.position.y = 0.22 + (reach > 0.3 ? -0.06 : 0) + lookUp * 0.07; p.scale.setScalar(lookUp > 0.5 ? 0.6 : 1); });
      // trico & raptor
      tri.jaw.rotation.x = C.amp('TRICO') * 0.5;
      tri.head.rotation.y = t > m.ring && t < m.reach ? 0.5 : 0; tri.head.rotation.x = t < m.ring ? Math.sin(t * 6 + 1) * 0.08 : 0;
      tri.pupils.forEach(p => p.scale.setScalar(t > m.ring ? 0.6 : 1));
      rap.head.rotation.x = t < m.ring ? Math.sin(t * 6 + 2) * 0.1 : 0;
      if (fled) {
        const k = easeIn(clamp(fleeT / 0.9));
        tri.g.position.set(3.2 + k * 10, 0, 0.2 - k * 2); tri.g.rotation.y = Math.PI / 2 - 0.2;
        rap.g.position.set(2.0 + k * 12, Math.abs(Math.sin(fleeT * 18)) * 0.3, -1.6 - k * 3); rap.g.rotation.y = Math.PI / 2;
        rap.legL.rotation.x = Math.sin(fleeT * 20) * 0.9; rap.legR.rotation.x = -Math.sin(fleeT * 20) * 0.9;
        pter.position.set(fleeT * 8, 9 + fleeT * 6, -6 - fleeT * 4);
      } else { tri.g.position.set(3.2, 0, 0.2); tri.g.rotation.y = -0.9; rap.g.position.set(2.0, 0, -1.6); rap.g.rotation.y = -0.6; pter.position.set(Math.cos(t * 0.6) * 6, 9, -6 + Math.sin(t * 0.6) * 4); pter.rotation.y = -t * 0.6; }
      pw.forEach((w, i) => w.rotation.z = (i ? -1 : 1) * Math.sin(t * 8) * 0.5);
      // phone
      const ringing = t > m.ring && t < m.audio;
      phone.position.x = 0.6 + (ringing ? Math.sin(t * 80) * 0.015 : 0);
      phone.userData.set(t < m.audio ? 'call' : 'missed');
      // mammal
      const pop = t > Ls[2].s - 0.3 && t < Ls[2].e + 0.3 ? 1 : 0;
      mam.g.position.y = pop ? lerp(-0.8, -0.05, easeOut(clamp((t - Ls[2].s + 0.3) / 0.25))) : -0.9;
      mam.g.rotation.y = -0.6; mam.mouth.scale.y = 0.3 + C.amp('ANCESTRAL') * 1.5;
      // meteor
      const mt = t - m.meteor; const impact = 1.75;
      ff.visible = mt > 0 && mt < impact; ffFireG.visible = ff.visible;
      if (mt > 0) {
        const k = clamp(mt / impact); const kk = k * k * 0.7 + k * 0.3;
        const p = V(lerp(-12, 1, kk), lerp(42, 4, kk), lerp(-70, -24, kk)); ff.position.copy(p);
        ff.rotation.set(-0.9 + k * 0.6, t * 0.8, 0.5);
        ffFire.forEach((f, i) => { const ph = (mt * 2.5 + i / ffFire.length) % 1; f.position.copy(p).add(V(Math.sin(i * 7) * 4 - 6 * ph, 3 + Math.cos(i * 3) * 1.5 + 26 * ph, Math.sin(i * 5) * 4 - 6 - 34 * ph)); f.scale.setScalar(1.5 + ph * 7); f.material.opacity = 0.9 * (1 - ph); });
        meteorLight.position.copy(p); meteorLight.intensity = 400 * k;
        Lt.d.color.setHex(0xffb070); Lt.d.intensity = 2.6 + k * 3;
      } else { meteorLight.intensity = 0; Lt.d.intensity = 2.6; }
      // camera
      const wide = { p: [1.4, 3.2, 10.5], l: [1.2, 2.2, 0], fov: 42 };
      const triC = { p: [1.6, 2.2, 4.4], l: [3.0, 1.6, 0.8], fov: 36 };
      const reachC = { p: [3.6, 1.6, 5.6], l: [0.3, 1.4, 1.2], fov: 40 };
      const rexFace = { p: [0.6, 3.5, 4.6], l: [-0.1, 3.1, 1.2], fov: 36 };
      const mamC = { p: [5.0, 1.0, 5.8], l: [4.2, 0.35, 3.0], fov: 36 };
      const skyC = { p: [-1.5, 1.2, 6.5], l: [0, 9, -20], fov: 55 };
      if (t < m.ring) blendShot(cam, (t - m.jungle) / 2.5, wide, { ...wide, p: [1.3, 3.0, 9.0] }, t);
      else if (t < m.reach) setCam(cam, triC.p, triC.l, 36, 0.008, t);
      else if (t < m.audio) blendShot(cam, (t - m.reach) / 1.4, reachC, { ...reachC, p: [3.2, 1.5, 4.8] }, t);
      else if (t < m.flee) blendShot(cam, (t - m.audio) / (m.flee - m.audio), { p: [0.9, 2.2, 6.2], l: [0, 2.3, 1.2], fov: 38 }, { p: [0.7, 3.2, 5.0], l: [0, 2.9, 1.2], fov: 36 }, t);
      else if (t < Ls[2].s - 0.35) blendShot(cam, fleeT / 0.6, wide, wide, t);
      else if (t < m.count) setCam(cam, mamC.p, mamC.l, 36, 0, t);
      else if (t < Ls[4].s) blendShot(cam, (t - m.count) / 1.5, reachC, { ...reachC, p: [2.6, 1.5, 4.0] }, t, 0.01);
      else if (t < m.meteor) onTarget(cam, wp(rex.head), [2.8 - (t - Ls[4].s) * 0.2, 0.4, 6.2 - (t - Ls[4].s) * 0.5], 38, t > m.silence ? 0 : 0.008, t, [0, 0.2 * lookUp, 0]);
      else { const fp = ff.position; setCam(cam, [-1.5, 1.4, 7.5], [fp.x * 0.85, Math.max(4, fp.y * 0.8), fp.z * 0.85], 55, mt > 1.0 ? (mt - 1.0) * 0.12 : 0, t); }
      return { scene: S, cam };
    }
  };
}
