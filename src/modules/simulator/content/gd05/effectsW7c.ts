import type { CardDefFilter, EffectSpec, PrimitiveCall } from "../../engine/effectSpec";

/**
 * Wave W7c — pacote MF / Special Move (G Gundam).
 * - "Activate 【Main】 on the card paired with this Unit" = `activateMainOf` na carta pareada (`selfPairedPilot`):
 *   o 【Main】 da Command-Piloto roda como continuação do 【Attack】 e conta como "ativou o 【Main】" (Q376/Q397).
 * - "After activating this card's 【Main】, you may pair this card from your trash with one of your (MF) Units":
 *   gatilho `AfterMain`, depois que a Command resolveu e foi pro trash.
 * - "When you activate a (Special Move) Command's 【Main】/【Action】" lê o registro do turno
 *   (`commandTraitsActivatedOnTurn`).
 */

const target = { kind: "named", name: "target" } as const;
const SPECIAL_MOVE: CardDefFilter = { cardType: "COMMAND", anyTrait: ["Special Move"] };

/** C3 — exilar do trash: as primeiras N que casam (aproximação A6 registrada em `deferred.ts`) */
const exile = (count: number, filter: CardDefFilter): PrimitiveCall => ({
  op: "moveZone",
  target: { kind: "group", group: { kind: "firstNInTrash", count, filter } },
  toZone: "exile",
});

const ACTIVATE_PAIRED_MAIN = "【During Link】【Attack】Activate 【Main】 on the card paired with this Unit.";
const activatePairedMain = (cardCode: string): EffectSpec => ({
  id: `${cardCode}-Attack`,
  cardCode,
  trigger: "Attack",
  duringLink: true,
  actions: [{ op: "activateMainOf", card: { kind: "selfPairedPilot" } }],
  sourceText: ACTIVATE_PAIRED_MAIN,
});

const PAIR_FROM_TRASH = "After activating this card's 【Main】, you may pair this card from your trash with one of your (MF) Units.";
const pairFromTrashAfterMain = (cardCode: string): EffectSpec => ({
  id: `${cardCode}-AfterMain`,
  cardCode,
  trigger: "AfterMain",
  optional: true,
  actions: [{ op: "pairCardFromTrashAsPilot", card: { kind: "self" }, unit: target }],
  targetScope: "friendlyUnit",
  targetFilter: "trait:MF;unpaired",
  sourceText: PAIR_FROM_TRASH,
});

