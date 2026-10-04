import type { EffectSpec } from "../../engine/effectSpec";

/**
 * Wave W7a (C9) — escolha de modo, efeito concedido e escolhas encadeadas do GD05.
 * "choose 1 of the following effects": o spec da carta só tem o `chooseMode`; cada ■ é um spec com gatilho
 * `Mode:<n>` (o alvo do modo é pedido depois da escolha do modo, pelo mesmo caminho dos outros gatilhos).
 */

const target = { kind: "named", name: "target" } as const;
const targets = { kind: "namedGroup", name: "target" } as const;

const STRIKE_FREEDOM_DEPLOY =
  "【Deploy】Choose 1 to 2 of your Units. During this turn, when they destroy an enemy card with battle damage, draw 1.";

const MODE_HEADER = "When playing this card, choose 1 of the following effects and activate it:";

export const GD05_W7A_EFFECT_SPECS: EffectSpec[] = [
  // GD05-104 At the Risk of One's Life — "It gains the following effect during this turn: ■【During Link】【Destroyed】…":
  // o efeito concedido é um gatilho atrasado `destroyed` sobre a Unit escolhida (o 【During Link】 vale na destruição)
  {
    id: "GD05-104-Action",
    cardCode: "GD05-104",
    trigger: "Action",
    actions: [{ op: "grantDelayedReaction", specId: "GD05-104-Granted", subject: target }],
    targetScope: "friendlyUnit",
    targetFilter: "trait:Shrike Team",
    sourceText: "【Action】Choose 1 friendly (Shrike Team) Unit. It gains the following effect during this turn:",
  },
  {
    id: "GD05-104-Granted",
    cardCode: "GD05-104",
    trigger: "Delayed:destroyed",
    reaction: { event: "destroyed", subject: "friendly" },
    duringLink: true,
    actions: [{ op: "setActive", target }],
    targetScope: "friendlyUnit",
    targetFilter: "trait:League Militaire",
    sourceText: "■【During Link】【Destroyed】Choose 1 friendly (League Militaire) Unit. Set it as active.",
  },

  // GD05-002 Strike Freedom Gundam
  {
    id: "GD05-002-Deploy",
    cardCode: "GD05-002",
    trigger: "Deploy",
    actions: [
      { op: "grantDelayedReaction", specId: "GD05-002-DestroyedUnit", subject: targets },
      { op: "grantDelayedReaction", specId: "GD05-002-DestroyedShield", subject: targets },
    ],
    targetScope: "friendlyUnit",
    targetCount: { min: 1, max: 2 },
    sourceText: STRIKE_FREEDOM_DEPLOY,
  },
  // "destroy an enemy card with battle damage" = Unit inimiga ou carta da área de escudo
  {
    id: "GD05-002-DestroyedUnit",
    cardCode: "GD05-002",
    trigger: "Delayed:destroyedEnemyInBattle",
    reaction: { event: "destroyedEnemyInBattle", subject: "friendly" },
    actions: [{ op: "draw", player: "controller", n: 1 }],
    sourceText: STRIKE_FREEDOM_DEPLOY,
  },
  {
    id: "GD05-002-DestroyedShield",
    cardCode: "GD05-002",
    trigger: "Delayed:destroyedShieldInBattle",
    reaction: { event: "destroyedShieldInBattle", subject: "friendly" },
    actions: [{ op: "draw", player: "controller", n: 1 }],
    sourceText: STRIKE_FREEDOM_DEPLOY,
  },
  // "You may discard 2. If you do, choose 1 enemy Unit…": o descarte e o alvo são escolhas separadas (`Then:1`)
  {
    id: "GD05-002-Attack",
    cardCode: "GD05-002",
    trigger: "Attack",
    duringPair: true,
    optional: true,
    condition: {
      predicate: "controllerHandCountAtLeast:2",
      then: [
        { op: "discardNamed", player: "controller", name: "discard", n: 2 },
        { op: "thenTrigger", trigger: "Then:1" },
      ],
    },
    actions: [],
    sourceText: "【During Pair】【Attack】You may discard 2.",
  },
  {
    id: "GD05-002-Then",
    cardCode: "GD05-002",
    trigger: "Then:1",
    actions: [{ op: "moveZone", target, toZone: "deck" }],
    targetScope: "enemyUnit",
    targetFilter: "lowestLevel",
    sourceText: "If you do, choose 1 enemy Unit with the lowest Lv. Return it to the bottom of its owner's deck.",
  },

  // GD05-102 Wings of Light
  {
    id: "GD05-102-Action",
    cardCode: "GD05-102",
    trigger: "Action",
    actions: [
      {
        op: "chooseMode",
        key: "mode",
        options: [
          { value: "1", label: "Devolver à mão 1 Unit inimiga com 5 ou menos de HP" },
          { value: "2", label: "1 Unit recupera 3 de HP" },
        ],
      },
    ],
    sourceText: `【Action】${MODE_HEADER}`,
  },
  {
    id: "GD05-102-Mode1",
    cardCode: "GD05-102",
    trigger: "Mode:1",
    actions: [{ op: "moveZone", target, toZone: "hand" }],
    targetScope: "enemyUnit",
    targetFilter: "hp<=5",
    sourceText: "■Choose 1 enemy Unit with 5 or less HP. Return it to its owner's hand.",
  },
  {
    id: "GD05-102-Mode2",
    cardCode: "GD05-102",
    trigger: "Mode:2",
    actions: [{ op: "heal", target, amount: 3 }],
    targetScope: "anyUnit",
    sourceText: "■Choose 1 Unit. It recovers 3 HP.",
  },

  // GD05-106 Mutual Attraction
  {
    id: "GD05-106-Main",
    cardCode: "GD05-106",
    trigger: "Main",
    actions: [
      {
        op: "chooseMode",
        key: "mode",
        options: [
          { value: "1", label: "Colocar 1 Resource descansado" },
          { value: "2", label: "Pilot Lv.5+ do trash para a mão" },
        ],
      },
    ],
    sourceText: `【Main】${MODE_HEADER}`,
  },
  {
    id: "GD05-106-Mode1",
    cardCode: "GD05-106",
    trigger: "Mode:1",
    actions: [{ op: "placeResourceFromDeck", player: "controller", rested: true }],
    sourceText: "■Place 1 rested Resource.",
  },
  {
    id: "GD05-106-Mode2",
    cardCode: "GD05-106",
    trigger: "Mode:2",
    actions: [{ op: "searchTrashToHand", player: "controller", filter: { cardType: "PILOT", minLevel: 5 } }],
    sourceText: "■Choose 1 Pilot card that is Lv.5 or higher from your trash. Add it to your hand.",
  },
];
