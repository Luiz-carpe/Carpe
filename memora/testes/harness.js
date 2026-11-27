// Nuvem simulada (Node) + utilitários para abrir o Memora como no claude.ai (dentro de moldura) em vários aparelhos.
const fs = require("fs");
const path = require("path");
const { chromium, devices } = require("playwright");
const DIR = __dirname;
const APP = path.join(DIR, "..", "index.html");
const MOCK = fs.readFileSync(path.join(DIR, "mock-client.js"), "utf8");
const PDFJS = path.join(DIR, "node_modules", "pdfjs-dist", "build");
const sleep = ms => new Promise(r => setTimeout(r, ms));
const isPlain = v => v !== null && typeof v === "object" && !Array.isArray(v);
const clone = v => JSON.parse(JSON.stringify(v));
const DOC_MAX = 256 * 1024;

class Cloud {
  constructor() {
    this.docs = new Map(); this.ver = 0; this.listeners = new Map(); this.offline = new Set(); this.assets = new Map();
    this.aiCalls = []; this.downloads = []; this.events = []; this.writes = 0; this.maxDocs = 25000; this.fail = []; this.latency = 25;
    this.ai = defaultAI;
  }
  colOf(p) { return p.split("/").slice(0, -1).join("/"); }
  size(o) { return Buffer.byteLength(JSON.stringify(o), "utf8"); }
  inject(op, code, times = 1, match) { this.fail.push({ op, code, times, match }); }
  takeFail(op, p) { const f = this.fail.find(x => x.op === op && x.times > 0 && (!x.match || p.includes(x.match))); if (f) { f.times--; return { code: f.code, message: "injetado" }; } return null; }
  async handle(src, op, a) {
    const key = src.page; const off = this.offline.has(key);
    await sleep(this.latency);
    if (off && !["listen", "unlisten", "event"].includes(op)) return { error: { code: "unavailable", message: "offline" } };
    const f = this.takeFail(op, a.path || a.prompt || ""); if (f) return { error: f };
    switch (op) {
      case "get": return { data: this.docs.has(a.path) ? clone(this.docs.get(a.path).data) : null };
      case "set": return this.write(src, a.path, () => clone(a.data));
      case "update": {
        if (!this.docs.has(a.path)) return { error: { code: "invalid_argument", message: "update em documento inexistente" } };
        return this.write(src, a.path, () => mergeDeep(clone(this.docs.get(a.path).data), a.data));
      }
      case "delete": { if (this.docs.delete(a.path)) this.broadcast(this.colOf(a.path), src); return {}; }
      case "query": return { docs: this.match(a) };
      case "listen": { this.listeners.set(key + "#" + a.id, { src, ...a, key }); if (!off) setTimeout(() => this.deliver(this.listeners.get(key + "#" + a.id)), this.latency); return {}; }
      case "unlisten": { this.listeners.delete(key + "#" + a.id); return {}; }
      case "upload": {
        const types = ["image/png", "image/jpeg", "image/gif", "image/webp", "application/pdf", "application/json", "text/plain", "text/csv", "text/markdown"];
        if (!types.includes(a.type)) return { error: { code: "unsupported_type" } };
        const buf = Buffer.from(a.b64, "base64"); if (buf.length > 20 * 1048576) return { error: { code: "too_large" } };
        const id = "a" + Math.random().toString(16).slice(2) + Date.now().toString(16); this.assets.set(id, { buf, type: a.type, at: Date.now() });
        return { id, url: "/_blob/" + id, sizeBytes: buf.length, contentType: a.type };
      }
      case "alist": return { assets: [...this.assets].map(([id, x]) => ({ id, url: "/_blob/" + id, sizeBytes: x.buf.length, contentType: x.type })), usage: {} };
      case "adelete": return { deleted: this.assets.delete(a.id) };
      case "download": this.downloads.push(a); return {};
      case "event": this.events.push(a); return {};
      case "ai": { this.aiCalls.push({ kind: a.kind, prompt: a.prompt, images: a.images, tier: a.tier, page: key }); return this.ai(a, this); }
    }
    return { error: { code: "invalid_argument", message: "op desconhecida " + op } };
  }
  write(src, p, make) {
    const exists = this.docs.has(p);
    if (!exists && this.docs.size >= this.maxDocs) return { error: { code: "quota_exceeded", message: "documents in this artifact's database" } };
    const data = make();
    if (this.size(data) > DOC_MAX) return { error: { code: "invalid_argument", message: "a document over 256 KiB" } };
    this.docs.set(p, { data, ver: ++this.ver }); this.writes++;
    this.broadcast(this.colOf(p), src, p);
    return {};
  }
  match(a) {
    let out = [];
    for (const [p, d] of this.docs) if (this.colOf(p) === a.path) out.push({ id: p.split("/").pop(), data: clone(d.data), ver: d.ver });
    for (const [f, op, v] of a.filters || []) out = out.filter(d => { const x = d.data[f]; return op === ">" ? x > v : op === ">=" ? x >= v : op === "<" ? x < v : op === "<=" ? x <= v : op === "==" ? x === v : op === "!=" ? x !== v : true; });
    if (a.order) { const [f, dir] = a.order; out.sort((x, y) => (x.data[f] > y.data[f] ? 1 : -1) * (dir === "desc" ? -1 : 1)); } else out.sort((x, y) => x.id < y.id ? -1 : 1);
    if (a.lim) out = out.slice(0, a.lim);
    return out;
  }
  async deliver(l, pendingDoc) {
    if (!l || this.offline.has(l.key)) return;
    const docs = this.match(l).map(d => ({ ...d, pw: pendingDoc && d.id === pendingDoc.split("/").pop() }));
    try { await l.src.frame.evaluate(([id, payload]) => window.__cloudDeliver && window.__cloudDeliver(id, payload), [l.id, { docs, fromCache: false }]); } catch {}
  }
  broadcast(col, src, p) {
    for (const l of this.listeners.values()) {
      if (l.path !== col) continue;
      if (src && l.key === src.page && p) { this.deliver(l, p); setTimeout(() => this.deliver(l), 40); }
      else setTimeout(() => this.deliver(l), 60);
    }
  }
  setOffline(key, off) { if (off) this.offline.add(key); else { this.offline.delete(key); for (const l of this.listeners.values()) if (l.key === key) this.deliver(l); } }
  userDocs(uid = "u-aluno") { const pre = "data/users/" + uid + "/v2/b/"; return [...this.docs].filter(([p]) => p.startsWith(pre)).map(([p, d]) => ({ id: p.slice(pre.length), data: d.data, size: this.size(d.data) })); }
  items(kind, uid) { const out = {}; for (const d of this.userDocs(uid)) if (d.id.split(".")[0] === kind) for (const [id, it] of Object.entries(d.data.i || {})) { if (!it || it._m) continue; if (!out[id] || (it._u || 0) > (out[id]._u || 0)) out[id] = it; } return out; }
  live(kind, uid) { return Object.entries(this.items(kind, uid)).filter(([, v]) => !v._d).map(([id, v]) => ({ id, ...v })); }
}
function mergeDeep(t, s) { for (const [k, v] of Object.entries(s)) { if (isPlain(v) && isPlain(t[k])) mergeDeep(t[k], v); else t[k] = clone(v); } return t; }

