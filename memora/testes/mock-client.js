// Simulação fiel da API window.claude (contrato 0.2.96) para testes: db, user, sample, assets, downloads, permissions.
// Instalada só na moldura do app (host memora.test). O estado da nuvem vive no Node e é compartilhado entre aparelhos.
(() => {
  if (location.hostname !== "memora.test" || window.__noClaude) return;
  const call = (op, args) => window.__cloud(op, args || {});
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const subs = new Map(); let nextSub = 1;
  window.__cloudDeliver = (id, payload) => { const s = subs.get(id); if (s) s(payload); };
  const deepFreeze = o => { if (o && typeof o === "object" && !Object.isFrozen(o)) { Object.freeze(o); Object.values(o).forEach(deepFreeze); } return o; };
  const checkSeg = s => { if (!s || s === "." || s === ".." || !/^[A-Za-z0-9_\-.~:@+]+$/.test(s) || s.length > 200) throw new TypeError("segmento inválido: " + JSON.stringify(s)); };
  const validDoc = p => { const g = String(p).split("/"); if (g.length % 2 !== 0) throw new TypeError("documento precisa de número par de segmentos: " + p); g.forEach(checkSeg); };
  const validCol = p => { const g = String(p).split("/"); if (g.length % 2 !== 1) throw new TypeError("coleção precisa de número ímpar de segmentos: " + p); g.forEach(checkSeg); };
  const rej = r => { if (r && r.error) throw r.error; return r; };
  const docSnap = (id, data, md) => ({ id, exists: data != null, data: () => (data == null ? undefined : data), metadata: md });
  function docRef(path) {
    validDoc(path);
    const id = path.split("/").pop();
    return {
      id, path,
      async get() { const r = rej(await call("get", { path })); return docSnap(id, r.data == null ? null : deepFreeze(r.data), { fromCache: false, hasPendingWrites: false }); },
      async set(data) { if (data === null || typeof data !== "object" || Array.isArray(data)) throw { code: "invalid_argument", message: "corpo precisa ser objeto" }; rej(await call("set", { path, data: JSON.parse(JSON.stringify(data)) })); },
      async update(data) { rej(await call("update", { path, data: JSON.parse(JSON.stringify(data)) })); },
      async delete() { rej(await call("delete", { path })); },
      onSnapshot() { throw new Error("não usado nos testes"); },
      collection(sub) { return colRef(path + "/" + sub); },
      async acquire() { return { acquired: true }; }
    };
  }
  function query(path, filters, order, lim) {
    return {
      where(f, op, v) { return query(path, [...filters, [f, op, v]], order, lim); },
      orderBy(f, d) { return query(path, filters, [f, d || "asc"], lim); },
      limit(n) { if (!(n >= 1 && n <= 1000)) throw { code: "invalid_argument" }; return query(path, filters, order, n); },
      async get() {
        const r = rej(await call("query", { path, filters, order, lim }));
        const docs = r.docs.map(d => docSnap(d.id, deepFreeze(d.data), { fromCache: false, hasPendingWrites: false }));
        return { docs, size: docs.length, empty: !docs.length, docChanges: () => docs.map((d, i) => ({ type: "added", doc: d, oldIndex: -1, newIndex: i })), metadata: { fromCache: false, hasPendingWrites: false } };
      },
      onSnapshot(next, err) {
        const id = nextSub++; let prev = new Map();
        subs.set(id, payload => {
          if (payload.error) { subs.delete(id); if (err) err(payload.error); return; }
          const cur = new Map(); const changes = []; const docs = [];
          payload.docs.forEach((d, i) => {
            const old = prev.get(d.id); let snap;
            if (old && old.ver === d.ver && old.pw === !!d.pw && old.fc === !!payload.fromCache) snap = old.snap;
            else snap = docSnap(d.id, deepFreeze(d.data), { fromCache: !!payload.fromCache, hasPendingWrites: !!d.pw });
            docs.push(snap); cur.set(d.id, { ver: d.ver, pw: !!d.pw, fc: !!payload.fromCache, snap });
            if (!old) changes.push({ type: "added", doc: snap, oldIndex: -1, newIndex: i });
            else if (old.snap !== snap) changes.push({ type: "modified", doc: snap, oldIndex: i, newIndex: i });
          });
          for (const [did, old] of prev) if (!cur.has(did)) changes.push({ type: "removed", doc: old.snap, oldIndex: 0, newIndex: -1 });
          prev = cur;
          try { next({ docs, size: docs.length, empty: !docs.length, docChanges: () => changes, metadata: { fromCache: !!payload.fromCache, hasPendingWrites: payload.docs.some(d => d.pw) } }); }
          catch (e) { console.error("erro no onSnapshot", e); }
        });
        call("listen", { id, path, filters, order, lim });
        return () => { subs.delete(id); call("unlisten", { id }); };
      }
    };
  }
  function colRef(path) { validCol(path); const q = query(path, [], null, null); return Object.assign(q, { path, doc(id) { return docRef(path + "/" + (id || Math.random().toString(36).slice(2))); }, async add(data) { const r = docRef(path + "/" + Math.random().toString(36).slice(2)); await r.set(data); return r; } }); }
  const db = Object.freeze({ doc: docRef, collection: colRef });
  const user = Object.freeze({ id: async () => window.__uid || "u-aluno", isOwner: () => true, canEdit: () => true, can: () => true, me: async () => ({ id: window.__uid || "u-aluno", name: "", isMe: true }), profiles: async () => ({}) });
  const blobInfo = async b => ({ type: b.type, size: b.size });
  const imgsOf = async opts => { const l = opts && opts.images ? (Array.isArray(opts.images) ? opts.images : [opts.images]) : []; return Promise.all(l.map(blobInfo)); };
  const limits = () => window.__aiLimits !== undefined ? window.__aiLimits : { maxPromptBytes: 262144, images: { maxCount: 20, maxInputBytes: 5 * 1048576, mediaTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"] } };
  async function checkImgs(opts) {
    const l = await imgsOf(opts); const lim = limits();
    if (l.length && !lim.images) throw { code: "images_unavailable", message: "imagens não declaradas" };
    if (lim.images) { if (l.length > lim.images.maxCount) throw { code: "invalid_request" }; for (const i of l) if (!lim.images.mediaTypes.includes(i.type) || i.size > lim.images.maxInputBytes) throw { code: "image_rejected", message: i.type + " " + i.size }; }
    return l;
  }
  const promptOf = input => typeof input === "string" ? input : JSON.stringify(input);
  const sample = async (input, opts = {}) => {
    const images = await checkImgs(opts);
    if (opts.signal && opts.signal.aborted) throw { code: "cancelled" };
    const r = rej(await call("ai", { kind: "text", prompt: promptOf(input), images, tier: opts.modelTier }));
    if (opts.onText) { const w = r.text.split(" "); let acc = ""; for (const x of w.slice(0, 6)) { acc += x + " "; opts.onText({ text: acc, delta: x }); await sleep(5); } opts.onText({ text: r.text, delta: "" }); }
    if (opts.signal && opts.signal.aborted) throw { code: "cancelled" };
    return { text: r.text, truncated: false };
  };
  sample.json = async (input, opts = {}) => {
    const images = await checkImgs(opts);
    if (opts.signal && opts.signal.aborted) throw { code: "cancelled" };
    const r = rej(await call("ai", { kind: "json", prompt: promptOf(input), images, tier: opts.modelTier }));
    if (opts.onText) opts.onText({ text: JSON.stringify(r.json).slice(0, 400), delta: "" });
    await sleep(r.delay || 0);
    if (opts.signal && opts.signal.aborted) throw { code: "cancelled" };
    return r.json;
  };
  sample.limits = async () => limits();
  const toB64 = b => new Promise((res, rj) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(",")[1] || ""); fr.onerror = rj; fr.readAsDataURL(b); });
  const assets = Object.freeze({
    async upload(blob, o = {}) { const type = o.type || blob.type; const r = rej(await call("upload", { b64: await toB64(blob), type, size: blob.size })); return r; },
    async list() { return rej(await call("alist", {})); },
    async delete(ref) { return rej(await call("adelete", { id: String(ref).replace(/^.*\/_blob\//, "") })); }
  });
  const downloads = Object.freeze({ async save(req) { const data = typeof req.data === "string" ? req.data : ""; return rej(await call("download", { filename: req.filename, size: data.length, head: data.slice(0, 200) })); } });
  const permissions = Object.freeze({
    async state(n) { const p = window.__perm || {}; if (n === undefined) return { db: "granted", user: "granted", sample: "granted", assets: p.assets || "granted", downloads: "granted" }; return p[n] || "granted"; },
    async request(names) { const out = {}; (names || []).forEach(n => { out[n] = "granted"; (window.__perm = window.__perm || {})[n] = "granted"; }); return out; },
    async manage() { call("event", { name: "permissions.manage" }); }
  });
  window.addEventListener("error", e => call("event", { name: "error", msg: String(e.message || e.error) }));
  window.addEventListener("unhandledrejection", e => call("event", { name: "error", msg: "promessa rejeitada: " + (e.reason && (e.reason.message || e.reason.code) || String(e.reason)) }));
  const NS = { db, user, sample, assets, downloads, permissions };
  window.claude = Object.freeze({ use: async name => { await sleep(20); if (window.__deny && window.__deny.includes(name)) return null; return NS[name] || null; } });
})();
