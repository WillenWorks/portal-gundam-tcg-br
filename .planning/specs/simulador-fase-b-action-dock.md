# Spec — Simulador Fase B: Action Dock

> Épico: redesenho visual do simulador · Fase 2 de 5 · branch `feature/simulador-fase-b-action-dock`
> Plano visual: <https://claude.ai/code/artifact/430f4738-bd56-4da7-9dc9-62f026fa81a9> (§03 callout "Action Dock", §06)
> Componente já construído e revisado: `src/modules/simulator/ui/ActionDock.tsx` (branch `feat/simulador-componentes-bcd`)

## Objetivo

Colapsar a **pilha de ~7 cards de decisão centralizados** (`<div className="pointer-events-none
absolute inset-0 z-30 ...">`) + o **flash de fase** que atravessa a tela num **componente único
`ActionDock`** fixo no canto, dirigido por um enum `state`. O board fica 100% visível e clicável —
o dock nunca cobre o centro.

Só camada de UI. Nenhuma mudança de motor / API / `viewState`. **Sem mudança de comportamento** —
as mesmas ações, os mesmos gates, só num lugar previsível.

## Fora de escopo (outras fases)

- Shield rail, medidor de recursos, chips de pilha, HUD reformulado, opp shields no HUD (Fase C).
- Leque de mão, inspetor no painel XL, eco de log **na tira do dock** (Fase D — o `logTail` do
  `ActionDock` fica ligado nesta fase já, mas a versão rica é da D).
- Board portrait / rotação 90° (Fase E).

## Mudanças de frontend

### Arquivos

| Arquivo | Mudança |
|---|---|
| `src/modules/simulator/ui/ActionDock.tsx` + `.test.tsx` | trazidos da branch `feat/simulador-componentes-bcd` (sem alteração de API) |
| `src/modules/simulator/ui/index.ts` | `export { ActionDock, type ActionDockState } from "./ActionDock";` |
| `src/pages/SimulatorMatchPage.tsx` | remove a pilha de cards centralizados (linhas ~881–1046) + o bloco `phaseFlash`; adiciona `computeDockState()` + `<ActionDock … />` no fim do `content`; limpa imports e estado órfãos |
| `package.json` / `pnpm-lock.yaml` | devDeps de teste (`@testing-library/*`, `jsdom`) — vieram junto com o componente |

### `computeDockState()` — o mapeamento

Precedência (o primeiro que casar vence — só 1 `state` por vez):

| ordem | condição na página | `ActionDockState` |
|---|---|---|
| 1 | `gameOverResult` | `{ kind: "gameOver", won, reasonLabel, redirectSeconds: redirectSecondsLeft }` |
| 2 | `pending` | `{ kind: "pending", verb, cardName, selectedCount: selected.length, hint, cost, canConfirm }` |
| 3 | `attackerId` | `{ kind: "attacking", attackerName: attacker?.def.nameEn ?? attackerId }` |
| 4 | `iAmDefending` | `{ kind: "defending" }` |
| 5 | `inActionStep` | `{ kind: "actionStep", scope: iHavePriority ? "combat" : "endPhase", autoPass: matchView.autoPassActionStep }` |
| 6 | `canClaimAbandon && !myTurnMain` | `{ kind: "abandonAvailable", idleSeconds: opponentIdleSeconds ?? 0 }` |
| 7 | `oppPendingDecision` | `{ kind: "oppDecision", label: "Aguardando o oponente resolver …" }` |
| 8 | senão | `{ kind: "idle", yourTurn: myTurnMain, phaseLabel: PHASE_LABEL[view.phase], timerSeconds: turnSecondsLeft }` |

**Desvio consciente (Gate 3.5, issue 3):** `abandonAvailable` só domina o dock quando **não** é
a sua Main Phase. No modelo antigo (cards empilháveis), com oponente AFK + sua Main Phase, apareciam
**os dois** cards (abandono + "Encerrar turno"). No dock (1 state por vez), a sua Main Phase mostra
"Encerrar turno" — o servidor já dá W.O. no oponente ausente sozinho, e o botão explícito de
W.O. volta no turno seguinte (turno do oponente AFK → dock mostra `abandonAvailable`). **Perda de
função:** 1 turno de atraso pra reivindicar W.O. manualmente nesse estado específico. Aceito — "Encerrar
turno" é usado todo turno; W.O. manual é raro.

`pending`:
- `verb`: `pending.kind === "deploy" ? "Jogando" : "Jogando Command (" + pending.trigger + ")"`
- `cost`: `pendingCost > 0 ? { paid: selectedResources.length, total: pendingCost } : null`
- `canConfirm`: `!(pendingCost > 0 && !resourcesReady)`
- `hint`: `"Se pedir alvo/pareamento, clique nas cartas do tabuleiro."`

### Callbacks (fiação 1:1 com o que os cards faziam)

