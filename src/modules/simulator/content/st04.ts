import type { EffectSpec, PrimitiveCall } from "../engine/effectSpec";
import { TOKEN_AILE_STRIKE, TOKEN_LAUNCHER_STRIKE, TOKEN_SWORD_STRIKE } from "../fixtures/st04Deck";

/**
 * Wave ST04 "Aile of Justice" (docs/41) — EffectSpec real, autorada carta a
 * carta contra o `effect` oficial em inglês de `data/gcg-official-cards.json`
 * (nunca a tradução — docs/18). Mesmo padrão de `content/st01.ts` /
 * `content/st02.ts` / `content/st03.ts`.
 *
 * Cobertura das 16 cartas únicas:
 * - Vanilla / só-keyword-automática: ST04-003 Moebius Zero, ST04-004 Moebius,
 *   ST04-005 Strike Dagger, ST04-007 Aegis Gundam (MA Mode) <Breach 3>,
 *   ST04-008 Ginn (ver st04Deck.ts).
 * - Bespoke via EffectSpec: abaixo.
 *
 * CLÁUSULAS FECHADAS NESTA RODADA (antes deferidas — docs/43 §4):
 * - ST04-011 Athrun Zala 【When Linked】: `ATHRUN_ZALA_WHEN_LINKED` abaixo,
 *   primitiva `grantAttackTargetRelax` + `CardInstance.attackTargetRelaxUntilTurn`
 *   (concessão temporária, consumida por `declareAttack` em combat.ts).
 * - ST04-015 Archangel 【Activate･Main】: cláusula "It can't attack during this
 *   turn" — primitiva `preventAttackThisTurn` + `CardInstance.cannotAttackUntilTurn`,
 *   adicionada a `ARCHANGEL_ACTIVATE_MAIN.actions` depois do `setActive`.
 */

// ST04-001 Aile Strike Gundam — 【When Paired･Lv.4 or Higher Pilot】Choose 1 enemy
// Unit with 4 or less HP. Return it to its owner's hand.
export const AILE_STRIKE_WHEN_PAIRED: EffectSpec = {
  id: "ST04-001-WhenPaired",
  cardCode: "ST04-001",
  trigger: "When Paired",
  condition: {
    predicate: "pairedPilotLevelAtLeast:4",
    then: [{ op: "moveZone", target: { kind: "named", name: "target" }, toZone: "hand" }],
  },
  actions: [],
  targetFilter: "hp<=4",
  sourceText: "【When Paired･Lv.4 or Higher Pilot】Choose 1 enemy Unit with 4 or less HP. Return it to its owner's hand.",
};

// ST04-002 Strike Gundam — 【Deploy】Draw 1. Then, discard 1.
// O "discard 1" é escolha do jogador (`ctx.targets.discard`), mesma mecânica de
// alvo nomeado; `discard` compila pra DISCARD_TO_HAND_LIMIT com os instanceIds.
export const STRIKE_GUNDAM_DEPLOY: EffectSpec = {
  id: "ST04-002-Deploy",
  cardCode: "ST04-002",
  trigger: "Deploy",
  actions: [
    { op: "draw", player: "controller", n: 1 },
    { op: "discardNamed", player: "controller", name: "discard", n: 1 },
  ],
  sourceText: "【Deploy】Draw 1. Then, discard 1.",
};

// ST04-006 Aegis Gundam — 【Attack】If this Unit has 5 or more AP, choose 1 enemy
// Unit that is Lv.5 or higher. Deal 3 damage to it.
export const AEGIS_GUNDAM_ATTACK: EffectSpec = {
  id: "ST04-006-Attack",
  cardCode: "ST04-006",
  trigger: "Attack",
  condition: {
    predicate: "selfApAtLeast:5",
    then: [{ op: "damageUnit", target: { kind: "named", name: "target" }, amount: 3 }],
  },
  actions: [],
  targetFilter: "level>=5",
  sourceText: "【Attack】If this Unit has 5 or more AP, choose 1 enemy Unit that is Lv.5 or higher. Deal 3 damage to it.",
};

