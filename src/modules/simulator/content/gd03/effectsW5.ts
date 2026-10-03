import type { EffectSpec } from "../../engine/effectSpec";
import { mainAndAction } from "../standardSpecs";

/**
 * W5 — cláusulas do GD03 que estavam deferidas e o vocabulário da W5 destravou:
 * gatilho atrasado (`grantDelayedReaction`, GD03-120) e quantidade de alvos condicional (GD03-104, mesmo
 * padrão do GD04-106: o cliente escolhe até 2; sem a condição, só o 1º alvo vale).
 */

const target = { kind: "named", name: "target" } as const;

export const GD03_W5_EFFECT_SPECS: EffectSpec[] = [
  ...mainAndAction({
    cardCode: "GD03-104",
    condition: {
      predicate: "controllerLinkUnitWithTraitInPlay:Jupitris",
      then: [{ op: "rest", target: { kind: "namedGroup", name: "target" } }],
      else: [{ op: "rest", target }],
    },
    actions: [],
    targetScope: "enemyUnit",
    targetFilter: "hp<=3",
    targetCount: { min: 1, max: 2 },
    sourceText:
      "【Main】/【Action】Choose 1 enemy Unit with 3 or less HP. Rest it. If a friendly (Jupitris) Link Unit is in play, choose 1 to 2 enemy Units with 3 or less HP instead.",
  }),
  {
    id: "GD03-120-Main",
    cardCode: "GD03-120",
    trigger: "Main",
    actions: [{ op: "grantDelayedReaction", specId: "GD03-120-Delayed" }],
    sourceText:
      "【Main】During this turn, if a friendly (Superpower Bloc)/(UN) Unit destroys an enemy Unit with battle damage, choose 1 rested friendly (Superpower Bloc)/(UN) Unit. Set it as active. It can't attack during this turn.",
  },
  {
    // "if … destroys": dispara a cada destruição no turno (mesma leitura do "when" do GD04-002; sem ruling)
    id: "GD03-120-Delayed",
    cardCode: "GD03-120",
    trigger: "Delayed:destroyedEnemyInBattle",
    reaction: { event: "destroyedEnemyInBattle", subject: "friendly", subjectFilter: "anyTrait:Superpower Bloc,UN" },
    actions: [
      { op: "setActive", target },
      { op: "preventAttackThisTurn", target },
    ],
    targetScope: "friendlyUnit",
    targetFilter: "anyTrait:Superpower Bloc,UN;rested",
    sourceText:
      "【Main】During this turn, if a friendly (Superpower Bloc)/(UN) Unit destroys an enemy Unit with battle damage, choose 1 rested friendly (Superpower Bloc)/(UN) Unit. Set it as active. It can't attack during this turn.",
  },
];
