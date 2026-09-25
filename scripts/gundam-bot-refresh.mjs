#!/usr/bin/env node
/**
 * Um comando pra atualizar o counter do Zero System com os dados cadastrados
 * (spec bot-dados-pool): exporta o pool do banco (+ pools fixos) → matriz de
 * confrontos em paralelo → fixture do counter → (opcional) validação com o difícil.
 * Só gera arquivos; a fixture nova entra no produto num commit revisado.
 *
 *   pnpm gundam:bot:refresh
 *   pnpm gundam:bot:refresh -- --max=40 --games=10 --workers=4 --validate=8
 *   pnpm gundam:bot:refresh -- --pool=docs/bot/pool-db-2026-09-25.json   (pula o export)
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";

const ROOT = path.resolve(import.meta.dirname, "..");
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? "true"];
  }),
);
const date = new Date().toISOString().slice(0, 10);
const poolFile = String(args.pool ?? `docs/bot/pool-db-${date}.json`);
const matrixFile = `docs/bot/matchups-db-${date}.json`;

function step(title, script, scriptArgs) {
  console.log(`\n[refresh] ${title}`);
  const r = spawnSync(process.execPath, [path.join("scripts", script), ...scriptArgs], { cwd: ROOT, stdio: "inherit" });
  if (r.status !== 0) {
    console.error(`[refresh] "${title}" falhou (código ${r.status}) — parei; nada depois disso rodou`);
    process.exit(r.status ?? 1);
  }
}

if (!args.pool) {
  step("1/4 pool a partir do banco (+ pools fixos)", "gundam-bot-pool-export.mjs", ["--with-fixed", `--max=${args.max ?? 40}`, `--out=${poolFile}`]);
}
step("2/4 matriz de confrontos (paralelo)", "gundam-bot-matchups.mjs", [
  `--pool=${poolFile}`,
  `--games=${args.games ?? 10}`,
  ...(args.workers ? [`--workers=${args.workers}`] : []),
  `--out=${matrixFile}`,
]);
step("3/4 fixture do counter", "gundam-bot-counter.mjs", [`--matrix=${matrixFile}`, "--write-fixture"]);
if (args.validate) {
  step("4/4 validação (difícil nos dois lados)", "gundam-bot-counter.mjs", [`--games=${args.validate}`, "--level=dificil"]);
} else {
  console.log("\n[refresh] 4/4 validação pulada (use --validate=8 pra medir contra o difícil; leva horas)");
}
console.log(`\n[refresh] pronto: ${poolFile}, ${matrixFile}, src/modules/simulator/fixtures/zeroCounterMatchups.ts — revise e commite a fixture`);
