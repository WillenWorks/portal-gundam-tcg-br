#!/usr/bin/env node
/**
 * Mede o bot na base e no código atual com as MESMAS partidas e compara — numa máquina só, sem
 * mexer na pasta de trabalho: cria uma worktree temporária da base, reaproveita o `node_modules`
 * daqui (junction/symlink), copia para ela os scripts de medição atuais, joga os dois lados EM
 * SEQUÊNCIA (nunca ao mesmo tempo) e remove a worktree no fim.
 *
 *   pnpm gundam:bot:bench:compare -- --base=origin/dev
 *   pnpm gundam:bot:bench:compare -- --base=origin/dev --focus=GD04-ACADEMY-CB --games=6 --workers=12
 *
 * Opções: --base (obrigatória) · --games (10) · --seed (1) · --level (normal) · --focus=a,b ·
 * --workers (padrão do script: núcleos − 1, máx. 6; numa máquina forte passe mais) · --maxDrop (3) ·
 * --keep (não apaga a worktree) · --out (pasta dos relatórios, padrão docs/bot/bench-<data>).
 * Roda com prioridade baixa (`--nice`).
 */
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const ROOT = path.resolve(import.meta.dirname, "..");
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? "true"];
  }),
);
if (!args.base) {
  console.error("uso: gundam-bot-bench-compare.mjs --base=<ref> [--games=10] [--focus=a,b] [--workers=N]");
  process.exit(2);
}

const git = (...a) => execFileSync("git", a, { cwd: ROOT, encoding: "utf8" }).trim();
const date = new Date().toISOString().slice(0, 10);
const outDir = path.resolve(ROOT, String(args.out ?? `docs/bot/bench-${date}`));
fs.mkdirSync(outDir, { recursive: true });
const wt = fs.mkdtempSync(path.join(os.tmpdir(), "bot-bench-base-"));

const MEASURE_FILES = ["scripts/gundam-bot-matchups.mjs", "scripts/lib/matchupRunner.mjs", "scripts/lib/matchupWorker.mjs"];

function run(dir, extra, out) {
  const common = [
    `--level=${args.level ?? "normal"}`,
    `--games=${args.games ?? 10}`,
    `--seed=${args.seed ?? 1}`,
    "--nice",
    `--out=${out}`,
    ...(args.workers ? [`--workers=${args.workers}`] : []),
    ...(args.focus ? [`--focus=${args.focus}`] : []),
    ...extra,
  ];
  const r = spawnSync(process.execPath, [path.join(dir, "scripts/gundam-bot-matchups.mjs"), ...common], { cwd: dir, stdio: "inherit" });
  if (r.status !== 0) throw new Error(`medição falhou em ${dir} (código ${r.status})`);
}
function listDecks(dir) {
  const r = spawnSync(process.execPath, [path.join(dir, "scripts/gundam-bot-matchups.mjs"), "--listDecks"], { cwd: dir, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`não consegui listar os decks em ${dir}: ${r.stderr}`);
  return JSON.parse(r.stdout.trim().split("\n").pop());
}

let exitCode = 0;
try {
  const baseCommit = git("rev-parse", "--short", String(args.base));
  console.log(`[bench-compare] base ${args.base} (${baseCommit}) × atual ${git("rev-parse", "--short", "HEAD")} — worktree ${wt}`);
  git("worktree", "add", "--detach", wt, String(args.base));
  fs.symlinkSync(path.join(ROOT, "node_modules"), path.join(wt, "node_modules"), process.platform === "win32" ? "junction" : "dir");
  // a base pode não ter as opções novas (--decks/--focus/--nice): mede com os scripts de agora
  for (const f of MEASURE_FILES) fs.copyFileSync(path.join(ROOT, f), path.join(wt, f));

  // mesma lista de decks (e na mesma ordem) dos dois lados → mesmas seeds por partida
  const headDecks = listDecks(ROOT);
  const baseDecks = new Set(listDecks(wt));
  const decks = headDecks.filter((id) => baseDecks.has(id));
  const dropped = headDecks.filter((id) => !baseDecks.has(id));
  if (dropped.length) console.log(`[bench-compare] fora da comparação (não existem na base): ${dropped.join(", ")}`);

  const baseOut = path.join(outDir, `base-${baseCommit}.json`);
  const headOut = path.join(outDir, "atual.json");
  run(wt, [`--decks=${decks.join(",")}`], baseOut);
  run(ROOT, [`--decks=${decks.join(",")}`], headOut);
  const cmp = spawnSync(
    process.execPath,
    [path.join(ROOT, "scripts/gundam-bot-compare.mjs"), baseOut, headOut, `--maxDrop=${args.maxDrop ?? 3}`, `--md=${path.join(outDir, "comparacao.md")}`],
    { stdio: "inherit" },
  );
  exitCode = cmp.status ?? 1;
} finally {
  if (args.keep !== "true") {
    // primeiro o link: a remoção da worktree não pode descer nele e apagar o node_modules real
    const link = path.join(wt, "node_modules");
    if (fs.existsSync(link) && fs.lstatSync(link).isSymbolicLink()) fs.unlinkSync(link);
    try {
      git("worktree", "remove", "--force", wt);
    } catch (err) {
      console.warn(`[bench-compare] remova a worktree à mão: git worktree remove --force "${wt}" (${err instanceof Error ? err.message : err})`);
    }
  }
}
process.exit(exitCode);
