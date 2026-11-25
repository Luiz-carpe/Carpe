import * as THREE from 'three';
import { sceneSpace, sceneBomb, sceneUfo, sceneDragon, sceneShark, sceneDino } from './scenes.js';
import { heart, clamp, easeOut, backOut, sstep } from './lib.js';

const W = 720, H = 1280;
const TL = await (await fetch('timeline.json')).json();
const fonts = [
  ['Montserrat', 'node_modules/@fontsource/montserrat/files/montserrat-latin-800-normal.woff2', { weight: '800' }],
  ['Montserrat', 'node_modules/@fontsource/montserrat/files/montserrat-latin-700-normal.woff2', { weight: '700' }],
  ['Montserrat', 'node_modules/@fontsource/montserrat/files/montserrat-latin-900-normal.woff2', { weight: '900' }],
  ['Playfair', 'node_modules/@fontsource/playfair-display/files/playfair-display-latin-700-italic.woff2', { weight: '700', style: 'italic' }],
];
for (const [n, u, d] of fonts) { const f = new FontFace(n, `url(${u})`, d); await f.load(); document.fonts.add(f); }

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H); renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const out = document.createElement('canvas'); out.width = W; out.height = H; document.body.appendChild(out);
const ctx = out.getContext('2d');

const builders = { space: sceneSpace, bomb: sceneBomb, ufo: sceneUfo, dragon: sceneDragon, shark: sceneShark, dino: sceneDino };
const SC = {};
for (const s of TL.scenes) {
  const marks = {}; for (const k in s.marks) marks[k] = s.marks[k] - s.start;
  const L = TL.lines.filter(l => l.scene === s.id).map(l => ({ ...l, s: l.start - s.start, e: l.end - s.start }));
  SC[s.id] = { meta: s, obj: builders[s.id](), m: marks, L };
}

const LABEL = { HOUSTON: 'HOUSTON · RÁDIO', TIAGO: 'COMANDANTE TIAGO', COSTA: 'AGENTE COSTA', LUCAS: 'LUCAS', GLORP: 'GLORP · TRADUZIDO DO ALIENÍGENA', IGNACIO: 'IGNÁCIO, O DRAGÃO', CAVALEIRO: 'CAVALEIRO', TRICO: 'TRICO', ANCESTRAL: 'SEU ANCESTRAL', MAE: 'MÃE' };

function parseCap(cap) {
  const words = []; let hl = false;
  let prev = ' ';
  for (const part of cap.split(/(\*)/)) { if (part === '*') { hl = !hl; continue; } if (!part) continue; part.split(/\s+/).forEach((w, i) => { if (w) words.push({ w, hl, glue: i === 0 && words.length > 0 && !/^\s/.test(part) && !/\s$/.test(prev) }); }); prev = part; }
  // merge punctuation-only tokens
  return words;
}
function fontFor(hl, size) { return hl ? `italic 700 ${size * 1.12}px Playfair` : `800 ${size}px Montserrat`; }
function layout(words, size, maxW) {
  const lines = [[]]; let x = 0; const sp = size * 0.28;
  for (const wd of words) {
    ctx.font = fontFor(wd.hl, size); const w = ctx.measureText(wd.w).width; wd.width = w;
    if (!wd.glue && x + w > maxW && lines[lines.length - 1].length) { lines.push([]); x = 0; }
    lines[lines.length - 1].push(wd); x += w + sp;
  }
  return lines.map(l => ({ words: l, width: l.reduce((a, w, i) => a + w.width + (i && !w.glue ? sp : 0), 0) }));
}
function textShadow(on) { ctx.shadowColor = on ? 'rgba(0,0,0,0.65)' : 'transparent'; ctx.shadowBlur = on ? 14 : 0; ctx.shadowOffsetY = on ? 3 : 0; }

