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
node e2e.js all                   # ou: web | ipad | sync | limits | migra | extra
```

## Como os dados são salvos

Cada item (pendência, sessão, cartão, simulado…) tem carimbo de tempo próprio e mora num bloco pequeno
da nuvem da conta Claude (`data/users/<id>/v2/b/…`). Mudanças em itens diferentes nunca se sobrescrevem,
mudanças simultâneas no mesmo item são fundidas campo a campo, e toda alteração fica guardada no aparelho
(IndexedDB) até a nuvem confirmar. Os dados do formato antigo são migrados sem apagar nada.