function defaultAI(a, cloud) {
  const p = a.prompt;
  if (/Memora IA, especialista em criar flashcards/.test(p)) {
    const n = Math.min(80, +(p.match(/exatamente (\d+) flashcards/) || [])[1] || 5);
    return { json: { deckName: (cloud && cloud.deckName) || "Equilíbrio iônico", subject: (cloud && cloud.deckSubject) || "Química", cards: Array.from({ length: n }, (_, i) => ({ front: `Pergunta gerada ${i + 1}: o que é Ka?`, back: `Resposta ${i + 1}: constante de acidez.`, tags: ["equilíbrio"] })) }, delay: (cloud && cloud.cardDelay) || 0 };
  }
  if (/planejador de estudos/.test(p)) return { json: { resumo: "Mais tempo para Química, que tem prova perto.", blocos: [{ day: 0, start: "14:00", end: "15:30", subject: "Química", title: "Exercícios de equilíbrio" }, { day: 2, start: "19:00", end: "20:00", subject: "Biologia", title: "Revisão de genética" }, { day: 9, start: "10:00", end: "11:00", subject: "X", title: "inválido" }] } };
  if (/professor coordenador de cursinho/.test(p)) return { json: { resumo: "Bom desempenho geral; foco em estequiometria.", fortes: ["Biologia"], conteudos: [{ materia: "Química", conteudo: "Estequiometria — rendimento", questoes: [1, 5], prioridade: "alta", porque: "Errou cálculo de rendimento", dica: "Monte a regra de três com mols" }, { materia: "Física", conteudo: "Cinemática — MUV", questoes: [9], prioridade: "media", porque: "Confundiu fórmulas", dica: "Use Torricelli" }], plano: ["Revisar estequiometria", "Fazer 20 questões de MUV"], questoes: [{ n: 9, materia: "Física", conteudo: "MUV" }, { n: 13, materia: "Física", conteudo: "Queda livre" }] } };
  if (/vai planejar um SIMULADO INÉDITO/.test(p)) {
    const areas = [...p.matchAll(/^- (.+): (\d+) questões$/gm)].map(m => [m[1], +m[2]]);
    const plano = []; areas.forEach(([d, n]) => { for (let i = 0; i < n; i++) plano.push({ disciplina: d, conteudo: `${d} — tópico ${i + 1}`, habilidade: "aplicar o conceito", dificuldade: ["facil", "media", "dificil"][i % 3] }); });
    return { json: { titulo: "Simulado inédito de teste", estilo: "Enunciados objetivos com texto-base curto.", plano }, delay: 0 };
  }
  if (/Escreva as questões .* do simulado inédito/.test(p)) {
    const lista = JSON.parse((p.match(/Questões a escrever: (.*)$/m) || [])[1] || "[]");
    const alts = +(p.match(/exatamente (\d) alternativas/) || [])[1] || 5; const L = "ABCDE".slice(0, alts).split("");
    const longo = /ENEM/.test(p);
    return { json: { questoes: lista.map(q => ({ n: q.n, texto: longo ? `Texto-base da questão ${q.n}. ` + "Situação do cotidiano descrita com dados e contexto para a leitura do estudante. ".repeat(14) : "", enunciado: `(${q.disciplina}) Enunciado inédito da questão ${q.n} sobre ${q.conteudo}. Assinale a alternativa correta.`, alternativas: L.map(l => `${l === q.correta ? "Resposta certa" : "Distrator"} ${l} da questão ${q.n}` + (longo ? " com uma explicação um pouco mais longa para ficar parecida com a prova real" : "")), gabarito: q.correta, resolucao: `A correta é a ${q.correta} porque aplica o conceito pedido. As outras confundem a definição.` + (longo ? " Detalhes adicionais da resolução para o estudante revisar depois.".repeat(5) : "") })) }, delay: cloud.genDelay || 0 };
  }
  if (/proposta de redação INÉDITA/.test(p)) return { json: { tema: "Os desafios do acesso à leitura no Brasil", genero: "Texto dissertativo-argumentativo", instrucoes: "Escreva de 7 a 30 linhas. Fuga ao tema leva nota zero.", textos: ["Texto motivador um, escrito para o simulado.", "Texto motivador dois.", "Texto motivador três."] } };
  if (/Você organiza flashcards/.test(p)) {
    const list = JSON.parse((p.match(/^Cartões \(n, frente, etiquetas\): (.*)$/m) || [])[1] || "[]");
    const only = /Use SOMENTE as subpastas/.test(p);
    const pick = f => /mitose|meiose|ribossomo|mitoc/i.test(f) ? "Citologia" : /DNA|gene|alelo/i.test(f) ? "Genética" : /fotoss|xilema|floema/i.test(f) ? "Botânica" : /cadeia|bioma|popula/i.test(f) ? "Ecologia" : /Massa (\d+)/.test(f) ? "Grupo " + (+f.match(/Massa (\d+)/)[1] % 3) : "";
    return { json: { cartoes: list.map(c => ({ n: c.n, subpasta: only && !/Botânica|Citologia/.test(pick(c.f)) ? "" : pick(c.f) })) }, delay: (cloud && cloud.orgDelay) || 0 };
  }
  if (/Crie UM flashcard de revisão/.test(p)) return { json: { front: "Como calcular rendimento?", back: "Rendimento = real / teórico × 100%" } };
  if (/Explique de forma clara/.test(p)) return { text: "Ka mede a força de um ácido. Exemplo: ácido acético. Pegadinha: Ka alto = ácido forte." };
  if (/resolução caprichada/.test(p)) return { text: "O QUE A QUESTÃO PEDE: calcular o rendimento.\nRESOLUÇÃO PASSO A PASSO: ...\nPEGADINHA E COMO EVITAR: unidades." };
  return { text: "ok" };
}

