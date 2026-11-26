// Cartões da IA: salvos na hora, e o pedido continua sozinho quando o aluno sai do app (no iPad o Memora reabre do zero).
const H = require("./harness"); const { Cloud, openDevice, ev, cloudReady, settle, sleep, R, ok, section, step } = H;
const { U } = require("./walkthrough");
const errorsOf = (dev, cloud) => [...dev.errors, ...cloud.events.filter(e => e.name === "error").map(e => e.msg)].filter(e => !/favicon|net::ERR/.test(e));
// simula o aluno saindo do app e voltando (o iPad esconde a página antes de suspender)
const hide = d => ev(d, () => {
  if (!window.__visPatched) { Object.defineProperty(document, "visibilityState", { configurable: true, get: () => window.__vis || "visible" }); Object.defineProperty(document, "hidden", { configurable: true, get: () => window.__vis === "hidden" }); window.__visPatched = 1; }
  window.__vis = "hidden"; document.dispatchEvent(new Event("visibilitychange"));
});
const show = d => ev(d, () => { window.__vis = "visible"; document.dispatchEvent(new Event("visibilitychange")); });
const cloudJob = cloud => { const it = cloud.items("kv")["s.aiJob"]; return it && !it._d && it.v ? it.v : null; };
async function until(fn, t = 10000) { const t0 = Date.now(); while (Date.now() - t0 < t) { if (await fn()) return true; await sleep(100); } return false; }