function drawCaption(line, t) {
  const words = parseCap(line.cap); const isMom = line.who === 'MAE';
  const size = 44; const lines = layout(words, size, 600);
  const dur = line.end - line.start; const total = words.reduce((a, w) => a + w.w.length + 2, 0);
  const prog = clamp((t - line.start) / Math.max(0.3, dur * 0.85));
  let acc = 0; const lh = size * 1.25; const y0 = H * 0.715 - (lines.length - 1) * lh / 2;
  // label
  const lab = LABEL[line.who]; ctx.font = '800 20px Montserrat'; const lw = ctx.measureText(lab).width + (isMom ? 58 : 34);
  const ly = y0 - size * 1.15; const a0 = clamp((t - line.start + 0.05) / 0.12);
  ctx.globalAlpha = a0; textShadow(false);
  ctx.fillStyle = isMom ? '#ff4d7e' : 'rgba(15,18,30,0.72)'; ctx.beginPath(); ctx.roundRect(W / 2 - lw / 2, ly - 17, lw, 34, 17); ctx.fill();
  if (isMom) heart(ctx, W / 2 - lw / 2 + 24, ly + 3, 15, '#fff');
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(lab, W / 2 + (isMom ? 12 : 0), ly + 1);
  ctx.globalAlpha = 1;
  lines.forEach((ln, li) => {
    let x = W / 2 - ln.width / 2; const y = y0 + li * lh;
    for (const [wi, wd] of ln.words.entries()) {
      if (wi && wd.glue) x -= size * 0.28 - 2;
      const k0 = acc / total; acc += wd.w.length + 2;
      const a = clamp((prog - k0) / 0.06 + 0.001); if (a <= 0) { x += wd.width + size * 0.28; continue; }
      const pop = 1 + (1 - easeOut(clamp((prog - k0) / 0.08))) * 0.25;
      ctx.save(); ctx.translate(x + wd.width / 2, y); ctx.scale(pop, pop); ctx.globalAlpha = a;
      ctx.font = fontFor(wd.hl, size); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round'; ctx.lineWidth = 7; ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.strokeText(wd.w, 0, 0);
      textShadow(true); ctx.fillStyle = wd.hl ? '#f7c948' : (isMom ? '#ffd1df' : '#ffffff'); ctx.fillText(wd.w, 0, 0); textShadow(false);
      ctx.restore(); x += wd.width + size * 0.28;
    }
  });
}
function pill(text, y, t0, t) {
  ctx.font = '800 20px Montserrat'; const w = ctx.measureText(text).width + 52; const a = clamp((t - t0) / 0.2);
  ctx.globalAlpha = 0.95 * a; ctx.fillStyle = 'rgba(20,22,40,0.72)'; ctx.beginPath(); ctx.roundRect(W / 2 - w / 2, y - 19, w, 38, 19); ctx.fill();
  ctx.fillStyle = '#9b8cff'; ctx.beginPath(); ctx.arc(W / 2 - w / 2 + 20, y, 6, 0, 7); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, W / 2 + 8, y + 1); ctx.globalAlpha = 1;
}
function banner(title, sub, t0, t1, t, kind = 'call') {
  if (t < t0 || t > t1 + 0.3) return;
  const kin = easeOut(clamp((t - t0) / 0.25)), kout = clamp((t - t1) / 0.3);
  const y = 150 + (1 - kin) * -160 - kout * 160; const x = 60, w = W - 120, h = 104;
  ctx.globalAlpha = 1 - kout; ctx.shadowColor = 'rgba(0,0,0,0.3)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 6;
  ctx.fillStyle = 'rgba(250,250,252,0.97)'; ctx.beginPath(); ctx.roundRect(x, y, w, h, 26); ctx.fill(); textShadow(false);
  const ix = x + 54, iy = y + h / 2; const shake = kind === 'call' ? Math.sin(t * 40) * 0.15 : 0;
  ctx.fillStyle = kind === 'call' ? '#30c85e' : (kind === 'missed' ? '#e5484d' : '#4d7cff'); ctx.beginPath(); ctx.roundRect(ix - 30, iy - 30, 60, 60, 16); ctx.fill();
  ctx.save(); ctx.translate(ix, iy); ctx.rotate(shake); ctx.fillStyle = '#fff';
  if (kind === 'audio') { ctx.beginPath(); ctx.roundRect(-8, -18, 16, 26, 8); ctx.fill(); ctx.fillRect(-2, 10, 4, 8); ctx.fillRect(-9, 16, 18, 4); }
  else { ctx.beginPath(); ctx.ellipse(0, 0, 16, 7, -0.75, 0, 7); ctx.fill(); ctx.fillStyle = kind === 'call' ? '#30c85e' : '#e5484d'; ctx.beginPath(); ctx.ellipse(3, -3, 10, 4, -0.75, 0, 7); ctx.fill(); }
  ctx.restore();
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = '#111'; ctx.font = '800 28px Montserrat'; ctx.fillText(title, x + 102, y + 46);
  const tw = ctx.measureText(title).width; heart(ctx, x + 102 + tw + 20, y + 38, 15, '#ff3b5c');
  ctx.font = '700 22px Montserrat'; ctx.fillStyle = '#555'; ctx.fillText(sub, x + 102, y + 80);
  ctx.textAlign = 'right'; ctx.font = '700 18px Montserrat'; ctx.fillStyle = '#999'; ctx.fillText('agora', x + w - 24, y + 36);
  ctx.globalAlpha = 1;
}
function card(lines, a, bg = '#000') {
  ctx.globalAlpha = a; ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
}
function bigText(parts, y, size, a, scale = 1) {
  // parts: [{t, hl}] on one line each
  ctx.save(); ctx.globalAlpha = a; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  parts.forEach((p, i) => {
    ctx.save(); ctx.translate(W / 2, y + i * size * 1.2); ctx.scale(scale, scale);
    ctx.font = p.hl ? `italic 700 ${size * 1.15}px Playfair` : `900 ${size}px Montserrat`;
    ctx.lineWidth = 8; ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.strokeText(p.t, 0, 0);
    ctx.fillStyle = p.hl ? '#f7c948' : (p.c || '#fff'); ctx.fillText(p.t, 0, 0); ctx.restore();
  });
  ctx.restore();
}
function hud(text, x, y, col, a = 1) {
  ctx.globalAlpha = a; ctx.font = '800 26px Montserrat'; const w = ctx.measureText(text).width + 36;
  ctx.fillStyle = 'rgba(10,10,20,0.6)'; ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(x, y, w, 50, 12); ctx.fill(); ctx.stroke();
  ctx.fillStyle = col; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(text, x + 18, y + 26); ctx.globalAlpha = 1;
}

