import type { EffectSpec, PrimitiveCall } from "../../engine/effectSpec";
import { EX_RESOURCE_TOKEN } from "../../engine/setup";
import { mainAndAction } from "../standardSpecs";

/**
 * Wave W5 (GD04-C). W5a — camada de dano (C2, `engine/damageLayer.ts`): "reduce the next damage",
 * "during this battle, reduce battle damage", "can't receive effect damage" e redirecionar dano de batalha.
 * As reduções contínuas (GD04-029/053/068/088/098/123) são `CardDef.damageReductions`.
 * W5b — EX Resource e origem do pagamento (C6): reações `damagedByEnemy`, `commandActivated`,
 * `exResourcePlaced`, `paidForUnitEffect`; `selfPaidWithEx` / filtro `paidWithEx`; `deployExBase`.
 */

const target = { kind: "named", name: "target" } as const;
const thisUnit = { kind: "pairedUnit" } as const;
const self = { kind: "self" } as const;
const placeEx = (rested?: boolean): PrimitiveCall => ({ op: "spawnToken", def: EX_RESOURCE_TOKEN, player: "controller", zone: "resourceArea", rested });

export const GD04_W5_EFFECT_SPECS: EffectSpec[] = [
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
