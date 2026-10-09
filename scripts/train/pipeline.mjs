#!/usr/bin/env node
/*
 * Pipeline unificado de treino do bot (docs/agentes/prompts/A5-treino-bot-llm-zero.md).
 *
 * Suporta perfis:
 *   --perfil=local-forte   Usa todos os núcleos, prioridade baixa (nice), checkpoints e retomada
 *   --perfil=online        GitHub Actions / CI runner (workflow_dispatch)
 *
 * Opções:
 *   --rapido               Execução rápida (minutos), gera dataset e relatório comparável
 *   --workers=N            Número de workers para self-play
 *   --nice                 Execução em baixa prioridade de CPU
 *   --resume               Retoma a partir do último checkpoint salvo
 *   --clean                Descarta checkpoint anterior e inicia do zero
 *   --checkpoint=<path>    Caminho customizado do arquivo de checkpoint
 *   --games=N              Partidas de self-play por par
 *   --epochs=N             Épocas de treino do fit
 *   --evalGames=N          Partidas de avaliação por par
 *   --decks=ST01,ST02      Decks específicos
 *   --seed=N               Seed base
 *   --out=<path>           Caminho customizado para o relatório JSON final em docs/bot/
 *   --zero                 Fase 4: também gera a matriz de confrontos (pool all) para o counter do Zero System e o
 *                          relatório de diferença contra a matriz em uso (não troca a matriz do produto)
 *   --zeroGames=N          Partidas por par da matriz do Zero System (padrão 10; 2 com --rapido)
 */

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { computeEngineSha } from "./engineHash.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");

export function parseArgs(argv) {
  const args = {
    perfil: "local-forte",
    rapido: false,
    workers: null,
    nice: null,
    resume: null,
    clean: false,
    checkpoint: null,
    games: null,
    epochs: null,
    evalGames: null,
    decks: null,
    seed: 1,
    out: null,
    zero: false,
    zeroGames: null,
  };

  for (const a of argv) {
    if (a === "--rapido" || a === "--fast") {
      args.rapido = true;
      continue;
    }
    if (a === "--nice") {
      args.nice = true;
      continue;
    }
    if (a === "--resume") {
      args.resume = true;
      continue;
    }
    if (a === "--clean") {
      args.clean = true;
      continue;
    }
    if (a === "--zero") {
      args.zero = true;
      continue;
    }
    const m = a.match(/^--([^=]+)=(.*)$/);
    if (!m) continue;
    const [, k, v] = m;
    if (k === "perfil") args.perfil = v;
    else if (k === "workers") args.workers = Number(v);
    else if (k === "nice") args.nice = v === "true";
    else if (k === "resume") args.resume = v === "true";
    else if (k === "clean") args.clean = v === "true";
    else if (k === "checkpoint") args.checkpoint = v;
    else if (k === "games") args.games = Number(v);
    else if (k === "epochs") args.epochs = Number(v);
    else if (k === "evalGames") args.evalGames = Number(v);
    else if (k === "decks") args.decks = v.split(",").map((s) => s.trim().toUpperCase());
    else if (k === "seed") args.seed = Number(v);
    else if (k === "out") args.out = v;
    else if (k === "zeroGames") args.zeroGames = Number(v);
  }

  return args;
}

export function resolveConfig(cliArgs) {
  const perfil = cliArgs.perfil || "local-forte";
  const rapido = Boolean(cliArgs.rapido);

  const isLocal = perfil === "local-forte";
  const isOnline = perfil === "online";

  const numCpus = os.cpus().length;
  const defaultWorkers = isLocal ? Math.max(1, numCpus - 1) : 2;
  const workers = cliArgs.workers !== null ? cliArgs.workers : defaultWorkers;

  const nice = cliArgs.nice !== null ? cliArgs.nice : (isLocal ? true : false);
  const resume = cliArgs.clean ? false : (cliArgs.resume !== null ? cliArgs.resume : true);

  const defaultDecks = rapido ? ["ST01", "ST02"] : null;
  const decks = cliArgs.decks ?? defaultDecks;

  let games;
  let epochs;
  let evalGames;

  if (rapido) {
    games = cliArgs.games ?? (isLocal ? 15 : 10);
    epochs = cliArgs.epochs ?? (isLocal ? 4 : 3);
    evalGames = cliArgs.evalGames ?? 6;
  } else {
    games = cliArgs.games ?? (isLocal ? 100 : 60);
    epochs = cliArgs.epochs ?? (isLocal ? 20 : 15);
    evalGames = cliArgs.evalGames ?? (isLocal ? 50 : 30);
  }

  const checkpointPath = cliArgs.checkpoint
    ? path.resolve(ROOT, cliArgs.checkpoint)
    : path.join(ROOT, "services/sim-trainer/data", `checkpoint-${perfil}.json`);

  return {
    perfil,
    rapido,
    workers,
    nice,
    resume,
    clean: cliArgs.clean,
    checkpointPath,
    games,
    epochs,
    evalGames,
    decks,
    seed: cliArgs.seed ?? 1,
    out: cliArgs.out,
    zero: Boolean(cliArgs.zero),
    zeroGames: cliArgs.zeroGames ?? (rapido ? 2 : 10),
  };
}

