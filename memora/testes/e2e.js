// Bateria completa: node e2e.js [web|ipad|sync|limits|migra|extra|gerar|cartoes|pastas|organizar|all|ano]
const fs = require("fs"); const path = require("path");
const H = require("./harness"); const { Cloud, openDevice, reload, ev, cloudReady, settle, sleep, R, ok, section, step } = H;
const { walkthrough, U } = require("./walkthrough");
const SHOTS = path.join(__dirname, "shots"); fs.mkdirSync(SHOTS, { recursive: true });

async function makeFiles(browser) {
  const p = await browser.newPage({ viewport: { width: 900, height: 700 } });
  await p.setContent(`<div style="font:28px sans-serif;padding:40px;background:linear-gradient(45deg,#f0a948,#6aa7ff)"><h1>Questão 2</h1><p>Calcule o rendimento da reação 2H2 + O2 → 2H2O.</p>${"<p>texto de exemplo para a foto.</p>".repeat(8)}</div>`);
  const png = await p.screenshot();
  await p.setContent(`<h1>Apostila de Química</h1><p>Equilíbrio iônico: Ka × Kb = Kw. A equação de Henderson-Hasselbalch relaciona pH e pKa.</p>${"<p>Exercícios de fixação sobre equilíbrio ácido-base, hidrólise salina e solução-tampão.</p>".repeat(12)}`);
  const pdf = await p.pdf({ format: "A4" });
  await p.close();
  const w = 4, h = 4, row = w * 3, size = 54 + row * h; const bmp = Buffer.alloc(size);
  bmp.write("BM", 0); bmp.writeUInt32LE(size, 2); bmp.writeUInt32LE(54, 10); bmp.writeUInt32LE(40, 14); bmp.writeInt32LE(w, 18); bmp.writeInt32LE(h, 22); bmp.writeUInt16LE(1, 26); bmp.writeUInt16LE(24, 28); bmp.writeUInt32LE(row * h, 34);
  for (let i = 54; i < size; i += 3) { bmp[i] = 200; bmp[i + 1] = 120; bmp[i + 2] = 40; }
  return { png, pdf, bmp };
}
const errorsOf = (dev, cloud) => [...dev.errors, ...cloud.events.filter(e => e.name === "error").map(e => e.msg)].filter(e => !/favicon|net::ERR/.test(e));
async function shotAll(dev, prefix) {
  const u = U(dev); const over = [];
  for (const r of ["painel", "pendencias", "tempo", "provas", "horarios", "simulados", "erros", "flashcards", "ia", "estatisticas", "dados"]) {
    await ev(dev, r => { studyState = null; simOpen = null; simFolder = null; fcDeck = null; go(r); }, r); await sleep(250);
    const o = await ev(dev, () => document.documentElement.scrollWidth - innerWidth); if (o > 0) over.push(r + ":" + o);
    await dev.page.screenshot({ path: path.join(SHOTS, `${prefix}-${r}.png`) });
  }
  return over;
}

async function scenarioWeb(browser, files) {
  const cloud = new Cloud();
  const A = await openDevice(browser, cloud, { device: "desktop", name: "pc" });
  await cloudReady(A);
  await walkthrough(A, files);
  section("[pc] dados continuam depois de recarregar e aparecem num aparelho novo");
  const snap = d => ev(d, () => ({ t: S.tasks.length, s: S.sessions.length, e: S.exams.length, a: S.agenda.length, d: S.decks.length, c: liveCards().length, sim: liveSims().length, err: S.errors.length, subj: subjects().length, rev: Object.values(S.revlog).reduce((a, r) => a + r.n, 0), res: Object.values(SIMS).reduce((a, s) => a + s.q.filter(x => x.res).length, 0), essay: Object.values(SIMS).filter(s => s.essay).length, goal: S.settings.goalMin }));
  const before = await snap(A);
  await reload(A); await cloudReady(A);
  ok(JSON.stringify(await snap(A)) === JSON.stringify(before), "recarregar a página: tudo igual " + JSON.stringify(before));
  const B = await openDevice(browser, cloud, { device: "desktop", name: "pc2" });
  await cloudReady(B);
  ok(JSON.stringify(await snap(B)) === JSON.stringify(before), "aparelho novo com a mesma conta recebe tudo da nuvem");
  const big = cloud.userDocs().reduce((m, d) => Math.max(m, d.size), 0);
  ok(big < 230 * 1024, `maior bloco na nuvem: ${Math.round(big / 1024)} KB (limite 256 KB)`);
  ok(errorsOf(A, cloud).length === 0 && errorsOf(B, cloud).length === 0, "nenhum erro no console: " + JSON.stringify(errorsOf(A, cloud).concat(errorsOf(B, cloud)).slice(0, 5)));
  const over = await shotAll(A, "web"); ok(!over.length, "sem rolagem lateral na web: " + over.join(" "));
  await A.context.close(); await B.context.close();
}

