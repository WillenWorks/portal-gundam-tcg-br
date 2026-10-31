import type { EffectSpec, PrimitiveCall } from "../../engine/effectSpec";
import { TOKEN_AXIS_BASE, TOKEN_GOZZO, TOKEN_GUNDAM_AERIAL_REBUILD, TOKEN_GUNDAM_CALIBARN, TOKEN_NU_GUNDAM, TOKEN_SAZABI, TOKEN_TURN_X_ARMS, TOKEN_TURN_X_LEGS } from "./tokens";

/**
 * GD06 (Stardust Trails) — W13a: cartas que fecham com as primitivas do motor (mais extensões pequenas:
 * contagem da mão, condições de board/predicados/filtros novos, provocação por token, proteção de escudo por AP,
 * 【Action】 da carta pareada). Rulings do FAQ oficial do GD06 (Q489–Q548) nos comentários.
 * O que pede motor novo fica pra W13b (cartas seguem bloqueadas pelo `deckCoverageGate`).
 */

const target = { kind: "named", name: "target" } as const;
const self = { kind: "self" } as const;

const pilotBurst = (code: string): EffectSpec => ({
  id: `${code}-Burst`,
  cardCode: code,
  trigger: "Burst",
  actions: [{ op: "moveZone", target: self, toZone: "hand" }],
  sourceText: "【Burst】Add this card to your hand.",
});

const baseBurst = (code: string): EffectSpec => ({
  id: `${code}-Burst`,
  cardCode: code,
  trigger: "Burst",
  actions: [{ op: "deployThisCard" }],
  sourceText: "【Burst】Deploy this card.",
});

const baseDeployShield = (code: string): EffectSpec => ({
  id: `${code}-Deploy`,
  cardCode: code,
  trigger: "Deploy",
  actions: [{ op: "addShieldToHand", player: "controller", count: 1 }],
  sourceText: "【Deploy】Add 1 of your Shields to your hand.",
});

/** 【Main】/【Action】 — o mesmo efeito nos dois gatilhos */
const mainAndAction = (code: string, spec: Omit<EffectSpec, "id" | "cardCode" | "trigger">): EffectSpec[] => [
  { ...spec, id: `${code}-Main`, cardCode: code, trigger: "Main" },
  { ...spec, id: `${code}-Action`, cardCode: code, trigger: "Action" },
];

const turnXChoice = (rested: boolean): PrimitiveCall => ({
  op: "spawnTokenChoice",
  player: "controller",
  zone: "battleArea",
  key: "turnXChoice",
  rested,
  options: [
    { value: "arms", label: "Turn X (Arms) (AP2/HP3)", def: TOKEN_TURN_X_ARMS },
    { value: "legs", label: "Turn X (Legs) (AP3/HP2)", def: TOKEN_TURN_X_LEGS },
  ],
});

// ───────────────────────────── Units azuis ─────────────────────────────
const BLUE: EffectSpec[] = [
  // GD06-002 Infinite Justice — Q489: "enemy card" = Unit, Base ou escudo (mesmo par de reações do GD05-006)
  {
    id: "GD06-002-DestroyedEnemy",
    cardCode: "GD06-002",
    trigger: "Reaction:destroyedEnemyInBattle",
    reaction: { event: "destroyedEnemyInBattle", subject: "self", turn: "yours" },
    oncePerTurn: true,
    actions: [{ op: "heal", target, amount: 3 }],
    targetScope: "friendlyUnit",
    targetFilter: "trait:Orb",
    sourceText: "【Once per Turn】During your turn, when this Unit destroys an enemy card with battle damage, choose 1 of your (Orb) Units. It recovers 3 HP.",
  },
  {
    id: "GD06-002-DestroyedShield",
    cardCode: "GD06-002",
    trigger: "Reaction:destroyedShieldInBattle",
    reaction: { event: "destroyedShieldInBattle", subject: "self", turn: "yours" },
    oncePerTurn: true,
    actions: [{ op: "heal", target, amount: 3 }],
    targetScope: "friendlyUnit",
    targetFilter: "trait:Orb",
    sourceText: "【Once per Turn】During your turn, when this Unit destroys an enemy card with battle damage, choose 1 of your (Orb) Units. It recovers 3 HP.",
  },
  {
    id: "GD06-002-Deploy",
    cardCode: "GD06-002",
    trigger: "Deploy",
    optional: true,
    condition: {
      predicate: "controllerTrashCardTypeCountAtLeast:UNIT:3",
      then: [
        { op: "moveZone", target: { kind: "group", group: { kind: "firstNInTrash", count: 3, filter: { cardType: "UNIT" } } }, toZone: "exile" },
        { op: "moveZone", target, toZone: "hand" },
      ],
    },
    actions: [],
    targetScope: "enemyUnit",
    targetFilter: "active",
    sourceText: "【Deploy】You may choose 3 Unit cards from your trash. Exile them from the game. If you do, choose 1 active enemy Unit. Return it to its owner's hand.",
  },
  {
    id: "GD06-003-Attack",
    cardCode: "GD06-003",
    trigger: "Attack",
    condition: { predicate: "controllerOtherUnitCountWithAnyTraitAtLeast:Alphacide:1;controllerHandCountAtMost:5", then: [{ op: "draw", player: "controller", n: 1 }] },
    actions: [],
    sourceText: "【Attack】If another friendly (Alphacide) Unit is in play and you have 5 or less cards in your hand, draw 1.",
  },
  {
    id: "GD06-004-Destroyed",
    cardCode: "GD06-004",
    trigger: "Destroyed",
    duringLink: true,
    condition: {
      predicate: "isControllersTurn",
      then: [
        { op: "moveZone", target: { kind: "named", name: "formerPairedPilot" }, toZone: "hand" },
        { op: "discardNamed", player: "controller", name: "discard", n: 1 },
      ],
    },
    actions: [],
    sourceText: "【During Link】【Destroyed】If it is your turn, return this Unit's paired Pilot to its owner's hand. Then, discard 1.",
  },
  {
    id: "GD06-005-Attack",
    cardCode: "GD06-005",
    trigger: "Attack",
    optional: true,
    actions: [{ op: "moveZone", target, toZone: "hand" }],
    targetScope: "enemyUnit",
    targetFilter: "damaged;level<=5",
    sourceText: "【Attack】You may choose 1 damaged enemy Unit that is Lv.5 or lower. Return it to its owner's hand.",
  },
  {
    id: "GD06-006-Deploy",
    cardCode: "GD06-006",
    trigger: "Deploy",
    optional: true,
    condition: { predicate: "controllerOtherUnitCountWithAnyTraitAtLeast:Alphacide:1", then: [{ op: "moveZone", target, toZone: "hand" }] },
    actions: [],
    targetScope: "enemyUnit",
    targetFilter: "hp<=3",
    sourceText: "【Deploy】If another friendly (Alphacide) Unit is in play, you may choose 1 enemy Unit with 3 or less HP. Return it to its owner's hand.",
  },
  {
    id: "GD06-007-Deploy",
    cardCode: "GD06-007",
    trigger: "Deploy",
    actions: [{ op: "damageUnit", target, amount: 2 }],
    targetScope: "enemyUnit",
    targetFilter: "rested",
    sourceText: "【Deploy】Choose 1 rested enemy Unit. Deal 2 damage to it.",
  },
  {
    id: "GD06-008-Attack",
    cardCode: "GD06-008",
    trigger: "Attack",
    condition: { predicate: "controllerBaseWithTraitInPlay:Earth Federation", then: [{ op: "modifyStat", target: self, stat: "ap", amount: 2, duration: "endOfTurn" }] },
    actions: [],
    sourceText: "【Attack】If a friendly (Earth Federation) Base is in play, this Unit gets AP+2 during this turn.",
  },
  {
    id: "GD06-009-Deploy",
    cardCode: "GD06-009",
    trigger: "Deploy",
    optional: true,
    actions: [{ op: "moveZone", target, toZone: "hand" }],
    targetScope: "enemyUnit",
    targetFilter: "hp<=1",
    sourceText: "【Deploy】You may choose 1 enemy Unit with 1 HP. Return it to its owner's hand.",
  },
  {
    id: "GD06-010-WhenLinked",
    cardCode: "GD06-010",
    trigger: "When Linked",
    actions: [{ op: "draw", player: "controller", n: 1 }],
    sourceText: "【When Linked】Draw 1.",
  },
  {
    id: "GD06-011-WhenLinked",
    cardCode: "GD06-011",
    trigger: "When Linked",
    actions: [{ op: "grantKeyword", target: { kind: "group", group: { kind: "allFriendlyUnits" } }, keyword: "Repair 1", duration: "endOfTurn" }],
    sourceText: "【When Linked】All your Units gain<Repair 1> during this turn.",
  },
];

