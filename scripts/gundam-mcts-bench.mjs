/*
 * Benchmark do bot MCTS (docs/44, Fase 5 — §7.2, Lane 4A).
 *
 * Roda MCTS vs heurística `normal` nos pares de decks validados (MCTS joga
 * metade das partidas como A, metade como B) e reporta:
 *   - winrate do MCTS sobre as partidas DECIDIDAS (empate/timeout não conta);
 *   - tempo médio e de pico por decisão do MCTS.
 *
 * Gate da lane: winrate >= 60%, tempo por decisão < ~2s num deck ST.
 *
 * Uso:
 *   node scripts/gundam-mcts-bench.mjs                       # 100 partidas, rollouts 24
 *   node scripts/gundam-mcts-bench.mjs --games=48 --rollouts=16
 *   node scripts/gundam-mcts-bench.mjs --maxTurns=40 --depthTurns=12
 */

import { register } from "tsx/esm/api";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const unregister = register();

const ROOT = path.resolve(import.meta.dirname, "..");
const sim = (p) => pathToFileURL(path.join(ROOT, "src/modules/simulator", p)).href;

const { runSelfPlay } = await import(sim("engine/selfPlay.ts"));
const { heuristicPolicy } = await import(sim("engine/bot/heuristicPolicy.ts"));
const { mctsPolicy } = await import(sim("engine/bot/mctsPolicy.ts"));
const { ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver, validatedDeckList } = await import(
  sim("content/index.ts")
);

function parseArgs(argv) {
  const args = { games: 100, rollouts: 24, maxTurns: 40, depthTurns: 12, seed: 5000 };
  for (const a of argv) {
    const m = a.match(/^--([^=]+)=(.*)$/);
    if (!m) continue;
    const [, k, v] = m;
    if (k in args) args[k] = Number(v);
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const PROGRESS_FILE = path.join(ROOT, ".mcts-bench-progress.log");
function log(line) {
  console.log(line);
  try {
    fs.appendFileSync(PROGRESS_FILE, `${line}\n`);
  } catch {
    /* progresso é best-effort */
  }
}
try {
  fs.writeFileSync(PROGRESS_FILE, "");
} catch {
  /* ok */
}
const specs = {
  specs: ALL_EFFECT_SPECS,
  predicateResolver: defaultPredicateResolver,
  targetFilterResolver: defaultTargetFilterResolver,
};

const decks = validatedDeckList();
const build = (id) => decks.find((d) => d.id === id).build;

const pairs = [
  ["ST01", "ST02"],
  ["ST03", "ST04"],
  ["ST01", "ST03"],
  ["ST02", "ST04"],
  ["ST01", "ST04"],
];
const configs = [];
for (const [d1, d2] of pairs) {
  configs.push([d1, d2, "A"], [d2, d1, "B"]);
}
const perConfig = Math.max(1, Math.round(args.games / configs.length));

log(
  `[mcts-bench] ${configs.length} configs x ${perConfig} partidas | rollouts ${args.rollouts}, depthTurns ${args.depthTurns}, maxTurns ${args.maxTurns}`,
);

const normal = heuristicPolicy({ level: "normal" });
let mctsWins = 0;
let decisive = 0;
let total = 0;
let decisionCount = 0;
let decisionMsTotal = 0;
let decisionMsPeak = 0;
const started = Date.now();

for (const [deckA, deckB, mctsSeat] of configs) {
  for (let g = 0; g < perConfig; g++) {
    const base = mctsPolicy({ rollouts: args.rollouts, depthTurns: args.depthTurns, ...specs });
    const timed = (view, legal, rng) => {
      const t0 = Date.now();
      const out = base(view, legal, rng);
      const dt = Date.now() - t0;
      decisionMsTotal += dt;
      decisionCount += 1;
      if (dt > decisionMsPeak) decisionMsPeak = dt;
      return out;
    };
    const result = runSelfPlay({
      deckA: build(deckA)(),
      deckB: build(deckB)(),
      seed: args.seed + g,
      maxTurns: args.maxTurns,
      policyA: mctsSeat === "A" ? timed : normal,
      policyB: mctsSeat === "B" ? timed : normal,
      ...specs,
    });
    total += 1;
    if (result.crashed) {
      log(`[mcts-bench] CRASH ${deckA}x${deckB} seed ${args.seed + g}: ${result.crashed.error}`);
      log(result.crashed.stack?.split("\n").slice(0, 6).join("\n"));
      unregister();
      process.exit(1);
    }
    if (result.illegalState) {
      log(`[mcts-bench] ESTADO ILEGAL ${deckA}x${deckB} seed ${args.seed + g}: ${result.illegalState}`);
      unregister();
      process.exit(1);
    }
    if (result.winner === mctsSeat) {
      mctsWins += 1;
      decisive += 1;
    } else if (result.winner !== null) {
      decisive += 1;
    }
  }
  const partial = decisive === 0 ? 0 : (mctsWins / decisive) * 100;
  log(
    `[mcts-bench]   ${deckA} x ${deckB} (MCTS=${mctsSeat}): parcial ${mctsWins}/${decisive} decididas (${partial.toFixed(0)}%) | ${((Date.now() - started) / 1000).toFixed(0)}s`,
  );
}

const elapsed = ((Date.now() - started) / 1000).toFixed(1);
const rate = decisive === 0 ? 0 : mctsWins / decisive;
const avgMs = decisionCount === 0 ? 0 : decisionMsTotal / decisionCount;
log(
  `[mcts-bench] ${total} partidas em ${elapsed}s | winrate MCTS ${(rate * 100).toFixed(1)}% ` +
    `(${mctsWins}/${decisive} decididas, ${total - decisive} empate/timeout)`,
);
log(
  `[mcts-bench] decisões MCTS: ${decisionCount} | média ${avgMs.toFixed(0)} ms | pico ${decisionMsPeak} ms`,
);

unregister();
if (rate < 0.6) {
  log(`[mcts-bench] GATE FALHOU: winrate ${(rate * 100).toFixed(1)}% < 60%`);
  process.exit(1);
}
if (decisionMsPeak >= 2000) {
  log(`[mcts-bench] GATE FALHOU: pico ${decisionMsPeak} ms >= 2000 ms`);
  process.exit(1);
}
log("[mcts-bench] GATE OK");