export function loadCheckpoint(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveCheckpoint(filePath, data) {
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const content = JSON.stringify({ ...data, updatedAt: new Date().toISOString() }, null, 2);
    fs.writeFileSync(filePath, content + "\n");
  } catch (err) {
    console.warn(`[pipeline] aviso: falha ao salvar checkpoint: ${err instanceof Error ? err.message : err}`);
  }
}

export function clearCheckpoint(filePath) {
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch {
      // Ignora erro ao limpar checkpoint
    }
  }
}

export function extractPath(stdout) {
  const line = stdout
    .split("\n")
    .reverse()
    .find((l) => l.includes(" -> "));
  if (!line) return null;
  return line.split(" -> ").pop().trim();
}

function runStage(label, script, scriptArgs) {
  console.log(`\n[sim-trainer:pipeline] >>> ${label}: node ${script} ${scriptArgs.join(" ")}`);
  const res = spawnSync(process.execPath, [path.join(ROOT, script), ...scriptArgs], {
    stdio: ["inherit", "pipe", "inherit"],
    encoding: "utf8",
  });
  process.stdout.write(res.stdout ?? "");
  if (res.status !== 0) {
    console.error(`[sim-trainer:pipeline] etapa "${label}" falhou (exit ${res.status})`);
    process.exit(res.status ?? 1);
  }
  return res.stdout ?? "";
}

export function getEngineSha() {
  return computeEngineSha(ROOT);
}

