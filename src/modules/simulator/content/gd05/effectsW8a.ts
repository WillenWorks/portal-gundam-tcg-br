import type { EffectSpec } from "../../engine/effectSpec";
import { TOKEN_GUNDNODE } from "./tokens";

/**
 * Wave W8a — GD05-C com vocabulário que o motor já tem (ajustes pequenos). Estáticos, custo dinâmico, provocação e
 * "ataca no turno do deploy só Unit descansada" ficam nas CardDefs (`// W8`).
 */

const target = { kind: "named", name: "target" } as const;

export const GD05_W8A_EFFECT_SPECS: EffectSpec[] = [
  {
    id: "GD05-004-WhenLinked",
    cardCode: "GD05-004",
    trigger: "When Linked",
    actions: [{ op: "moveZone", target, toZone: "hand" }],
    targetScope: "enemyUnit",
    targetFilter: "level<=4",
    sourceText: "【When Linked】Choose 1 enemy Unit that is Lv.4 or lower. Return it to its owner's hand.",
  },
  {
    id: "GD05-016-Reaction",
    cardCode: "GD05-016",
    trigger: "Reaction:unitDeployed",
    reaction: { event: "unitDeployed", subject: "friendly", subjectFilter: "trait:Orb" },
    actions: [{ op: "grantKeyword", target: { kind: "self" }, keyword: "High-Maneuver", duration: "endOfTurn" }],
    sourceText: "When one of your (Orb) Units is deployed, this Unit gains <High-Maneuver> during this turn.",
  },
  // GD05-059 — o <High-Maneuver> vem mesmo sem Gjallarhorn ativa (frase independente)
  {
    id: "GD05-059-Attack",
    cardCode: "GD05-059",
    trigger: "Attack",
    actions: [{ op: "rest", target }],
    condition: { predicate: "chosenNonEmpty:target", then: [{ op: "draw", player: "controller", n: 1 }] },
    targetScope: "friendlyUnit",
    targetFilter: "trait:Gjallarhorn;active",
    sourceText: "【Attack】Choose 1 of your active (Gjallarhorn) Units. Rest it. If you do, draw 1.",
  },
  {
    id: "GD05-059-Attack-HighManeuver",
    cardCode: "GD05-059",
    trigger: "Attack",
    actions: [{ op: "grantKeyword", target: { kind: "self" }, keyword: "High-Maneuver", duration: "endOfTurn" }],
    sourceText: "This Unit gains <High-Maneuver> during this turn.",
  },
  {
    id: "GD05-064-Deploy",
    cardCode: "GD05-064",
    trigger: "Deploy",
    condition: {
      predicate: "selfDeployedFromTrash",
      then: [{ op: "searchTrashToHand", player: "controller", filter: { cardType: "PILOT", nameContains: "Shinn Asuka" } }],
    },
    actions: [],
    sourceText:
      '【Deploy】If you deploy this Unit from your trash, choose 1 Pilot card with "Shinn Asuka" in its card name from your trash. Add it to your hand.',
  },
  {
    id: "GD05-067-Attack",
    cardCode: "GD05-067",
    trigger: "Attack",
    actions: [{ op: "rest", target }],
    targetScope: "enemyUnit",
    sourceText: "【Attack】Choose 1 enemy Unit. Rest it.",
  },
  {
    id: "GD05-070-Reaction",
    cardCode: "GD05-070",
    trigger: "Reaction:destroyedEnemyInBattle",
    reaction: { event: "destroyedEnemyInBattle", subject: "self", turn: "yours" },
    oncePerTurn: true,
    actions: [
      { op: "setActive", target },
      { op: "preventAttackThisTurn", target },
    ],
    targetScope: "friendlyUnit",
    targetFilter: "rested;linkUnit;or(trait:Preventer|trait:G Team)",
    sourceText:
      "【Once per Turn】During your turn, when this Unit destroys an enemy Unit with battle damage, choose 1 of your rested (Preventer)/(G Team) Link Units. Set it as active. It can't attack during this turn.",
  },
  {
    id: "GD05-093-WhenLinked",
    cardCode: "GD05-093",
    trigger: "When Linked",
    optional: true,
    actions: [{ op: "deployFromTrashPayingCost", player: "controller", filter: { cardType: "BASE", anyTrait: ["Neo Zeon"] }, free: true }],
    sourceText: "【When Linked】You may choose 1 (Neo Zeon) Base card from your trash. Deploy it.",
  },
  {
    id: "GD05-108-Action",
    cardCode: "GD05-108",
    trigger: "Action",
    actions: [{ op: "changeAttackTarget", target }],
    targetScope: "friendlyUnit",
    targetFilter: "rested;trait:Academy",
    sourceText: "【Action】Choose 1 friendly rested (Academy) Unit. Change a battling enemy Unit's attack target to it.",
  },
  {
    id: "GD05-119-Action",
    cardCode: "GD05-119",
    trigger: "Action",
    actions: [{ op: "modifyStat", stat: "ap", amount: -3, duration: "thisBattle", target }],
    targetScope: "enemyUnit",
    targetFilter: "battlingFriendlyLevelAtLeast:5",
    sourceText: "【Action】Choose 1 enemy Unit that is battling one of your Units that is Lv.5 or higher. It gets AP-3 during this battle.",
  },
  {
    id: "GD05-126-ActivateMain",
    cardCode: "GD05-126",
    trigger: "Activate·Main",
    oncePerTurn: true,
    cost: [{ op: "payResourceCost", player: "controller", n: 2 }],
    condition: {
      predicate: "controllerUnitNameContainsLevelAtLeast:Gundam Aerial:5",
      then: [{ op: "spawnToken", def: TOKEN_GUNDNODE, player: "controller", zone: "battleArea" }],
    },
    actions: [],
    sourceText:
      '【Activate･Main】【Once per Turn】②：If you have a Unit with "Gundam Aerial" in its card name that is Lv.5 or higher in play, deploy 1 [Gundnode]((Quiet Zero)･AP2･HP2･<Breach 1>) Unit token.',
  },
];
