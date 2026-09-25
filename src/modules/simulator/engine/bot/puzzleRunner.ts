import type { EffectSpec, PredicateResolver, TargetFilterResolver } from "../effectSpec";
import { actionOwner, enumerateLegalActions, type LegalAction } from "../legalActions";
import { createRng } from "../rng";
import type { SelfPlayPolicy } from "../selfPlay";
import { viewStateFor } from "../viewState";
import type { Puzzle } from "./puzzles/types";

/**
 * Runner do banco de situações (spec bot-avaliacao-forca). Classifica cada
 * resposta: `acerto`, `erro` (com a ação escolhida pro diagnóstico) ou `quebrada`
 * — nenhuma jogada aceita é legal no estado montado, ou a vez não é do assento:
 * o motor mudou e a situação precisa de manutenção, não é erro do bot.
 */

export interface PuzzleRunOptions {
  specs: EffectSpec[];
  predicateResolver?: PredicateResolver;
  targetFilterResolver?: TargetFilterResolver;
  /** seed do desempate da policy — fixo pra resultado reprodutível */
  seed?: number;
}

export type PuzzleStatus = "acerto" | "erro" | "quebrada";

export interface PuzzleResult {
  id: string;
  title: string;
  category: Puzzle["category"];
  status: PuzzleStatus;
  chosen?: LegalAction;
  acceptedDescriptions: string[];
  why: string;
  /** motivo da quebra, quando `quebrada` */
  brokenReason?: string;
  /** fração das jogadas legais que são aceitas — a chance de acertar escolhendo ao acaso */
  acceptedShare?: number;
}

const DEFAULT_SEED = 1;

export function runPuzzle(puzzle: Puzzle, policy: SelfPlayPolicy, opts: PuzzleRunOptions): PuzzleResult {
  const base = {
    id: puzzle.id,
    title: puzzle.title,
    category: puzzle.category,
    acceptedDescriptions: puzzle.accepted.map((m) => m.describe),
    why: puzzle.why,
  };
  const { state, seat, refs } = puzzle.build();
  if (actionOwner(state) !== seat) {
    return { ...base, status: "quebrada", brokenReason: `a vez é de ${actionOwner(state) ?? "ninguém"}, não de ${seat}` };
  }
  const legal = enumerateLegalActions(state, seat, opts.specs, {
    predicateResolver: opts.predicateResolver,
    targetFilterResolver: opts.targetFilterResolver,
  });
  const matches = (a: LegalAction) => puzzle.accepted.some((m) => m.match(a, refs));
  if (!legal.some(matches)) {
    return { ...base, status: "quebrada", brokenReason: "nenhuma jogada aceita é legal no estado montado" };
  }
  const acceptedShare = legal.filter(matches).length / legal.length;
  const chosen = policy(viewStateFor(state, seat), legal, createRng(opts.seed ?? DEFAULT_SEED));
  return { ...base, status: matches(chosen) ? "acerto" : "erro", chosen, acceptedShare };
}

export interface PuzzleLevelSummary {
  correct: number;
  /** situações válidas (sem as quebradas) — denominador da taxa */
  valid: number;
  broken: number;
  rate: number;
  /** taxa esperada escolhendo ao acaso (média de `acceptedShare`) — o nível só mede algo acima disto */
  chanceRate: number;
  results: PuzzleResult[];
}

/** roda o banco pra cada nível; `policies[level]()` cria uma instância nova por situação */
export function runPuzzleSuite(
  puzzles: Puzzle[],
  policies: Record<string, () => SelfPlayPolicy>,
  opts: PuzzleRunOptions,
): Record<string, PuzzleLevelSummary> {
  const out: Record<string, PuzzleLevelSummary> = {};
  for (const [level, make] of Object.entries(policies)) {
    const results = puzzles.map((p) => runPuzzle(p, make(), opts));
    const valid = results.filter((r) => r.status !== "quebrada").length;
    const correct = results.filter((r) => r.status === "acerto").length;
    const shares = results.filter((r) => r.status !== "quebrada").map((r) => r.acceptedShare ?? 0);
    const chanceRate = shares.length ? shares.reduce((x, y) => x + y, 0) / shares.length : 0;
    out[level] = { correct, valid, broken: results.length - valid, rate: valid ? correct / valid : 0, chanceRate, results };
  }
  return out;
}