async function scenarioCartoes(browser) {
  const cloud = new Cloud();
  section("[ipad] pedir 40 cartões de Biologia");
  const A = await openDevice(browser, cloud, { device: "ipad", name: "ipad-1" }); A.touch = true; const ua = U(A); R.dev = A;
  await cloudReady(A);
  await step("os 40 cartões ficam salvos sozinhos, no baralho Biologia que já existia", async () => {
    await ev(A, () => { S.decks.push({ id: "dk-bio", name: "Biologia", subject: "Biologia", createdAt: Date.now() }); commit("decks"); });
    cloud.deckName = "Biologia"; cloud.deckSubject = "Biologia";
    await ua.go("ia");
    await ua.fill("#aiPrompt", "40 flash cards de biologia"); await ua.fill("#aiCount", "40");
    await ua.tap("#aiGo");
    await ua.waitFor(() => !genBusy && GEN.length === 40, null, 10000);
    const r = await ua.st(() => ({ n: deckCards("dk-bio").length, decks: S.decks.filter(d => hnorm(d.name) === "biologia").length, job: !!S.settings.aiJob }));
    ok(r.n === 40 && r.decks === 1, `40 cartões no baralho Biologia (${r.n}), sem criar outro baralho com o mesmo nome`);
    ok(!r.job, "pedido concluído sai da fila");
    ok(/40 cartões salvos em "Biologia"/.test(await ua.toast()), "aviso: " + await ua.toast());
    ok(await ua.st(() => !document.querySelector("#genSave") && /40 cartões já salvos em "Biologia"/.test(document.querySelector("#view").textContent)), "a lista avisa que já estão salvos (sem botão Salvar)");
    await settle([A]);
    ok(cloud.live("card").filter(c => c.deck === "dk-bio").length === 40 && !cloudJob(cloud), "os 40 já estão na nuvem e o pedido foi encerrado lá também");
  });
  await step("ajustar, apagar, desfazer e estudar pela lista", async () => {
    await ua.st(() => { const t = document.querySelector('.gen .gcard:nth-child(2) [data-gf="front"]'); t.value = "Pergunta editada"; t.dispatchEvent(new Event("input")); t.dispatchEvent(new Event("blur")); });
    ok(await ua.st(() => deckCards("dk-bio").some(c => c.front === "Pergunta editada")), "ajuste feito na lista vale para o cartão salvo");
    await ua.tap(".gen .gcard:nth-child(1) [data-gd]");
    ok(await ua.st(() => deckCards("dk-bio").length === 39), "apagar um cartão pela lista");
    await ua.undo();
    ok(await ua.st(() => deckCards("dk-bio").length === 40 && document.querySelectorAll(".gen .gcard").length === 40), "desfazer traz o cartão de volta para o baralho e para a lista");
    await ua.tap("#genStudy");
    await ua.waitFor(() => route === "flashcards" && !!studyState);
    ok(await ua.st(() => studyState.queue.length === 40), "Estudar agora abre os 40 cartões novos");
    await ua.st(() => { studyState = null; go("ia"); });
  });
  await step("apagar todos de uma vez: um item só na lixeira e desfazer traz os 40", async () => {
    await ua.tap("#genUndo"); await ua.ok();
    ok(await ua.st(() => deckCards("dk-bio").length === 0 && S.trash.filter(t => t.kind === "cards").length === 1 && S.trash.find(t => t.kind === "cards").data.ids.length === 40), "os 40 vão para a lixeira como um item só");
    await ua.undo();
    ok(await ua.st(() => deckCards("dk-bio").length === 40 && !S.trash.some(t => t.kind === "cards")), "desfazer traz os 40 de volta");
  });

  section("[ipad] sair do app no meio: o iPad reabre o Memora do zero");
  let B = null, ub = null;
  await step("ao voltar, a criação continua sozinha e os cartões entram uma vez só", async () => {
    await ua.st(() => { GEN = []; render(); });
    cloud.cardDelay = 5000;
    await ua.fill("#aiPrompt", "40 cartões de genética"); await ua.fill("#aiCount", "40");
    await ua.tap("#aiGo"); await ua.waitFor(() => !!genBusy);
    ok(await until(() => { const j = cloudJob(cloud); return j && /genética/.test(j.form.prompt); }, 8000), "o pedido fica guardado na nuvem enquanto a IA trabalha");
    await hide(A);                                   // o aluno sai do app
    ok(await until(() => { const j = cloudJob(cloud); return j && j.away; }, 8000), "ao sair do app, a nuvem fica sabendo");
    await A.context.close();                         // o iPad descarta a página no fundo
    cloud.cardDelay = 0;
    B = await openDevice(browser, cloud, { device: "ipad", name: "ipad-2" }); B.touch = true; ub = U(B); R.dev = B;   // abre de novo, sem memória local
    await cloudReady(B, 15000);
    await ub.waitFor(() => !genBusy && deckCards("dk-bio").length === 80, null, 30000);
    const calls = cloud.aiCalls.filter(c => /40 cartões de genética/.test(c.prompt));
    ok(calls.length === 2 && calls[1].page === "ipad-2", "o Memora reaberto refez o pedido sozinho");
    ok(await ub.st(() => !S.settings.aiJob && GEN.length === 40), "pedido encerrado e os 40 novos aparecem na lista");
    await settle([B]);
    ok(cloud.live("card").filter(c => c.deck === "dk-bio").length === 80, "nuvem com 80 cartões no baralho, sem repetição");
  });

  section("[ipad] app em segundo plano e a IA falha no meio");
  await step("o pedido é refeito quando o aluno volta ao app", async () => {
    cloud.inject("ai", "unavailable", 1, "Memora IA, especialista");
    await hide(B);
    await ub.st(() => { GEN = []; aiForm = { ...aiForm, prompt: "20 cartões de ecologia", count: 20, deck: "dk-bio", newDeck: "" }; generate(); });
    await ub.waitFor(() => !genBusy && !!S.settings.aiJob && S.settings.aiJob.form.prompt === "20 cartões de ecologia", null, 8000);
    ok(await ub.st(() => deckCards("dk-bio").length === 80), "com o app no fundo, a falha não apaga nem duplica nada e o pedido fica guardado");
    await show(B);
    await ub.waitFor(() => !genBusy && !S.settings.aiJob && deckCards("dk-bio").length === 100, null, 15000);
    ok(true, "ao voltar, os 20 cartões são criados e salvos");
  });

  section("dois aparelhos abertos ao mesmo tempo");
  const C = await openDevice(browser, cloud, { device: "desktop", name: "pc" }); const uc = U(C);
  await cloudReady(C);
  await step("pedido em andamento num aparelho não é repetido no outro", async () => {
    cloud.cardDelay = 3000;
    await uc.st(() => { aiForm = { ...aiForm, prompt: "10 cartões de citologia", count: 10, deck: "dk-bio", newDeck: "" }; generate(); });
    await uc.waitFor(() => !genBusy, null, 15000);
    cloud.cardDelay = 0;
    await settle([B, C]); await sleep(1500);
    ok(cloud.aiCalls.filter(c => /10 cartões de citologia/.test(c.prompt)).length === 1, "só o computador pediu à IA");
    ok(await ev(B, () => deckCards("dk-bio").length) === 110, "o iPad recebe os 10, sem duplicar");
  });
  await step("aparelho que foi para o fundo é substituído pelo outro, sem duplicar", async () => {
    R.dev = C;
    cloud.cardDelay = 20000;
    await uc.st(() => { aiForm = { ...aiForm, prompt: "10 cartões de evolução", count: 10, deck: "dk-bio", newDeck: "" }; generate(); });
    await uc.waitFor(() => !!genBusy); await sleep(400);
    cloud.cardDelay = 0;                              // a chamada do computador já começou e vai demorar
    await hide(C);
    await B.frame.waitForFunction(() => deckCards("dk-bio").length === 120, null, { timeout: 30000 });
    ok(cloud.aiCalls.filter(c => /10 cartões de evolução/.test(c.prompt)).map(c => c.page).join() === "pc,ipad-2", "o iPad assumiu o pedido do computador que foi para o fundo");
    await show(C);
    await uc.waitFor(() => !genBusy, null, 30000);
    await settle([B, C]); await sleep(800);
    const n = [await ev(C, () => deckCards("dk-bio").length), await ev(B, () => deckCards("dk-bio").length)];
    ok(n[0] === 120 && n[1] === 120, `quando o computador volta, ele não salva de novo (${n.join(" e ")} cartões)`);
  });

  section("aparelhos sem repetição");
  await step("cada aparelho aparece uma vez em Dados", async () => {
    R.dev = B;
    await ev(B, () => { for (let i = 0; i < 6; i++) DEVICES["dold" + i] = { name: "iPad (app da tela de início)", first: Date.now() - 86400000 * (i + 1), last: Date.now() - 86400000 * (i + 1) }; diffKind("dev", Object.keys(DEVICES)); touchDevice(true); go("dados"); });
    const r = await ev(B, () => ({ n: Object.values(DEVICES).filter(d => d.name === "iPad (app da tela de início)").length, rows: [...document.querySelectorAll("#devList .item .t")].map(x => x.textContent.replace("este", "").trim()) }));
    ok(r.n === 3, `guarda só os 3 registros mais novos de cada aparelho (${r.n})`);
    ok(r.rows.length === new Set(r.rows).size && r.rows.length === 3, "lista sem nomes repetidos: " + r.rows.join(" | "));
    await settle([B, C]);
    ok(Object.values(cloud.items("dev")).filter(d => !d._d && d.name === "iPad (app da tela de início)").length === 3, "na nuvem também ficam só 3");
  });

  section("sem erros no console");
  ok(errorsOf(B, cloud).length === 0 && errorsOf(C, cloud).length === 0, "nenhum erro: " + JSON.stringify(errorsOf(B, cloud).concat(errorsOf(C, cloud)).slice(0, 5)));
  await B.context.close(); await C.context.close();
  R.dev = null;
}
module.exports = { scenarioCartoes };
