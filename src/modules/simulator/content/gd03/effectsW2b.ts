import type { EffectSpec } from "../../engine/effectSpec";
import { TOKEN_AD_BALLOON } from "./tokens";

/**
 * Wave W2b (GD03) — regras de ataque (C4), camada de dano (C2) e reações de combate
 * (`Reaction:battleDamageToEnemyUnit` / `destroyedEnemyInBattle` / `destroyedShieldInBattle`,
 * com a Unit inimiga como alvo implícito `battleVictim`). Os campos contínuos (provocação,
 * proteção, restrição) vivem nos CardDefs.
 */

const target = { kind: "named", name: "target" } as const;
const victim = { kind: "named", name: "battleVictim" } as const;

export const GD03_W2B_EFFECT_SPECS: EffectSpec[] = [
  // GD03-020 (a proteção "can't receive enemy battle damage" está no CardDef)
  {
    id: "GD03-020-WhenPaired",
    cardCode: "GD03-020",
    trigger: "When Paired",
    condition: {
      predicate: "controllerTrashCardCountWithTraitAtLeast:Cyclops Team:4",
      then: [{ op: "spawnToken", def: TOKEN_AD_BALLOON, player: "controller", zone: "battleArea", rested: true, count: 2 }],
    },
    actions: [],
    sourceText:
      "【When Paired】If there are 4 or more (Cyclops Team) cards in your trash, deploy 2 rested [Ad Balloon]((Civilian)·AP0·HP1·This Unit can't be set as active or paired with a Pilot) Unit tokens.",
  },
  // GD03-035 (o 【Activate･Main】 de exilar do trash fica pra W2c)
  {
    id: "GD03-035-WhenLinked",
    cardCode: "GD03-035",
    trigger: "When Linked",
    actions: [{ op: "grantAttackTargetRelax", target: { kind: "self" }, apAtMostSelf: true }],
    sourceText:
      "【When Linked】During this turn, this Unit may choose an active enemy Unit with AP equal to or less than this Unit as its attack target.",
  },
  // GD03-041
  {
    id: "GD03-041-Deploy",
    cardCode: "GD03-041",
    trigger: "Deploy",
    actions: [{ op: "damageUnit", amount: 3, target: { kind: "group", group: { kind: "allBases" } } }],
    sourceText: "【Deploy】Deal 3 damage to all Bases.",
  },
  // GD03-049
  {
    id: "GD03-049-DestroyedShield",
    cardCode: "GD03-049",
    trigger: "Reaction:destroyedShieldInBattle",
    reaction: { event: "destroyedShieldInBattle", subject: "self" },
    condition: { predicate: "controllerTrashCardCountWithTraitAtLeast:CB:10", then: [{ op: "destroy", target }] },
    actions: [],
    targetScope: "enemyUnit",
    targetFilter: "lowestHp",
    sourceText:
      "When this Unit destroys an enemy shield area card with battle damage, if there are 10 or more (CB) cards in your trash, choose 1 enemy Unit with the lowest HP. Destroy it.",
  },
  // GD03-052
  {
    id: "GD03-052-BattleDamage",
    cardCode: "GD03-052",
    trigger: "Reaction:battleDamageToEnemyUnit",
    reaction: { event: "battleDamageToEnemyUnit", subject: "self" },
    condition: {
      predicate: "battleVictimInPlay;battleVictimLevelAtMost:5;controllerHasPilotWithTrait:CB",
      then: [{ op: "destroy", target: victim }],
    },
    actions: [],
    sourceText:
      "When this Unit deals battle damage to an enemy Unit that is Lv.5 or lower, if you have a (CB) Pilot in play, destroy that enemy Unit.",
  },
  // GD03-076
  {
    id: "GD03-076-BattleDamage",
    cardCode: "GD03-076",
    trigger: "Reaction:battleDamageToEnemyUnit",
    reaction: { event: "battleDamageToEnemyUnit", subject: "friendly", subjectFilter: "trait:Triple Ship Alliance", turn: "yours" },
    oncePerTurn: true,
    optional: true,
    condition: { predicate: "battleVictimInPlay", then: [{ op: "moveZone", target: victim, toZone: "hand" }] },
    actions: [],
    sourceText:
      "【Once per Turn】During your turn, when your (Triple Ship Alliance) Unit deals battle damage to an enemy Unit, you may return the enemy Unit to its owner's hand.",
  },
  // GD03-105
  {
    id: "GD03-105-Main",
    cardCode: "GD03-105",
    trigger: "Main",
    actions: [{ op: "grantAttackTargetRelax", target, unpairedOnly: true }],
    targetScope: "friendlyUnit",
    sourceText:
      "【Main】Choose 1 friendly Unit. During this turn, it may choose an active enemy Unit that has no Pilot paired with it as its attack target.",
  },
  // GD03-115 (o "instead" do Lv.7 é o `else` da condição)
  {
    id: "GD03-115-Action",
    cardCode: "GD03-115",
    trigger: "Action",
    condition: {
      predicate: "controllerLevelAtLeast:7",
      then: [{ op: "preventUnitBattleDamage", target, maxAttackerAp: 5 }],
      else: [{ op: "preventUnitBattleDamage", target, maxAttackerAp: 2 }],
    },
    actions: [],
    targetScope: "friendlyUnit",
    targetFilter: "pairedPilotTrait:X-Rounder",
    sourceText:
      "【Action】Choose 1 friendly Unit paired with an (X-Rounder) Pilot. It can't receive battle damage from enemy Units with 2 or less AP during this battle. If you are Lv.7 or higher, it can't receive battle damage from enemy Units with 5 or less AP instead.",
  },
  // GD03-125 (Base)
  {
    id: "GD03-125-DestroyedEnemy",
    cardCode: "GD03-125",
    trigger: "Reaction:destroyedEnemyInBattle",
    reaction: {
      event: "destroyedEnemyInBattle",
      subject: "friendly",
      subjectFilter: "anyTrait:Operation Meteor,G Team;level>=6",
      turn: "yours",
    },
    oncePerTurn: true,
    optional: true,
    condition: {
      predicate: "reactionSubjectInPlay",
      then: [{ op: "heal", target: { kind: "named", name: "reactionSubject" }, amount: 2 }],
    },
    actions: [],
    sourceText:
      "【Once per Turn】During your turn, when a friendly (Operation Meteor)/(G Team) Unit that is Lv.6 or higher destroys an enemy Unit with battle damage, that friendly Unit may recover 2 HP.",
  },
];