async function scenarioIpad(browser, files) {
  const cloud = new Cloud();
  const P = await openDevice(browser, cloud, { device: "ipad", name: "ipad" });
  P.touch = true;
  // app da tela de início: tela cheia com áreas seguras (notch/barra de início)
  let safe = false; try { const cdp = await P.context.newCDPSession(P.page); await cdp.send("Emulation.setSafeAreaInsetsOverride", { insets: { top: 24, bottom: 20, left: 0, right: 0 } }); safe = true; } catch {}
  await cloudReady(P);
  section("[ipad] aparência de app no iPad");
  const m = await ev(P, () => ({ coarse: matchMedia("(pointer: coarse)").matches, rail: getComputedStyle(document.querySelector(".rail")).position, icon: document.querySelector(".icon-btn") ? 0 : -1, font: getComputedStyle(document.createElement("input")).fontSize }));
  ok(m.coarse, "iPad detectado como tela de toque");
  ok(m.rail === "sticky", "no iPad em pé (834 px) a barra lateral fica visível");
  await walkthrough(P, files);
  section("[ipad] alvos de toque e campos");
  await ev(P, () => go("pendencias"));
  const tgt = await ev(P, () => { const b = document.querySelector("[data-task] .icon-btn"); const r = b.getBoundingClientRect(); const i = document.querySelector("#tText"); return { w: r.width, h: r.height, fs: parseFloat(getComputedStyle(i).fontSize) }; });
  ok(tgt.w >= 40 && tgt.h >= 40, `botões de ícone com ${Math.round(tgt.w)}×${Math.round(tgt.h)} px (mínimo 40)`);
  ok(tgt.fs >= 16, "campos com fonte 16 px (o iPad/iPhone não dá zoom ao digitar)");
  if (safe) { const pad = await ev(P, () => getComputedStyle(document.documentElement).paddingTop); ok(pad === "24px", "respeita a área segura do topo no modo tela cheia (" + pad + ")"); }
  ok(errorsOf(P, cloud).length === 0, "nenhum erro no console do iPad: " + JSON.stringify(errorsOf(P, cloud).slice(0, 5)));
  const over = await shotAll(P, "ipad"); ok(!over.length, "sem rolagem lateral no iPad em pé: " + over.join(" "));
  await P.context.close();
  for (const [dv, name] of [["ipadLand", "ipad-deitado"], ["ipadSplit", "ipad-tela-dividida"], ["phone", "celular"]]) {
    const D = await openDevice(browser, cloud, { device: dv, name }); D.touch = true;
    await cloudReady(D);
    section(`[${name}] layout`);
    const o = await shotAll(D, name); ok(!o.length, `sem rolagem lateral (${name}): ` + o.join(" "));
    if (dv !== "ipadLand") {
      const nav = await ev(D, () => ({ pos: getComputedStyle(document.querySelector(".rail")).position, vis: [...document.querySelectorAll("#nav a, #nav .more")].filter(a => getComputedStyle(a).display !== "none").map(a => a.textContent.trim()) }));
      ok(nav.pos === "fixed" && nav.vis.length === 5, "barra inferior com 4 abas + Mais: " + nav.vis.join(" | "));
      const u = U(D); await u.go("dados"); ok(await ev(D, () => route === "dados"), "menu Mais leva para Dados");
      await u.go("simulados"); ok(await ev(D, () => document.querySelector("#moreBtn").textContent.includes("Simulados")), "botão Mais mostra a seção atual");
    }
    ok(errorsOf(D, cloud).length === 0, "sem erros: " + JSON.stringify(errorsOf(D, cloud).slice(0, 3)));
    await D.context.close();
  }
}

