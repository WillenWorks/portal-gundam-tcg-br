# Cobertura de Dano-por-Efeito, Breach e Condicionais — Simulador

> Gerado em 2026-09-05. Auditoria do motor (`src/modules/simulator/engine/`) +
> `content/` contra `data/gcg-official-cards.json`.
> Referências: [AI_GUIDE.md](../AI_GUIDE.md), docs/41, docs/43 §4, docs/44 §4.

---

## 1. O que o motor JÁ cobre

### 1.1 Dano direto de efeito

| Mecânica | Onde | Notas |
|---|---|---|
| `damageUnit` (dano fixo numa Unit/Base) | `effectSpec.ts` → `compilePrimitive` | Emite `DAMAGE_UNIT` + auto `DESTROY_CARD` se `card.damage + amount >= effectiveHp(card, state)` (CR 5-5-2). `effectiveHp` inclui buffs e bônus de Pilot pareado. |
| Alvo em **grupo** | `TargetRef.kind: "group"` | `allEnemyUnits` (com `maxLevel?`), `allFriendlyLinkUnits`. `damageAllEnemyUnits` no `combatTriggers` (ST02-003). |
| `destroy` (destruição direta, sem dano) | `compilePrimitive` op `destroy` | `DESTROY_CARD` puro. |
| **【Destroyed】 disparado por dano de efeito** | `dispatcher.ts` → `dispatchDestroyedFromEffect` (docs/45) | Depois dos eventos de cada EffectSpec, acha Units mortas e dispara seu 【Destroyed】. Não-pausante inline; pausante → `PendingDecision.abilityResolution`. `wasPaired` capturado ANTES do `DESTROY_CARD`. Guarda `MAX_DESTROYED_CHAIN = 8`. Cross-player → fila FIFO (`queuedDestroyed`). |
| **【Destroyed】 no Damage Step** | `actions.ts` → `collectDestroyedInBattle` + `dispatchDestroyedTriggers` (docs/44) | Morte de batalha / Breach letal / `combatTrigger` letal. Caminho separado — `resolveDamageStep` nunca passa por `dispatchTrigger`. |

Cartas ST cobertas: ST03-013 Close Combat 【Main】/【Action】/【Burst】, ST03-015
Rewloola 【Deploy】, ST04-006 Aegis Gundam 【Attack】 (condicional), ST03-001
Sinanju (`combatTrigger`), ST02-003 Heavyarms, ST02-012 Simultaneous Fire.

### 1.2 Condicionais (`EffectSpec.condition` + `PredicateResolver`)

`content/predicates.ts` — `defaultPredicateResolver`:

| Predicado | Carta |
|---|---|
| `pairedPilotHasTrait:<t>` | ST01-002 Gundam MA Form |
| `pairedPilotLevelAtLeast:<n>` | ST04-001 Aile Strike Gundam |
| `cardInTrashNamed:<name>` | ST02-016 Corsica Base |
| `namedChoiceEquals:<key>:<val>` | ST04-012 Striker Pack |
| `selfApAtLeast:<n>` | ST04-006 Aegis Gundam |
| `controllerHasOtherLinkUnit` | ST04-009 Miguel's Ginn |
| `sourcePairedUnitIsLinkUnit` | ST03-011 Char Aznable, ST04-011 Athrun Zala |
| `noControllerUnitTokenWithTrait:<t>` | ST04-012 Striker Pack |

### 1.3 Filtros de alvo (`EffectSpec.targetFilter` + `TargetFilterResolver`)

`content/predicates.ts` — `defaultTargetFilterResolver`:

`hp<=N` · `level<=N` · `level>=N` · `ap<=N` · `hasKeyword:X` · `rested`.
Resolvidos por CANDIDATO em `computeLegalTargets` (escopo `enemyUnit` /
`friendlyUnit` / `ownResource`), calculados uma vez no servidor.

### 1.4 Keywords de combate

`<Breach N>` e `<Suppression>` — só em batalha (`combat.ts` `breachEvents` /
`shieldDamageEvents`), disparados a partir do Damage Step. `<Blocker>`,
`<First Strike>`, `<High-Maneuver>`, `<Repair>`, `<Support N>` — campos nativos
de `CardDef`, motor puro.

---

## 2. Confirmado: dano-por-efeito NÃO dispara Breach / Suppression

