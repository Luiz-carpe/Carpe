import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
export { THREE };

// ---------- math ----------
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, k) => a + (b - a) * k;
export const sstep = (a, b, x) => { const k = clamp((x - a) / (b - a)); return k * k * (3 - 2 * k); };
export const easeOut = k => 1 - Math.pow(1 - clamp(k), 3);
export const easeIn = k => Math.pow(clamp(k), 3);
export const easeInOut = k => { k = clamp(k); return k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; };
export const backOut = k => { k = clamp(k); const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); };
export function rnd(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
export const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------- materials & primitives ----------
const mcache = new Map();
export function mat(color, o = {}) {
  const key = color + JSON.stringify(o);
  if (!mcache.has(key)) mcache.set(key, new THREE.MeshStandardMaterial({ color, roughness: o.r ?? 0.65, metalness: o.m ?? 0, emissive: o.e ?? 0x000000, emissiveIntensity: o.ei ?? 1, transparent: o.op != null, opacity: o.op ?? 1, flatShading: !!o.flat, side: o.ds ? THREE.DoubleSide : THREE.FrontSide, depthWrite: o.op != null ? (o.dw ?? true) : true }));
  return mcache.get(key);
}
function sh(m, cast = true, recv = true) { m.castShadow = cast; m.receiveShadow = recv; return m; }
export const box = (w, h, d, c, r = 0.06, o) => sh(new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2.01, h / 2.01, d / 2.01)), c.isMaterial ? c : mat(c, o)));
export const sph = (r, c, o, ws = 24, hs = 16) => sh(new THREE.Mesh(new THREE.SphereGeometry(r, ws, hs), c.isMaterial ? c : mat(c, o)));
export const cyl = (rt, rb, h, c, o, seg = 20) => sh(new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), c.isMaterial ? c : mat(c, o)));
export const cone = (r, h, c, o, seg = 16) => sh(new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), c.isMaterial ? c : mat(c, o)));
export const cap = (r, l, c, o) => sh(new THREE.Mesh(new THREE.CapsuleGeometry(r, l, 6, 14), c.isMaterial ? c : mat(c, o)));
export const tor = (r, t, c, o, arc = Math.PI * 2) => sh(new THREE.Mesh(new THREE.TorusGeometry(r, t, 10, 28, arc), c.isMaterial ? c : mat(c, o)));
export function at(m, x, y, z, parent) { m.position.set(x, y, z); if (parent) parent.add(m); return m; }
export function grp(parent, x = 0, y = 0, z = 0) { const g = new THREE.Group(); g.position.set(x, y, z); if (parent) parent.add(g); return g; }

// ---------- canvas textures ----------
export function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d'); draw(ctx, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.userData.ctx = ctx; t.userData.canvas = c; return t;
}
export function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
export function heart(ctx, x, y, s, col) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.fillStyle = col; ctx.beginPath();
  ctx.moveTo(0, 0.35); ctx.bezierCurveTo(-0.9, -0.3, -0.45, -1.0, 0, -0.5); ctx.bezierCurveTo(0.45, -1.0, 0.9, -0.3, 0, 0.35); ctx.fill(); ctx.restore();
}
const screens = {};
export function phoneScreen(kind) {
  if (screens[kind]) return screens[kind];
  screens[kind] = canvasTex(256, 480, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#2b3a67'); g.addColorStop(1, '#141a33');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.textAlign = 'center'; c.fillStyle = '#fff';
    if (kind === 'call' || kind === 'talk') {
      c.fillStyle = '#f2c6d2'; c.beginPath(); c.arc(w / 2, 130, 58, 0, 7); c.fill();
      heart(c, w / 2, 140, 52, '#e83a5f');
      c.fillStyle = '#fff'; c.font = '800 54px Montserrat'; c.fillText('MÃE', w / 2 - 14, 250);
      heart(c, w / 2 + 74, 238, 20, '#ff4d6d');
      c.font = '600 24px Montserrat'; c.fillStyle = '#c9d2f2'; c.fillText(kind === 'call' ? 'chamando…' : 'em chamada', w / 2, 292);
      if (kind === 'call') {
        c.fillStyle = '#e5484d'; c.beginPath(); c.arc(70, 400, 34, 0, 7); c.fill();
        c.fillStyle = '#30c85e'; c.beginPath(); c.arc(186, 400, 34, 0, 7); c.fill();
      } else { c.fillStyle = '#e5484d'; c.beginPath(); c.arc(w / 2, 400, 34, 0, 7); c.fill(); }
    } else if (kind === 'missed') {
      c.font = '800 40px Montserrat'; c.fillText('3', w / 2, 170); c.font = '700 26px Montserrat'; c.fillText('chamadas', w / 2, 210); c.fillText('perdidas', w / 2, 242);
      c.fillStyle = '#e5484d'; c.font = '800 30px Montserrat'; c.fillText('MÃE', w / 2, 300);
    }
  });
  return screens[kind];
}
export function makePhone(scale = 1, kind = 'call') {
  const g = new THREE.Group();
  const body = box(0.2, 0.38, 0.035, 0x1b1b22, 0.03, { r: 0.3 }); g.add(body);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.175, 0.33), new THREE.MeshBasicMaterial({ map: phoneScreen(kind), toneMapped: false }));
  scr.position.z = 0.019; g.add(scr); g.userData.scr = scr;
  g.userData.set = k => { scr.material.map = phoneScreen(k); };
  g.scale.setScalar(scale); return g;
}

