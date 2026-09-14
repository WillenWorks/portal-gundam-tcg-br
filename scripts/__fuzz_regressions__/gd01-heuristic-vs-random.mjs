/*
 * Fuzzing exploratório da wave GD01 — heurística vs aleatório (docs/debates
 * 2026-09-13, Etapa 1).
 *
 * O fuzz dedicado que validou os 4 decks de fixtures/gd01TestDecks.ts
 * (scripts/gundam-fuzz.mjs de forma geral, e a verificação ad-hoc da sessão
 * anterior) usava `heuristicPolicy` nos DOIS lados — determinística e
 * gulosa, então nunca joga uma ação subótima. A auditoria (Gemini) apontou
 * o risco: se existir um loop de gatilhos só disparável por uma jogada
 * "estranha" (não é o que a heurística escolheria), esse fuzz nunca acharia
 * — e um jogador de verdade poderia, em teoria, forçar esse loop de
 * propósito (empate via `trigger_loop_guard`) quando estivesse perdendo.
 *
 * Este script roda `heuristicPolicy` (normal) no Jogador A e `randomLegal`
 * (decisão uniforme entre as ações legais, incluindo as subótimas) no
 * Jogador B, contra todos os pares dos 4 decks GD01 — a mesma superfície,
 * mas com metade das jogadas fora do caminho "ótimo".
 *
 * Uso:
 *   node scripts/__fuzz_regressions__/gd01-heuristic-vs-random.mjs
 *   node scripts/__fuzz_regressions__/gd01-heuristic-vs-random.mjs --games=1000
 *   node scripts/__fuzz_regressions__/gd01-heuristic-vs-random.mjs --seed=99
 *
 * Achado (throw/crash/illegalState/unfinished) grava um JSON de regressão
 * NESTA MESMA pasta (`<pair>-seed<seed>.json`, com `{ pair, seed, actionLog }`)
 * — vira caso de teste determinístico de regressão, sem depender de
 * reler o log do console e reproduzir manualmente.
 */
import { register } from "tsx/esm/api";
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const unregister = register();

const ROOT = path.resolve(import.meta.dirname, "../..");
const OUT_DIR = path.resolve(import.meta.dirname);
const sim = (p) => pathToFileURL(path.join(ROOT, "src/modules/simulator", p)).href;

const { runSelfPlay, randomLegal } = await import(sim("engine/selfPlay.ts"));
const { GD01_TEST_DECKS } = await import(sim("fixtures/gd01TestDecks.ts"));
const { ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver } = await import(sim("content/index.ts"));
const { heuristicPolicy } = await import(sim("engine/bot/heuristicPolicy.ts"));

function parseArgs(argv) {
  const args = { games: 500, seed: 1, maxTurns: 200 };
  for (const a of argv) {
    const m = a.match(/^--([^=]+)=(.*)$/);
    if (!m) continue;
    const [, k, v] = m;
    if (k === "games") args.games = Number(v);
    else if (k === "seed") args.seed = Number(v);
    else if (k === "maxTurns") args.maxTurns = Number(v);
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const deckKeys = Object.keys(GD01_TEST_DECKS);
const pairs = [];
for (let i = 0; i < deckKeys.length; i++) {
  for (let j = i; j < deckKeys.length; j++) pairs.push([deckKeys[i], deckKeys[j]]);
}

const policyA = heuristicPolicy({ level: "normal" });
const policyB = randomLegal;

console.log(
  `[gd01-heuristic-vs-random] ${pairs.length} par(es) x ${args.games} partidas (seed base ${args.seed}, maxTurns ${args.maxTurns}, policy A=heuristic/B=random)`,
);

const findings = [];
let totalGames = 0;
let triggerLoopGuardHits = 0;
const started = Date.now();

for (const [a, b] of pairs) {
  let pairFindings = 0;
  for (let g = 0; g < args.games; g++) {
    const seed = args.seed + g;
    totalGames++;
    let result;
    try {
      result = runSelfPlay({
        deckA: GD01_TEST_DECKS[a].build(),
        deckB: GD01_TEST_DECKS[b].build(),
        seed,
        maxTurns: args.maxTurns,
        specs: ALL_EFFECT_SPECS,
        predicateResolver: defaultPredicateResolver,
        targetFilterResolver: defaultTargetFilterResolver,
        policyA,
        policyB,
      });
    } catch (err) {
      findings.push({ pair: `${a}x${b}`, seed, kind: "throw", detail: err?.stack ?? String(err) });
      pairFindings++;
      continue;
    }

    if (result.reason === "trigger_loop_guard") triggerLoopGuardHits++;

    if (result.crashed) {
      findings.push({ pair: `${a}x${b}`, seed, kind: "crash", detail: `turn ${result.crashed.turn} | ${result.crashed.error}`, stack: result.crashed.stack });
      pairFindings++;
    } else if (result.illegalState) {
      findings.push({ pair: `${a}x${b}`, seed, kind: "illegalState", detail: result.illegalState });
      pairFindings++;
    } else if (result.winner === null && result.reason !== "trigger_loop_guard") {
      findings.push({ pair: `${a}x${b}`, seed, kind: "unfinished", detail: `não terminou em ${args.maxTurns} turnos (${result.actionsPlayed} ações)` });
      pairFindings++;
    }
  }
  const tag = pairFindings === 0 ? "ok" : `${pairFindings} ACHADO(S)`;
  console.log(`[gd01-heuristic-vs-random]   ${a} x ${b}: ${tag}`);
}

const elapsed = ((Date.now() - started) / 1000).toFixed(1);
console.log(
  `[gd01-heuristic-vs-random] ${totalGames} partidas em ${elapsed}s | trigger_loop_guard acionado ${triggerLoopGuardHits}x`,
);

if (findings.length > 0) {
  console.error(`\n[gd01-heuristic-vs-random] ${findings.length} ACHADO(S) — gravando fixtures de regressão em ${OUT_DIR}:`);
  mkdirSync(OUT_DIR, { recursive: true });
  for (const f of findings) {
    const file = path.join(OUT_DIR, `${f.pair}-seed${f.seed}.json`);
    writeFileSync(file, `${JSON.stringify(f, null, 2)}\n`, "utf8");
    console.error(`  - [${f.kind}] ${f.pair} seed=${f.seed}: ${f.detail} (gravado em ${path.basename(file)})`);
  }
  unregister();
  process.exit(1);
}

console.log("[gd01-heuristic-vs-random] 0 achados — motor estável contra jogadas não-heurísticas/subótimas.");
unregister();