// ───────────────────────────── Units verdes ─────────────────────────────
const GREEN: EffectSpec[] = [
  {
    id: "GD06-019-Attack",
    cardCode: "GD06-019",
    trigger: "Attack",
    condition: {
      predicate: "noControllerUnitTokenWithTrait:Ghingnham Fleet",
      then: [
        { op: "spawnToken", def: TOKEN_TURN_X_ARMS, player: "controller", zone: "battleArea", rested: true },
        { op: "spawnToken", def: TOKEN_TURN_X_LEGS, player: "controller", zone: "battleArea", rested: true },
      ],
    },
    actions: [],
    sourceText:
      "【Attack】If you have no (Ghingnham Fleet) Unit tokens in play, deploy 1 rested [Turn X (Arms)]((Ghingnham Fleet) (Long-Range Weapon)･AP2･HP3) Unit token and 1 rested [Turn X (Legs)]((Ghingnham Fleet) (Long-Range Weapon)･AP3･HP2) Unit token.",
  },
  // Q499–Q501: batalha só de Damage Step; destruir nela conta como "destroys with battle damage"
  {
    id: "GD06-022-WhenLinked",
    cardCode: "GD06-022",
    trigger: "When Linked",
    actions: [{ op: "beginDamageOnlyBattle", target }],
    targetScope: "enemyUnit",
    targetFilter: "ap<=3",
    sourceText: "【When Linked】Choose 1 enemy Unit with 3 or less AP. Begin a battle between this Unit and it and only perform the damage step.",
  },
  // "Rest this Unit." acontece mesmo sem alvo pro "Then, choose …": 2 specs do mesmo gatilho (como ST03-015)
  {
    id: "GD06-023-Deploy",
    cardCode: "GD06-023",
    trigger: "Deploy",
    actions: [{ op: "rest", target: self }],
    sourceText: "【Deploy】Rest this Unit.",
  },
  {
    id: "GD06-023-Deploy-Boost",
    cardCode: "GD06-023",
    trigger: "Deploy",
    condition: {
      predicate: "chosenIsLinkUnit:target",
      then: [
        { op: "modifyStat", target, stat: "ap", amount: 1, duration: "endOfTurn" },
        { op: "setActive", target: self },
      ],
      else: [{ op: "modifyStat", target, stat: "ap", amount: 1, duration: "endOfTurn" }],
    },
    actions: [],
    targetScope: "friendlyUnit",
    targetFilter: "trait:Neo Zeon;level>=3",
    sourceText: "Then, choose 1 of your (Neo Zeon) Units that is Lv.3 or higher. It gets AP+1 during this turn. If you increase a Link Unit's AP with this effect, set this Unit as active.",
  },
  {
    id: "GD06-024-Destroyed",
    cardCode: "GD06-024",
    trigger: "Destroyed",
    actions: [{ op: "destroy", target }],
    targetScope: "enemyUnit",
    targetFilter: "hasKeyword:Blocker;ap<=3",
    sourceText: "【Destroyed】Choose 1 enemy Unit with<Blocker> and 3 or less AP. Destroy it.",
  },
  {
    id: "GD06-026-Attack",
    cardCode: "GD06-026",
    trigger: "Attack",
    condition: {
      predicate: "controllerOtherUnitCountWithAnyTraitAtLeast:Ghingnham Fleet,Long-Range Weapon:3",
      then: [
        { op: "modifyStat", target, stat: "ap", amount: 1, duration: "endOfTurn" },
        { op: "grantKeyword", target, keyword: "Repair 2", duration: "endOfTurn" },
      ],
    },
    actions: [],
    targetScope: "friendlyUnit",
    sourceText: "【Attack】If you have 3 or more other (Ghingnham Fleet)/(Long-Range Weapon) Units in play, choose 1 of your Units. It gets AP+1 and<Repair 2> during this turn.",
  },
  {
    id: "GD06-027-Deploy",
    cardCode: "GD06-027",
    trigger: "Deploy",
    actions: [{ op: "grantAttackTargetRelax", target, maxAp: 4 }],
    targetScope: "friendlyUnit",
    targetFilter: "trait:Neo Zeon",
    sourceText: "【Deploy】Choose 1 of your (Neo Zeon) Units. During this turn, it may choose an active enemy Unit with 4 or less AP as its attack target.",
  },
  // Q502: o "Look at the top 2" é obrigatório; revelar é escolha
  {
    id: "GD06-032-Destroyed",
    cardCode: "GD06-032",
    trigger: "Destroyed",
    actions: [{ op: "lookAtTopFilterReveal", player: "controller", count: 2, filter: { cardType: "UNIT", anyTrait: ["Ghingnham Fleet", "Dianna Counter"] } }],
    sourceText:
      "【Destroyed】Look at the top 2 cards of your deck. You may reveal 1 (Ghingnham Fleet)/(Dianna Counter) Unit card among them and add it to your hand. Return the remaining cards randomly to the bottom of your deck.",
  },
];

