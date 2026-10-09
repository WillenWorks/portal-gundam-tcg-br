import type { CardDefFilter, EffectSpec, PrimitiveCall, TargetRef } from "../../engine/effectSpec";
import { EX_RESOURCE_TOKEN } from "../../engine/setup";
import { development } from "./effectsW10a";

/**
 * W11 — fecha o EB01 (FAQ oficial do EB01). Mesmas convenções da W10: o simulador é 1v1, então "all players" = os
 * 2 jogadores, "Choose 1 enemy player" = o oponente e "If there are 2 or more enemy players" nunca vale (exato).
 * "All players each look at the top card …": cada jogador decide sobre o próprio deck (o do oponente via
 * `decidedBy: "opponent"`); revelar é a 1ª escolha, topo/fundo só existe se a carta não foi revelada.
 */

const target: TargetRef = { kind: "named", name: "target" };
const targets: TargetRef = { kind: "namedGroup", name: "target" };
const self: TargetRef = { kind: "self" };
const reactionSubject: TargetRef = { kind: "named", name: "reactionSubject" };

/** "All players each look at the top card of their deck. If it is <filtro>, they may reveal it and add it to their hand. They return any remaining card to the top or bottom of their deck." */
function allPlayersLookTop(cardCode: string, trigger: string, opener: string, filter: CardDefFilter, ifText: string): EffectSpec[] {
  const id = (suffix: string) => `${cardCode}-${suffix}`;
  const returnText = "They return any remaining card to the top or bottom of their deck.";
  const look = (player: "controller" | "opponent", then: string, decidedBy?: "opponent"): EffectSpec => ({
    id: id(player === "controller" ? "LookYours" : "LookOpponent"),
    cardCode,
    trigger: player === "controller" ? "Then:1" : "Then:3",
    condition: { predicate: "noReveal", then: [{ op: "thenTrigger", trigger: then, ...(decidedBy ? { decidedBy } : {}) }] },
    actions: [{ op: "lookAtTopFilterReveal", player, count: 1, filter, restTo: "keep" }],
    sourceText: ifText,
  });
  const place = (player: "controller" | "opponent"): EffectSpec => ({
    id: id(player === "controller" ? "PlaceYours" : "PlaceOpponent"),
    cardCode,
    trigger: player === "controller" ? "Then:2" : "Then:4",
    actions: [{ op: "moveTopCardToChosenPosition", player, optionsKey: "position", positions: ["top", "bottom"] }],
    sourceText: returnText,
  });
  return [
    {
      id: id(trigger),
      cardCode,
      trigger,
      actions: [
        { op: "thenTrigger", trigger: "Then:1" },
        { op: "thenTrigger", trigger: "Then:3", decidedBy: "opponent" },
      ],
      sourceText: opener,
    },
    look("controller", "Then:2"),
    place("controller"),
    look("opponent", "Then:4", "opponent"),
    place("opponent"),
  ];
}

const placeExForAll: PrimitiveCall[] = [
  { op: "spawnToken", def: EX_RESOURCE_TOKEN, player: "controller", zone: "resourceArea", count: 1 },
  { op: "spawnToken", def: EX_RESOURCE_TOKEN, player: "opponent", zone: "resourceArea", count: 1 },
];

