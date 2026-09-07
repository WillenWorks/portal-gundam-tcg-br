import type { EffectSpec, PrimitiveCall } from "../engine/effectSpec";
import { TOKEN_CHARS_ZAKU_II, TOKEN_ZAKU_II } from "../fixtures/st03Deck";

/**
 * Wave ST03 "Zeon's Fangs" (docs/41) — EffectSpec real, autorada carta a carta
 * contra o `effect` oficial em inglês de `data/gcg-official-cards.json` (nunca a
 * tradução — docs/18, "Cobertura de idioma"). Mesmo padrão de `content/st01.ts`
 * / `content/st02.ts`: cada spec é testado chamando `resolveEffectSpec`
 * diretamente com um `EffectContext` montado à mão (ver `st03.test.ts`).
 *
 * Cobertura das 16 cartas únicas:
 * - Vanilla / só-keyword-automática (motor cobre sozinho, sem EffectSpec):
 *   ST03-002 Angelo's Geara Zulu, ST03-003 Geara Zulu, ST03-004 Gaza D,
 *   ST03-005 Dra-C, ST03-007 Zaku I (<Support>/link/vanilla — ver st03Deck.ts).
 * - Bespoke via EffectSpec: abaixo.
 * - Modelado como campo de `CardDef` (não gatilho→ação): nada em ST03.
 *
 * CLÁUSULAS FECHADAS NESTA RODADA (antes deferidas — docs/43 §4):
 * - ST03-001 Sinanju: 2ª cláusula — "when this Unit destroys an enemy shield
 *   area card with battle damage, choose 1 enemy Unit. Deal 2 damage to it."
 *   `combatTriggers` novo `on: "destroyEnemyShieldInBattle"` +
 *   `action: "damageChosenEnemyUnit"` (auto-mira a 1ª Unit inimiga legal — não
 *   há sistema de decisão em combate; ver combat.ts).
 * - ST03-014 The Blue Giant 【Action】: `THE_BLUE_GIANT_ACTION` abaixo, primitiva
 *   `preventUnitBattleDamage` + `CombatState.unitDamageProtection`.
 *
 * APROXIMAÇÃO MANTIDA (docs/43 §4):
 * - ST03-001 Sinanju: 【During Pair】<High-Maneuver> = keyword fixa em st03Deck.ts
 *   (Sinanju tem Link e quase sempre ataca pareada; `hasKeyword` é consultado
 *   sem `state` em ~9 pontos do motor — não vale propagar `state` por 1 carta).
 */

// ST03-006 Char's Zaku Ⅱ — 【Destroyed】Look at the top 3 cards of your deck. You
// may reveal 1 (Zeon)/(Neo Zeon) Unit card among them and add it to your hand.
// Return the remaining cards randomly to the bottom of your deck.
// Despachado nos dois caminhos de 【Destroyed】: no Damage Step via
// `actions.ts` -> `dispatchDestroyedTriggers` (docs/44), e FORA de combate
// (morta por dano de efeito — Close Combat 【Main】, etc.) via
// `dispatchTrigger` -> `dispatchDestroyedFromEffect` (docs/45). Por ter
// `lookAtTopFilterReveal` (`optional`), PAUSA em `PendingDecision.abilityResolution`
// com `deckTopReveal`; o dono resolve por `resolveAbility`.
export const CHARS_ZAKU_II_DESTROYED: EffectSpec = {
  id: "ST03-006-Destroyed",
  cardCode: "ST03-006",
  trigger: "Destroyed",
  actions: [
    {
      op: "lookAtTopFilterReveal",
      player: "controller",
      count: 3,
      filter: { cardType: "UNIT", anyTrait: ["Zeon", "Neo Zeon"] },
    },
  ],
  optional: true,
  sourceText:
    "【Destroyed】Look at the top 3 cards of your deck. You may reveal 1 (Zeon)/(Neo Zeon) Unit card among them and add it to your hand. Return the remaining cards randomly to the bottom of your deck.",
};

// ST03-008 Zaku Ⅱ — 【Attack】This Unit gets AP+2 during this turn.
export const ZAKU_II_ATTACK: EffectSpec = {
  id: "ST03-008-Attack",
  cardCode: "ST03-008",
  trigger: "Attack",
  actions: [{ op: "modifyStat", target: { kind: "self" }, stat: "ap", amount: 2, duration: "endOfTurn" }],
  sourceText: "【Attack】This Unit gets AP+2 during this turn.",
};

// ST03-009 Gouf — 【Deploy】Deploy 1 rested [Zaku Ⅱ]((Zeon)･AP1･HP1) Unit token.
export const GOUF_DEPLOY: EffectSpec = {
  id: "ST03-009-Deploy",
  cardCode: "ST03-009",
  trigger: "Deploy",
  actions: [{ op: "spawnToken", def: TOKEN_ZAKU_II, player: "controller", zone: "battleArea", rested: true }],
  sourceText: "【Deploy】Deploy 1 rested [Zaku Ⅱ]((Zeon)･AP1･HP1) Unit token.",
};