// ───────────────────────────── Units vermelhas ─────────────────────────────
const RED: EffectSpec[] = [
  {
    id: "GD06-033-Deploy",
    cardCode: "GD06-033",
    trigger: "Deploy",
    actions: [{ op: "damageUnit", target: { kind: "group", group: { kind: "allEnemyUnits" } }, amount: 2 }],
    sourceText: "【Deploy】Deal 2 damage to all enemy Units.",
  },
  // Q505–Q507: sem pagar custo, o 【Deploy】 da carta ativa, o "look" é obrigatório
  {
    id: "GD06-034-Deploy",
    cardCode: "GD06-034",
    trigger: "Deploy",
    condition: {
      predicate: "controllerTrashCardCountWithAnyTraitAtLeast:Gjallarhorn:4",
      then: [{ op: "deployFromTopFilterReveal", player: "controller", count: 4, filter: { cardType: "UNIT", anyTrait: ["Gjallarhorn", "Tekkadan"], maxLevel: 6 } }],
    },
    actions: [],
    sourceText:
      "【Deploy】If there are 4 or more (Gjallarhorn) cards in your trash, look at the top 4 cards of your deck. You may deploy 1 (Gjallarhorn)/(Tekkadan) Unit card that is Lv.6 or lower among them. Return the remaining cards randomly to the bottom of your deck.",
  },
  // Q508: vale mesmo se as duas Units morrem na batalha
  {
    id: "GD06-035-DestroyedEnemy",
    cardCode: "GD06-035",
    trigger: "Reaction:destroyedEnemyInBattle",
    reaction: { event: "destroyedEnemyInBattle", subject: "self", turn: "yours" },
    oncePerTurn: true,
    actions: [{ op: "damageUnit", target, amount: 2 }],
    targetScope: "enemyUnit",
    targetFilter: "ap<=3",
    sourceText: "【Once per Turn】During your turn, when this Unit destroys an enemy Unit with battle damage, choose 1 enemy Unit with 3 or less AP. Deal 2 damage to it.",
  },
  {
    id: "GD06-036-WhenLinked",
    cardCode: "GD06-036",
    trigger: "When Linked",
    actions: [{ op: "damageUnit", target, amount: 1 }],
    targetScope: "enemyUnit",
    sourceText: "【When Linked】Choose 1 enemy Unit. Deal 1 damage to it.",
  },
  // Q510: empate no maior Lv. — escolhe qualquer uma delas
  {
    id: "GD06-038-WhenPaired",
    cardCode: "GD06-038",
    trigger: "When Paired",
    actions: [{ op: "damageUnit", target, amount: 3 }],
    targetScope: "enemyUnit",
    targetFilter: "highestLevel",
    sourceText: "【When Paired】Choose 1 enemy Unit with the highest Lv. Deal 3 damage to it.",
  },
  {
    id: "GD06-041-Deploy",
    cardCode: "GD06-041",
    trigger: "Deploy",
    actions: [{ op: "damageUnit", target, amount: 1 }],
    targetScope: "enemyUnit",
    targetFilter: "ap<=5",
    sourceText: "【Deploy】Choose 1 enemy Unit with 5 or less AP. Deal 1 damage to it.",
  },
  {
    id: "GD06-045-Destroyed",
    cardCode: "GD06-045",
    trigger: "Destroyed",
    actions: [{ op: "damageUnit", target, amount: 1 }],
    targetScope: "enemyUnit",
    targetFilter: "level<=5",
    sourceText: "【Destroyed】Choose 1 enemy Unit that is Lv.5 or lower. Deal 1 damage to it.",
  },
  {
    id: "GD06-046-Attack",
    cardCode: "GD06-046",
    trigger: "Attack",
    actions: [{ op: "modifyStat", target, stat: "ap", amount: 2, duration: "endOfTurn" }],
    targetScope: "friendlyUnit",
    targetFilter: "trait:Gundam Team;notSelf",
    sourceText: "【Attack】Choose 1 of your other (Gundam Team) Units. It gets AP+2 during this turn.",
  },
  {
    id: "GD06-048-Deploy",
    cardCode: "GD06-048",
    trigger: "Deploy",
    actions: [{ op: "damageUnit", target, amount: 1 }],
    targetScope: "enemyUnit",
    targetFilter: "cond(controllerTrashCardCountWithAnyTraitAtLeast:Gjallarhorn:4||level<=2)",
    sourceText: "【Deploy】Choose 1 enemy Unit that is Lv.2 or lower. Deal 1 damage to it. If there are 4 or more (Gjallarhorn) cards in your trash, choose 1 enemy Unit instead.",
  },
];