export const EB01_W11_EFFECT_SPECS: EffectSpec[] = [
  // EB01-003 Gundam Kimaris Vidar — o "rest all Units" é dos 2 lados; conta as Units ativas antes de descansar
  {
    id: "EB01-003-EndOfTurn",
    cardCode: "EB01-003",
    trigger: "Reaction:endOfTurn",
    reaction: { event: "endOfTurn", subject: "self", turn: "yours" },
    condition: { predicate: "selfIsRested", then: [{ op: "rest", target: { kind: "group", group: { kind: "allUnits" } } }] },
    condition2: { predicate: "selfIsRested;activeUnitsInPlayAtLeast:3", then: [{ op: "draw", player: "controller", n: 1 }] },
    actions: [],
    sourceText: "At the end of your turn, if this Unit is rested, rest all Units. If this effect rested 3 or more Units, draw 1.",
  },

  // EB01-023
  ...allPlayersLookTop(
    "EB01-023",
    "Attack",
    "【Attack】All players each look at the top card of their deck.",
    { minLevel: 5 },
    "If it is a card that is Lv.5 or higher, they may reveal it and add it to their hand.",
  ),

  // EB01-025 — Development 2: os 2 jogadores ganham 1 EX Resource (limite de 5 cada, FAQ GD05-018)
  development("EB01-025", "Deploy", 2),
  {
    id: "EB01-025-Then",
    cardCode: "EB01-025",
    trigger: "Then:1",
    actions: placeExForAll,
    sourceText: "■All players place 1 EX Resource.",
  },

  // EB01-028 — "another Unit attacks an enemy Unit": no 1v1, uma Unit amiga atacando uma Unit do oponente
  {
    id: "EB01-028-AllyAttack",
    cardCode: "EB01-028",
    trigger: "Reaction:attack",
    reaction: { event: "attack", subject: "friendlyOther" },
    oncePerTurn: true,
    condition: {
      predicate: "selfIsRested;attackingEnemyUnit",
      then: [{ op: "grantKeyword", target: reactionSubject, keyword: "Breach 2", duration: "thisBattle" }],
    },
    actions: [],
    sourceText: "【Once per Turn】When another Unit attacks an enemy Unit, if this Unit is rested, the attacking Unit gains <Breach 2> during this battle.",
  },

  // EB01-029 — "all Units with <Blocker>" = os 2 lados
  {
    id: "EB01-029-Deploy",
    cardCode: "EB01-029",
    trigger: "Deploy",
    condition: {
      predicate: "enemyUnitCountAtLeast:5",
      then: [{ op: "damageUnit", target: { kind: "group", group: { kind: "allUnits", hasKeyword: "Blocker", maxLevel: 4 } }, amount: 2 }],
    },
    actions: [],
    sourceText: "【Deploy】If 5 or more enemy Units are in play, deal 2 damage to all Units with <Blocker> that are Lv.4 or lower.",
  },

  // EB01-033 Taurus (Sanc Kingdom)
  {
    id: "EB01-033-ActivateAction",
    cardCode: "EB01-033",
    trigger: "Activate·Action",
    oncePerTurn: true,
    cost: [{ op: "payResourceCost", player: "controller", n: 1 }],
    actions: [{ op: "modifyStat", target, stat: "ap", amount: 1, duration: "thisBattle" }],
    targetScope: "anyUnit",
    targetFilter: "notSelf;beingAttacked",
    sourceText: "【Activate･Action】【Once per Turn】①：Choose 1 other Unit that is being attacked. It gets AP+1 during this battle.",
  },

  // EB01-040 Gundam Epyon — 2+ jogadores inimigos nunca acontece no 1v1
  {
    id: "EB01-040-Deploy",
    cardCode: "EB01-040",
    trigger: "Deploy",
    condition: {
      predicate: "enemyPlayerCountAtLeast:2",
      then: [{ op: "grantKeyword", target: targets, keyword: "Breach 3", duration: "endOfTurn" }],
    },
    actions: [],
    targetScope: "friendlyUnit",
    targetCount: { min: 1, max: 3 },
    sourceText: "【Deploy】If there are 2 or more enemy players, choose 1 to 3 friendly Units. They gain <Breach 3> during this turn.",
  },

  // EB01-042 — "Units that are Lv.7 or lower" (os 2 lados) não ativam <Blocker> nesta batalha
  {
    id: "EB01-042-Attack",
    cardCode: "EB01-042",
    trigger: "Attack",
    actions: [
      {
        op: "grantKeyword",
        target: { kind: "group", group: { kind: "allUnits", maxLevel: 7 } },
        keyword: "CannotActivateBlocker",
        duration: "thisBattle",
      },
    ],
    sourceText: "【Attack】Units that are Lv.7 or lower can't activate <Blocker> during this battle.",
  },

  // EB01-044 — 2+ jogadores inimigos nunca acontece no 1v1
  {
    id: "EB01-044-Deploy",
    cardCode: "EB01-044",
    trigger: "Deploy",
    condition: { predicate: "enemyPlayerCountAtLeast:2", then: [{ op: "moveZone", target, toZone: "hand" }] },
    actions: [],
    targetScope: "enemyUnit",
    sourceText:
      "【Deploy】If there are 2 or more enemy players, choose 1 Unit belonging to an enemy player with the most Units. Return it to its owner's hand.",
  },

  // EB01-050 — a carta do topo vai pro trash; se era Lv.3+, -2 AP numa Unit inimiga
  {
    id: "EB01-050-Attack",
    cardCode: "EB01-050",
    trigger: "Attack",
    actions: [
      { op: "millToTrash", player: "controller", count: 1 },
      { op: "thenTrigger", trigger: "Then:1" },
    ],
    sourceText: "【Attack】Place the top card of your deck into your trash.",
  },
  {
    id: "EB01-050-Then",
    cardCode: "EB01-050",
    trigger: "Then:1",
    condition: { predicate: "controllerTrashTopLevelAtLeast:3", then: [{ op: "modifyStat", target, stat: "ap", amount: -2, duration: "thisBattle" }] },
    actions: [],
    targetScope: "enemyUnit",
    sourceText: "If you placed a card that is Lv.3 or higher with this effect, choose 1 enemy Unit. It gets AP-2 during this battle.",
  },

  // EB01-059 — os Resources são iguais pra pagar: cada jogador ativa 1 descansado (sem escolha que mude algo)
  {
    id: "EB01-059-Attack",
    cardCode: "EB01-059",
    trigger: "Attack",
    duringLink: true,
    oncePerTurn: true,
    actions: [
      { op: "setActive", target: { kind: "group", group: { kind: "firstRestedResourceOf", player: "controller" } } },
      { op: "setActive", target: { kind: "group", group: { kind: "firstRestedResourceOf", player: "opponent" } } },
    ],
    sourceText: "【During Link】【Attack】【Once per Turn】All players each choose 1 of their Resources. Set them as active.",
  },

  // EB01-062 — o oponente decide se compra (AFK = não compra, 1ª opção)
  {
    id: "EB01-062-Attack",
    cardCode: "EB01-062",
    trigger: "Attack",
    oncePerTurn: true,
    actions: [{ op: "thenTrigger", trigger: "Then:1", decidedBy: "opponent" }],
    sourceText: "【Attack】【Once per Turn】Choose 1 enemy player.",
  },
  {
    id: "EB01-062-Choice",
    cardCode: "EB01-062",
    trigger: "Then:1",
    actions: [
      {
        op: "chooseMode",
        key: "mode",
        options: [
          { value: "decline", label: "Não comprar", decidedBy: "controller" },
          { value: "draw", label: "Comprar 1 (o oponente também compra 1)", decidedBy: "controller" },
        ],
      },
    ],
    sourceText: "They may draw 1.",
  },
  {
    id: "EB01-062-Draw",
    cardCode: "EB01-062",
    trigger: "Mode:draw",
    actions: [
      { op: "draw", player: "opponent", n: 1 },
      { op: "draw", player: "controller", n: 1 },
    ],
    sourceText: "If they draw with this effect, draw 1.",
  },

  // EB01-066
  {
    id: "EB01-066-WhenPaired",
    cardCode: "EB01-066",
    trigger: "When Paired",
    actions: [{ op: "grantAttackTargetRelax", target, keyword: "Blocker" }],
    targetScope: "friendlyUnit",
    targetFilter: "trait:G Generation",
    sourceText:
      "【When Paired】Choose 1 friendly (G Generation) Unit. During this turn, it may choose an active enemy Unit with <Blocker> as its attack target.",
  },

  // EB01-067
  {
    id: "EB01-067-WhenPaired",
    cardCode: "EB01-067",
    trigger: "When Paired",
    actions: [
      {
        op: "lookAtTopFilterReveal",
        player: "controller",
        count: 3,
        filter: { cardType: "UNIT", anyTrait: ["G Generation"] },
        revealTo: "top",
        restTo: "bottom",
      },
    ],
    sourceText:
      "【When Paired】Look at the top 3 cards of your deck. You may reveal 1 (G Generation) Unit card among them and return it to the top of your deck. Return the remaining cards randomly to the bottom of your deck.",
  },

  // EB01-068 — o Piloto (já no trash junto da Unit destruída) volta pro topo do deck do dono
  {
    id: "EB01-068-Destroyed",
    cardCode: "EB01-068",
    trigger: "Destroyed",
    duringLink: true,
    optional: true,
    actions: [
      { op: "moveZone", target: self, toZone: "deck" },
      { op: "moveWithinDeck", target: self, position: "top" },
    ],
    sourceText: "【During Link】【Destroyed】You may return the card paired with this Unit to the top of its owner's deck.",
  },

  // EB01-077
  {
    id: "EB01-077-Action",
    cardCode: "EB01-077",
    trigger: "Action",
    actions: [{ op: "changeAttackTarget", target }],
    targetScope: "friendlyUnit",
    targetFilter: "rested;trait:G Generation",
    sourceText: "【Action】Choose 1 rested friendly (G Generation) Unit. Change a battling enemy Unit's attack target to it.",
  },

  // EB01-078
  ...allPlayersLookTop(
    "EB01-078",
    "Main",
    "【Main】All players each look at the top card of their deck.",
    { cardType: "UNIT" },
    "If it is a Unit card, they may reveal it and add it to their hand.",
  ),

  // EB01-079
  {
    id: "EB01-079-Main",
    cardCode: "EB01-079",
    trigger: "Main",
    actions: [
      {
        op: "grantDamageModifier",
        target,
        immune: true,
        kind: "battle",
        scope: "turn",
        enemyOnly: true,
        sourceUnitOnly: true,
        sourceMaxLevel: 3,
      },
    ],
    targetScope: "friendlyUnit",
    targetFilter: "trait:G Generation",
    sourceText: "【Main】Choose 1 friendly (G Generation) Unit. It can't receive battle damage from enemy Units that are Lv.3 or lower during this turn.",
  },

  // EB01-088 Miorine Rembran & Academy Ship
  {
    id: "EB01-088-Deploy",
    cardCode: "EB01-088",
    trigger: "Deploy",
    actions: [{ op: "addShieldToHand", player: "controller", count: 1 }],
    sourceText: "【Deploy】Add 1 of your Shields to your hand.",
  },
];
