/*
 * Fase 4 do A5 — o que o treino entrega ao Zero System.
 *
 * O counter do Zero System escolhe o deck pela matriz de confrontos em
 * `src/modules/simulator/fixtures/zeroCounterMatchups.ts`. Este script compara uma matriz nova
 * (`gundam:bot:matchups`, gravada em docs/bot/) com a que está em uso e escreve um relatório:
 * decks que entram/saem, maiores mudanças de taxa e se a matriz foi medida com as regras atuais.
 * NÃO troca a matriz do produto: isso é decisão do usuário, numa PR, com o comando do relatório.
 *
 *   pnpm train:zero-matrix                                  (usa o docs/bot/matchups-*.json mais novo)
 *   pnpm train:zero-matrix -- --matrix=docs/bot/matchups-2026-10-04-sets-novos.json
 *   pnpm train:zero-matrix -- --out=docs/bot/zero-matrix-relatorio.md
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { computeEngineSha } from "./engineHash.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const TOP_CHANGES = 10;

/** Taxa do deck da linha contra o da coluna, por nome — independe da ordem dos decks em cada matriz. */
function rateByPair(table) {
  const map = new Map();
  table.decks.forEach((row, i) => {
    table.decks.forEach((col, j) => {
      const r = table.rate[i]?.[j];
      if (i !== j && typeof r === "number") map.set(`${row}|${col}`, r);
    });
  });
  return map;
}

export function compareMatrices(current, next) {
  const cur = new Set(current.decks);
  const nxt = new Set(next.decks);
  const curRates = rateByPair(current);
  const changes = [];
  for (const [pair, rate] of rateByPair(next)) {
    const before = curRates.get(pair);
    if (before === undefined) continue;
    const [row, col] = pair.split("|");
    if (row > col) continue; // A×B e B×A são complementares: um par só
    changes.push({ row, col, before, after: rate, delta: rate - before });
  }
  changes.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  return {
    added: next.decks.filter((d) => !cur.has(d)),
    removed: current.decks.filter((d) => !nxt.has(d)),
    common: next.decks.filter((d) => cur.has(d)),
    biggestChanges: changes.slice(0, TOP_CHANGES),
  };
}

function newestMatrix() {
  const dir = path.join(ROOT, "docs", "bot");
  if (!fs.existsSync(dir)) return null;
  const files = fs
    .readdirSync(dir)
    .filter((f) => /^matchups-.*\.json$/.test(f))
    .map((f) => path.join(dir, f))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  return files[0] ?? null;
}

const pct = (r) => `${Math.round(r * 100)}%`;

export function renderReport({ matrixPath, report, current, comparison, currentRulesSha }) {
  const rel = path.relative(ROOT, matrixPath).split(path.sep).join("/");
  const rulesLine = report.rulesSha
    ? report.rulesSha === currentRulesSha
      ? `medida com as regras atuais (\`${currentRulesSha}\`)`
      : `**medida com outras regras** (\`${report.rulesSha}\`; atuais \`${currentRulesSha}\`) — gere de novo antes de usar`
    : `sem versão das regras registrada (commit \`${report.commit ?? "?"}\`, anterior a 2026-10-09) — **gere de novo** antes de usar`;
  const lines = [
    `# Matriz de confrontos para o Zero System — ${new Date().toISOString().slice(0, 10)}`,
    "",
    `- Matriz nova: \`${rel}\` (${report.decks.length} decks, ${report.params?.gamesPerPair ?? "?"} partidas/par, nível ${report.params?.level ?? "?"}) — ${rulesLine}.`,
    `- Matriz em uso no counter: ${current.decks.length} decks, ${current.gamesPerPair ?? "?"} partidas/par.`,
    `- Entram (${comparison.added.length}): ${comparison.added.join(", ") || "—"}`,
    `- Saem (${comparison.removed.length}): ${comparison.removed.join(", ") || "—"}`,
    "",
    "## Maiores mudanças entre decks presentes nas duas",
    "",
    "| Deck | Contra | Antes | Agora | Δ |",
    "|---|---|---|---|---|",
    ...comparison.biggestChanges.map(
      (c) => `| ${c.row} | ${c.col} | ${pct(c.before)} | ${pct(c.after)} | ${c.delta > 0 ? "+" : ""}${Math.round(c.delta * 100)} pp |`,
    ),
    "",
    "## Para usar esta matriz no counter (decisão do usuário, PR para dev)",
    "",
    "```bash",
    `pnpm gundam:bot:counter -- --matrix=${rel} --write-fixture`,
    "pnpm gundam:bot:counter -- --games=8 --level=dificil --seed=7   # valida: counter ≥ 60% com Wilson > 50%",
    "```",
    "",
  ];
  return lines.join("\n");
}

async function main() {
  const args = Object.fromEntries(
    process.argv
      .slice(2)
      .filter((a) => a.startsWith("--"))
      .map((a) => {
        const [k, v] = a.replace(/^--/, "").split("=");
        return [k, v ?? true];
      }),
  );
  const matrixPath = args.matrix ? path.resolve(ROOT, String(args.matrix)) : newestMatrix();
  if (!matrixPath || !fs.existsSync(matrixPath)) {
    console.error("[zero-matrix] nenhuma matriz encontrada: rode `pnpm gundam:bot:matchups -- --pool=all` ou passe --matrix=");
    process.exit(1);
  }
  const report = JSON.parse(fs.readFileSync(matrixPath, "utf8"));
  const { register } = await import("tsx/esm/api");
  register();
  const fixture = await import(pathToFileURL(path.join(ROOT, "src/modules/simulator/fixtures/zeroCounterMatchups.ts")).href);
  const current = fixture.ZERO_COUNTER_MATCHUPS;
  const comparison = compareMatrices(current, report);
  const md = renderReport({ matrixPath, report, current, comparison, currentRulesSha: computeEngineSha(ROOT) });
  const out = path.resolve(ROOT, String(args.out ?? `docs/bot/zero-matrix-${new Date().toISOString().slice(0, 10)}.md`));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, md);
  console.log(md);
  console.log(`[zero-matrix] relatório: ${path.relative(ROOT, out)}`);
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) await main();
