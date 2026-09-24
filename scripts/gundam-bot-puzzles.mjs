#!/usr/bin/env node
/**
 * Banco de situações do bot (spec bot-avaliacao-forca): roda cada nível nas
 * situações com jogada correta conhecida e mostra % de acerto, os erros (jogada
 * escolhida × aceitas) e as situações quebradas. Meta: ≥ 90% no nível mais alto.
 * Grava `docs/bot/puzzles-AAAA-MM-DD.json`.
 *
 *   pnpm gundam:bot:puzzles
 *   pnpm gundam:bot:puzzles -- --levels=normal,dificil --rollouts=4
 *   pnpm gundam:bot:puzzles -- --out=docs/bot/x.json
 */
import { register } from "tsx/esm/api";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

register();

const ROOT = path.resolve(import.meta.dirname, "..");
const sim = (p) => pathToFileURL(path.join(ROOT, "src/modules/simulator", p)).href;

const { ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver } = await import(sim("content/index.ts"));
const { ALL_PUZZLES } = await import(sim("engine/bot/puzzles/index.ts"));
const { runPuzzleSuite } = await import(sim("engine/bot/puzzleRunner.ts"));
const { BOT_LEVELS, DIFICIL_ROLLOUTS, policyForLevel } = await import(sim("engine/bot/levelPolicies.ts"));

const GOAL = 0.9;
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? "true"];
  }),
);
const levels = String(args.levels ?? BOT_LEVELS.join(",")).split(",");
const unknown = levels.filter((l) => !BOT_LEVELS.includes(l));
if (unknown.length) {
  console.error(`[puzzles] nível desconhecido: ${unknown.join(", ")} — use ${BOT_LEVELS.join(", ")}`);
  process.exit(2);
}
const rollouts = args.rollouts ? Number(args.rollouts) : undefined;
const opts = { specs: ALL_EFFECT_SPECS, predicateResolver: defaultPredicateResolver, targetFilterResolver: defaultTargetFilterResolver };
const policies = Object.fromEntries(levels.map((level) => [level, () => policyForLevel(level, { ...opts, mctsRollouts: rollouts })]));

const started = Date.now();
const summary = runPuzzleSuite(ALL_PUZZLES, policies, opts);

const pct = (x) => `${(x * 100).toFixed(1)}%`;
const describeAction = (a) => {
  if (!a) return "-";
  const { kind, ...rest } = a;
  return `${kind} ${JSON.stringify(rest)}`;
};
console.log(`[puzzles] ${ALL_PUZZLES.length} situações — meta ≥ ${GOAL * 100}% no nível mais alto\n`);
const chance = summary[levels[0]].chanceRate;
console.log(`acaso        ${pct(chance)}  (média da fração de jogadas legais aceitas — um nível só mede algo ACIMA disto)`);
for (const level of levels) {
  const s = summary[level];
  console.log(`${level.padEnd(12)} ${pct(s.rate)} (${s.correct}/${s.valid})${s.broken ? ` — ${s.broken} quebrada(s)` : ""}`);
}
for (const level of levels) {
  const errors = summary[level].results.filter((r) => r.status !== "acerto");
  if (!errors.length) continue;
  console.log(`\n[puzzles] ${level} — ${errors.length} erro(s)/quebrada(s):`);
  for (const r of errors) {
    if (r.status === "quebrada") {
      console.log(`  QUEBRADA ${r.id}: ${r.brokenReason}`);
    } else {
      console.log(`  ${r.id} (${r.category}) — escolheu ${describeAction(r.chosen)}\n      aceitas: ${r.acceptedDescriptions.join(" | ")}\n      por quê: ${r.why}`);
    }
  }
}

let commit = "desconhecido";
try {
  commit = execSync("git rev-parse --short HEAD", { cwd: ROOT }).toString().trim();
} catch {
  console.warn("[puzzles] não foi possível ler o commit (git indisponível) — gravando 'desconhecido'");
}
const date = new Date().toISOString().slice(0, 10);
const outPath = path.resolve(ROOT, String(args.out ?? `docs/bot/puzzles-${date}.json`));
const report = {
  date,
  commit,
  params: { levels, dificilRollouts: rollouts ?? DIFICIL_ROLLOUTS, puzzles: ALL_PUZZLES.length },
  durationSeconds: Math.round((Date.now() - started) / 1000),
  goal: GOAL,
  chanceRate: summary[levels[0]].chanceRate,
  levels: Object.fromEntries(
    levels.map((level) => {
      const s = summary[level];
      return [
        level,
        {
          rate: s.rate,
          correct: s.correct,
          valid: s.valid,
          broken: s.broken,
          misses: s.results.filter((r) => r.status !== "acerto").map((r) => ({ id: r.id, status: r.status, chosen: r.chosen ?? null, reason: r.brokenReason ?? null })),
        },
      ];
    }),
  ),
};
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`\n[puzzles] relatório: ${path.relative(ROOT, outPath)}`);
