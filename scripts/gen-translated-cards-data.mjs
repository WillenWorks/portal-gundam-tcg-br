/*
 * Gera `src/i18n/translatedCardsData.ts` a partir de todos os `data/translations-*.json` (lotes revisados de
 * `scripts/translate-card-effects.mjs`). Só entram as cartas com status OK; a cópia é o fallback de texto em pt-BR
 * do simulador enquanto o banco não tiver o `effectPt` gravado (`--push`).
 *
 *   node scripts/gen-translated-cards-data.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA_DIR = path.join(ROOT, "data");
const OUT = path.join(ROOT, "src", "i18n", "translatedCardsData.ts");

export function collectTranslations(files) {
  const byCode = new Map();
  for (const file of files) {
    for (const row of JSON.parse(fs.readFileSync(file, "utf8"))) {
      if (row.status !== "OK" || !row.code) continue;
      const en = (row.effectEn ?? "").trim();
      const pt = (row.effectPt ?? "").trim();
      const entry = {};
      if (pt && pt !== en) entry.pt = pt;
      if (en) entry.en = en;
      if (entry.pt || entry.en) byCode.set(row.code.toUpperCase(), entry);
    }
  }
  return new Map([...byCode.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

function main() {
  const files = fs
    .readdirSync(DATA_DIR)
    .filter((f) => /^translations-.*\.json$/.test(f))
    .sort()
    .map((f) => path.join(DATA_DIR, f));
  const map = collectTranslations(files);
  const body = JSON.stringify(Object.fromEntries(map), null, 2);
  const withPt = [...map.values()].filter((e) => e.pt).length;
  fs.writeFileSync(
    OUT,
    `/**
 * Traduções pt-BR dos efeitos de carta (GERADO por \`node scripts/gen-translated-cards-data.mjs\` a partir de
 * data/translations-*.json — não editar à mão). ${map.size} cartas, ${withPt} com texto em pt-BR.
 * Importado sob demanda (\`import()\`) pelo simulador: não entra no carregamento inicial do site.
 */
export const PRECOMPILED_CARD_TRANSLATIONS: Record<string, { pt?: string; en?: string }> = ${body};
`,
  );
  console.log(`[gen-translated-cards-data] ${map.size} cartas (${withPt} com pt-BR) -> ${path.relative(ROOT, OUT)}`);
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) main();
