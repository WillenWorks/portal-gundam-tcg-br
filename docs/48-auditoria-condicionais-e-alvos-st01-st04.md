# Docs 48 — Auditoria e Correção: Efeitos Condicionais e Escolha de Alvos (ST01 a ST04)

> **Status:** Concluído e mergeado em `dev` (`e886200`) e `main` (`f4f6792`).  
> **Data:** 2026-09-08  
> **Escopo:** Starter Decks ST01 a ST04 (64 cartas únicas) · Motor de Regras (`effectSpec.ts`, `abilityDispatch.ts`, `deploy.ts`) · Validação de Alvos e Regras Oficiais Bandai.

---

## 1. Contexto e Motivação

Durante a evolução do simulador do Gundam Card Game (GCG), realizamos uma auditoria carta a carta das 64 cartas únicas dos Starter Decks **ST01** ("Heroic Beginnings"), **ST02** ("Wings of Freedom"), **ST03** ("Zeon's Roar") e **ST04** ("Aile of Justice"), comparando as implementações em código contra os textos e regras oficiais da Bandai (`data/gcg-official-cards.json`).

O objetivo central foi auditar como o motor trata **efeitos com condições** ("If...", "When Paired with Lv.4+...", "Then...") disparados em momentos como `Deploy`, `Attack`, `Destroyed`, `When Paired`, `When Linked`, `Main`, `Action`, `Activate·Main` e `Burst`, garantindo que:
1. Cartas com condições **não satisfeitas** não abram prompts ilegais de seleção de alvo nem pausem o fluxo de jogo.
2. Cartas com alvos válidos filtrem com exatidão conforme os atributos legais (HP, AP, Level, Rested, Trait, etc.).
3. Efeitos encadeados com "Then" (como **ST03-015 Rewloola**) resolvam progressivamente sem quebrar caso partes do efeito não encontrem alvos.

---

## 2. Diagnóstico da Auditoria: O Problema da Avaliação Estática

### 2.1 Causa Raiz Identificada no Motor
No motor de regras, a decisão de colocar uma habilidade na fila interativa (`abilityResolution` em `pendingDecision`) dependia de duas checagens:
- `specNeedsNamedTarget(spec)`: checava se qualquer ação no `EffectSpec` continha `target: { kind: "named", name: "target" }`.
- `specNeedsChoice(spec)`: checava se o spec possuía primitivas de escolha (`deployFromHandTriggered`, `spawnTokenChoice`, etc.).

Ambas as checagens varriam o spec **estaticamente**, incluindo as ações contidas dentro de `spec.condition.then`.

**Consequência de Bug:**
Se uma carta possuía um efeito com alvo dentro de `condition.then`, o motor marcava a carta como "interativa" **antes** de testar o predicado da condição. Por exemplo:
- **ST04-006 Aegis Gundam**: `【Attack】If this Unit has 5 or more AP, choose 1 enemy Unit that is Lv.5 or higher. Deal 3 damage to it.`
  - Quando atacava com AP 4 (< 5), a condição era falsa. Mas como havia um alvo nomeado em `condition.then`, o motor pausava o jogo e abria uma caixa pedindo para o jogador escolher uma Unit inimiga Lv.5+.
- **ST04-001 Aile Strike Gundam**: `【When Paired･Lv.4 or Higher Pilot】Choose 1 enemy Unit with 4 or less HP. Return it to its owner's hand.`
  - Ao ser pareada com piloto de nível 3 (como Mu La Flaga ou Kai Shiden), a condição `pairedPilotLevelAtLeast:4` era falsa, mas o simulador ainda assim abria prompt de seleção de alvo.
- **ST04-012 Striker Pack**: `【Main】If you have no (Earth Alliance) Unit tokens in play, deploy 1 [Sword Strike Gundam] or 1 [Launcher Strike Gundam] token.`
  - Quando jogada já tendo um token da Earth Alliance em jogo, pausava para pedir escolha entre Sword e Launcher, mesmo sendo proibido invocar tokens.

**Regra Oficial Bandai:**  
Se a condição de um efeito não for satisfeita no momento do disparo ("If...", "When Paired with..."), o efeito não é ativado, nenhuma escolha de alvo é requerida e o jogo continua sem pausas interativas.

---

### 2.2 Auditoria de ST03-015 Rewloola (Cláusulas "Then")
Texto oficial:
> *【Deploy】Add 1 of your Shields to your hand. Then, choose 1 enemy Unit with 5 or less AP. Deal 1 damage to it.*