// ───────────────────────────── Units roxas ─────────────────────────────
const PURPLE: EffectSpec[] = [
  {
    id: "GD06-049-WhenPaired",
    cardCode: "GD06-049",
    trigger: "When Paired",
    condition: { predicate: "controllerTrashUnitCountWithAnyTraitAtLeast:Zeon:10", then: [{ op: "destroy", target: { kind: "group", group: { kind: "enemyBase" } } }] },
    actions: [],
    sourceText: "【When Paired】If there are 10 or more (Zeon) Unit cards in your trash, destroy every enemy player's Base.",
  },
  // Q515: o "look" é obrigatório
  {
    id: "GD06-049-Destroyed",
    cardCode: "GD06-049",
    trigger: "Destroyed",
    actions: [{ op: "lookAtTopFilterReveal", player: "controller", count: 3, filter: { cardType: "UNIT", anyTrait: ["Delaz Fleet"] }, restTo: "trash" }],
    sourceText:
      "【Destroyed】Look at the top 3 cards of your deck. You may reveal 1 (Delaz Fleet) Unit card among them and add it to your hand. Place the remaining cards into your trash.",
  },
  {
    id: "GD06-050-Deploy",
    cardCode: "GD06-050",
    trigger: "Deploy",
    condition: {
      predicate: "selfDeployedFromTrash",
      then: [{ op: "destroy", target: { kind: "namedGroup", name: "target" } }],
      else: [{ op: "destroy", target }],
    },
    actions: [],
    targetScope: "enemyUnit",
    targetFilter: "level<=3",
    targetCount: { min: 1, max: 2 },
    sourceText: "【Deploy】Choose 1 enemy Unit that is Lv.3 or lower. Destroy it. If you deploy this Unit from your trash, choose 1 to 2 enemy Units that are Lv.3 or lower instead.",
  },
  // Q516/Q517: deploy sem pagar custo; o 【Deploy】 da Unit ativa
  {
    id: "GD06-051-ActivateMain",
    cardCode: "GD06-051",
    trigger: "Activate·Main",
    oncePerTurn: true,
    cost: [
      { op: "payResourceCost", player: "controller", n: 2 },
      { op: "rest", target: self },
    ],
    actions: [{ op: "deployFromTrashPayingCost", player: "controller", filter: { cardType: "UNIT", anyTrait: ["Alphacide"], maxLevel: 5 }, free: true }],
    sourceText: "【Activate･Main】【Once per Turn】②, rest this Unit：Choose 1 (Alphacide) Unit card that is Lv.5 or lower from your trash. Deploy it.",
  },
  {
    id: "GD06-052-Deploy",
    cardCode: "GD06-052",
    trigger: "Deploy",
    condition: { predicate: "topOfDeckHasAnyTrait:1:Zeon", then: [{ op: "rest", target }] },
    actions: [{ op: "millToTrash", player: "controller", count: 1 }],
    targetScope: "enemyUnit",
    targetFilter: "ap<=4",
    sourceText: "【Deploy】Place the top card of your deck into your trash. If you place a (Zeon) card with this effect, choose 1 enemy Unit with 4 or less AP. Rest it.",
  },
  // Q520/Q521: pode escolher Resource ativo ou EX Resource
  {
    id: "GD06-053-Destroyed",
    cardCode: "GD06-053",
    trigger: "Destroyed",
    actions: [{ op: "setActive", target }],
    targetScope: "ownResource",
    sourceText: "【Destroyed】Choose 1 of your Resources. Set it as active.",
  },
  // Q522: só ativa se der pra escolher as duas Units
  {
    id: "GD06-054-Deploy",
    cardCode: "GD06-054",
    trigger: "Deploy",
    optional: true,
    actions: [
      { op: "damageUnit", target, amount: 1 },
      { op: "damageUnit", target: { kind: "named", name: "enemyTarget" }, amount: 1 },
    ],
    targetScope: "friendlyUnit",
    secondaryTarget: { name: "enemyTarget", targetScope: "enemyUnit" },
    sourceText: "【Deploy】You may choose 1 of your Units and 1 enemy Unit. Deal 1 damage to them.",
  },
  {
    id: "GD06-055-Attack",
    cardCode: "GD06-055",
    trigger: "Attack",
    duringPair: true,
    optional: true,
    actions: [
      { op: "damageUnit", target: self, amount: 1 },
      { op: "grantKeyword", target: self, keyword: "Breach 2", duration: "thisBattle" },
    ],
    sourceText: "【During Pair】【Attack】You may deal 1 damage to this Unit. If you do, this Unit gains<Breach 2> during this battle.",
  },
  {
    id: "GD06-056-Attack",
    cardCode: "GD06-056",
    trigger: "Attack",
    optional: true,
    condition: {
      predicate: "controllerActiveResourceCountAtLeast:2",
      then: [
        { op: "payResourceCost", player: "controller", n: 2 },
        { op: "destroy", target },
      ],
    },
    actions: [],
    targetScope: "enemyUnit",
    targetFilter: "level<=2",
    sourceText: "【Attack】You may pay ②. If you do, choose 1 enemy Unit that is Lv.2 or lower. Destroy it.",
  },
];

// ───────────────────────────── Units brancas ─────────────────────────────
const WHITE: EffectSpec[] = [
  // Q525: perdeu <Blocker> depois, continua sem poder atacar
  {
    id: "GD06-065-ActivateMain",
    cardCode: "GD06-065",
    trigger: "Activate·Main",
    oncePerTurn: true,
    cost: [{ op: "payResourceCost", player: "controller", n: 4 }],
    actions: [
      { op: "setActive", target: { kind: "group", group: { kind: "allFriendlyUnits", anyTraits: ["Dianna Counter", "Militia"], hasKeyword: "Blocker" } } },
      { op: "preventAttackThisTurn", target: { kind: "group", group: { kind: "allFriendlyUnits", anyTraits: ["Dianna Counter", "Militia"], hasKeyword: "Blocker" } } },
    ],
    sourceText: "【Activate･Main】【Once per Turn】④：Set all your (Dianna Counter)/(Militia) Units with<Blocker> as active. They can't attack during this turn.",
  },
  // Q526/Q527: sem pagar custo; a carta continua pareada
  {
    id: "GD06-066-Attack",
    cardCode: "GD06-066",
    trigger: "Attack",
    duringLink: true,
    actions: [{ op: "activateMainOf", card: { kind: "selfPairedPilot" }, trigger: "Action" }],
    sourceText: "【During Link】【Attack】Activate 【Action】 on the card paired with this Unit.",
  },
  {
    id: "GD06-067-WhenPaired",
    cardCode: "GD06-067",
    trigger: "When Paired",
    condition: { predicate: "pairedPilotLevelAtLeast:4", then: [{ op: "preventActivationNextTurn", target }] },
    actions: [],
    targetScope: "enemyUnit",
    targetFilter: "rested;hp<=3",
    sourceText: "【When Paired･Lv.4 or Higher Pilot】Choose 1 rested enemy Unit with 3 or less HP. It won't be set as active during the start phase of your opponent's next turn.",
  },
  // Q529: o AP-2 vale mesmo se a Unit já estava descansada
  {
    id: "GD06-068-Deploy",
    cardCode: "GD06-068",
    trigger: "Deploy",
    actions: [{ op: "rest", target }],
    condition: {
      predicate: "controllerOtherUnitCountWithAnyTraitAtLeast:G Team,Preventer:1",
      then: [{ op: "modifyStat", target, stat: "ap", amount: -2, duration: "endOfTurn" }],
    },
    targetScope: "enemyUnit",
    targetFilter: "level<=3",
    sourceText: "【Deploy】Choose 1 enemy Unit that is Lv.3 or lower. Rest it. If you have another (G Team)/(Preventer) Unit in play, that enemy Unit gets AP-2 during this turn.",
  },
  {
    id: "GD06-069-ActivateAction",
    cardCode: "GD06-069",
    trigger: "Activate·Action",
    oncePerTurn: true,
    cost: [{ op: "payResourceCost", player: "controller", n: 1 }],
    actions: [{ op: "heal", target, amount: 1 }],
    targetScope: "friendlyUnit",
    targetFilter: "damaged;trait:Dianna Counter",
    sourceText: "【Activate･Action】【Once per Turn】①：Choose 1 of your damaged (Dianna Counter) Units. It recovers 1 HP.",
  },
  {
    id: "GD06-070-Deploy",
    cardCode: "GD06-070",
    trigger: "Deploy",
    actions: [{ op: "spawnToken", def: TOKEN_GOZZO, player: "controller", zone: "battleArea" }],
    sourceText: "【Deploy】Deploy 1 [Gozzo]((Dianna Counter)･AP0･HP3･<Blocker>) Unit token.",
  },
  // Q530: vale também pro 【Main】 ativado pela carta pareada (GD05-035)
  {
    id: "GD06-071-CommandActivated",
    cardCode: "GD06-071",
    trigger: "Reaction:commandActivated",
    reaction: { event: "commandActivated", subject: "friendly", subjectFilter: "trait:Special Move", turn: "yours" },
    oncePerTurn: true,
    // "If you do": sem Unit inimiga o efeito não ativa (alvo obrigatório), então não há AP+2 sozinho
    actions: [
      { op: "modifyStat", target, stat: "ap", amount: -2, duration: "endOfTurn" },
      { op: "modifyStat", target: self, stat: "ap", amount: 2, duration: "endOfTurn" },
    ],
    targetScope: "enemyUnit",
    sourceText:
      "【Once per Turn】During your turn, when you activate a (Special Move) Command's 【Main】/【Action】, choose 1 enemy Unit. It gets AP-2 during this turn. If you do, this Unit gets AP+2.",
  },
  {
    id: "GD06-072-Destroyed",
    cardCode: "GD06-072",
    trigger: "Destroyed",
    duringPair: true,
    optional: true,
    condition: {
      predicate: "controllerOtherUnitCountWithAnyTraitAtLeast:G Team,Preventer:1",
      then: [{ op: "searchTrashToHand", player: "controller", filter: { cardType: "COMMAND", maxLevel: 5 } }],
    },
    actions: [],
    sourceText: "【During Pair】【Destroyed】If you have another (G Team)/(Preventer) Unit in play, you may choose 1 Command card that is Lv.5 or lower from your trash. Add it to your hand.",
  },
  // Q531: Base ou escudo
  {
    id: "GD06-073-DestroyedShield",
    cardCode: "GD06-073",
    trigger: "Reaction:destroyedShieldInBattle",
    reaction: { event: "destroyedShieldInBattle", subject: "self" },
    duringPair: true,
    oncePerTurn: true,
    actions: [{ op: "rest", target }],
    targetScope: "enemyUnit",
    targetFilter: "level<=3",
    sourceText: "【During Pair】【Once per Turn】When this Unit destroys an enemy shield area card with battle damage, choose 1 enemy Unit that is Lv.3 or lower. Rest it.",
  },
  {
    id: "GD06-076-Deploy",
    cardCode: "GD06-076",
    trigger: "Deploy",
    actions: [{ op: "rest", target }],
    targetScope: "enemyUnit",
    targetFilter: "hp<=4",
    sourceText: "【Deploy】Choose 1 enemy Unit with 4 or less HP. Rest it.",
  },
  {
    id: "GD06-078-ActivateMain",
    cardCode: "GD06-078",
    trigger: "Activate·Main",
    cost: [
      { op: "payResourceCost", player: "controller", n: 3 },
      { op: "rest", target: self },
    ],
    condition: { predicate: "controllerOtherUnitCountWithAnyTraitAtLeast:Dianna Counter:1", then: [{ op: "rest", target }] },
    actions: [],
    targetScope: "enemyUnit",
    targetFilter: "level<=4",
    sourceText: "【Activate･Main】③, rest this Unit：If you have another (Dianna Counter) Unit in play, choose 1 enemy Unit that is Lv.4 or lower. Rest it.",
  },
];

