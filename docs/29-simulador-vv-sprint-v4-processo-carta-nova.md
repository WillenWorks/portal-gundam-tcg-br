# 29 — Sprint V&V rumo ao v1.0 — V4: processo de carta nova

**Branch:** `dev` — 2026-09-04. Continuação de [docs/25](25-simulador-vv-sprint-v0-legalidade-de-alvo.md)–[docs/28](28-simulador-vv-sprint-v3-integridade-server-authoritative.md).

Este doc é o checklist pra adicionar uma carta nova (ST03 em diante) **sem
tocar** `abilityDispatch.ts`/`dispatcher.ts`/UI — só dado novo, no mesmo
espírito do V0 ("motor genérico, incremental por carta, nunca bloco gigante
por carta"). Junta os 2 gaps que V1-V3 encontraram e deliberadamente NÃO
corrigiram (por serem inalcançáveis com as 32 cartas de hoje) como itens de
atenção pra quando uma carta futura precisar deles de verdade.

## Checklist

1. **Texto oficial em inglês, nunca a tradução** — `data/gcg-official-cards.json`
   (ou o mesmo scrape atualizado). Confirme `cardType`, `traits`, `link`,
   `effect` literal. Stats (`level`/`cost`/`ap`/`hp`) vêm da página oficial
   da carta (`gundam-gcg.com/en/cards/detail.php?detailSearch=<code>`).
2. **`CardDef`** (`fixtures/stXXDeck.ts`) — campos estruturados primeiro,
   antes de qualquer `EffectSpec`:
   - `triggerKeywords`/`keywordTags` — gerados por `parseCardEffects()`
     (`src/lib/gundam-card-effects.ts`), nunca digitados à mão.
   - Modificador CONTÍNUO (não é gatilho pontual → ação) = `staticAbilities`
     (`duringPair`/`duringLink`, ex. Gundam ST01-001/Heero Yuy ST02-010),
     nunca `EffectSpec`.
   - Gatilho de combate condicional (ex. "ao destruir em batalha, X") =
     `combatTriggers` (ex. Heavyarms ST02-003/Zechs ST02-011), nunca
     `EffectSpec`.
   - Restrição de legalidade de ATAQUE (quem pode ser alvo/de quem) =
     `attackTargetRules` (ex. Zowort/Wing Gundam ST02-001), nunca
     `EffectSpec`.
   - Card Command/Pilot (【Pilot】[X] no rodapé) = `pilotMode`, o Command em
     si continua indo por `playCommand()`.
3. **`EffectSpec`** (`content/stXX.ts`) só pro que sobrar — gatilho pontual
   → ação (Deploy/When Paired/Attack/Burst/Main/Action/Activate·Main/
   Destroyed). Ver "Vocabulário" abaixo.
   - **`targetScope` explícito sempre que não for `enemyUnit`** — o default
     é `enemyUnit`; um efeito "sua Unit"/"of your Units" SEM `targetScope:
     "friendlyUnit"` explícito deixa escolher a Unit ERRADA (bug real achado
     2x no V0: Kai's Resolve, Simultaneous Fire).
   - **`targetFilter` pra toda restrição além da categoria ampla** — "with N
     or less HP", "Lv.X or lower", "rested", etc. Nunca resolver isso na UI
     (era o hack antigo da Suletta, fechado no V0).
4. **Testes** — mesmo padrão de `deploy.test.ts`/`pendingDecision.test.ts`:
   estado real via `place()`/`giveResources()`, nunca mock de contagem.
5. **Nada mais precisa mudar** — se o passo 3 usa só vocabulário já existente
   (trigger/targetScope/targetFilter/`PrimitiveCall` já suportados), o
   dispatcher, `filterDispatchableSpecs`, `computeLegalTargets`,
   `AbilityResolutionModal`, `handPlayability` e `enforceZoneLimits`
   já cobrem a carta nova sozinhos.

## Vocabulário disponível hoje (referência rápida)

- **`trigger`**: "Deploy" | "When Paired" | "Attack" | "Burst" | "Main" |
  "Action" | "Activate·Main" | "Activate·Action" | "Destroyed".
- **`targetScope`**: `"enemyUnit"` (default) | `"friendlyUnit"` | `"ownResource"`.
- **`targetFilter`** (3 famílias hoje, `content/predicates.ts`): `"hp<=N"` |
  `"level<=N"` | `"rested"`.
- **`PrimitiveCall.op`** (`engine/effectSpec.ts`): `draw` · `discard` ·
  `damageShield` · `destroy` · `moveZone` · `modifyStat` · `grantKeyword` ·
  `rest` · `setActive` · `heal` · `damageUnit` · `payResourceCost` ·
  `spawnToken` · `spawnTokenByOwnUnitCount` · `moveWithinDeck` ·
  `addShieldToHand` · `preventShieldDamage`.
- **`TargetRef.kind`**: `"self"` | `"instance"` | `"named"` (alvo escolhido
  pelo jogador, resolvido em `ctx.targets[name]`) | `"group"` (calculado
  sozinho a partir do estado, ex. `allFriendlyLinkUnits`).
- **`condition.predicate`** (2 famílias hoje, `content/predicates.ts`):
  `"pairedPilotHasTrait:<trait>"` | `"cardInTrashNamed:<nome>"`.

## Itens de atenção (gaps conhecidos, registrados em V1-V3 — NÃO fixados por serem inalcançáveis hoje)

1. **`specNeedsNamedTarget`** (`effectSpec.ts`) só reconhece o alvo nomeado
   literal `"target"` pra decidir se um gatilho precisa pausar e perguntar.
   Se a carta nova usa um `TargetRef.kind: "named"` com outro nome (ex.
   `"toTop"`/`"toBottom"`, como Saint Gabriel Institute — que por isso NUNCA
   pausa hoje, docs/25 §5.1), ela precisa entrar nessa função também, ou o
   motor nunca vai perguntar a escolha.
2. **`keywordValue()`** (`types.ts`) pega o PRIMEIRO `<Repair N>` que achar
   (`keywordGrants.find`/`keywordTags.find`), não soma múltiplas fontes. A
   ruling oficial é clara que Repair empilha por adição simples. Se uma
   carta futura CONCEDE `<Repair N>` a uma Unit que já pode ter Repair
   (impresso ou de outra fonte), `keywordValue` precisa somar em vez de
   pegar o primeiro match (docs/27).
3. **`resolveTriggerOrder`** (`actions.ts`, gatilhos simultâneos de cards
   DIFERENTES no mesmo evento) não passa por `filterDispatchableSpecs` —
   nenhuma carta de ST01/ST02 dispara 2 triggers de cartas diferentes com
   alvo nomeado no mesmo evento hoje. Se uma carta futura fizer isso,
   aplicar a mesma filtragem usada em `playCommand`/`activateAbility`/
   `resolveBurstDecision` (docs/25 §5.2).

## Itens que JÁ são genéricos — não precisam de atenção especial numa carta nova

- **Limite de 6 Units / 1 Base** (`enforceZoneLimits`, docs/27) — cobre
  automaticamente qualquer `deployCard` OU `spawnToken`/
  `spawnTokenByOwnUnitCount` novo, sem checagem própria.
- **Pagamento de custo exatamente N** (`payResourceCostEvents`, docs/28) —
  cobre `deployCard`/`playCommand`/`payResourceCost` de qualquer carta nova.
- **Legalidade de alvo** (`computeLegalTargets`, docs/25) — cobre os dois
  caminhos de dispatch (pausado e direto) pra qualquer `targetFilter` já
  existente; só precisa de extensão se a carta usar uma restrição NOVA (ver
  exemplo abaixo).

## Exemplo trabalhado (hipotético, ilustrativo — nenhuma carta real ainda usa `cost<=N`)

Uma carta futura "**Choose 1 enemy Unit with cost 2 or less. Destroy it.**"
introduz uma família de `targetFilter` que ainda não existe (`hp`/`level`/
`rested` já cobertos, `cost` não). Passo a passo:

**1. `CardDef`** — sem nada especial, é só um Command comum.

**2. `EffectSpec`** (`content/stXX.ts`):
```ts
export const EXEMPLO_MAIN: EffectSpec = {
  id: "STXX-0YY-Main",
  cardCode: "STXX-0YY",
  trigger: "Main",
  actions: [{ op: "destroy", target: { kind: "named", name: "target" } }],
  targetFilter: "cost<=2", // família NOVA — precisa do passo 3
  sourceText: "【Main】Choose 1 enemy Unit with 2 or less cost. Destroy it.",
};
```

**3. Estender `defaultTargetFilterResolver`** (`content/predicates.ts`, ÚNICO
lugar que precisa mudar pra suportar a família nova):
```ts
const costAtMost = filter.match(/^cost<=(\d+)$/);
if (costAtMost) return (candidate.def.cost ?? 0) <= Number(costAtMost[1]);
```

**4. Teste** — mesmo padrão de `handPlayability.test.ts` (3 casos: sem
inimigo → bloqueado; inimigo custo 3 → ainda bloqueado; inimigo custo 2 →
liberado) + o fluxo completo via `applyPlayerAction`.

Nada em `abilityDispatch.ts`, `dispatcher.ts`, `AbilityResolutionModal.tsx`
ou `handPlayability.ts` precisou mudar — `computeLegalTargets` já lê
`targetFilter` genericamente, só o RESOLVER de string precisou de 1 `case`
novo, exatamente como Guntank/Aerial/Suletta fizeram no V0.

## Verificação

Etapa é só documentação — nenhum código mudou, `pnpm test` continua 432/432.

## Status da sprint

V0-V4 completos. Falta só **V5** (ajuste visual leve — widescreen/zoom/
mobile, já pedido pelo Willen junto com esta sprint, ver Captura0/1/2 na
raiz do repo).
