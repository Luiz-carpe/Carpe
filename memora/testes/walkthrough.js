// Percorre TODAS as abas e ações do Memora num aparelho (clique no computador, toque no iPad).
const { ev, settle, sleep, ok, section, step } = require("./harness");

function U(dev) {
  const loc = s => dev.app.locator(s).first();
  const u = {
    loc,
    async tap(s, o) { const l = loc(s); await l.waitFor({ state: "visible", timeout: 8000 }); if (dev.touch) await l.tap(o); else await l.click(o); },
    async fill(s, v) { await loc(s).fill(String(v)); },
    async change(s, v) { const l = loc(s); await l.fill(String(v)); await l.dispatchEvent("change"); },
    async pick(s, v) { await loc(s).selectOption(v); },
    async ok() { await u.tap(".ov [data-ok]"); },
    async waitFor(fn, arg, t = 8000) { await dev.frame.waitForFunction(fn, arg, { timeout: t }); },
    async go(r) {
      const narrow = await ev(dev, () => innerWidth <= 760);
      if (narrow && !["painel", "pendencias", "tempo", "flashcards"].includes(r)) { await u.tap("#moreBtn"); await u.tap(`.moregrid a[href="#${r}"]`); }
      else await u.tap(`#nav a[href="#${r}"]`);
      await u.waitFor(r => route === r && !document.querySelector(".ov"), r);
    },
    toast: async () => (await dev.app.locator(".toast").first().textContent().catch(() => "")) || "",
    async undo() { await u.tap(".toast [data-undo]"); },
    st: (fn, a) => ev(dev, fn, a),
    async closeModals() { for (let i = 0; i < 4; i++) { const n = await ev(dev, () => document.querySelectorAll(".ov").length); if (!n) return; await dev.page.keyboard.press("Escape"); await sleep(80); } }
  };
  return u;
}
const day = n => { const d = new Date(Date.now() + n * 86400000); return d.toISOString().slice(0, 10); };

