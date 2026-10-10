import type { EffectSpec, PrimitiveCall, TargetRef } from "../../engine/effectSpec";
import { mainAndAction, stdAddToHandBurst, stdDeployThisBurst } from "../standardSpecs";
import { exileFromTrash } from "../eb01/effectsW10a";
import { TOKEN_BIT_FUNNEL } from "./tokens";

/** W12 — ST13 (com o Q&A oficial das cartas, Q454–Q461). */

const target: TargetRef = { kind: "named", name: "target" };
const self: TargetRef = { kind: "self" };
const BIT = "[Bit / Funnel]((Long-Range Weapon)･AP2･HP2･This Unit can't be paired with a Pilot or attack)";
const deployBits = (count: number): PrimitiveCall => ({ op: "spawnToken", def: TOKEN_BIT_FUNNEL, player: "controller", zone: "battleArea", count });

/** "Deploy 1 to 2 [Bit / Funnel] Unit tokens" — o jogador escolhe quantos (a Battle Area tem limite) */
function oneOrTwoBits(cardCode: string, trigger: string, extra: Partial<EffectSpec>, sourceText: string): EffectSpec[] {
  return [
    {
      id: `${cardCode}-${trigger.replace(/[^A-Za-z]/g, "")}`,
      cardCode,
      trigger,
      ...extra,
      actions: [
        {
          op: "chooseMode",
          key: "mode",
          options: [
            { value: "2", label: "Deployar 2 tokens Bit / Funnel" },
            { value: "1", label: "Deployar 1 token Bit / Funnel" },
          ],
        },
      ],
      sourceText,
    },
    { id: `${cardCode}-Mode1`, cardCode, trigger: "Mode:1", actions: [deployBits(1)], sourceText },
    { id: `${cardCode}-Mode2`, cardCode, trigger: "Mode:2", actions: [deployBits(2)], sourceText },
  ];
}

