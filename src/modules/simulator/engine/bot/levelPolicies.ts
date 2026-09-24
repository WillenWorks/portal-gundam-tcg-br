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
/**
 * Níveis em avaliação na escada/banco — fora do produto. `*_v1` = configuração do
 * produto antes do planejador de turno (2026-09-24), mantida pra comparação.
 */
export const EXPERIMENTAL_LEVELS = ["normal_v1", "dificil_v1", "zero_mcts", "dificil_32"] as const;
export type BotLevel = (typeof BOT_LEVELS)[number] | (typeof EXPERIMENTAL_LEVELS)[number];
/** todo nível aceito pelos scripts de medição */
export const MEASURABLE_LEVELS: readonly BotLevel[] = [...BOT_LEVELS, ...EXPERIMENTAL_LEVELS];

/** config do MCTS do nível difícil no produto */
export const DIFICIL_ROLLOUTS = 16;
export const DIFICIL_DEPTH_TURNS = 8;
/**
 * Teto por decisão do difícil (âncora + rollouts). Cabe no "tempo de pensar" de
 * 1–2s do bot: o `driveBotTurn` desconta o tempo de cálculo da espera.
 */
export const DIFICIL_BUDGET_MS = 1500;
/** parte do orçamento do difícil que o planejador (âncora) pode usar */
export const DIFICIL_PLAN_BUDGET_MS = 500;

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
  const mcts = {
    rollouts: opts.mctsRollouts ?? DIFICIL_ROLLOUTS,
    depthTurns: DIFICIL_DEPTH_TURNS,
    specs: opts.specs,
    predicateResolver: opts.predicateResolver,
    targetFilterResolver: opts.targetFilterResolver,
  };
  // spec bot-planejamento-turno: heurística normal + planejador de turno na Main Phase
  const planner = (budgetMs?: number) => turnPlannerPolicy(heuristicPolicy({ level: "normal", lookahead }), { ...lookahead, budgetMs });
  switch (level) {
    case "random":
      return randomLegal;
    case "facil":
      return heuristicPolicy({ level: "facil" });
    case "normal":
      return planner();
    case "dificil":
      // MCTS ancorado no planejador (docs/bot/README.md: ~+310 Elo sobre o normal v1)
      return mctsPolicy({ ...mcts, anchor: planner(DIFICIL_PLAN_BUDGET_MS), budgetMs: DIFICIL_BUDGET_MS });
    case "zero_system":
      return zeroSystemPolicy({ persona: opts.persona ?? "adaptive", lookahead });
    case "normal_v1":
      return heuristicPolicy({ level: "normal", lookahead });
    case "dificil_v1":
      return mctsPolicy({ ...mcts, lookahead });
    case "zero_mcts":
      // MCTS ancorado nas personas do zero_system (empatou com o normal — ver README)
      return mctsPolicy({ ...mcts, anchor: zeroSystemPolicy({ persona: opts.persona ?? "adaptive", lookahead }) });
    case "dificil_32":
      // candidato ao zero_system: o difícil com o dobro de busca e de orçamento
      return mctsPolicy({
        ...mcts,
        rollouts: 2 * (opts.mctsRollouts ?? DIFICIL_ROLLOUTS),
        anchor: planner(DIFICIL_PLAN_BUDGET_MS),
        budgetMs: 2 * DIFICIL_BUDGET_MS,
      });
    default:
      throw new Error(`policyForLevel: nível desconhecido "${String(level)}"`);
  }
}
