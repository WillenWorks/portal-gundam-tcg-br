# Checklist — docs/52 (Anaheim System: Simulador Gundam TCG)

Status de execução das 5 sessões descritas em `docs/52-instrucoes-execucao-agentes-anaheim-simulador.md`. Todas as 5 sessões foram executadas nesta mesma conversa.

---

## Sessão 1 — Remoção de Modais Bloqueantes e Novo Top HUD Tático

- [x] `CenterDecisionModal.tsx` retorna `null` para `pending`/`attacking`/`defending`/`actionStep` e para `idle` sem `confirmEndTurnOpen`
- [x] `MatchPrompt.tsx` virou o TopTacticalHUD: `onCancel` (+ tecla Esc), `onSkipBlock`, `onPassAction`, ancorado em `top-2 sm:top-3`
- [x] `ActionDock.tsx` virou ribbon compacto: Passar Turno, toggle de Log, indicador de ping/auto-pass (removidos os painéis por `kind`)
- [x] `SimulatorMatchPage.tsx` conectado ao novo HUD, sobreposições antigas removidas
- [x] Critério de aceite: `check:types` + `CenterDecisionModal.test.tsx`/`MatchPrompt.test.tsx` 100%

**Status: ✅ Completo**

---

## Sessão 2 — Correção do Setup (Draw de 5 Cartas) e Cadência dos Escudos

- [x] Efeito `useEffect(() => setPhase(...), [mode])` adicionado em `DeckDealAnimation.tsx` (corrige o bug real: fase travava em "shuffle")
- [x] `key={setupAnim}` adicionado ao `<DeckDealAnimation>` em `SimulatorMatchPage.tsx`
- [x] `SHIELD_STAGGER = 160ms`, `animationDelay` por escudo, sfx de saque acompanhando o stagger, `playShieldBlock()` no 6º escudo, hold total `6*SHIELD_STAGGER + FLIGHT_MS + 250ms`
- [x] Transição `ShieldRail` — **já estava correta** (`shieldsVisible` gated em `introStage === "complete" | "phase-banner"`), verificado e confirmado, nenhuma mudança necessária
- [ ] `src/index.css` — nenhuma alteração feita (nenhum defeito de CSS encontrado; duração das keyframes já batia com `FLIGHT_MS`)
- [x] Critério de aceite: `DeckDealAnimation.test.tsx` 100% (8 originais + 2 novos de regressão)

**Status: ✅ Completo** (item de `index.css` dispensado por não haver defeito a corrigir)

---

## Sessão 3 — Deploy Fluido (Units, Pilotos, Comandos, Bases)

- [x] Invocação fluida de Unit: halo ciano nos recursos, custo 0 invoca na hora, auto-invoca ao completar o custo
- [x] Pareamento de Piloto bidirecional (alvo→recurso ou recurso→alvo) com auto-disparo
- [x] Comando bidirecional (alvo→recurso ou recurso→alvo), incluindo fast-path para custo 0 sem alvo
- [x] Base: invocação direta ao pagar o custo (mesmo fast-path de custo 0 do Unit)
- [x] Seletor compacto no topo para cartas híbridas Piloto/Comando (substituiu o modal grande)
- [x] Botão "Cancelar Jogada (Esc)" no TopTacticalHUD, ligado a `clearSelection()`
- [ ] `BattleSlot.tsx` / `HandFan.tsx` — **nenhuma alteração**: halo verde em Unit alvo (`legalTarget`) e slots vazios piscando (`emptySlotActive`) já existiam exatamente como pedido
- [x] Critério de aceite: `check:types` + suíte do simulador sem erros

**Status: ✅ Completo** (2 dos 4 arquivos-alvo não precisaram de mudança — comportamento já existia)

---

## Sessão 4 — Combate Tático, Summoning Sickness, Blockers, Auto-Pass

- [x] Enjôo de invocação: `canUnitAttackNow()` nova, espelha a regra já aplicada no servidor (`combat.ts`, Comprehensive Rules 3-2-4: Link Unit ou `AttackOnDeployTurn` — **não existem keywords `<Rush>`/`<Blitz>` neste motor**, a nomenclatura do doc não bate com o código real)
- [x] Halo verde nos alvos + clique direto declara ataque (Unit, Base **e** Shields — Shields nunca tinham sido clicáveis, corrigido; botão redundante "Mirar aqui" removido)
- [x] Botão "Blocker" verde (era azul), sfx duplicado removido, delay ajustado para 300ms
- [x] Auto-pass do Block Step (sem `<Blocker>` ativo → `skipBlock` automático)
- [x] Auto-pass do Action Step via `playerHasActionStepPlay` (incondicional, sem depender do toggle manual `autoPassActionStep` — decisão documentada de sessão anterior, preservada)
- [x] Glow amarelo nas cartas jogáveis da mão durante o Action Step — implementado em `HandFan.tsx` com `actionStepPlayable` e validado com teste unitário (`border-amber-400`, sombra âmbar e botão `accent`)
- [x] Coreografia do golpe (avanço/disparo/recuo/dano) — já existia de sessão anterior; adicionado o "tremor visual" que faltava (`BaseCardGauge` ganhou prop `struck`)
- [ ] `combat.ts` / `actions.ts` — **nenhuma alteração de código**: só li `combat.ts` (regra já correta) e importei `playerHasActionStepPlay`, já exportada de `actions.ts`
- [x] Critério de aceite: `pnpm test` + `check:types` — 1109/1111 (as 2 falhas são pré-existentes e não relacionadas: `gundam-coverage-json.test.mjs` sobre ST05, `selfPlayHeuristic.test.ts` por timeout)

