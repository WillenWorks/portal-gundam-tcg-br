/**
 * Joga partidas planejadas (`engine/bot/matchupPlan.ts`) — usado em série pelo
 * script e dentro de cada worker. `poolSpec` = nome de pool ou caminho de arquivo.
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const sim = (p) => pathToFileURL(path.join(ROOT, "src/modules/simulator", p)).href;

const { ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver } = await import(sim("content/index.ts"));
const { deckPool, poolFromFile, BENCHMARK_POOLS } = await import(sim("fixtures/benchmarkDeckPools.ts"));
const { runSelfPlay } = await import(sim("engine/selfPlay.ts"));
const { policyForLevel } = await import(sim("engine/bot/levelPolicies.ts"));

export const opts = { specs: ALL_EFFECT_SPECS, predicateResolver: defaultPredicateResolver, targetFilterResolver: defaultTargetFilterResolver };

export function resolvePool(poolSpec) {
  if (BENCHMARK_POOLS.includes(poolSpec)) return deckPool(poolSpec);
  const file = path.resolve(ROOT, poolSpec);
  if (!fs.existsSync(file)) throw new Error(`pool "${poolSpec}" não é um pool conhecido (${BENCHMARK_POOLS.join(", ")}) nem um arquivo`);
  return poolFromFile(JSON.parse(fs.readFileSync(file, "utf8")));
}

export function runPlannedGames({ poolSpec, level, maxTurns, games }, onResult) {
  const decks = resolvePool(poolSpec);
  for (const g of games) {
    const result = runSelfPlay({
      deckA: decks[g.a].build(),
      deckB: decks[g.b].build(),
      seed: g.seed,
      maxTurns,
      // sem tetos de tempo: resultado igual em série ou em paralelo, sob qualquer carga
      policyA: policyForLevel(level, { ...opts, timeBudgets: false }),
      policyB: policyForLevel(level, { ...opts, timeBudgets: false }),
      ...opts,
    });
    if (result.crashed || result.illegalState) {
      onResult({ index: g.index, a: g.a, b: g.b, seed: g.seed, error: result.crashed?.error ?? result.illegalState });
    } else {
      onResult({ index: g.index, a: g.a, b: g.b, scoreA: result.winner === "A" ? 1 : result.winner === "B" ? 0 : 0.5 });
    }
  }
}
