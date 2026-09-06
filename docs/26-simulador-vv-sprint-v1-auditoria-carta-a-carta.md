# 26 — Sprint V&V rumo ao v1.0 — V1: auditoria carta a carta (ST01+ST02)

**Branch:** `dev` — 2026-09-04. Continuação de [docs/25](25-simulador-vv-sprint-v0-legalidade-de-alvo.md).

## Método

Comparação linha a linha das **32 cartas únicas** (16 ST01 + 16 ST02) contra:
- **Texto oficial em inglês**, `data/gcg-official-cards.json` (scrape versionado
  de gundam-gcg.com — nunca a tradução, convenção já estabelecida em docs/18).
- **Semântica real do motor**: não só "o `EffectSpec` existe", mas lido o
  código de resolução (`effectSpec.ts`, `combat.ts`, `types.ts`) pra confirmar
  que o comportamento em runtime bate com a regra, não só o texto.

Fontes: `content/st01.ts`/`st02.ts` (EffectSpec), `fixtures/st01Deck.ts`/
`st02Deck.ts` (CardDef — stats, keywords, `staticAbilities`/`combatTriggers`/
`attackTargetRules`).

## Resultado — 32/32 ✅

| Code | Nome | Tipo | Efeito oficial | Cobertura | Veredito |
|---|---|---|---|---|---|
| ST01-001 | Gundam | UNIT | `<Repair 2>` + 【During Pair】AP+1 todas amigas | `staticAbilities` (`allFriendlyUnits`, `duringYourTurnOnly`) | ✅ |
| ST01-002 | Gundam (MA Form) | UNIT | 【When Paired･(WBT) Pilot】Draw 1 | `condition.predicate: pairedPilotHasTrait` | ✅ |
| ST01-003 | Guncannon | UNIT | vanilla, link [Kai Shiden] | sem EffectSpec, `link` correto | ✅ |
| ST01-004 | Guntank | UNIT | 【Deploy】Choose 1 enemy HP≤2. Rest it. | `targetFilter: hp<=2` (V0) | ✅ |
| ST01-005 | GM | UNIT | vanilla | sem EffectSpec | ✅ |
| ST01-006 | Aerial (Score Six) | UNIT | 【When Paired】enemy Lv≤5, AP-3 | `targetFilter: level<=5` (V0) | ✅ |
| ST01-007 | Aerial (Bit Form) | UNIT | vanilla, link [Suletta] | sem EffectSpec | ✅ |
| ST01-008 | Demi Trainer | UNIT | `<Blocker>` | `keywordTags` | ✅ |
| ST01-009 | Zowort | UNIT | `<Blocker>` + não pode alvejar jogador | `attackTargetRules.cannotTargetPlayer` | ✅ |
| ST01-010 | Amuro Ray | PILOT | Burst + 【When Paired】enemy HP≤5, Rest | `targetFilter: hp<=5` (V0) | ✅ |
| ST01-011 | Suletta Mercury | PILOT | Burst + 【Attack】Once/turn, seu Recurso descansado→ativo | `targetScope: ownResource` + `targetFilter: rested` (V0) | ✅ |
| ST01-012 | Thoroughly Damaged | COMMAND | 【Main】enemy rested, 1 dano | `targetFilter: rested` (V0) | ✅ |
| ST01-013 | Kai's Resolve | COMMAND | 【Main】**sua** Unit, +3 HP | `targetScope: friendlyUnit` (V0, bug real) | ✅ |
| ST01-014 | Unforeseen Incident | COMMAND | Burst→Main; Main/Action enemy AP-3 | sem filtro (correto, sem restrição no texto) | ✅ |
| ST01-015 | White Base | BASE | Burst/Deploy shield; Activate·Main spawna token por contagem de Units | `spawnTokenByOwnUnitCount` (thresholds 0/1/∞ verificados contra a lógica de match) | ✅ |
| ST01-016 | Asticassia | BASE | Burst/Deploy shield; Activate·Main rest self→+1 AP Link Units | `TargetGroup: allFriendlyLinkUnits` | ✅ |
| ST02-001 | Wing Gundam | UNIT | `<Breach 5>` + pode alvejar Unit ativa Lv≤4 | `attackTargetRules.mayTargetActiveEnemyUnit` (relaxamento, não substituição — verificado em `combat.ts:58`) | ✅ |
| ST02-002 | Wing Gundam (Bird Mode) | UNIT | 【Deploy】1 EX Resource | `spawnToken(EX_RESOURCE_TOKEN)` | ✅ |
| ST02-003 | Heavyarms | UNIT | 【During Pair】ao destruir em batalha, 1 dano a todas Lv≤3 | `combatTriggers` (`duringPair`/`destroyEnemyInBattle`) | ✅ |
| ST02-004 | Sandrock | UNIT | vanilla, link [Quatre] | sem EffectSpec | ✅ |
| ST02-005 | Maganac | UNIT | vanilla, sem link | sem EffectSpec | ✅ |
| ST02-006 | Tallgeese | UNIT | 【Activate･Main】Once/turn ④: set active | `payResourceCost n:4` | ✅ |
| ST02-007 | Leo | UNIT | vanilla, link trait (OZ) — **sem Blocker** | sem EffectSpec, `link: {kind:"trait"}` — confirmado que NÃO tem `<Blocker>` (só Aries/Tragos têm) | ✅ |
| ST02-008 | Aries | UNIT | `<Blocker>` | `keywordTags` | ✅ |
| ST02-009 | Tragos | UNIT | `<Blocker>` | `keywordTags` | ✅ |
| ST02-010 | Heero Yuy | PILOT | Burst + 【During Link】AP+1/HP+1 | `staticAbilities` (`duringLink`/`pairedUnit`) | ✅ |
| ST02-011 | Zechs Merquise | PILOT | Burst + 【During Link】draw ao destruir | `combatTriggers` (`duringLink`) | ✅ |
| ST02-012 | Simultaneous Fire | COMMAND | 【Main】**sua** Unit, `<Breach 3>` | `targetScope: friendlyUnit` (V0, bug real) | ✅ |
| ST02-013 | Peaceful Timbre | COMMAND | 【Action】shields imunes a Lv≤4 nesta batalha | `preventShieldDamage(maxAttackerLevel:4)` | ✅ |
| ST02-014 | Siege Ploy | COMMAND | Burst→Main; Main/Action enemy HP≤5, Rest | `targetFilter: hp<=5` nas 3 seções (V0) | ✅ |
| ST02-015 | Saint Gabriel Institute | BASE | Burst/Deploy shield + peek 2/reorder topo-fundo | ações compilam certo; decisão **nunca dispara** (backlog docs/25 §5.1) | ⚠️ (já registrado) |
| ST02-016 | Corsica Base | BASE | Burst/Deploy shield + token condicional por trash | `condition.predicate: cardInTrashNamed` | ✅ |