export const GD05_W7C_EFFECT_SPECS: EffectSpec[] = [
  // GD05-033 Master Gundam
  {
    id: "GD05-033-Attack",
    cardCode: "GD05-033",
    trigger: "Attack",
    optional: true,
    condition: {
      predicate: "controllerTrashCardCountWithAnyTraitAtLeast:Special Move:2",
      then: [exile(2, SPECIAL_MOVE), { op: "damageFirstShieldAreaCard", player: "opponent", amount: 5 }],
    },
    actions: [],
    sourceText:
      "【Attack】You may choose 2 (Special Move) Command cards from your trash. Exile them from the game. If you do, deal 5 damage to the first card in your opponent's shield area.",
  },

  // GD05-035 Dragon Gundam — "destroys an enemy shield area card with damage": a de batalha (e a do <Breach> dela)
  {
    id: "GD05-035-Reaction",
    cardCode: "GD05-035",
    trigger: "Reaction:destroyedShieldInBattle",
    reaction: { event: "destroyedShieldInBattle", subject: "self" },
    oncePerTurn: true,
    actions: [{ op: "damageUnit", target, amount: 2 }],
    targetScope: "enemyUnit",
    targetFilter: "ap<=3",
    sourceText:
      "【Once per Turn】When this Unit destroys an enemy shield area card with damage, choose 1 enemy Unit with 3 or less AP. Deal 2 damage to it.",
  },
  activatePairedMain("GD05-035"),

  // GD05-036 Haow Gundam
  {
    id: "GD05-036-WhenPaired",
    cardCode: "GD05-036",
    trigger: "When Paired",
    optional: true,
    actions: [
      { op: "rest", target },
      { op: "thenTrigger", trigger: "Then:1" },
    ],
    targetScope: "friendlyUnit",
    targetFilter: "trait:MF;active;notSelf",
    sourceText: "【When Paired】You may choose 1 of your other active (MF) Units. Rest it.",
  },
  {
    id: "GD05-036-Then",
    cardCode: "GD05-036",
    trigger: "Then:1",
    actions: [{ op: "damageUnit", target: { kind: "group", group: { kind: "allEnemyUnits", maxLevelOf: "previousTarget" } }, amount: 2 }],
    sourceText: "If you do, deal 2 damage to all enemy Units whose Lv. is equal to or lower than that Unit.",
  },

  activatePairedMain("GD05-044"),

  // GD05-066 Shining Gundam
  {
    id: "GD05-066-Deploy",
    cardCode: "GD05-066",
    trigger: "Deploy",
    optional: true,
    condition: {
      predicate: "controllerTrashUnitCountWithAnyTraitAtLeast:MF:2",
      then: [exile(2, { cardType: "UNIT", anyTrait: ["MF"] }), { op: "thenTrigger", trigger: "Then:1" }],
    },
    actions: [],
    sourceText: "【Deploy】You may choose 2 (MF) Unit cards from your trash. Exile them from the game.",
  },
  {
    id: "GD05-066-Then",
    cardCode: "GD05-066",
    trigger: "Then:1",
    actions: [{ op: "searchTrashToHand", player: "controller", filter: SPECIAL_MOVE }],
    sourceText: "If you do, choose 1 (Special Move) Command card from your trash. Add it to your hand.",
  },
  {
    id: "GD05-066-Attack",
    cardCode: "GD05-066",
    trigger: "Attack",
    oncePerTurn: true,
    actions: [{ op: "setActive", target }],
    targetScope: "ownResource",
    targetFilter: "rested",
    sourceText: "【Attack】【Once per Turn】Choose 1 of your rested Resources. Set it as active.",
  },

  // GD05-068 Shining Gundam (Super Mode) — o <Suppression> condicional está na CardDef (`staticAbilities`)
  {
    id: "GD05-068-Attack",
    cardCode: "GD05-068",
    trigger: "Attack",
    duringLink: true,
    actions: [{ op: "modifyStat", stat: "ap", amount: 2, duration: "thisBattle", target: { kind: "self" } }],
    sourceText: "【During Link】【Attack】This Unit gets AP+2 during this battle.",
  },

  // GD05-069 Gundam Maxter
  {
    id: "GD05-069-Reaction",
    cardCode: "GD05-069",
    trigger: "Reaction:destroyedEnemyInBattle",
    reaction: { event: "destroyedEnemyInBattle", subject: "self", turn: "yours" },
    actions: [{ op: "lookAtTopFilterReveal", player: "controller", count: 4, filter: SPECIAL_MOVE }],
    sourceText:
      "During your turn, when this Unit destroys an enemy Unit with battle damage, look at the top 4 cards of your deck. You may reveal 1 (Special Move) Command card among them and add it to your hand. Return the remaining cards randomly to the bottom of your deck.",
  },
  activatePairedMain("GD05-069"),

  activatePairedMain("GD05-076"),

  // GD05-089 Master Asia (Pilot) — o "deploy it as an (AP3･HP3) Unit instead" do 【Burst】 está deferido
  {
    id: "GD05-089-Attack",
    cardCode: "GD05-089",
    trigger: "Attack",
    duringLink: true,
    condition: { predicate: "controllerActivatedCommandTraitThisTurn:Special Move", then: [{ op: "damageUnit", target, amount: 2 }] },
    actions: [],
    targetScope: "enemyUnit",
    sourceText:
      "【During Link】【Attack】If you have activated a (Special Move) Command card's 【Main】/【Action】 during this turn, choose 1 enemy Unit. Deal 2 damage to it.",
  },

  // GD05-097 Domon Kasshu (Pilot)
  {
    id: "GD05-097-WhenPaired",
    cardCode: "GD05-097",
    trigger: "When Paired",
    actions: [
      { op: "draw", player: "controller", n: 1 },
      { op: "discardNamed", player: "controller", name: "discard", n: 1 },
    ],
    condition: { predicate: "chosenHasTrait:discard:Special Move", then: [{ op: "thenTrigger", trigger: "Then:1" }] },
    sourceText: "【When Paired】Draw 1. Then, discard 1.",
  },
  {
    id: "GD05-097-Then",
    cardCode: "GD05-097",
    trigger: "Then:1",
    optional: true,
    actions: [{ op: "activateMainOf", card: { kind: "named", name: "previousTarget" } }],
    sourceText: "If you discard a (Special Move) Command card with this effect, you may activate its 【Main】.",
  },

  // GD05-112/113/121/122 — Special Move com 【Pilot】 que volta do trash pareada
  {
    id: "GD05-112-Main",
    cardCode: "GD05-112",
    trigger: "Main",
    actions: [{ op: "grantKeyword", target, keyword: "Breach 3", duration: "endOfTurn" }],
    targetScope: "friendlyUnit",
    targetFilter: "trait:MF;not(hasKeyword:Breach)",
    sourceText: "【Main】Choose 1 of your (MF) Units without <Breach>. It gains <Breach 3> during this turn.",
  },
  pairFromTrashAfterMain("GD05-112"),
  {
    id: "GD05-113-Main",
    cardCode: "GD05-113",
    trigger: "Main",
    actions: [{ op: "modifyStat", stat: "ap", amount: 2, duration: "endOfTurn", target }],
    targetScope: "friendlyUnit",
    targetFilter: "trait:MF;ap<=4",
    sourceText: "【Main】Choose 1 of your (MF) Units with 4 or less AP. It gets AP+2 during this turn.",
  },
  pairFromTrashAfterMain("GD05-113"),
  {
    id: "GD05-121-Main",
    cardCode: "GD05-121",
    trigger: "Main",
    actions: [{ op: "modifyStat", stat: "ap", amount: -2, duration: "endOfTurn", target }],
    targetScope: "enemyUnit",
    sourceText: "【Main】Choose 1 enemy Unit. It gets AP-2 during this turn.",
  },
  pairFromTrashAfterMain("GD05-121"),
  {
    id: "GD05-122-Main",
    cardCode: "GD05-122",
    trigger: "Main",
    actions: [{ op: "rest", target }],
    targetScope: "enemyUnit",
    targetFilter: "level<=4",
    sourceText: "【Main】Choose 1 enemy Unit that is Lv.4 or lower. Rest it.",
  },
  pairFromTrashAfterMain("GD05-122"),

  // GD05-128 Gundam Fight (Base)
  {
    id: "GD05-128-ActivateMain",
    cardCode: "GD05-128",
    trigger: "Activate·Main",
    cost: [{ op: "rest", target: { kind: "self" } }],
    condition: {
      predicate: "controllerLinkUnitWithTraitInPlay:MF",
      then: [{ op: "modifyStat", stat: "ap", amount: 2, duration: "endOfTurn", target }],
    },
    actions: [],
    targetScope: "friendlyUnit",
    sourceText: "【Activate･Main】Rest this Base：If a friendly (MF) Link Unit is in play, choose 1 friendly Unit. It gets AP+2 during this turn.",
  },
];