const HOST = `<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><title>claude.ai</title>
<style>html,body{margin:0;height:100%;background:#111}iframe{border:0;width:100%;height:100%;display:block}</style></head>
<body><iframe id="app" src="https://memora.test/app.html" sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-downloads" allow="clipboard-write"></iframe></body></html>`;

async function openDevice(browser, cloud, opts = {}) {
  const { device = "desktop", name = device, noClaude = false, init = "", uid } = opts;
  const presets = {
    desktop: { viewport: { width: 1366, height: 900 } },
    ipad: { ...devices["iPad Pro 11"] },
    ipadLand: { ...devices["iPad Pro 11 landscape"] },
    ipadMini: { ...devices["iPad Mini"] },
    ipadSplit: { ...devices["iPad Pro 11"], viewport: { width: 375, height: 1194 } },
    phone: { ...devices["iPhone 13"] }
  };
  const ctxOpts = { ...presets[device] }; delete ctxOpts.defaultBrowserType;
  if (ctxOpts.deviceScaleFactor) ctxOpts.deviceScaleFactor = 1;
  const context = await browser.newContext(ctxOpts);
  context.__name = name;
  await context.route("https://claude.test/**", r => r.fulfill({ contentType: "text/html", body: HOST }));
  await context.route("https://memora.test/**", async r => {
    const u = new URL(r.request().url());
    if (u.pathname.startsWith("/_blob/")) { const a = cloud.assets.get(u.pathname.slice(7)); return a ? r.fulfill({ contentType: a.type, body: a.buf }) : r.fulfill({ status: 404, body: "" }); }
    return r.fulfill({ contentType: "text/html; charset=utf-8", body: fs.readFileSync(APP, "utf8") });
  });
  await context.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ contentType: "text/css", body: "" }));
  await context.route(/cdnjs\.cloudflare\.com\/ajax\/libs\/pdf\.js\/3\.11\.174\/(pdf(\.worker)?\.min\.js)/, r => { const f = r.request().url().split("/").pop(); return r.fulfill({ contentType: "application/javascript", body: fs.readFileSync(path.join(PDFJS, f)) }); });
  const errors = [];
  context.on("weberror", e => errors.push("pageerror: " + e.error().message));
  await context.exposeBinding("__cloud", (source, op, args) => cloud.handle({ page: name, frame: source.frame }, op, args));
  await context.addInitScript({ content: `${noClaude ? "window.__noClaude = true;" : ""}${uid ? `window.__uid = ${JSON.stringify(uid)};` : ""}${init}\n` + MOCK });
  const page = await context.newPage();
  page.on("console", m => { if (m.type() === "error") errors.push("console: " + m.text()); });
  await page.goto("https://claude.test/artifact/memora");
  const frame = await waitFrame(page);
  const dev = { name, device, context, page, frame, errors, cloud, app: page.frameLocator("#app") };
  await frame.waitForFunction(() => document.querySelector("#view") && !/Carregando seus dados/.test(document.querySelector("#view").textContent), null, { timeout: 15000 });
  return dev;
}
async function waitFrame(page) {
  for (let i = 0; i < 100; i++) { const f = page.frames().find(f => f.url().startsWith("https://memora.test/")); if (f) { await f.waitForLoadState("domcontentloaded"); return f; } await sleep(50); }
  throw new Error("moldura do app não carregou");
}
async function reload(dev) { await dev.page.reload(); dev.frame = await waitFrame(dev.page); dev.app = dev.page.frameLocator("#app"); await dev.frame.waitForFunction(() => document.querySelector("#view") && !/Carregando seus dados/.test(document.querySelector("#view").textContent), null, { timeout: 15000 }); }
const ev = (dev, fn, arg) => dev.frame.evaluate(fn, arg);
async function cloudReady(dev, timeout = 10000) { await dev.frame.waitForFunction(() => Cloud.ready && !Cloud.busy && pendingCount() === 0, null, { timeout }); }
async function settle(devs, timeout = 15000) { const t0 = Date.now(); for (;;) { let ok = true; for (const d of devs) { const r = await d.frame.evaluate(() => !Cloud.ready || (!Cloud.busy && pendingCount() === 0)).catch(() => false); if (!r) ok = false; } if (ok) { await sleep(250); return true; } if (Date.now() - t0 > timeout) return false; await sleep(150); } }

