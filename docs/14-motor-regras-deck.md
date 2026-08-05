# Motor de regras de deck (Pacote A)

## Fonte

Regras oficiais conferidas em agosto/2026:
- Comprehensive Rules v1.8.0 (`gundam-gcg.com/en/pdf/comprehensiverules_en.pdf`) — seção 6 (Preparing to Play)
- "How to Start Deck Building" (`gundam-gcg.com/en/news/decks-build.html`)
- "Banned/Restricted Cards" (`gundam-gcg.com/en/news/01_279.html`)

Vale reconferir essas páginas periodicamente — lista de banimento e Comprehensive
Rules são atualizadas pela Bandai sem aviso prévio no nosso lado.

## Regras implementadas

- Deck principal: exatamente 50 cartas (Unit/Pilot/Command/Base)
- Deck de recursos: exatamente 10 cartas (só Resource — sem limite de cópia entre si)
- Até 4 cópias por `code` (== `CardModel`, já que um code é sempre a mesma carta
  independente da arte — ver `docs/13-migracao-cardmodel.md`)
- 1 ou 2 cores por deck. **Atenção**: existem 5 cores oficiais — blue, green, red,
  white e **purple** (Comprehensive Rules 2-4-2-1). A página de notícias de deck
  building só cita 4; o PDF de regras é a fonte mais recente/completa.
- Banido: 0 cópias permitidas
- Restrito: limite customizado (ex: 2), não necessariamente igual a 4
- **Grupo de banimento** (`CardBanGroup`): cobre dois casos oficiais diferentes com
  o mesmo mecanismo — só é permitido usar `maxDistinct` cartas *diferentes* de um
  grupo no mesmo deck (mas cada uma pode ir até o limite normal de cópias):
  1. **Par banido**: duas cartas específicas que não podem coexistir (ex: Amuro Ray
     x Mikazuki Augus) — grupo de 2 membros, `maxDistinct: 1`.
  2. **Categoria genérica**: toda unit "Lv.2, custo 1, 2 AP, 2 HP, sem efeito" (~22
     cartas na lista oficial atual) é mutuamente incompatível com as outras da
     mesma categoria — mesmo grupo, `maxDistinct: 1`, só que com muito mais
     membros. A regra oficial texto exato: "no more than four copies of one card
     matching this description can be used in a deck" — ou seja, pode usar até 4
     cópias de UMA delas, só não pode misturar duas diferentes.

## O que NÃO está implementado ainda (fica pro Pacote D — simulador)

- Limite de 15 recursos em jogo (5 EX no máximo), 6 units em campo, mão de 10 —
  regras de *partida*, não de *construção de deck*. Não fazem sentido no
  deckbuilder, só no simulador.
- Validação de "link condition" (piloto compatível com a unidade) — é sobre
  jogabilidade, não sobre legalidade de deck.

## Onde mexer

- **Schema**: `CardModel.legalityStatus` (`"legal"` / `"restricted"` / `"banned"`
  / `"not_in_format"`, já existia), `CardModel.restrictedCopies` (novo, só usado
  quando `legalityStatus = "restricted"`), `CardModel.banGroupId` → `CardBanGroup`
  (novo).
- **Lógica pura**: `server/deck-legality.ts` — `computeDeckLegality(items,
  legalityData)`, testado em `server/deck-legality.test.ts`. Não depende do
  Prisma de propósito, pra dar pra testar sem subir o servidor inteiro.
- **Carrega do banco**: `loadDeckLegalityData()` em `server/index.ts`.
- **Endpoints**:
  - `GET /api/decks/legality` — regras + lista de banidas/restritas/grupos, pronto
    pro front-end consumir (Pacote B vai usar isso pra validação em tempo real).
  - `GET /api/decks/public`, `/api/decks/share/:shareId`, `/api/decks/me` — cada
    deck retornado já vem com um campo `legality: { valid, issues[] }` calculado.
- **Admin**: o formulário de carta (`AdminPage.tsx`) tem os campos de legalidade,
  cópias restritas e grupo de banimento. Criar um grupo NOVO ainda só é possível
  via script (não tem UI de CRUD de grupo ainda — só atribuição a um grupo já
  existente). Se isso virar algo frequente, vale construir uma tela própria.
- **Popular a lista oficial**: `pnpm run banlist:dry-run` / `banlist:apply` —
  script idempotente em `prisma/apply-official-banlist.mjs`, com os dados atuais
  (1 banida, 1 restrita, 1 par banido, 1 grupo genérico de ~22 cartas) hardcoded a
  partir da página oficial. Quando a lista oficial mudar, edita as constantes no
  topo do arquivo e roda de novo — idempotente, não duplica grupo.

## Cuidado ao mexer em `MODEL_FIELDS_FROM_CARD`

`restrictedCopies` e `banGroupId` ficam **de fora** de `MODEL_FIELDS_FROM_CARD`
(a lista usada por `syncCardModelForCode` pra copiar dado da impressão pro
modelo) de propósito — essas colunas não existem em `Card` (só em `CardModel`),
então incluí-las ali faria a sincronização automática apagar o banimento toda
vez que uma impressão fosse editada. O `PUT /api/cards/:id` trata os dois campos
separadamente, direto no `CardModel`.