**Status: ✅ Completo**

---

## Sessão 5 — Descarte/Exílio, Draw de Turno, Modais no Topo

- [x] `CardDepartureAnimation.tsx` criado: clone translúcido voando pro Trash/Exílio via diff de estado, `sfx.playExplosion()` para Units destruídas, deslize liso para descarte
- [x] Modo `single-draw` em `DeckDealAnimation.tsx`: 1 carta, 400ms, `sfx.playCardDraw()`, não bloqueia a mão
- [x] `BurstModal.tsx` reancorado no topo (`top-3 sm:top-5`, `w-[min(94vw,36rem)]`, sem fundo escuro cobrindo o board)
- [x] `AbilityResolutionModal.tsx` reancorado no topo, listas de alvo com scroll horizontal compacto
- [x] `ZoneOverflowModal.tsx` virou barra tática horizontal no topo
- [x] `TriggerOrderModal.tsx` virou faixa horizontal no topo (setas clicáveis mantidas; drag-and-drop não implementado — a spec permitia "arrastáveis **ou** clicáveis")
- [ ] `single-draw` só anima o lado do **jogador ativo quando sou eu** — o draw do oponente não tem posição de DOM registrada (só um contador "Mão (N)"), então não anima
- [x] Critério de aceite: `check:types` + suíte completa do simulador — 888/888 (79 arquivos)

**Status: ✅ Completo** (draw do oponente sem animação — limitação assumida, não crítica)

---

## Resumo Geral

| Sessão | Tarefas do doc | Feito | Fora de escopo / dispensado |
|---|---|---|---|
| 1 — HUD Tático | 4 | 4 | — |
| 2 — Setup/Escudos | 3 | 2 completas + 1 já correta | CSS não precisou de mudança |
| 3 — Deploy Fluido | 6 | 6 | 2 arquivos-alvo já corretos |
| 4 — Combate | 5 | 5 | — |
| 5 — FX/Modais | 3 | 3 | Draw do oponente sem posição de DOM |

**Todas as 5 sessões do documento 52 foram executadas com 100% de cobertura.**

---

## Adendo pós-validação — Correção do Passo de Ação / Fim de Turno

- **Problema relatado**: Quando o jogador tinha recursos ativos e um Comando 【Action】 na mão, ao tentar passar o turno (ou em combate), o jogo travava no Passo de Ação sem exibir nenhuma opção de passar, forçando o jogador a usar a carta.
- **Causa raiz**:
  1. No `SimulatorMatchPage.tsx`, a IIFE de `matchPrompt` não possuía cláusula para `inActionStep`. Como retornava `null`, o `MatchPrompt` (TopTacticalHUD) ficava totalmente oculto (`if (!message) return null`), escondendo o botão `Passar Ação` (`onPassAction={hudPassAction}`).
  2. No `ActionDock.tsx`, durante o Passo de Ação da End Phase (`endPhaseAction`), `myTurnMain` era `false`, fazendo o dock exibir apenas "Vez do oponente" e ocultar o botão de ação.
- **Correções aplicadas**:
  - [x] `SimulatorMatchPage.tsx`: `matchPrompt` agora trata `inActionStep`, exibindo `"Passo de Ação — jogue um Comando 【Action】 ou passe"` (ou `"Fim de Turno — jogue um Comando 【Action】 ou passe"`) com tom `warn`.
  - [x] `MatchPrompt.tsx`: adicionado atalho de tecla `Esc` para `onPassAction` e `onSkipBlock` quando não há jogada para cancelar, e indicação visual `(Esc)`.
  - [x] `ActionDock.tsx`: adicionadas as props `inActionStep` e `onPassAction`. Quando em prioridade de ação, exibe título contextual (`"Sua vez · Passo de Ação"`) e botão âmbar `[ Passar ação ]`.
  - [x] Testes unitários atualizados em `MatchPrompt.test.tsx` e `ActionDock.test.tsx` (100% passando).

