import { createRng } from "../rng";
import type { EffectSpec, PredicateResolver, TargetFilterResolver } from "../effectSpec";
import type { SelfPlayPolicy } from "../selfPlay";
import { runSelfPlay } from "../selfPlay";
import type { BenchmarkDeck } from "../../fixtures/benchmarkDeckPools";
import { policyForLevel, type BotLevel } from "./levelPolicies";

/**
 * Escada de Elo do bot (spec bot-avaliacao-forca). Parte estatística pura:
 * Bradley–Terry (algoritmo MM) sobre os resultados, escala Elo (400·log10),
 * âncora fixa em 0 (o nível `random`), intervalo por bootstrap e Wilson pra taxa
 * de vitória entre degraus vizinhos. A parte que joga as partidas fica em
 * `runLadder` (abaixo).
 */

export interface GameRecord {
  a: string;
  b: string;
  /** pontos de `a`: 1 vitória, 0 derrota, 0.5 empate (sem vencedor) */
  score: 1 | 0 | 0.5;
}

/** meia-vitória virtual por lado em cada par jogado — mantém finito o Elo de quem nunca vence/perde */
const PSEUDO_SCORE = 0.5;
const MM_ITERATIONS = 500;
const MM_TOLERANCE = 1e-10;
const ELO_SCALE = 400;
/** z de 95% */
const Z_95 = 1.959964;

function pairKey(x: string, y: string): string {
  return x < y ? `${x}\u0000${y}` : `${y}\u0000${x}`;
}

export function bradleyTerryElo(records: GameRecord[], anchor: string): Record<string, number> {
  const players = [...new Set(records.flatMap((r) => [r.a, r.b]))];
  const wins = new Map<string, number>(players.map((p) => [p, 0]));
  const games = new Map<string, number>();
  for (const r of records) {
    wins.set(r.a, (wins.get(r.a) ?? 0) + r.score);
    wins.set(r.b, (wins.get(r.b) ?? 0) + (1 - r.score));
    games.set(pairKey(r.a, r.b), (games.get(pairKey(r.a, r.b)) ?? 0) + 1);
  }
  for (const key of games.keys()) {
    const [x, y] = key.split("\u0000");
    wins.set(x, (wins.get(x) ?? 0) + PSEUDO_SCORE);
    wins.set(y, (wins.get(y) ?? 0) + PSEUDO_SCORE);
    games.set(key, (games.get(key) ?? 0) + 2 * PSEUDO_SCORE);
  }

  let strength = new Map<string, number>(players.map((p) => [p, 1]));
  for (let iter = 0; iter < MM_ITERATIONS; iter++) {
    const next = new Map<string, number>();
    for (const p of players) {
      let denom = 0;
      for (const q of players) {
        if (q === p) continue;
        const n = games.get(pairKey(p, q)) ?? 0;
        if (n > 0) denom += n / ((strength.get(p) ?? 1) + (strength.get(q) ?? 1));
      }
      next.set(p, denom > 0 ? (wins.get(p) ?? 0) / denom : strength.get(p) ?? 1);
    }
    const delta = Math.max(...players.map((p) => Math.abs((next.get(p) ?? 1) - (strength.get(p) ?? 1))));
    strength = next;
    if (delta < MM_TOLERANCE) break;
  }

  const anchorStrength = strength.get(anchor);
  if (anchorStrength === undefined) throw new Error(`bradleyTerryElo: âncora "${anchor}" não jogou nenhuma partida`);
  return Object.fromEntries(players.map((p) => [p, ELO_SCALE * Math.log10((strength.get(p) ?? 1) / anchorStrength)]));
}

export interface Interval {
  low: number;
  high: number;
}

export function bootstrapEloIntervals(
  records: GameRecord[],
  anchor: string,
  opts: { samples: number; seed: number },
): Record<string, Interval> {
  const rng = createRng(opts.seed);
  const draws = new Map<string, number[]>();
  for (let s = 0; s < opts.samples; s++) {
    const resample = records.map(() => records[Math.floor(rng() * records.length)]);
    const elo = bradleyTerryElo(resample, anchor);
    for (const [p, v] of Object.entries(elo)) draws.set(p, [...(draws.get(p) ?? []), v]);
  }
  const out: Record<string, Interval> = {};
  for (const [p, values] of draws) {
    const sorted = [...values].sort((x, y) => x - y);
    out[p] = { low: sorted[Math.floor(sorted.length * 0.025)], high: sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.975))] };
  }
  return out;
}

/** intervalo de Wilson (95%) pra `successes` em `trials` — `trials = 0` → [0, 1] */
export function wilsonInterval(successes: number, trials: number): Interval {
  if (trials === 0) return { low: 0, high: 1 };
  const p = successes / trials;
  const z2 = Z_95 * Z_95;
  const center = (p + z2 / (2 * trials)) / (1 + z2 / trials);
  const margin = (Z_95 * Math.sqrt((p * (1 - p)) / trials + z2 / (4 * trials * trials))) / (1 + z2 / trials);
  return { low: center - margin, high: center + margin };
}

// ---------------------------------------------------------------------------
// Round-robin
// ---------------------------------------------------------------------------

/** amostras do bootstrap no relatório — 200 dá CI estável sem pesar no tempo */
const BOOTSTRAP_SAMPLES = 200;