- **Padrão Bandai para "Then"**: Resolve A tanto quanto possível, depois B tanto quanto possível.
- No simulador, a Rewloola foi modelada em 2 `EffectSpec` separados:
  1. `ST03-015-Deploy-Shield`: incondicional. Pega 1 shield. Se o jogador tiver 0 shields, resolve como no-op seguro.
  2. `ST03-015-Deploy-Damage`: busca unidades inimigas com AP $\le 5$. Se o oponente não possuir nenhuma unidade com AP $\le 5$, lista `legalTargets: []` e a ação resolve com `targetIds: []` de forma segura (sem crash).
- A divisão em 2 specs é 100% correta e aderente às regras oficiais. Adicionamos `targetScope: "enemyUnit"` explícito ao spec de dano.

---

### 2.3 Auditoria de Escopos de Alvo (`targetScope`)
Detectamos que 11 cartas de ST01 a ST04 definiam filtros em `targetFilter` (ex.: `hp<=5`, `level<=5`, `rested`, `ap<=5`), mas não declaravam explicitamente `targetScope: "enemyUnit"`. Embora o padrão da UI fosse assumir `enemyUnit`, explicitar o escopo em todos os specs evita qualquer ambiguidade de direcionamento para unidades aliadas.

---

## 3. Implementação e Correções na Arquitetura

### 3.1 Avaliação Dinâmica de Condições (`specActiveCalls`)
No arquivo `src/modules/simulator/engine/effectSpec.ts`, introduzimos o conceito de **chamadas ativas**:

```typescript
export function specActiveCalls(
  spec: EffectSpec,
  ctx: EffectContext,
  predicateResolver?: PredicateResolver,
): PrimitiveCall[] {
  const calls: PrimitiveCall[] = [...(spec.actions ?? [])];
  if (spec.condition) {
    if (predicateResolver) {
      const passes = predicateResolver(spec.condition.predicate, ctx);
      if (passes) {
        calls.push(...spec.condition.then);
      } else if (spec.condition.else) {
        calls.push(...spec.condition.else);
      }
    } else {
      calls.push(...spec.condition.then);
    }
  }
  return calls;
}
```

E utilitários para verificar necessidades de interação baseados apenas nas primitivas **efetivamente ativas**:
- `callsNeedNamedTarget(calls: PrimitiveCall[]): boolean`
- `callsChoicePrimitive(calls: PrimitiveCall[]): ChoicePrimitive | undefined`
- `callsNeedChoice(calls: PrimitiveCall[]): boolean`

### 3.2 Despacho Condicional em `abilityDispatch.ts`
No método `deferOrDispatchAbilities`, agora filtramos as entradas ativas considerando o predicado:
1. Calculamos `activeCalls = specActiveCalls(spec, ctx, opts.predicateResolver)`.
2. Descartamos specs cuja condição falhou e não possuem ações ativas.
3. Classificamos como `interactive` apenas as entradas cujas chamadas ativas exigem alvo ou escolha (`callsNeedNamedTarget(activeCalls) || callsNeedChoice(activeCalls)`).
4. Em `buildQueueEntry`, passamos `activeCalls` para que `needsTarget` e `choice` reflitam apenas a ramificação válida.

### 3.3 Comandos em `deploy.ts`
Em `playCommand`, a checagem `needsChoice` agora avalia `specActiveCalls(s, cmdCtx, options.predicateResolver)`. Dessa forma, cartas como Striker Pack jogadas com token em campo não travam o jogo esperando uma escolha inexistente.

### 3.4 Declaração Explícita de `targetScope` nas Cartas
Atualizados os specs nos arquivos de conteúdo:
- **`st01.ts`**: `GUNTANK_DEPLOY`, `AERIAL_SCORE_SIX_WHEN_PAIRED`, `AMURO_RAY_WHEN_PAIRED`, `THOROUGHLY_DAMAGED_MAIN`, `UNFORESEEN_INCIDENT_BURST/MAIN/ACTION`.
- **`st02.ts`**: `SIEGE_PLOY_BURST`, `SIEGE_PLOY_MAIN`, `SIEGE_PLOY_ACTION`.
- **`st03.ts`**: `CLOSE_COMBAT_BURST/MAIN/ACTION`, `REWLOOLA_DEPLOY_DAMAGE`.
- **`st04.ts`**: `AILE_STRIKE_WHEN_PAIRED`, `AEGIS_GUNDAM_ATTACK`, `KIRA_YAMATO_ATTACK`, `HAWK_OF_ENDYMION_MAIN/ACTION`.

