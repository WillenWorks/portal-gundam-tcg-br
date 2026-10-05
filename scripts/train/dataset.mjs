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
 *   pnpm train:dataset --workers=4 --nice --rapido
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import process from "node:process";
import { Worker } from "node:worker_threads";
import { pathToFileURL } from "node:url";

import {
  ENGINE_ROOT,
  validatedDeckList,
  validatedDeckPairs,
  FEATURE_SIZE,
  ACTION_SPACE,
} from "./engine.mjs";
import {
  policyPool,
  runPlannedDatasetGames,
} from "./datasetCore.mjs";

function parseArgs(argv) {
  const args = {
    games: 100,
    seed: 1,
    out: null,
    decks: null,
    workers: 1,
    nice: false,
    rapido: false,
  };
  for (const a of argv) {
    if (a === "--nice") {
      args.nice = true;
      continue;
    }
    if (a === "--rapido" || a === "--fast") {
      args.rapido = true;
      continue;
    }
    const m = a.match(/^--([^=]+)=(.*)$/);
    if (!m) continue;
    const [, k, v] = m;
    if (k === "games") args.games = Number(v);
    else if (k === "seed") args.seed = Number(v);
    else if (k === "out") args.out = v;
    else if (k === "decks") args.decks = v.split(",").map((s) => s.trim().toUpperCase());
    else if (k === "workers") args.workers = Number(v);
    else if (k === "nice") args.nice = v === "true";
    else if (k === "rapido") args.rapido = v === "true";
  }
  return args;
}

function concatFiles(sourceFiles, destFile) {
  const destStream = fs.createWriteStream(destFile);
  for (const src of sourceFiles) {
    if (fs.existsSync(src)) {
      const data = fs.readFileSync(src);
      destStream.write(data);
      try {
        fs.unlinkSync(src);
      } catch {
        // Ignora erro de exclusão temporária
      }
    }
  }
  destStream.end();
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.nice) {
    try {
      os.setPriority(0, os.constants.priority.PRIORITY_LOW);
    } catch (err) {
      console.warn(`[train:dataset] aviso: não foi possível definir prioridade baixa: ${err instanceof Error ? err.message : err}`);
    }
  }

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

  const pool = policyPool(args.rapido);
  const configHash = createHash("sha1")
    .update(
      JSON.stringify({
        games: args.games,
        seed: args.seed,
        pairs: pairs.map((p) => `${p[0].id}x${p[1].id}`),
        pool: pool.map((p) => p.name),
        FEATURE_SIZE,
        ACTION_SPACE,
      }),
    )
    .digest("hex")
    .slice(0, 12);

  const outPath = args.out
    ? path.resolve(ENGINE_ROOT, args.out)
    : path.join(ENGINE_ROOT, "services/sim-trainer/data", `${configHash}.jsonl`);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });

  const numWorkers = Math.max(1, Math.min(args.workers, os.cpus().length, pairs.length * args.games));

  console.log(
    `[train:dataset] ${pairs.length} par(es) x ${args.games} partidas | policies: ${pool.map((p) => p.name).join(", ")} | seed ${args.seed} | workers: ${numWorkers}${args.nice ? " (nice)" : ""}${args.rapido ? " (rapido)" : ""}`,
  );

  const plannedSpecs = [];
  for (const [deckA, deckB] of pairs) {
    for (let g = 0; g < args.games; g++) {
      plannedSpecs.push({
        deckAId: deckA.id,
        deckBId: deckB.id,
        seed: args.seed + g,
      });
    }
  }

  const started = Date.now();
  let totalGames = 0;
  let kept = 0;
  let discarded = 0;
  let rows = 0;

  if (numWorkers === 1) {
    const plannedGames = plannedSpecs.map((spec) => ({
      deckA: byId[spec.deckAId],
      deckB: byId[spec.deckBId],
      seed: spec.seed,
    }));

    const stats = await runPlannedDatasetGames(plannedGames, outPath, {
      rapido: args.rapido,
    });
    totalGames = stats.totalGames;
    kept = stats.kept;
    discarded = stats.discarded;
    rows = stats.rows;
  } else {
    // Dividir os specs entre os workers
    const chunks = Array.from({ length: numWorkers }, () => []);
    plannedSpecs.forEach((spec, i) => {
      chunks[i % numWorkers].push(spec);
    });

    const workerUrl = new URL(pathToFileURL(path.join(ENGINE_ROOT, "scripts/train/datasetWorker.mjs")));
    const workerTempFiles = [];
    const workerPromises = chunks.map((chunkSpecs, idx) => {
      if (chunkSpecs.length === 0) return Promise.resolve({ totalGames: 0, kept: 0, discarded: 0, rows: 0 });
      const tempFile = path.join(path.dirname(outPath), `${configHash}-worker-${idx}-${Date.now()}.tmp.jsonl`);
      workerTempFiles.push(tempFile);

      return new Promise((resolve, reject) => {
        const worker = new Worker(workerUrl, {
          workerData: {
            plannedSpecs: chunkSpecs,
            outPath: tempFile,
            rapido: args.rapido,
            nice: args.nice,
          },
        });

        worker.on("message", (msg) => {
          if (msg.type === "done") resolve(msg.stats);
          else if (msg.type === "error") reject(new Error(msg.error));
        });
        worker.on("error", reject);
        worker.on("exit", (code) => {
          if (code !== 0) reject(new Error(`Worker ${idx} saiu com código ${code}`));
        });
      });
    });

    const results = await Promise.all(workerPromises);
    for (const res of results) {
      totalGames += res.totalGames;
      kept += res.kept;
      discarded += res.discarded;
      rows += res.rows;
    }

    // Concatena arquivos temporários
    concatFiles(workerTempFiles, outPath);
  }

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