export interface LadderOptions {
  /** do mais fraco pro mais forte — os "degraus" são pares vizinhos nesta ordem; o 1º é a âncora (Elo 0) */
  levels: string[];
  decks: BenchmarkDeck[];
  /** partidas por PAR de níveis (ciclando pelos pares de decks, alternando assento) */
  gamesPerLevelPair: number;
  maxTurns: number;
  seed: number;
  specs: EffectSpec[];
  predicateResolver?: PredicateResolver;
  targetFilterResolver?: TargetFilterResolver;
  mctsRollouts?: number;
  /** default `policyForLevel` — injetável em teste */
  policyFactory?: (level: string) => SelfPlayPolicy;
  onGame?: (game: LadderGame) => void;
}

export interface LadderGame {
  levelA: string;
  levelB: string;
  deckA: string;
  deckB: string;
  seed: number;
  /** vencedor em nível (`null` = sem vencedor → empate); ausente se excluída */
  winnerLevel?: string | null;
  turns?: number;
  error?: string;
}

export interface NeighborRate {
  lower: string;
  upper: string;
  /** pontos do nível de cima (vitória 1, empate 0.5) */
  upperScore: number;
  games: number;
  rate: number;
  wilson: Interval;
}

export interface LadderResult {
  games: LadderGame[];
  records: GameRecord[];
  excluded: LadderGame[];
  elo: Record<string, number>;
  ci: Record<string, Interval>;
  neighborRates: NeighborRate[];
  /** cada nível contra a âncora (random) — meta "qualquer nível ≥ 95% sobre random" */
  vsAnchor: NeighborRate[];
}

/** confronto direto: pontos do `upper` contra o `lower` (vitória 1, empate 0.5) */
export function headToHead(records: GameRecord[], lower: string, upper: string): NeighborRate {
  const between = records.filter((r) => (r.a === lower && r.b === upper) || (r.a === upper && r.b === lower));
  const upperScore = between.reduce((sum, r) => sum + (r.a === upper ? r.score : 1 - r.score), 0);
  return {
    lower,
    upper,
    upperScore,
    games: between.length,
    rate: between.length ? upperScore / between.length : 0,
    wilson: wilsonInterval(upperScore, between.length),
  };
}

/** todos os pares de decks (i ≤ j, espelho incluso) — a escada cicla por eles */
function deckPairs(decks: BenchmarkDeck[]): Array<[BenchmarkDeck, BenchmarkDeck]> {
  const pairs: Array<[BenchmarkDeck, BenchmarkDeck]> = [];
  for (let i = 0; i < decks.length; i++) for (let j = i; j < decks.length; j++) pairs.push([decks[i], decks[j]]);
  return pairs;
}

export function runLadder(opts: LadderOptions): LadderResult {
  const factory =
    opts.policyFactory ??
    ((level: string) =>
      policyForLevel(level as BotLevel, {
        specs: opts.specs,
        predicateResolver: opts.predicateResolver,
        targetFilterResolver: opts.targetFilterResolver,
        mctsRollouts: opts.mctsRollouts,
      }));
  const pairs = deckPairs(opts.decks);
  const games: LadderGame[] = [];
  const records: GameRecord[] = [];
  const excluded: LadderGame[] = [];
  let gameIndex = 0;

  for (let i = 0; i < opts.levels.length; i++) {
    for (let j = i + 1; j < opts.levels.length; j++) {
      for (let g = 0; g < opts.gamesPerLevelPair; g++) {
        // cada par de decks sai 2× seguidas com os níveis trocados (deck E assento) — um
        // nível nunca fica só com o deck bom ou só começando
        const [deck1, deck2] = pairs[Math.floor(g / 2) % pairs.length];
        const swap = g % 2 === 1;
        const levelA = swap ? opts.levels[j] : opts.levels[i];
        const levelB = swap ? opts.levels[i] : opts.levels[j];
        const seed = opts.seed * 100_003 + gameIndex++;
        const game: LadderGame = { levelA, levelB, deckA: deck1.id, deckB: deck2.id, seed };
        try {
          const result = runSelfPlay({
            deckA: deck1.build(),
            deckB: deck2.build(),
            seed,
            maxTurns: opts.maxTurns,
            // instância nova por partida: lookahead/MCTS guardam estado por instância
            policyA: factory(levelA),
            policyB: factory(levelB),
            specs: opts.specs,
            predicateResolver: opts.predicateResolver,
            targetFilterResolver: opts.targetFilterResolver,
          });
          if (result.crashed || result.illegalState) {
            game.error = result.crashed?.error ?? result.illegalState;
          } else {
            game.turns = result.turns;
            game.winnerLevel = result.winner === "A" ? levelA : result.winner === "B" ? levelB : null;
          }
        } catch (err) {
          game.error = err instanceof Error ? err.message : String(err);
        }
        games.push(game);
        if (game.error !== undefined) {
          excluded.push(game);
        } else {
          records.push({ a: levelA, b: levelB, score: game.winnerLevel === levelA ? 1 : game.winnerLevel === levelB ? 0 : 0.5 });
        }
        opts.onGame?.(game);
      }
    }
  }

  const anchor = opts.levels[0];
  const hasAnchor = records.some((r) => r.a === anchor || r.b === anchor);
  const elo = hasAnchor ? bradleyTerryElo(records, anchor) : {};
  const ci = hasAnchor ? bootstrapEloIntervals(records, anchor, { samples: BOOTSTRAP_SAMPLES, seed: opts.seed }) : {};

  const neighborRates: NeighborRate[] = [];
  for (let k = 0; k + 1 < opts.levels.length; k++) {
    neighborRates.push(headToHead(records, opts.levels[k], opts.levels[k + 1]));
  }
  const vsAnchor = opts.levels.slice(1).map((level) => headToHead(records, anchor, level));

  return { games, records, excluded, elo, ci, neighborRates, vsAnchor };
}