## Achados desta etapa

**Nenhum bug novo.** Os únicos 2 desvios reais entre texto oficial e motor
(Kai's Resolve e Simultaneous Fire com `targetScope` errado) já tinham sido
achados e corrigidos no V0 — esta auditoria completa confirma que não
sobrou mais nenhum caso do mesmo tipo nas outras 30 cartas.

**1 observação cosmética, não funcional** (não vale item de backlog, registro
só por transparência): `CardDef.keywordTags` de White Base/Asticassia grava
o texto **"Activate · Main"** (com espaços, saída literal do
`parseCardEffects()`), enquanto o `trigger` interno do `EffectSpec` usa
**"Activate·Main"** (sem espaço). Verificado que isso não causa bug: o botão
"Ativar habilidade" na UI (`abilityIntent.ts`/`BattleSlot.tsx`) resolve
direto contra o array de `EffectSpec` por `cardCode`, nunca lê
`triggerKeywords` pra essa decisão — `keywordTags` é usado só pro badge
visual do texto impresso da carta, um caminho totalmente separado.

**1 item permanece em ⚠️**, já registrado no backlog do V0 (docs/25 §5.1):
Saint Gabriel Institute nunca pergunta o reorder do topo do deck porque é
outro formato de decisão (peek 2 → reordenar), não "escolher 1 alvo" — não
é um achado novo, só confirmado que segue de pé.

## Verificação

Nenhum código mudou nesta etapa (é auditoria pura, sem correção — não havia
o que corrigir). `pnpm test` continua 426/426 desde o commit do V0.

## Próximo passo

V2 — revalidar mecânicas centrais (fases, combate, keywords, zonas) contra o
Comprehensive Rules oficial + as 90 rulings já importadas, fechando os itens
que `docs/23` deixou em ⚠️.
