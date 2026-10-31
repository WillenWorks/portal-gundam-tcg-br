import type { EffectSpec } from "../../engine/effectSpec";

/**
 * GD06 (Stardust Trails) — W13b: as 21 cartas que pediam motor novo (reações "é atacada"/"ativou <Blocker>"/"destruiu
 * carta inimiga com dano", camada de dano, custos de Piloto, rastreios de turno etc.). Rulings do FAQ do GD06 nos
 * comentários.
 */

const target = { kind: "named", name: "target" } as const;

const REACTIONS: EffectSpec[] = [
  {
    id: "GD06-001-Attacked",
    cardCode: "GD06-001",
    trigger: "Reaction:attacked",
    reaction: { event: "attacked", subject: "self" },
    oncePerTurn: true,
    actions: [{ op: "draw", player: "controller", n: 1 }],
    sourceText: "【Once per Turn】When this Unit is attacked, draw 1.",
  },
  // Q496/Q497: Unit, Base ou escudo; dano de batalha ou de efeito
  {
    id: "GD06-020-DestroyedEnemyCard",
    cardCode: "GD06-020",
    trigger: "Reaction:destroyedEnemyCardWithDamage",
    reaction: { event: "destroyedEnemyCardWithDamage", subject: "friendly", subjectFilter: "trait:Neo Zeon", turn: "yours" },
    actions: [{ op: "heal", target: { kind: "self" }, amount: 1 }],
    sourceText: "During your turn, when one of your (Neo Zeon) Units destroys an enemy card with damage, this Unit recovers 1 HP.",
  },
  {
    id: "GD06-097-BlockerActivated",
    cardCode: "GD06-097",
    trigger: "Reaction:blockerActivated",
    reaction: { event: "blockerActivated", subject: "self" },
    oncePerTurn: true,
    actions: [{ op: "setActive", target: { kind: "pairedUnit" } }],
    sourceText: "【Once per Turn】When this Unit activates<Blocker>, set it as active.",
  },
  // Q547: o dano do <Breach> é de efeito — não dispara (a Base só recebe "damagedByEnemy" de batalha)
  {
    id: "GD06-125-DamagedByEnemy",
    cardCode: "GD06-125",
    trigger: "Reaction:damagedByEnemy",
    reaction: { event: "damagedByEnemy", subject: "self" },
    oncePerTurn: true,
    condition: { predicate: "controllerRestedUnitWithTraitInPlay:AEUG", then: [{ op: "damageUnit", target, amount: 1 }] },
    actions: [],
    targetScope: "enemyUnit",
    sourceText: "【Once per Turn】When this Base receives battle damage while you have a rested (AEUG) Unit in play, choose 1 enemy Unit. Deal 1 damage to it.",
  },
];

const DAMAGE: EffectSpec[] = [
  // Q534: "reduce" diminui o dano recebido; "it" = esta Unit (o Lv. dela)
  {
    id: "GD06-093-Attack",
    cardCode: "GD06-093",
    trigger: "Attack",
    actions: [
      { op: "grantDamageModifier", target: { kind: "pairedUnit" }, amount: 2, kind: "battle", scope: "battle", enemyOnly: true, sourceUnitOnly: true, sourceLevelAtMostTarget: true },
    ],
    sourceText: "【Attack】During this battle, when this Unit receives battle damage from an enemy Unit whose Lv. is equal to or lower than it, reduce it by 2.",
  },
];

const TRACKED: EffectSpec[] = [
  // Q516–Q519: no fim do turno, 2 Resources quaisquer (ativo ou EX também)
  {
    id: "GD06-051-Deploy",
    cardCode: "GD06-051",
    trigger: "Deploy",
    condition: {
      predicate: "controllerOtherUnitCountWithAnyTraitAtLeast:Alphacide:1",
      then: [{ op: "grantDelayedReaction", specId: "GD06-051-EndOfTurn", subject: { kind: "self" } }],
    },
    actions: [],
    sourceText: "【Deploy】If another friendly (Alphacide) Unit is in play, this Unit gains the following effect during this turn:",
  },
  {
    id: "GD06-051-EndOfTurn",
    cardCode: "GD06-051",
    trigger: "Delayed:endOfTurn",
    reaction: { event: "endOfTurn", subject: "self" },
    actions: [{ op: "setActive", target: { kind: "namedGroup", name: "target" } }],
    targetScope: "ownResource",
    targetCount: { min: 2, max: 2 },
    sourceText: "■At the end of the turn, choose 2 of your Resources. Set them as active.",
  },
  {
    id: "GD06-070-Attack",
    cardCode: "GD06-070",
    trigger: "Attack",
    condition: {
      predicate: "controllerPaidForUnitEffectsThisTurnAtLeast:3",
      then: [{ op: "modifyStat", target, stat: "ap", amount: -5, duration: "thisBattle" }],
    },
    actions: [],
    targetScope: "enemyUnit",
    sourceText: "【Attack】If you have paid a total of ③ or more for your Units'effects this turn, choose 1 enemy Unit. It gets AP-5 during this battle.",
  },
  {
    id: "GD06-080-ActivateAction",
    cardCode: "GD06-080",
    trigger: "Activate·Action",
    oncePerTurn: true,
    condition: { predicate: "controllerDrewByEffectThisTurn", then: [{ op: "heal", target, amount: 2 }] },
    actions: [],
    targetScope: "friendlyUnit",
    sourceText: "【Activate･Action】【Once per Turn】If you have drawn with an effect during this turn, choose 1 of your Units. It recovers 2 HP.",
  },
  {
    id: "GD06-102-Action",
    cardCode: "GD06-102",
    trigger: "Action",
    condition: { predicate: "isOpponentTurn;noEnemyAttackedThisTurn", then: [{ op: "draw", player: "controller", n: 2 }] },
    actions: [],
    sourceText: "【Action】If it is your opponent's turn and no enemy Units have attacked this turn, draw 2.",
  },
];

