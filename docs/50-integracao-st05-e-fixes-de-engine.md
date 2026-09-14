# docs/50: Integração do ST05 no Simulador + 2 Fixes de Engine (achados no fuzzing)

Data: 2026-09-14
Status: Implementado na branch `dev` (aguardando merge)

---

## 1. Visão Geral

Esta entrega integra o **ST05 "Iron-Blooded Struggle"** (Mobile Suit Gundam: Iron-Blooded Orphans — Tekkadan/roxo vs Gjallarhorn/branco) ao simulador, seguindo exatamente o mesmo padrão de `content/st01.ts`..`content/st04.ts` / `fixtures/st01Deck.ts`..`st04Deck.ts`. No processo, o fuzzing de regressão (`scripts/gundam-fuzz.mjs`) achou **2 bugs reais de engine pré-existentes** — nenhum dos dois é específico do ST05, mas nenhum starter deck anterior tinha o formato de carta exato que os expunha.

Escopo: 15 cartas únicas do ST05, cor **Purple** (primeira vez que um starter deck usa essa cor — GD01 já a usava em cartas soltas do catálogo, mas nenhum starter).

---

## 2. Fixtures e EffectSpecs

- `src/modules/simulator/fixtures/st05Deck.ts` — 15 `CardDef` + `RESOURCE`, deck 50+10 (composição própria dentro do limite de 4 cópias/code, mesma convenção de ST01-04). Stats de `data/apitcg-gundam.json` (`set.code === "ST05"`), texto oficial de `data/gcg-official-cards.json`.
- `src/modules/simulator/content/st05.ts` — 15 `EffectSpec` bespoke cobrindo 9 das 15 cartas (as outras 6: 4 vanilla sem texto, 1 keyword-só `<Blocker>`, 1 `staticAbilities`-só).
- `src/modules/simulator/content/st05.test.ts` — 17 testes unitários carta a carta.
- Registrado em `content/index.ts` (`ALL_EFFECT_SPECS`), `content/validatedDecks.ts` (`VALIDATED_DECKS.ST05`), `content/simulatorDeckPresets.ts`, `server/index.ts` (`SIMULATOR_DECKS.ST05`), `scripts/gundam-coverage.mjs` (`GATED_SETS`), `scripts/gundam-fuzz.mjs` (`DECKS.ST05`), `engine/__golden__/harness.ts` (bloco `ST05_PAIRS`, seeds 16-21, seguindo a regra "nunca insira uma wave nova dentro do loop anterior").

## 3. Gap de engine fechado: `StaticTargetCondition.isDamaged`

ST05-001 (Gundam Barbatos 4th Form) e ST05-002 (Gundam Barbatos 2nd Form) têm cláusulas auto-referentes do tipo *"While this Unit is damaged, ..."* — uma condição estática sobre a PRÓPRIA carta, algo que nenhuma carta ST01-04/GD01 tinha antes. `StaticTargetCondition` só tinha `apAtLeast`/`colorIs`/`traitIs`/`hasKeyword`; os campos `scope: "self"` e `condition: "always"` já existiam, só faltava o kind pra checar dano acumulado.

Fix: adicionado `{ kind: "isDamaged" }` em `engine/types.ts` (`StaticTargetCondition` + `isTargetConditionMet`: `target.damage > 0`). `computeStaticStatBonus`/`findActiveStaticKeywordAbility` já recomputam dinamicamente a cada chamada de `effectiveAp`/`hasKeyword` com `state` — nenhuma outra mudança necessária.

## 4. Bug de engine #1: candidato de ação com alvo obrigatório e pool vazio

**Achado no fuzzing** (`ST05xST05 seed=71..100`, ~30% das partidas): `nenhuma ação legal para <seat> (pending=abilityResolution)`.

Causa raiz: em `legalActions.ts`, os 3 pontos que enumeram Commands/`Activate·Main` (`commandActionCandidates`, o bloco de Command 【Main】 em `mainPhaseCandidates`, e `activateAbilityCandidates`) tinham o mesmo padrão:

```ts
if (someSpecNeeds && ids.length > 0) {
  // ... push com targets
} else {
  out.push({ kind: "playCommand", ... }); // SEM targets, mesmo quando someSpecNeeds && ids.length === 0
}
```

