# Memora

Organizador de estudos para vestibular (pendências, cronômetro e Pomodoro, provas, horários,
simulados, caderno de erros, flashcards com repetição espaçada e IA). Roda como artefato no Claude:
https://claude.ai/artifact/464ZVG7AE2rmrE9AqHwnCr

- `index.html`: o app completo (a mesma página publicada no artefato).
- `testes/`: bateria de testes de ponta a ponta com uma nuvem simulada que segue a API do Claude
  (banco de dados, IA com fotos, arquivos, downloads). Cobre web, iPad (retrato, paisagem, tela dividida,
  modo tela cheia), celular, dois aparelhos ao mesmo tempo, uso offline, limites da nuvem e migração
  dos dados do formato antigo.

## Rodar os testes

```
cd memora/testes
npm install
npx playwright install chromium   # só se o Chromium do Playwright ainda não estiver instalado
node e2e.js all                   # ou: web | ipad | sync | limits | migra | extra | gerar | cartoes | pastas | organizar
```

## Simulados inéditos com IA

Em Simulados, "Criar simulado inédito" abre um formulário com:

- a prova que o simulado imita (ENEM, Fuvest, Unicamp, Unesp, UERJ, FAMERP ou outra, descrita pelo aluno);
- a dificuldade (igual à prova real, fácil, médio, difícil ou nível Medicina);
- quantas questões por disciplina (atalhos: prova completa, metade, 20 ou 10), o tempo de prova, 4 ou 5
  alternativas, a proposta de redação e os conteúdos em que focar;
- provas antigas em PDF, foto ou texto, que a IA usa só como referência de estilo e de conteúdo, sem copiar.

A IA primeiro planeja a prova (conteúdo e habilidade de cada questão, gabarito distribuído entre as letras) e
depois escreve as questões em lotes. Um lote recusado é refeito sozinho. Dá para pausar e continuar depois,
neste ou em outro aparelho.

A prova é feita no próprio app: cronômetro (só corre com a prova aberta), grade de questões, marcação de chute
e de "revisar depois", teclado (letras e setas), folha de respostas para quem fez no papel, correção automática
na entrega, anulação de questão, resolução comentada, levantamento do que estudar, envio dos erros ao caderno
e arquivo HTML para imprimir com folha de respostas e gabarito.

As questões ficam em blocos próprios na nuvem (`qst.<simulado>.<n>`, 10 por bloco), separados do simulado. Um
ENEM completo, com 180 questões e redação, ocupa 18 blocos de cerca de 25 KB.

## Pastas e subpastas de flashcards

Os cartões ficam em pastas (por matéria, como Biologia ou Física), e cada pasta pode ter subpastas por
conteúdo (Biologia › Citologia, Física › Cinemática). Uma pasta pode ter cartões soltos e subpastas ao mesmo
tempo; são só dois níveis.

- **Estudar:** "Estudar tudo" numa pasta revisa os cartões dela e das subpastas. Na subpasta, só os dela.
- **Organizar:**
  - em "Selecionar", marque cartões e mova para outra pasta ou subpasta, inclusive uma nova, criada na hora;
  - em "Editar", uma pasta solta passa a ficar dentro de outra.
- **Escolher a pasta:** os seletores de pasta (editar cartão, Memora IA, importar planilha e caderno de erros)
  mostram o caminho completo. A Memora IA pode criar a subpasta nova dentro da pasta escolhida.
- **Excluir:**
  - uma subpasta pode ir com os cartões ou deixá-los soltos na pasta maior;
  - uma pasta leva as subpastas junto;
  - tudo vai para a lixeira e volta inteiro.

### Organizar cartões que já existem

"Organizar cartões", na tela de flashcards ou dentro de uma pasta, reúne os cartões de todas as pastas.

- **Achar:** filtros por pasta (a pasta inteira, só os cartões soltos ou uma subpasta), busca sem acento na
  frente, no verso e nas etiquetas, e filtro por etiqueta.
