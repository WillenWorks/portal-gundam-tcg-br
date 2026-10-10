#!/usr/bin/env node
/**
 * Gera a fixture `src/modules/simulator/fixtures/metaCores.ts` (núcleo dos arquétipos por
 * temporada) a partir da coleta do `gundam-meta-scrape.mjs` (spec bot-zero-system-meta-temporada,
 * fase 1). A saída não leva nome de jogador.
 *
 *   pnpm gundam:meta:cores                                   # usa o meta-raw-*.json mais recente
 *   pnpm gundam:meta:cores -- --raw=docs/bot/meta-raw-2026-10-05.json --check
 *
 * --check: só compara com a fixture atual (sai 1 se mudou), não grava.
 */
import { register } from "tsx/esm/api";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

register();

const ROOT = path.resolve(import.meta.dirname, "..");
const sim = (p) => pathToFileURL(path.join(ROOT, "src/modules/simulator", p)).href;
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? "true"];
  }),
);

function latestRaw() {
  const dir = path.join(ROOT, "docs/bot");
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /^meta-raw-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort() : [];
  if (!files.length) throw new Error("nenhum docs/bot/meta-raw-*.json — rode antes `pnpm gundam:meta:scrape`");
  return path.join(dir, files.at(-1));
}

const rawFile = path.resolve(ROOT, String(args.raw ?? latestRaw()));
const raw = JSON.parse(fs.readFileSync(rawFile, "utf8"));
const { analyzeFormat } = await import(sim("meta/coreAnalysis.ts"));
const { getCardDefByCode } = await import(sim("content/allCardDefs.ts"));
const catalog = (code) => {
  const d = getCardDefByCode(code);
  return d ? { type: d.type, level: d.level ?? 0, color: d.color } : undefined;
};

const byFormat = new Map();
for (const l of raw.lists) byFormat.set(l.format, [...(byFormat.get(l.format) ?? []), l]);
const formats = {};
for (const f of [...byFormat.keys()].sort()) {
  // só os campos que a análise usa — o `player` fica para trás
  const lists = byFormat.get(f).map(({ format, event, eventType, date, placing, label, main }) => ({ format, event, eventType, date, placing, label, main }));
  formats[f] = analyzeFormat(lists, catalog);
  const r = formats[f];
  console.log(`[meta-cores] ${f}: ${r.lists} listas, ${r.events} eventos, ${r.archetypes.length} arquétipos (${r.archetypes.filter((a) => a.simulavel).length} simuláveis)`);
}

// Recortes de temporada dentro de um formato da Egman: um starter novo não muda o formato lá, mas muda o meta.
// GD05.5 = listas do GD05 a partir do lançamento do ST11–ST14 (25/09/2026).
const SEASON_SLICES = [{ id: "GD05.5", format: "GD05", since: "2026-09-25" }];
for (const slice of SEASON_SLICES) {
  const lists = (byFormat.get(slice.format) ?? [])
    .filter((l) => (l.date ?? "") >= slice.since)
    .map(({ event, eventType, date, placing, label, main }) => ({ format: slice.id, event, eventType, date, placing, label, main }));
  if (!lists.length) continue;
  formats[slice.id] = analyzeFormat(lists, catalog);
  const r = formats[slice.id];
  console.log(`[meta-cores] ${slice.id} (${slice.format} desde ${slice.since}): ${r.lists} listas, ${r.events} eventos, ${r.archetypes.length} arquétipos (${r.archetypes.filter((a) => a.simulavel).length} simuláveis)`);
}

const data = { generatedAt: raw.date, source: raw.source, formats };
const body = `import type { MetaCoreFile } from "../meta/coreAnalysis";

/**
 * Núcleo dos arquétipos por temporada (spec bot-zero-system-meta-temporada). GERADA por
 * \`pnpm gundam:meta:cores\` a partir de ${path.basename(rawFile)} (listas de torneio da Egman Events) — não editar à mão.
 */
export const META_CORES: MetaCoreFile = ${JSON.stringify(data)};
`;

const FIXTURE = path.join(ROOT, "src/modules/simulator/fixtures/metaCores.ts");
if (args.check === "true") {
  // o checkout no Windows pode trazer CRLF
  const same = fs.existsSync(FIXTURE) && fs.readFileSync(FIXTURE, "utf8").replace(/\r\n/g, "\n") === body;
  console.log(same ? "[meta-cores] fixture em dia" : "[meta-cores] fixture desatualizada");
  process.exit(same ? 0 : 1);
}
fs.writeFileSync(FIXTURE, body);
console.log(`[meta-cores] ${path.relative(ROOT, FIXTURE)} (${Math.round(body.length / 1024)} KB)`);