Quando `someSpecNeeds` é `true` (o spec exige alvo nomeado) mas `ids.length === 0` (nenhum alvo legal no board atual — ex. ST05-013 "Choose 1 of your Units" jogada sem nenhuma Unit própria em campo), o `else` ainda oferecia a jogada SEM alvo. Ao resolver, a fila de decisão pedia um alvo que não existia — `pendingDecision` travado, 0 ações legais pra sempre.

Fix: os 3 pontos agora só entram no fallback "sem alvo" quando `!someSpecNeeds`; quando `someSpecNeeds && ids.length === 0`, a jogada simplesmente não é oferecida (mesma filosofia do fix de condicionais do docs/48 — "condição/pool vazio não abre decisão", só que pra pool vazio em vez de condição falsa).

**Efeito colateral esperado**: como isso muda `enumerateLegalActions` (consumida por `randomLegal`/heurístico/MCTS), o **golden-master de vários pares ST01-04/GD01 mudou de hash** (a sequência de RNG consumida muda quando uma opção anteriormente oferecida — e ilegal na prática — deixa de existir). Rodado `pnpm gundam:golden -- --update`: 21 pares, hashes regravados. Nenhuma partida ficou com resultado `crashed`/`illegalState` antes ou depois — é mudança de COMPORTAMENTO correta (menos jogadas travadas), não regressão de resultado.

## 5. Bug de engine #2 / gap deferido: `secondaryTarget` fora de Command 【Main】 da mão

**Achado no fuzzing**: ST05-010 Mikazuki Augus 【When Paired】"Choose 1 of your Units and 1 enemy Unit. Deal 1 damage to them." usa `EffectSpec.secondaryTarget` (2 alvos nomeados). Esse campo só é resolvido no caminho especial de Command 【Main】 jogada da mão (`legalActions.ts` `mainPhaseCandidates`, precedente GD01-103/112) — o dispatcher genérico de gatilho automático (`abilityDispatch.ts` → `pendingDecision.abilityResolution`) não carrega um 2º alvo nomeado na fila. Resultado: parear o Mikazuki travava a partida esperando um alvo que a enumeração/UI nunca oferecia.

Fechar isso direito exige estender `PendingDecision`, `abilityDispatch.ts`, `legalActions.ts` E `actions.ts` (`resolveAbility`) pra um 2º `TargetRef` nomeado por entrada de fila — e provavelmente a UI de decisão também precisa saber renderizar 2 seletores de alvo. Fora do escopo desta wave: **deferido** em `content/deferred.ts` (`ST05-010`, `blockedBy: "engine:secondaryTarget-fora-de-command-main-da-mao"`). A 1ª cláusula da carta (【Burst】Add this card to your hand) está implementada normalmente.

## 6. Resultado

| Verificação | Resultado |
|---|---|
| `pnpm run check:types` (`tsc -b`) | limpo |
| `pnpm exec vitest run content/st05.test.ts` | 17/17 |
| `pnpm run catalog:coverage:gate` | ST05: 9+2\* impl · 4 vanilla · 0 deferida · **0 faltando** |
| `pnpm run gundam:fuzz -- --games=100` (21 pares, incl. ST05×ST05 e ST05×GD01) | 2100 partidas, **0 achados** |
| `pnpm run gundam:golden -- --update` | 21 pares, hashes regravados (ver §4) |

## 7. Pendências / fora de escopo

- ST05-010 【When Paired】(2º alvo) — deferido, ver §5.
- ST05-011 Akihiro Altland 【During Link】(retrieve de trash) — deferido (mesma classe de `CombatTrigger` limitado já documentada pra GD01).
- Subtítulo oficial "Iron-Blooded Struggle" usado nos presets (`SIMULATOR_DECK_PRESETS`, `VALIDATED_DECKS`) é uma tradução própria (mesmo padrão dos apelidos de ST01-04) — não achamos um nome oficial fixo em pt-BR/en pro starter deck nos dados disponíveis; confirmar se aparecer uma fonte oficial.
- GD01 continua com 12 cartas `faltando` no dashboard de cobertura (fora do escopo desta wave, que era só ST05 + tradução).
