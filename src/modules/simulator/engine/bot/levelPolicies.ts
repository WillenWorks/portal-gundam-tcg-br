import type { EffectSpec, PredicateResolver, TargetFilterResolver } from "../effectSpec";
import type { SelfPlayPolicy } from "../selfPlay";
import { randomLegal } from "../selfPlay";
import { heuristicPolicy } from "./heuristicPolicy";
import { mctsPolicy } from "./mctsPolicy";
import { turnPlannerPolicy } from "./turnPlanner";
import { zeroSystemPolicy, type ZeroSystemPersona } from "./zeroSystemPolicy";

/**
 * Fonte única da configuração de cada nível do bot (spec bot-avaliacao-forca):
 * o `driveBotTurn` (bot que o jogador enfrenta) e a escada de Elo montam a
 * policy por aqui, então a escada mede exatamente o bot do produto. `random` só
 * existe como âncora da escada (Elo 0). O modo neural do `normal` (dev, lê
 * arquivo) continua no `driveBotTurn`.
 */
export const BOT_LEVELS = ["random", "facil", "normal", "dificil", "zero_system"] as const;
/** níveis em avaliação na escada/banco — fora do produto até a medição decidir */
export const EXPERIMENTAL_LEVELS = ["normal_plan"] as const;
export type BotLevel = (typeof BOT_LEVELS)[number] | (typeof EXPERIMENTAL_LEVELS)[number];
/** todo nível aceito pelos scripts de medição */
export const MEASURABLE_LEVELS: readonly BotLevel[] = [...BOT_LEVELS, ...EXPERIMENTAL_LEVELS];

/** config do MCTS do nível difícil no produto */
export const DIFICIL_ROLLOUTS = 16;
export const DIFICIL_DEPTH_TURNS = 8;

export interface LevelPolicyOptions {
  specs: EffectSpec[];
  predicateResolver?: PredicateResolver;
  targetFilterResolver?: TargetFilterResolver;
  persona?: ZeroSystemPersona;
  /** sobrescreve os rollouts do difícil (a escada usa menos pra caber no tempo; o relatório registra) */
  mctsRollouts?: number;
}

export function policyForLevel(level: BotLevel, opts: LevelPolicyOptions): SelfPlayPolicy {
  // Lookahead de efeitos (spec bot-lookahead-efeitos) nos níveis que o bot real usa;
  // cada chamada cria uma instância nova (o contador de ativações é por instância).
  const lookahead = {
    specs: opts.specs,
    predicateResolver: opts.predicateResolver,
    targetFilterResolver: opts.targetFilterResolver,
  };
  switch (level) {
    case "random":
      return randomLegal;
    case "facil":
      return heuristicPolicy({ level: "facil" });
    case "normal":
      return heuristicPolicy({ level: "normal", lookahead });
    case "dificil":
      return mctsPolicy({
        rollouts: opts.mctsRollouts ?? DIFICIL_ROLLOUTS,
        depthTurns: DIFICIL_DEPTH_TURNS,
        specs: opts.specs,
        predicateResolver: opts.predicateResolver,
        targetFilterResolver: opts.targetFilterResolver,
        lookahead,
      });
    case "normal_plan":
      // spec bot-planejamento-turno: normal + planejador de turno na Main Phase
      return turnPlannerPolicy(heuristicPolicy({ level: "normal", lookahead }), lookahead);
    case "zero_system":
      return zeroSystemPolicy({ persona: opts.persona ?? "adaptive", lookahead });
    default:
      throw new Error(`policyForLevel: nível desconhecido "${String(level)}"`);
  }
}