function overlay(t, sc) {
  const id = sc.meta.id, lt = t - sc.meta.start, m = sc.m, L = sc.L;
  // vignette
  const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.75); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.35)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // scene-specific HUD
  if (id === 'space') {
    if (lt > 3.0) hud('OXIGÊNIO  3%', 48, 330, '#ff4040', Math.sin(lt * 8) > -0.3 ? 1 : 0.35);
    if (lt > m.temp) { const k = backOut(clamp((lt - m.temp) / 0.3)); ctx.save(); ctx.translate(48, 395); ctx.scale(k, k); hud('TEMP. EXTERNA  −270 °C', 0, 0, '#7fd4ff'); ctx.restore(); }
    banner('MÃE', 'chamando…', 0.05, m.answer, lt);
  }
  if (id === 'bomb') banner('MÃE', 'chamando…', m.ring, m.answer, lt);
  if (id === 'ufo') { banner('MÃE', 'chamando…', 0.05, L[0].s, lt); banner('MÃE', 'chamada interplanetária…', m.cockpit + 0.05, L[4].s, lt); }
  if (id === 'dragon') banner('MÃE', 'chamando…', m.ring, L[0].s, lt);
  if (id === 'shark') {
    banner('MÃE', 'chamando…', m.ring, L[0].s, lt);
    if (lt > m.beach + 0.25) { const k = backOut(clamp((lt - m.beach - 0.25) / 0.3)); ctx.save(); ctx.translate(W / 2, 360); ctx.scale(k, k); ctx.translate(-W / 2, -360); bigText([{ t: 'faltam 1h59', hl: true }], 360, 62, 1); ctx.restore(); }
  }
  if (id === 'dino') {
    banner('MÃE', 'chamando…', m.ring, m.audio - 0.05, lt);
    banner('3 chamadas perdidas', 'MÃE', m.audio - 0.0, m.audio + 0.7, lt, 'missed');
    banner('MÃE', 'enviou um áudio  ▶ 0:06', m.audio + 0.7, m.flee, lt, 'audio');
    if (lt > m.jungle && lt < m.jungle + 1.8) { const k = backOut(clamp((lt - m.jungle) / 0.25)); const a = 1 - clamp((lt - m.jungle - 1.5) / 0.3); bigText([{ t: '66 MILHÕES' }, { t: 'de anos atrás', hl: true }], 520, 64, a, 1.6 - 0.6 * k); }
    // big countdown numbers
    const cnt = [[L[3], '1… 2…'], [L[4], '2½'], [L[5], '3']];
    for (const [ln, s] of cnt) if (ln && lt > ln.s && lt < ln.e + 0.35) { const k = backOut(clamp((lt - ln.s) / 0.2)); bigText([{ t: s, c: s === '3' ? '#ff3b3b' : '#fff' }], 380, s === '3' ? 190 : 120, 1, k); }
    const mt = lt - m.meteor;
    if (mt > 1.75 && lt < m.extinct) { ctx.fillStyle = `rgba(255,250,240,${1 - clamp((mt - 1.75) / 1.0)})`; ctx.fillRect(0, 0, W, H); }
  }
  // captions
  if (!(id === 'dino' && (lt < m.jungle || (lt > m.extinct && lt < m.ash)))) {
    const act = L.filter(l => lt > l.s - 0.05 && lt < l.e + 0.22).pop();
    if (act) drawCaption({ ...act, start: act.s, end: act.e }, lt);
  }
  // chapter pill
  const hook = t < 3.0;
  if (!hook && !(id === 'dino' && (lt < m.jungle || lt > m.extinct))) pill(sc.meta.chapter, 112, 0.0, lt + (id === 'space' ? -3.0 : 0.3));
  // hook title
  if (hook) {
    const k = backOut(clamp(t / 0.35)); const a = 1 - clamp((t - 2.7) / 0.3);
    bigText([{ t: 'POR QUE VOCÊ' }, { t: 'DEVE SEMPRE' }, { t: 'atender a sua mãe', hl: true }], 330, 56, a, k);
  }
  // cards for dino
  if (id === 'dino') {
    if (lt < m.jungle) { card(null, 1); const k = easeOut(clamp(lt / 0.4)); bigText([{ t: 'E QUANDO' }, { t: 'ALGUÉM' }, { t: 'não atendeu…', hl: true }], H / 2 - 70, 64, k, 0.9 + 0.1 * k); }
    if (lt > m.extinct && lt < m.ash) { card(null, 1); const k = easeOut(clamp((lt - m.extinct) / 0.4)); bigText([{ t: 'E FOI ASSIM' }, { t: 'QUE OS' }, { t: 'DINOSSAUROS' }, { t: 'FORAM' }, { t: 'extintos.', hl: true }], H / 2 - 170, 62, k); }
    if (lt > m.final) {
      const k = easeOut(clamp((lt - m.final) / 0.4)); card(null, 0.55 * k);
      bigText([{ t: 'VOCÊ DESCENDE' }, { t: 'DE QUEM' }, { t: 'atendeu.', hl: true }], 330, 64, k);
      const k2 = backOut(clamp((lt - m.final - 0.5) / 0.3));
      if (k2 > 0) { ctx.save(); ctx.translate(W / 2, 1020); ctx.scale(k2, k2); ctx.font = '900 30px Montserrat'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; ctx.fillText('Marca quem nunca atende', 0, -50); ctx.fillStyle = '#f7c948'; ctx.beginPath(); ctx.roundRect(-150, -26, 300, 64, 18); ctx.fill(); ctx.fillStyle = '#111'; ctx.font = '900 40px Montserrat'; ctx.fillText('👇 MÃE', 0, 7); ctx.restore(); }
    }
  }
}

window.TOTAL = TL.total;
window.renderAt = (t) => {
  const s = TL.scenes.find(s => t >= s.start && t < s.end) || TL.scenes[TL.scenes.length - 1];
  const sc = SC[s.id]; const lt = t - s.start;
  const C = { m: sc.m, L: sc.L, amp: (who) => { const l = sc.L.find(l => l.who === who && lt >= l.s && lt < l.e); if (!l) return 0; return l.env[Math.min(l.env.length - 1, Math.floor((lt - l.s) * 30))] || 0; } };
  const r = sc.obj.update(lt, C);
  renderer.render(r.scene, r.cam);
  ctx.clearRect(0, 0, W, H); ctx.drawImage(renderer.domElement, 0, 0);
  overlay(t, sc);
  return out.toDataURL('image/jpeg', 0.93);
};
window.READY = true;
