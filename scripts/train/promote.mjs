#!/usr/bin/env node
/*
 * train:promote — Validador e orquestrador de promoção de modelos/pesos (docs/50).
 *
 * Avalia se um modelo treinado preenche os 4 critérios formais de promoção:
 *   1. Integridade do manifesto e pesos válidos
 *   2. Compatibilidade estrita do motor (engineSha idêntico ao motor atual)
 *   3. Desempenho superior ao baseline (≥ 30 partidas decididas, winrate > 55% e Wilson low > 50%)
 *   4. Golden Master intacto (pnpm gundam:golden)
 *
 * NUNCA liga diretamente o modelo em produção sem aprovação (regra do A5:
 * "o 'promover' gera PR para dev com os números").
 *
 * Uso:
 *   pnpm train:promote --model=services/sim-trainer/models/<sha>
 *   pnpm train:promote --report=docs/bot/train-2026-10-05-abc12345.json
 *   pnpm train:promote --check-only
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { ENGINE_ROOT, getEngineSha, FEATURE_SIZE, ACTION_SPACE } from "./engine.mjs";

export const PROMOTION_THRESHOLD = 0.55;
export const MIN_DECIDED_GAMES = 30;

export function parseArgs(argv) {
  const args = {
    model: null,
    report: null,
    golden: false,
    checkOnly: false,
    force: false,
    out: null,
  };

  for (const a of argv) {
    if (a === "--golden") {
      args.golden = true;
      continue;
    }
    if (a === "--check-only") {
      args.checkOnly = true;
      continue;
    }
    if (a === "--force") {
      args.force = true;
      continue;
    }
    const m = a.match(/^--([^=]+)=(.*)$/);
    if (!m) continue;
    const [, k, v] = m;
    if (k === "model") args.model = v;
    else if (k === "report") args.report = v;
    else if (k === "out") args.out = v;
  }

  return args;
}

/**
 * Avalia se os dados do modelo e do relatório atendem às 4 regras de promoção.
 * Função pura e determinística para testes unitários.
 */
export function evaluatePromotionCriteria({ manifest, evalReport, currentEngineSha, goldenPassed = null }) {
  const checks = [];

  // Regra 1: Integridade do manifesto
  const hasManifest = Boolean(manifest && typeof manifest === "object");
  const validArch =
    hasManifest &&
    manifest.featureSize === FEATURE_SIZE &&
    manifest.actionSpace === ACTION_SPACE &&
    typeof manifest.finalLoss === "number" &&
    Number.isFinite(manifest.finalLoss);

  checks.push({
    name: "Integridade do manifesto",
    passed: Boolean(validArch),
    detail: validArch
      ? `Loss: ${manifest.finalLoss.toFixed(4)}, Policy Acc: ${((manifest.policyAccuracy ?? 0) * 100).toFixed(1)}%`
      : "Manifesto ausente ou inválido",
  });

  // Regra 2: Compatibilidade do hash do motor
  const modelEngineSha = manifest?.engineSha ?? "desconhecido";
  const shaMatches = modelEngineSha !== "desconhecido" && modelEngineSha === currentEngineSha;

  checks.push({
    name: "Compatibilidade com motor atual",
    passed: Boolean(shaMatches),
    detail: `Modelo: ${modelEngineSha} | Motor atual: ${currentEngineSha}`,
  });

  // Regra 3: Desempenho contra baseline heurístico (winrate > 55% e Wilson low > 50%)
  const vsHeuristic = evalReport?.evaluation?.vsHeuristic ?? evalReport?.vsHeuristic ?? null;
  const winrate = vsHeuristic?.winrate ?? 0;
  const wilsonLow = vsHeuristic?.wilson?.low ?? 0;
  const decided = vsHeuristic?.decided ?? 0;

  const winratePassed = winrate > PROMOTION_THRESHOLD;
  // Antes, com menos de 30 partidas o Wilson era ignorado (11/20 promovia). Sem amostra mínima não há promoção.
  const samplePassed = decided >= MIN_DECIDED_GAMES;
  const wilsonPassed = wilsonLow > 0.5;
  const baselinePassed = Boolean(vsHeuristic && samplePassed && winratePassed && wilsonPassed);

  checks.push({
    name: "Superação do baseline heurístico",
    passed: baselinePassed,
    detail: vsHeuristic
      ? `Winrate: ${(winrate * 100).toFixed(1)}% (limiar: ${(PROMOTION_THRESHOLD * 100).toFixed(0)}%), Wilson low: ${(wilsonLow * 100).toFixed(1)}% (limiar: >50%), partidas decididas: ${decided} (mínimo: ${MIN_DECIDED_GAMES})`
      : "Relatório de avaliação não encontrado",
  });

  // Regra 4: Golden Master
  if (goldenPassed !== null) {
    checks.push({
      name: "Golden Master verificado",
      passed: Boolean(goldenPassed),
      detail: goldenPassed ? "Golden master passou sem regressão de motor" : "Golden master falhou",
    });
  }

  const approved = checks.every((c) => c.passed);
  return { approved, checks };
}