export async function main() {
  const cliArgs = parseArgs(process.argv.slice(2));
  const config = resolveConfig(cliArgs);

  if (config.nice) {
    try {
      os.setPriority(0, os.constants.priority.PRIORITY_LOW);
    } catch (err) {
      console.warn(`[pipeline] aviso: não foi possível definir prioridade baixa: ${err instanceof Error ? err.message : err}`);
    }
  }

  const engineSha = getEngineSha();
  const dateStr = new Date().toISOString().slice(0, 10);
  const runHash = createHash("sha1")
    .update(JSON.stringify({ ...config, engineSha, timestamp: Date.now() }))
    .digest("hex")
    .slice(0, 8);

  console.log(`\n======================================================`);
  console.log(`[sim-trainer:pipeline] INICIANDO PIPELINE DE TREINO`);
  console.log(`======================================================`);
  console.log(`Perfil:     ${config.perfil}`);
  console.log(`Modo:       ${config.rapido ? "RÁPIDO (smoke/comparação)" : "COMPLETO"}`);
  console.log(`Engine SHA: ${engineSha}`);
  console.log(`Workers:    ${config.workers}`);
  console.log(`Prioridade: ${config.nice ? "Baixa (nice)" : "Normal"}`);
  console.log(`Retomada:   ${config.resume ? "Habilitada" : "Desabilitada"}`);
  console.log(`======================================================\n`);

  if (config.clean) {
    clearCheckpoint(config.checkpointPath);
    console.log(`[pipeline] Checkpoint limpo (--clean).`);
  }

  let checkpoint = config.resume ? loadCheckpoint(config.checkpointPath) : null;
  if (checkpoint && checkpoint.completed) {
    console.log(`[pipeline] Checkpoint anterior estava completo. Iniciando novo ciclo.`);
    checkpoint = null;
  }

  const startTime = Date.now();
  let datasetPath = null;
  let datasetTimeMs = 0;

  // ETAPA 1: DATASET
  if (checkpoint?.stages?.dataset?.completed && fs.existsSync(path.resolve(ROOT, checkpoint.stages.dataset.path))) {
    datasetPath = checkpoint.stages.dataset.path;
    datasetTimeMs = checkpoint.stages.dataset.durationMs || 0;
    console.log(`[pipeline] ⏭️  ETAPA 1 (DATASET): Reutilizando dataset do checkpoint -> ${datasetPath}`);
  } else {
    const dsArgs = [
      `--games=${config.games}`,
      `--seed=${config.seed}`,
      `--workers=${config.workers}`,
    ];
    if (config.nice) dsArgs.push("--nice");
    if (config.rapido) dsArgs.push("--rapido");
    if (config.decks) dsArgs.push(`--decks=${config.decks.join(",")}`);

    const dsStart = Date.now();
    const dsOut = runStage("dataset", "scripts/train/dataset.mjs", dsArgs);
    datasetTimeMs = Date.now() - dsStart;

    datasetPath = extractPath(dsOut);
    if (!datasetPath || !fs.existsSync(path.resolve(ROOT, datasetPath))) {
      console.error("[pipeline] Falha ao localizar o arquivo do dataset gerado.");
      process.exit(1);
    }

    checkpoint = {
      ...(checkpoint || {}),
      runId: runHash,
      perfil: config.perfil,
      engineSha,
      stages: {
        ...(checkpoint?.stages || {}),
        dataset: {
          completed: true,
          path: datasetPath,
          durationMs: datasetTimeMs,
        },
      },
    };
    saveCheckpoint(config.checkpointPath, checkpoint);
  }

  // ETAPA 2: FIT
  let modelDir = null;
  let fitTimeMs = 0;
  let modelManifest = null;

  if (
    checkpoint?.stages?.fit?.completed &&
    fs.existsSync(path.resolve(ROOT, checkpoint.stages.fit.modelDir, "manifest.json"))
  ) {
    modelDir = checkpoint.stages.fit.modelDir;
    fitTimeMs = checkpoint.stages.fit.durationMs || 0;
    try {
      modelManifest = JSON.parse(fs.readFileSync(path.resolve(ROOT, modelDir, "manifest.json"), "utf8"));
    } catch {
      modelManifest = null;
    }
    console.log(`[pipeline] ⏭️  ETAPA 2 (FIT): Reutilizando modelo do checkpoint -> ${modelDir}`);
  } else {
    const fitArgs = [`--data=${datasetPath}`, `--epochs=${config.epochs}`];
    if (config.nice) fitArgs.push("--nice");

    const fitStart = Date.now();
    const fitOut = runStage("fit", "scripts/train/fit.mjs", fitArgs);
    fitTimeMs = Date.now() - fitStart;

    modelDir = extractPath(fitOut);
    if (!modelDir || !fs.existsSync(path.resolve(ROOT, modelDir, "manifest.json"))) {
      console.error("[pipeline] Falha ao localizar o modelo treinado.");
      process.exit(1);
    }

    try {
      modelManifest = JSON.parse(fs.readFileSync(path.resolve(ROOT, modelDir, "manifest.json"), "utf8"));
    } catch {
      modelManifest = null;
    }

    checkpoint = {
      ...checkpoint,
      stages: {
        ...(checkpoint?.stages || {}),
        fit: {
          completed: true,
          modelDir,
          durationMs: fitTimeMs,
          loss: modelManifest?.finalLoss ?? null,
          accuracy: modelManifest?.policyAccuracy ?? null,
        },
      },
    };
    saveCheckpoint(config.checkpointPath, checkpoint);
  }

  // ETAPA 3: EVAL
  let evalResults = null;
  let evalTimeMs = 0;

  const tempEvalOut = path.join(ROOT, "services/sim-trainer/data", `eval-pipeline-${runHash}.json`);
  const evalArgs = [
    `--model=${modelDir}`,
    `--games=${config.evalGames}`,
    `--out=${tempEvalOut}`,
  ];
  if (config.nice) evalArgs.push("--nice");
  if (config.decks) evalArgs.push(`--decks=${config.decks.join(",")}`);

  const evalStart = Date.now();
  runStage("eval", "scripts/train/eval.mjs", evalArgs);
  evalTimeMs = Date.now() - evalStart;

  if (fs.existsSync(tempEvalOut)) {
    try {
      evalResults = JSON.parse(fs.readFileSync(tempEvalOut, "utf8"));
      fs.unlinkSync(tempEvalOut);
    } catch {
      evalResults = null;
    }
  }

  // ETAPA 3b (opcional, --zero): matriz de confrontos para o counter do Zero System + diferença contra a em uso.
  let zeroSystem = null;
  if (config.zero) {
    const zeroStart = Date.now();
    const matrixOut = path.join("docs/bot", `matchups-${dateStr}-${runHash}.json`);
    const matchupArgs = ["--pool=all", `--games=${config.zeroGames}`, `--workers=${config.workers}`, `--out=${matrixOut}`];
    if (config.nice) matchupArgs.push("--nice");
    runStage("zero-matrix", "scripts/gundam-bot-matchups.mjs", matchupArgs);
    const zeroReport = path.join("docs/bot", `zero-matrix-${dateStr}-${runHash}.md`);
    runStage("zero-report", "scripts/train/zeroMatrix.mjs", [`--matrix=${matrixOut}`, `--out=${zeroReport}`]);
    zeroSystem = { matrix: matrixOut, report: zeroReport, gamesPerPair: config.zeroGames, durationMs: Date.now() - zeroStart };
  }

  const totalTimeMs = Date.now() - startTime;

  // ETAPA 4: RELATÓRIO FINAL
  const reportDir = path.join(ROOT, "docs/bot");
  fs.mkdirSync(reportDir, { recursive: true });

  const finalReportPath = config.out
    ? path.resolve(ROOT, config.out)
    : path.join(reportDir, `train-${dateStr}-${runHash}.json`);

  const reportData = {
    id: `train-${dateStr}-${runHash}`,
    date: new Date().toISOString(),
    engineSha,
    perfil: config.perfil,
    rapido: config.rapido,
    hardware: {
      platform: os.platform(),
      cpus: os.cpus().length,
      workers: config.workers,
      nice: config.nice,
    },
    dataset: {
      path: datasetPath,
      gamesPerPair: config.games,
      durationMs: datasetTimeMs,
    },
    fit: {
      modelDir,
      epochs: config.epochs,
      finalLoss: modelManifest?.finalLoss ?? null,
      policyAccuracy: modelManifest?.policyAccuracy ?? null,
      valueMae: modelManifest?.valueMae ?? null,
      durationMs: fitTimeMs,
    },
    evaluation: {
      gamesPerPair: config.evalGames,
      durationMs: evalTimeMs,
      vsHeuristic: evalResults?.vsHeuristic ?? null,
      vsSecond: evalResults?.vsSecond ?? null,
      promotionThreshold: evalResults?.promotionThreshold ?? 0.55,
      approved: Boolean(evalResults?.approved),
    },
    zeroSystem,
    totalDurationSeconds: Number((totalTimeMs / 1000).toFixed(1)),
  };

  fs.writeFileSync(finalReportPath, JSON.stringify(reportData, null, 2) + "\n");
  fs.writeFileSync(path.join(reportDir, "latest-train-report.json"), JSON.stringify(reportData, null, 2) + "\n");

  checkpoint = {
    ...checkpoint,
    completed: true,
    completedAt: new Date().toISOString(),
    reportPath: finalReportPath,
    verdict: reportData.evaluation.approved ? "APROVADO" : "REPROVADO",
  };
  saveCheckpoint(config.checkpointPath, checkpoint);

  console.log(`\n======================================================`);
  console.log(`[sim-trainer:pipeline] RELATÓRIO FINAL DE TREINO`);
  console.log(`======================================================`);
  console.log(`Tempo total:     ${reportData.totalDurationSeconds}s`);
  console.log(`Dataset gerado:  ${reportData.dataset.path} (${(reportData.dataset.durationMs / 1000).toFixed(1)}s)`);
  console.log(`Modelo treinado: ${reportData.fit.modelDir} (${(reportData.fit.durationMs / 1000).toFixed(1)}s)`);
  if (reportData.fit.policyAccuracy !== null) {
    console.log(`Acurácia policy: ${(reportData.fit.policyAccuracy * 100).toFixed(1)}%`);
  }
  if (reportData.fit.valueMae !== null) {
    console.log(`MAE valor:       ${reportData.fit.valueMae.toFixed(3)}`);
  }
  if (reportData.evaluation.vsHeuristic) {
    const vr = reportData.evaluation.vsHeuristic;
    const wr = (vr.winrate * 100).toFixed(1);
    const low = vr.wilson ? (vr.wilson.low * 100).toFixed(1) : "?";
    const high = vr.wilson ? (vr.wilson.high * 100).toFixed(1) : "?";
    console.log(`vs Heurística:   ${wr}% Wilson [${low}%, ${high}%]`);
  }
  console.log(`------------------------------------------------------`);
  console.log(`VEREDITO:        ${reportData.evaluation.approved ? "APROVADO ✅" : "REPROVADO ❌"}`);
  console.log(`Relatório salvo: ${path.relative(ROOT, finalReportPath)}`);
  console.log(`======================================================\n`);
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  main().catch((err) => {
    console.error(`[pipeline] Erro fatal:`, err);
    process.exit(1);
  });
}
