# 27 — Sprint V&V rumo ao v1.0 — V2: mecânicas centrais vs. regras oficiais

**Branch:** `dev` — 2026-09-04. Continuação de [docs/25](25-simulador-vv-sprint-v0-legalidade-de-alvo.md)/[docs/26](26-simulador-vv-sprint-v1-auditoria-carta-a-carta.md).

## Método

Revalidação das mecânicas centrais (fases, combate, keywords, zonas) contra
as **88 rulings oficiais já importadas** (`data/rulings-batch-01..06.json`,
`OFFICIAL_FAQ` do site gundam-gcg.com) — não recriando as regras de memória,
lendo cada resposta oficial e conferindo contra o código de fato (`combat.ts`,
`phases.ts`, `keywords.ts`, `deploy.ts`, `events.ts`).

## Achado real — limite de 6 Units na Battle Area (mesma classe de bug do V0)

**Ruling oficial** ("How many Units can I have in my battle area at once?"):
*"Six at most. If a seventh would enter (by playing a card or an effect
deploying one), you must immediately choose one already there and send it to
the trash — and that one isn't treated as 'destroyed', just moved by rules
management."*

**Divergência achada, em 2 pontas diferentes do motor:**
1. `deployCard` (`deploy.ts:94`, ANTES desta etapa) **bloqueava** a jogada com
   `throw new Error("Battle Area cheia")` ao tentar jogar a 7ª Unit da mão —
   mesma classe de bug do Guntank/Suletta (docs/24/25): a regra fala em
   "a 7ª entra e DEPOIS o excesso é resolvido", nunca "a jogada é recusada".
