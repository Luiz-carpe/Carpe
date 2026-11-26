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
node e2e.js all                   # ou: web | ipad | sync | limits | migra | extra | gerar | cartoes
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

O envio para a nuvem acontece no máximo 3 segundos depois da primeira alteração, mesmo com o aluno mexendo
sem parar. Cada envio é anotado antes de sair, então a confirmação da nuvem é reconhecida como eco deste
aparelho mesmo quando chega antes da resposta do envio, e nenhuma alteração mais nova é desfeita. Quem abre
um link sem permissão de gravar vê o aviso "Este link não deixa salvar na nuvem" e os dados ficam guardados
no aparelho.
