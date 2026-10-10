/**
 * Relatório de desempenho por deck a partir das matrizes de confronto por temporada (workflow `bot-matrix.yml`).
 * Para cada temporada lê `<dir>/pool-<F>.json` (de `gundam-bot-season-pool.mjs`) e `<dir>/matrix-<F>.json`
 * (`gundam-bot-merge.mjs`) e escreve um Markdown + JSON com: aproveitamento de cada deck (intervalo de Wilson 95%),
 * partidas jogadas, melhores/piores confrontos e o comparativo entre as versões (variantes) de cada arquétipo.
 *
 *   node scripts/gundam-bot-season-report.mjs --dir=matrices --formats=GD05,GD05.5 --out=relatorio-bot-matriz.md
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const Z = 1.96;
const pct = (x) => `${(100 * x).toFixed(1)}%`;

/** intervalo de Wilson pra proporção p em n tentativas */
export function wilson(p, n) {
  if (!n) return [0, 1];
  const denom = 1 + (Z * Z) / n;
  const center = (p + (Z * Z) / (2 * n)) / denom;
  const half = (Z * Math.sqrt((p * (1 - p)) / n + (Z * Z) / (4 * n * n))) / denom;
  return [Math.max(0, center - half), Math.min(1, center + half)];
}

/** estatística por deck de uma matriz (results: {a, b, scoreA}) */
export function deckStats(pool, matrix) {
  const ids = matrix.decks;
  const byId = new Map(pool.decks.map((d) => [d.id, d]));
  const n = ids.length;
  const score = Array.from({ length: n }, () => Array(n).fill(0));
  const games = Array.from({ length: n }, () => Array(n).fill(0));
  for (const r of matrix.results ?? []) {
    if (typeof r.scoreA !== "number") continue;
    score[r.a][r.b] += r.scoreA;
    score[r.b][r.a] += 1 - r.scoreA;
    games[r.a][r.b] += 1;
    games[r.b][r.a] += 1;
  }
  return ids.map((id, i) => {
    let s = 0;
    let g = 0;
    const vs = [];
    for (let j = 0; j < n; j++) {
      if (j === i || !games[i][j]) continue;
      s += score[i][j];
      g += games[i][j];
      vs.push({ id: ids[j], rate: score[i][j] / games[i][j], games: games[i][j] });
    }
    const rate = g ? s / g : 0;
    vs.sort((x, y) => y.rate - x.rate);
    const deck = byId.get(id);
    return { id, label: deck?.label ?? id, archetype: deck?.archetype ?? null, rate, games: g, ci: wilson(rate, g), best: vs.slice(0, 3), worst: vs.slice(-3).reverse() };
  });
}

function sectionFor(format, pool, matrix, validation) {
  const stats = deckStats(pool, matrix).sort((a, b) => b.rate - a.rate);
  const label = (id) => pool.decks.find((d) => d.id === id)?.label ?? id;
  const lines = [];
  lines.push(`## ${format}`, "");
  lines.push(
    `${stats.length} decks · ${matrix.results?.length ?? 0} partidas · nível ${matrix.params?.level ?? "?"} · ${matrix.params?.gamesPerPair ?? "?"} por par · regras \`${matrix.rulesSha ?? "?"}\`` +
      (matrix.excluded?.length ? ` · ${matrix.excluded.length} partidas excluídas por erro` : ""),
  );
  if (validation?.rejeitados?.length) {
    lines.push("", `Decks rejeitados na validação: ${validation.rejeitados.map((r) => `${r.id} (${r.motivo})`).join("; ")}`);
  }
  lines.push("", "| # | Deck | Aproveitamento | IC 95% | Partidas | Melhor confronto | Pior confronto |", "|---|---|---|---|---|---|---|");
  stats.forEach((s, i) => {
    const b = s.best[0];
    const w = s.worst[0];
    lines.push(
      `| ${i + 1} | ${s.label} | **${pct(s.rate)}** | ${pct(s.ci[0])}–${pct(s.ci[1])} | ${s.games} | ${b ? `${label(b.id)} (${pct(b.rate)})` : "—"} | ${w ? `${label(w.id)} (${pct(w.rate)})` : "—"} |`,
    );
  });
  const byArch = new Map();
  for (const s of stats) if (s.archetype) byArch.set(s.archetype, [...(byArch.get(s.archetype) ?? []), s]);
  const multi = [...byArch.values()].filter((v) => v.length > 1);
  if (multi.length) {
    lines.push("", "### Versões do mesmo arquétipo", "");
    for (const versions of multi) {
      lines.push(`- ${versions.map((v) => `${v.label}: ${pct(v.rate)}`).join(" · ")}`);
    }
  }
  lines.push("");
  return { lines, stats };
}

async function main() {
  const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")).map(([k, v]) => [k, v ?? "true"]));
  const dir = path.resolve(String(args.dir ?? "."));
  const formats = String(args.formats ?? "").split(",").filter(Boolean);
  const out = path.resolve(String(args.out ?? "relatorio-bot-matriz.md"));
  const md = ["# Desempenho por deck — matriz de confrontos do bot", ""];
  md.push(
    "Cada deck jogou contra todos os outros da mesma temporada, com o bot no mesmo nível dos dois lados e alternando o assento. O aproveitamento é a fração de pontos (vitória 1, empate ½); o IC é o intervalo de Wilson de 95%.",
    "",
  );
  const json = {};
  for (const f of formats) {
    const read = (name) => {
      const p = path.join(dir, name);
      return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : null;
    };
    const pool = read(`pool-${f}.json`);
    const matrix = read(`matrix-${f}.json`);
    if (!pool || !matrix) {
      md.push(`## ${f}`, "", "_Sem resultado (matriz ou pool ausente)._", "");
      continue;
    }
    const { lines, stats } = sectionFor(f, pool, matrix, read(`pool-${f}.validacao.json`));
    md.push(...lines);
    json[f] = stats;
  }
  fs.writeFileSync(out, `${md.join("\n")}\n`);
  fs.writeFileSync(out.replace(/\.md$/, ".json"), `${JSON.stringify(json, null, 1)}\n`);
  console.log(`[season-report] ${Object.keys(json).length} temporadas → ${out}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
