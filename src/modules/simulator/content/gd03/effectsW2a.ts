import type { EffectSpec } from "../../engine/effectSpec";
import { TOKEN_CGS_MOBILE_WORKER } from "./tokens";

/**
 * Wave W2a (GD03) — gatilhos reativos (C1): `trigger: "Reaction:<evento>"` + `reaction`
 * (de quem é o evento). Ver `ReactionSpec` em engine/effectSpec.ts.
 */

const target = { kind: "named", name: "target" } as const;

export const GD03_W2A_EFFECT_SPECS: EffectSpec[] = [
  // GD03-002 The-O
  {
    id: "GD03-002-AllyAttack",
    cardCode: "GD03-002",
    trigger: "Reaction:attack",
    reaction: { event: "attack", subject: "friendlyOther", subjectFilter: "hasKeyword:Repair" },
    duringPair: true,
    actions: [{ op: "rest", target }],
    targetScope: "enemyUnit",
    targetFilter: "level<=reactionSubject",
    sourceText:
      "【During Pair】When one of your other Units with <Repair> attacks, choose 1 enemy Unit whose Lv. is equal to or lower than that Unit. Rest it.",
  },
  // GD03-038 GuAIZ (Commander Type)
  {
    id: "GD03-038-RestedByEffect",
    cardCode: "GD03-038",
    trigger: "Reaction:restedByEffect",
    reaction: { event: "restedByEffect", subject: "self", turn: "yours" },
    actions: [{ op: "modifyStat", stat: "ap", amount: 2, duration: "endOfTurn", target }],
    targetScope: "friendlyUnit",
    targetFilter: "trait:ZAFT",
    sourceText: "During your turn, when this Unit is rested by an effect, choose 1 of your (ZAFT) Units. It gets AP+2 during this turn.",
  },
  // GD03-053
  {
    id: "GD03-053-AllyEffectDamage",
    cardCode: "GD03-053",
    trigger: "Reaction:effectDamage",
    reaction: { event: "effectDamage", subject: "friendly", subjectFilter: "anyTrait:Tekkadan,Teiwaz", turn: "yours" },
    duringPair: true,
    oncePerTurn: true,
    actions: [{ op: "rest", target }],
    targetScope: "enemyUnit",
    targetFilter: "level<=4",
    sourceText:
      "【During Pair】【Once per Turn】During your turn, when one of your (Tekkadan)/(Teiwaz) Units receives effect damage, choose 1 enemy Unit that is Lv.4 or lower. Rest it.",
  },
  // GD03-060
  {
    id: "GD03-060-EffectDamage",
    cardCode: "GD03-060",
    trigger: "Reaction:effectDamage",
    reaction: { event: "effectDamage", subject: "self", turn: "yours" },
    oncePerTurn: true,
    actions: [{ op: "spawnToken", def: TOKEN_CGS_MOBILE_WORKER, player: "controller", zone: "battleArea", rested: true }],
    sourceText:
      "【Once per Turn】During your turn, when this Unit receives effect damage, deploy 1 rested [CGS Mobile Worker]((Tekkadan)·AP1·HP1) Unit token.",
  },
  // GD03-069
  {
    id: "GD03-069-EndOfTurn",
    cardCode: "GD03-069",
    trigger: "Reaction:endOfTurn",
    reaction: { event: "endOfTurn", subject: "self" },
    duringLink: true,
    condition: { predicate: "selfPairedThisTurn", then: [{ op: "setActive", target: { kind: "self" } }] },
    actions: [],
    sourceText: "【During Link】At the end of the turn when this Unit is paired with a Pilot, set it as active.",
  },
  // GD03-095 Azee Gurumin (Piloto: "this Unit" = a Unit pareada)
  {
    id: "GD03-095-EffectDamage",
    cardCode: "GD03-095",
    trigger: "Reaction:effectDamage",
    reaction: { event: "effectDamage", subject: "self" },
    oncePerTurn: true,
    actions: [{ op: "modifyStat", stat: "ap", amount: -1, duration: "endOfTurn", target }],
    targetScope: "enemyUnit",
    sourceText: "【Once per Turn】When this Unit receives effect damage, choose 1 enemy Unit. It gets AP-1 during this turn.",
  },
  // GD03-098 Graham Aker (Piloto)
  {
    id: "GD03-098-SetActiveByEffect",
    cardCode: "GD03-098",
    trigger: "Reaction:setActiveByEffect",
    reaction: { event: "setActiveByEffect", subject: "self" },
    duringLink: true,
    actions: [{ op: "moveZone", target, toZone: "hand" }],
    targetScope: "enemyUnit",
    targetFilter: "hp<=3",
    sourceText:
      "【During Link】When this rested Unit is set as active by an effect, choose 1 enemy Unit with 3 or less HP. Return it to its owner's hand.",
  },
  // GD03-124 (Base)
  {
    id: "GD03-124-PilotPaired",
    cardCode: "GD03-124",
    trigger: "Reaction:pilotPaired",
    reaction: { event: "pilotPaired", subject: "friendly", subjectFilter: "level<=3" },
    oncePerTurn: true,
    actions: [{ op: "rest", target }],
    targetScope: "enemyUnit",
    targetFilter: "hp<=3",
    sourceText:
      "【Once per Turn】When you pair a Pilot that is Lv.3 or lower with one of your Units, choose 1 enemy Unit with 3 or less HP. Rest it.",
  },
  // GD03-128 (Base)
  {
    id: "GD03-128-RestedByEnemyEffect",
    cardCode: "GD03-128",
    trigger: "Reaction:restedByEffect",
    reaction: { event: "restedByEffect", subject: "friendly", byEnemyEffect: true, turn: "opponents" },
    oncePerTurn: true,
    actions: [{ op: "damageUnit", amount: 1, target }],
    targetScope: "enemyUnit",
    sourceText:
      "【Once per Turn】During your opponent's turn, when one of your Units is rested by one of your opponent's effects, choose 1 enemy Unit. Deal 1 damage to it.",
  },
  // GD03-129 (Base)
  {
    id: "GD03-129-AllyEffectDamage",
    cardCode: "GD03-129",
    trigger: "Reaction:effectDamage",
    reaction: { event: "effectDamage", subject: "friendly", subjectFilter: "anyTrait:Tekkadan,Teiwaz", turn: "yours" },
    optional: true,
    condition: {
      predicate: "selfIsActive",
      then: [
        { op: "rest", target: { kind: "self" } },
        { op: "millToTrash", player: "controller", count: 1 },
      ],
    },
    actions: [],
    sourceText:
      "During your turn, when one of your friendly (Tekkadan)/(Teiwaz) Units receives effect damage, you may rest this Base. If you do, place the top card of your deck into your trash.",
  },
];