async function scenarioSync(browser) {
  const cloud = new Cloud();
  const A = await openDevice(browser, cloud, { device: "desktop", name: "pc" });
  const B = await openDevice(browser, cloud, { device: "ipad", name: "ipad" }); B.touch = true;
  await cloudReady(A); await cloudReady(B);
  const ua = U(A), ub = U(B);
  section("Dois aparelhos: o cenário que apagava dados (bug 1)");
  await ev(A, () => go("pendencias")); await ev(B, () => go("pendencias"));
  await ua.fill("#tText", "Tarefa criada no PC"); await ua.tap("#taskForm [data-submit]");
  await ub.fill("#tText", "Tarefa criada no iPad"); await ub.tap("#taskForm [data-submit]");
  await settle([A, B]);
  const idA = await ev(A, () => S.tasks.find(t => t.text === "Tarefa criada no PC").id);
  await ua.tap(`[data-task="${idA}"] [data-act="toggle"]`);
  await settle([A, B]); await sleep(400);
  ok(cloud.live("task").length === 2, "nuvem mantém as 2 tarefas depois do PC marcar a dele");
  ok(await ev(B, () => S.tasks.length === 2 && S.tasks.find(t => t.text === "Tarefa criada no PC").status === "doing"), "iPad recebeu a mudança do PC em tempo real, sem recarregar");
  ok(await ev(A, () => S.tasks.some(t => t.text === "Tarefa criada no iPad")), "PC recebeu a tarefa do iPad em tempo real");

  section("Edições simultâneas no MESMO item são juntadas");
  await ev(A, () => go("provas"));
  await ua.fill("#exName", "ENEM"); await ua.fill("#exDate", new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10)); await ua.tap("#exForm [data-submit]");
  await settle([A, B]);
  const ex = await ev(A, () => S.exams[0].id);
  cloud.setOffline("pc", true);
  await ev(A, id => { S.exams.find(e => e.id === id).tasks.push({ id: "tA", text: "Tarefa do PC", done: false }); commit("exams"); }, ex);
  await ev(B, id => { S.exams.find(e => e.id === id).tasks.push({ id: "tB", text: "Tarefa do iPad", done: false }); S.exams.find(e => e.id === id).note = "Nota do iPad"; commit("exams"); }, ex);
  await settle([B]);
  cloud.setOffline("pc", false); await ev(A, () => { Cloud.wait = 0; Cloud.offline = false; Cloud.flush(); });
  await settle([A, B], 20000); await sleep(500);
  const exA = await ev(A, id => S.exams.find(e => e.id === id), ex), exB = await ev(B, id => S.exams.find(e => e.id === id), ex);
  ok(exA.tasks.length === 2 && exB.tasks.length === 2 && exA.note === "Nota do iPad", "as duas tarefas da prova sobreviveram nos dois aparelhos (e a nota também)");
  ok(cloud.live("exam")[0].tasks.length === 2, "nuvem com as 2 tarefas da prova");

  section("Simulado corrigido nos dois aparelhos ao mesmo tempo");
  await ev(A, () => { const id = "simX"; S.simfolders.push({ id: "fX", name: "Fuvest", qn: 10, dur: 300, subjects: [], ranges: "", createdAt: Date.now() }); commit("simfolders"); commitSim({ id, folder: "fX", name: "Sim X", date: "2026-11-20", qn: 10, dur: 300, q: Array.from({ length: 10 }, () => ({ s: "", r: "", g: false, c: "", n: "" })), manual: null, files: [], analysis: null, createdAt: Date.now() }); });
  await settle([A, B]);
  cloud.setOffline("ipad", true);
  await ev(A, () => { SIMS.simX.q[0].r = "c"; SIMS.simX.q[0].c = "Estequiometria"; commitSim(SIMS.simX); });
  await ev(B, () => { SIMS.simX.q[5].r = "e"; SIMS.simX.q[5].n = "chutei"; commitSim(SIMS.simX); });
  await settle([A]);
  cloud.setOffline("ipad", false); await ev(B, () => { Cloud.wait = 0; Cloud.offline = false; Cloud.flush(); });
  await settle([A, B], 20000); await sleep(500);
  const qa = await ev(A, () => SIMS.simX.q), qb = await ev(B, () => SIMS.simX.q);
  ok(qa[0].r === "c" && qa[5].r === "e" && qa[5].n === "chutei" && qa[0].c === "Estequiometria", "PC tem as correções dos dois aparelhos");
  ok(JSON.stringify(qa) === JSON.stringify(qb), "iPad igual ao PC");

  section("Sem internet: as mudanças ficam guardadas e sobem sozinhas");
  cloud.setOffline("ipad", true);
  await ev(B, () => go("pendencias"));
  for (const t of ["Offline 1", "Offline 2", "Offline 3"]) { await ub.fill("#tText", t); await ub.tap("#taskForm [data-submit]"); }
  await ev(B, () => { S.tasks = S.tasks.filter(t => t.text !== "Tarefa criada no iPad"); commit("tasks"); });
  await sleep(1500);
  const txt = await ev(B, () => document.querySelector("#syncTxt").textContent);
  ok(/Sem conexão · \d+ alteraç/.test(txt), "status avisa: " + txt);
  await reload(B);                                     // fechou e abriu o app ainda sem internet
  ok(await ev(B, () => S.tasks.some(t => t.text === "Offline 3") && !S.tasks.some(t => t.text === "Tarefa criada no iPad")), "depois de fechar e abrir sem internet, tudo continua no aparelho");
  cloud.setOffline("ipad", false);
  await ev(B, () => { Cloud.wait = 0; Cloud.offline = false; Cloud.flush(); });
  await settle([A, B], 20000); await sleep(600);
  ok(["Offline 1", "Offline 2", "Offline 3"].every(t => cloud.live("task").some(x => x.text === t)) && !cloud.live("task").some(x => x.text === "Tarefa criada no iPad"), "ao voltar a internet, subiu tudo (inclusive a exclusão)");
  ok(await ev(A, () => S.tasks.some(t => t.text === "Offline 2")), "PC recebeu as tarefas feitas offline no iPad");

  section("Pomodoro aberto nos dois aparelhos: uma sessão só");
  await ev(A, () => { go("tempo"); S.timer.mode = "pomodoro"; S.timer.pomoMin = 25; commit("timer"); startTimer("Química"); });
  await settle([A, B]); await sleep(300);
  ok(await ev(B, () => S.timer.running && S.timer.mode === "pomodoro"), "cronômetro aparece rodando no iPad");
  await ev(A, () => { S.timer.startedAt -= 26 * 60000; commit("timer"); });
  await sleep(300); await ev(B, () => { S.timer.startedAt = Math.min(S.timer.startedAt, Date.now() - 26 * 60000); });
  await sleep(2500); await settle([A, B]); await sleep(500);
  const pom = cloud.live("ses").filter(s => s.dur === 1500);
  ok(pom.length === 1, `sessões de pomodoro registradas: ${pom.length}`);
  ok(await ev(A, () => S.sessions.filter(s => s.dur === 1500).length === 1) && await ev(B, () => S.sessions.filter(s => s.dur === 1500).length === 1), "nenhum aparelho mostra sessão duplicada");
  await ev(A, () => document.querySelectorAll(".ov").forEach(o => o.remove())); await ev(B, () => document.querySelectorAll(".ov").forEach(o => o.remove()));

  section("Revisões de cartões feitas nos dois aparelhos somam");
  await ev(A, () => { logReview(2); logReview(0); }); await ev(B, () => { logReview(3); });
  await settle([A, B]); await sleep(1500); await settle([A, B]);
  const k = new Date(); const dk = `${k.getFullYear()}-${String(k.getMonth() + 1).padStart(2, "0")}-${String(k.getDate()).padStart(2, "0")}`;
  const ra = await ev(A, () => JSON.stringify(S.revlog)), rb = await ev(B, () => JSON.stringify(S.revlog));
  ok(await ev(A, d => S.revlog[d]?.n === 3, dk) && await ev(B, d => S.revlog[d]?.n === 3, dk), "3 revisões contadas nos dois aparelhos " + dk + " A=" + ra + " B=" + rb);

  section("Aparelhos ligados à mesma conta");
  await ev(A, () => go("dados")); await sleep(300);
  const devs = await ev(A, () => [...document.querySelectorAll("#devList .item")].map(i => i.textContent.replace(/\s+/g, " ").trim()));
  ok(devs.length === 2 && devs.some(d => /iPad/.test(d)), "Dados lista os 2 aparelhos: " + devs.join(" / "));
  ok(errorsOf(A, cloud).length === 0 && errorsOf(B, cloud).length === 0, "sem erros: " + JSON.stringify(errorsOf(A, cloud).concat(errorsOf(B, cloud)).slice(0, 4)));
  await A.context.close(); await B.context.close();
}

