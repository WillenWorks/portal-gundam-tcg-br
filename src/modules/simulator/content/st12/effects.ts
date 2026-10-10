import type { EffectSpec, TargetRef } from "../../engine/effectSpec";
import { stdAddToHandBurst, stdBaseDeployShield, stdDeployThisBurst } from "../standardSpecs";
import { exileFromTrash } from "../eb01/effectsW10a";

/** W12 — ST12 (com o Q&A oficial das cartas, Q436–Q453). */

const target: TargetRef = { kind: "named", name: "target" };
const self: TargetRef = { kind: "self" };
const MODE_HEADER = "When playing this card, choose 1 of the following effects and activate it:";

export const ST12_EFFECT_SPECS: EffectSpec[] = [
  // ST12-001 Gundam Epyon — "with damage" = batalha OU efeito (Q437); vale mesmo destruída na troca (Q436)
  {
    id: "ST12-001-DestroyedEnemy",
    cardCode: "ST12-001",
    trigger: "Reaction:destroyedEnemyWithDamage",
    reaction: { event: "destroyedEnemyWithDamage", subject: "self", turn: "yours", pairedPilotMinLevel: 5 },
    duringPair: true,
    actions: [{ op: "damageUnit", target: { kind: "group", group: { kind: "allEnemyUnits", maxAp: 5 } }, amount: 2 }],
    sourceText:
      "【During Pair･Lv.5 or Higher Pilot】During your turn, when this Unit destroys an enemy Unit with damage, deal 2 damage to all enemy Units with 5 or less AP.",
  },
  {
    id: "ST12-001-Deploy",
    cardCode: "ST12-001",
    trigger: "Deploy",
    actions: [{ op: "damageUnit", target: { kind: "group", group: { kind: "enemyBase" } }, amount: 5 }],
    sourceText: "【Deploy】Choose 1 enemy Base. Deal 5 damage to it.",
  },

  // ST12-002 Shining Gundam
  {
    id: "ST12-002-Deploy",
    cardCode: "ST12-002",
    trigger: "Deploy",
    actions: [{ op: "grantKeyword", target, keyword: "Breach 3", duration: "endOfTurn" }],
    targetScope: "friendlyUnit",
    targetFilter: "ap>=5",
    sourceText: "【Deploy】Choose 1 friendly Unit with 5 or more AP. It gains <Breach 3> during this turn.",
  },

  // ST12-003 Tallgeese Ⅲ — Q438/Q439
  {
    id: "ST12-003-DestroyedEnemy",
    cardCode: "ST12-003",
    trigger: "Reaction:destroyedEnemyWithDamage",
    reaction: { event: "destroyedEnemyWithDamage", subject: "self", turn: "yours" },
    oncePerTurn: true,
    actions: [{ op: "damageUnit", target: { kind: "group", group: { kind: "allEnemyUnits", maxAp: 3 } }, amount: 1 }],
    sourceText:
      "【Once per Turn】During your turn, when this Unit destroys an enemy Unit with damage, deal 1 damage to all enemy Units with 3 or less AP.",
  },

  // ST12-005 GQuuuuuuX (Omega Psycommu)
  {
    id: "ST12-005-Attack",
    cardCode: "ST12-005",
    trigger: "Attack",
    optional: true,
    condition: { predicate: "chosenNonEmpty:discard", then: [{ op: "draw", player: "controller", n: 1 }] },
    actions: [{ op: "discardNamed", player: "controller", name: "discard", n: 1 }],
    sourceText: "【Attack】You may discard 1. If you do, draw 1.",
  },

  // ST12-006 Unicorn Gundam 02 Banshee (Destroy Mode) — com a keyword já ganha, ativa mas não soma (Q440/Q441)
  {
    id: "ST12-006-ActivateMain",
    cardCode: "ST12-006",
    trigger: "Activate·Main",
    duringPair: true,
    cost: [exileFromTrash(4, {})],
    actions: [{ op: "grantKeyword", target: self, keyword: "First Strike", duration: "endOfTurn" }],
    sourceText: "【During Pair】【Activate･Main】Exile 4 cards in your trash from the game：This Unit gains <First Strike> during this turn.",
  },
  {
    id: "ST12-006-ActivateAction",
    cardCode: "ST12-006",
    trigger: "Activate·Action",
    cost: [exileFromTrash(4, {})],
    actions: [{ op: "grantKeyword", target: self, keyword: "Suppression", duration: "thisBattle" }],
    sourceText: "【Activate･Action】Exile 4 cards in your trash from the game：This Unit gains <Suppression> during this battle.",
  },

  // ST12-007 Gyan
  {
    id: "ST12-007-WhenLinked",
    cardCode: "ST12-007",
    trigger: "When Linked",
    actions: [{ op: "grantKeyword", target: self, keyword: "First Strike", duration: "endOfTurn" }],
    sourceText: "【When Linked】This Unit gains <First Strike> during this turn.",
  },

  // ST12-009 Unicorn Gundam 02 Banshee (Unicorn Mode) — "a player" inclui você (Q442), sem contar a Base (Q443)
  {
    id: "ST12-009-Destroyed",
    cardCode: "ST12-009",
    trigger: "Destroyed",
    condition: {
      predicate: "anyPlayerShieldsAtMost:3;controllerTrashUnitLevelAtLeast:6",
      then: [
        { op: "searchTrashToHand", player: "controller", filter: { cardType: "UNIT", minLevel: 6 } },
        { op: "thenTrigger", trigger: "Then:1" },
      ],
    },
    actions: [],
    sourceText: "【Destroyed】If there is a player with 3 or less Shields, choose 1 Unit card that is Lv.6 or higher from your trash. Add it to your hand.",
  },
  {
    id: "ST12-009-Then",
    cardCode: "ST12-009",
    trigger: "Then:1",
    actions: [{ op: "discardNamed", player: "controller", name: "discard", n: 1 }],
    sourceText: "If you do, discard 1.",
  },

  // ST12-011 Milliardo Peacecraft — "this Unit" = a Unit pareada
  stdAddToHandBurst("ST12-011"),
  {
    id: "ST12-011-ActivateAction",
    cardCode: "ST12-011",
    trigger: "Activate·Action",
    oncePerTurn: true,
    actions: [{ op: "damageUnit", target, amount: 2 }],
    targetScope: "enemyUnit",
    targetFilter: "damaged;battlingSelf",
    sourceText: "【Activate･Action】【Once per Turn】Choose 1 damaged enemy Unit battling this Unit. Deal 2 damage to it.",
  },

  // ST12-012 Ple-Twelve — com um jogador de 3 ou menos escudos, a do topo vai pra mão (Q444/Q445)
  stdAddToHandBurst("ST12-012"),
  {
    id: "ST12-012-WhenLinked",
    cardCode: "ST12-012",
    trigger: "When Linked",
    // a condição resolve antes das ações: a carta "do topo" já foi pra mão e o "return to the top" vira no-op
    condition: { predicate: "anyPlayerShieldsAtMost:3", then: [{ op: "moveZone", target: { kind: "named", name: "toTop" }, toZone: "hand" }] },
    actions: [
      { op: "moveWithinDeck", target: { kind: "named", name: "toTop" }, position: "top" },
      { op: "moveWithinDeck", target: { kind: "named", name: "toTrash" }, position: "trash" },
    ],
    sourceText:
      "【When Linked】Look at the top 2 cards of your deck and return 1 to the top. Place the remaining card into your trash. If there is a player with 3 or less Shields, add the card to your hand instead of returning it to your deck.",
  },

  // ST12-013 The Final Victor — cada jogador escolhe 1 Unit própria (o oponente decide a dele); o Damage Step segue a regra normal (Q446–Q448)
  {
    id: "ST12-013-Burst",
    cardCode: "ST12-013",
    trigger: "Burst",
    actions: [{ op: "damageUnit", target, amount: 1 }],
    targetScope: "enemyUnit",
    sourceText: "【Burst】Choose 1 enemy Unit. Deal 1 damage to it.",
  },
  {
    id: "ST12-013-Main",
    cardCode: "ST12-013",
    trigger: "Main",
    actions: [{ op: "thenTrigger", trigger: "Then:1", decidedBy: "opponent", carry: target }],
    targetScope: "friendlyUnit",
    sourceText: "【Main】Choose 1 enemy player. You and that player each choose 1 of your own Units.",
  },
  {
    id: "ST12-013-Then",
    cardCode: "ST12-013",
    trigger: "Then:1",
    actions: [{ op: "beginDamageOnlyBattle", target, attacker: { kind: "named", name: "previousTarget" } }],
    targetScope: "enemyUnit",
    sourceText: "Begin a battle between them and only perform the damage step.",
  },

  // ST12-014 Wise Leader's Pride — gatilho só nesta batalha; vale mesmo destruída na troca (Q449)
  {
    id: "ST12-014-Action",
    cardCode: "ST12-014",
    trigger: "Action",
    actions: [{ op: "grantDelayedReaction", specId: "ST12-014-Delayed", subject: target, battleOnly: true }],
    targetScope: "friendlyUnit",
    sourceText: "【Action】Choose 1 friendly Unit. It gains the following effect during this battle:",
  },
  {
    id: "ST12-014-Delayed",
    cardCode: "ST12-014",
    trigger: "Delayed:destroyedEnemyInBattle",
    reaction: { event: "destroyedEnemyInBattle", subject: "friendly" },
    actions: [{ op: "destroy", target }],
    targetScope: "enemyUnit",
    targetFilter: "ap<=2",
    sourceText: "■When this Unit destroys an enemy Unit with battle damage, choose 1 enemy Unit with 2 or less AP. Destroy it.",
  },

  // ST12-015 Two Unicorns — só modos com alvo escolhível (Q450/Q451)
  {
    id: "ST12-015-Action",
    cardCode: "ST12-015",
    trigger: "Action",
    actions: [
      {
        op: "chooseMode",
        key: "mode",
        options: [
          { value: "1", label: "Destruir 1 Unit inimiga de Lv.2 ou menos" },
          { value: "2", label: "2 de dano em 1 Unit amiga e em 1 Unit inimiga de Lv.5 ou mais" },
        ],
      },
    ],
    sourceText: `【Action】${MODE_HEADER}`,
  },
  {
    id: "ST12-015-Mode1",
    cardCode: "ST12-015",
    trigger: "Mode:1",
    actions: [{ op: "destroy", target }],
    targetScope: "enemyUnit",
    targetFilter: "level<=2",
    sourceText: "■Choose 1 enemy Unit that is Lv.2 or lower. Destroy it.",
  },
  {
    id: "ST12-015-Mode2",
    cardCode: "ST12-015",
    trigger: "Mode:2",
    actions: [
      { op: "damageUnit", target, amount: 2 },
      { op: "damageUnit", target: { kind: "named", name: "enemyTarget" }, amount: 2 },
    ],
    targetScope: "friendlyUnit",
    secondaryTarget: { name: "enemyTarget", targetScope: "enemyUnit", targetFilter: "level>=5" },
    sourceText: "■Choose 1 friendly Unit and 1 enemy Unit that is Lv.5 or higher. Deal 2 damage to them.",
  },

  // ST12-016 Libra — só conta Unit pareada NA destruição (Q453); vale mesmo destruída na troca (Q452)
  stdDeployThisBurst("ST12-016"),
  stdBaseDeployShield("ST12-016"),
  {
    id: "ST12-016-ActivateMain",
    cardCode: "ST12-016",
    trigger: "Activate·Main",
    cost: [{ op: "rest", target: self }],
    condition: { predicate: "pairedUnitDestroyedEnemyInBattleThisTurn", then: [{ op: "damageUnit", target, amount: 1 }] },
    actions: [],
    targetScope: "enemyUnit",
    targetFilter: "level<=4",
    sourceText:
      "【Activate･Main】Rest this Base：If a friendly Unit paired with a Pilot has destroyed an enemy Unit with battle damage this turn, choose 1 enemy Unit that is Lv.4 or lower. Deal 1 damage to it.",
  },
];