// ---------- characters ----------
export function makeHuman(o = {}) {
  const P = Object.assign({ skin: 0xe9b48c, shirt: 0x4a7bd0, pants: 0x2d3f66, shoe: 0x3a2a20, hair: 0x3b2618, hairStyle: 'short' }, o);
  const g = new THREE.Group(); const r = {};
  for (const s of [-1, 1]) {
    const leg = grp(g, 0.17 * s, 0.62, 0);
    at(box(0.24, 0.58, 0.27, P.pants, 0.1), 0, -0.28, 0, leg);
    if (P.flip) { at(box(0.27, 0.05, 0.38, 0x2ca86a, 0.02), 0, -0.6, 0.05, leg); at(box(0.2, 0.1, 0.22, P.skin, 0.05), 0, -0.53, 0.06, leg); }
    else at(box(0.28, 0.14, 0.38, P.shoe, 0.06), 0, -0.57, 0.05, leg);
    r[s < 0 ? 'legL' : 'legR'] = leg;
  }
  const torso = grp(g, 0, 0.62, 0); r.torso = torso;
  at(box(0.74, 0.8, 0.48, P.shirt, 0.18), 0, 0.42, 0, torso);
  if (P.vest) { at(box(0.78, 0.62, 0.52, P.vest, 0.12), 0, 0.42, 0, torso); }
  if (P.belt) at(box(0.76, 0.1, 0.5, P.belt, 0.04), 0, 0.06, 0, torso);
  for (const s of [-1, 1]) {
    const arm = grp(torso, 0.46 * s, 0.72, 0);
    at(cap(0.11, 0.38, P.sleeve ?? P.shirt), 0, -0.26, 0, arm);
    const hand = at(sph(0.115, P.glove ?? P.skin), 0, -0.56, 0, arm);
    r[s < 0 ? 'armL' : 'armR'] = arm; r[s < 0 ? 'handL' : 'handR'] = hand;
    arm.rotation.z = 0.12 * s;
  }
  const head = grp(torso, 0, 1.33, 0); r.head = head;
  at(sph(0.5, P.skin), 0, 0, 0, head);
  at(sph(0.1, P.skin), -0.5, 0, 0, head).scale.set(0.6, 1, 1); at(sph(0.1, P.skin), 0.5, 0, 0, head).scale.set(0.6, 1, 1);
  r.eyes = []; r.pupils = [];
  for (const s of [-1, 1]) {
    const e = at(sph(0.12, 0xffffff, { r: 0.3 }), 0.18 * s, 0.08, 0.41, head); e.scale.set(1, 1.15, 0.55);
    const p = at(sph(0.065, 0x1a1414, { r: 0.2 }), 0.18 * s, 0.08, 0.475, head); p.scale.set(1, 1.2, 0.5);
    r.eyes.push(e); r.pupils.push(p);
    const brow = at(box(0.17, 0.04, 0.04, P.hair, 0.02), 0.18 * s, 0.27, 0.44, head); brow.rotation.z = -0.1 * s; (r.brows ||= []).push(brow);
  }
  if (P.glasses) for (const s of [-1, 1]) { const ring = at(tor(0.12, 0.018, 0x222222), 0.18 * s, 0.08, 0.48, head); }
  at(sph(0.07, P.skin), 0, -0.04, 0.5, head);
  const mouth = at(sph(0.1, 0x5a1e1e, { r: 0.4 }), 0, -0.2, 0.44, head); mouth.scale.set(1.3, 0.15, 0.5); r.mouth = mouth;
  if (P.beard) { const b = at(sph(0.42, P.hair), 0, -0.2, 0.08, head); b.scale.set(1.05, 0.7, 1); }
  if (P.hairStyle === 'short') { const hm = at(new THREE.Mesh(new THREE.SphereGeometry(0.53, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.42), mat(P.hair)), 0, 0.03, -0.04, head); hm.rotation.x = -0.35; sh(hm); }
  if (P.hairStyle === 'bun') { const hm = at(new THREE.Mesh(new THREE.SphereGeometry(0.54, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.6), mat(P.hair)), 0, 0.02, -0.06, head); hm.rotation.x = -0.6; sh(hm); at(sph(0.22, P.hair), 0, 0.42, -0.32, head); }
  if (P.helmet) { const hm = at(new THREE.Mesh(new THREE.SphereGeometry(0.56, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.45), mat(P.helmet, { r: 0.4 })), 0, 0.05, 0, head); sh(hm); at(box(1.1, 0.05, 0.4, P.helmet, 0.02), 0, 0.05, 0.4, head); }
  if (P.dress) { at(cone(0.62, 1.0, P.dress), 0, 0.0, 0, torso); }
  r.g = g; r.P = P; return r;
}
export function talk(c, amp, t = 0) {
  c.mouth.scale.y = 0.12 + amp * 0.85; c.mouth.scale.x = 1.3 - amp * 0.3;
}
export function blink(c, t, off = 0) {
  const ph = (t + off) % 3.2; const k = ph < 0.12 ? 0.1 : 1;
  for (const e of c.eyes) e.scale.y = 1.15 * k; for (const p of c.pupils) p.scale.y = 1.2 * k;
}
export function look(c, x, y) { for (let i = 0; i < 2; i++) { const p = c.pupils[i]; p.position.x = 0.18 * (i ? 1 : -1) + x * 0.05; p.position.y = 0.08 + y * 0.05; } }