// ST04-009 Miguel's Ginn — 【During Pair】【Destroyed】If you have another Link Unit
// in play, draw 1. O prefixo 【During Pair】 (`duringPair: true`) faz o dispatcher
// (tanto `dispatchDestroyedTriggers` no Damage Step quanto
// `dispatchDestroyedFromEffect` fora de combate, docs/45) só disparar o
// 【Destroyed】 se a Unit estava PAREADA no instante da destruição
// (`DestroyedInBattle.wasPaired`, capturado ANTES do DESTROY_CARD).
export const MIGUELS_GINN_DESTROYED: EffectSpec = {
  id: "ST04-009-Destroyed",
  cardCode: "ST04-009",
  trigger: "Destroyed",
  duringPair: true,
  condition: {
    predicate: "controllerHasOtherLinkUnit",
    then: [{ op: "draw", player: "controller", n: 1 }],
  },
  actions: [],
  sourceText: "【During Pair】【Destroyed】If you have another Link Unit in play, draw 1.",
};

// ST04-010 Kira Yamato — 【Burst】Add this card to your hand.
export const KIRA_YAMATO_BURST: EffectSpec = {
  id: "ST04-010-Burst",
  cardCode: "ST04-010",
  trigger: "Burst",
  actions: [{ op: "moveZone", target: { kind: "self" }, toZone: "hand" }],
  sourceText: "【Burst】Add this card to your hand.",
};

// ST04-010 Kira Yamato — 【Attack】Choose 1 enemy Unit. It gets AP-2 during this battle.
export const KIRA_YAMATO_ATTACK: EffectSpec = {
  id: "ST04-010-Attack",
  cardCode: "ST04-010",
  trigger: "Attack",
  actions: [{ op: "modifyStat", target: { kind: "named", name: "target" }, stat: "ap", amount: -2, duration: "thisBattle" }],
  sourceText: "【Attack】Choose 1 enemy Unit. It gets AP-2 during this battle.",
};

// ST04-011 Athrun Zala — 【Burst】Add this card to your hand.
export const ATHRUN_ZALA_BURST: EffectSpec = {
  id: "ST04-011-Burst",
  cardCode: "ST04-011",
  trigger: "Burst",
  actions: [{ op: "moveZone", target: { kind: "self" }, toZone: "hand" }],
  sourceText: "【Burst】Add this card to your hand.",
};

// ST04-011 Athrun Zala — 【When Linked】During this turn, this Unit may choose an
// active enemy Unit that is Lv.5 or lower as its attack target. "this Unit" = a
// Unit pareada com o Pilot (TargetRef "pairedUnit"). A condição
// `sourcePairedUnitIsLinkUnit` é redundante com o próprio 【When Linked】, mas
// mantida como guarda (mesmo predicado de ST03-011 Char Aznable).
export const ATHRUN_ZALA_WHEN_LINKED: EffectSpec = {
  id: "ST04-011-WhenLinked",
  cardCode: "ST04-011",
  trigger: "When Linked",
  condition: {
    predicate: "sourcePairedUnitIsLinkUnit",
    then: [{ op: "grantAttackTargetRelax", target: { kind: "pairedUnit" }, maxLevel: 5 }],
  },
  actions: [],
  sourceText:
    "【When Linked】During this turn, this Unit may choose an active enemy Unit that is Lv.5 or lower as its attack target.",
};

// ST04-012 Striker Pack — 【Burst】If you have no (Earth Alliance) Unit tokens in
// play, deploy 1 [Aile Strike Gundam] token. / 【Main】If you have no (Earth
// Alliance) Unit tokens in play, deploy 1 [Sword Strike Gundam] or 1 [Launcher
// Strike Gundam] token. (escolha Sword/Launcher via `ctx.targets.strikerChoice`)
export const STRIKER_PACK_BURST: EffectSpec = {
  id: "ST04-012-Burst",
  cardCode: "ST04-012",
  trigger: "Burst",
  condition: {
    predicate: "noControllerUnitTokenWithTrait:Earth Alliance",
    then: [{ op: "spawnToken", def: TOKEN_AILE_STRIKE, player: "controller", zone: "battleArea" }],
  },
  actions: [],
  sourceText:
    "【Burst】If you have no (Earth Alliance) Unit tokens in play, deploy 1 [Aile Strike Gundam]((Earth Alliance)･AP3･HP3･<Blocker>) Unit token.",
};

