// Um ano de uso pesado: quanto ocupa na nuvem, quanto demora para abrir e se nada se perde.
const H = require("./harness"); const { Cloud, openDevice, reload, ev, cloudReady, settle, sleep, R, ok, section, step } = H;
const errorsOf = (dev, cloud) => [...dev.errors, ...cloud.events.filter(e => e.name === "error").map(e => e.msg)].filter(e => !/favicon|net::ERR/.test(e));
const KB = b => (b / 1024).toFixed(1) + " KB", MB = b => (b / 1048576).toFixed(1) + " MB";

const YEAR = { cards: 10000, sesPerDay: 6, tasks: 1500, errors: 2000, genSims: 52, genQ: 90, manSims: 52, manQ: 90 };

async function makeYear(dev, o) {
  await ev(dev, o => {
    const now = Date.now(), DAYMS = 86400000, t0 = now - 365 * DAYMS;
    const mats = ["Biologia", "Química", "Física", "Matemática", "História", "Geografia", "Português", "Inglês"];
    mats.forEach(m => ensureSubject(m)); commit("settings");
    const deckIds = [];
    mats.forEach(m => { const top = { id: uid(), name: m, subject: m, createdAt: t0 }; S.decks.push(top); deckIds.push(top.id); for (let k = 1; k <= 4; k++) { const s = { id: uid(), name: `${m} ${k}`, subject: m, parent: top.id, createdAt: t0 }; S.decks.push(s); deckIds.push(s.id); } });
    commit("decks");
    const ids = [];
    for (let i = 0; i < o.cards; i++) {
      const c = newCard(deckIds[i % deckIds.length], `Pergunta ${i}: qual é o conceito central cobrado sobre este tema no vestibular?`, `Resposta ${i}: explicação do verso com a definição, o porquê e a pegadinha mais comum que as bancas usam nessa questão.`, ["tema" + (i % 40)], "ia");
      Object.assign(c, { createdAt: t0 + (i / o.cards) * 365 * DAYMS, reps: 1 + (i % 8), ivl: (i % 60) + 1, ease: 2.3, ok: 6 + (i % 7), bad: i % 4, lapses: i % 3, due: now + ((i % 90) - 30) * DAYMS });
      c.hist = Array.from({ length: 10 }, (_, j) => ({ t: now - (10 - j) * 4 * DAYMS, r: (i + j) % 4 }));
      CARDS[c.id] = c; ids.push(c.id);
    }
    if (diffKind("card", ids)) changedLocally();
    for (let d = 0; d < 365; d++) for (let k = 0; k < o.sesPerDay; k++) { const day = new Date(t0 + d * DAYMS); S.sessions.push({ id: uid(), subject: mats[(d + k) % 8], date: dkey(day), start: day.getTime() + k * 3600000, dur: 1500 + k * 300 }); }
    commit("sessions");
    const rids = []; for (let d = 0; d < 365; d++) for (let k = 0; k < 3; k++) { const key = dkey(new Date(t0 + d * DAYMS)); const id = key + "@s" + k; REV.set(id, { d: key, n: 40, ok: 32 }); rids.push(id); revAgg(key); }
    if (diffKind("rev", rids)) changedLocally();
    for (let i = 0; i < o.tasks; i++) S.tasks.push({ id: uid(), text: `Pendência ${i}: revisar o capítulo e fazer os exercícios`, note: "Anotação curta sobre o que falta fazer nesta pendência.", subject: mats[i % 8], prio: ["alta", "media", "baixa"][i % 3], due: "", status: i % 5 ? "done" : "todo", done: !!(i % 5), work: 1800, createdAt: t0 + i * 20000000 });
    commit("tasks");
    for (let i = 0; i < o.errors; i++) S.errors.push({ id: uid(), source: "manual", subject: mats[i % 8], topic: `Assunto ${i}`, note: "Por que errei: confundi o conceito. Como acertar: revisar a definição e fazer 5 questões.", reason: "conceito", reviewed: !!(i % 2), createdAt: t0 + i * 10000000 });
    commit("errors");
    for (let i = 0; i < 20; i++) S.exams.push({ id: uid(), name: `Prova ${i}`, date: dkey(new Date(now + i * 15 * DAYMS)), tasks: [] });
    commit("exams");
    for (let i = 0; i < 60; i++) S.agenda.push({ id: uid(), day: i % 7, start: "14:00", end: "15:30", subject: mats[i % 8], title: `Bloco ${i}` });
    commit("agenda");
  }, o);
  // simulados em partes, para o navegador respirar
  for (let part = 0; part < 4; part++) {
    await ev(dev, ([o, part]) => {
      const now = Date.now(), DAYMS = 86400000;
      if (part === 0) { S.simfolders.push({ id: "f-enem", name: "ENEM", qn: o.genQ, dur: 300, subjects: ["Linguagens e Códigos", "Ciências Humanas", "Ciências da Natureza", "Matemática"], ranges: "", createdAt: now }, { id: "f-fuv", name: "Fuvest", qn: o.manQ, dur: 300, subjects: ["Biologia", "Química", "Física", "Matemática"], ranges: "", createdAt: now }); commit("simfolders"); }
      const areas = ["Linguagens e Códigos", "Ciências Humanas", "Ciências da Natureza", "Matemática"];
      const LT = "Texto-base da questão com situação do cotidiano, dados numéricos e contexto histórico ou científico para a leitura atenta do estudante. ".repeat(7);
      const per = Math.ceil(o.genSims / 4);
      for (let k = part * per; k < Math.min(o.genSims, (part + 1) * per); k++) {
        const s = { id: "g" + k, folder: "f-enem", name: `${k + 1}º Simulado inédito ENEM`, date: dkey(new Date(now - (o.genSims - k) * 7 * DAYMS)), qn: o.genQ, dur: 300, q: [], manual: null, files: [], createdAt: now - (o.genSims - k) * 7 * DAYMS,
          analysis: { at: now, resumo: "Bom desempenho geral; foco nas questões de interpretação e em estequiometria.", fortes: ["Biologia"], plano: ["Revisar estequiometria", "Fazer 20 questões"], conteudos: Array.from({ length: 6 }, (_, j) => ({ materia: "Química", conteudo: `Conteúdo ${j}`, questoes: [j + 1], prioridade: "alta", porque: "Errou cálculos", dica: "Monte a regra de três" })) },
          gen: { name: "ENEM", model: "enem", level: "real", alts: 5, tier: "default", dur: 300, focus: "", desc: GEN_MODELS.enem.desc, essay: true, estilo: "Enunciados longos, textos-base e interpretação. ".repeat(4), excerpt: "", status: "pronto", dev: DEV, createdAt: now },
          take: { done: true, spent: 16000, finishedAt: now }, essayPrompt: { tema: "Tema inédito de redação", genero: "Dissertativo-argumentativo", instrucoes: "De 7 a 30 linhas.", textos: ["Texto motivador um.", "Texto motivador dois.", "Texto motivador três."] },
          essay: { theme: "Tema inédito de redação", score: 860, max: 1000, comps: [160, 180, 160, 180, 180], fb: "Bom repertório; melhorar a proposta de intervenção.", imp: "", updatedAt: now } };
        for (let i = 0; i < o.genQ; i++) s.q.push({ s: areas[Math.floor(i / (o.genQ / 4))] || areas[3], r: i % 3 ? "c" : "e", g: i % 7 === 0, c: `Conteúdo ${i}`, n: "", m: "A", k: i % 3 ? "A" : "B",
          qt: { d: areas[Math.floor(i / (o.genQ / 4))] || areas[3], c: `Conteúdo ${i}`, t: LT, e: "Enunciado inédito sobre o conteúdo com o comando da questão. ".repeat(4), a: Array.from({ length: 5 }, (_, j) => `Alternativa ${j} com texto de tamanho médio para parecer real. `.repeat(2)), k: i % 3 ? "A" : "B", r: "Resolução: a correta explica o conceito e as outras erram detalhes. ".repeat(8), dif: "media" } });
        s.q.slice(0, 8).forEach(x => { x.res = "RESOLUÇÃO CAPRICHADA: o que a questão pede, conceitos, passo a passo e pegadinha. ".repeat(30); });
        commitSim(s);
      }
      for (let k = part * Math.ceil(o.manSims / 4); k < Math.min(o.manSims, (part + 1) * Math.ceil(o.manSims / 4)); k++) {
        const s = { id: "m" + k, folder: "f-fuv", name: `${k + 1}º Simulado Fuvest`, date: dkey(new Date(now - (o.manSims - k) * 7 * DAYMS)), qn: o.manQ, dur: 290, manual: null, files: [], analysis: null, createdAt: now - (o.manSims - k) * 7 * DAYMS,
          q: Array.from({ length: o.manQ }, (_, i) => ({ s: ["Biologia", "Química", "Física", "Matemática"][i % 4], r: i % 4 ? "c" : "e", g: i % 9 === 0, c: `Conteúdo anotado ${i}`, n: i % 10 ? "" : "Anotação do aluno sobre a questão." })) };
        commitSim(s);
      }
    }, [o, part]);
  }
}