async function scenarioLimits(browser) {
  section("Limite da nuvem: 3.000 cartões");
  const cloud = new Cloud();
  const A = await openDevice(browser, cloud, { device: "desktop", name: "pc" });
  await cloudReady(A);
  await ev(A, () => { const d = { id: "dk", name: "Anki importado", subject: "", createdAt: Date.now() }; S.decks.push(d); commit("decks"); const l = []; for (let i = 0; i < 3000; i++) l.push(newCard("dk", "Pergunta " + i + " " + "x".repeat(120), "Resposta " + i + " " + "y".repeat(200))); commitCardsBulk(l); });
  const t0 = Date.now(); await settle([A], 90000);
  const cards = cloud.live("card"); const docs = cloud.userDocs().filter(d => d.id.startsWith("card."));
  ok(cards.length === 3000, `3.000 cartões na nuvem em ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  ok(docs.every(d => d.size < 230 * 1024), `${docs.length} blocos de cartões, maior com ${Math.round(Math.max(...docs.map(d => d.size)) / 1024)} KB`);
  await ev(A, () => { for (const c of liveCards().slice(0, 400)) { const n = schedule(c, 2); commitCard(n); } });
  await settle([A], 60000);
  ok(cloud.userDocs().every(d => d.size < 256 * 1024), "depois de estudar 400 cartões nenhum bloco passou de 256 KB");

  section("Limite: simulado com 90 resoluções longas da IA");
  await ev(A, () => { commitSim({ id: "big", folder: "", name: "Simulado enorme", date: "2026-11-20", qn: 90, dur: 300, q: Array.from({ length: 90 }, (_, i) => ({ s: "Química", r: "e", g: false, c: "Conteúdo " + i, n: "anotação ".repeat(60), res: ("Resolução detalhada da questão " + i + ". ").repeat(220).slice(0, 8000) })), manual: null, files: [], analysis: null, createdAt: Date.now() }); });
  await settle([A], 60000);
  const res = cloud.live("res"); const simDoc = cloud.userDocs().find(d => d.id === "sim.big");
  ok(res.length === 90 && cloud.userDocs().filter(d => d.id.startsWith("res.big")).every(d => d.size < 256 * 1024), `90 resoluções em ${cloud.userDocs().filter(d => d.id.startsWith("res.big")).length} blocos separados`);
  ok(simDoc && simDoc.size < 100 * 1024, `simulado em si ficou com ${Math.round((simDoc?.size || 0) / 1024)} KB`);
  const sigA = await ev(A, () => JSON.stringify({ c: liveCards().length, res: SIMS.big.q.map(x => x.res), d: liveCards().map(c => c.due).sort().slice(0, 50) }));
  const B = await openDevice(browser, cloud, { device: "ipad", name: "ipad" }); await cloudReady(B, 30000);
  const sigB = await ev(B, () => JSON.stringify({ c: liveCards().length, res: SIMS.big.q.map(x => x.res), d: liveCards().map(c => c.due).sort().slice(0, 50) }));
  ok(sigA === sigB && JSON.parse(sigB).c === 3000 && JSON.parse(sigB).res.filter(Boolean).length === 90, "outro aparelho reconstrói tudo igual (3.000 cartões, 90 resoluções, agendas de revisão)");
  await B.context.close(); await A.context.close();

  section("Bloco cheio: itens mudam sozinhos para blocos extras (limites reduzidos no teste)");
  const c2 = new Cloud();
  const L = await openDevice(browser, c2, { device: "desktop", name: "pc", init: "window.MEMORA_TEST_LIM = { SOFT: 8 * 1024, HARD: 12 * 1024, ITEM: 10 * 1024 };" });
  await cloudReady(L);
  await ev(L, () => { for (let i = 0; i < 120; i++) S.tasks.push({ id: "t" + i, text: "Tarefa " + i, note: "n".repeat(300), subject: "", prio: "media", due: "", status: "todo", done: false, work: 0, createdAt: Date.now() }); commit("tasks"); });
  await settle([L], 30000);
  await ev(L, () => { S.tasks.slice(0, 60).forEach(t => t.note = "N".repeat(1500)); commit("tasks"); });
  await settle([L], 30000); await sleep(500); await settle([L], 30000);
  const tdocs = c2.userDocs().filter(d => d.id.startsWith("task."));
  const live = c2.live("task");
  ok(live.length === 120 && live.filter(t => t.note.length === 1500).length === 60, "todas as 120 tarefas e as 60 notas maiores estão na nuvem");
  ok(tdocs.length > 8 && tdocs.some(d => d.id.includes("~")), `${tdocs.length} blocos de tarefas, com blocos extras (${tdocs.filter(d => d.id.includes("~")).length})`);
  ok(tdocs.every(d => d.size <= 12 * 1024), `nenhum bloco passou do limite reduzido (maior: ${(Math.max(...tdocs.map(d => d.size)) / 1024).toFixed(1)} KB de 12 KB)`);
  ok(tdocs.some(d => Object.values(d.data.i).some(it => it && it._m)), "cópias antigas ficaram marcadas como movidas (sem os dados)");
  const L2 = await openDevice(browser, c2, { device: "desktop", name: "pc2" }); await cloudReady(L2);
  ok(await ev(L2, () => S.tasks.length === 120 && S.tasks.filter(t => t.note.length === 1500).length === 60), "aparelho novo lê tudo certo, ignorando as cópias antigas");
  await L2.context.close();

  section("Nuvem cheia (limite de blocos) e recusa de bloco");
  c2.maxDocs = c2.docs.size;
  await ev(L, () => { commitSim({ id: "novo", folder: "", name: "Simulado novo", date: "2026-11-20", qn: 5, dur: 60, q: Array.from({ length: 5 }, () => ({ s: "", r: "", g: false, c: "", n: "" })), manual: null, files: [], analysis: null, createdAt: Date.now() }); });
  await sleep(2500);
  const st = await ev(L, () => ({ txt: document.querySelector("#syncTxt").textContent, has: !!SIMS.novo }));
  ok(/Nuvem cheia/.test(st.txt) && st.has, "status 'Nuvem cheia' e o simulado continua salvo no aparelho: " + st.txt);
  ok(await ev(L, () => /encheu/.test(document.querySelector("#fullBanner")?.textContent || "")), "aviso grande na tela, com o botão de baixar cópia");
  c2.maxDocs = 25000; await ev(L, () => { Cloud.wait = 0; Cloud.full = false; Cloud.flush(); });
  await settle([L], 15000);
  ok(c2.userDocs().some(d => d.id === "sim.novo"), "quando há espaço de novo, sobe sozinho");
  ok(await ev(L, () => !document.querySelector("#fullBanner")), "o aviso some quando a nuvem volta a ter espaço");
  c2.inject("update", "invalid_argument", 1, "task.");
  await ev(L, () => { S.tasks[0].text = "Editada depois da recusa"; commit("tasks"); });
  await settle([L], 20000); await sleep(400); await settle([L], 20000);
  ok(c2.live("task").some(t => t.text === "Editada depois da recusa"), "bloco recusado uma vez: o app tenta de outro jeito e salva");
  ok(errorsOf(L, c2).length === 0, "sem erros: " + JSON.stringify(errorsOf(L, c2).slice(0, 3)));
  await L.context.close();
}

async function scenarioMigration(browser) {
  section("Migração dos dados do formato antigo, sem perder nada");
  const cloud = new Cloud(); const uid = "u-aluno"; const now = Date.now(); const T0 = now - 5 * 864e5;
  const put = (p, d) => cloud.docs.set(`data/users/${uid}/${p}`, { data: d, ver: ++cloud.ver });
  const task = (id, text, extra = {}) => ({ id, text, subject: "Química", prio: "media", due: "", status: "todo", done: false, work: 0, createdAt: T0, ...extra });
  put("tasks", { u: T0 + 1000, v: [task("t1", "Tarefa antiga 1"), task("t2", "Tarefa antiga 2"), task("t3", "Será editada offline")] });
  put("sessions", { u: T0, v: [{ id: "s1", subject: "Química", date: "2026-11-10", start: T0, dur: 3600 }] });
  put("settings", { u: T0, v: { subjects: [{ name: "Química", color: "#ff0000" }, { name: "Física", color: "#00ff00" }], goalMin: 300, accent: "azul", light: false, migrated: true, lastBackup: 0, backupEvery: 7, backupSnooze: 0 } });
  put("revlog", { u: T0, v: { "2026-11-10": { n: 12, ok: 9 } } });
  put("exams", { u: T0, v: [{ id: "e1", name: "Fuvest", date: "2026-12-01", note: "", tasks: [{ id: "x1", text: "Revisar", done: false }] }] });
  put("decks", { u: T0, v: [{ id: "d1", name: "Química", subject: "Química", createdAt: T0 }] });
  put("cards/items/c1", { id: "c1", deck: "d1", front: "Ka?", back: "acidez", tags: [], ease: 2.5, ivl: 3, reps: 2, lapses: 0, due: now, ok: 2, bad: 0, hist: Array.from({ length: 40 }, (_, i) => ({ t: T0 + i, r: 2 })), createdAt: T0, updatedAt: T0 });
  put("sims/items/sm1", { id: "sm1", folder: "f1", name: "Simulado antigo", date: "2026-11-01", qn: 3, dur: 90, q: [{ s: "Química", r: "c", g: false, c: "", n: "" }, { s: "Química", r: "e", g: false, c: "Mols", n: "", res: "Resolução antiga guardada" }, { s: "", r: "", g: false, c: "", n: "" }], manual: null, files: [], analysis: null, essay: { theme: "Tema", score: 800, max: 1000, comps: null, fb: "", imp: "" }, createdAt: T0, updatedAt: T0 });
  put("simfolders", { u: T0, v: [{ id: "f1", name: "Fuvest", qn: 3, dur: 90, subjects: [], ranges: "" }] });
  const v1keys = [...cloud.docs.keys()];
  // cópia local antiga do PC: t3 editada offline (não enviada), t4 nova offline, t9 que já tinha sido excluída em outro aparelho
  const local = { "memora3:tasks": JSON.stringify({ u: T0 + 5000, v: [task("t1", "Tarefa antiga 1"), task("t2", "Tarefa antiga 2"), task("t3", "Editada offline no PC"), task("t4", "Nova offline no PC")] }), "memora3:dirty": JSON.stringify(["tasks"]), "memora3:settings": JSON.stringify({ u: T0, v: { subjects: [{ name: "Química", color: "#ff0000" }, { name: "Física", color: "#00ff00" }], goalMin: 300, accent: "azul" } }), "memora3:exams": JSON.stringify({ u: T0 - 9000, v: [{ id: "e1", name: "Fuvest", date: "2026-12-01", tasks: [] }, { id: "e9", name: "Excluída em outro aparelho", date: "2026-12-05", tasks: [] }] }) };
  const seed = `if (location.hostname === "memora.test" && !localStorage.getItem("seeded")) { const L = ${JSON.stringify(local)}; for (const k in L) localStorage.setItem(k, L[k]); localStorage.setItem("seeded", "1"); }`;
  const A = await openDevice(browser, cloud, { device: "desktop", name: "pc", init: seed });
  await cloudReady(A, 20000); await settle([A]);
  const s = await ev(A, () => ({ tasks: S.tasks.map(t => t.text).sort(), ses: S.sessions.length, subj: subjects().map(x => x.name + x.color), goal: S.settings.goalMin, accent: S.settings.accent, rev: S.revlog["2026-11-10"], exams: S.exams.map(e => e.name), etasks: S.exams.find(e => e.id === "e1")?.tasks.length, cards: liveCards().length, hist: CARDS.c1?.hist.length, sim: SIMS.sm1 && { res: SIMS.sm1.q[1].res, essay: SIMS.sm1.essay?.score }, mig: !!S.settings.v1mig }));
  ok(JSON.stringify(s.tasks) === JSON.stringify(["Editada offline no PC", "Nova offline no PC", "Tarefa antiga 1", "Tarefa antiga 2"].sort()), "pendências: edição e criação offline preservadas " + JSON.stringify(s.tasks));
  ok(s.ses === 1 && s.goal === 300 && s.accent === "azul" && s.subj.join() === "Química#ff0000,Física#00ff00", "sessões, meta, cor e matérias migradas");
  ok(s.rev && s.rev.n === 12, "histórico de revisões migrado");
  ok(JSON.stringify(s.exams) === JSON.stringify(["Fuvest"]) && s.etasks === 1, "prova excluída em outro aparelho não voltou; tarefa da prova mantida");
  ok(s.cards === 1 && s.hist === 10 && s.sim.res === "Resolução antiga guardada" && s.sim.essay === 800, "cartões, simulado, resolução e redação migrados");
  ok(s.mig, "migração marcada como feita");
  ok(v1keys.every(k => cloud.docs.has(k)), "os dados no formato antigo continuam intactos na nuvem (nada apagado)");
  const B = await openDevice(browser, cloud, { device: "ipad", name: "ipad" });
  await cloudReady(B, 20000); await settle([A, B]);
  const sb = await ev(B, () => ({ tasks: S.tasks.length, cards: liveCards().length, sims: liveSims().length, subj: subjects().length, exams: S.exams.length }));
  ok(sb.tasks === 4 && sb.cards === 1 && sb.sims === 1 && sb.subj === 2 && sb.exams === 1, "outro aparelho vê tudo sem duplicar: " + JSON.stringify(sb));
  section("Aparelho com a versão antiga ainda aberto escreve no formato antigo");
  const rec = cloud.docs.get(`data/users/${uid}/tasks`).data; rec.v.push(task("t5", "Criada na versão antiga")); rec.u = Date.now();
  await ev(A, () => { V1INFO.chk = 0; Store.flush(); }); await sleep(200);
  await reload(A); await cloudReady(A, 20000); await settle([A, B]); await sleep(500);
  ok(await ev(B, () => S.tasks.some(t => t.text === "Criada na versão antiga")), "tarefa criada na versão antiga chega à versão nova");
  ok(errorsOf(A, cloud).length === 0 && errorsOf(B, cloud).length === 0, "sem erros: " + JSON.stringify(errorsOf(A, cloud).concat(errorsOf(B, cloud)).slice(0, 4)));
  await A.context.close(); await B.context.close();
}

async function scenarioExtra(browser, files) {
  section("Fora do Claude (sem nuvem): salva no aparelho");
  const cloud = new Cloud();
  const A = await openDevice(browser, cloud, { device: "desktop", name: "local", noClaude: true });
  const txt = await ev(A, () => document.querySelector("#syncTxt").textContent);
  ok(/Salvo neste aparelho/.test(txt), "status: " + txt);
  await ev(A, () => { go("pendencias"); }); const u = U(A);
  await u.fill("#tText", "Tarefa local"); await u.tap("#taskForm [data-submit]"); await sleep(600);
  await reload(A);
  ok(await ev(A, () => S.tasks.some(t => t.text === "Tarefa local")), "continua lá depois de recarregar");
  ok(errorsOf(A, cloud).length === 0, "sem erros: " + JSON.stringify(errorsOf(A, cloud).slice(0, 3)));
  await A.context.close();

  section("IA sem permissão de imagens: mensagem certa e atalho para liberar");
  const c2 = new Cloud();
  const B = await openDevice(browser, c2, { device: "ipad", name: "ipad", init: "window.__aiLimits = { maxPromptBytes: 262144 };" }); B.touch = true;
  await cloudReady(B); const ub = U(B);
  await ub.go("ia"); await ub.waitFor(() => !document.querySelector("#aiNote").hidden);
  const note = await ev(B, () => document.querySelector("#aiNote").textContent);
  ok(/permissão para ver fotos/.test(note) && !/aparelho/.test(note), "aviso fala de permissão, não do aparelho: " + note.slice(0, 90));
  await ub.tap("#aiPerm"); await sleep(300);
  ok(c2.events.some(e => e.name === "permissions.manage"), "botão abre o painel de Permissões do Claude");
  await B.app.locator("#aiFile").setInputFiles([{ name: "foto.png", mimeType: "image/png", buffer: files.png }]);
  await ub.fill("#aiPrompt", "cartões"); await ub.tap("#aiGo"); await sleep(400);
  ok(/Permissões/.test(await ub.toast()), "ao tentar gerar com foto: " + (await ub.toast()));
  await B.context.close();

  section("Foto grande demais é reduzida antes de ir para a IA");
  const c3 = new Cloud();
  const C = await openDevice(browser, c3, { device: "ipad", name: "ipad2", init: "window.__aiLimits = { maxPromptBytes: 262144, images: { maxCount: 5, maxInputBytes: 60000, mediaTypes: ['image/jpeg','image/png','image/webp','image/gif'] } };" }); C.touch = true;
  await cloudReady(C); const uc = U(C);
  await uc.go("ia");
  await C.app.locator("#aiFile").setInputFiles([{ name: "grande.png", mimeType: "image/png", buffer: files.png }]);
  await uc.fill("#aiPrompt", "cartões"); await uc.tap("#aiGo"); await uc.waitFor(() => !genBusy && GEN.length > 0, null, 10000);
  const call = c3.aiCalls.pop();
  ok(files.png.length > 60000 && call.images.length === 1 && call.images[0].size <= 60000 && call.images[0].type === "image/jpeg", `foto de ${Math.round(files.png.length / 1024)} KB enviada com ${Math.round(call.images[0].size / 1024)} KB`);
  ok(errorsOf(C, c3).length === 0, "sem erros");
  await C.context.close();
}

(async () => {
  const which = process.argv[2] || "all";
  const browser = await H.chromium.launch();
  const files = await makeFiles(browser);
  const t0 = Date.now();
  try {
    if (which === "web" || which === "all") await scenarioWeb(browser, files);
    if (which === "ipad" || which === "all") await scenarioIpad(browser, files);
    if (which === "sync" || which === "all") await scenarioSync(browser);
    if (which === "limits" || which === "all") await scenarioLimits(browser);
    if (which === "migra" || which === "all") await scenarioMigration(browser);
    if (which === "extra" || which === "all") await scenarioExtra(browser, files);
    if (which === "gerar" || which === "all") await require("./gerar").scenarioGerar(browser, files);
    if (which === "cartoes" || which === "all") await require("./cartoes").scenarioCartoes(browser);
    if (which === "pastas" || which === "all") await require("./pastas").scenarioPastas(browser);
    if (which === "organizar" || which === "all") await require("./organizar").scenarioOrganizar(browser);
    if (which === "ano") await require("./ano").scenarioAno(browser);   // teste de carga: um ano de uso pesado (não entra no "all")
  } catch (e) { R.fail.push("EXCEÇÃO GERAL: " + (e.stack || e)); console.log(e); }
  await browser.close();
  console.log(`\n==== ${R.pass} verificações passaram, ${R.fail.length} falharam (${((Date.now() - t0) / 1000).toFixed(0)} s) ====`);
  R.fail.forEach(f => console.log(" ✗ " + f));
  process.exit(R.fail.length ? 1 : 0);
})();