// A cláusula "If you have no (Earth Alliance) Unit tokens in play" é uma GUARDA
// que precede a escolha Sword/Launcher — sem `condition` aninhada na DSL, são
// 2 specs de mesmo (cardCode, trigger): o dispatcher roda os dois, mas cada um
// só dispara se `noControllerUnitTokenWithTrait:Earth Alliance` E a escolha
// bater (Launcher explícito; Sword = default / qualquer coisa != launcher).
const STRIKER_PACK_MAIN_SOURCE =
  "【Main】If you have no (Earth Alliance) Unit tokens in play, deploy 1 [Sword Strike Gundam]((Earth Alliance)･AP4･HP2･<Blocker>) or 1 [Launcher Strike Gundam]((Earth Alliance)･AP2･HP4･<Blocker>) Unit token.";

export const STRIKER_PACK_MAIN_LAUNCHER: EffectSpec = {
  id: "ST04-012-Main-Launcher",
  cardCode: "ST04-012",
  trigger: "Main",
  condition: {
    predicate: "noControllerUnitTokenWithTrait:Earth Alliance && namedChoiceEquals:strikerChoice:launcher",
    then: [{ op: "spawnToken", def: TOKEN_LAUNCHER_STRIKE, player: "controller", zone: "battleArea" }],
  },
  actions: [],
  sourceText: STRIKER_PACK_MAIN_SOURCE,
};

export const STRIKER_PACK_MAIN_SWORD: EffectSpec = {
  id: "ST04-012-Main-Sword",
  cardCode: "ST04-012",
  trigger: "Main",
  condition: {
    predicate: "noControllerUnitTokenWithTrait:Earth Alliance && namedChoiceNotEquals:strikerChoice:launcher",
    then: [{ op: "spawnToken", def: TOKEN_SWORD_STRIKE, player: "controller", zone: "battleArea" }],
  },
  actions: [],
  sourceText: STRIKER_PACK_MAIN_SOURCE,
};

// ST04-013 Hawk of Endymion — 【Main】/【Action】Choose 1 enemy Unit with 3 or less
// HP. Return it to its owner's hand. (lado 【Pilot】[Mu La Flaga] = pilotMode)
const HAWK_ACTIONS: PrimitiveCall[] = [{ op: "moveZone", target: { kind: "named", name: "target" }, toZone: "hand" }];
export const HAWK_OF_ENDYMION_MAIN: EffectSpec = {
  id: "ST04-013-Main",
  cardCode: "ST04-013",
  trigger: "Main",
  actions: HAWK_ACTIONS,
  targetFilter: "hp<=3",
  sourceText: "【Main】/【Action】Choose 1 enemy Unit with 3 or less HP. Return it to its owner's hand.",
};
export const HAWK_OF_ENDYMION_ACTION: EffectSpec = { ...HAWK_OF_ENDYMION_MAIN, id: "ST04-013-Action", trigger: "Action" };

// ST04-014 The Magic Bullet of Dusk — 【Main】/【Action】Choose 1 friendly Unit that
// is Lv.2 or lower. It gains <First Strike> during this turn.
const MAGIC_BULLET_ACTIONS: PrimitiveCall[] = [
  { op: "grantKeyword", target: { kind: "named", name: "target" }, keyword: "First Strike", duration: "endOfTurn" },
];
export const MAGIC_BULLET_MAIN: EffectSpec = {
  id: "ST04-014-Main",
  cardCode: "ST04-014",
  trigger: "Main",
  actions: MAGIC_BULLET_ACTIONS,
  targetScope: "friendlyUnit",
  targetFilter: "level<=2",
  sourceText: "【Main】/【Action】Choose 1 friendly Unit that is Lv.2 or lower. It gains <First Strike> during this turn.",
};
export const MAGIC_BULLET_ACTION: EffectSpec = { ...MAGIC_BULLET_MAIN, id: "ST04-014-Action", trigger: "Action" };

