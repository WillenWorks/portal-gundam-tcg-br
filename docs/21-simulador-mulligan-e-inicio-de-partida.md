# docs/21 — Simulador: Mulligan interativo + início de partida

**Sprint:** Mulligan (1ª das 3 frentes abertas em 2026-09-04).
**Branch:** `feature/simulador-mulligan-inicio`.
**Fonte de regra:** `data/rulings-batch-01.json` (linhas 97, 108) + Comprehensive Rules 6-2 / 6-3.

## 1. Problema

O motor já tinha `mulligan` como um `boolean` cozido no `createGame` (não-interativo),
e `matchStore.createMatch` pulava direto pra Main Phase. Ninguém via a mão pra decidir,
ninguém sabia quem foi sorteado pra começar, e o 1º jogador comprava carta no turno 1
(a regra oficial diz que **não** compra).

## 2. Regra alvo

1. **Sorteio de iniciativa antes de olhar a mão.** Como não há pedra-papel-tesoura, é
   `Math.random()` no pareamento (`joinQueue`). Só faltava **revelar** ao jogador.
2. Cada jogador compra 5.
3. **Mulligan sequencial: Player One decide primeiro, depois Player Two.** "Não" → segue.
   "Sim" → mão inteira pro **fundo** do deck, **embaralha**, compra 5. Uma chance por jogador.
4. Depois das 2 decisões: 6 shields do topo pra cada, EX Base pros 2, EX Resource só pro 2º.
5. **1º jogador não compra na Draw Phase do turno 1** (Comprehensive Rules 6-3).

## 3. Solução — `PendingDecision` sequencial (sem fase nova)

Reaproveita 100% a maquinaria de decisão interativa (`burst`/`abilityResolution`).
Nenhum valor novo em `Phase` — o mulligan roda com `phase: "start"`.

### Motor

| Arquivo | Mudança |
|---|---|
| `engine/types.ts` | `PendingDecision` ganha `{ kind: "mulligan" }` (sem payload). `GameState` ganha `seed: number` (pro re-shuffle determinístico depois do `createGame`, e pra persistência da Sprint C). |
| `engine/setup.ts` | `buildPlayer` split em `dealOpeningHand` (embaralha + compra 5) e `placeShieldsAndBase` (6 shields + EX Base). `createGame({ interactiveMulligan: true })`: só compra as mãos, guarda `seed`, seta `pendingDecision[firstPlayer] = { kind: "mulligan" }`. Novo `finishGameSetup(state)` = 6 shields + EX Base pros 2 + EX Resource pro 2º. `redrawMulliganHand` / `mulliganNonce` exportados. O modo antigo (default, sem `interactiveMulligan`) é **idêntico ao histórico** — testes de motor intocados. |
| `engine/actions.ts` | `PlayerAction` ganha `{ kind: "resolveMulligan"; keep: boolean }`. Guard de pending: `mulligan` → só aceita `resolveMulligan`. Handler: `CLEAR_PENDING_DECISION`; se `!keep` → `redrawMulliganHand(next.players[p], createRng(next.seed ^ mulliganNonce(p)))` (shuffle no reducer, sem evento SHUFFLE); depois — se `actingPlayer === activePlayer` (1º jogador) → `SET_PENDING_DECISION` do oponente; senão (2º) → `finishGameSetup` + `advanceToMainPhase`. |
| `engine/phases.ts` | `computeDrawPhaseEvents`: `if (state.turnNumber === 1) return events;` — 1º jogador não compra no turno 1. |

### Servidor

- `matchStore.createMatch`: nasce com o mulligan interativo pendente. `skipMulligan?: boolean` (só teste) volta ao setup direto.
- `defaultActionFor`: arm `mulligan` → `{ kind: "resolveMulligan", keep: true }` (AFK = fica com a mão).
- `decisionOwner` já cobre (`pendingDecision[p]` non-null → `p`), então o timer de 90s conta pra quem tem o mulligan pendente.

### UI

| Arquivo | Papel |
|---|---|
| `ui/MulliganModal.tsx` (novo) | Overlay `z-[60]`; mostra os 5 `view.players[seat].hand` (própria, sempre visível); "Ficar com esta mão" / "Trocar a mão (Mulligan)". |
| `ui/FirstPlayerReveal.tsx` (novo) | Overlay transitório `z-[55]` no 1º render (`turnNumber === 1`): "Você joga primeiro" / "Oponente joga primeiro" + a consequência (não compra no turno 1 / começa com EX Resource). Some por clique ou 3.5s. |
| `SimulatorMatchPage.tsx` | Estado `revealDismissed`. Renderiza `FirstPlayerReveal` → depois `MulliganModal` quando `myPendingDecision.kind === "mulligan"`. `matchPrompt`: "Decida sua mão inicial (Mulligan)". `runAction({ kind: "resolveMulligan", keep })`. |

## 4. Testes

- `engine/mulligan.test.ts` (novo, 6 casos) — modo interativo pendente, fluxo sequencial keep/mulligan, determinismo, setup final, ordem P1→P2, EX Resource no 2º.
- `engine/phases.test.ts` — novo caso "1º jogador NÃO compra no turno 1"; casos de Draw Phase "normal" e deck-out movidos pro turno 2.
- `engine/setup.test.ts` — inalterado (modo não-interativo é o mesmo).
- `server/matchStore.test.ts` — `newMatch()` + os 2 outros `createMatch` usam `skipMulligan: true`.

`pnpm test` 413 ✓ · `check:types` ✓ · `lint:simulator` ✓ · `build` ✓.

## 5. Verificação E2E (manual, 2 contas)

`pnpm dev:full` → 2 contas → fila → parear. Esperado:
- Overlay "Você joga primeiro/segundo" aparece 1× em cada lado.
- Cada jogador vê o `MulliganModal` com **sua** mão. O 1º decide; o 2º vê "aguardando o
  oponente"; depois o 2º decide.
- Entra na Main Phase: 6 shields cada, EX Base cada, EX Resource só no 2º, 1º jogador com
  5 cartas (não comprou).
- AFK no mulligan → timer de 90s resolve `keep: true` e a partida segue.

## 6. Notas / decisões

- **Reshuffle no mulligan:** seguimos a regra oficial (embaralha após devolver a mão),
  via `createRng(seed ^ nonce)` — determinístico e reproduzível.
- **EX Base 3 HP:** herdado (fonte comunitária, não o PDF v1.8.0). Reconciliar na auditoria
  da Sprint C.
- `docs/18` §"Onde mexer" atualizado (linha do `setup.ts`).
