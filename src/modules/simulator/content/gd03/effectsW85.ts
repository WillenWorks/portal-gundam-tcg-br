import type { EffectSpec } from "../../engine/effectSpec";

/**
 * W8.5 — deferidas do GD03 que já cabem no motor (FAQ GD03 de 16/01/2026):
 * - GD03-097: reação de combate + olhar 2 do topo (mesmo par `moveWithinDeck` toTop/toTrash do ST09-010);
 *   dispara mesmo se as duas Units forem destruídas (Q241).
 * - GD03-099: 【Destroyed】 do Piloto — "this Unit" é a Unit com que estava pareado (`formerPairedUnit`, Q243).
 * - GD03-079: a substituição está na CardDef (`restInsteadOfBase`) e nos specs de GD02-069/075 (`baseRestSubstitutable`).
 */

export const GD03_W85_EFFECT_SPECS: EffectSpec[] = [
  // GD03-097 Wistario Afam
  {
    id: "GD03-097-DestroyedEnemyInBattle",
    cardCode: "GD03-097",
    trigger: "Reaction:destroyedEnemyInBattle",
    reaction: { event: "destroyedEnemyInBattle", subject: "self", turn: "yours" },
    duringLink: true,
    oncePerTurn: true,
    actions: [
      { op: "moveWithinDeck", target: { kind: "named", name: "toTop" }, position: "top" },
      { op: "moveWithinDeck", target: { kind: "named", name: "toTrash" }, position: "trash" },
    ],
    sourceText:
      "【During Link】【Once per Turn】During your turn, when this Unit destroys an enemy Unit with battle damage, look at the top 2 cards of your deck and return 1 to the top. Place the remaining card into your trash.",
  },

  // GD03-099 Emma Sheen
  {
    id: "GD03-099-Destroyed",
    cardCode: "GD03-099",
    trigger: "Destroyed",
    duringLink: true,
    condition: {
      predicate: "controllerHasBaseColor:white",
      then: [{ op: "moveZone", target: { kind: "named", name: "target" }, toZone: "hand" }],
    },
    actions: [],
    targetScope: "enemyUnit",
    targetFilter: "level<=formerPairedUnit",
    sourceText:
      "【During Link】【Destroyed】If a friendly white Base is in play, choose 1 enemy Unit whose Lv. is equal to or lower than this Unit. Return it to its owner's hand.",
  },
];
