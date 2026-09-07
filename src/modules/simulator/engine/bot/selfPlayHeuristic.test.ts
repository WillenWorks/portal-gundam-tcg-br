import { describe, expect, it } from "vitest";
import { randomLegal, runSelfPlay } from "../selfPlay";
import {
  ALL_EFFECT_SPECS,
  defaultPredicateResolver,
  defaultTargetFilterResolver,
  validatedDeckList,
} from "../../content/index";
import { heuristicPolicy } from "./heuristicPolicy";

function envGames(): number {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  const raw = env?.HEURISTIC_SELFPLAY_GAMES;
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 40;
}

const GAMES = envGames();
const MAX_TURNS = 40;

const specs = {
  specs: ALL_EFFECT_SPECS,
  predicateResolver: defaultPredicateResolver,
  targetFilterResolver: defaultTargetFilterResolver,
};

const decks = validatedDeckList();
const pairs: Array<[string, string]> = [];
for (let i = 0; i < decks.length; i++) {
  for (let j = i; j < decks.length; j++) pairs.push([decks[i].id, decks[j].id]);
}

interface Tally {
  games: number;
  turnsTotal: number;
  wins: { A: number; B: number; none: number };
}

function run(
  deckAId: string,
  deckBId: string,
  policyA: ReturnType<typeof heuristicPolicy> | typeof randomLegal,
  policyB: ReturnType<typeof heuristicPolicy> | typeof randomLegal,
): Tally {
  const buildA = decks.find((d) => d.id === deckAId)!.build;
  const buildB = decks.find((d) => d.id === deckBId)!.build;
  const tally: Tally = { games: 0, turnsTotal: 0, wins: { A: 0, B: 0, none: 0 } };
  for (let g = 0; g < GAMES; g++) {
    const result = runSelfPlay({
      deckA: buildA(),
      deckB: buildB(),
      seed: 1000 + g,
      maxTurns: MAX_TURNS,
      policyA,
      policyB,
      ...specs,
    });
    expect(result.crashed, `crash ${deckAId}x${deckBId} seed ${1000 + g}: ${result.crashed?.error}`).toBeUndefined();
    expect(
      result.illegalState,
      `estado ilegal ${deckAId}x${deckBId} seed ${1000 + g}: ${result.illegalState}`,
    ).toBeUndefined();
    expect(result.turns, `não terminou em ${MAX_TURNS} turnos (${deckAId}x${deckBId} seed ${1000 + g})`).toBeLessThan(
      MAX_TURNS,
    );
    tally.games++;
    tally.turnsTotal += result.turns;
    if (result.winner === "A") tally.wins.A++;
    else if (result.winner === "B") tally.wins.B++;
    else tally.wins.none++;
  }
  return tally;
}

describe("self-play do bot heurístico (decks validados)", () => {
  const normal = heuristicPolicy({ level: "normal" });

  it(
    "heurístico vs heurístico: 0 crash, 0 estado ilegal, todas terminam < 40 turnos",
    () => {
      let turns = 0;
      let games = 0;
      for (const [a, b] of pairs) {
        const t = run(a, b, normal, normal);
        turns += t.turnsTotal;
        games += t.games;
      }
      console.log(`[selfplay] heurístico vs heurístico: ${games} partidas, média ${(turns / games).toFixed(1)} turnos`);
    },
    120_000,
  );

  it(
    "heurístico vs random: heurístico vence claramente > 50%",
    () => {
      let heuristicWins = 0;
      let decisive = 0;
      let turns = 0;
      let games = 0;
      for (const [a, b] of pairs) {
        // heurístico como A
        const asA = run(a, b, normal, randomLegal);
        heuristicWins += asA.wins.A;
        decisive += asA.wins.A + asA.wins.B;
        // heurístico como B
        const asB = run(a, b, randomLegal, normal);
        heuristicWins += asB.wins.B;
        decisive += asB.wins.A + asB.wins.B;
        turns += asA.turnsTotal + asB.turnsTotal;
        games += asA.games + asB.games;
      }
      const rate = heuristicWins / decisive;
      console.log(
        `[selfplay] heurístico vs random: ${games} partidas, winrate heurístico ${(rate * 100).toFixed(1)}% ` +
          `(${heuristicWins}/${decisive} decididas), média ${(turns / games).toFixed(1)} turnos`,
      );
      expect(rate).toBeGreaterThan(0.5);
    },
    180_000,
  );
});