async function scenarioAno(browser) {
  const cloud = new Cloud();
  section("Um ano de uso pesado");
  const A = await openDevice(browser, cloud, { device: "desktop", name: "pc" }); R.dev = A;
  await cloudReady(A);
  const o = YEAR;
  let t = Date.now();
  await makeYear(A, o);
  const tGen = Date.now() - t; t = Date.now();
  const up = await settle([A], 600000);
  const tUp = Date.now() - t;
  ok(up, `tudo subiu para a nuvem em ${(tUp / 1000).toFixed(0)} s (dados criados em ${(tGen / 1000).toFixed(1)} s)`);
  const docs = cloud.userDocs(); const total = docs.reduce((a, d) => a + d.size, 0); const big = docs.reduce((m, d) => d.size > m.size ? d : m, { size: 0 });
  const by = {}; docs.forEach(d => { const k = d.id.split(".")[0]; by[k] = by[k] || { n: 0, b: 0 }; by[k].n++; by[k].b += d.size; });
  console.log("    por tipo:", Object.entries(by).sort((a, b) => b[1].b - a[1].b).map(([k, v]) => `${k}: ${v.n} blocos, ${MB(v.b)}`).join(" · "));
  ok(docs.length < 25000, `${docs.length} blocos de 25.000 (${(docs.length / 250).toFixed(1)}%), ${MB(total)} no total`);
  ok(big.size < 230 * 1024, `maior bloco: ${big.id} com ${KB(big.size)} (limite 256 KB)`);
  const exp = await ev(A, () => ({ cards: liveCards().length, ses: S.sessions.length, tasks: S.tasks.length, errors: S.errors.length, sims: liveSims().length, qt: Object.values(SIMS).reduce((a, s) => a + s.q.filter(x => x.qt).length, 0), res: Object.values(SIMS).reduce((a, s) => a + s.q.filter(x => x.res).length, 0), rev: Object.values(S.revlog).reduce((a, r) => a + r.n, 0) }));
  console.log("    dados:", JSON.stringify(exp));
  const bk = await ev(A, () => { const s = JSON.stringify(backupObj()); return new Blob([s]).size; });
  console.log("    cópia de segurança completa (JSON):", MB(bk));
  R.bk = bk; R.yearDocs = docs.length; R.yearBytes = total;
  await step("cópia de segurança automática do ano inteiro cabe no limite e volta inteira", async () => {
    const okRun = await ev(A, () => AutoBk.run(true));
    const b = await ev(A, () => AUTOBK.slice().sort((x, y) => y.at - x.at)[0]);
    ok(okRun && b && b.size < 20 * 1048576, `cópia compactada: ${MB(b ? b.size : 0)} (antes ${MB(bk)}, limite 20 MB por arquivo)`);
    const txt = cloud.assets.get(b.id).buf.toString("utf8");
    const c3 = new Cloud(); const C = await openDevice(browser, c3, { device: "desktop", name: "restaura" }); await cloudReady(C);
    await ev(C, t => importBackupText(t), txt);
    await C.frame.waitForFunction(n => liveCards().length === n.cards && liveSims().length === n.sims, exp, { timeout: 120000, polling: 250 });
    const r = await ev(C, () => ({ cards: liveCards().length, ses: S.sessions.length, tasks: S.tasks.length, errors: S.errors.length, sims: liveSims().length, qt: Object.values(SIMS).reduce((a, s) => a + s.q.filter(x => x.qt).length, 0) }));
    ok(r.cards === exp.cards && r.ses === exp.ses && r.tasks === exp.tasks && r.errors === exp.errors && r.qt === exp.qt, "restaurar a cópia numa conta vazia traz tudo: " + JSON.stringify(r));
    await C.context.close();
  });

  section("Aparelho novo abre o ano inteiro");
  t = Date.now();
  const B = await openDevice(browser, cloud, { device: "ipad", name: "ipad" }); B.touch = true; R.dev = B;
  await B.frame.waitForFunction(n => Cloud.ready && liveCards().length === n.cards && liveSims().length === n.sims, exp, { timeout: 180000, polling: 250 });
  const tCold = Date.now() - t;
  ok(true, `iPad sem nada guardado abriu tudo em ${(tCold / 1000).toFixed(1)} s`);
  const got = await ev(B, () => ({ cards: liveCards().length, ses: S.sessions.length, tasks: S.tasks.length, errors: S.errors.length, sims: liveSims().length, qt: Object.values(SIMS).reduce((a, s) => a + s.q.filter(x => x.qt).length, 0), res: Object.values(SIMS).reduce((a, s) => a + s.q.filter(x => x.res).length, 0), rev: Object.values(S.revlog).reduce((a, r) => a + r.n, 0) }));
  ok(JSON.stringify(got) === JSON.stringify(exp), "nada se perdeu: " + JSON.stringify(got));
  const times = {};
  const time = async (name, fn) => { const ms = await ev(B, f => { const t0 = performance.now(); (0, eval)(f)(); return performance.now() - t0; }, fn.toString()); times[name] = Math.round(ms); };
  await time("Painel", () => go("painel"));
  await time("Flashcards", () => { fcDeck = null; orgState = null; go("flashcards"); });
  await time("Pasta Biologia", () => { fcDeck = S.decks.find(d => d.name === "Biologia").id; render(); });
  await time("Estudar (fila)", () => { startStudy(null); });
  await time("Organizar (10 mil)", () => { studyState = null; fcDeck = null; openOrganizer(""); });
  await time("Busca no organizador", () => { orgState.q = "pegadinha 99"; render(); });
  await time("Estatísticas", () => { orgState = null; go("estatisticas"); });
  await time("Estatísticas simulados", () => { statTab = "simulados"; render(); });
  await time("Simulados", () => { statTab = "estudo"; simFolder = "f-enem"; simOpen = null; go("simulados"); });
  await time("Simulado com 90 questões", () => { simOpen = "g0"; render(); });
  await time("Caderno de erros", () => { simOpen = null; go("erros"); });
  console.log("    tempo das telas (ms):", JSON.stringify(times));
  const slow = Object.entries(times).filter(([, ms]) => ms > 1500);
  ok(!slow.length, "todas as telas abrem em menos de 1,5 s no computador de teste" + (slow.length ? ": lentas " + JSON.stringify(slow) : ""));
  t = Date.now();
  await reload(B);
  await B.frame.waitForFunction(n => liveCards().length === n.cards && liveSims().length === n.sims, exp, { timeout: 180000, polling: 250 });
  const tWarm = Date.now() - t;
  ok(true, `abrir de novo no mesmo aparelho: ${(tWarm / 1000).toFixed(1)} s`);
  await B.frame.waitForFunction(() => Cloud.ready, null, { timeout: 120000 });
  ok(errorsOf(A, cloud).length === 0 && errorsOf(B, cloud).length === 0, "sem erros: " + JSON.stringify(errorsOf(A, cloud).concat(errorsOf(B, cloud)).slice(0, 3)));
  console.log(`\n    RESUMO: ${docs.length} blocos (${(docs.length / 250).toFixed(1)}% de 25.000) · ${MB(total)} · maior ${KB(big.size)} · subir ${(tUp / 1000).toFixed(0)} s · abrir novo ${(tCold / 1000).toFixed(1)} s · reabrir ${(tWarm / 1000).toFixed(1)} s · cópia ${MB(bk)}`);
  await A.context.close(); await B.context.close(); R.dev = null;
}
module.exports = { scenarioAno, YEAR };
