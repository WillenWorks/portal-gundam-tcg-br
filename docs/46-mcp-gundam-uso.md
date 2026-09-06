# MCP `gundam` — uso (docs/44, Fase 1)

Servidor MCP único (`scripts/mcp-gundam/`) que expõe o motor do simulador e o
catálogo como ferramentas. Base do bot de treino, do fuzzing de regressão e do
MCTS (Fases 2–5).

## Como rodar

### stdio (Claude Code)

Já registrado em `.mcp.json` na raiz:

```json
{ "mcpServers": { "gundam": { "command": "node", "args": ["scripts/mcp-gundam/server.mjs"] } } }
```

O Claude Code sobe o processo sozinho. `server.mjs` registra o loader `tsx/esm`
antes de importar o motor TS (`src/modules/simulator/`), então roda com `node`
puro, sem passo de build.

Smoke test (não sobe o transporte, chama cada tool direto):

```
corepack pnpm run mcp:gundam:smoke
```

### HTTP (futuro)

`scripts/mcp-gundam/mcp.mjs` exporta `attachMcpHttp(app, { route, middleware })`
que monta `POST /mcp` (Streamable HTTP, stateless — 1 server+transport por
request) num Express existente. **Não está plugado no `server/index.ts` nesta
fase** (decisão docs/44 §escopo: só plugar se não houver risco; o `server/index.ts`
é grande e não é type-checked). Pra plugar quando o frontend precisar:

```ts
import { attachMcpHttp } from "../scripts/mcp-gundam/mcp.mjs";
// depois de app.use(express.json()) e com o middleware de auth desejado:
await attachMcpHttp(app, { middleware: [authRequired] });
```

## Ferramentas

### Grupo `catalog`

| Tool | Args | Retorno |
|---|---|---|
| `gundam_get_card` | `code` (ex. `ST01-001`) | texto oficial EN + stats (`data/gcg-official-cards.json`), `CardDef` do motor (fixture ST01-04), `EffectSpec[]` autorados, `coverage`, e `postgres` (`CardModel` via Prisma, ou `{ available:false }` se o client não estiver gerado / sem DB) |
| `gundam_search_glossary` | `term` | linhas de `docs/17-glossario-traducao.md` que casam o termo, com contexto |
| `gundam_coverage` | `set?` (ex. `ST03`) | resumo por set (`total / effectSpec / vanilla / faltando`); com `set`, também a lista carta a carta |

`coverage` status:
- `effectSpec` — tem `EffectSpec` autorado **ou** campo estruturado do motor no
  `CardDef` (`staticAbilities` / `combatTriggers` / `attackTargetRules`).
- `vanilla` — sem texto bespoke (só keyword automática / vazio); o motor cobre.
- `faltando` — texto oficial tem gatilho bespoke (`【Deploy】` etc.) sem `EffectSpec`.

> Heurística aproximada (Fase 1). O registro tipado de deferimentos
> (`deferred.ts`) e o dashboard oficial de cobertura são Fase 4.

### Grupo `sim`

Partidas **efêmeras** — `Map` em memória + TTL 30min. Nunca tocam
`SimulatorMatch` do Postgres.

| Tool | Args | Uso |
|---|---|---|
| `sim_new` | `deckA`, `deckB` (`ST01`..`ST04`), `seed?` | cria a partida já na Main Phase do turno 1 (mulligan pulado, pra ficar direto interativo). Devolve `matchId`. |
| `sim_view` | `matchId`, `seat` (`A`/`B`) | visão redigida (`viewStateFor`) |
| `sim_legal` | `matchId`, `seat` | `enumerateLegalActions` — lista de `PlayerAction` legais agora |
| `sim_act` | `matchId`, `seat`, `action` | aplica a `PlayerAction` (`applyPlayerAction`), devolve novos eventos + visão |
| `sim_selfplay` | `deckA`, `deckB`, `games?`, `seed?` | roda N partidas `randomLegal`-vs-`randomLegal` (`runSelfPlay`) e agrega `{ crashes, illegalStates, unfinished, winA, winB, avgTurns }` |

Fluxo típico de verificação:

```
sim_new  { deckA: "ST03", deckB: "ST04", seed: 42 }      -> matchId
sim_legal { matchId, seat: "A" }                          -> [ {kind:"deployCard",...}, {kind:"finishTurn"}, ... ]
sim_act  { matchId, seat: "A", action: {kind:"deployCard", cardInstanceId:"A-12"} }
sim_view { matchId, seat: "A" }
```

## Enumerador de ações legais (`engine/legalActions.ts`)

`enumerateLegalActions(state, seat, specs?, opts?) → LegalAction[]`.
`LegalAction` **é** `PlayerAction` (1:1). Estratégia: gera candidatos amplos e
FILTRA cada um por uma aplicação de teste (`applyPlayerAction` é puro). Erro de
legalidade (`Error` "cru") descarta o candidato; qualquer outro throwable
(`TypeError` etc.) é re-lançado — bug de motor de verdade.

Cobertura: Main Phase (deploy Unit/Base/Pilot/Command, ataque, `Activate·Main`,
`<Support>`, `finishTurn`), Block Step (`activateBlocker`/`skipBlock`),
Action Step de combate e de fim de turno (`passAction`/`passEndPhaseAction`,
Command `【Action】`, `Activate·Action`), e todas as `pendingDecision`
(mulligan, burst, abilityResolution, triggerOrder, zoneOverflow).

> **Fase de recurso**: o motor atual desenha o recurso automaticamente
> (`advanceToMainPhase` roda start→draw→resource→main sem parar). Não existe
> ponto de decisão "comprar recurso / passar", então o enumerador não trata.

## Self-play e fuzzing

- `engine/selfPlay.ts` — `runSelfPlay({ deckA, deckB, seed, policyA?, policyB?, maxTurns? })`.
  Policy `randomLegal` exportada. Detecta: exceção do motor (`crashed`), exceção
  ao enumerar, estado sem ação legal / travado (`illegalState`), invariante
  violada (`checkStateInvariants`), partida que não termina em `maxTurns`.
- `scripts/gundam-fuzz.mjs` (`corepack pnpm run gundam:fuzz`):
  - `--games=N` (default 200), `--decks=ST01,ST03` (par específico),
    `--seed=` (base, default 1), `--maxTurns=` (default 200).
  - exit ≠ 0 se achar crash / estado ilegal / partida infinita, imprimindo
    `par + seed + ação` e a linha de repro.
- CI (`.github/workflows/ci.yml`) roda `gundam:fuzz --games=100` em PR pra
  `dev`/`main`.

### Resultado da rodada de Fase 1

`corepack pnpm run gundam:fuzz --games=50` (500 partidas, todos os pares ST01-04):
**0 crashes, 0 estados ilegais, 0 partidas infinitas.** Vitórias A/B ~equilibradas,
média ~22 turnos. O motor está estável sob jogo `randomLegal`.

## Achados de motor (não corrigidos nesta branch — docs/44 §escopo)

### 1. `cloneState` não clona `endPhaseAction` a fundo

`engine/events.ts` `cloneState` promete "deep o suficiente pra nunca mutar o
state anterior", mas `endPhaseAction` entra só pelo spread `...state` (referência
compartilhada) e o `applyEvent` de `END_PHASE_ACTION_PASS` /
`BEGIN_END_PHASE_ACTION_STEP` muta `.passes` / `.priority` **in place**.

Impacto: aplicar **duas** ações a partir do MESMO snapshot durante o Action Step
da End Phase corrompe o `endPhaseAction` do snapshot original (a prioridade
"vaza" pra ele). No fluxo normal do `matchStore` isso é inócuo (o state antigo é
descartado a cada ação), mas quebra qualquer consumidor que especule a partir de
um snapshot: busca (MCTS), e a validação por aplicação de teste do
`enumerateLegalActions`.

Workaround aplicado só no módulo novo: `enumerateLegalActions` faz
`structuredClone(state)` antes de cada aplicação de teste **quando
`state.endPhaseAction` está setado** (`GameState` é 100% serializável). Fora
disso o `cloneState` interno basta.

Correção de verdade (fora do escopo desta branch): `cloneState` deve clonar
`endPhaseAction` (`{ ...state.endPhaseAction, passes: { ...passes } }`), como já
faz com `combat`.
