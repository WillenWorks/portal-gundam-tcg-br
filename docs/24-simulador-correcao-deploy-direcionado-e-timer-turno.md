# 24 — Simulador: correção do 【Deploy】 direcionado (Guntank) + timer de turno

**Branch:** `dev` (executado direto, a pedido do Willen — 2026-09-04)
**Gatilho:** print de produção — jogar Guntank (ST01-004) travava com
`Alvo nomeado "target" não foi resolvido antes da execução do efeito`.

---

## 1. Diagnóstico

### Causa raiz
`deployCard()` (`engine/deploy.ts`) despachava o gatilho 【Deploy】 direto por
`dispatchTrigger()`, que exige o alvo JÁ resolvido em `ctx.targets.target`.
Nenhum caller preenchia isso pra Deploy — o cliente (`SimulatorMatchPage.
confirmPending`) nunca manda `targets` ao jogar uma carta da mão, exatamente
como pro 【When Paired】 (que **já** ia por `deferOrDispatchAbilities`, capaz
de pausar e pedir o alvo depois). Guntank ("Choose 1 enemy Unit with 2 or
less HP. Rest it.") é o único 【Deploy】 de ST01/ST02 com alvo nomeado — por
isso só ele quebrava.

### Auditoria — todos os 【Deploy】 de ST01+ST02

| Carta | Precisa de alvo nomeado (`target`)? | Efeito |
|---|---|---|
| ST01-004 Guntank | **Sim** | ❌ quebrava — corrigido |
| ST01-015 White Base | Não (`addShieldToHand`, usa `shield`) | inalterado |
| ST01-016 Asticassia | Não (idem) | inalterado |
| ST02-002 Wing Gundam (Bird Mode) | Não (`spawnToken`, sem alvo) | inalterado |
| ST02-015 Saint Gabriel Institute | Não (`shield`/`toTop`/`toBottom`) | inalterado |
| ST02-016 Corsica Base | Não (`shield` + `condition`) | inalterado |

## 2. Fix

`deploy.ts`: o gatilho `"Deploy"` agora passa por `deferOrDispatchAbilities`
(o MESMO mecanismo já usado por `"When Paired"`), em vez de `dispatchTrigger`
direto:

- **Alvo nomeado + nenhum alvo pré-fornecido** → pausa como
  `PendingDecision.abilityResolution` (mesmo `AbilityResolutionModal` do
  When Paired/Attack — `TRIGGER_LABEL` ganhou a entrada `"Deploy"`).
- **Sem alvo legal quando o jogador resolve** → o efeito simplesmente não
  ativa (`targetIds: []`), a carta **continua em campo** — Comprehensive
  Rules confirma isso via a ruling importada "If an effect requires me to
  choose a target and there's no legal target available, what happens?" →
  "The effect simply doesn't activate at all". A jogada da carta NUNCA é
  bloqueada pelo efeito de alvo (os eventos `MOVE_CARD` já rodaram antes do
  dispatch do trigger).
- **Sem alvo nomeado** (White Base/Asticassia/Wing Gundam/Saint Gabriel/
  Corsica) → `specNeedsNamedTarget` continua `false`, resolvem na hora,
  **sem nenhuma mudança de comportamento**.

Testes novos em `engine/deploy.test.ts` (5): pausa sem `targets`, resolve com
alvo, resolve sem alvo legal (não desfaz o deploy), caminho com `targets`
pré-fornecidos (compat IA/teste), e um Deploy sem alvo nomeado (White Base)
provando que nada mudou pra ele.

## 3. Achado adicional (NÃO corrigido nesta rodada — backlog)

Nem o `AbilityResolutionModal` nem o `targetsByScope` do
`SimulatorMatchPage` filtram os alvos pela restrição numérica do texto da
carta — só pela categoria ampla (`enemyUnit`/`friendlyUnit`/`ownResource`).
Ou seja: **hoje o jogador PODE escolher um alvo tecnicamente ilegal** pra:

| Carta | Trigger | Restrição não aplicada |
|---|---|---|
| ST01-004 Guntank | Deploy | HP ≤ 2 |
| ST01-006 Aerial (Score Six) | When Paired | Lv. ≤ 5 |
| ST01-010 Amuro Ray | When Paired | HP ≤ 5 |
| ST02-014 Siege Ploy | Main/Action | HP ≤ 5 |
| ST01-012 Thoroughly Damaged | Main | só Unit **descansada** |

Isso nunca crasha (o motor aceita qualquer instanceId do escopo), só deixa o
jogador escolher fora da regra impressa. Desenho recomendado pra fechar:
1. `EffectSpec` ganha `targetFilter?: string` (mesmo padrão do
   `condition.predicate`, ex. `"hp<=2"`, `"level<=5"`, `"rested"`).
2. `deferOrDispatchAbilities` calcula `legalTargets: string[]` no servidor
   (única fonte de verdade — tem `GameState` completo) ao montar cada item
   da `queue`, aplicando o filtro sobre o pool de `targetScope`.
3. `AbilityResolutionModal` passa a ler `q.legalTargets` em vez de receber
   `targetsByScope` calculado (e sem filtro) pelo cliente.
4. Pra Siege Ploy/Thoroughly Damaged (fluxo `playCommand`, cliente escolhe o
   alvo ANTES de confirmar) precisa de uma segunda wiring — `handPlayability.
   ts`/cliques no tabuleiro — código diferente do `abilityResolution`.

Não implementado agora pra não arriscar meia-solução em cima do
`ownResource` do Suletta (que já tem filtro próprio hardcoded no cliente —
só resource **descansado** — e não deve ser tocado sem revisão dedicada).

---

## 4. Timer de turno — 90s → 300s / 30s

Pedido do Willen: 90s era curto demais pra decisões com custo+alvo; e o
turno acabava "sem aviso" no meio de um problema (o crash do Guntank, nesse
caso).

- `TURN_DECISION_MS`: **90s → 300s** (Main Phase e qualquer decisão
  interativa — Burst, Mulligan, ordem de gatilhos, resolução de habilidade).
- `ACTION_STEP_DECISION_MS` (novo): **30s**, só pro Action Step (combate OU
  fim de turno) — decisão rápida ("joga um Comando 【Action】 ou passa"), não
  precisa da mesma folga.
- `matchStore.decisionDurationMs(state)`: decide qual prazo vale, na MESMA
  ordem de prioridade do `decisionOwner` (decisão interativa > combate >
  Action Step de fim de turno > Main Phase).
- **`AUTO_FORFEIT_MS`: 300s → 600s.** Necessário — com os dois em 300s, um
  jogador pensando a decisão inteira com a aba em background (sem ping, ver
  `PRESENCE_PING_MS`/`visibilitychange`) seria forfeitado no exato estouro do
  próprio prazo normal, em vez de só ter a ação-padrão aplicada (achado via
  teste: `idleMs >= AUTO_FORFEIT_MS` batia `300_000 >= 300_000` = true).
  `ABANDON_THRESHOLD_MS` (3min, botão de W.O. manual) ficou como estava —
  decisão explícita anterior do Willen, ação manual do oponente, não
  automática.
- **Cliente** (`SimulatorMatchPage.tsx`): avisos em toast quando é sua vez
  de decidir (`myTurnMain`) e o timer cruza os limiares — metade (≤150s),
  faltando 50s, faltando 10s ("vai entrar no Action Step"). Um limiar dispara
  1x por prazo (reseta quando `turnDeadlineAt` muda).

### Verificação
`pnpm test` 425/425 ✓ (5 testes novos em `deploy.test.ts` pro fix do
Guntank; testes de timer em `matchStore.test.ts` recalibrados pros novos
300s/30s/600s) · `check:types` ✓ · `lint:simulator` ✓ · `build` ✓.

**Pendente (lado do Willen):** QA manual — jogar Guntank com e sem alvo
inimigo em campo; observar os avisos de turno nos limiares certos; confirmar
que o Action Step de 30s não pega ninguém desprevenido.
