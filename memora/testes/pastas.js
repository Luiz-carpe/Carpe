// Pastas e subpastas nos flashcards (ex.: Biologia › Citologia, Física › Cinemática).
const path = require("path");
const H = require("./harness"); const { Cloud, openDevice, ev, cloudReady, settle, sleep, R, ok, section, step } = H;
const { U } = require("./walkthrough");
const SHOTS = path.join(__dirname, "shots");
const errorsOf = (dev, cloud) => [...dev.errors, ...cloud.events.filter(e => e.name === "error").map(e => e.msg)].filter(e => !/favicon|net::ERR/.test(e));
const home = dev => ev(dev, () => { studyState = null; fcDeck = null; fcSearch = ""; fcSel = null; go("flashcards"); });
const idOf = (dev, name, parentName) => ev(dev, ([n, p]) => { const d = S.decks.find(x => x.name === n && (p ? deckParentOf(x)?.name === p : !deckParentOf(x))); return d ? d.id : null; }, [name, parentName || ""]);

async function scenarioPastas(browser) {
  const cloud = new Cloud();
  const A = await openDevice(browser, cloud, { device: "ipad", name: "ipad" }); A.touch = true; const u = U(A); R.dev = A;
  await cloudReady(A);
  await ev(A, () => { ["Biologia", "Física"].forEach(n => ensureSubject(n)); commit("settings"); });
  let bio, cito, gen, fis, cine;

  section("[ipad] criar pastas e subpastas");
  await step("pasta Biologia com as subpastas Citologia e Genética", async () => {
    await home(A);
    ok(/Nova pasta/.test(await u.st(() => document.querySelector("#newDeck").textContent)), "botão Nova pasta");
    await u.tap("#newDeck"); await u.fill("#dName", "Biologia"); await u.pick("#dSubj", "Biologia"); await u.ok();
    bio = await idOf(A, "Biologia");
    ok(!!bio, "pasta Biologia criada");
    await u.tap(`[data-deck="${bio}"] [data-act="sub"]`);
    ok(/Nova subpasta/.test(await u.st(() => document.querySelector(".ov h2").textContent)) && await u.st(id => document.querySelector("#dParent").value === id, bio), "Subpasta abre o formulário já dentro de Biologia");
    await u.fill("#dName", "Citologia"); await u.ok();
    await u.waitFor(id => fcDeck === id, bio);
    await u.tap("#newSub"); await u.fill("#dName", "Genética"); await u.ok();
    cito = await idOf(A, "Citologia", "Biologia"); gen = await idOf(A, "Genética", "Biologia");
    ok(cito && gen, "subpastas Citologia e Genética dentro de Biologia");
    ok(await u.st(() => [...document.querySelectorAll("[data-subrow] b")].map(x => x.textContent).join(",")) === "Citologia,Genética", "a pasta mostra as subpastas em ordem alfabética");
    ok(await u.st(id => deckById(id).subject === "Biologia", cito), "subpasta herda a matéria da pasta");
  });
  await step("pasta Física com a subpasta Cinemática", async () => {
    await u.tap("#back");
    await u.tap("#newDeck"); await u.fill("#dName", "Física"); await u.pick("#dSubj", "Física"); await u.ok();
    fis = await idOf(A, "Física");
    await u.tap(`[data-deck="${fis}"] [data-act="open"]`); await u.tap("#newSub"); await u.fill("#dName", "Cinemática"); await u.ok();
    cine = await idOf(A, "Cinemática", "Física");
    ok(!!cine, "Física › Cinemática");
  });

  section("[ipad] cartões nas subpastas");
  await step("adicionar cartões na subpasta e soltos na pasta", async () => {
    await u.tap(`[data-subrow="${cine}"]`);
    ok(await u.st(() => /Física ›/.test(document.querySelector("h1").textContent) && /Física/.test(document.querySelector("#back").textContent)), "subpasta mostra o caminho Física › Cinemática e volta para Física");
    await u.tap("#addC"); await u.fill("#cFront", "Fórmula da velocidade média?"); await u.fill("#cBack", "v = Δs/Δt"); await u.ok();
    ok(await u.st(id => liveCards().some(c => c.deck === id && /velocidade média/.test(c.front)), cine), "cartão salvo em Cinemática");
    await u.tap('#nav a[href="#flashcards"]');
    ok(await u.st(() => route === "flashcards" && !fcDeck && !!document.querySelector(".deck")), "tocar de novo em Flashcards no menu volta para a lista de pastas");
    for (const [f, b] of [["O que é mitose?", "Divisão que gera 2 células iguais"], ["Função do ribossomo?", "Síntese de proteínas"], ["O que é um gene?", "Trecho de DNA"], ["Lei de Mendel 1?", "Segregação dos fatores"]]) {
      await u.tap(`[data-deck="${bio}"] [data-act="add"]`); await u.fill("#cFront", f); await u.fill("#cBack", b); await u.ok();
    }
    ok(await u.st(id => deckCards(id).length === 4, bio), "4 cartões soltos em Biologia");
  });
  await step("selecionar e mover cartões para as subpastas", async () => {
    await u.tap(`[data-deck="${bio}"] [data-act="open"]`);
    await u.tap("#selOn");
    const ids = await u.st(() => liveCards().filter(c => /mitose|ribossomo/.test(c.front)).map(c => c.id));
    for (const id of ids) await u.tap(`[data-card="${id}"]`);
    ok(await u.st(() => document.querySelector("#selN").textContent) === "2 selecionados", "2 cartões selecionados por toque");
    await u.pick("#selTo", cito); await u.tap("#selMove");
    ok(await u.st(([ids, c]) => ids.every(id => CARDS[id].deck === c), [ids, cito]), "os 2 foram para Biologia › Citologia");
    ok(/2 cartões movidos para "Biologia › Citologia"/.test(await u.toast()), "aviso: " + await u.toast());
    const gid = await u.st(() => liveCards().find(c => /gene\?/.test(c.front)).id);
    await u.tap("#selOn"); await u.tap(`[data-card="${gid}"]`); await u.pick("#selTo", gen); await u.tap("#selMove");
    const mid = await u.st(() => liveCards().find(c => /Mendel/.test(c.front)).id);
    await u.tap("#selOn"); await u.tap(`[data-card="${mid}"]`); await u.pick("#selTo", "__new"); await u.tap("#selMove");
    ok(await u.st(id => document.querySelector("#dParent").value === id, bio), "+ Nova subpasta… cria dentro de Biologia");
    await u.fill("#dName", "Hereditariedade"); await u.ok();
    const her = await idOf(A, "Hereditariedade", "Biologia");
    ok(her && await u.st(([id, d]) => CARDS[id].deck === d, [mid, her]), "cartão movido para a subpasta nova Hereditariedade");
    ok(await u.st(id => deckCards(id).length === 0 && treeCards(id).length === 4, bio), "Biologia: 0 soltos e 4 nas subpastas");
  });
  await step("tela inicial mostra as subpastas dentro de cada pasta", async () => {
    await home(A);
    const r = await u.st(id => { const c = document.querySelector(`[data-deck="${id}"]`); return { chips: [...c.querySelectorAll(".subchip")].map(x => x.textContent), total: c.querySelector(".nums").textContent, study: c.querySelector('[data-act="study"]').textContent }; }, bio);
    ok(r.chips.length === 3 && /Citologia2/.test(r.chips.join("|")), "chips das subpastas com a contagem: " + r.chips.join(" | "));
    ok(/4 total/.test(r.total) && r.study === "Estudar tudo", "a pasta soma os cartões das subpastas e oferece Estudar tudo");
    ok(await u.st(() => document.querySelectorAll(".deck").length === 2), "só as pastas principais aparecem como cartões grandes");
    await u.tap(`[data-sub="${cito}"]`);
    ok(await u.st(id => fcDeck === id, cito), "tocar no chip abre a subpasta");
  });

  section("[ipad] estudar a pasta inteira ou só a subpasta");
  await step("Estudar tudo junta as subpastas; Estudar na subpasta pega só ela", async () => {
    await home(A);
    await u.tap(`[data-deck="${bio}"] [data-act="study"]`);
    ok(await u.st(() => studyState.queue.length === 4), "Biologia (tudo): 4 cartões");
    ok(/Biologia › /.test(await u.st(() => document.querySelector(".study .sub").textContent)), "durante o estudo aparece o caminho da subpasta");
    await u.tap("#endStudy");
    await u.tap(`[data-deck="${bio}"] [data-act="open"]`);
    await u.tap(`[data-sstudy="${cito}"]`);
    ok(await u.st(id => studyState.queue.length === 2 && studyState.queue.every(x => CARDS[x].deck === id), cito), "só Citologia: 2 cartões");
    await u.tap("#show"); await u.tap('[data-r="0"]'); await u.tap("#show"); await u.tap('[data-r="2"]');
    await u.tap("#endStudy");
  });
  await step("buscar na pasta procura também nas subpastas", async () => {
    await u.st(id => { studyState = null; fcDeck = id; render(); }, bio);
    await u.fill("#fcSearch", "ribossomo");
    await u.waitFor(() => document.querySelectorAll("#view [data-card]").length === 1);
    ok(/Citologia/.test(await u.st(() => document.querySelector("#view [data-card] .pill").textContent)), "resultado mostra de qual subpasta é o cartão");
    await u.fill("#fcSearch", "");
  });

  section("[ipad] mover uma pasta inteira e editar");
  await step("pasta solta vira subpasta; pasta com subpastas não entra em outra", async () => {
    await home(A);
    await u.tap("#newDeck"); await u.fill("#dName", "Dinâmica"); await u.ok();
    const din = await idOf(A, "Dinâmica");
    await u.tap(`[data-deck="${din}"] [data-act="open"]`); await u.tap("#editD"); await u.pick("#dParent", fis); await u.ok();
    ok(await u.st(([d, f]) => deckParentOf(deckById(d))?.id === f, [din, fis]), "Dinâmica agora é Física › Dinâmica");
    await u.st(id => { fcDeck = id; render(); }, bio); await u.tap("#editD");
    ok(await u.st(() => document.querySelector("#dParent").disabled && /não pode ficar dentro de outra/.test(document.querySelector(".ov").textContent)), "Biologia tem subpastas: não pode virar subpasta");
    await u.fill("#dName", "Biologia (vestibular)"); await u.ok();
    ok(await u.st(id => deckPath(id) === "Biologia (vestibular) › Citologia", cito), "renomear a pasta muda o caminho das subpastas");
    await u.st(id => { deckById(id).name = "Biologia"; commit("decks"); render(); }, bio);
  });
  await step("editar cartão mostra o caminho e permite trocar de subpasta", async () => {
    const id = await u.st(() => liveCards().find(c => /velocidade/.test(c.front)).id);
    await u.st(d => { fcDeck = d; render(); }, cine);
    await u.tap(`[data-card="${id}"] [data-act="edit"]`);
    const opts = await u.st(() => [...document.querySelectorAll("#cDeck option")].map(o => o.textContent));
    ok(opts.includes("Biologia › Citologia") && opts.includes("Física › Cinemática") && opts.indexOf("Física") < opts.indexOf("Física › Cinemática"), "lista de pastas com caminho: " + opts.join(" | "));
    await u.pick("#cDeck", await idOf(A, "Dinâmica", "Física")); await u.ok();
    ok(await u.st(i => deckPath(CARDS[i].deck) === "Física › Dinâmica", id), "cartão trocou de subpasta pelo editor");
  });

  section("[ipad] IA e importação direto na subpasta");
  await step("IA cria a subpasta nova dentro da pasta escolhida", async () => {
    await u.go("ia");
    await u.fill("#aiPrompt", "cartões de termologia"); await u.fill("#aiCount", "5");
    await u.pick("#aiDeck", ""); await u.fill("#aiNewDeck", "Termologia"); await u.pick("#aiParent", fis);
    await u.tap("#aiGo"); await u.waitFor(() => !genBusy && GEN.length === 5, null, 10000);
    const t = await idOf(A, "Termologia", "Física");
    ok(t && await u.st(id => deckCards(id).length === 5, t), "5 cartões em Física › Termologia");
    ok(/salvos em "Física › Termologia"/.test(await u.toast()), "aviso: " + await u.toast());
    await u.tap("#genHide");
  });
  await step("IA que sugere o nome de uma subpasta existente usa essa subpasta", async () => {
    cloud.deckName = "Citologia"; cloud.deckSubject = "Biologia";
    await u.st(() => { aiForm = { ...aiForm, deck: "", newDeck: "", parent: "" }; render(); });
    await u.fill("#aiPrompt", "mais citologia"); await u.fill("#aiCount", "3");
    await u.tap("#aiGo"); await u.waitFor(() => !genBusy && GEN.length === 3, null, 10000);
    ok(await u.st(id => deckCards(id).length === 5, cito) && await u.st(() => S.decks.filter(d => d.name === "Citologia").length === 1), "3 cartões entraram em Biologia › Citologia (sem criar outra)");
    await u.tap("#genHide"); cloud.deckName = null; cloud.deckSubject = null;
  });
  await step("importar planilha direto numa subpasta", async () => {
    await u.tap('#iaTabs [data-t="importar"]');
    await u.fill("#impText", "frente;verso\nGene dominante?;Se expressa em heterozigose\nAlelo?;Forma alternativa de um gene");
    await u.waitFor(() => !document.querySelector("#impGo").disabled);
    await u.pick("#impDeck", gen); await u.tap("#impGo");
    ok(await u.st(id => deckCards(id).length === 3, gen), "2 cartões importados em Biologia › Genética");
    await u.tap('#iaTabs [data-t="gerar"]');
  });

  section("[ipad] excluir e desfazer");
  await step("excluir subpasta levando os cartões para a pasta maior", async () => {
    await u.st(id => { studyState = null; fcDeck = id; go("flashcards"); }, gen); await u.waitFor(id => route === "flashcards" && fcDeck === id, gen);
    await u.tap("#delD");
    ok(/Mover para "Biologia"/.test(await u.st(() => document.querySelector(".ov").textContent)), "pergunta o que fazer com os cartões");
    await u.tap(".ov [data-keep]");
    ok(await u.st(([g, b]) => !deckById(g) && deckCards(b).length === 3 && fcDeck === b, [gen, bio]), "subpasta Genética excluída e os 3 cartões ficaram soltos em Biologia");
    await u.undo();
    ok(await u.st(g => !!deckById(g) && deckParentOf(deckById(g))?.name === "Biologia", gen), "desfazer traz a subpasta de volta");
  });
  await step("excluir subpasta junto com os cartões", async () => {
    await u.st(id => { fcDeck = id; render(); }, cito);
    await u.tap("#delD"); await u.ok();
    ok(await u.st(c => !deckById(c) && !liveCards().some(x => x.deck === c), cito), "Citologia e seus 5 cartões foram para a lixeira");
    await u.undo();
    ok(await u.st(c => !!deckById(c) && deckCards(c).length === 5, cito), "desfazer traz Citologia com os 5 cartões");
  });
  await step("excluir pasta com subpastas e restaurar tudo pela lixeira", async () => {
    const before = await u.st(id => treeCards(id).length, fis);
    await u.st(id => { fcDeck = id; render(); }, fis);
    await u.tap("#delD");
    ok(/as 3 subpastas/.test(await u.st(() => document.querySelector(".ov").textContent)), "confirmação fala das subpastas: " + await u.st(() => document.querySelector(".ov p").textContent));
    await u.ok();
    ok(await u.st(id => !S.decks.some(d => d.id === id || d.parent === id), fis) && await u.st(() => !liveCards().some(c => /velocidade/.test(c.front))), `Física, suas subpastas e os ${before} cartões foram para a lixeira`);
    await u.go("dados");
    await u.tap(`[data-tr="${await u.st(() => S.trash.find(t => t.kind === "deck" && t.data.deck.name === "Física").id)}"] [data-trr]`);
    ok(await u.st(([id, n]) => subDecks(id).length === 3 && treeCards(id).length === n, [fis, before]), "restaurar traz a pasta, as 3 subpastas e todos os cartões");
  });

  section("[pc] segundo aparelho e casos raros");
  const B = await openDevice(browser, cloud, { device: "desktop", name: "pc" }); const ub = U(B);
  await cloudReady(B);
  await step("o computador recebe a mesma organização", async () => {
    await settle([A, B]);
    const fa = await u.st(() => topDecks().map(d => d.name + ":" + subDecks(d.id).map(s => s.name + "=" + deckCards(s.id).length).join("/")).sort().join(" "));
    const fb = await ub.st(() => topDecks().map(d => d.name + ":" + subDecks(d.id).map(s => s.name + "=" + deckCards(s.id).length).join("/")).sort().join(" "));
    ok(fa === fb && /Biologia:Citologia=5/.test(fb), "mesmas pastas, subpastas e cartões: " + fb);
  });
  await step("subpasta criada no computador aparece no iPad", async () => {
    await home(B); await ub.tap(`[data-deck="${bio}"] [data-act="sub"]`); await ub.fill("#dName", "Ecologia"); await ub.ok();
    await settle([A, B]);
    ok(await u.st(id => subDecks(id).some(s => s.name === "Ecologia"), bio), "Ecologia chegou ao iPad dentro de Biologia");
  });
  await step("subpasta cuja pasta sumiu em outro aparelho vira pasta principal", async () => {
    await ub.st(() => { S.decks.push({ id: "dk-orfa", name: "Órfã", subject: "", parent: "dk-nao-existe", createdAt: Date.now() }); commit("decks"); }); await home(B);
    ok(await ub.st(() => topDecks().some(d => d.id === "dk-orfa") && !!document.querySelector('[data-deck="dk-orfa"]')), "aparece como pasta, sem erro");
  });
  await step("telas cabem no iPad e no celular", async () => {
    await home(A);
    let over = await u.st(() => document.documentElement.scrollWidth - innerWidth);
    await A.page.screenshot({ path: path.join(SHOTS, "pastas-ipad.png") });
    await u.st(id => { fcDeck = id; fcSel = new Set(); render(); }, bio);
    over = Math.max(over, await u.st(() => document.documentElement.scrollWidth - innerWidth));
    await A.page.screenshot({ path: path.join(SHOTS, "pastas-ipad-pasta.png") });
    await u.st(() => { fcSel = null; render(); });
    ok(over <= 0, "iPad sem rolagem lateral");
    const C = await openDevice(browser, cloud, { device: "phone", name: "celular" }); C.touch = true;
    await cloudReady(C);
    await home(C);
    let o2 = await ev(C, () => document.documentElement.scrollWidth - innerWidth);
    await C.page.screenshot({ path: path.join(SHOTS, "pastas-celular.png") });
    await ev(C, id => { fcDeck = id; fcSel = new Set(); render(); }, bio);
    o2 = Math.max(o2, await ev(C, () => document.documentElement.scrollWidth - innerWidth));
    await C.page.screenshot({ path: path.join(SHOTS, "pastas-celular-pasta.png") });
    ok(o2 <= 0, "celular sem rolagem lateral");
    ok(errorsOf(C, cloud).length === 0, "celular sem erros");
    await C.context.close();
  });

  section("sem erros no console");
  ok(errorsOf(A, cloud).length === 0 && errorsOf(B, cloud).length === 0, "nenhum erro: " + JSON.stringify(errorsOf(A, cloud).concat(errorsOf(B, cloud)).slice(0, 5)));
  await A.context.close(); await B.context.close();
  R.dev = null;
}
module.exports = { scenarioPastas };