// ───────────────────────────── Pilotos ─────────────────────────────
const PILOTS: EffectSpec[] = [
  ...["GD06-080", "GD06-081", "GD06-082", "GD06-083", "GD06-084", "GD06-085", "GD06-086", "GD06-087", "GD06-088", "GD06-089"].map(pilotBurst),
  ...["GD06-090", "GD06-091", "GD06-092", "GD06-093", "GD06-094", "GD06-095", "GD06-096", "GD06-097", "GD06-098", "GD06-099", "GD06-100"].map(pilotBurst),
  {
    id: "GD06-082-WhenPaired",
    cardCode: "GD06-082",
    trigger: "When Paired",
    actions: [{ op: "damageUnit", target, amount: 1 }],
    targetScope: "enemyUnit",
    targetFilter: "rested",
    sourceText: "【When Paired】Choose 1 rested enemy Unit. Deal 1 damage to it.",
  },
  {
    id: "GD06-087-Attack",
    cardCode: "GD06-087",
    trigger: "Attack",
    actions: [{ op: "grantAttackTargetRelax", target, maxLevel: 4 }],
    targetScope: "friendlyUnit",
    targetFilter: "trait:Ghingnham Fleet",
    sourceText: "【Attack】Choose 1 of your (Ghingnham Fleet) Units. During this turn, it may choose an active enemy Unit that is Lv.4 or lower as its attack target.",
  },
  {
    id: "GD06-088-Destroyed",
    cardCode: "GD06-088",
    trigger: "Destroyed",
    duringLink: true,
    actions: [{ op: "searchTrashToHand", player: "controller", filter: { cardType: "UNIT", anyTrait: ["Gundam Team"], maxLevel: 2 } }],
    sourceText: "【During Link】【Destroyed】Choose 1 (Gundam Team) Unit card that is Lv.2 or lower from your trash. Add it to your hand.",
  },
  // Q533: Base ou escudo
  {
    id: "GD06-089-DestroyedShield",
    cardCode: "GD06-089",
    trigger: "Reaction:destroyedShieldInBattle",
    reaction: { event: "destroyedShieldInBattle", subject: "self" },
    duringLink: true,
    actions: [{ op: "grantAttackTargetRelax", target, maxLevel: 5 }],
    targetScope: "friendlyUnit",
    targetFilter: "trait:Gjallarhorn",
    sourceText:
      "【During Link】When this Unit destroys an enemy shield area card with battle damage, choose 1 of your (Gjallarhorn) Units. During this turn, it may choose an active enemy Unit that is Lv.5 or lower as its attack target.",
  },
  {
    id: "GD06-090-Attack",
    cardCode: "GD06-090",
    trigger: "Attack",
    condition: { predicate: "controllerUnitCountWithAnyTraitAtLeast:Gjallarhorn:2", then: [{ op: "damageUnit", target, amount: 1 }] },
    actions: [],
    targetScope: "enemyUnit",
    targetFilter: "ap<=5",
    sourceText: "【Attack】If you have 2 or more (Gjallarhorn) Units in play, choose 1 enemy Unit with 5 or less AP. Deal 1 damage to it.",
  },
  {
    id: "GD06-092-WhenPaired",
    cardCode: "GD06-092",
    trigger: "When Paired",
    condition: { predicate: "selfHasAnyTrait:Phantom Pain,Orb", then: [{ op: "damageUnit", target, amount: 1 }] },
    actions: [],
    targetScope: "enemyUnit",
    targetFilter: "ap<=selfUnit",
    sourceText: "【When Paired】If this is a (Phantom Pain)/(Orb) Unit, choose 1 enemy Unit whose AP is equal to or less than this Unit. Deal 1 damage to it.",
  },
  // Q535: com AP 0 a Unit não causa dano, então não destrói
  {
    id: "GD06-094-WhenPaired",
    cardCode: "GD06-094",
    trigger: "When Paired",
    actions: [{ op: "grantDelayedReaction", specId: "GD06-094-Granted", subject: target }],
    targetScope: "friendlyUnit",
    sourceText: "【When Paired】Choose 1 friendly Unit. It gains the following effect during this turn:",
  },
  {
    id: "GD06-094-Granted",
    cardCode: "GD06-094",
    trigger: "Delayed:battleDamageToEnemyUnit",
    reaction: { event: "battleDamageToEnemyUnit", subject: "friendly" },
    condition: { predicate: "battleVictimInPlay;battleVictimLevelAtMost:4", then: [{ op: "destroy", target: { kind: "named", name: "battleVictim" } }] },
    actions: [],
    sourceText: "■When this Unit deals battle damage to an enemy Unit that is Lv.4 or lower, destroy that enemy Unit.",
  },
  {
    id: "GD06-095-Attack",
    cardCode: "GD06-095",
    trigger: "Attack",
    optional: true,
    actions: [
      { op: "damageUnit", target: { kind: "pairedUnit" }, amount: 1 },
      { op: "modifyStat", target, stat: "ap", amount: 2, duration: "endOfTurn" },
    ],
    targetScope: "friendlyUnit",
    targetFilter: "trait:Zeon",
    sourceText: "【Attack】You may deal 1 damage to this Unit. If you do, choose 1 of your (Zeon) Units. It gets AP+2 during this turn.",
  },
  {
    id: "GD06-096-Attack",
    cardCode: "GD06-096",
    trigger: "Attack",
    duringLink: true,
    condition: {
      predicate: "topOfDeckHasAnyTrait:1:Zeon,Alphacide",
      then: [{ op: "modifyStat", target: { kind: "group", group: { kind: "allEnemyUnits" } }, stat: "ap", amount: -1, duration: "thisBattle" }],
    },
    actions: [{ op: "millToTrash", player: "controller", count: 1 }],
    sourceText:
      "【During Link】【Attack】Place the top card of your deck into your trash. If you place a (Zeon)/(Alphacide) card with this effect, all enemy Units get AP-1 during this battle.",
  },
  {
    id: "GD06-099-Attack",
    cardCode: "GD06-099",
    trigger: "Attack",
    actions: [{ op: "modifyStat", target, stat: "ap", amount: -3, duration: "thisBattle" }],
    targetScope: "enemyUnit",
    targetFilter: "level>=5",
    sourceText: "【Attack】Choose 1 enemy Unit that is Lv.5 or higher. It gets AP-3 during this battle.",
  },
];

