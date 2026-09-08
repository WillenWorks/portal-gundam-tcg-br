/*
 * Orquestra o pipeline de treino ponta-a-ponta: dataset -> fit -> eval
 * (docs/50). Cada etapa é um script em `scripts/train/` — este arquivo só
 * encadeia e passa os artefatos de uma pra outra.
 *
 * Uso (a partir da raiz do repo ou deste diretório):
 *   node services/sim-trainer/pipeline.mjs --games=2000 --epochs=40
 *   node services/sim-trainer/pipeline.mjs --games=20 --epochs=5   # smoke
 *
 * Backend tfjs: `@tensorflow/tfjs` puro-JS por padrão neste ambiente
 * (Windows sem toolchain C++, ver docs/50). Em Linux/CI:
 *   pnpm -w add @tensorflow/tfjs-node && SIM_TRAINER_TF_BACKEND=node node services/sim-trainer/pipeline.mjs
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const ROOT = path.resolve(import.meta.dirname, "..", "..");

function parseArgs(argv) {
  const args = { games: 500, seed: 1, epochs: 20, evalGames: 200 };
  for (const a of argv) {
    const m = a.match(/^--([^=]+)=(.*)$/);
    if (!m) continue;
    const [, k, v] = m;
    if (k in args) args[k] = Number(v);
  }
  return args;
}

function run(label, script, scriptArgs) {
  console.log(`\n[sim-trainer] >>> ${label}: node ${script} ${scriptArgs.join(" ")}`);
  const res = spawnSync(process.execPath, [path.join(ROOT, script), ...scriptArgs], {
    stdio: ["inherit", "pipe", "inherit"],
    encoding: "utf8",
  });
  process.stdout.write(res.stdout ?? "");
  if (res.status !== 0) {
    console.error(`[sim-trainer] etapa "${label}" falhou (exit ${res.status})`);
    process.exit(res.status ?? 1);
  }
  return res.stdout ?? "";
}

/** Lê a última linha `... -> <path>` do stdout de uma etapa. */
function extractPath(stdout) {
  const line = stdout
    .split("\n")
    .reverse()
    .find((l) => l.includes(" -> "));
  if (!line) return null;
  return line.split(" -> ").pop().trim();
}

const args = parseArgs(process.argv.slice(2));

const dsOut = run("dataset", "scripts/train/dataset.mjs", [`--games=${args.games}`, `--seed=${args.seed}`]);
const datasetPath = extractPath(dsOut);
if (!datasetPath) {
  console.error("[sim-trainer] não consegui descobrir o path do dataset gerado");
  process.exit(1);
}

const fitOut = run("fit", "scripts/train/fit.mjs", [`--data=${datasetPath}`, `--epochs=${args.epochs}`]);
const modelDir = extractPath(fitOut);
if (!modelDir || !fs.existsSync(path.resolve(ROOT, modelDir))) {
  console.error("[sim-trainer] não consegui descobrir o path do modelo gerado");
  process.exit(1);
}

run("eval", "scripts/train/eval.mjs", [`--model=${modelDir}`, `--games=${args.evalGames}`]);

console.log(`\n[sim-trainer] pipeline completo. Modelo: ${modelDir}`);
console.log("[sim-trainer] se APROVADO: rodar 'pnpm gundam:golden' e então promover o modelo (ver README).");
