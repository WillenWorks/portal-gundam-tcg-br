# Plano — Efeito 【Attack】, botões flutuantes, jogabilidade contextual e ciclo de vida da partida

> **Branch:** `feature/simulador-pivot-visual-arena` (continuação da sprint de refinamento).
> **Motor:** só o servidor roda (`server/matchStore.ts` → `src/modules/simulator/engine/*`); cliente e servidor importam o MESMO motor. Cliente é UI + `ui/deployIntent.ts` / `ui/abilityIntent.ts` (heurística).
> **Validação por fase:** `pnpm test && pnpm run check:types && pnpm run lint:simulator` verde antes do commit; `pnpm build` no fim.

---

## 1. Diagnóstico (leitura de código real)

### 1.1 — REGRESSÃO P0: partida trava em loop no 【When Paired】 pendente
`matchStore.ts:461 defaultActionFor()` (ação-padrão do timer de 90s) trata `burst` e `triggerOrder`, **mas não `whenPaired`** (adicionado na Etapa 4). Se um jogador fica AFK durante a decisão de When Paired:
`onTurnTimeout` → `decisionOwner` devolve o jogador → `defaultActionFor` cai no `finishTurn` → `applyPlayerAction` REJEITA ("Resolva o 【When Paired】...") → `catch {}` silencioso → `armTurnTimer` reagenda → **repete a cada 90s pra sempre**, com `notify()` a cada ciclo. **É exatamente o "rodando ininterrupto" que o Willen viu.**

### 1.2 — Efeito 【Attack】 (Suletta) NÃO está implementado no fluxo real
`SULETTA_MERCURY_ATTACK` (`content/st01.ts:91`, `【Attack】【Once per Turn】Choose 1 of your Resources. Set it as active.`) só existe como EffectSpec testado por `dispatchTrigger` direto. `actions.ts:152 declareAttack` → `proceedToBlockStep(declareAttack(...))` **nunca despacha o trigger "Attack"** (`combat.ts:80` diz literalmente "Ponto de extensão futuro pra efeitos 【Attack】 bespoke ... hoje só troca a fase"). Suletta é Pilot nativo — o 【Attack】 dispara quando a Unit pareada ataca (o dispatch tem que olhar o atacante **e** o Piloto pareado). O alvo é "1 dos SEUS Recursos" (não uma Unit inimiga) — precisa de uma escolha interativa que PAUSA até resolver.

### 1.3 — Botões grandes cobrindo a carta
`BattleSlot`: overlay `absolute inset-x-1 bottom-1` empilha botões `h-7 w-full` — largura cheia, tapa a arte e chega perto dos badges AP/HP. `HandFan`: barra `absolute inset-x-0 bottom-0 h-6` "Jogar|Ver" cobre o rodapé da carta.
**Alvo:** botões flutuantes **agarrados na borda** — no topo pra carta da mão, na lateral (esq/dir) pra carta em campo — compactos, sem tapar arte nem AP/HP.

### 1.4 — Jogabilidade não considera recursos/nível/alvo/fase
`handPlayModes()` (`SimulatorMatchPage.tsx:615`) só checa fase (`myTurnMain`, `commandTrigger`). **Não checa:** `resourceArea.length >= level`, `activeResources >= cost`, se há alvo legal pro efeito, se é carta só-【Action】 (só jogável no Action Step). Resultado: carta "colorida/jogável" que você não consegue pagar.
`ActionDock` mostra "Passar" em TODO Action Step, mesmo sem nenhuma jogada 【Action】 possível (o `autoPassActionStep` existe mas vem desligado).
Botões de campo (Atacar/Ativar) já são gated por legalidade — só falta o de Ativar checar alvo, e mostrar o momento de efeito optativo.

### 1.5 — Ciclo de vida da partida
Game-over do motor (`deckOut`, `noShieldsBattleDamage`, `abandonment`) FUNCIONA: `applyAction` lança 409, `armTurnTimer` para o relógio, `sweepStaleMatches` apaga após `FINISHED_MATCH_TTL_MS` (10 min). O cliente redireciona 8s depois do `gameOver`.
**Faltas:**
- AFK prolongado dos DOIS lados nunca vira game-over rápido — só depois de ~50 turnos de auto-`finishTurn` até deck-out (~2 h). Não existe "forfeit por inatividade" automático (W.O. é manual por decisão anterior).
- O link continua "resumível": reabrir `/simulador/partida/:id` de uma partida terminada devolve o estado final e o cliente fica no loop de redirect. Willen quer o link **inválido** ("a partida já não é mais válida") pra cada QA começar do zero.

---

## 2. Fases

| # | Escopo | Arquivos | Risco |
|---|---|---|---|
| **P0** | Fix do loop `whenPaired` no timer + `settleAutoPasses`/`decisionOwner` cientes de `whenPaired` | `server/matchStore.ts` (+teste) | baixo, urgente |
| **P1** | Efeito 【Attack】 no combate real; generalizar `PendingDecision.whenPaired` → `abilityResolution` (When Paired + Attack + futuro), com `targetScope` (unidade inimiga / recurso próprio / …) | `engine/combat.ts`, `engine/actions.ts`, `engine/deploy.ts`, `engine/types.ts`, `ui/WhenPairedModal.tsx`→`AbilityResolutionModal`, `SimulatorMatchPage.tsx` (+testes motor/UI) | alto |
| **P2** | Botões flutuantes: mão = topo da carta; campo = lateral; compactos, sem tapar arte/AP/HP | `BattleSlot.tsx`, `HandFan.tsx` (+testes) | médio |
| **P3** | Jogabilidade contextual: `handPlayModes` checa custo/nível/alvo/fase-action; só carta jogável fica colorida; Action Step some/auto-passa quando não há jogada; prompt de efeito optativo | `SimulatorMatchPage.tsx`, `ui/handPlayability.ts` (novo, puro), `ActionDock.tsx` (+testes) | médio |
| **P4** | Ciclo de vida: forfeit automático por inatividade (X min sem ping de um assento) → game-over `abandonment`; link inválido após game-over (stream manda `ended` e fecha; `getMatch` some mais rápido pra partida terminada); QA começa limpo | `server/matchStore.ts`, `server/index.ts` (+testes) | médio |

---

## 3. Ordem de execução e checkpoints

P0 → P1 → P2 → P3 → P4. Cada fase: implementa → `pnpm test && check:types && lint:simulator` verde → commit com diff no corpo → atualiza a tabela §4. `pnpm build` ao fim de P2/P3/P4 (fases de UI). Sem dev paralelo com agentes: as fases compartilham `SimulatorMatchPage.tsx` / `engine/actions.ts` / `matchStore.ts` — rodar em paralelo geraria conflito. Sequencial com checkpoint verde é mais assertivo aqui.

---

## 4. Status

| Fase | Estado | Commit / notas |
|---|---|---|
| P0 — loop whenPaired | ⬜ | |
| P1 — efeito Attack + abilityResolution | ⬜ | |
| P2 — botões flutuantes | ⬜ | |
| P3 — jogabilidade contextual | ⬜ | |
| P4 — ciclo de vida / link | ⬜ | |