Texto oficial de `<Breach N>`:
> "When this Unit's **attack** destroys an enemy Unit, deal the specified amount
> of damage to the first card in that opponent's shield area."

`<Breach>` (`breachEvents`) e `<Suppression>` (`shieldDamageEvents` com `count:2`)
só são calculados dentro de `resolveDamageStep` (`combat.ts`), assim como
`combatTriggerEvents` (Sinanju & cia., que checam "when this Unit's ATTACK
destroys"). Nenhum desses caminhos usa `dispatchTrigger` nem
`compilePrimitive` — logo:

- `damageUnit` / `destroy` de EffectSpec (Close Combat, Rewloola, Aegis, …) →
  **nunca** ativa Breach/Suppression/`combatTrigger`.
- O novo `dispatchDestroyedFromEffect` dispara só o **【Destroyed】** da Unit
  morta, nada de Breach.

**Nada a consertar** — não há ponto de vazamento. Teste de regressão em
`engine/destroyedOutOfCombat.test.ts` ("dano de efeito que mata NÃO dispara
`<Breach>` do atacante").

---

## 3. Padrões de GD / EX ainda NÃO cobertos (backlog das próximas waves)

Nenhum é necessário pra ST01–ST04 — todos os 4 casos ST já estão cobertos.
Levantado de `data/gcg-official-cards.json`:

| Padrão | Exemplos | O que falta no motor |
|---|---|---|
| **Dano a "1 to 2" alvos** | GD01-044 Kshatriya 【When Paired】 "Choose 1 to 2 enemy Units. Deal 1 damage to them." | `TargetRef` / camada de decisão hoje resolvem exatamente 1 alvo nomeado (`ctx.targets.target[0]`). Precisa de "escolha de 1..N" na `PendingDecision.abilityResolution` (min/max count) + `damageUnit` iterar sobre todos os ids. Muitas cartas GD/EB usam o mesmo shape com `Rest`/`Return to hand`. |
| **`targetFilter` relativo à fonte** | GD01-093 Marida Cruz 【During Link】【Attack】, GD02-091 "Lv. equal to or lower than this Unit" | `TargetFilterResolver` recebe `(filter, candidate, { state })` — não tem o `sourceInstanceId`. Precisa passar a fonte no contexto do resolver (`{ state, source }`) e um filtro tipo `levelLteSource`. |
| **【Destroyed】 direcionado que pausa** | GD01-056 "【Destroyed】Choose 1 enemy Unit with 5 or less AP. Deal 1 damage to it.", GD03-099 | Já quase pronto: `dispatchDestroyedFromEffect` → `dispatchDestroyedTriggers` → `deferOrDispatchAbilities` passa `targetFilterResolver`. Falta só autorar o EffectSpec (com `targetScope`/`targetFilter`) e testar o pause com alvo. |
| **Dano condicionado ao próprio estado (além de AP)** | vários GD "if this Unit is (Zeon)", "while this Unit has 5+ AP" | `selfApAtLeast` cobre o caso AP. Cor/trait da própria fonte, contagem de recursos, "2+ rested Units" → novos predicados pontuais em `predicates.ts` (baratos, um por vez). |
| **`<Breach>` condicional / concedido** | GD01-034 "【During Pair】This Unit gains `<Breach 3>`", GD01-054 "while 5+ AP" | `GRANT_KEYWORD` já concede `<Breach N>` (ST02-012). Falta o caminho **estático contínuo** (`staticAbilities`-like pra keyword condicional), hoje só há concessão por evento com `duration`. |
| **Pilot pareado segue a Unit em morte por EFEITO** | qualquer `damageUnit`/`destroy` letal numa Unit pareada | **Gap pré-existente** (não introduzido aqui): `combat.ts` emite `pairedPilotFollowEvents` no Damage Step, mas `compilePrimitive` (`damageUnit`/`destroy`) não. CR 3-3-6: o Pilot deveria ir junto pro trash. Conserto: `compilePrimitive` emitir `DESTROY_CARD` do `pairedPilotId` junto do da Unit, ou centralizar no handler de `DESTROY_CARD` em `events.ts`. Baixo risco, fora do escopo de docs/45. |

---

## 4. Decisão

Nada novo adicionado ao motor além do necessário pra fechar o 【Destroyed】 fora
de combate (docs/45). O resto acima entra carta a carta quando as waves GD/EB
forem autoradas, seguindo o protocolo docs/29 (campo estruturado → primitiva →
teste).
