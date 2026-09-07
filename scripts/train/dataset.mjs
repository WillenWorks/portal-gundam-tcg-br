/*
 * train:dataset — gera dataset de self-play para o treino ML (docs/50).
 *
 * Roda N partidas bot-vs-bot sobre os pares de `VALIDATED_DECKS` (ST01-04),
 * com policies mistas por partida (`randomLegal` / `heuristic facil|normal` /
 * `mcts` se a Lane 4A já mergeou). Para cada ponto de decisão com 2+ ações
 * legais grava uma linha JSONL:
 *
 *   { features: number[FEATURE_SIZE],
 *     actionIndex: number,            // bucket da ação escolhida (features.ts)
 *     legalMask: number[ACTION_SPACE],
 *     outcome: -1 | 1 }               // resultado final do ponto de vista do jogador da vez
 *
 * Partidas sem vencedor (timeout / estado ilegal) são descartadas.
 * Determinístico dado `--seed`.
 *
 * Uso:
 *   pnpm train:dataset --games=200 --seed=1
 *   pnpm train:dataset --games=20 --seed=7 --out=services/sim-trainer/data/meu.jsonl
 *   pnpm train:dataset --decks=ST01,ST02 --games=50
 */

import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import process from "node:process";

import {
  ENGINE_ROOT,
  createGame,
  actionOwner,
  enumerateLegalActions,
  applyPlayerAction,
  viewStateFor,
  createRng,
  extractFeatures,
  encodeAction,
  legalActionMask,
  heuristicPolicy,
  randomLegal,
  mctsPolicy,
  ALL_EFFECT_SPECS,
  defaultPredicateResolver,
  defaultTargetFilterResolver,
  validatedDeckList,
  validatedDeckPairs,
  FEATURE_SIZE,
  ACTION_SPACE,
} from "./engine.mjs";

const HYPER = {
  maxTurns: 60, // partida que passa disso é descartada (sem vencedor)
  maxSteps: 60 * 400,
};

function parseArgs(argv) {
  const args = { games: 100, seed: 1, out: null, decks: null };
  for (const a of argv) {
    const m = a.match(/^--([^=]+)=(.*)$/);
    if (!m) continue;
    const [, k, v] = m;
    if (k === "games") args.games = Number(v);
    else if (k === "seed") args.seed = Number(v);
    else if (k === "out") args.out = v;
    else if (k === "decks") args.decks = v.split(",").map((s) => s.trim().toUpperCase());
  }
  return args;
}

/** Pool de policies sorteadas por partida. `mcts` entra só se a Lane 4A forneceu. */
function policyPool() {
  const pool = [
    { name: "random", make: () => randomLegal },
    { name: "heuristic-facil", make: () => heuristicPolicy({ level: "facil" }) },
    { name: "heuristic-normal", make: () => heuristicPolicy({ level: "normal" }) },
  ];
  if (mctsPolicy) {
    pool.push({ name: "mcts", make: () => mctsPolicy({ iterations: 60 }) });
  }
  return pool;
}

function pick(pool, rng) {
  return pool[Math.floor(rng() * pool.length)];
}

/**
 * Uma partida, gravando cada decisão. Espelha o laço de `runSelfPlay` (mesmo
 * motor puro, mesmas guardas) mas com telemetria por jogada.
 */