// ST03-010 Full Frontal — 【Burst】Add this card to your hand.
export const FULL_FRONTAL_BURST: EffectSpec = {
  id: "ST03-010-Burst",
  cardCode: "ST03-010",
  trigger: "Burst",
  actions: [{ op: "moveZone", target: { kind: "self" }, toZone: "hand" }],
  sourceText: "【Burst】Add this card to your hand.",
};

// ST03-010 Full Frontal — 【When Paired】You may deploy 1 (Neo Zeon)/(Zeon) Unit
// card that is Lv.4 or lower from your hand.
export const FULL_FRONTAL_WHEN_PAIRED: EffectSpec = {
  id: "ST03-010-WhenPaired",
  cardCode: "ST03-010",
  trigger: "When Paired",
  actions: [
    { op: "deployFromHandTriggered", player: "controller", filter: { cardType: "UNIT", anyTrait: ["Neo Zeon", "Zeon"], maxLevel: 4 } },
  ],
  optional: true,
  sourceText: "【When Paired】You may deploy 1 (Neo Zeon)/(Zeon) Unit card that is Lv.4 or lower from your hand.",
};

// ST03-011 Char Aznable — 【Burst】Add this card to your hand.
export const CHAR_AZNABLE_BURST: EffectSpec = {
  id: "ST03-011-Burst",
  cardCode: "ST03-011",
  trigger: "Burst",
  actions: [{ op: "moveZone", target: { kind: "self" }, toZone: "hand" }],
  sourceText: "【Burst】Add this card to your hand.",
};

// ST03-011 Char Aznable — 【Attack】During this turn, this Unit gets AP+1 and, if
// it is a Link Unit, it gains <High-Maneuver>. (This Unit can't be blocked.)
// "this Unit" = a Unit pareada com o Pilot (TargetRef "pairedUnit"). O ganho de
// <High-Maneuver> condicional a ser Link Unit é resolvido por `condition` +
// `sourceIsLinkUnit` (predicates.ts).
export const CHAR_AZNABLE_ATTACK: EffectSpec = {
  id: "ST03-011-Attack",
  cardCode: "ST03-011",
  trigger: "Attack",
  condition: {
    predicate: "sourcePairedUnitIsLinkUnit",
    then: [{ op: "grantKeyword", target: { kind: "pairedUnit" }, keyword: "High-Maneuver", duration: "thisBattle" }],
  },
  actions: [{ op: "modifyStat", target: { kind: "pairedUnit" }, stat: "ap", amount: 1, duration: "endOfTurn" }],
  sourceText:
    "【Attack】During this turn, this Unit gets AP+1 and, if it is a Link Unit, it gains <High-Maneuver>. (This Unit can't be blocked.)",
};

// ST03-012 Indignation — 【Main】/【Action】Choose 1 friendly Unit. It gets AP+2
// during this turn. (o lado 【Pilot】[Angelo Sauper] é modo alternativo, pilotMode)
const INDIGNATION_ACTIONS: PrimitiveCall[] = [
  { op: "modifyStat", target: { kind: "named", name: "target" }, stat: "ap", amount: 2, duration: "endOfTurn" },
];
export const INDIGNATION_MAIN: EffectSpec = {
  id: "ST03-012-Main",
  cardCode: "ST03-012",
  trigger: "Main",
  actions: INDIGNATION_ACTIONS,
  targetScope: "friendlyUnit",
  sourceText: "【Main】/【Action】Choose 1 friendly Unit. It gets AP+2 during this turn.",
};
export const INDIGNATION_ACTION: EffectSpec = {
  ...INDIGNATION_MAIN,
  id: "ST03-012-Action",
  trigger: "Action",
};

// ST03-013 Close Combat — 【Burst】Activate this card's 【Main】. / 【Main】/【Action】
// Choose 1 enemy Unit. Deal 2 damage to it.
const CLOSE_COMBAT_ACTIONS: PrimitiveCall[] = [{ op: "damageUnit", target: { kind: "named", name: "target" }, amount: 2 }];
export const CLOSE_COMBAT_BURST: EffectSpec = {
  id: "ST03-013-Burst",
  cardCode: "ST03-013",
  trigger: "Burst",
  actions: CLOSE_COMBAT_ACTIONS,
  sourceText: "【Burst】Activate this card's 【Main】.",
};
export const CLOSE_COMBAT_MAIN: EffectSpec = { ...CLOSE_COMBAT_BURST, id: "ST03-013-Main", trigger: "Main", sourceText: "【Main】/【Action】Choose 1 enemy Unit. Deal 2 damage to it." };
export const CLOSE_COMBAT_ACTION: EffectSpec = { ...CLOSE_COMBAT_BURST, id: "ST03-013-Action", trigger: "Action", sourceText: "【Main】/【Action】Choose 1 enemy Unit. Deal 2 damage to it." };