// ST04-015 Archangel — 【Burst】Deploy this card. / 【Deploy】Add 1 of your Shields
// to your hand. / 【Activate･Main】【Once per Turn】②：Choose 1 friendly Unit with
// <Blocker>. Set it as active. It can't attack during this turn.
export const ARCHANGEL_BURST: EffectSpec = {
  id: "ST04-015-Burst",
  cardCode: "ST04-015",
  trigger: "Burst",
  actions: [{ op: "moveZone", target: { kind: "self" }, toZone: "baseSection" }],
  sourceText: "【Burst】Deploy this card.",
};
export const ARCHANGEL_DEPLOY: EffectSpec = {
  id: "ST04-015-Deploy",
  cardCode: "ST04-015",
  trigger: "Deploy",
  actions: [{ op: "addShieldToHand", player: "controller", count: 1 }],
  sourceText: "【Deploy】Add 1 of your Shields to your hand.",
};
export const ARCHANGEL_ACTIVATE_MAIN: EffectSpec = {
  id: "ST04-015-ActivateMain",
  cardCode: "ST04-015",
  trigger: "Activate·Main",
  cost: [{ op: "payResourceCost", player: "controller", n: 2 }],
  actions: [
    { op: "setActive", target: { kind: "named", name: "target" } },
    { op: "preventAttackThisTurn", target: { kind: "named", name: "target" } },
  ],
  targetScope: "friendlyUnit",
  targetFilter: "hasKeyword:Blocker",
  sourceText:
    "【Activate･Main】【Once per Turn】②：Choose 1 friendly Unit with <Blocker>. Set it as active. It can't attack during this turn.",
};

// ST04-016 Vesalius — 【Burst】Deploy this card. / 【Deploy】Add 1 of your Shields to
// your hand. / 【Activate･Main】Rest this Base：Choose 1 friendly Unit. It gets
// AP+1 during this turn.
export const VESALIUS_BURST: EffectSpec = {
  id: "ST04-016-Burst",
  cardCode: "ST04-016",
  trigger: "Burst",
  actions: [{ op: "moveZone", target: { kind: "self" }, toZone: "baseSection" }],
  sourceText: "【Burst】Deploy this card.",
};
export const VESALIUS_DEPLOY: EffectSpec = {
  id: "ST04-016-Deploy",
  cardCode: "ST04-016",
  trigger: "Deploy",
  actions: [{ op: "addShieldToHand", player: "controller", count: 1 }],
  sourceText: "【Deploy】Add 1 of your Shields to your hand.",
};
export const VESALIUS_ACTIVATE_MAIN: EffectSpec = {
  id: "ST04-016-ActivateMain",
  cardCode: "ST04-016",
  trigger: "Activate·Main",
  cost: [{ op: "rest", target: { kind: "self" } }],
  actions: [{ op: "modifyStat", target: { kind: "named", name: "target" }, stat: "ap", amount: 1, duration: "endOfTurn" }],
  targetScope: "friendlyUnit",
  sourceText: "【Activate･Main】Rest this Base：Choose 1 friendly Unit. It gets AP+1 during this turn.",
};

export const ST04_EFFECT_SPECS: EffectSpec[] = [
  AILE_STRIKE_WHEN_PAIRED,
  STRIKE_GUNDAM_DEPLOY,
  AEGIS_GUNDAM_ATTACK,
  MIGUELS_GINN_DESTROYED,
  KIRA_YAMATO_BURST,
  KIRA_YAMATO_ATTACK,
  ATHRUN_ZALA_BURST,
  ATHRUN_ZALA_WHEN_LINKED,
  STRIKER_PACK_BURST,
  STRIKER_PACK_MAIN_LAUNCHER,
  STRIKER_PACK_MAIN_SWORD,
  HAWK_OF_ENDYMION_MAIN,
  HAWK_OF_ENDYMION_ACTION,
  MAGIC_BULLET_MAIN,
  MAGIC_BULLET_ACTION,
  ARCHANGEL_BURST,
  ARCHANGEL_DEPLOY,
  ARCHANGEL_ACTIVATE_MAIN,
  VESALIUS_BURST,
  VESALIUS_DEPLOY,
  VESALIUS_ACTIVATE_MAIN,
];
