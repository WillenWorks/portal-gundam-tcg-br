import type { EffectSpec, PrimitiveCall } from "../../engine/effectSpec";
import { EX_RESOURCE_TOKEN } from "../../engine/setup";
import { mainAndAction } from "../standardSpecs";

/**
 * Wave W5 (GD04-C). W5a — camada de dano (C2, `engine/damageLayer.ts`): "reduce the next damage",
 * "during this battle, reduce battle damage", "can't receive effect damage" e redirecionar dano de batalha.
 * As reduções contínuas (GD04-029/053/068/088/098/123) são `CardDef.damageReductions`.
 * W5b — EX Resource e origem do pagamento (C6): reações `damagedByEnemy`, `commandActivated`,
 * `exResourcePlaced`, `paidForUnitEffect`; `selfPaidWithEx` / filtro `paidWithEx`; `deployExBase`.
 * W5c — custo "Rest 1 of your … Units" (2º alvo `costUnit`, o motor pergunta junto com o alvo) e gatilhos
 * atrasados "During this turn, when …" (`grantDelayedReaction` + spec `Delayed:<evento>`).
 * W5d — regras contínuas (C12: `deploysRestedRule`, `grantsTraitToFriendlyUnits`, alvo com keyword), reação
 * `unitDeployed`, parear Command do trash como Piloto, provocação temporária, Base que revida.
 */

const target = { kind: "named", name: "target" } as const;
const thisUnit = { kind: "pairedUnit" } as const;
const self = { kind: "self" } as const;
const placeEx = (rested?: boolean): PrimitiveCall => ({ op: "spawnToken", def: EX_RESOURCE_TOKEN, player: "controller", zone: "resourceArea", rested });

const costUnit = { kind: "named", name: "costUnit" } as const;
const restCostUnit: PrimitiveCall = { op: "rest", target: costUnit };