// ST03-014 The Blue Giant — 【Action】Choose 1 friendly Unit. It can't receive
// battle damage from enemy Units with 2 or less AP during this battle.
// (o lado 【Pilot】[Ramba Ral] é modo alternativo, `pilotMode` em st03Deck.ts)
export const THE_BLUE_GIANT_ACTION: EffectSpec = {
  id: "ST03-014-Action",
  cardCode: "ST03-014",
  trigger: "Action",
  actions: [{ op: "preventUnitBattleDamage", target: { kind: "named", name: "target" }, maxAttackerAp: 2 }],
  targetScope: "friendlyUnit",
  sourceText:
    "【Action】Choose 1 friendly Unit. It can't receive battle damage from enemy Units with 2 or less AP during this battle.",
};

// ST03-015 Rewloola — 【Burst】Deploy this card. / 【Deploy】Add 1 of your Shields to
// your hand. Then, choose 1 enemy Unit with 5 or less AP. Deal 1 damage to it.
export const REWLOOLA_BURST: EffectSpec = {
  id: "ST03-015-Burst",
  cardCode: "ST03-015",
  trigger: "Burst",
  actions: [{ op: "deployThisCard" }],
  sourceText: "【Burst】Deploy this card.",
};
// 2 specs pro mesmo 【Deploy】: "Add 1 Shield" é INCONDICIONAL (sempre roda), o
// "choose 1 enemy Unit... deal 1 damage" precisa de alvo (interativo / auto-mira
// em combate). Num spec único a camada de decisão descartava o efeito inteiro
// quando não havia alvo legal — e o shield não era adicionado (docs/47 Lane 1D).
export const REWLOOLA_DEPLOY_SHIELD: EffectSpec = {
  id: "ST03-015-Deploy-Shield",
  cardCode: "ST03-015",
  trigger: "Deploy",
  actions: [{ op: "addShieldToHand", player: "controller", count: 1 }],
  sourceText: "【Deploy】Add 1 of your Shields to your hand.",
};
export const REWLOOLA_DEPLOY_DAMAGE: EffectSpec = {
  id: "ST03-015-Deploy-Damage",
  cardCode: "ST03-015",
  trigger: "Deploy",
  actions: [{ op: "damageUnit", target: { kind: "named", name: "target" }, amount: 1 }],
  targetFilter: "ap<=5",
  sourceText: "Then, choose 1 enemy Unit with 5 or less AP. Deal 1 damage to it.",
};

// ST03-016 Falmel — 【Burst】Deploy this card. / 【Deploy】Add 1 of your Shields to
// your hand. Then, if it is your turn, deploy 1 rested [Char's Zaku Ⅱ]
// ((Zeon)･AP3･HP1) Unit token. ("if it is your turn" é sempre verdadeiro pro
// trigger Deploy — deployCard só roda pro jogador ativo, ver nota em st02.ts.)
export const FALMEL_BURST: EffectSpec = {
  id: "ST03-016-Burst",
  cardCode: "ST03-016",
  trigger: "Burst",
  actions: [{ op: "deployThisCard" }],
  sourceText: "【Burst】Deploy this card.",
};
export const FALMEL_DEPLOY: EffectSpec = {
  id: "ST03-016-Deploy",
  cardCode: "ST03-016",
  trigger: "Deploy",
  actions: [
    { op: "addShieldToHand", player: "controller", count: 1 },
    { op: "spawnToken", def: TOKEN_CHARS_ZAKU_II, player: "controller", zone: "battleArea", rested: true },
  ],
  sourceText:
    "【Deploy】Add 1 of your Shields to your hand. Then, if it is your turn, deploy 1 rested [Char's Zaku Ⅱ]((Zeon)･AP3･HP1) Unit token.",
};

export const ST03_EFFECT_SPECS: EffectSpec[] = [
  CHARS_ZAKU_II_DESTROYED,
  ZAKU_II_ATTACK,
  GOUF_DEPLOY,
  FULL_FRONTAL_BURST,
  FULL_FRONTAL_WHEN_PAIRED,
  CHAR_AZNABLE_BURST,
  CHAR_AZNABLE_ATTACK,
  INDIGNATION_MAIN,
  INDIGNATION_ACTION,
  THE_BLUE_GIANT_ACTION,
  CLOSE_COMBAT_BURST,
  CLOSE_COMBAT_MAIN,
  CLOSE_COMBAT_ACTION,
  REWLOOLA_BURST,
  REWLOOLA_DEPLOY_SHIELD,
  REWLOOLA_DEPLOY_DAMAGE,
  FALMEL_BURST,
  FALMEL_DEPLOY,
];
