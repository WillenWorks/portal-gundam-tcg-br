import type { EffectSpec } from "../../engine/effectSpec";
import { EX_RESOURCE_TOKEN } from "../../engine/setup";

/**
 * Wave W6 (GD05-A) — Units 003–060, só com o vocabulário que o motor já tem.
 * Estáticos do lote (GD05-007 【During Link】, GD05-020 【During Pair】, GD05-055 redução de dano de batalha)
 * ficam nos `CardDef` (`staticAbilities` / `damageReductions`, comentário `// W6`).
 * GD05-050 (reação de dano de batalha) entrou na integração, com o predicado novo `battleVictimUnpaired`.
 */

const target = { kind: "named", name: "target" } as const;

const FLAUROS_TEXT = "【Deploy】/【Attack】Choose 1 enemy Unit that is Lv.2 or lower. Destroy it.";

export const GD05_W6A_EFFECT_SPECS: EffectSpec[] = [
  {
    id: "GD05-003-Destroyed",
    cardCode: "GD05-003",
    trigger: "Destroyed",
    condition: { predicate: "controllerHasPilotWithTrait:Orb", then: [{ op: "draw", player: "controller", n: 1 }] },
    actions: [],
    sourceText: "【Destroyed】If you have an (Orb) Pilot in play, draw 1.",
  },
  // GD05-011 — custo opcional "Rest it. If you do": mesmo desenho do GD03-039 (2ª escolha sequencial)
  {
    id: "GD05-011-Deploy",
    cardCode: "GD05-011",
    trigger: "Deploy",
    optional: true,
    condition: {
      predicate: "chosenNonEmpty:target;chosenNonEmpty:enemyTarget",
      then: [{ op: "damageUnit", target: { kind: "named", name: "enemyTarget" }, amount: 2 }],
    },
    actions: [{ op: "rest", target }],
    targetScope: "friendlyUnit",
    targetFilter: "trait:Earth Alliance;active;notSelf",
    secondaryTarget: { name: "enemyTarget", targetScope: "enemyUnit", targetFilter: "rested", sequential: true },
    sourceText:
      "【Deploy】You may choose 1 of your other active (Earth Alliance) Units. Rest it. If you do, choose 1 rested enemy Unit. Deal 2 damage to it.",
  },
  {
    id: "GD05-012-WhenLinked",
    cardCode: "GD05-012",
    trigger: "When Linked",
    actions: [{ op: "moveZone", target, toZone: "hand" }],
    targetScope: "enemyUnit",
    targetFilter: "rested;level<=3",
    sourceText: "【When Linked】Choose 1 rested enemy Unit that is Lv.3 or lower. Return it to its owner's hand.",
  },
  {
    id: "GD05-015-Deploy",
    cardCode: "GD05-015",
    trigger: "Deploy",
    actions: [{ op: "damageUnit", target, amount: 1 }],
    targetScope: "enemyUnit",
    targetFilter: "rested",
    sourceText: "【Deploy】Choose 1 rested enemy Unit. Deal 1 damage to it.",
  },
  {
    id: "GD05-019-Destroyed",
    cardCode: "GD05-019",
    trigger: "Destroyed",
    actions: [{ op: "lookAtTopFilterReveal", player: "controller", count: 3, filter: { cardType: "UNIT", anyTrait: ["Londo Bell"] } }],
    sourceText:
      "【Destroyed】Look at the top 3 cards of your deck. You may reveal 1 (Londo Bell) Unit card among them and add it to your hand. Return the remaining cards randomly to the bottom of your deck.",
  },
  {
    id: "GD05-020-Deploy",
    cardCode: "GD05-020",
    trigger: "Deploy",
    condition: {
      predicate: "controllerTrashCardCountWithTraitAtLeast:Londo Bell:2",
      then: [{ op: "spawnToken", def: EX_RESOURCE_TOKEN, player: "controller", zone: "resourceArea" }],
    },
    actions: [],
    sourceText: "【Deploy】If there are 2 or more (Londo Bell) cards in your trash, place 1 EX Resource.",
  },
  {
    id: "GD05-023-Deploy",
    cardCode: "GD05-023",
    trigger: "Deploy",
    actions: [{ op: "spawnToken", def: EX_RESOURCE_TOKEN, player: "controller", zone: "resourceArea" }],
    sourceText: "【Deploy】Place 1 EX Resource.",
  },
  {
    id: "GD05-025-Deploy",
    cardCode: "GD05-025",
    trigger: "Deploy",
    actions: [{ op: "lookAtTopFilterReveal", player: "controller", count: 3, filter: { cardType: "COMMAND" } }],
    sourceText:
      "【Deploy】Look at the top 3 cards of your deck. You may reveal 1 Command card among them and add it to your hand. Return the remaining cards randomly to the bottom of your deck.",
  },
  {
    id: "GD05-028-Deploy",
    cardCode: "GD05-028",
    trigger: "Deploy",
    actions: [{ op: "grantAttackTargetRelax", target, maxAp: 4 }],
    targetScope: "friendlyUnit",
    targetFilter: "trait:Londo Bell",
    sourceText:
      "【Deploy】Choose 1 of your (Londo Bell) Units. During this turn, it may choose an active enemy Unit with 4 or less AP as its attack target.",
  },
  {
    id: "GD05-029-Deploy",
    cardCode: "GD05-029",
    trigger: "Deploy",
    actions: [{ op: "moveTopCardToChosenPosition", player: "controller", optionsKey: "position" }],
    sourceText: "【Deploy】Look at the top card of your deck. Return it to the top or bottom of your deck.",
  },
  {
    id: "GD05-039-Attack",
    cardCode: "GD05-039",
    trigger: "Attack",
    actions: [{ op: "grantKeyword", target, keyword: "High-Maneuver", duration: "endOfTurn" }],
    targetScope: "friendlyUnit",
    targetFilter: "trait:Phantom Pain;linkUnit",
    sourceText: "【Attack】Choose 1 of your (Phantom Pain) Linked Units. It gains <High-Maneuver> during this turn.",
  },
  {
    id: "GD05-050-BattleDamage",
    cardCode: "GD05-050",
    trigger: "Reaction:battleDamageToEnemyUnit",
    reaction: { event: "battleDamageToEnemyUnit", subject: "self" },
    condition: {
      predicate: "battleVictimInPlay;battleVictimLevelAtMost:4;battleVictimUnpaired",
      then: [{ op: "destroy", target: { kind: "named", name: "battleVictim" } }],
    },
    actions: [],
    sourceText: "When this Unit deals battle damage to an enemy Unit that is Lv.4 or lower that has no paired Pilot, destroy that enemy Unit.",
  },
  {
    id: "GD05-050-Destroyed",
    cardCode: "GD05-050",
    trigger: "Destroyed",
    actions: [{ op: "millToTrash", player: "controller", count: 2 }],
    sourceText: "【Destroyed】Place the top 2 cards of your deck into your trash.",
  },
  // GD05-060 — 【Deploy】/【Attack】 no mesmo texto = 2 specs (um por gatilho)
  {
    id: "GD05-060-Deploy",
    cardCode: "GD05-060",
    trigger: "Deploy",
    actions: [{ op: "destroy", target }],
    targetScope: "enemyUnit",
    targetFilter: "level<=2",
    sourceText: FLAUROS_TEXT,
  },
  {
    id: "GD05-060-Attack",
    cardCode: "GD05-060",
    trigger: "Attack",
    actions: [{ op: "destroy", target }],
    targetScope: "enemyUnit",
    targetFilter: "level<=2",
    sourceText: FLAUROS_TEXT,
  },
];