export const ST13_EFFECT_SPECS: EffectSpec[] = [
  // ST13-001 Qubeley
  ...oneOrTwoBits(
    "ST13-001",
    "Reaction:pilotPaired",
    { reaction: { event: "pilotPaired", subject: "friendly", turn: "yours" }, oncePerTurn: true },
    `【Once per Turn】During your turn, when you pair a Pilot with one of your Units, deploy 1 to 2 ${BIT} Unit tokens.`,
  ),
  // a batalha começa sem ataque (Q454–Q456): o token não precisa poder atacar
  {
    id: "ST13-001-ActivateMain",
    cardCode: "ST13-001",
    trigger: "Activate·Main",
    oncePerTurn: true,
    cost: [{ op: "payResourceCost", player: "controller", n: 1 }],
    actions: [{ op: "beginDamageOnlyBattle", target: { kind: "named", name: "enemyTarget" }, attacker: target }],
    targetScope: "friendlyUnit",
    targetFilter: "isToken",
    secondaryTarget: { name: "enemyTarget", targetScope: "enemyUnit" },
    sourceText:
      "【Activate･Main】【Once per Turn】①：Choose 1 of your Unit tokens and 1 enemy Unit. Begin a battle between them and only perform the damage step.",
  },

  // ST13-002 Elmeth
  {
    id: "ST13-002-Deploy",
    cardCode: "ST13-002",
    trigger: "Deploy",
    actions: [deployBits(1)],
    sourceText: `【Deploy】Deploy 1 ${BIT} Unit token.`,
  },

  // ST13-004 GX-Bit
  {
    id: "ST13-004-Deploy",
    cardCode: "ST13-004",
    trigger: "Deploy",
    actions: [{ op: "moveTopCardToChosenPosition", player: "controller", optionsKey: "position", positions: ["top", "bottom"] }],
    sourceText: "【Deploy】Look at the top card of your deck. Return it to the top or bottom of your deck.",
  },

  // ST13-005 GFreD — com 4+ inimigas, olhar é obrigatório; revelar é escolha (Q457)
  {
    id: "ST13-005-Deploy",
    cardCode: "ST13-005",
    trigger: "Deploy",
    condition: {
      predicate: "enemyUnitCountAtLeast:4",
      then: [{ op: "lookAtTopFilterReveal", player: "controller", count: 5, filter: { cardType: "PILOT" } }],
    },
    actions: [],
    sourceText:
      "【Deploy】If 4 or more enemy Units are in play, look at the top 5 cards of your deck. You may reveal 1 Pilot card among them and add it to your hand. Return the remaining cards randomly to the bottom of your deck.",
  },

  // ST13-006 Gundam Aerial
  {
    id: "ST13-006-Attack",
    cardCode: "ST13-006",
    trigger: "Attack",
    duringPair: true,
    condition: { predicate: "attackingPlayer", then: [{ op: "damageUnit", target, amount: 2 }] },
    actions: [],
    targetScope: "enemyUnit",
    sourceText: "【During Pair】【Attack】If you are attacking the enemy player, choose 1 enemy Unit. Deal 2 damage to it.",
  },
  {
    id: "ST13-006-ActivateAction",
    cardCode: "ST13-006",
    trigger: "Activate·Action",
    oncePerTurn: true,
    cost: [{ op: "rest", target: { kind: "named", name: "costUnit" } }],
    actions: [{ op: "damageUnit", target, amount: 1 }],
    targetScope: "enemyUnit",
    targetFilter: "level<=4",
    secondaryTarget: { name: "costUnit", targetScope: "friendlyUnit", targetFilter: "active" },
    sourceText: "【Activate･Action】【Once per Turn】Rest 1 friendly Unit：Choose 1 enemy Unit that is Lv.4 or lower. Deal 1 damage to it.",
  },

  // ST13-009 Gundam Pharact — o OPONENTE escolhe as 2 do trash dele
  {
    id: "ST13-009-Attack",
    cardCode: "ST13-009",
    trigger: "Attack",
    actions: [{ op: "thenTrigger", trigger: "Then:1", decidedBy: "opponent" }],
    sourceText: "【Attack】Choose 1 enemy player.",
  },
  {
    id: "ST13-009-Then",
    cardCode: "ST13-009",
    trigger: "Then:1",
    actions: [
      {
        op: "moveZone",
        target: { kind: "group", group: { kind: "firstNInTrash", count: 2, filter: { cardType: "UNIT" }, player: "opponent" } },
        toZone: "exile",
      },
    ],
    sourceText: "That player chooses 2 Unit cards from their trash. Exile them from the game.",
  },

  // ST13-010 Red Gundam (0079)
  {
    id: "ST13-010-ActivateMain",
    cardCode: "ST13-010",
    trigger: "Activate·Main",
    oncePerTurn: true,
    cost: [{ op: "destroy", target: { kind: "named", name: "costUnit" } }],
    actions: [{ op: "grantKeyword", target: self, keyword: "Breach 3", duration: "endOfTurn" }],
    secondaryTarget: { name: "costUnit", targetScope: "friendlyUnit", targetFilter: "isToken" },
    sourceText: "【Activate･Main】【Once per Turn】Destroy 1 friendly Unit token：This Unit gains <Breach 3> during this turn.",
  },

  // ST13-011 Haman Karn — olhar é obrigatório (Q458)
  stdAddToHandBurst("ST13-011"),
  {
    id: "ST13-011-WhenPaired",
    cardCode: "ST13-011",
    trigger: "When Paired",
    actions: [{ op: "lookAtTopFilterReveal", player: "controller", count: 5, filter: { cardType: "PILOT" }, maxLevelOfSelfUnit: true }],
    sourceText:
      "【When Paired】Look at the top 5 cards of your deck. You may reveal 1 Pilot card whose Lv. is equal to or lower than this Unit among them and add it to your hand. Return the remaining cards randomly to the bottom of your deck.",
  },

  // ST13-012 Suletta Mercury — "destroy" sem dano não conta (Q459)
  stdAddToHandBurst("ST13-012"),
  {
    id: "ST13-012-EnemyDestroyed",
    cardCode: "ST13-012",
    trigger: "Reaction:enemyDestroyedByEffectDamage",
    reaction: { event: "enemyDestroyedByEffectDamage", subject: "friendly" },
    oncePerTurn: true,
    condition: { predicate: "selfIsAttacking", then: [{ op: "draw", player: "controller", n: 1 }] },
    actions: [],
    sourceText: "【Once per Turn】When an enemy Unit is destroyed with effect damage while this Unit is attacking, draw 1.",
  },

  // ST13-013 I'm a Newtype
  ...oneOrTwoBits("ST13-013", "Main", {}, `【Main】Deploy 1 to 2 ${BIT} Unit tokens.`),

  // ST13-014 Final Duty — o deploy é de graça e ativa o 【Deploy】 (Q460/Q461)
  {
    id: "ST13-014-Main",
    cardCode: "ST13-014",
    trigger: "Main",
    actions: [
      { op: "destroy", target },
      { op: "thenTrigger", trigger: "Then:1" },
    ],
    targetScope: "friendlyUnit",
    sourceText: "【Main】Choose 1 of your Units. Destroy it.",
  },
  {
    id: "ST13-014-Then",
    cardCode: "ST13-014",
    trigger: "Then:1",
    actions: [{ op: "deployFromTopFilterReveal", player: "controller", count: 4, filter: { cardType: "UNIT", maxLevel: 4 } }],
    sourceText:
      "If you do, look at the top 4 cards of your deck. You may deploy 1 Unit card that is Lv.4 or lower among them. Return the remaining cards randomly to the bottom of your deck.",
  },

  // ST13-015 Operation to Intercept Solomon
  stdAddToHandBurst("ST13-015"),
  ...mainAndAction({
    cardCode: "ST13-015",
    cost: [exileFromTrash(3, { cardType: "UNIT" })],
    actions: [{ op: "damageUnit", target, amount: 3 }],
    targetScope: "enemyUnit",
    sourceText: "【Main】/【Action】Choose 3 Unit cards from your trash. Exile them from the game. If you do, choose 1 enemy Unit. Deal 3 damage to it.",
  }),

  // ST13-016 Sodon
  stdDeployThisBurst("ST13-016"),
  {
    id: "ST13-016-Deploy",
    cardCode: "ST13-016",
    trigger: "Deploy",
    actions: [{ op: "addShieldToHand", player: "controller", count: 1 }, deployBits(1)],
    sourceText: `【Deploy】Add 1 of your Shields to your hand. Then, deploy 1 ${BIT} Unit token.`,
  },
];