async function walkthrough(dev, files) {
  const u = U(dev); const cloud = dev.cloud; const tag = `[${dev.name}] `; require("./harness").R.dev = dev;

  section(tag + "Dados: matérias e preferências");
  await step("matérias", async () => {
    await u.go("dados");
    for (const n of ["Química", "Biologia", "Física", "Matemática", "História"]) { await u.fill("#newSubj", n); await u.tap("#subjForm [data-submit]"); await u.waitFor(n => subjects().some(s => s.name === n), n); }
    ok((await u.st(() => subjects().map(s => s.name).join(","))) === "Química,Biologia,Física,Matemática,História", "5 matérias na ordem em que foram criadas");
    await u.st(() => { const i = document.querySelector('[data-subj="0"] [data-c]'); i.value = "#123456"; i.dispatchEvent(new Event("change")); });
    ok(await u.st(() => subjects()[0].color === "#123456"), "cor da matéria alterada");
    await u.tap('[data-subj="4"] [data-ren]'); await u.fill("#renS", "História do Brasil"); await u.ok();
    ok(await u.st(() => subjects().some(s => s.name === "História do Brasil")), "matéria renomeada");
    await u.tap('[data-subj="3"] [data-del]'); await u.ok();
    ok(await u.st(() => !subjects().some(s => s.name === "Matemática")), "matéria removida");
    await u.undo(); await u.waitFor(() => subjects().some(s => s.name === "Matemática"));
    ok(true, "Desfazer trouxe a matéria de volta");
    await u.change("#goal", 300); ok(await u.st(() => S.settings.goalMin === 300), "meta diária 300 min");
    await u.tap('[data-acc="menta"]'); ok(await u.st(() => document.documentElement.dataset.accent === "menta"), "cor de destaque menta");
    await u.tap("#light"); ok(await u.st(() => document.documentElement.classList.contains("light")), "tema claro ligado");
    await u.tap("#light"); ok(await u.st(() => !document.documentElement.classList.contains("light")), "tema claro desligado");
    await settle([dev]);
    ok(cloud.live("subj").length === 5 && cloud.live("kv").find(k => k.id === "s.goalMin")?.v === 300, "matérias e meta salvas na nuvem");
  });

  section(tag + "Pendências");
  await step("pendências", async () => {
    await u.go("pendencias");
    await u.fill("#tText", "Lista de estequiometria"); await u.pick("#tSubj", "Química"); await u.pick("#tPrio", "alta"); await u.fill("#tDue", day(2)); await u.tap("#taskForm [data-submit]");
    await u.fill("#tText", "Revisar genética"); await dev.page.keyboard.press("Enter");
    await u.fill("#tText", "Resumo Era Vargas"); await u.tap("#taskForm [data-submit]");
    await u.waitFor(() => S.tasks.length === 3);
    ok(true, "3 pendências criadas (botão e tecla Enter)");
    const id1 = await u.st(() => S.tasks.find(t => t.text === "Lista de estequiometria").id);
    await u.tap(`[data-task="${id1}"] [data-act="toggle"]`); ok(await u.st(id => S.tasks.find(t => t.id === id).status === "doing", id1), "tarefa em andamento (tempo contando)");
    await sleep(1100);
    await u.tap(`[data-task="${id1}"] [data-act="pause"]`); ok(await u.st(id => { const t = S.tasks.find(t => t.id === id); return !t.runStart && t.work > 0.5; }, id1), "pausar guarda o tempo gasto");
    await u.tap(`[data-task="${id1}"] [data-act="pause"]`); ok(await u.st(id => !!S.tasks.find(t => t.id === id).runStart, id1), "retomar");
    await u.tap(`[data-task="${id1}"] [data-act="toggle"]`); ok(await u.st(id => S.tasks.find(t => t.id === id).status === "done", id1), "concluir");
    const id2 = await u.st(() => S.tasks.find(t => t.text === "Revisar genética").id);
    await u.tap(`[data-task="${id2}"] [data-act="edit"]`); await u.fill("#eText", "Revisar genética mendeliana"); await u.fill("#eNote", "Leis de Mendel"); await u.pick("#eSubj", "Biologia"); await u.fill("#eWork", "45"); await u.ok();
    ok(await u.st(id => { const t = S.tasks.find(t => t.id === id); return t.text === "Revisar genética mendeliana" && t.note === "Leis de Mendel" && Math.round(t.work / 60) === 45; }, id2), "editar pendência (texto, nota, matéria, tempo)");
    await u.pick("#tFiltSubj", "Biologia"); ok((await u.st(() => document.querySelectorAll("#view [data-task]").length)) === 1, "filtro por matéria");
    await u.pick("#tFiltSubj", "");
    const id3 = await u.st(() => S.tasks.find(t => t.text === "Resumo Era Vargas").id);
    await u.tap(`[data-task="${id3}"] [data-act="del"]`); await u.ok(); ok(await u.st(id => !S.tasks.some(t => t.id === id), id3), "excluir pendência");
    await u.undo(); await u.waitFor(id => S.tasks.some(t => t.id === id), id3); ok(true, "desfazer exclusão");
    await u.tap("#clearDone"); await u.ok(); ok(await u.st(() => !S.tasks.some(t => t.status === "done") && S.trash.some(e => e.kind === "tasks")), "limpar concluídas (vão para a lixeira)");
    await settle([dev]);
    ok(cloud.live("task").length === 2, "nuvem tem as 2 pendências restantes");
  });

  section(tag + "Tempo e Pomodoro");
  await step("cronômetro livre", async () => {
    await u.go("tempo");
    await u.pick("#tmSubj", "Biologia"); await u.tap("#tStart"); await sleep(300);
    await u.tap("#tPause"); await u.tap("#tStart");
    await u.st(() => { S.timer.startedAt -= 125000; commit("timer"); });
    await u.tap("#tStop");
    ok(await u.st(() => S.sessions.some(s => s.subject === "Biologia" && s.dur >= 125 && s.dur < 140)), "encerrar e salvar registra a sessão");
    await u.tap("#tStart"); await u.st(() => { S.timer.startedAt -= 60000; commit("timer"); render(); });
    await u.tap("#tReset"); await u.ok(); ok(await u.st(() => !S.timer.running && !S.timer.acc && S.sessions.length === 1), "descartar não registra");
    await u.pick("#mSubj", "Física"); await u.fill("#mH", "1"); await u.fill("#mM", "15"); await u.tap("#manForm [data-submit]");
    ok(await u.st(() => S.sessions.some(s => s.subject === "Física" && s.dur === 4500)), "sessão manual 1h15");
    const sid = await u.st(() => S.sessions.find(s => s.subject === "Física").id);
    await u.tap(`[data-ses="${sid}"] [data-act="del"]`); await u.ok(); ok(await u.st(id => !S.sessions.some(s => s.id === id), sid), "excluir sessão");
    await u.undo(); await u.waitFor(id => S.sessions.some(s => s.id === id), sid); ok(true, "desfazer sessão");
  });
  await step("pomodoro termina fora da aba Tempo (bug 3)", async () => {
    await u.tap('#tmode [data-m="pomodoro"]'); await u.change("#pomoMin", "25"); await u.pick("#tmSubj", "Química");
    await u.tap("#tStart");
    const before = await u.st(() => S.sessions.length);
    await u.go("painel");
    await u.st(() => { S.timer.startedAt -= 31 * 60000; });      // 31 min se passaram com o app em outra aba
    await u.waitFor(() => /Pomodoro concluído/.test(document.querySelector(".ov")?.textContent || ""), null, 5000);
    const r = await u.st(b => ({ n: S.sessions.length - b, last: S.sessions[S.sessions.length - 1], running: S.timer.running, route }), before);
    ok(r.n === 1 && r.last.dur === 1500 && r.last.subject === "Química", "registrou exatamente 25 min (e não 31) estando no Painel");
    ok(!r.running && r.route === "painel", "cronômetro zerado sem precisar abrir a aba Tempo");
    await u.tap(".ov [data-x]");
    await u.go("tempo"); await u.tap('#tmode [data-m="livre"]');
  });

  section(tag + "Provas");
  await step("provas", async () => {
    await u.go("provas");
    await u.fill("#exName", "Fuvest — 1ª fase"); await u.fill("#exDate", day(20)); await u.fill("#exNote", "Pacaembu"); await u.tap("#exForm [data-submit]");
    await u.fill("#exName", "Unesp"); await u.fill("#exDate", day(45)); await u.tap("#exForm [data-submit]");
    const ex = await u.st(() => S.exams.find(e => e.name.startsWith("Fuvest")).id);
    await u.fill(`#et-${ex}`, "Resolver prova de 2025"); await dev.page.keyboard.press("Enter");
    await u.fill(`#et-${ex}`, "Revisar redação"); await u.tap(`[data-exam="${ex}"] [data-etform] [data-submit]`);
    ok(await u.st(id => S.exams.find(e => e.id === id).tasks.length === 2, ex), "2 tarefas até a prova");
    await u.tap(`[data-exam="${ex}"] [data-et] [data-eact="toggle"]`); ok(await u.st(id => S.exams.find(e => e.id === id).tasks.some(t => t.done), ex), "marcar tarefa da prova");
    await u.tap(`[data-exam="${ex}"] [data-et] [data-eact="del"]`); await u.undo(); await u.waitFor(id => S.exams.find(e => e.id === id).tasks.length === 2, ex); ok(true, "excluir e desfazer tarefa da prova");
    await u.tap(`[data-exam="${ex}"] [data-act="edit"]`); await u.fill("#eeName", "Fuvest 1ª fase"); await u.ok();
    ok(await u.st(id => S.exams.find(e => e.id === id).name === "Fuvest 1ª fase", ex), "editar prova");
    const un = await u.st(() => S.exams.find(e => e.name === "Unesp").id);
    await u.tap(`[data-exam="${un}"] [data-act="del"]`); await u.ok(); ok(await u.st(() => !S.exams.some(e => e.name === "Unesp")), "excluir prova (vai para a lixeira)");
  });

  section(tag + "Horários");
  await step("horários e rotina com IA", async () => {
    await u.go("horarios");
    await u.tap("#addBlk"); await u.fill("#bTitle", "Exercícios"); await u.pick("#bSubj", "Química"); await u.fill("#bStart", "14:00"); await u.fill("#bEnd", "15:30"); await u.tap("#bRep"); await u.ok();
    ok(await u.st(() => S.agenda.filter(b => b.title === "Exercícios").length === 5), "bloco repetido de segunda a sexta");
    const b = await u.st(() => S.agenda[0].id);
    await u.tap(`[data-blk="${b}"]`); await u.fill("#bEnd", "16:00"); await u.ok(); ok(await u.st(id => S.agenda.find(x => x.id === id).end === "16:00", b), "editar bloco");
    await u.tap(`[data-blk="${b}"]`); await u.tap(".ov [data-del]"); ok(await u.st(id => !S.agenda.some(x => x.id === id), b), "excluir bloco");
    await u.tap("#aiPlan"); await u.fill("#plPref", "Aula de manhã. Estudo das 14h às 18h."); await u.ok();
    await u.waitFor(() => /Adicionar 2 blocos/.test(document.querySelector(".ov [data-ok]")?.textContent || ""));
    await u.ok(); ok(await u.st(() => S.agenda.some(x => x.title === "Exercícios de equilíbrio")), "rotina com IA: 2 blocos válidos adicionados (o inválido foi descartado)");
  });

  section(tag + "Flashcards");
  await step("baralho e cartões", async () => {
    await u.go("flashcards");
    await u.tap("#newDeck"); await u.fill("#dName", "Química — Equilíbrio"); await u.pick("#dSubj", "Química"); await u.ok();
    const d = await u.st(() => S.decks.find(x => x.name === "Química — Equilíbrio").id);
    await u.tap(`[data-deck="${d}"] [data-act="add"]`); await u.fill("#cFront", "O que é Ka?"); await u.fill("#cBack", "Constante de acidez"); await u.fill("#cTags", "ácidos, equilíbrio");
    await dev.page.keyboard.press("Control+Enter");
    await u.waitFor(() => liveCards().length === 1);
    await u.fill("#cFront", "Kw a 25 °C?"); await u.fill("#cBack", "1,0 × 10⁻¹⁴"); await u.ok();
    ok(await u.st(() => liveCards().length === 2), "2 cartões (Ctrl+Enter salva e abre outro)");
    await u.tap(`[data-deck="${d}"] [data-act="open"]`);
    await u.tap("#bulk"); await u.fill("#bulkTxt", "pH neutro?;7\nÁcido forte?;Ioniza totalmente\nlinha inválida"); await u.ok();
    ok(await u.st(() => liveCards().length === 4), "colar em lote (2 válidas)");
    await u.fill("#fcSearch", "Kw"); await u.waitFor(() => document.querySelectorAll("#view [data-card]").length === 1); ok(true, "busca nos cartões");
    await u.fill("#fcSearch", "");
    const cid = await u.st(() => liveCards().find(c => c.front === "pH neutro?").id);
    await u.tap(`[data-card="${cid}"] [data-act="edit"]`); await u.fill("#cBack", "7 (a 25 °C)"); await u.ok(); ok(await u.st(id => CARDS[id].back === "7 (a 25 °C)", cid), "editar cartão");
    await u.tap(`[data-card="${cid}"] [data-act="del"]`); await u.ok(); ok(await u.st(id => CARDS[id].deleted, cid), "excluir cartão");
    await u.undo(); await u.waitFor(id => !CARDS[id].deleted, cid); ok(true, "desfazer cartão");
    await u.tap("#back");
  });
  await step("estudar (teclado e toque), errar e revisar o que errou", async () => {
    const d = await u.st(() => S.decks[0].id);
    await u.tap(`[data-deck="${d}"] [data-act="study"]`);
    await u.tap("#show"); await u.tap("#explain");
    await u.waitFor(() => /Ka mede/.test(document.querySelector(".fc .note")?.textContent || ""));
    ok(true, "Explicar melhor com IA");
    await u.tap('[data-r="0"]');                                      // errei
    await dev.page.keyboard.press("Space"); await dev.page.keyboard.press("3");   // lembrei (teclado)
    for (let i = 0; i < 6; i++) { const done = await u.st(() => studyState.i >= studyState.queue.length); if (done) break; await u.tap("#show"); await u.tap('[data-r="2"]'); }
    await u.waitFor(() => studyState.i >= studyState.queue.length);
    ok(await u.st(() => /os? .*que errei|cartão que errei/.test(document.querySelector("#again")?.textContent || "")), "botão Revisar o que errei aparece");
    await u.tap("#again"); ok(await u.st(() => studyState.queue.length === 1), "revisa só o cartão errado");
    await u.tap("#show"); await u.tap('[data-r="3"]');
    ok(await u.st(() => Object.values(S.revlog).reduce((a, r) => a + r.n, 0) >= 6), "revisões contadas no dia");
    await u.tap("#endStudy");
  });

  section(tag + "Memora IA (com fotos e PDF)");
  await step("gerar com foto", async () => {
    await u.go("ia");
    await u.fill("#aiPrompt", "Crie cartões de equilíbrio iônico"); await u.fill("#aiCount", "6");
    await dev.app.locator("#aiFile").setInputFiles([{ name: "foto.png", mimeType: "image/png", buffer: files.png }, { name: "scan.bmp", mimeType: "image/bmp", buffer: files.bmp }]);
    await u.waitFor(() => ATT.length === 2);
    await u.tap("#aiGo");
    await u.waitFor(() => GEN.length === 6, null, 10000);
    const call = dev.cloud.aiCalls.filter(c => c.page === dev.name).pop();
    ok(call && call.images.length === 2 && call.images.every(i => ["image/png", "image/jpeg"].includes(i.type)), "a IA recebeu as 2 fotos (a BMP foi convertida para JPEG)");
    await u.tap('[data-g="0"] [data-gt]');
    await u.st(() => { const t = document.querySelector('[data-g="1"] [data-gf="front"]'); t.value = "Pergunta editada"; t.dispatchEvent(new Event("input")); });
    await u.tap("#genSave");
    ok(await u.st(() => { const dk = S.decks.find(d => d.name === "Equilíbrio iônico"); return dk && deckCards(dk.id).length === 5 && deckCards(dk.id).some(c => c.front === "Pergunta editada"); }), "5 cartões salvos (1 desmarcado, 1 editado) em baralho novo");
  });
  await step("gerar a partir de PDF", async () => {
    await dev.app.locator("#aiFile").setInputFiles([{ name: "apostila.pdf", mimeType: "application/pdf", buffer: files.pdf }]);
    await u.waitFor(() => ATT.some(a => a.kind === "pdf" && /texto extraído/.test(a.status || "")), null, 15000);
    await u.st(() => { ATT = ATT.filter(a => a.kind === "pdf"); });
    await u.tap("#aiGo"); await u.waitFor(() => !genBusy && GEN.length > 0, null, 10000);
    const call = dev.cloud.aiCalls.filter(c => c.page === dev.name).pop();
    ok(call && /Henderson-Hasselbalch/.test(call.prompt), "texto do PDF foi enviado para a IA");
    await u.tap("#genClear"); await u.ok();
  });
  await step("reforçar pontos fracos", async () => {
    await u.tap("#aiWeak"); await u.waitFor(() => !genBusy, null, 10000);
    const call = dev.cloud.aiCalls.filter(c => c.page === dev.name).pop();
    ok(call && /erra repetidamente/.test(call.prompt), "pedido inclui os cartões que você mais erra");
    await u.st(() => { GEN = []; render(); });
  });
  await step("importar planilha", async () => {
    await u.tap('#iaTabs [data-t="importar"]');
    await u.fill("#impText", "frente;verso;tags\nCapital da França;Paris;geo\nH2O;Água;quimica\nH2O;Água;quimica");
    await u.waitFor(() => /Importar 2 cartões/.test(document.querySelector("#impGo")?.textContent || ""));
    await u.fill("#impNew", "Importados CSV"); await u.tap("#impGo");
    ok(await u.st(() => { const dk = S.decks.find(d => d.name === "Importados CSV"); return dk && deckCards(dk.id).length === 2; }), "importou e pulou o repetido");
    await dev.app.locator("#impFile").setInputFiles([{ name: "lista.csv", mimeType: "text/csv", buffer: Buffer.from("Pergunta,Resposta\nPi?,3.14\n") }]);
    await u.waitFor(() => /Importar 1 cartão/.test(document.querySelector("#impGo")?.textContent || ""));
    await u.tap("#impGo"); await u.tap("#impOpen");
    ok(await u.st(() => route === "flashcards" && !!fcDeck), "abrir o baralho importado");
    await u.tap("#back");
  });

  section(tag + "Simulados");
  let simId;
  await step("pasta, simulado e correção", async () => {
    await u.go("simulados");
    await u.tap('[data-preset="fuvest"]'); await u.ok();
    await u.tap("#newSim"); await u.ok();
    simId = await u.st(() => simOpen);
    ok(!!simId, "simulado criado e aberto");
    await u.tap('[data-q="0"] [data-r="c"]'); await u.tap('[data-q="1"] [data-r="e"]'); await u.tap('[data-q="2"] [data-r="b"]');
    await u.tap('[data-q="3"] [data-f="g"]');
    await u.pick('[data-q="1"] [data-f="s"]', "Química");
    await u.fill('[data-q="1"] [data-f="c"]', "Estequiometria"); await u.fill('[data-q="1"] [data-f="n"]', "errei a conta"); await sleep(700);
    ok(await u.st(id => { const q = SIMS[id].q; return q[0].r === "c" && q[1].r === "e" && q[2].r === "b" && q[3].g && q[1].s === "Química" && q[1].c === "Estequiometria" && q[1].n === "errei a conta"; }, simId), "acerto, erro, branco, chute, disciplina, conteúdo e anotação");
    await u.tap("#qDist"); await u.fill("#dr", "1-40 Química\n41-80 Biologia"); await u.ok();
    ok(await u.st(id => SIMS[id].q[50].s === "Biologia", simId), "distribuir disciplinas por faixa");
    await u.tap("#qKey"); await u.fill("#kKey", "ABCDE".repeat(16)); await u.fill("#kMine", "ABCDA".repeat(16)); await u.ok();
    ok(await u.st(id => { const s = simStats(SIMS[id]); return s.a === 64 && s.e === 16; }, simId), "corrigir pelo gabarito: 64 acertos, 16 erros");
    await u.tap('#qf [data-f="erros"]'); ok((await u.st(() => document.querySelectorAll("#qlist .qrow").length)) >= 16, "filtro Erros e chutes");
    await u.tap('#qf [data-f="todas"]');
  });
  await step("arquivos do simulado", async () => {
    await u.tap('[data-fup="prova"]');
    await dev.app.locator("#simFile").setInputFiles([{ name: "prova.pdf", mimeType: "application/pdf", buffer: files.pdf }]);
    await u.waitFor(id => (SIMS[id].files || []).some(f => f.kind === "prova"), simId, 10000);
    const href = await dev.app.locator('a[href^="/_blob/"]').first().getAttribute("href");
    const st = await u.st(h => fetch(h).then(r => r.status), href);
    ok(st === 200, "anexar prova e abrir o arquivo");
    await u.tap('[data-fup="gabarito"]');
    await dev.app.locator("#simFile").setInputFiles([{ name: "gab.png", mimeType: "image/png", buffer: files.png }]);
    await u.waitFor(id => SIMS[id].files.length === 2, simId, 10000);
    await u.tap('[data-frm="gabarito"]'); await u.ok(); await u.waitFor(id => SIMS[id].files.length === 1, simId);
    ok(true, "remover arquivo");
  });
  await step("levantamento e resolução com IA", async () => {
    await u.tap("#simAI"); await u.waitFor(id => !!SIMS[id].analysis, simId, 15000);
    ok(await u.st(id => SIMS[id].analysis.conteudos.length === 2 && SIMS[id].q[12].c === "Queda livre", simId), "levantamento pronto e conteúdos preenchidos");
    const lastAI = dev.cloud.aiCalls.filter(c => c.page === dev.name).pop();
    ok(/Henderson-Hasselbalch/.test(lastAI.prompt), "a IA leu a prova anexada");
    await u.tap("#simTasks"); ok(await u.st(() => S.tasks.some(t => t.text === "Estudar Estequiometria — rendimento" && t.prio === "alta")), "levantamento → pendências");
    await u.tap('[data-q="1"] [data-ai]');
    await dev.app.locator("#rFile").setInputFiles([{ name: "q2.png", mimeType: "image/png", buffer: files.png }]);
    await u.tap("#rGo"); await u.waitFor(() => /RESOLUÇÃO PASSO A PASSO/.test(document.querySelector("#rOut")?.textContent || ""));
    const call = dev.cloud.aiCalls.filter(c => c.page === dev.name).pop();
    ok(call.images.length === 1 && call.tier === "complex", "resolução recebeu a foto da questão");
    await u.tap("#rSave"); ok(await u.st(id => /PEGADINHA/.test(SIMS[id].q[1].res || ""), simId), "resolução guardada no simulado");
    await u.tap(".ov [data-x]");
  });
  await step("redação", async () => {
    await u.tap("#essayEdit"); await u.fill("#esTheme", "Valorização de comunidades tradicionais");
    await u.tap(".ov details summary");
    const comps = [160, 120, 140, 160, 120];
    for (let i = 0; i < 5; i++) await dev.app.locator(".esC").nth(i).fill(String(comps[i]));
    await u.fill("#esFb", "Repertório fraco"); await u.ok();
    ok(await u.st(id => SIMS[id].essay && SIMS[id].essay.score === 700 && SIMS[id].essay.max === 1000, simId), "redação com competências soma 700/1000");
    await u.tap("#essayEdit"); await u.tap(".ov [data-del]"); await u.ok(); ok(await u.st(id => !SIMS[id].essay, simId), "remover redação");
    await u.undo(); await u.waitFor(id => !!SIMS[id].essay, simId); ok(true, "desfazer redação");
  });
  await step("caderno de erros a partir do simulado", async () => {
    await u.tap("#qErr"); await u.tap('.ov [data-k="b"]'); await u.ok();
    await u.waitFor(() => route === "erros");
    ok(await u.st(() => S.errors.length >= 16), "os 16 erros foram trazidos para o caderno");
  });

  section(tag + "Caderno de erros");
  await step("caderno", async () => {
    await u.tap("#errAdd"); await u.pick("#erSubj", "Física"); await u.pick("#erReason", "calculo"); await u.fill("#erTopic", "Cinemática"); await u.fill("#erNote", "Esqueci o sinal da aceleração"); await u.ok();
    const eid = await u.st(() => S.errors.find(e => e.topic === "Cinemática").id);
    await u.tap(`[data-err="${eid}"] [data-eact="rev"]`); ok(await u.st(id => S.errors.find(e => e.id === id).reviewed, eid), "marcar como revisado");
    await u.tap('#errTabs [data-s="revisado"]'); ok((await u.st(() => document.querySelectorAll("#view [data-err]").length)) === 1, "aba Revisados");
    await u.tap('#errTabs [data-s="todos"]');
    await u.pick("#errReason", "calculo"); ok((await u.st(() => document.querySelectorAll("#view [data-err]").length)) === 1, "filtro por motivo");
    await u.pick("#errReason", "");
    await u.fill("#errSearch", "sinal"); await u.waitFor(() => document.querySelectorAll("#view [data-err]").length === 1); ok(true, "busca");
    await u.fill("#errSearch", "");
    await u.tap(`[data-err="${eid}"] [data-eact="card"]`); await u.tap("#ecAI"); await u.waitFor(() => document.querySelector("#ecF")?.value === "Como calcular rendimento?");
    await u.ok(); ok(await u.st(() => S.decks.some(d => d.name === "Caderno de erros") && liveCards().some(c => c.source === "erro")), "cartão criado a partir do erro (com sugestão da IA)");
    await u.tap(`[data-err="${eid}"] [data-eact="edit"]`); await u.fill("#erTopic", "Cinemática — MUV"); await u.ok();
    ok(await u.st(id => S.errors.find(e => e.id === id).topic === "Cinemática — MUV", eid), "editar erro");
    await u.tap(`[data-err="${eid}"] [data-eact="del"]`); await u.ok(); await u.undo(); await u.waitFor(id => S.errors.some(e => e.id === id), eid); ok(true, "excluir e desfazer erro");
    const se = await u.st(() => S.errors.find(e => e.source === "sim").id);
    await u.tap(`[data-err="${se}"] [data-eact="open"]`); ok(await u.st(() => route === "simulados" && !!simOpen), "abrir o simulado do erro");
  });

  section(tag + "Estatísticas");
  await step("estatísticas", async () => {
    await u.go("estatisticas");
    ok(await u.st(() => document.querySelectorAll("#view .chart .c").length >= 30), "gráficos de estudo");
    await u.tap("#view .chart .c[title]"); ok(/\d/.test(await u.toast()), "tocar numa barra mostra o valor");
    await u.tap('#stTabs [data-t="simulados"]'); ok(await u.st(() => /Média de acertos/.test(document.querySelector("#view").textContent)), "aba Simulados");
    await u.tap("#view .chart.perf .c[data-sim]"); ok(await u.st(() => route === "simulados" && !!simOpen), "tocar no simulado do gráfico abre ele");
    await u.go("estatisticas"); await u.tap('#stTabs [data-t="estudo"]');
  });

  section(tag + "Dados: lixeira, cópias e sincronização");
  await step("lixeira e cópias", async () => {
    await u.go("dados");
    ok(await u.st(() => document.querySelectorAll("#devList .item").length >= 1), "aparelho listado em 'Aparelhos com esta conta'");
    const n = await u.st(() => S.trash.length);
    await u.tap('[data-tr] [data-trr]'); ok(await u.st(n => S.trash.length === n - 1, n), "restaurar item da lixeira");
    await u.tap('[data-tr] [data-trd]'); await u.ok(); ok(await u.st(n => S.trash.length === n - 2, n), "excluir de vez");
    await u.st(() => document.querySelector("details").open = true);
    await u.tap("#exp"); await sleep(300);
    ok(dev.cloud.downloads.some(d => /^memora-backup-\d{4}-\d\d-\d\d\.json$/.test(d.filename) && d.size > 1000), "baixar cópia (.json)");
    const json = await u.st(() => JSON.stringify(backupObj()));
    await u.fill("#impTxt", json); await u.tap("#impGo"); ok(/mesclad/i.test(await u.toast()), "juntar cópia");
    await u.waitFor(() => AutoBk.st === "on", null, 5000);
    await u.tap("#abkNow"); await u.waitFor(() => AUTOBK.length === 1, null, 8000);
    ok(dev.cloud.assets.size >= 2, "cópia automática guardada na nuvem");
    await u.tap("[data-abk] [data-abkr]"); await u.ok(); await sleep(400); ok(/mesclad/i.test(await u.toast()), "restaurar cópia automática");
    await u.tap("#syncNow"); await sleep(300);
    await u.tap("#trEmpty"); await u.ok(); ok(await u.st(() => S.trash.length === 0), "esvaziar lixeira");
  });
  await settle([dev], 20000);
  section(tag + "Tudo na nuvem");
  ok(await u.st(() => pendingCount() === 0 && /Tudo salvo/.test(document.querySelector("#syncTxt").textContent)), "status: Tudo salvo na nuvem");
}
module.exports = { walkthrough, U, day };