2. `SPAWN_TOKEN` (`events.ts:359`, comentário explícito "nenhuma checagem de
   limite... de propósito") **não checava nada** — White Base
   (`Activate·Main`, spawna token todo turno) e Corsica Base (`Deploy`,
   spawna até 2 Leo tokens) podiam empurrar o board pra 7+ Units **sem
   nenhum rules management**, silenciosamente, pra sempre.

Achado real e alcançável com as 32 cartas de ST01/ST02 (não teórico) — um
jogo longo o suficiente com White Base em campo bate no board cheio.

## Correção — genérica, mesmo padrão do V0

Em vez de corrigir os 2 pontos separadamente (o que seria a mesma gambiarra
de novo, um remendo por card), a correção vai na raiz, seguindo o mesmo
molde do V0 (`computeLegalTargets`/`filterDispatchableSpecs`, "1 ponto só de
checagem, nunca por carta"):

- **`deployCard` não bloqueia mais** — a Unit sempre entra em campo primeiro.
- **`enforceZoneLimits(state)`** (novo, `engine/actions.ts`) — roda depois de
  **QUALQUER** `PlayerAction`, único ponto de checagem (mesmo espírito de
  `applyPlayerAction` já ser o único ponto de checagem de autorização, ver
  docstring de `PlayerAction`): se a Battle Area de algum jogador passou de
  6 Units e ele não tem outra decisão pendente, pausa com a nova
  `PendingDecision.zoneOverflow` (`legalTargets` = todas as Units do
  jogador agora). Cobre **os dois** caminhos (`deployCard` E `SPAWN_TOKEN`)
  automaticamente — nem `deployCard` nem o primitive `spawnToken` precisam
  saber dessa regra.
- **`resolveZoneOverflow`** (nova `PlayerAction`) — o jogador escolhe qual
  Unit vai pro trash; servidor valida contra `legalTargets` (mesmo padrão
  server-authoritative do V0, nunca confia cegamente no `instanceId` do
  cliente); `MOVE_CARD`, nunca `DESTROY_CARD` (rules management, não
  "destruída" — mesma regra já usada corretamente pra Base excedente).
- Excesso de 2+ Units (ex. Corsica Base spawna 2 Leo de uma vez com o board
  já em 6) resolve em decisões sucessivas de 1 escolha cada, porque
  `enforceZoneLimits` roda de novo a cada `resolveZoneOverflow` (mesmo
  wrapper) — sem precisar de laço nem de UI de múltipla seleção.
- **UI**: `ZoneOverflowModal.tsx` (novo, mesmo estilo do `TriggerOrderModal`)
  lista as próprias Units (sempre públicas, nunca tem segredo aqui) —
  clique manda a escolhida pro trash.
- **AFK**: `defaultActionFor` (`matchStore.ts`) escolhe a 1ª da lista se o
  timer estourar — mesma disciplina das outras `PendingDecision`.

O limite de **1 Base** (`deployCard`, mesma função) já estava correto —
substitui automaticamente via `MOVE_CARD` pro trash, sem bloquear — não
precisou de mudança; serviu de referência pro desenho da correção acima.

## Outros pontos conferidos contra as 88 rulings — sem achado

Amostragem ampla, priorizando as categorias de maior risco de divergência
(`battle`: 16 rulings, `keywords`: 14, `effects`: 11, `terminology`: 14,
`end_phase`: 5, `main_phase`: 4, `rules_management`: 3):

- **EX Base (0 AP / 3 HP)** — `setup.ts:33`. Estava marcado como "fonte de
  comunidade — reconciliar" em docs/18 (antes das rulings serem importadas).
  Confirmado agora contra o `OFFICIAL_FAQ` ("A Base token (0 AP / 3 HP)...")
  — **item fechado**, o valor já estava certo.
- Ordem das 5 fases, ordem dos 4 passos da End Phase (Action→End→Hand→
  Cleanup — Repair roda no End Step, DEPOIS do Action Step, confirmado em
  `phases.ts:156`), limite de mão (10, `HAND_LIMIT`), Repair não cura Unit
  sem dano (`card.damage > 0` guard, `keywords.ts:62`), Base sempre tem
  prioridade sobre Shields, shield/Base nunca "sobra" dano pro próximo
  (Shield = sempre exatamente 1 destruída, Base sem overflow porque não tem
  pra onde transbordar), dano simultâneo Unit-vs-Unit + First Strike (dano
  do defensor/atacante calculado a partir do MESMO estado pré-dano, sem
  "quem morreu primeiro" fora do First Strike), 5 passos do combate,
  Blocker (só ativo, só no Block Step, nunca a própria Unit alvejada, troca
  total — não convivem 2 alvos), `attackTargetRules` (Zowort não pode
  alvejar jogador, Wing Gundam PODE alvejar Unit ativa Lv≤4 — relaxamento,
  não substituição, `combat.ts:58`), `duringPair` vs `duringLink` (Pair =
  qualquer Pilot pareado; Link = satisfaz a condição de link da Unit —
  `types.ts:250`) — todos conferidos linha a linha contra a resposta oficial
  e batem com o código.

## 1 gap registrado (não fixado agora — inalcançável com as 32 cartas de hoje)

**Empilhamento de `<Repair N>`** (ruling: *"Multiple instances of Repair...
stack by simple addition"*): `keywordValue()` (`types.ts:349`) retorna o
**primeiro** match (`keywordGrants.find(...)`), não soma múltiplas fontes.
Nenhuma das 32 cartas de ST01/ST02 tem um efeito que CONCEDE Repair a outra
Unit (só o Repair 2 impresso do Gundam ST01-001) — inalcançável hoje.
Registrado como item de atenção pro checklist de carta nova (V4): se uma
carta futura conceder `<Repair N>` a uma Unit que já tem Repair (impresso ou
de outra fonte), `keywordValue` precisa somar, não pegar o primeiro.

## Verificação

`pnpm test` **430/430** (+4 testes novos, `pendingDecision.test.ts` —
`deployCard` da 7ª nunca bloqueia, `resolveZoneOverflow` move pro trash e
libera o jogo, validação server-authoritative rejeita `instanceId` fora de
`legalTargets`, e o caminho `SPAWN_TOKEN`/White Base cai na mesma regra).
`check:types` ✓, `lint:simulator` ✓, `eslint` na página ✓, `pnpm build` ✓
(só o warning de CSS pré-existente, não relacionado).

## Próximo passo

V3 — auditoria de integridade servidor-autoritativa de toda `PlayerAction`
(ownership, fase/turno, pagamento de custo), usando `activateSupport` como
referência do "bom padrão" já existente.