export const GD04_W5_EFFECT_SPECS: EffectSpec[] = [
  // ——— W5d ———
  {
    id: "GD04-021-CommandActivated",
    cardCode: "GD04-021",
    trigger: "Reaction:commandActivated",
    reaction: { event: "commandActivated", subject: "friendly", subjectFilter: "trait:Dawn of Fold;paidWithEx", turn: "yours" },
    optional: true,
    actions: [{ op: "pairCardFromTrashAsPilot", card: { kind: "named", name: "reactionSubject" }, unit: target }],
    targetScope: "friendlyUnit",
    targetFilter: "unpaired;nameContains:Gundam Lfrith",
    sourceText:
      "During your turn, when you play and activate a (Dawn of Fold) Command card using an EX Resource, you may pair that card from your trash with one of your Units with \"Gundam Lfrith\" in its card name.",
  },
  {
    id: "GD04-033-UnitDeployed",
    cardCode: "GD04-033",
    trigger: "Reaction:unitDeployed",
    reaction: { event: "unitDeployed", subject: "friendly", subjectFilter: "or(isSelf|trait:Neo Zeon)" },
    actions: [{ op: "damageUnit", target, amount: 3 }],
    targetScope: "enemyUnit",
    sourceText: "When this Unit or one of your (Neo Zeon) Units is deployed, choose 1 enemy Unit. Deal 3 damage to it.",
  },
  {
    id: "GD04-049-Attack",
    cardCode: "GD04-049",
    trigger: "Attack",
    duringPair: true,
    optional: true,
    condition: {
      predicate: "attackingPlayer;controllerTrashCardCountWithTraitAtLeast:Vulture:7",
      then: [
        { op: "moveZone", target: { kind: "group", group: { kind: "firstNInTrash", count: 7, filter: { anyTrait: ["Vulture"] } } }, toZone: "exile" },
        { op: "destroy", target },
      ],
    },
    actions: [],
    targetScope: "enemyUnitOrBase",
    targetFilter: "level<=8",
    sourceText:
      "【During Pair】【Attack】If you are attacking the enemy player, you may choose 7 (Vulture) cards from your trash. Exile them from the game. If you do, choose 1 enemy Unit/Base that is Lv.8 or lower. Destroy it.",
  },
  {
    id: "GD04-065-ActivateMain",
    cardCode: "GD04-065",
    trigger: "Activate·Main",
    duringLink: true,
    cost: [{ op: "moveZone", target: { kind: "group", group: { kind: "firstNInTrash", count: 3, filter: { color: "blue" } } }, toZone: "exile" }],
    actions: [
      { op: "setActive", target: self },
      { op: "grantKeyword", target: self, keyword: "CannotTargetPlayer", duration: "endOfTurn" },
    ],
    sourceText:
      "【During Link】【Activate·Main】Exile 3 blue cards from your trash:Set this Unit as active. It can't choose the enemy player as its attack target during this turn.",
  },
  {
    id: "GD04-066-CommandActivated",
    cardCode: "GD04-066",
    trigger: "Reaction:commandActivated",
    reaction: { event: "commandActivated", subject: "friendly" },
    actions: [{ op: "modifyStat", target, stat: "ap", amount: -2, duration: "endOfTurn" }],
    targetScope: "enemyUnit",
    sourceText: "When you activate a Command's 【Main】/【Action】 effect, choose 1 enemy Unit. It gets AP-2 during this turn.",
  },
  {
    id: "GD04-069-PaidForUnitEffect",
    cardCode: "GD04-069",
    trigger: "Reaction:paidForUnitEffect",
    reaction: { event: "paidForUnitEffect", subject: "friendlyOther", subjectFilter: "anyTrait:Militia,Dianna Counter" },
    duringLink: true,
    oncePerTurn: true,
    actions: [{ op: "grantDelayedReaction", specId: "GD04-069-EndOfTurn" }],
    sourceText:
      "【During Link】At the end of a turn where you have paid ① or more for one of your other (Militia)/(Dianna Counter) Units' effects, choose 1 of your (Militia) Units. Set it as active.",
  },
  {
    id: "GD04-069-EndOfTurn",
    cardCode: "GD04-069",
    trigger: "Delayed:endOfTurn",
    reaction: { event: "endOfTurn", subject: "friendly" },
    actions: [{ op: "setActive", target: { kind: "group", group: { kind: "firstRestedFriendlyUnitWithTrait", trait: "Militia" } } }],
    sourceText:
      "【During Link】At the end of a turn where you have paid ① or more for one of your other (Militia)/(Dianna Counter) Units' effects, choose 1 of your (Militia) Units. Set it as active.",
  },
  {
    id: "GD04-107-Action",
    cardCode: "GD04-107",
    trigger: "Action",
    actions: [{ op: "grantKeyword", target, keyword: "ForcedAttackTarget", duration: "endOfTurn" }],
    targetScope: "friendlyUnit",
    targetFilter: "rested",
    sourceText: "【Action】Choose 1 of your rested Units. During this turn, all enemy Units must choose that Unit as their attack target when attacking.",
  },
  {
    id: "GD04-126-DamagedByEnemy",
    cardCode: "GD04-126",
    trigger: "Reaction:damagedByEnemy",
    reaction: { event: "damagedByEnemy", subject: "self" },
    condition: {
      predicate: "battleVictimInPlay;battleVictimApAtMost:3",
      then: [{ op: "damageUnit", target: { kind: "named", name: "battleVictim" }, amount: 1 }],
    },
    actions: [],
    sourceText: "When this Base receives battle damage from an enemy Unit with 3 or less AP, deal 1 damage to that Unit.",
  },
  // ——— W5c: custo de descansar Unit ———
  {
    id: "GD04-006-ActivateMain",
    cardCode: "GD04-006",
    trigger: "Activate·Main",
    oncePerTurn: true,
    cost: [restCostUnit],
    actions: [{ op: "rest", target }],
    targetScope: "enemyUnit",
    targetFilter: "hp<=4",
    secondaryTarget: { name: "costUnit", targetScope: "friendlyUnit", targetFilter: "trait:League Militaire;active;notSelfUnit" },
    sourceText: "【Activate·Main】【Once per Turn】Rest 1 of your other (League Militaire) Units:Choose 1 enemy Unit with 4 or less HP. Rest it.",
  },
  {
    id: "GD04-122-ActivateMain",
    cardCode: "GD04-122",
    trigger: "Activate·Main",
    oncePerTurn: true,
    cost: [restCostUnit],
    actions: [{ op: "rest", target }],
    targetScope: "enemyUnit",
    targetFilter: "level<=3",
    secondaryTarget: { name: "costUnit", targetScope: "friendlyUnit", targetFilter: "trait:Earth Federation;active" },
    sourceText: "【Activate·Main】【Once per Turn】Rest 1 of your (Earth Federation) Units:Choose 1 enemy Unit that is Lv.3 or lower. Rest it.",
  },
  {
    id: "GD04-125-ActivateMain",
    cardCode: "GD04-125",
    trigger: "Activate·Main",
    oncePerTurn: true,
    cost: [{ op: "payResourceCost", player: "controller", n: 1 }, restCostUnit],
    actions: [{ op: "damageUnit", target, amount: 1 }],
    targetScope: "enemyUnit",
    targetFilter: "level<=5",
    secondaryTarget: { name: "costUnit", targetScope: "friendlyUnit", targetFilter: "trait:CB;active" },
    sourceText: "【Activate·Main】【Once per Turn】①, rest 1 friendly (CB) Unit:Choose 1 enemy Unit that is Lv.5 or lower. Deal 1 damage to it.",
  },
  {
    id: "GD04-036-Deploy",
    cardCode: "GD04-036",
    trigger: "Deploy",
    optional: true,
    actions: [
      { op: "rest", target: { kind: "namedGroup", name: "target" } },
      { op: "damageUnit", target: { kind: "group", group: { kind: "allEnemyUnits", maxLevel: 6 } }, amount: 1, amountFrom: { kind: "namedCount", name: "target" } },
    ],
    targetScope: "friendlyUnit",
    targetFilter: "trait:CB;active;notSelfUnit",
    targetCount: { min: 1, max: 2 },
    sourceText:
      "【Deploy】You may choose 1 to 2 of your other active (CB) Units. Rest them. If you do, deal damage equal to the number of Units rested with this effect to all enemy Units that are Lv.6 or lower.",
  },
  // ——— W5c: gatilhos atrasados ———
  {
    id: "GD04-002-Deploy",
    cardCode: "GD04-002",
    trigger: "Deploy",
    actions: [{ op: "grantDelayedReaction", specId: "GD04-002-Delayed" }],
    sourceText:
      "【Deploy】During this turn, when one of your (Earth Federation) Units destroys an enemy Unit with battle damage, choose 1 enemy Unit with 5 or less HP. Rest it.",
  },
  {
    id: "GD04-002-Delayed",
    cardCode: "GD04-002",
    trigger: "Delayed:destroyedEnemyInBattle",
    reaction: { event: "destroyedEnemyInBattle", subject: "friendly", subjectFilter: "trait:Earth Federation" },
    actions: [{ op: "rest", target }],
    targetScope: "enemyUnit",
    targetFilter: "hp<=5",
    sourceText:
      "【Deploy】During this turn, when one of your (Earth Federation) Units destroys an enemy Unit with battle damage, choose 1 enemy Unit with 5 or less HP. Rest it.",
  },
  {
    id: "GD04-035-Deploy",
    cardCode: "GD04-035",
    trigger: "Deploy",
    actions: [{ op: "grantDelayedReaction", specId: "GD04-035-Delayed", subject: target }],
    targetScope: "friendlyUnit",
    targetFilter: "trait:Mafty",
    sourceText:
      "【Deploy】Choose 1 of your (Mafty) Units. When it destroys an enemy Unit with battle damage during this turn, if you have 3 or less cards in your hand, draw 1.",
  },
  {
    id: "GD04-035-Delayed",
    cardCode: "GD04-035",
    trigger: "Delayed:destroyedEnemyInBattle",
    reaction: { event: "destroyedEnemyInBattle", subject: "friendly" },
    condition: { predicate: "controllerHandCountAtMost:3", then: [{ op: "draw", player: "controller", n: 1 }] },
    actions: [],
    sourceText:
      "【Deploy】Choose 1 of your (Mafty) Units. When it destroys an enemy Unit with battle damage during this turn, if you have 3 or less cards in your hand, draw 1.",
  },
  {
    id: "GD04-115-Main",
    cardCode: "GD04-115",
    trigger: "Main",
    actions: [{ op: "grantDelayedReaction", specId: "GD04-115-Delayed", subject: target }],
    targetScope: "friendlyUnit",
    sourceText:
      "【Main】Choose 1 of your Units. When it deals battle damage to an enemy Unit that is Lv.5 or lower during this turn, destroy that enemy Unit.",
  },
  {
    id: "GD04-115-Delayed",
    cardCode: "GD04-115",
    trigger: "Delayed:battleDamageToEnemyUnit",
    reaction: { event: "battleDamageToEnemyUnit", subject: "friendly" },
    condition: {
      predicate: "battleVictimInPlay;battleVictimLevelAtMost:5",
      then: [{ op: "destroy", target: { kind: "named", name: "battleVictim" } }],
    },
    actions: [],
    sourceText:
      "【Main】Choose 1 of your Units. When it deals battle damage to an enemy Unit that is Lv.5 or lower during this turn, destroy that enemy Unit.",
  },
  // ——— W5b: Units ———
  {
    id: "GD04-018-DamagedByEnemy",
    cardCode: "GD04-018",
    trigger: "Reaction:damagedByEnemy",
    reaction: { event: "damagedByEnemy", subject: "friendlyOther", subjectFilter: "trait:Academy", turn: "yours" },
    oncePerTurn: true,
    actions: [placeEx()],
    sourceText: "【Once per Turn】During your turn, when one of your other (Academy) Units receives damage from an enemy, place 1 EX Resource.",
  },
  {
    id: "GD04-020-CommandActivated",
    cardCode: "GD04-020",
    trigger: "Reaction:commandActivated",
    reaction: { event: "commandActivated", subject: "friendly", subjectFilter: "trait:Dawn of Fold;paidWithEx", turn: "yours" },
    oncePerTurn: true,
    actions: [{ op: "draw", player: "controller", n: 1 }],
    sourceText: "【Once per Turn】During your turn, when you play and activate a (Dawn of Fold) Command card using an EX Resource, draw 1.",
  },
  // ——— W5b: Pilots ———
  {
    id: "GD04-085-CommandActivated",
    cardCode: "GD04-085",
    trigger: "Reaction:commandActivated",
    reaction: { event: "commandActivated", subject: "friendly", subjectFilter: "trait:Academy;paidWithEx" },
    duringLink: true,
    oncePerTurn: true,
    condition: { predicate: "controllerExResourceCountAtMost:0", then: [placeEx(true)] },
    actions: [],
    sourceText:
      "【During Link】【Once per Turn】When you play and activate an (Academy) Command card using an EX Resource, if you have no remaining EX Resources, place 1 rested EX Resource.",
  },
  {
    id: "GD04-100-PaidForUnitEffect",
    cardCode: "GD04-100",
    trigger: "Reaction:paidForUnitEffect",
    reaction: { event: "paidForUnitEffect", subject: "friendly" },
    oncePerTurn: true,
    optional: true,
    actions: [{ op: "modifyStat", target: thisUnit, stat: "ap", amount: 1, amountFrom: { kind: "reactionAmount" }, duration: "endOfTurn" }],
    sourceText:
      "【Once per Turn】When you pay ① or more cost for one of your Units'effects, you may increase this Unit's AP during this turn by an amount equal to the cost paid.",
  },
  // ——— W5b: Commands ———
  {
    id: "GD04-106-Main",
    cardCode: "GD04-106",
    trigger: "Main",
    // sem EX só vale o 1º alvo — o cliente escolhe alvos antes de saber a origem do pagamento
    condition: {
      predicate: "selfPaidWithEx",
      then: [{ op: "grantAttackTargetRelax", target: { kind: "namedGroup", name: "target" }, maxAp: 5 }],
      else: [{ op: "grantAttackTargetRelax", target, maxAp: 5 }],
    },
    actions: [],
    targetScope: "friendlyUnit",
    targetFilter: "trait:Academy",
    targetCount: { min: 1, max: 2 },
    sourceText:
      "【Main】Choose 1 friendly (Academy) Unit. During this turn, it may choose an active enemy Unit with 5 or less AP as its attack target. If you use an EX Resource to play this card, choose 1 to 2 friendly (Academy) Units instead.",
  },
  ...mainAndAction({
    cardCode: "GD04-108",
    condition: {
      predicate: "selfPaidWithEx",
      then: [{ op: "grantDamageModifier", target, amount: 4, scope: "next" }],
      else: [{ op: "grantDamageModifier", target, amount: 2, scope: "next" }],
    },
    actions: [],
    targetScope: "friendlyUnit",
    targetFilter: "trait:Academy",
    sourceText:
      "【Main】/【Action】Choose 1 friendly (Academy) Unit. During this turn, reduce the next damage it receives by 2. If you use an EX Resource to play this card, reduce by 4 instead.",
  }),
  ...mainAndAction({
    cardCode: "GD04-110",
    actions: [{ op: "deployExBase", player: "controller" }],
    sourceText: "【Main】/【Action】Deploy 1 EX Base.",
  }),
  // ——— W5b: Bases ———
  {
    id: "GD04-124-ExPlaced",
    cardCode: "GD04-124",
    trigger: "Reaction:exResourcePlaced",
    reaction: { event: "exResourcePlaced", subject: "friendly" },
    actions: [{ op: "modifyStat", target, stat: "ap", amount: 2, duration: "endOfTurn" }],
    targetScope: "friendlyUnit",
    targetFilter: "trait:Academy",
    sourceText: "When you place an EX Resource, choose 1 friendly (Academy) Unit. It gets AP+2 during this turn.",
  },
  {
    id: "GD04-129-PaidForUnitEffect",
    cardCode: "GD04-129",
    trigger: "Reaction:paidForUnitEffect",
    reaction: { event: "paidForUnitEffect", subject: "friendly", turn: "yours" },
    oncePerTurn: true,
    actions: [{ op: "heal", target: self, amount: 2 }],
    sourceText: "【Once per Turn】During your turn, when you pay ① or more for a friendly Unit's effect, this Base recovers 2 HP.",
  },
  // ——— Pilots ———
  {
    id: "GD04-087-Attack",
    cardCode: "GD04-087",
    trigger: "Attack",
    duringLink: true,
    optional: true,
    actions: [{ op: "redirectBattleDamage", from: thisUnit, to: target, scope: "battle" }],
    targetScope: "friendlyUnit",
    targetFilter: "trait:Academy;notSelfUnit",
    sourceText: "【During Link】【Attack】You may choose 1 of your (Academy) Units. During this battle, battle damage this Unit would receive is dealt to that Unit instead.",
  },
  {
    id: "GD04-093-WhenLinked",
    cardCode: "GD04-093",
    trigger: "When Linked",
    actions: [{ op: "grantDamageModifier", target, amount: 2, scope: "next" }],
    targetScope: "friendlyUnit",
    targetFilter: "trait:ZAFT;linkUnit",
    sourceText: "【When Linked】Choose 1 of your (ZAFT) Link Units. During this turn, reduce the next damage it receives by 2.",
  },
  {
    id: "GD04-095-WhenLinked",
    cardCode: "GD04-095",
    trigger: "When Linked",
    actions: [{ op: "redirectBattleDamage", from: target, to: thisUnit, scope: "turn" }],
    targetScope: "friendlyUnit",
    targetFilter: "trait:Minerva Squad;notSelfUnit",
    sourceText: "【When Linked】Choose 1 of your (Minerva Squad) Units. During this turn, battle damage it would receive is dealt to this Unit instead.",
  },
  // ——— Commands ———
  {
    id: "GD04-113-Action",
    cardCode: "GD04-113",
    trigger: "Action",
    actions: [{ op: "grantDamageModifier", target, amount: 3, kind: "battle", scope: "battle" }],
    targetScope: "friendlyUnit",
    sourceText: "【Action】Choose 1 of your Units. During this battle, reduce battle damage it receives by 3.",
  },
  ...mainAndAction({
    cardCode: "GD04-119",
    actions: [{ op: "grantDamageModifier", target, immune: true, kind: "effect", scope: "turn", enemyOnly: true, sourceUnitOnly: true }],
    targetScope: "friendlyUnit",
    targetFilter: "pairedPilotTrait:Newtype",
    sourceText: "【Main】/【Action】Choose 1 friendly Unit paired with a (Newtype) Pilot. It can't receive effect damage from enemy Units during this turn.",
  }),
];
