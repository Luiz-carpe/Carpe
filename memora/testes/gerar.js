// Simulados inéditos com IA: criar, fazer a prova, revisar, outro aparelho, falhas da IA e prova completa do ENEM.
const path = require("path");
const H = require("./harness"); const { Cloud, openDevice, reload, ev, cloudReady, settle, sleep, R, ok, section, step } = H;
const { U } = require("./walkthrough");
const SHOTS = path.join(__dirname, "shots");
const errorsOf = (dev, cloud) => [...dev.errors, ...cloud.events.filter(e => e.name === "error").map(e => e.msg)].filter(e => !/favicon|net::ERR/.test(e));
const genSim = dev => ev(dev, () => { const s = Object.values(SIMS).filter(x => x.gen && !x.deleted).sort((a, b) => b.createdAt - a.createdAt)[0]; return s ? s.id : null; });

async function scenarioGerar(browser, files) {
  const cloud = new Cloud();
  const A = await openDevice(browser, cloud, { device: "desktop", name: "pc" });
  R.dev = A; const u = U(A);
  await cloudReady(A);

  section("[pc] salvamento na nuvem com uso sem parar");
  await step("mudanças a cada 0,3 s não adiam o envio", async () => {
    await ev(A, () => { S.tasks.push({ id: "t-rapida", text: "Tarefa rápida 0", note: "", subject: "", prio: "media", due: "", status: "todo", done: false, work: 0, createdAt: Date.now() }); commit("tasks"); });
    const t0 = Date.now(); let seen = 0;
    for (let i = 1; i <= 18; i++) {
      await ev(A, i => { S.tasks.find(t => t.id === "t-rapida").text = "Tarefa rápida " + i; commit("tasks"); }, i);
      await sleep(300);
      if (!seen && cloud.live("task").some(t => t.id === "t-rapida")) seen = Date.now() - t0;
    }
    ok(seen > 0 && seen < 4500, `primeira versão chegou à nuvem em ${(seen / 1000).toFixed(1)} s mesmo com mudanças sem parar`);
    await settle([A]);
    ok(cloud.live("task").find(t => t.id === "t-rapida")?.text === "Tarefa rápida 18", "e a última versão também");
    await ev(A, () => { S.tasks = S.tasks.filter(t => t.id !== "t-rapida"); commit("tasks"); });
  });

  section("[pc] formulário do simulado inédito");
  let sid = null;
  await step("abrir o formulário pela tela de Simulados", async () => {
    await u.go("simulados");
    ok(await u.st(() => !!document.querySelector("#genNew")), "botão Criar simulado inédito aparece mesmo sem pastas");
    await u.tap("#genNew");
    await u.waitFor(() => !!document.querySelector("#gModel"));
    ok(await u.st(() => simGen.cfg.model === "enem" && genTotal(simGen.cfg) === 180 && simGen.cfg.essay && simGen.cfg.dur === 540), "começa no ENEM completo: 180 questões, redação, 9 h");
  });
  await step("escolher Fuvest, 10 questões, difícil, foco e provas antigas", async () => {
    await u.pick("#gModel", "fuvest"); await u.waitFor(() => simGen.cfg.model === "fuvest");
    ok(await u.st(() => simGen.cfg.areas.length === 9 && genTotal(simGen.cfg) === 90 && simGen.cfg.alts === 5 && !simGen.cfg.essay), "Fuvest: 9 disciplinas, 90 questões, 5 alternativas, sem redação");
    await u.tap('[data-gsize="10"]');
    ok(await u.st(() => genTotal(simGen.cfg) === 10 && document.querySelector("#gTotal").textContent === "10" && simGen.cfg.dur === 33), "atalho 10 questões distribui entre as disciplinas e ajusta o tempo (33 min)");
    await u.pick("#gLevel", "dificil");
    await u.fill("#gFocus", "estequiometria e genética");
    await A.app.locator("#gFile").setInputFiles([{ name: "fuvest-2024.pdf", mimeType: "application/pdf", buffer: files.pdf }, { name: "questao.png", mimeType: "image/png", buffer: files.png }]);
    await u.waitFor(() => GENATT.length === 2 && GENATT.every(a => a.kind !== "pdf" || a.status !== "lendo…"), null, 15000);
    ok(await u.st(() => document.querySelectorAll("#gThumbs .thumb").length === 2 && /texto extraído/.test(GENATT.find(a => a.kind === "pdf").status)), "PDF lido e foto anexada aparecem no formulário");
  });

  section("[pc] criação pela IA");
  await step("criar e acompanhar até ficar pronto", async () => {
    const n0 = cloud.aiCalls.length;
    await u.tap("#gGo");
    await u.waitFor(() => !GENRUN && Object.values(SIMS).some(s => s.gen && s.gen.status === "pronto"), null, 20000);
    sid = await genSim(A);
    const calls = cloud.aiCalls.slice(n0);
    const plan = calls.find(c => /vai planejar um SIMULADO INÉDITO/.test(c.prompt));
    ok(plan && /Fuvest/.test(plan.prompt) && /Henderson-Hasselbalch/.test(plan.prompt) && /questões difíceis/.test(plan.prompt) && /estequiometria e genética/.test(plan.prompt), "o plano leva a prova escolhida, o nível, o foco e o texto do PDF anexado");
    ok(plan && plan.images.length === 1, "a foto da prova antiga vai junto para a IA");
    ok(plan && /"habilidade"/.test(plan.prompt), "prova pequena: plano inclui a habilidade de cada questão");
    const batches = calls.filter(c => /Escreva as questões .* do simulado inédito/.test(c.prompt));
    ok(batches.length === 2, `questões escritas em ${batches.length} lotes (6 + 4)`);
    ok(batches.every(c => /Questões 100% inéditas/.test(c.prompt) && /exatamente 5 alternativas/.test(c.prompt)), "cada lote pede questões inéditas com 5 alternativas");
    const st = await u.st(id => { const s = SIMS[id]; return { qn: s.qn, all: s.q.every(x => x.qt && x.qt.a.length === 5 && /Enunciado inédito/.test(x.qt.e)), keys: [...new Set(s.q.map(x => x.qt.k))].length, hidden: s.q.every(x => !x.k && !x.r), folder: S.simfolders.find(f => f.id === s.folder)?.name, plan: !!s.gen.plan, subj: [...new Set(s.q.map(x => x.s))].length }; }, sid);
    ok(st.qn === 10 && st.all, "10 questões criadas, cada uma com enunciado e 5 alternativas");
    ok(st.keys >= 3, `gabarito espalhado entre ${st.keys} letras`);
    ok(st.hidden, "gabarito escondido até entregar a prova");
    ok(st.folder === "Fuvest", "pasta Fuvest criada sozinha");
    ok(!st.plan, "plano interno apagado quando a prova fica pronta");
    ok(st.subj >= 8, `questões de ${st.subj} disciplinas diferentes`);
    ok(/Prova pronta/.test(await u.st(() => document.querySelector("#view").textContent)) && await u.st(() => !document.querySelector("#takeGo").disabled), "tela mostra Prova pronta com o botão Fazer a prova");
  });
  await step("questões salvas na nuvem em blocos próprios", async () => {
    await settle([A]);
    const docs = cloud.userDocs();
    const qd = docs.filter(d => d.id.startsWith("qst."));
    const simDoc = docs.find(d => d.id.startsWith("sim."));
    ok(qd.length === 1 && Object.keys(qd[0].data.i).length === 10, "1 bloco de questões com as 10 questões");
    ok(simDoc && !/Enunciado inédito/.test(JSON.stringify(simDoc.data)), "o bloco do simulado não repete o texto das questões");
  });

  await step("painel mostra Fazer a prova e abre o simulado mesmo com o formulário aberto", async () => {
    await ev(A, () => { simOpen = null; simFolder = null; go("simulados"); });
    await u.tap("#genNew"); await u.waitFor(() => !!document.querySelector("#gModel"));
    await u.go("painel");
    ok(/fazer a prova/.test(await u.st(id => document.querySelector(`[data-opensim="${id}"]`)?.textContent || "", sid)), "painel: último simulado com Fazer a prova (não 0%)");
    await u.tap(`[data-opensim="${sid}"]`);
    await u.waitFor(() => route === "simulados");
    ok(await u.st(() => !!document.querySelector("#takeGo") && !document.querySelector("#gModel")), "abre o simulado, não o formulário");
    await u.tap("#back");
    ok(await u.st(() => !!document.querySelector("#gModel")), "voltar mostra o formulário que ficou aberto");
    await u.tap("#genBack");
    await ev(A, id => { const s = SIMS[id]; simFolder = s.folder; simOpen = id; render(); }, sid);
  });

  section("[pc] fazer a prova");
  let K = [];
  await step("responder por clique e teclado, chute e revisar depois", async () => {
    K = await u.st(id => SIMS[id].q.map(x => x.qt.k), sid);
    const wrong = k => k === "A" ? "B" : "A";
    await u.tap("#takeGo"); await u.waitFor(() => !!document.querySelector("#tkClock"));
    ok(/^00:3[23]:\d\d$/.test(await u.st(() => document.querySelector("#tkClock").textContent)), "cronômetro começa em 33 minutos");
    await u.tap(`[data-alt="${K[0]}"]`);
    ok(await u.st(k => document.querySelector(`[data-alt="${k}"]`).classList.contains("on") && document.querySelector('[data-tkn="0"]').classList.contains("ans"), K[0]), "alternativa marcada e questão 1 aparece como respondida");
    await u.tap("#tkNext"); await u.tap(`[data-alt="${wrong(K[1])}"]`);
    await A.page.keyboard.press("ArrowRight");
    await u.waitFor(() => takeIdx === 2);
    await A.page.keyboard.press(K[2].toLowerCase());
    ok(await u.st(id => SIMS[id].q[2].m, sid) === K[2], "tecla da letra responde a questão 3");
    await A.page.keyboard.press("ArrowRight"); await A.page.keyboard.press("ArrowRight"); await u.waitFor(() => takeIdx === 4);
    await u.tap(`[data-alt="${K[4]}"]`); await u.tap("[data-tkg]");
    await u.tap("#tkNext"); await u.tap(`[data-alt="${wrong(K[5])}"]`); await u.tap("[data-tkf]");
    ok(await u.st(() => document.querySelector('[data-tkn="5"]').classList.contains("flag")), "questão marcada para revisar aparece na grade");
    await u.tap(`[data-alt="${wrong(K[5])}"]`); await u.tap(`[data-alt="${wrong(K[5])}"]`);
    ok(await u.st(id => SIMS[id].q[5].m, sid) === wrong(K[5]), "tocar de novo desmarca e marca outra vez");
    await sleep(700);
  });
  await step("sair pausa o tempo; recarregar mantém tudo", async () => {
    await u.tap("#tkExit"); await u.waitFor(() => !!document.querySelector("#takeGo"));
    const t = await u.st(id => ({ ...SIMS[id].take }), sid);
    ok(t.resumedAt === 0 && t.spent > 0, `ao sair o tempo para (${t.spent.toFixed(1)} s usados)`);
    ok(/Continuar a prova/.test(await u.st(() => document.querySelector("#takeGo").textContent)), "botão vira Continuar a prova");
    await sleep(1200);
    ok(Math.abs(await u.st(id => takeSpent(SIMS[id]), sid) - t.spent) < 0.01, "com a prova fechada o tempo não corre");
    await reload(A); await cloudReady(A);
    const s2 = await u.st(id => { const s = SIMS[id]; return { m: s.q.map(x => x.m || ""), g: s.q[4].g, f: s.q[5].f, spent: s.take.spent, qt: s.q.filter(x => x.qt).length }; }, sid);
    ok(s2.m[0] === K[0] && s2.m[2] === K[2] && s2.g && s2.f && s2.qt === 10, "depois de recarregar: respostas, chute, marcação e questões continuam");
    ok(Math.abs(s2.spent - t.spent) < 0.01, "tempo usado continua o mesmo");
  });
  await step("continuar pela folha de respostas e entregar", async () => {
    await ev(A, id => { const s = SIMS[id]; simFolder = s.folder; simOpen = id; go("simulados"); }, sid);
    await u.tap("#takeGo"); await u.waitFor(() => !!document.querySelector("#tkClock"));
    ok(await u.st(() => takeIdx === 3), "continua na primeira questão sem resposta (4)");
    await u.tap('#tkMode [data-tm="sheet"]');
    await u.tap(`[data-shq="6"] [data-shl="${K[6]}"]`); await u.tap(`[data-shq="7"] [data-shl="${K[7]}"]`); await u.tap(`[data-shq="8"] [data-shl="${K[8] === "E" ? "D" : "E"}"]`);
    ok(await u.st(() => document.querySelector("#tkCount").textContent) === "8 de 10 respondidas", "contador de respondidas atualiza na hora");
    await u.tap("#tkSubmit");
    ok(/2 questões ficaram em branco/.test(await u.st(() => document.querySelector(".ov").textContent)), "confirmação avisa as questões em branco");
    await u.ok();
    await u.waitFor(() => !simTake && !document.querySelector(".ov"));
    const r = await u.st(id => { const s = SIMS[id]; const st = simStats(s); return { a: st.a, e: st.e, b: st.b, ag: st.ag, done: s.take.done, dur: s.dur, k: s.q.every((x, i) => x.k === x.qt.k), r: s.q.map(x => x.r).join("") }; }, sid);
    ok(r.done && r.k, "prova entregue: gabarito revelado em todas as questões");
    ok(r.a === 5 && r.ag === 1 && r.e === 3 && r.b === 2, `correção automática: ${r.a} acertos (1 no chute), ${r.e} erros, ${r.b} em branco`);
    ok(r.dur >= 1, "tempo de prova registrado no simulado");
    ok(/Prova entregue: 5 de 10/.test(await u.toast()), "aviso com a nota: " + await u.toast());
    ok(await u.st(() => document.querySelectorAll(".qnb[data-qv]").length === 10 && /Simulado inédito · Fuvest · Difícil/.test(document.querySelector("#view").textContent)), "resultado mostra as 10 questões clicáveis e o tipo do simulado");
    ok(await u.st(() => !document.querySelector("#qKey") && !document.querySelector("#qDist") && !document.querySelector("#simFile")), "sem botões que bagunçariam o gabarito automático");
  });

  section("[pc] revisar depois da prova");
  await step("ver questão, anular e desfazer", async () => {
    await u.tap('[data-q="1"] [data-qv]');
    const t = await u.st(() => document.querySelector(".ov").textContent);
    ok(/Resolução/.test(t) && /sua resposta/.test(t) && /correta/.test(t) && /Enunciado inédito da questão 2/.test(t), "modal mostra enunciado, resposta marcada, correta e resolução");
    await u.tap(".ov [data-an]");
    ok(await u.st(id => { const s = SIMS[id]; const st = simStats(s); return s.q[1].an && st.qn === 9 && st.e === 2; }, sid), "questão anulada sai da nota (9 questões valendo)");
    ok(await u.st(() => document.querySelector('[data-q="1"]').classList.contains("an") && /1 anulada/.test(document.querySelector("#view").textContent)), "lista mostra a questão anulada");
    ok(await u.st(id => simErrorCandidates(["e"], id).every(c => c.i !== 1) && simErrorCandidates(["e"], id).length === 2, sid), "questão anulada não vai para o caderno de erros");
    await u.tap('[data-q="1"] [data-qv]'); await u.tap(".ov [data-an]");
    ok(await u.st(id => { const s = SIMS[id]; const st = simStats(s); return !s.q[1].an && st.qn === 10 && s.q[1].r === "e"; }, sid), "desfazer a anulação volta a contar como erro");
  });
  await step("explicar melhor usa o enunciado da questão", async () => {
    const n0 = cloud.aiCalls.length;
    await u.tap('[data-q="1"] [data-qv]'); await u.tap(".ov [data-exp]");
    await u.waitFor(() => !!document.querySelector("#rGo"));
    ok(await u.st(() => document.querySelector("#rPhoto").closest(".row").hidden), "não pede foto da questão (a IA já tem o enunciado)");
    await u.tap("#rGo"); await u.waitFor(() => !document.querySelector("#rSave").hidden, null, 8000);
    const c = cloud.aiCalls.slice(n0).find(x => /resolução caprichada/.test(x.prompt));
    ok(c && /Enunciado inédito da questão 2/.test(c.prompt) && /Gabarito: /.test(c.prompt), "a IA recebe o enunciado, as alternativas e o gabarito");
    await u.tap("#rSave"); await u.tap(".ov [data-x]");
  });
  await step("levantamento, caderno de erros e cartão", async () => {
    const n0 = cloud.aiCalls.length;
    await u.tap("#simAI"); await u.waitFor(id => !!SIMS[id].analysis && !simBusy, sid, 8000);
    const c = cloud.aiCalls.slice(n0).find(x => /professor coordenador/.test(x.prompt));
    ok(c && /deste simulado inédito/.test(c.prompt) && /Enunciado inédito da questão 6/.test(c.prompt), "levantamento usa os enunciados das questões erradas");
    await u.tap("#qErr"); await u.ok();
    await u.waitFor(() => route === "erros");
    ok(await u.st(() => S.errors.filter(e => e.source === "sim").length === 3), "3 erros enviados ao caderno");
    await u.tap('[data-eact="qv"]');
    ok(/Enunciado inédito/.test(await u.st(() => document.querySelector(".ov").textContent)), "caderno de erros abre a questão inédita");
    await u.tap(".ov [data-x]");
    const n1 = cloud.aiCalls.length;
    await u.tap('[data-eact="card"]'); await u.tap("#ecAI"); await u.waitFor(() => /Sugestão pronta/.test(document.querySelector("#ecMsg").textContent));
    ok(/A questão que ele errou/.test(cloud.aiCalls.slice(n1)[0].prompt), "cartão do erro usa o enunciado da questão");
    await u.ok(); await u.waitFor(() => !document.querySelector(".ov"));
  });
  await step("baixar para imprimir", async () => {
    await ev(A, id => { const s = SIMS[id]; simFolder = s.folder; simOpen = id; go("simulados"); }, sid);
    await u.tap("#genPrint"); await sleep(300);
    const d = cloud.downloads[cloud.downloads.length - 1];
    ok(d && /^simulado-.*\.html$/.test(d.filename) && /<!doctype html>/i.test(d.head) && d.size > 3000, `arquivo para imprimir: ${d && d.filename} (${d && Math.round(d.size / 1024)} KB)`);
    const html = await u.st(id => simPrintHTML(SIMS[id]), sid);
    ok(/Folha de respostas/.test(html) && /Gabarito/.test(html) && (html.match(/class="q"/g) || []).length === 10, "arquivo tem as 10 questões, folha de respostas e gabarito no fim");
    await u.tap("#editS");
    ok(await u.st(() => document.querySelector("#smQn").disabled), "editar dados não deixa mudar o número de questões");
    await u.tap(".ov [data-x]");
  });

  section("[ipad] segundo aparelho: recebe tudo e faz a prova por toque");
  await settle([A]);
  const P = await openDevice(browser, cloud, { device: "ipad", name: "ipad" }); P.touch = true;
  const up = U(P);
  await cloudReady(P, 15000);
  let sid2 = null;
  await step("iPad recebe o simulado feito no computador", async () => {
    const s = await up.st(id => { const s = SIMS[id]; return s && { qt: s.q.filter(x => x.qt).length, done: takeDone(s), a: simStats(s).a, res: !!s.q[1].res }; }, sid);
    ok(s && s.qt === 10 && s.done && s.a === 5 && s.res, "as 10 questões, o resultado e a resolução guardada chegam ao iPad " + JSON.stringify(s));
  });
  await step("criar no iPad (ENEM 20 questões com redação) enquanto o computador acompanha", async () => {
    R.dev = P;
    cloud.genDelay = 700;
    await up.go("simulados"); await up.tap("#genNew"); await up.waitFor(() => !!document.querySelector("#gModel"));
    await up.tap('[data-gsize="20"]');
    ok(await up.st(() => genTotal(simGen.cfg) === 20 && simGen.cfg.essay), "ENEM com 20 questões e redação");
    await up.tap("#gGo");
    await up.waitFor(() => GENRUN && GENRUN.sim, null, 8000);
    sid2 = await up.st(() => GENRUN.sim);
    await A.frame.waitForFunction(id => !!SIMS[id], sid2, { timeout: 8000 });
    ok(await ev(A, id => genStatus(SIMS[id]), sid2) === "outro", "computador vê que o simulado está sendo criado em outro aparelho");
    await up.waitFor(() => !GENRUN, null, 30000);
    cloud.genDelay = 0;
    const s = await up.st(id => { const s = SIMS[id]; return { st: s.gen.status, qt: s.q.filter(x => x.qt).length, essay: !!s.essayPrompt, long: s.q.every(x => x.qt.t.length > 500) }; }, sid2);
    ok(s.st === "pronto" && s.qt === 20 && s.essay && s.long, "20 questões com texto-base e proposta de redação " + JSON.stringify(s));
    await settle([A, P]);
    ok(await ev(A, id => { const s = SIMS[id]; return genStatus(s) === "pronto" && s.q.filter(x => x.qt).length === 20 && !!s.essayPrompt; }, sid2), "computador recebe as 20 questões e a redação");
  });
  await step("fazer a prova por toque no iPad", async () => {
    await up.tap("#takeGo"); await up.waitFor(() => !!document.querySelector("#tkClock"));
    const K2 = await up.st(id => SIMS[id].q.map(x => x.qt.k), sid2);
    await up.tap(`[data-alt="${K2[0]}"]`); await up.tap("#tkNext"); await up.tap(`[data-alt="${K2[1]}"]`);
    await up.tap('[data-tkn="20"]');
    ok(/Proposta de redação/.test(await up.st(() => document.querySelector("#view").textContent)), "botão R da grade mostra a proposta de redação");
    const lay = await up.st(() => ({ over: document.documentElement.scrollWidth - innerWidth, bar: getComputedStyle(document.querySelector(".takebar")).position }));
    ok(lay.over <= 0 && lay.bar === "sticky", "prova cabe na tela do iPad (sem rolagem lateral) com a barra do tempo fixa");
    await up.tap('[data-tkn="1"]');
    await P.page.screenshot({ path: path.join(SHOTS, "gerar-ipad-prova.png") });
    await sleep(700); await settle([A, P]);
    ok(await ev(A, id => SIMS[id].q[0].m && SIMS[id].q[1].m, sid2), "respostas dadas no iPad aparecem no computador");
    await up.tap("#tkExit"); await settle([A, P]);
    ok(await ev(A, id => SIMS[id].take.resumedAt === 0 && SIMS[id].take.spent > 0, sid2), "pausa feita no iPad vale no computador");
    await up.st(() => { go("simulados"); simOpen = null; simFolder = null; render(); });
  });
  R.dev = A;

  section("[pc] falhas da IA: tentar de novo e continuar depois");
  await step("um lote falha e é refeito sozinho", async () => {
    cloud.inject("ai", "invalid_json", 1, "Escreva as questões");
    await ev(A, () => { simOpen = null; simFolder = null; go("simulados"); });
    await u.tap("#genNew"); await u.pick("#gModel", "unicamp"); await u.tap('[data-gsize="10"]');
    ok(await u.st(() => simGen.cfg.alts === 4), "Unicamp usa 4 alternativas");
    await u.tap("#gGo"); await u.waitFor(() => !GENRUN && Object.values(SIMS).some(s => s.gen && s.gen.model === "unicamp"), null, 20000);
    const s = await u.st(() => { const s = Object.values(SIMS).find(s => s.gen && s.gen.model === "unicamp"); return { st: s.gen.status, n: s.q.filter(x => x.qt && x.qt.a.length === 4).length }; });
    ok(s.st === "pronto" && s.n === 10, "mesmo com um lote recusado, as 10 questões (4 alternativas) ficam prontas");
  });
  await step("IA fora do ar: prova incompleta e Continuar criando", async () => {
    cloud.inject("ai", "invalid_json", 50, "Escreva as questões");
    await ev(A, () => { simOpen = null; simFolder = null; go("simulados"); });
    await u.tap("#genNew"); await u.pick("#gModel", "uerj"); await u.tap('[data-gsize="10"]');
    await u.tap("#gGo"); await u.waitFor(() => !GENRUN && Object.values(SIMS).some(s => s.gen && s.gen.model === "uerj"), null, 20000);
    const id = await u.st(() => Object.values(SIMS).find(s => s.gen && s.gen.model === "uerj").id);
    ok(await u.st(id => SIMS[id].gen.status === "incompleto" && !!document.querySelector("#genResume"), id), "sem questões prontas: aparece Continuar criando");
    ok(/0 de 10/.test(await u.toast()), "aviso: " + await u.toast());
    cloud.fail = [];
    await u.tap("#genResume"); await u.waitFor(id => !GENRUN && SIMS[id].gen.status === "pronto", id, 20000);
    ok(await u.st(id => SIMS[id].q.every(x => x.qt), id), "Continuar criando completa a prova");
  });
  await step("pausar no meio e continuar", async () => {
    cloud.genDelay = 900;
    await ev(A, () => { simOpen = null; simFolder = null; go("simulados"); });
    await u.tap("#genNew"); await u.pick("#gModel", "famerp"); await u.tap('[data-gsize="20"]');
    await u.tap("#gGo"); await u.waitFor(() => GENRUN && GENRUN.sim, null, 8000);
    const id = await u.st(() => GENRUN.sim);
    await u.waitFor(() => !!document.querySelector("#genCancel"));
    await u.tap("#genCancel"); await u.waitFor(() => !GENRUN, null, 10000);
    cloud.genDelay = 0;
    ok(await u.st(id => SIMS[id].gen.status === "incompleto" && SIMS[id].q.some(x => !x.qt), id), "pausado no meio: fica incompleto " + JSON.stringify(await u.st(id => ({ st: SIMS[id].gen.status, qt: SIMS[id].q.filter(x => x.qt).length, run: !!GENRUN }), id)));
    ok(/Criação pausada/.test(await u.toast()), "aviso: " + await u.toast());
    await u.tap("#genResume"); await u.waitFor(id => !GENRUN && SIMS[id].gen.status === "pronto", id, 20000);
    ok(await u.st(id => SIMS[id].q.filter(x => x.qt).length === 20, id), "continuar completa as 20 questões");
  });
  await step("entregar prova incompleta: as que faltam ficam fora da nota", async () => {
    cloud.inject("ai", "invalid_json", 50, "Escreva as questões");
    await ev(A, () => { simOpen = null; simFolder = null; go("simulados"); });
    await u.tap("#genNew"); await u.pick("#gModel", "outra"); await u.fill("#gName", "UFG"); await u.tap('[data-garea="0"]');
    await u.st(() => { simGen.cfg.areas = simGen.cfg.areas.map(([a], i) => [a, i < 2 ? 3 : 0]); render(); });
    await u.tap("#gGo"); await u.waitFor(() => !GENRUN && Object.values(SIMS).some(s => s.gen && s.gen.name === "UFG"), null, 20000);
    cloud.fail = [];
    const id = await u.st(() => Object.values(SIMS).find(s => s.gen && s.gen.name === "UFG").id);
    ok(await u.st(id => S.simfolders.some(f => f.name === "UFG") && SIMS[id].gen.status === "incompleto", id), "outra prova (UFG): pasta própria e prova incompleta");
    ok(await u.st(() => document.querySelector("#takeGo").disabled), "sem nenhuma questão pronta não dá para começar");
    await u.st(id => { const s = SIMS[id]; s.q[0].qt = { d: s.q[0].s, c: "", t: "", e: "Questão criada à mão para o teste", a: ["um", "dois", "três", "quatro", "cinco"], k: "C", r: "", dif: "" }; commitSim(s); render(); }, id);
    await u.tap("#takeGo"); await u.tap('[data-alt="C"]');
    await u.tap("#tkSubmit");
    ok(/5 ainda não foram criadas e ficam fora da nota/.test(await u.st(() => document.querySelector(".ov").textContent)), "confirmação avisa as questões que não foram criadas");
    await u.ok(); await u.waitFor(() => !simTake);
    ok(await u.st(id => { const st = simStats(SIMS[id]); return st.a === 1 && st.qn === 1 && st.pct === 1; }, id), "nota conta só a questão que existia (1 de 1)");
  });
  await step("excluir enquanto cria", async () => {
    cloud.genDelay = 900;
    await ev(A, () => { simOpen = null; simFolder = null; go("simulados"); });
    await u.tap("#genNew"); await u.pick("#gModel", "unesp"); await u.tap('[data-gsize="20"]');
    await u.tap("#gGo"); await u.waitFor(() => GENRUN && GENRUN.sim, null, 8000);
    const id = await u.st(() => GENRUN.sim);
    await u.tap("#delS"); await u.ok();
    await u.waitFor(() => !GENRUN, null, 10000);
    cloud.genDelay = 0;
    ok(await u.st(id => SIMS[id].deleted && S.trash.some(t => t.kind === "sim" && t.data.id === id) && !/Criação pausada/.test(document.querySelector(".toast")?.textContent || ""), id), "criação para, simulado vai para a lixeira sem aviso errado");
  });

  section("[pc] ENEM completo: 180 questões e redação cabem na nuvem");
  await step("criar o ENEM inteiro", async () => {
    await ev(A, () => { simOpen = null; simFolder = null; go("simulados"); });
    await u.tap("#genNew"); await u.pick("#gModel", "enem");
    await u.tap("#gGo"); await u.waitFor(() => !GENRUN && Object.values(SIMS).some(s => s.gen && s.gen.model === "enem" && s.qn === 180 && s.gen.status === "pronto"), null, 90000);
    const id = await u.st(() => Object.values(SIMS).find(s => s.gen && s.gen.model === "enem" && s.qn === 180).id);
    const s = await u.st(id => { const s = SIMS[id]; return { qt: s.q.filter(x => x.qt).length, essay: !!s.essayPrompt, dur: s.gen.dur, areas: [...new Set(s.q.map(x => x.s))] }; }, id);
    ok(s.qt === 180 && s.essay && s.dur === 540, "180 questões + redação, 9 h de prova");
    const pl = cloud.aiCalls.filter(c => /vai planejar um SIMULADO INÉDITO/.test(c.prompt) && /Total: 180 questões/.test(c.prompt)).pop();
    ok(pl && !/"habilidade"/.test(pl.prompt) && /Seja breve/.test(pl.prompt), "prova grande: plano pede só o essencial para caber numa resposta da IA");
    ok(s.areas.join("|") === "Linguagens e Códigos|Ciências Humanas|Ciências da Natureza|Matemática", "questões na ordem das 4 áreas do ENEM");
    await settle([A], 30000);
    const docs = cloud.userDocs(); const qd = docs.filter(d => d.id.startsWith("qst.")); const big = docs.reduce((m, d) => Math.max(m, d.size), 0);
    const simDoc = docs.find(d => d.id === "sim." + id);
    ok(qd.filter(d => d.id.includes(id)).length === 18, "questões do ENEM em 18 blocos de 10");
    ok(big < 230 * 1024, `maior bloco: ${Math.round(big / 1024)} KB (limite 256 KB)`);
    ok(simDoc && simDoc.size < 60 * 1024, `bloco do simulado: ${Math.round(simDoc.size / 1024)} KB`);
    await u.tap("#takeGo"); await u.waitFor(() => !!document.querySelector("#tkClock"));
    ok(/^0?9:00:00$|^08:59:5\d$/.test(await u.st(() => document.querySelector("#tkClock").textContent)), "cronômetro do ENEM começa em 9 horas");
    await u.tap("#tkExit");
    await reload(A); await cloudReady(A, 20000);
    ok(await u.st(id => SIMS[id].q.filter(x => x.qt).length === 180, id), "depois de recarregar, as 180 questões continuam");
    await settle([A, P], 30000);
    ok(await ev(P, id => SIMS[id] && SIMS[id].q.filter(x => x.qt).length === 180, id), "iPad recebe as 180 questões");
  });

  section("sem erros no console");
  ok(errorsOf(A, cloud).length === 0 && errorsOf(P, cloud).length === 0, "nenhum erro: " + JSON.stringify(errorsOf(A, cloud).concat(errorsOf(P, cloud)).slice(0, 5)));
  await A.page.screenshot({ path: path.join(SHOTS, "gerar-pc.png") });
  await A.context.close(); await P.context.close();

  section("link sem permissão de salvar na nuvem");
  const c2 = new Cloud(); c2.inject("set", "invalid_argument", 999); c2.inject("update", "invalid_argument", 999);
  const V = await openDevice(browser, c2, { device: "desktop", name: "visitante" }); const uv = U(V); R.dev = V;
  await V.frame.waitForFunction(() => Cloud.ready, null, { timeout: 10000 });
  await step("aviso certo e dados guardados no aparelho", async () => {
    await uv.go("pendencias"); await uv.fill("#tText", "Tarefa do visitante"); await uv.tap("#taskForm [data-submit]");
    await uv.waitFor(() => Cloud.readonly, null, 8000);
    const txt = await uv.st(() => document.querySelector("#syncTxt").textContent);
    ok(/não deixa salvar na nuvem/.test(txt) && !/grandes demais/.test(txt), "status: " + txt);
    await sleep(500); await reload(V);
    ok(await uv.st(() => S.tasks.some(t => t.text === "Tarefa do visitante")), "a tarefa continua no aparelho depois de recarregar");
  });
  await V.context.close();
  R.dev = null;
}
module.exports = { scenarioGerar };