const NEW_PRIMITIVES: EffectSpec[] = [
  // Q493: o dano recebido pela Unit/Base escolhida continua sendo dano de batalha; Q494: A↔B se anulam (cada um 1×)
  {
    id: "GD06-018-ActivateAction",
    cardCode: "GD06-018",
    trigger: "Activate·Action",
    duringPair: true,
    oncePerTurn: true,
    actions: [{ op: "redirectBattleDamage", from: { kind: "self" }, to: target, scope: "battle" }],
    targetScope: "friendlyUnitOrBase",
    targetFilter: "anyTrait:Neo Zeon,Long-Range Weapon;notSelf",
    sourceText:
      "【During Pair】【Activate･Action】【Once per Turn】Choose 1 of your (Neo Zeon)/(Long-Range Weapon) Units or 1 of your (Neo Zeon) Bases. During this battle, battle damage this Unit would receive is dealt to that Unit/Base instead.",
  },
  // Q498: token novo com o mesmo número de carta, sem o dano/efeitos do escolhido
  {
    id: "GD06-021-Deploy",
    cardCode: "GD06-021",
    trigger: "Deploy",
    actions: [{ op: "spawnTokenCopy", target, rested: true }],
    targetScope: "friendlyUnit",
    targetFilter: "isToken",
    sourceText: "【Deploy】Choose 1 of your Unit tokens. Deploy 1 rested Unit token of the same kind.",
  },
  // Q511/Q512: o deploy é sem custo e o 【Deploy】 da Unit ativa
  {
    id: "GD06-039-ActivateMain",
    cardCode: "GD06-039",
    trigger: "Activate·Main",
    cost: [
      { op: "destroy", target: { kind: "namedGroup", name: "costUnits" } },
      { op: "destroy", target: { kind: "self" } },
    ],
    actions: [{ op: "deployFromHandTriggered", player: "controller", filter: { cardType: "UNIT", anyTrait: ["Gundam Team"], minLevel: 8 } }],
    secondaryTarget: { name: "costUnits", targetScope: "friendlyUnit", targetFilter: "trait:Gundam Team;level>=3;level<=3;notSelf", count: 2, uniqueNames: true },
    sourceText:
      "【Activate･Main】Destroy 2 of your (Gundam Team) Units with unique card names that are Lv.3 and this Unit：Deploy 1 (Gundam Team) Unit card that is Lv.8 or higher from your hand.",
  },
  // Q513/Q514: o "look" é obrigatório; parear é escolha e sem custo
  {
    id: "GD06-042-Deploy",
    cardCode: "GD06-042",
    trigger: "Deploy",
    actions: [{ op: "lookAtTopFilterReveal", player: "controller", count: 4, filter: { cardType: "PILOT", anyTrait: ["Biological CPU"] }, revealTo: "pairWithSelf" }],
    sourceText:
      "【Deploy】Look at the top 4 cards of your deck. You may pair 1 (Biological CPU) Pilot card among them with this Unit. Return the remaining cards randomly to the bottom of your deck.",
  },
  {
    id: "GD06-084-WhenPaired",
    cardCode: "GD06-084",
    trigger: "When Paired",
    actions: [
      {
        op: "grantKeyword",
        target: { kind: "pairedUnit" },
        keyword: "Breach",
        duration: "endOfTurn",
        valueFrom: { kind: "friendlyUnitWithAnyTraitCount", traits: ["Neo Zeon", "Long-Range Weapon"] },
      },
    ],
    sourceText:
      "【When Paired】During this turn, this Unit gains the same number of<Breach 1> as the number of (Neo Zeon)/(Long-Range Weapon) Units you have in play.",
  },
];

const INFINITE_VARIATIONS = {
  actions: [
    {
      op: "modifyStat",
      target: { kind: "namedGroup", name: "target", limitFrom: { kind: "friendlyUnitCount", color: "white", keyword: "Blocker" } },
      stat: "ap",
      amount: -2,
      duration: "endOfTurn",
    },
  ],
  targetScope: "enemyUnit",
  targetCount: { min: 1, max: 6 },
  sourceText: "【Main】/【Action】Choose a number of enemy Units up to the number of white Units with<Blocker> you have in play. They get AP-2 during this turn.",
} satisfies Omit<EffectSpec, "id" | "cardCode" | "trigger">;

export const GD06_W13B_EFFECT_SPECS: EffectSpec[] = [
  ...REACTIONS,
  ...DAMAGE,
  ...TRACKED,
  ...NEW_PRIMITIVES,
  // "up to the number of …": escolhe até 6 e só as N primeiras recebem (N contado na hora, `limitFrom`)
  { ...INFINITE_VARIATIONS, id: "GD06-118-Main", cardCode: "GD06-118", trigger: "Main" },
  { ...INFINITE_VARIATIONS, id: "GD06-118-Action", cardCode: "GD06-118", trigger: "Action" },
];
