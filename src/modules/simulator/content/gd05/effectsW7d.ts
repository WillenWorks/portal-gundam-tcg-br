import type { EffectSpec } from "../../engine/effectSpec";

/**
 * Wave W7d — Neo Zeon "destruída por efeito seu" e Phantom Pain.
 * A origem da destruição por efeito vem do motor (`DestroyedInBattle.byEffect` → alvo implícito `destroyedBy` e o
 * registro do turno `ownUnitDestroyedByOwnEffectOnTurn`). Os estáticos de "7+ cartas no trash do oponente"
 * (GD05-037, GD05-091) e o <Breach> do 【During Link】 do GD05-037 ficam nas CardDefs.
 */

const target = { kind: "named", name: "target" } as const;

export const GD05_W7D_EFFECT_SPECS: EffectSpec[] = [
  // GD05-053 Quess's Jagd Doga
  {
    id: "GD05-053-Destroyed",
    cardCode: "GD05-053",
    trigger: "Destroyed",
    condition: { predicate: "selfDestroyedByOwnEffectWithTrait:Neo Zeon", then: [{ op: "moveZone", target: { kind: "self" }, toZone: "hand" }] },
    actions: [],
    sourceText: "【Destroyed】If this Unit is destroyed by one of your (Neo Zeon) card's effects, add it from your trash to your hand.",
  },

  // GD05-054 Alpha Azieru
  {
    id: "GD05-054-Reaction",
    cardCode: "GD05-054",
    trigger: "Reaction:destroyedByEffect",
    reaction: { event: "destroyedByEffect", subject: "friendly" },
    oncePerTurn: true,
    actions: [{ op: "draw", player: "controller", n: 1 }],
    sourceText: "【Once per Turn】When one of your Units is destroyed by an effect, draw 1.",
  },

  // GD05-057 Gyunei's Jagd Doga
  {
    id: "GD05-057-ActivateMain",
    cardCode: "GD05-057",
    trigger: "Activate·Main",
    oncePerTurn: true,
    actions: [
      { op: "destroy", target },
      { op: "setActive", target: { kind: "self" } },
      { op: "grantKeyword", target: { kind: "self" }, keyword: "CannotTargetPlayer", duration: "endOfTurn" },
    ],
    targetScope: "friendlyUnit",
    targetFilter: "notSelf",
    sourceText:
      "【Activate･Main】【Once per Turn】Choose 1 of your other Units. Destroy it. If you do, set this Unit as active. It can't choose the enemy player as its attack target during this turn.",
  },

  // GD05-127 Girty Lue (Base)
  {
    id: "GD05-127-Reaction",
    cardCode: "GD05-127",
    trigger: "Reaction:pilotPaired",
    reaction: { event: "pilotPaired", subject: "friendly", subjectFilter: "pairedUnitLinkWithTrait:Phantom Pain" },
    oncePerTurn: true,
    actions: [{ op: "grantKeyword", target, keyword: "CannotActivateBlocker", duration: "endOfTurn" }],
    targetScope: "enemyUnit",
    sourceText: "【Once per Turn】When a friendly (Phantom Pain) Unit links, choose 1 enemy Unit. It can't activate <Blocker> during this turn.",
  },

  // GD05-129 Axis (Base)
  {
    id: "GD05-129-ActivateMain",
    cardCode: "GD05-129",
    trigger: "Activate·Main",
    cost: [{ op: "rest", target: { kind: "self" } }],
    condition: {
      predicate: "controllerUnitDestroyedByOwnTraitEffectThisTurn:Neo Zeon",
      then: [{ op: "deployFromHandTriggered", player: "controller", filter: { cardType: "UNIT", anyTrait: ["Neo Zeon"], maxLevel: 3 } }],
    },
    actions: [],
    sourceText:
      "【Activate･Main】Rest this Base：If one of your Units has been destroyed by one of your (Neo Zeon) card's effects during this turn, deploy 1 (Neo Zeon) Unit card that is Lv.3 or lower from your hand.",
  },
];