| prop | ação |
|---|---|
| `onConfirm` | `confirmPending` |
| `onCancel` | `clearSelection` |
| `onEndTurn` | `() => runAction({ kind: "finishTurn" })` |
| `onDeclareAttackPlayer` | `() => declareAttack("player")` |
| `onCancelAttack` | `() => setAttackerId(null)` |
| `onSkipBlock` | `() => runAction({ kind: "skipBlock" })` |
| `onPass` | `() => runAction(iHavePriority ? { kind: "passAction" } : { kind: "passEndPhaseAction" })` |
| `onToggleAutoPass` | `toggleAutoPass` (recebe o próximo valor) |
| `onClaimAbandon` | `claimAbandon` |
| `onLeaveAfterGameOver` | `leaveMatchScreen` |
| `busy` | `busy` |
| `logTail` | `battleLog[battleLog.length - 1]?.text` |

### O que é DELETADO

- A `<div className="pointer-events-none absolute inset-0 z-30 …">` inteira e seus 7 cards
  condicionais (gameOver, abandono, oppDecision, actionStep, attacking, pending, defending, myTurnMain).
- O bloco `{phaseFlash ? (…) : null}` + o estado `phaseFlash` + `lastTurnRef` + `flashTimersRef` +
  o `useEffect` do flash + o `useEffect` de cleanup dele + as consts `PHASE_FLASH_SEQUENCE` /
  `PHASE_FLASH_STEP_MS`. **`PHASE_LABEL` fica** (HUD + dockState).
- Imports lucide órfãos: `AlertTriangle`, `Shield`, `Sparkles`, `Swords`, `Zap`.

### Cue de troca de turno

O flash que atravessava a tela sai (era 1 das 3 camadas de mensagem que colidiam, plano §01). Não
há substituto nesta fase: a troca de turno já é visível pelo HUD ("Turno N", "Vez de X" flipam) e
pelo `ActionDock` `idle` ("Sua vez" ↔ "Vez do oponente"). Se o re-QA achar fraco, um realce breve
no texto de fase do HUD é trivial de adicionar (decisão consciente de manter a Fase B enxuta).

### HUD

Inalterado nesta fase (a barra de HUD é reformulada na Fase C). O badge de `gameOver` no HUD fica
redundante com o dock mas **permanece** por ora — remover é Fase C.

## Comportamento de interação

- **Sem mudança funcional.** Mesmas ações, mesmos `disabled` (`busy`, `canConfirm`), mesma
  precedência de urgência.
- O dock é `fixed` (canto inferior direito em `sm+`, faixa inferior no mobile), `z-40`, compacto —
  **nunca cobre o centro do board**. Os cards antigos ficavam `absolute inset-0` centralizados, por
  cima das cartas que você precisava clicar. **Isso é o ganho.**
- Colisão `z-40` com `BattleLogDrawer` (canto inf. direito) e `HandDrawer` (base): item #5 do Gate
  3.5 da Fase A. O dock vai pra `bottom-3 right-3` e a aba de log fica em `top-1/3` → sobreposição
  mínima. Ajuste fino no gate-review se o QA reclamar.

## Estados

| Estado | Dock |
|---|---|
| default (sua Main, nada pendente) | `idle` yourTurn — "Sua vez · Main" + [Encerrar turno] |
| vez do oponente | `idle` !yourTurn — "Vez do oponente" + timer |
| jogando carta (deploy/command) | `pending` — passo + custo `N/M` + [Confirmar]/[Cancelar] |
| declarando ataque | `attacking` — [Atacar o jogador]/[Cancelar] |
| defendendo | `defending` — [Não bloquear] |
| Action Step (combate/fim de turno) | `actionStep` — [Passar] + toggle auto-pass |
| oponente resolvendo Burst | `oppDecision` — texto, sem botão |
| oponente inativo 3min+ | `abandonAvailable` — [Declarar vitória por abandono] |
| fim de jogo | `gameOver` — vitória/derrota + [Voltar ao site] |
| loading | inalterado (tela "Conectando…") |

## Breakpoints

| Faixa | Dock |
|---|---|
| XS retrato | dentro do espaço girado (Fase E), faixa inferior |
| S–M | faixa inferior full-width (`inset-x-0 bottom-0`) |
| L–XL | canto inferior direito, `w-[21rem]`/`w-[23rem]` |

## Validação

```
pnpm build            # tsc -b + vite build
pnpm test             # vitest — 260 nesta branch (Fase A 237 + os 23 testes do ActionDock).
                      #  Os testes de C/D só entram quando `feat/simulador-componentes-bcd` mergear.
pnpm exec eslint src/pages/SimulatorMatchPage.tsx src/modules/simulator/ui/ActionDock.tsx src/modules/simulator/ui/index.ts
```

> **Infra de teste (Gate 3.5, issue 2):** as devDeps de RTL/jsdom que vieram junto do componente
> foram **removidas** desta branch — o `ActionDock.test.tsx` usa `renderToStaticMarkup` + walker, roda
> em `node`, não precisa de RTL. RTL + jsdom entram no projeto junto com os componentes de C/D
> (`feat/simulador-componentes-bcd`), que de fato usam.

Checagem manual (2 contas): cada situação da tabela de estados aciona o dock certo no canto; o
board nunca é coberto no centro; Confirmar respeita custo/`busy`; auto-pass alterna; fim de jogo
redireciona.
