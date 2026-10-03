import type { EffectSpec } from "../../engine/effectSpec";

/**
 * Wave W6 (GD05) — lote B: Units 061–079 e Pilotos, só com vocabulário que o motor já tem.
 * Os estáticos (061/065/075 e os Pilotos 082/087/095) são campos estruturados do CardDef (`// W6`).
 * Texto de Piloto que fala de "this Unit" age na Unit pareada (`pairedUnit`).
 */

const target = { kind: "named", name: "target" } as const;
const thisUnit = { kind: "pairedUnit" } as const;
const OTHER_G_TEAM_OR_PREVENTER = "controllerOtherUnitCountWithAnyTraitAtLeast:G Team,Preventer:1";

export const GD05_W6B_EFFECT_SPECS: EffectSpec[] = [
  // ——— Units ———
  {
    id: "GD05-071-Attack",
    cardCode: "GD05-071",
    trigger: "Attack",
    condition: {
      predicate: OTHER_G_TEAM_OR_PREVENTER,
      then: [{ op: "modifyStat", target, stat: "ap", amount: -2, duration: "endOfTurn" }],
    },
    actions: [],
    targetScope: "enemyUnit",
    sourceText: "【Attack】If you have another (G Team)/(Preventer) Unit in play, choose 1 enemy Unit. It gets AP-2 during this turn.",
  },
  {
    id: "GD05-072-WhenLinked",
    cardCode: "GD05-072",
    trigger: "When Linked",
    actions: [{ op: "rest", target }],
    targetScope: "enemyUnit",
    targetFilter: "hp<=4",
    sourceText: "【When Linked】Choose 1 enemy Unit with 4 or less HP. Rest it.",
  },
  {
    id: "GD05-073-Deploy",
    cardCode: "GD05-073",
    trigger: "Deploy",
    actions: [{ op: "preventActivationNextTurn", target }],
    targetScope: "enemyUnit",
    targetFilter: "rested",
    sourceText: "【Deploy】Choose 1 rested enemy Unit. It won't be set as active during the start phase of your opponent's next turn.",
  },
  {
    id: "GD05-074-Destroyed",
    cardCode: "GD05-074",
    trigger: "Destroyed",
    actions: [
      { op: "draw", player: "controller", n: 1 },
      { op: "discardNamed", player: "controller", name: "discard", n: 1 },
    ],
    sourceText: "【Destroyed】Draw 1. Then, discard 1.",
  },
  {
    id: "GD05-079-ActivateMain",
    cardCode: "GD05-079",
    trigger: "Activate·Main",
    oncePerTurn: true,
    condition: {
      predicate: OTHER_G_TEAM_OR_PREVENTER,
      then: [{ op: "modifyStat", target, stat: "ap", amount: -1, duration: "endOfTurn" }],
    },
    actions: [],
    targetScope: "enemyUnit",
    targetFilter: "level<=4",
    sourceText:
      "【Activate･Main】【Once per Turn】If you have another (G Team)/(Preventer) Unit in play, choose 1 enemy Unit that is Lv.4 or lower. It gets AP-1 during this turn.",
  },
  // ——— Pilots ———
  // "(Orb)/(Triple Ship Alliance)" = OU. Um spec por trait: `condition2` não serve aqui porque o
  // pré-filtro do despacho (`specActiveCalls`) só olha `condition` e descartaria o spec quando a 1ª é
  // falsa. Nenhuma carta do catálogo tem os 2 traits impressos (`selfHasTrait` lê o impresso), então
  // nunca compra 2.
  ...(["Orb", "Triple Ship Alliance"] as const).map(
    (trait, i): EffectSpec => ({
      id: i === 0 ? "GD05-081-WhenLinked" : "GD05-081-WhenLinked-TSA",
      cardCode: "GD05-081",
      trigger: "When Linked",
      condition: { predicate: `selfHasTrait:${trait}`, then: [{ op: "draw", player: "controller", n: 1 }] },
      actions: [],
      sourceText: "【When Linked】If this is an (Orb)/(Triple Ship Alliance) Unit, draw 1.",
    }),
  ),
  {
    id: "GD05-083-WhenPaired",
    cardCode: "GD05-083",
    trigger: "When Paired",
    actions: [{ op: "moveZone", target, toZone: "hand" }],
    targetScope: "enemyUnit",
    targetFilter: "hp<=1",
    sourceText: "【When Paired】Choose 1 enemy Unit with 1 HP. Return it to its owner's hand.",
  },
  {
    id: "GD05-085-DestroyedEnemy",
    cardCode: "GD05-085",
    trigger: "Reaction:destroyedEnemyInBattle",
    reaction: { event: "destroyedEnemyInBattle", subject: "self", turn: "yours" },
    actions: [{ op: "heal", target: thisUnit, amount: 2 }],
    sourceText: "During your turn, when this Unit destroys an enemy Unit with battle damage, this Unit recovers 2 HP.",
  },
  {
    id: "GD05-092-Attack",
    cardCode: "GD05-092",
    trigger: "Attack",
    duringLink: true,
    condition: {
      predicate: "attackingPlayer",
      then: [{ op: "modifyStat", target: thisUnit, stat: "ap", amount: 2, duration: "thisBattle" }],
    },
    actions: [],
    sourceText: "【During Link】【Attack】If you are attacking the enemy player, this Unit gets AP+2 during this battle.",
  },
  {
    id: "GD05-094-Destroyed",
    cardCode: "GD05-094",
    trigger: "Destroyed",
    actions: [{ op: "grantDamageModifier", target, amount: 2, kind: "battle", scope: "turn", enemyOnly: true }],
    targetScope: "friendlyUnit",
    targetFilter: "trait:Neo Zeon",
    sourceText: "【Destroyed】Choose 1 of your (Neo Zeon) Units. During this turn, when it receives enemy battle damage, reduce it by 2.",
  },
  {
    id: "GD05-096-Attack",
    cardCode: "GD05-096",
    trigger: "Attack",
    optional: true,
    actions: [
      { op: "damageUnit", target: thisUnit, amount: 1 },
      { op: "heal", target, amount: 1 },
    ],
    targetScope: "friendlyUnit",
    targetFilter: "trait:Tekkadan;notSelfUnit",
    sourceText: "【Attack】You may deal 1 damage to this Unit. If you do, choose 1 of your other (Tekkadan) Units. It recovers 1 HP.",
  },
  {
    id: "GD05-098-DestroyedShield",
    cardCode: "GD05-098",
    trigger: "Reaction:destroyedShieldInBattle",
    reaction: { event: "destroyedShieldInBattle", subject: "self" },
    actions: [{ op: "modifyStat", target, stat: "ap", amount: -2, duration: "endOfTurn" }],
    targetScope: "enemyUnit",
    sourceText: "When this Unit destroys an enemy shield area card with damage, choose 1 enemy Unit. It gets AP-2 during this turn.",
  },
  {
    id: "GD05-099-DestroyedEnemy",
    cardCode: "GD05-099",
    trigger: "Reaction:destroyedEnemyInBattle",
    reaction: { event: "destroyedEnemyInBattle", subject: "self", turn: "yours" },
    actions: [
      { op: "draw", player: "controller", n: 1 },
      { op: "discardNamed", player: "controller", name: "discard", n: 1 },
    ],
    sourceText: "During your turn, when this Unit destroys an enemy Unit with battle damage, draw 1. Then, discard 1.",
  },
  {
    id: "GD05-100-WhenPaired",
    cardCode: "GD05-100",
    trigger: "When Paired",
    actions: [{ op: "rest", target }],
    targetScope: "enemyUnit",
    targetFilter: "level<=5",
    sourceText: "【When Paired】Choose 1 enemy Unit that is Lv.5 or lower. Rest it.",
  },
  {
    id: "GD05-101-PaidForUnitEffect",
    cardCode: "GD05-101",
    trigger: "Reaction:paidForUnitEffect",
    reaction: { event: "paidForUnitEffect", subject: "friendly" },
    oncePerTurn: true,
    optional: true,
    condition: { predicate: "selfHasTrait:Militia", then: [{ op: "heal", target: thisUnit, amount: 2 }] },
    actions: [],
    sourceText: "【Once per Turn】When you pay ① or more for one of your Unit's effects, if this is a (Militia) Unit, it may recover 2 HP.",
  },
];