---

## 4. Testes e Validação de Regressão

### 4.1 Nova Suíte de Testes: `conditionTargetAudited.test.ts`
Local: `src/modules/simulator/engine/conditionTargetAudited.test.ts` (14 testes, todos passando):
- **Aegis Gundam (`ST04-006`)**:
  - Atacando com AP 4: condição `selfApAtLeast:5` é falsa $\rightarrow$ `pendingDecision.A` é `null` (sem prompt).
  - Atacando com AP 5: condição é verdadeira $\rightarrow$ abre `abilityResolution` e `legalTargets` contém apenas unidades inimigas Lv.5+.
  - Atacando com AP 5 sem unidades inimigas Lv.5+: `legalTargets` é `[]` e não trava.
- **Aile Strike Gundam (`ST04-001`)**:
  - Pareamento com piloto Lv.3: condição `pairedPilotLevelAtLeast:4` é falsa $\rightarrow$ sem prompt.
  - Pareamento com piloto Lv.4 (Athrun Zala): condição verdadeira $\rightarrow$ abre prompt e restringe a unidades inimigas com HP $\le 4$.
- **Striker Pack (`ST04-012`)**:
  - Main com token em campo: condição falsa $\rightarrow$ comando vai para o trash sem abrir prompt de escolha de token.
  - Main sem token em campo: abre prompt para escolher entre Sword e Launcher.
  - Burst com token em campo: não spawna token novo.
- **Rewloola (`ST03-015`)**:
  - Deploy com 0 shields e inimigo com AP $\le 5$: shield é no-op e dano funciona.
  - Deploy com inimigos sem AP $\le 5$: shield vai para a mão, efeito de dano lista 0 alvos legais e resolve sem crash com `targetIds: []`.
- **Auditoria de Escopos em ST01–ST04**:
  - Validação de `computeLegalTargets` e rejeição de alvos ilegais por `playCommand` para Guntank, Siege Ploy, Close Combat e Hawk of Endymion.

### 4.2 Impacto no Golden Master
Ao rodar `pnpm run gundam:golden:update`:
- **9 de 10 pares canônicos permaneceram estritamente idênticos**.
- Apenas `ST02_vs_ST04_seed7` teve seu hash atualizado de `4f41fa4a...` para `3585cfb7...`, pois partidas simuladas com bot/heurística no ST04 anteriormente executavam o prompt indevido do Aegis Gundam ou do Striker Pack, alterando levemente a árvore de decisões.
- `npx vitest run src/modules/simulator/engine/goldenMaster.test.ts`: **100% verde**.

### 4.3 Total de Testes e Tipagem
- **`tsc -b`**: 0 erros.
- **Suíte Completa do Simulador**: **710 testes passando** (0 falhas).

---

## 5. Guia para Próximos Assistentes e Ambientes

Quando trabalhar com regras e efeitos de cartas no simulador:

1. **Sempre use `specActiveCalls` para checar ações ativas:**
   Nunca assuma que as ações de `spec.condition.then` devem ser executadas ou consultadas sem antes validar `spec.condition.predicate` com o contexto atual (`EffectContext`).

2. **Sempre declare `targetScope` e `targetFilter` explicitamente:**
   Ao criar novos `EffectSpec` (para expansões futuras como GD01, EB01 ou novos STs):
   ```typescript
   export const MINHA_CARTA_DEPLOY: EffectSpec = {
     id: "XX01-001-Deploy",
     cardCode: "XX01-001",
     trigger: "Deploy",
     targetScope: "enemyUnit", // ou "friendlyUnit", "ownResource"
     targetFilter: "hp<=4",    // se aplicável
     actions: [{ op: "damageUnit", target: { kind: "named", name: "target" }, amount: 2 }],
   };
   ```

3. **Como rodar os testes relevantes:**
   ```bash
   # Teste específico desta auditoria:
   npx vitest run src/modules/simulator/engine/conditionTargetAudited.test.ts

   # Teste de golden master:
   npx vitest run src/modules/simulator/engine/goldenMaster.test.ts

   # Teste geral de engine e content:
   npx vitest run src/modules/simulator/engine src/modules/simulator/content

   # Typecheck:
   npx tsc -b
   ```
