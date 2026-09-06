/*
 * Fuzzing de regressão do motor do simulador (docs/44, Fase 1 — §3.4).
 *
 * Roda N partidas `randomLegal` vs `randomLegal` por par de decks e falha
 * (exit != 0) se alguma achar:
 *   - crash (exceção do motor, ao aplicar ou ao enumerar);
 *   - estado ilegal (invariante violada, ninguém pode agir, decisão travada);
 *   - partida que não termina em `maxTurns`.
 *
 * Uso:
 *   node scripts/gundam-fuzz.mjs                  # 200 partidas por par, todos os pares ST01-04
 *   node scripts/gundam-fuzz.mjs --games=100
 *   node scripts/gundam-fuzz.mjs --decks=ST01,ST03   # só esse par
 *   node scripts/gundam-fuzz.mjs --seed=123          # seed base (default 1)
 *   node scripts/gundam-fuzz.mjs --maxTurns=200
 *
 * Reprodução de um achado: o log imprime `par + seed + ação` — rode
 * `node scripts/gundam-fuzz.mjs --decks=<par> --games=1 --seed=<seed>`.
 */

import { register } from "tsx/esm/api";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const unregister = register();

const ROOT = path.resolve(import.meta.dirname, "..");
const sim = (p) => pathToFileURL(path.join(ROOT, "src/modules/simulator", p)).href;

const { runSelfPlay } = await import(sim("engine/selfPlay.ts"));
const { buildSt01DeckList } = await import(sim("fixtures/st01Deck.ts"));
const { buildSt02DeckList } = await import(sim("fixtures/st02Deck.ts"));
const { buildSt03DeckList } = await import(sim("fixtures/st03Deck.ts"));
const { buildSt04DeckList } = await import(sim("fixtures/st04Deck.ts"));
const { ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver } = await import(sim("content/index.ts"));

const DECKS = {
  ST01: buildSt01DeckList,
  ST02: buildSt02DeckList,
  ST03: buildSt03DeckList,
  ST04: buildSt04DeckList,
};

function parseArgs(argv) {
  const args = { games: 200, seed: 1, maxTurns: 200, decks: null };
  for (const a of argv) {
    const m = a.match(/^--([^=]+)=(.*)$/);
    if (!m) continue;
    const [, k, v] = m;
    if (k === "games") args.games = Number(v);
    else if (k === "seed") args.seed = Number(v);
    else if (k === "maxTurns") args.maxTurns = Number(v);
    else if (k === "decks") args.decks = v.split(",").map((s) => s.trim().toUpperCase());
  }
  return args;
}

function allPairs(keys) {
  const out = [];
  for (let i = 0; i < keys.length; i++) {
    for (let j = i; j < keys.length; j++) out.push([keys[i], keys[j]]);
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const deckKeys = Object.keys(DECKS);

let pairs;
if (args.decks) {
  const [a, b = a] = args.decks;
  if (!DECKS[a] || !DECKS[b]) {
    console.error(`Deck desconhecido em --decks=${args.decks.join(",")}. Válidos: ${deckKeys.join(", ")}`);
    process.exit(2);
  }
  pairs = [[a, b]];
} else {
  pairs = allPairs(deckKeys);
}

console.log(
  `[gundam:fuzz] ${pairs.length} par(es) x ${args.games} partidas (seed base ${args.seed}, maxTurns ${args.maxTurns})`,
);

const findings = [];
let totalGames = 0;
let wins = { A: 0, B: 0, none: 0 };
let totalTurns = 0;
const started = Date.now();

for (const [a, b] of pairs) {
  let pairFindings = 0;
  for (let g = 0; g < args.games; g++) {
    const seed = args.seed + g;
    totalGames++;
    let result;
    try {
      result = runSelfPlay({
        deckA: DECKS[a](),
        deckB: DECKS[b](),
        seed,
        maxTurns: args.maxTurns,
        specs: ALL_EFFECT_SPECS,
        predicateResolver: defaultPredicateResolver,
        targetFilterResolver: defaultTargetFilterResolver,
      });
    } catch (err) {
      findings.push({ pair: `${a}x${b}`, seed, kind: "throw", detail: err?.stack ?? String(err) });
      pairFindings++;
      continue;
    }

    totalTurns += result.turns;
    if (result.winner === "A") wins.A++;
    else if (result.winner === "B") wins.B++;
    else wins.none++;

    if (result.crashed) {
      findings.push({
        pair: `${a}x${b}`,
        seed,
        kind: "crash",
        detail: `turn ${result.crashed.turn} | action ${JSON.stringify(result.crashed.action)} | ${result.crashed.error}`,
        stack: result.crashed.stack,
      });
      pairFindings++;
    } else if (result.illegalState) {
      findings.push({ pair: `${a}x${b}`, seed, kind: "illegalState", detail: result.illegalState });
      pairFindings++;
    } else if (result.winner === null) {
      findings.push({
        pair: `${a}x${b}`,
        seed,
        kind: "unfinished",
        detail: `não terminou em ${args.maxTurns} turnos (${result.actionsPlayed} ações)`,
      });
      pairFindings++;
    }
  }
  const tag = pairFindings === 0 ? "ok" : `${pairFindings} ACHADO(S)`;
  console.log(`[gundam:fuzz]   ${a} x ${b}: ${tag}`);
}

const elapsed = ((Date.now() - started) / 1000).toFixed(1);
console.log(
  `[gundam:fuzz] ${totalGames} partidas em ${elapsed}s | vitórias A/B/nenhum: ${wins.A}/${wins.B}/${wins.none} | média ${(totalTurns / totalGames).toFixed(1)} turnos`,
);

if (findings.length > 0) {
  console.error(`\n[gundam:fuzz] ${findings.length} ACHADO(S):`);
  for (const f of findings) {
    console.error(`  - [${f.kind}] ${f.pair} seed=${f.seed}: ${f.detail}`);
    if (f.stack) console.error(`      ${f.stack.split("\n").slice(0, 5).join("\n      ")}`);
    console.error(
      `      repro: node scripts/gundam-fuzz.mjs --decks=${f.pair.replace("x", ",")} --games=1 --seed=${f.seed}`,
    );
  }
  unregister();
  process.exit(1);
}

console.log("[gundam:fuzz] 0 achados — motor estável para os pares testados.");
unregister();
