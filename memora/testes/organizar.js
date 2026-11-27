// Organizar cartões que já existem: achar em qualquer pasta, mover (com desfazer) e organizar em subpastas com a IA.
const path = require("path");
const H = require("./harness"); const { Cloud, openDevice, ev, cloudReady, settle, sleep, R, ok, section, step } = H;
const { U } = require("./walkthrough");
const SHOTS = path.join(__dirname, "shots");
const errorsOf = (dev, cloud) => [...dev.errors, ...cloud.events.filter(e => e.name === "error").map(e => e.msg)].filter(e => !/favicon|net::ERR/.test(e));
const home = dev => ev(dev, () => { studyState = null; orgState = null; fcDeck = null; fcSearch = ""; fcSel = null; go("flashcards"); });
const deckOf = (dev, front) => ev(dev, f => deckPath(liveCards().find(c => c.front === f)?.deck), front);
const idOf = (dev, name, parentName) => ev(dev, ([n, p]) => { const d = S.decks.find(x => x.name === n && (p ? deckParentOf(x)?.name === p : !deckParentOf(x))); return d ? d.id : null; }, [name, parentName || ""]);

async function scenarioOrganizar(browser) {
  const cloud = new Cloud();
  const A = await openDevice(browser, cloud, { device: "ipad", name: "ipad" }); A.touch = true; const u = U(A); R.dev = A;
  await cloudReady(A);
  await ev(A, () => {
    ["Biologia", "Física"].forEach(n => ensureSubject(n)); commit("settings");
    [["dk-bio", "Biologia", "Biologia"], ["dk-fis", "Física", "Física"], ["dk-div", "Diversos", ""]].forEach(([id, name, subject]) => S.decks.push({ id, name, subject, createdAt: Date.now() }));
    commit("decks");
    const add = (deck, f, b, tags = []) => { const c = newCard(deck, f, b, tags); CARDS[c.id] = c; };
    [["O que é mitose?", "Divisão celular"], ["O que é meiose?", "Divisão reducional"], ["Função do ribossomo?", "Síntese de proteínas"], ["O que é DNA?", "Ácido desoxirribonucleico"], ["O que é um gene?", "Trecho de DNA"], ["O que é alelo?", "Forma alternativa de um gene"],
     ["O que é fotossíntese?", "Luz vira glicose", ["botânica"]], ["Função do xilema?", "Leva seiva bruta", ["botânica"]], ["Função do floema?", "Leva seiva elaborada", ["botânica"]], ["O que é cadeia alimentar?", "Quem come quem"], ["O que é bioma?", "Grande comunidade"], ["Capital da França?", "Paris"]].forEach(([f, b, t]) => add("dk-bio", f, b, t));
    add("dk-fis", "Função da mitocôndria?", "Respiração celular");
    add("dk-div", "Fórmula da velocidade média?", "v = Δs/Δt"); add("dk-div", "O que é velocidade instantânea?", "Limite de Δs/Δt");
    add("dk-div", "O que é população?", "Indivíduos da mesma espécie"); add("dk-div", "O que é um gene recessivo?", "Só aparece em homozigose");
    if (diffKind("card", Object.keys(CARDS))) changedLocally();
  });

  section("[ipad] organizar à mão: achar e mover");
  await step("abrir o organizador pela tela de flashcards", async () => {
    await home(A);
    await u.tap("#orgFc");
    ok(await u.st(() => !!orgState && document.querySelectorAll("[data-oc]").length === 17), "Organizar cartões mostra os 17 cartões de todas as pastas");
    ok(await u.st(() => [...document.querySelectorAll("#orgTo option")].map(o => o.textContent).includes("+ Nova pasta ou subpasta…")), "destino pode ser uma pasta nova");
  });
  await step("buscar, mover e desfazer", async () => {
    await u.fill("#orgQ", "mitocondria");
    await u.waitFor(() => document.querySelectorAll("[data-oc]").length === 1);
    ok(true, "busca sem acento acha \"mitocôndria\" (que estava na pasta errada, Física)");
    await u.tap("[data-oc]");
    ok(await u.st(() => document.querySelector("#orgN").textContent) === "1 selecionado", "tocar no cartão seleciona");
    await u.pick("#orgTo", "dk-bio"); await u.tap("#orgMove");
    ok(await deckOf(A, "Função da mitocôndria?") === "Biologia", "mitocôndria foi para Biologia");
    ok(/1 cartão movido para "Biologia"/.test(await u.toast()), "aviso com Desfazer: " + await u.toast());
    await u.undo();
    ok(await deckOf(A, "Função da mitocôndria?") === "Física", "Desfazer devolve o cartão para Física");
    await u.tap("[data-oc]"); await u.pick("#orgTo", "dk-bio"); await u.tap("#orgMove");
    ok(await deckOf(A, "Função da mitocôndria?") === "Biologia", "movido de novo");
  });
  await step("marcar todos os encontrados e mandar para uma subpasta nova", async () => {
    await u.fill("#orgQ", "velocidade");
    await u.waitFor(() => document.querySelectorAll("[data-oc]").length === 2);
    await u.tap("#orgAll"); await u.pick("#orgTo", "__new"); await u.tap("#orgMove");
    await u.fill("#dName", "Cinemática"); await u.pick("#dParent", "dk-fis"); await u.ok();
    ok(await deckOf(A, "Fórmula da velocidade média?") === "Física › Cinemática" && await deckOf(A, "O que é velocidade instantânea?") === "Física › Cinemática", "os 2 foram para a subpasta nova Física › Cinemática");
    ok(await u.st(() => orgState.sel.size === 0 && deckById(orgState.to)?.name === "Cinemática"), "seleção limpa e o destino fica lembrado");
  });
  await step("filtrar por pasta e por etiqueta", async () => {
    await u.fill("#orgQ", "");
    await u.pick("#orgDeck", "dk-div");
    ok(await u.st(() => document.querySelectorAll("[data-oc]").length === 2), "pasta Diversos: 2 cartões");
    await u.tap("#orgAll"); await u.pick("#orgTo", "dk-bio"); await u.tap("#orgMove");
    ok(await u.st(() => deckCards("dk-div").length === 0), "Diversos esvaziou: os 2 foram para Biologia");
    await u.pick("#orgDeck", ""); await u.pick("#orgTag", "botânica");
    ok(await u.st(() => document.querySelectorAll("[data-oc]").length === 3), "etiqueta botânica: 3 cartões");
    await u.tap("#orgAll"); await u.pick("#orgTo", "__new"); await u.tap("#orgMove");
    ok(await u.st(() => document.querySelector("#dParent").value === ""), "pasta nova pode ser principal ou subpasta");
    await u.fill("#dName", "Botânica"); await u.pick("#dParent", "dk-bio"); await u.ok();
    ok(await deckOf(A, "Função do xilema?") === "Biologia › Botânica", "os 3 de botânica foram para Biologia › Botânica");
    await u.pick("#orgTag", "");
  });
  await step("muitos cartões: mostra 200 por vez e move todos de uma vez", async () => {
    await ev(A, () => { S.decks.push({ id: "dk-massa", name: "Massa", subject: "", createdAt: Date.now() }); commit("decks"); const ids = []; for (let i = 0; i < 450; i++) { const c = newCard("dk-massa", `Massa ${i}`, `Resposta ${i}`); CARDS[c.id] = c; ids.push(c.id); } if (diffKind("card", ids)) changedLocally(); render(); });
    await u.pick("#orgDeck", "dk-massa");
    ok(await u.st(() => document.querySelectorAll("[data-oc]").length === 200 && /250 restantes/.test(document.querySelector("#orgMore").textContent)), "200 na tela e o botão Mostrar mais");
    await u.tap("#orgMore");
    ok(await u.st(() => document.querySelectorAll("[data-oc]").length === 400), "Mostrar mais: 400");
    await u.tap("#orgAll");
    ok(await u.st(() => orgState.sel.size === 450), "Marcar os 450 pega também os que não estão na tela");
    const t0 = Date.now();
    await u.pick("#orgTo", "dk-fis"); await u.tap("#orgMove");
    ok(await u.st(() => deckCards("dk-fis").length === 450 && deckCards("dk-massa").length === 0), `450 movidos para Física em ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  });

  section("[ipad] organizar com IA");
  await step("a IA sugere subpastas e nada muda antes de aplicar", async () => {
    await home(A); await u.tap('[data-deck="dk-bio"] [data-act="open"]');
    await u.tap("#orgD");
    ok(await u.st(() => orgState.deck === "t:dk-bio" && !!document.querySelector("#oaGo")), "Organizar cartões dentro da pasta já abre com a IA pronta para Biologia");
    const before = await u.st(() => liveCards().map(c => c.deck).join());
    await u.tap("#oaGo");
    await u.waitFor(() => orgState.ai && orgState.ai.groups, null, 10000);
    const g = await u.st(() => orgState.ai.groups.map(x => `${x.name}:${x.ids.length}:${x.exists ? "existe" : "nova"}`).join(" | "));
    ok(/Citologia:4:nova/.test(g) && /Genética:4:nova/.test(g) && /Ecologia:3:nova/.test(g), "sugestão: " + g);
    ok(/1 cartão fica onde está/.test(await u.st(() => document.querySelector(".orgai").textContent)), "o cartão que não combina com nenhuma subpasta fica onde está");
    ok(await u.st(() => liveCards().map(c => c.deck).join()) === before, "nada mudou antes de aplicar");
    const call = cloud.aiCalls.filter(c => /Você organiza flashcards/.test(c.prompt)).pop();
    ok(call && /Pasta: "Biologia"/.test(call.prompt) && /Botânica/.test(call.prompt), "a IA recebe a pasta e as subpastas que já existem");
  });
  await step("conferir: renomear, desmarcar, aplicar e desfazer", async () => {
    const gi = await u.st(() => orgState.ai.groups.findIndex(x => x.name === "Ecologia"));
    await u.fill(`[data-oag="${gi}"]`, "Ecologia e meio ambiente");
    const gg = await u.st(() => orgState.ai.groups.findIndex(x => x.name === "Genética"));
    const dna = await u.st(() => liveCards().find(c => c.front === "O que é DNA?").id);
    await u.tap(`[data-oac="${gg}"][data-id="${dna}"]`);
    ok(await u.st(() => document.querySelector("#oaApply").textContent) === "Mover 10 cartões", "desmarcar um cartão atualiza o botão (10)");
    await u.tap("#oaApply");
    ok(await deckOf(A, "O que é mitose?") === "Biologia › Citologia" && await deckOf(A, "O que é bioma?") === "Biologia › Ecologia e meio ambiente" && await deckOf(A, "O que é um gene?") === "Biologia › Genética", "cartões nas subpastas novas (com o nome trocado)");
    ok(await deckOf(A, "O que é DNA?") === "Biologia" && await deckOf(A, "Capital da França?") === "Biologia", "o desmarcado e o sem subpasta ficaram soltos");
    ok(/10 cartões foram para 3 subpastas \(3 novas\)/.test(await u.toast()), "aviso: " + await u.toast());
    await u.undo();
    ok(await u.st(() => subDecks("dk-bio").map(s => s.name).join()) === "Botânica" && await deckOf(A, "O que é mitose?") === "Biologia", "Desfazer devolve os cartões e apaga as subpastas que ficaram vazias");
  });
  await step("só com as subpastas que já existem", async () => {
    await u.tap("#oaNew");
    await u.tap("#oaGo"); await u.waitFor(() => orgState.ai && orgState.ai.groups, null, 10000);
    ok(await u.st(() => orgState.ai.groups.length === 0 && /já estão bem organizados/.test(document.querySelector(".orgai").textContent)), "sem criar subpastas e sem nada para a Botânica: avisa que está organizado");
    await u.tap("#oaDiscard"); await u.tap("#oaNew");
  });
  await step("cancelar no meio não muda nada", async () => {
    cloud.orgDelay = 3000;
    await u.tap("#oaGo"); await u.waitFor(() => !!document.querySelector("#oaCancel"));
    await u.tap("#oaCancel");
    await u.waitFor(() => !orgState.ai, null, 8000);
    cloud.orgDelay = 0;
    ok(await deckOf(A, "O que é mitose?") === "Biologia", "cancelado: cartões no mesmo lugar");
  });
  await step("aplicar de vez", async () => {
    await u.tap("#oaGo"); await u.waitFor(() => orgState.ai && orgState.ai.groups, null, 10000);
    await u.tap("#oaApply");
    const subs = await u.st(() => subDecks("dk-bio").map(s => `${s.name}=${deckCards(s.id).length}`).join(" "));
    ok(subs === "Botânica=3 Citologia=4 Ecologia=3 Genética=4", "Biologia organizada: " + subs);
  });
  await step("pasta grande: a IA vai em partes e mantém os mesmos nomes", async () => {
    const n0 = cloud.aiCalls.length;
    await u.pick("#orgDeck", "t:dk-fis");
    await u.tap("#oaGo"); await u.waitFor(() => orgState.ai && orgState.ai.groups, null, 20000);
    const calls = cloud.aiCalls.slice(n0).filter(c => /Você organiza flashcards/.test(c.prompt));
    ok(calls.length === 4, `450 cartões em ${calls.length} partes de até 120`);
    ok(/Grupo 0/.test(calls[1].prompt) && /Grupo 2/.test(calls[3].prompt), "cada parte recebe as subpastas já sugeridas nas anteriores");
    await u.tap("#oaApply");
    ok(await u.st(() => subDecks("dk-fis").filter(s => /Grupo/.test(s.name)).map(s => deckCards(s.id).length).join()) === "150,150,150", "3 subpastas com 150 cartões cada");
  });

  section("[pc] outro aparelho e celular");
  const B = await openDevice(browser, cloud, { device: "desktop", name: "pc" });
  await cloudReady(B);
  await step("o computador recebe tudo organizado", async () => {
    await settle([A, B]);
    const f = d => ev(d, () => topDecks().map(x => x.name + ":" + subDecks(x.id).map(s => s.name + "=" + deckCards(s.id).length).join("/")).sort().join(" "));
    const [fa, fb] = [await f(A), await f(B)];
    ok(fa === fb && /Biologia:Botânica=3\/Citologia=4\/Ecologia=3\/Genética=4/.test(fb), "mesma organização: " + fb);
  });
  await step("organizador cabe no celular", async () => {
    const C = await openDevice(browser, cloud, { device: "phone", name: "celular" }); C.touch = true;
    await cloudReady(C);
    await ev(C, () => { go("flashcards"); openOrganizer("t:dk-bio"); });
    const over = await ev(C, () => document.documentElement.scrollWidth - innerWidth);
    await C.page.screenshot({ path: path.join(SHOTS, "organizar-celular.png") });
    ok(over <= 0, "sem rolagem lateral no celular");
    ok(errorsOf(C, cloud).length === 0, "celular sem erros");
    await C.context.close();
    await A.page.screenshot({ path: path.join(SHOTS, "organizar-ipad.png") });
  });

  section("sem erros no console");
  ok(errorsOf(A, cloud).length === 0 && errorsOf(B, cloud).length === 0, "nenhum erro: " + JSON.stringify(errorsOf(A, cloud).concat(errorsOf(B, cloud)).slice(0, 5)));
  await A.context.close(); await B.context.close();
  R.dev = null;
}
module.exports = { scenarioOrganizar };