- **Selecionar:** toque nos cartões ou em "Marcar os N", que pega todos os encontrados, inclusive os que ainda
  não apareceram na tela (a lista mostra 200 por vez).
- **Mover:** escolha uma pasta ou subpasta, ou crie uma nova na hora. Toda movimentação pode ser desfeita, e
  mover não muda o histórico de revisão.

Com uma pasta escolhida, "Organizar com IA" pede à IA a subpasta de cada cartão. A IA prefere as subpastas que
já existem, pode criar novas se isso estiver permitido, e vai em partes de 120 cartões, levando os nomes já
usados para a próxima parte.

Antes de aplicar, o aluno confere a sugestão: renomeia as subpastas novas e desmarca o que não quiser mover.
Nada muda antes de tocar em "Mover". Desfazer devolve os cartões e apaga as subpastas que ficaram vazias.

No banco de dados, uma subpasta é um baralho com `parent` apontando para a pasta principal. Uma subpasta cuja
pasta sumiu (por exemplo, apagada em outro aparelho) passa a aparecer como pasta principal, e nada se perde.

## Cartões criados pela IA

Os cartões que a IA cria vão direto para o baralho, e para a nuvem, assim que chegam. A lista "Criados agora"
serve só para ajustar, apagar (um ou todos, com desfazer) ou estudar. Se a IA sugerir um baralho com o nome de
um que já existe, os cartões entram nele.

O pedido em andamento também fica guardado na nuvem. Se o app fechar no meio (no iPad isso acontece ao sair dele,
e o Memora reabre do zero), a criação continua sozinha quando o aluno volta. Se outro aparelho assumir o pedido,
o primeiro não salva os mesmos cartões de novo. Pedidos com fotos ou PDF pedem para anexar de novo, porque os
arquivos não ficam guardados.

## Como os dados são salvos

Cada item (pendência, sessão, cartão, simulado…) tem carimbo de tempo próprio e mora num bloco pequeno
da nuvem da conta Claude (`data/users/<id>/v2/b/…`). Mudanças em itens diferentes nunca se sobrescrevem,
mudanças simultâneas no mesmo item são fundidas campo a campo, e toda alteração fica guardada no aparelho
(IndexedDB) até a nuvem confirmar. Os dados do formato antigo são migrados sem apagar nada.

### Quanto cabe

A plataforma aceita até 25.000 blocos por artefato, de até 256 KB cada, e tem um limite de tamanho total que
ela não divulga. Os 25.000 blocos são do artefato inteiro: se outras pessoas usarem o mesmo link, o espaço é
dividido. O teste de carga `node e2e.js ano` simula um ano de uso pesado:

- 10.000 cartões com histórico;
- 104 simulados, 52 deles criados pela IA com 90 questões cada;
- 1.500 pendências, 2.000 erros no caderno e 6 sessões de estudo por dia.

Esse ano ocupa 794 blocos (3,2% do limite) e 21,8 MB. As questões criadas pela IA são cerca de metade disso.
O maior bloco fica com 77 KB e nada se perde.

| Medida | Resultado |
| --- | --- |
| Abrir num aparelho sem nada guardado | 8 s |
| Reabrir no mesmo aparelho | 1,3 s |
| Telas | menos de 0,3 s |

A cópia de segurança automática é compactada (gzip em base64 dentro de um JSON, porque a área de arquivos
aceita até 20 MB por arquivo). O ano pesado vira de 1 a 10 MB, conforme o texto, e a restauração aceita os
dois formatos. Se a nuvem encher, um aviso fixo no topo da tela oferece baixar a cópia na hora.

O envio para a nuvem acontece no máximo 3 segundos depois da primeira alteração, mesmo com o aluno mexendo
sem parar. Cada envio é anotado antes de sair, então a confirmação da nuvem é reconhecida como eco deste
aparelho mesmo quando chega antes da resposta do envio, e nenhuma alteração mais nova é desfeita. Quem abre
um link sem permissão de gravar vê o aviso "Este link não deixa salvar na nuvem" e os dados ficam guardados
no aparelho.