// asserções que não param o teste: juntam todas as falhas para o relatório
const R = { pass: 0, fail: [], section: "" };
function section(s) { R.section = s; console.log("\n## " + s); }
function ok(cond, msg) { if (cond) { R.pass++; console.log("  ✓ " + msg); } else { R.fail.push(R.section + " :: " + msg); console.log("  ✗ " + msg); } return !!cond; }
async function step(msg, fn) { try { await fn(); } catch (e) { if (R.dev) { try { const f = require("path").join(__dirname, "shots", "falha-" + R.fail.length + ".png"); await R.dev.page.screenshot({ path: f }); console.log("    captura: " + f); const st = await R.dev.frame.evaluate(() => ({ route, ov: [...document.querySelectorAll(".ov")].map(o => o.textContent.slice(0, 120)), toast: document.querySelector(".toast")?.textContent })); console.log("    estado:", JSON.stringify(st)); await R.dev.frame.evaluate(() => document.querySelectorAll(".ov").forEach(o => o.remove())); } catch {} } R.fail.push(R.section + " :: " + msg + " — EXCEÇÃO: " + (e && e.message || e).toString().split("\n")[0]); console.log("  ✗ " + msg + " — " + (e && e.message || e).toString().split("\n")[0]); } }
module.exports = { Cloud, openDevice, reload, ev, cloudReady, settle, sleep, R, ok, section, step, chromium, devices, APP };
