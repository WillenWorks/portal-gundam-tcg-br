#!/usr/bin/env node
/**
 * Benchmark do lookahead de efeitos (spec bot-lookahead-efeitos, meta "Força"):
 * bot `normal` COM lookahead vs bot `normal` atual (sem lookahead), todos os pares
 * de `validatedDeckList()`, alternando quem é A/B. Meta: sem regressão (≥ 48%).
 *
 *   node scripts/gundam-bot-bench.mjs                 # 6 partidas por par (3 de cada lado)
 *   node scripts/gundam-bot-bench.mjs --games=20      # mais partidas por par
 *   node scripts/gundam-bot-bench.mjs --maxTurns=40
 */
import { register } from "tsx/esm/api";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

register();

const ROOT = path.resolve(import.meta.dirname, "..");
const sim = (p) => pathToFileURL(path.join(ROOT, "src/modules/simulator", p)).href;

const { runSelfPlay } = await import(sim("engine/selfPlay.ts"));
const { ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver, validatedDeckList } = await import(
  sim("content/index.ts")
);
const { heuristicPolicy } = await import(sim("engine/bot/heuristicPolicy.ts"));

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? "true"];
  }),
);
/**
 * Meta revisada no spec (2026-09-24): "sem regressão" contra a heurística atual.
 * A meta original de 55% não se sustentou com os decks iniciais (poucos Comandos).
 */
const NO_REGRESSION_RATE = 0.48;
const GAMES_PER_PAIR = Number(args.games ?? 6);
const MAX_TURNS = Number(args.maxTurns ?? 40);
const resolvers = { predicateResolver: defaultPredicateResolver, targetFilterResolver: defaultTargetFilterResolver };

const decks = validatedDeckList();
let newWins = 0;
let oldWins = 0;
let undecided = 0;
const effectPlays = { lookahead: 0, atual: 0 };
let games = 0;
/** conta Comandos/【Activate】 escolhidos — mostra se o lookahead muda as jogadas de fato */
const counting = (policy, key) => (view, legal, rng) => {
  const choice = policy(view, legal, rng);
  if (choice.kind === "playCommand" || choice.kind === "activateAbility") effectPlays[key]++;
  return choice;
};
const started = Date.now();

for (let i = 0; i < decks.length; i++) {
  for (let j = i; j < decks.length; j++) {
    let pairNew = 0;
    let pairOld = 0;
    for (let g = 0; g < GAMES_PER_PAIR; g++) {
      const newIsA = g % 2 === 0;
      // policy nova recriada por partida: o contador de ativações é por instância
      const lookaheadBot = counting(heuristicPolicy({ level: "normal", lookahead: { specs: ALL_EFFECT_SPECS, ...resolvers } }), "lookahead");
      const oldBot = counting(heuristicPolicy({ level: "normal" }), "atual");
      games++;
      const result = runSelfPlay({
        deckA: decks[i].build(),
        deckB: decks[j].build(),
        seed: 9000 + g,
        maxTurns: MAX_TURNS,
        policyA: newIsA ? lookaheadBot : oldBot,
        policyB: newIsA ? oldBot : lookaheadBot,
        specs: ALL_EFFECT_SPECS,
        ...resolvers,
      });
      if (result.crashed || result.illegalState) {
        console.error(`[bench] ${decks[i].id}x${decks[j].id} seed ${9000 + g}:`, result.crashed?.error ?? result.illegalState);
        process.exitCode = 1;
      }
      const newSeat = newIsA ? "A" : "B";
      if (result.winner === null) undecided++;
      else if (result.winner === newSeat) {
        newWins++;
        pairNew++;
      } else {
        oldWins++;
        pairOld++;
      }
    }
    console.log(`[bench] ${decks[i].id} x ${decks[j].id}: lookahead ${pairNew} × ${pairOld} atual`);
  }
}

const decided = newWins + oldWins;
const rate = decided === 0 ? 0 : newWins / decided;
console.log(
  `\n[bench] lookahead vence ${(rate * 100).toFixed(1)}% das decididas (${newWins}/${decided}); ${undecided} sem vencedor; ` +
    `${((Date.now() - started) / 1000).toFixed(0)}s`,
);
console.log(
  `[bench] Comandos/habilidades por partida: lookahead ${(effectPlays.lookahead / games).toFixed(2)} | atual ${(effectPlays.atual / games).toFixed(2)}`,
);
console.log(
  rate >= NO_REGRESSION_RATE
    ? `[bench] SEM REGRESSÃO (≥ ${NO_REGRESSION_RATE * 100}%)`
    : `[bench] REGRESSÃO (< ${NO_REGRESSION_RATE * 100}%)`,
);