// ───────────────────────────── Commands ─────────────────────────────
const COMMANDS: EffectSpec[] = [
  {
    id: "GD06-101-Burst",
    cardCode: "GD06-101",
    trigger: "Burst",
    actions: [{ op: "moveZone", target, toZone: "hand" }],
    targetScope: "enemyUnit",
    targetFilter: "hp<=5",
    sourceText: "【Burst】Choose 1 enemy Unit with 5 or less HP. Return it to its owner's hand.",
  },
  // Q538: precisa de alvo pra jogar
  // o texto do 【Burst】 é o começo do 【Main】/【Action】: o "Then, …" fica num spec à parte do mesmo gatilho (como ST03-015)
  ...mainAndAction("GD06-101", {
    actions: [{ op: "moveZone", target, toZone: "hand" }],
    targetScope: "enemyUnit",
    targetFilter: "hp<=5",
    sourceText: "【Main】/【Action】Choose 1 enemy Unit with 5 or less HP. Return it to its owner's hand.",
  }),
  ...mainAndAction("GD06-101", {
    condition: { predicate: "controllerLinkUnitWithTraitInPlay:Alphacide", then: [{ op: "draw", player: "controller", n: 1 }] },
    actions: [],
    sourceText: "Then, if a friendly (Alphacide) Link Unit is in play, draw 1.",
  }).map((spec) => ({ ...spec, id: `${spec.id}-Draw` })),
  pilotBurst("GD06-102"),
  {
    id: "GD06-103-Main",
    cardCode: "GD06-103",
    trigger: "Main",
    actions: [{ op: "damageUnit", target, amount: 1 }],
    targetScope: "enemyUnit",
    targetFilter: "rested",
    sourceText: "【Main】Choose 1 rested enemy Unit. Deal 1 damage to it.",
  },
  ...mainAndAction("GD06-104", {
    actions: [{ op: "moveZone", target, toZone: "hand" }],
    targetScope: "enemyUnit",
    targetFilter: "hp<=3",
    sourceText: "【Main】/【Action】Choose 1 enemy Unit with 3 or less HP. Return it to its owner's hand.",
  }),
  {
    id: "GD06-105-Main",
    cardCode: "GD06-105",
    trigger: "Main",
    actions: [
      {
        op: "spawnTokenChoice",
        player: "controller",
        zone: "battleArea",
        key: "graceChoice",
        options: [
          { value: "calibarn", label: "Gundam Calibarn (AP5/HP3, <High-Maneuver>)", def: TOKEN_GUNDAM_CALIBARN },
          { value: "aerial", label: "Gundam Aerial Rebuild (AP3/HP5, <Breach 3>)", def: TOKEN_GUNDAM_AERIAL_REBUILD },
        ],
      },
    ],
    sourceText:
      "【Main】Deploy 1 [Gundam Calibarn]((Academy)･AP5･HP3･<High-Maneuver>) Unit token or 1 [Gundam Aerial Rebuild]((Quiet Zero)･AP3･HP5･<Breach 3>) Unit token.",
  },
  {
    id: "GD06-106-Action",
    cardCode: "GD06-106",
    trigger: "Action",
    actions: [{ op: "preventShieldDamage", maxAttackerAp: 6 }],
    sourceText: "【Action】During this battle, your shield area cards can't receive damage from enemy Units with 6 or less AP.",
  },
  {
    id: "GD06-107-Main",
    cardCode: "GD06-107",
    trigger: "Main",
    condition: { predicate: "controllerUnitWithTraitInPlay:Ghingnham Fleet", then: [{ op: "destroy", target }] },
    actions: [],
    targetScope: "enemyUnit",
    targetFilter: "hasKeyword:Blocker;ap<=3",
    sourceText: "【Main】If you have a (Ghingnham Fleet) Unit in play, choose 1 enemy Unit with<Blocker> and 3 or less AP. Destroy it.",
  },
  {
    id: "GD06-108-Main",
    cardCode: "GD06-108",
    trigger: "Main",
    actions: [{ op: "modifyStat", target: { kind: "group", group: { kind: "allFriendlyUnits", maxLevel: 4, trait: "Neo Zeon" } }, stat: "ap", amount: 2, duration: "endOfTurn" }],
    sourceText: "【Main】All friendly (Neo Zeon) Units that are Lv.4 or lower get AP+2 during this turn.",
  },
  {
    id: "GD06-109-Main",
    cardCode: "GD06-109",
    trigger: "Main",
    actions: [turnXChoice(true)],
    sourceText:
      "【Main】Deploy 1 rested [Turn X (Arms)]((Ghingnham Fleet) (Long-Range Weapon)･AP2･HP3) Unit token or 1 rested [Turn X (Legs)]((Ghingnham Fleet) (Long-Range Weapon)･AP3･HP2) Unit token.",
  },
  pilotBurst("GD06-110"),
  {
    id: "GD06-110-Action",
    cardCode: "GD06-110",
    trigger: "Action",
    actions: [{ op: "modifyStat", target, stat: "ap", amount: 2, duration: "thisBattle" }],
    condition: { predicate: "controllerHandCountAtMost:3", then: [{ op: "draw", player: "controller", n: 1 }] },
    targetScope: "friendlyUnit",
    sourceText: "【Action】Choose 1 of your Units. It gets AP+2 during this battle. Then, if you have 3 or less cards in your hand, draw 1.",
  },
  {
    id: "GD06-111-Action",
    cardCode: "GD06-111",
    trigger: "Action",
    condition: { predicate: "controllerTrashCardCountWithAnyTraitAtLeast:Gjallarhorn:4", then: [{ op: "damageUnit", target, amount: 2 }] },
    actions: [],
    targetScope: "enemyUnit",
    sourceText: "【Action】If there are 4 or more (Gjallarhorn) cards in your trash, choose 1 enemy Unit. Deal 2 damage to it.",
  },
  {
    id: "GD06-112-Action",
    cardCode: "GD06-112",
    trigger: "Action",
    actions: [{ op: "damageUnit", target, amount: 2 }],
    targetScope: "enemyUnit",
    targetFilter: "battlingFriendlyHasTrait:AEUG",
    sourceText: "【Action】Choose 1 enemy Unit battling a friendly (AEUG) Unit. Deal 2 damage to it.",
  },
  {
    id: "GD06-113-Burst",
    cardCode: "GD06-113",
    trigger: "Burst",
    actions: [{ op: "damageUnit", target, amount: 2 }],
    targetScope: "enemyUnit",
    sourceText: "【Burst】Choose 1 enemy Unit. Deal 2 damage to it.",
  },
  ...mainAndAction("GD06-113", {
    actions: [{ op: "damageUnit", target, amount: 5 }],
    targetScope: "enemyUnit",
    targetFilter: "damaged",
    sourceText: "【Main】/【Action】Choose 1 damaged enemy Unit. Deal 5 damage to it.",
  }),
  // Q540/Q541: o modo escolhido precisa ter alvo
  {
    id: "GD06-114-Action",
    cardCode: "GD06-114",
    trigger: "Action",
    actions: [
      {
        op: "chooseMode",
        key: "mode",
        options: [
          { value: "1", label: "1 Unit (Alphacide) amiga reduz em 3 o dano de batalha inimigo nesta batalha" },
          { value: "2", label: "Destruir 1 Unit inimiga Lv.2 ou menor" },
        ],
      },
    ],
    sourceText: "【Action】When playing this card, choose 1 of the following effects and activate it:",
  },
  {
    id: "GD06-114-Mode1",
    cardCode: "GD06-114",
    trigger: "Mode:1",
    actions: [{ op: "grantDamageModifier", target, amount: 3, kind: "battle", scope: "battle", enemyOnly: true }],
    targetScope: "friendlyUnit",
    targetFilter: "trait:Alphacide",
    sourceText: "■Choose 1 friendly (Alphacide) Unit. During this battle, when it receives enemy battle damage, reduce it by 3.",
  },
  {
    id: "GD06-114-Mode2",
    cardCode: "GD06-114",
    trigger: "Mode:2",
    actions: [{ op: "destroy", target }],
    targetScope: "enemyUnit",
    targetFilter: "level<=2",
    sourceText: "■Choose 1 enemy Unit that is Lv.2 or lower. Destroy it.",
  },
  // Q542: o dono da Unit destruída sempre recebe o token Nu Gundam
  {
    id: "GD06-115-Main",
    cardCode: "GD06-115",
    trigger: "Main",
    actions: [
      { op: "destroy", target },
      { op: "spawnToken", def: TOKEN_SAZABI, player: "controller", zone: "battleArea" },
      { op: "spawnToken", def: TOKEN_NU_GUNDAM, player: "opponent", zone: "battleArea" },
    ],
    targetScope: "enemyUnit",
    targetFilter: "level<=4",
    sourceText:
      "【Main】Choose 1 enemy Unit that is Lv.4 or lower. Destroy it. Then, deploy 1 [Sazabi]((Neo Zeon)･AP4･HP4) Unit token. The destroyed Unit's owner deploys 1 [Nu Gundam]((Londo Bell)･AP3･HP3･<First Strike>) Unit token.",
  },
  pilotBurst("GD06-116"),
  // Q543/Q544: sem pagar custo; o 【Deploy】 da Unit ativa
  {
    id: "GD06-116-Main",
    cardCode: "GD06-116",
    trigger: "Main",
    actions: [{ op: "deployFromTrashPayingCost", player: "controller", filter: { cardType: "UNIT", color: "purple", anyTrait: ["Zeon"], maxLevel: 5 }, free: true }],
    sourceText: "【Main】Choose 1 purple (Zeon) Unit card that is Lv.5 or lower from your trash. Deploy it.",
  },
  // Q545: pode escolher a Unit que já está batalhando
  {
    id: "GD06-117-Action",
    cardCode: "GD06-117",
    trigger: "Action",
    actions: [{ op: "changeAttackTarget", target }],
    targetScope: "friendlyUnit",
    targetFilter: "rested;trait:Delaz Fleet",
    sourceText: "【Action】Choose 1 rested friendly (Delaz Fleet) Unit. Change a battling enemy Unit's attack target to it.",
  },
  {
    id: "GD06-119-Action",
    cardCode: "GD06-119",
    trigger: "Action",
    actions: [{ op: "rest", target }],
    targetScope: "enemyUnit",
    targetFilter: "hp<=3",
    sourceText: "【Action】Choose 1 enemy Unit with 3 or less HP. Rest it.",
  },
  // Q546: depois de usada como Command (já no trash), pode virar Piloto de uma Unit (MF) — mesmo padrão do `AfterMain` (GD05-112)
  {
    id: "GD06-119-AfterAction",
    cardCode: "GD06-119",
    trigger: "AfterAction",
    optional: true,
    actions: [{ op: "pairCardFromTrashAsPilot", card: self, unit: target }],
    targetScope: "friendlyUnit",
    targetFilter: "unpaired;trait:MF",
    sourceText: "After activating this card's 【Action】, you may pair this card from your trash with one of your (MF) Units.",
  },
  {
    id: "GD06-120-Burst",
    cardCode: "GD06-120",
    trigger: "Burst",
    actions: [{ op: "rest", target }],
    targetScope: "enemyUnit",
    targetFilter: "hp<=5",
    sourceText: "【Burst】Choose 1 enemy Unit with 5 or less HP. Rest it.",
  },
  ...mainAndAction("GD06-120", {
    actions: [{ op: "rest", target }],
    targetScope: "enemyUnit",
    sourceText: "【Main】/【Action】Choose 1 enemy Unit. Rest it.",
  }),
  {
    id: "GD06-121-Action",
    cardCode: "GD06-121",
    trigger: "Action",
    condition: {
      predicate: "chosenHasKeyword:target:High-Maneuver",
      then: [{ op: "modifyStat", target, stat: "ap", amount: -6, duration: "thisBattle" }],
      else: [{ op: "modifyStat", target, stat: "ap", amount: -2, duration: "thisBattle" }],
    },
    actions: [],
    targetScope: "enemyUnit",
    sourceText: "【Action】Choose 1 enemy Unit. It gets AP-2 during this battle. If it has<High-Maneuver>, AP-6 instead.",
  },
];