function playAndRecord(deckA, deckB, seed, policyA, policyB, nameA, nameB) {
  const rng = createRng((seed ^ 0x5eed1234) >>> 0);
  let state = createGame(deckA, deckB, { seed, firstPlayer: "A", interactiveMulligan: true });
  const samples = [];

  for (let step = 0; step < HYPER.maxSteps; step++) {
    if (state.gameOver) break;
    if (state.turnNumber > HYPER.maxTurns) return { samples: [], winner: null };

    const owner = actionOwner(state);
    if (!owner) return { samples: [], winner: null };

    let legal;
    try {
      legal = enumerateLegalActions(state, owner, ALL_EFFECT_SPECS, {
        predicateResolver: defaultPredicateResolver,
        targetFilterResolver: defaultTargetFilterResolver,
      });
    } catch {
      return { samples: [], winner: null };
    }
    if (legal.length === 0) return { samples: [], winner: null };

    const view = viewStateFor(state, owner);
    const policy = owner === "A" ? policyA : policyB;
    const policyName = owner === "A" ? nameA : nameB;
    const action = policy(view, legal, rng);

    // jogadas de `randomLegal` são ruído — a partida roda (diversidade de
    // oponente / de resultado) mas os lances dela não viram alvo de treino.
    if (legal.length >= 2 && policyName !== "random") {
      samples.push({
        seat: owner,
        features: Array.from(extractFeatures(view, owner)),
        actionIndex: encodeAction(action, view),
        legalMask: Array.from(legalActionMask(legal, view)),
      });
    }

    try {
      state = applyPlayerAction(
        state,
        owner,
        action,
        ALL_EFFECT_SPECS,
        defaultPredicateResolver,
        defaultTargetFilterResolver,
      );
    } catch {
      return { samples: [], winner: null };
    }
  }

  if (!state.gameOver) return { samples: [], winner: null };
  return { samples, winner: state.gameOver.winner };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const deckList = validatedDeckList();
  const byId = Object.fromEntries(deckList.map((d) => [d.id, d]));

  let pairs;
  if (args.decks) {
    const [a, b = a] = args.decks;
    if (!byId[a] || !byId[b]) {
      console.error(`Deck desconhecido: ${args.decks.join(",")}. Válidos: ${deckList.map((d) => d.id).join(", ")}`);
      process.exit(2);
    }
    pairs = [[byId[a], byId[b]]];
  } else {
    pairs = validatedDeckPairs();
  }

  const pool = policyPool();
  const configHash = createHash("sha1")
    .update(JSON.stringify({ games: args.games, seed: args.seed, pairs: pairs.map((p) => `${p[0].id}x${p[1].id}`), pool: pool.map((p) => p.name), FEATURE_SIZE, ACTION_SPACE }))
    .digest("hex")
    .slice(0, 12);

  const outPath = args.out
    ? path.resolve(ENGINE_ROOT, args.out)
    : path.join(ENGINE_ROOT, "services/sim-trainer/data", `${configHash}.jsonl`);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const stream = fs.createWriteStream(outPath);

  console.log(
    `[train:dataset] ${pairs.length} par(es) x ${args.games} partidas | policies: ${pool.map((p) => p.name).join(", ")} | seed ${args.seed}`,
  );

  const started = Date.now();
  let totalGames = 0;
  let kept = 0;
  let discarded = 0;
  let rows = 0;

  const selectRng = createRng((args.seed ^ 0xabcdef) >>> 0);

  for (const [deckA, deckB] of pairs) {
    for (let g = 0; g < args.games; g++) {
      const seed = args.seed + g;
      totalGames++;
      const poolA = pick(pool, selectRng);
      const poolB = pick(pool, selectRng);
      const shortName = (n) => (n === "random" ? "random" : "policy");
      const { samples, winner } = playAndRecord(
        deckA.build(),
        deckB.build(),
        seed,
        poolA.make(),
        poolB.make(),
        shortName(poolA.name),
        shortName(poolB.name),
      );
      if (winner === null || samples.length === 0) {
        discarded++;
        continue;
      }
      kept++;
      for (const s of samples) {
        const outcome = s.seat === winner ? 1 : -1;
        stream.write(JSON.stringify({ features: s.features, actionIndex: s.actionIndex, legalMask: s.legalMask, outcome }) + "\n");
        rows++;
      }
    }
    console.log(`[train:dataset]   ${deckA.id} x ${deckB.id}: ok`);
  }

  await new Promise((resolve) => stream.end(resolve));
  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  console.log(
    `[train:dataset] ${totalGames} partidas em ${elapsed}s | ${kept} usadas / ${discarded} descartadas | ${rows} amostras`,
  );
  console.log(`[train:dataset] -> ${path.relative(ENGINE_ROOT, outPath)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