// ---------- environment helpers ----------
export function stdLights(scene, o = {}) {
  const hemi = new THREE.HemisphereLight(o.sky ?? 0xdfe9ff, o.ground ?? 0x5a4a3a, o.hi ?? 1.1); scene.add(hemi);
  const d = new THREE.DirectionalLight(o.sun ?? 0xfff2dd, o.si ?? 2.4); d.position.set(...(o.pos ?? [6, 12, 8]));
  d.castShadow = true; d.shadow.mapSize.set(1024, 1024); const s = o.ss ?? 12;
  Object.assign(d.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 0.5, far: 60 }); d.shadow.bias = -0.0005; d.shadow.normalBias = 0.03;
  if (o.target) d.target.position.set(...o.target); scene.add(d); scene.add(d.target);
  return { hemi, d };
}
export function gradientBg(top, bot, mid) {
  return canvasTex(8, 256, (c, w, h) => { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, top); if (mid) g.addColorStop(0.6, mid); g.addColorStop(1, bot); c.fillStyle = g; c.fillRect(0, 0, w, h); });
}
export function tree(parent, x, z, s = 1, kind = 'round', seed = 1) {
  const g = grp(parent, x, 0, z); g.scale.setScalar(s);
  if (kind === 'palm') {
    const R = rnd(seed); let px = 0, py = 0;
    for (let i = 0; i < 6; i++) { const seg = at(cyl(0.16, 0.2, 0.6, 0x8a6a45), px, py + 0.3, 0, g); px += 0.06; py += 0.55; seg.rotation.z = -0.1; }
    for (let i = 0; i < 7; i++) { const lf = at(box(1.6, 0.05, 0.4, 0x3f9a3a, 0.02), px, py + 0.1, 0, g); lf.rotation.y = i / 7 * Math.PI * 2; lf.rotation.z = -0.45; lf.geometry.translate(0.8, 0, 0); }
  } else if (kind === 'pine') {
    at(cyl(0.15, 0.2, 0.8, 0x6b4a2f), 0, 0.4, 0, g);
    for (let i = 0; i < 3; i++) at(cone(1.0 - i * 0.25, 1.1, 0x2f7d46), 0, 1.1 + i * 0.6, 0, g);
  } else if (kind === 'fern') {
    for (let i = 0; i < 6; i++) { const lf = at(cone(0.18, 1.3, 0x4c9a3c), 0, 0.5, 0, g); lf.rotation.z = 0.7; lf.rotation.y = i; lf.position.set(Math.cos(i) * 0.3, 0.45, Math.sin(i) * 0.3); }
  } else {
    at(cyl(0.16, 0.22, 1.2, 0x7a5636), 0, 0.6, 0, g);
    at(sph(0.85, 0x4caf50), 0, 1.7, 0, g); at(sph(0.6, 0x5cbf5c), 0.45, 1.5, 0.2, g); at(sph(0.6, 0x43a047), -0.4, 1.55, -0.1, g);
  }
  return g;
}