export function generatePromotionPrBody({ modelDir, manifest, evalReport, currentEngineSha, checks }) {
  const vsHeuristic = evalReport?.evaluation?.vsHeuristic ?? evalReport?.vsHeuristic ?? {};
  const vsSecond = evalReport?.evaluation?.vsSecond ?? evalReport?.vsSecond ?? {};

  return [
    `# Proposta de Promoção de Modelo ML (A5)`,
    ``,
    `## Metadados do Modelo`,
    `- **Diretório do modelo:** \`${modelDir}\``,
    `- **Engine SHA:** \`${currentEngineSha}\``,
    `- **Treinado em:** ${manifest?.trainedAt ?? manifest?.createdAt ?? "N/A"}`,
    `- **Arquitetura:** \`${manifest?.arch ?? "N/A"}\``,
    `- **Épocas:** ${manifest?.epochs ?? "N/A"}`,
    `- **Amostras de treino:** ${manifest?.samples ?? "N/A"}`,
    `- **Loss final:** ${manifest?.finalLoss?.toFixed(4) ?? "N/A"}`,
    `- **Acurácia Policy:** ${((manifest?.policyAccuracy ?? 0) * 100).toFixed(1)}%`,
    `- **MAE Valor:** ${manifest?.valueMae?.toFixed(3) ?? "N/A"}`,
    ``,
    `## Resultados da Avaliação`,
    `- **vs Heurística (normal):** ${((vsHeuristic.winrate ?? 0) * 100).toFixed(1)}% Wilson [${((vsHeuristic.wilson?.low ?? 0) * 100).toFixed(1)}%, ${((vsHeuristic.wilson?.high ?? 0) * 100).toFixed(1)}%] (${vsHeuristic.wins ?? 0}/${vsHeuristic.decided ?? 0} decididas)`,
    `- **vs ${vsSecond.label ?? "MCTS"}:** ${((vsSecond.winrate ?? 0) * 100).toFixed(1)}%`,
    ``,
    `## Checklist de Critérios de Aceite`,
    ...checks.map((c) => `- [${c.passed ? "x" : " "}] **${c.name}**: ${c.detail}`),
    ``,
    `> Para integrar este modelo em \`dev\`, revise os números acima e confirme a aprovação.`,
  ].join("\n");
}

export async function main() {
  const args = parseArgs(process.argv.slice(2));
  const currentEngineSha = getEngineSha();

  let modelDir = null;
  let evalReport = null;

  if (args.report) {
    const reportPath = path.resolve(ENGINE_ROOT, args.report);
    if (!fs.existsSync(reportPath)) {
      console.error(`[train:promote] relatório não encontrado: ${reportPath}`);
      process.exit(2);
    }
    evalReport = JSON.parse(fs.readFileSync(reportPath, "utf8"));
    modelDir = evalReport.fit?.modelDir ?? evalReport.modelDir;
  } else if (args.model) {
    modelDir = args.model;
    const latestReportPath = path.join(ENGINE_ROOT, "docs/bot/latest-train-report.json");
    if (fs.existsSync(latestReportPath)) {
      try {
        evalReport = JSON.parse(fs.readFileSync(latestReportPath, "utf8"));
      } catch {
        evalReport = null;
      }
    }
  } else {
    const latestReportPath = path.join(ENGINE_ROOT, "docs/bot/latest-train-report.json");
    if (fs.existsSync(latestReportPath)) {
      evalReport = JSON.parse(fs.readFileSync(latestReportPath, "utf8"));
      modelDir = evalReport.fit?.modelDir ?? evalReport.modelDir;
    }
  }

  if (!modelDir) {
    console.error("[train:promote] informe --model=<dir> ou --report=<path>");
    process.exit(2);
  }

  const absModelDir = path.resolve(ENGINE_ROOT, modelDir);
  const manifestPath = path.join(absModelDir, "manifest.json");
  if (!fs.existsSync(manifestPath)) {
    console.error(`[train:promote] manifest.json não encontrado em: ${absModelDir}`);
    process.exit(2);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

  let goldenPassed = null;
  if (args.golden) {
    console.log("[train:promote] executando teste do golden master (gundam:golden)...");
    const res = spawnSync("node", ["scripts/gundam-golden.mjs"], {
      cwd: ENGINE_ROOT,
      stdio: "inherit",
    });
    goldenPassed = res.status === 0;
  }

  const result = evaluatePromotionCriteria({
    manifest,
    evalReport,
    currentEngineSha,
    goldenPassed,
  });

  console.log(`\n======================================================`);
  console.log(`[train:promote] VALIDAÇÃO DE PROMOÇÃO DE MODELO`);
  console.log(`======================================================`);
  console.log(`Modelo:     ${path.relative(ENGINE_ROOT, absModelDir)}`);
  console.log(`Engine SHA: ${currentEngineSha}`);
  console.log(`------------------------------------------------------`);
  for (const c of result.checks) {
    console.log(`${c.passed ? "  ✓" : "  ✗"} ${c.name}: ${c.detail}`);
  }
  console.log(`------------------------------------------------------`);
  console.log(`VEREDITO: ${result.approved ? "PROMOÇÃO APROVADA ✅" : "PROMOÇÃO RECUSADA ❌"}`);
  console.log(`======================================================\n`);

  if (!result.approved && !args.force) {
    if (args.checkOnly) process.exit(1);
    console.error("[train:promote] O modelo não cumpre todos os critérios de promoção.");
    process.exit(1);
  }

  // Gera documentação para proposta de PR
  const prBody = generatePromotionPrBody({
    modelDir: path.relative(ENGINE_ROOT, absModelDir),
    manifest,
    evalReport,
    currentEngineSha,
    checks: result.checks,
  });

  const outDoc = args.out
    ? path.resolve(ENGINE_ROOT, args.out)
    : path.join(ENGINE_ROOT, "docs/bot/promotion-candidate.md");

  fs.mkdirSync(path.dirname(outDoc), { recursive: true });
  fs.writeFileSync(outDoc, prBody + "\n");
  console.log(`[train:promote] Documento de proposta gerado: ${path.relative(ENGINE_ROOT, outDoc)}`);
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  main().catch((err) => {
    console.error("[train:promote] Erro:", err);
    process.exit(1);
  });
}