// ───────────────────────────── Bases ─────────────────────────────
const BASES: EffectSpec[] = [
  ...["GD06-122", "GD06-123", "GD06-124", "GD06-125", "GD06-126", "GD06-127", "GD06-128", "GD06-129", "GD06-130"].map(baseBurst),
  ...["GD06-124", "GD06-125", "GD06-128", "GD06-129"].map(baseDeployShield),
  {
    id: "GD06-122-Deploy",
    cardCode: "GD06-122",
    trigger: "Deploy",
    actions: [
      { op: "addShieldToHand", player: "controller", count: 1 },
      { op: "moveZone", target, toZone: "hand" },
    ],
    targetScope: "enemyUnit",
    targetFilter: "level<=2",
    sourceText: "【Deploy】Add 1 of your Shields to your hand. Then, choose 1 enemy Unit that is Lv.2 or lower. Return it to its owner's hand.",
  },
  {
    id: "GD06-123-Deploy",
    cardCode: "GD06-123",
    trigger: "Deploy",
    actions: [{ op: "addShieldToHand", player: "controller", count: 1 }],
    condition: { predicate: "isControllersTurn;controllerUnitWithTraitPairedPilotLevelAtMost:Neo Zeon:3", then: [{ op: "destroy", target }] },
    targetScope: "enemyUnit",
    targetFilter: "hasKeyword:Blocker;ap<=3",
    sourceText:
      "【Deploy】Add 1 of your Shields to your hand. Then, if it is your turn and you have a (Neo Zeon) Unit paired with a Pilot that is Lv.3 or lower in play, choose 1 enemy Unit with<Blocker> and 3 or less AP. Destroy it.",
  },
  {
    id: "GD06-124-ActivateMain",
    cardCode: "GD06-124",
    trigger: "Activate·Main",
    cost: [{ op: "rest", target: self }],
    condition: {
      predicate: "controllerUnitCountWithAnyTraitAtLeast:Ghingnham Fleet,Long-Range Weapon:3",
      then: [{ op: "modifyStat", target: { kind: "group", group: { kind: "allFriendlyUnits", trait: "Ghingnham Fleet" } }, stat: "ap", amount: 1, duration: "endOfTurn" }],
    },
    actions: [],
    sourceText: "【Activate･Main】Rest this Base：If you have 3 or more (Ghingnham Fleet)/(Long-Range Weapon) Units in play, all your (Ghingnham Fleet) Units get AP+1 during this turn.",
  },
  {
    id: "GD06-126-Deploy",
    cardCode: "GD06-126",
    trigger: "Deploy",
    actions: [{ op: "addShieldToHand", player: "controller", count: 1 }],
    condition: { predicate: "controllerUnitWithTraitInPlay:Gjallarhorn", then: [{ op: "damageUnit", target, amount: 1 }] },
    targetScope: "enemyUnit",
    targetFilter: "damaged",
    sourceText: "【Deploy】Add 1 of your Shields to your hand. Then, if a friendly (Gjallarhorn) Unit is in play, choose 1 damaged enemy Unit. Deal 1 damage to it.",
  },
  // o "If you place an (Alphacide) card" olha as 2 do topo ANTES do millToTrash (mesma convenção do GD03-092/094)
  {
    id: "GD06-127-Deploy",
    cardCode: "GD06-127",
    trigger: "Deploy",
    actions: [{ op: "addShieldToHand", player: "controller", count: 1 }],
    condition: { predicate: "isControllersTurn;topOfDeckHasAnyTrait:2:Alphacide", then: [{ op: "destroy", target }] },
    condition2: { predicate: "isControllersTurn", then: [{ op: "millToTrash", player: "controller", count: 2 }] },
    targetScope: "enemyUnit",
    targetFilter: "ap<=2",
    sourceText:
      "【Deploy】Add 1 of your Shields to your hand. Then, if it is your turn, place the top 2 cards of your deck into your trash. If you place an (Alphacide) card with this effect, choose 1 enemy Unit with 2 or less AP. Destroy it.",
  },
  // Q548: "reduce" = diminui o dano recebido
  {
    id: "GD06-128-ActivateMain",
    cardCode: "GD06-128",
    trigger: "Activate·Main",
    cost: [{ op: "rest", target: self }],
    actions: [{ op: "grantDamageModifier", target, amount: 1, kind: "battle", scope: "turn", enemyOnly: true }],
    targetScope: "friendlyUnit",
    targetFilter: "trait:Zeon",
    sourceText: "【Activate･Main】Rest this Base：Choose 1 friendly (Zeon) Unit. During this turn, when it receives enemy battle damage, reduce it by 1.",
  },
  {
    id: "GD06-129-Destroyed",
    cardCode: "GD06-129",
    trigger: "Destroyed",
    condition: { predicate: "controllerShieldCountAtLeast:1", then: [{ op: "spawnToken", def: TOKEN_AXIS_BASE, player: "controller", zone: "baseSection" }] },
    actions: [],
    sourceText: "【Destroyed】If you have any Shields in play, deploy 1 [Axis]((Neo Zeon)･AP0･HP5) Base token.",
  },
  {
    id: "GD06-130-Deploy",
    cardCode: "GD06-130",
    trigger: "Deploy",
    actions: [
      { op: "addShieldToHand", player: "controller", count: 1 },
      {
        op: "modifyStat",
        target,
        stat: "ap",
        amount: -1,
        amountFrom: { kind: "friendlyUnitWithAnyTraitCount", traits: ["Dianna Counter", "Militia"] },
        duration: "endOfTurn",
      },
    ],
    targetScope: "enemyUnit",
    targetFilter: "unpaired",
    sourceText:
      "【Deploy】Add 1 of your Shields to your hand. Then, choose 1 enemy Unit with no paired Pilot. Reduce its AP by an amount equal to the number of friendly (Dianna Counter)/(Militia) Units during this turn.",
  },
];

export const GD06_W13A_EFFECT_SPECS: EffectSpec[] = [...BLUE, ...GREEN, ...RED, ...PURPLE, ...WHITE, ...PILOTS, ...COMMANDS, ...BASES];
