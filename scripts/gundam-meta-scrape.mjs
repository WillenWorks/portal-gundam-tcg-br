#!/usr/bin/env node
/**
 * Coleta as listas de torneio do deckbuilder da Egman Events (spec bot-zero-system-meta-temporada,
 * fase 1). Renderiza a página pública de torneios de cada formato num Chromium headless e lê a
 * tabela do DOM — sem API interna. Só roda local (nunca no CI): a saída tem nome de jogador e vai
 * para `docs/bot/` (fora do git).
 *
 *   pnpm gundam:meta:scrape                          # GD01..GD05, usa o cache
 *   pnpm gundam:meta:scrape -- --formats=GD05 --refresh
 *
 * Opções: --formats (GD01,GD02,GD03,GD04,GD05) · --refresh (ignora o cache) ·
 * --cache (docs/bot/.cache/egman) · --out (docs/bot/meta-raw-<data>.json).
 * Navegador: `pnpm exec playwright install chromium` se ainda não houver um.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { canonicalList, parseDeckbuilderRow } from "./lib/egmanDeckbuilder.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? "true"];
  }),
);
const formats = String(args.formats ?? "GD01,GD02,GD03,GD04,GD05").split(",").map((f) => f.trim().toUpperCase());
const date = new Date().toISOString().slice(0, 10);
const cacheDir = path.resolve(ROOT, String(args.cache ?? "docs/bot/.cache/egman"));
const outFile = path.resolve(ROOT, String(args.out ?? `docs/bot/meta-raw-${date}.json`));
const PAUSE_MS = 1500;
const SOURCE = "https://deckbuilder.egmanevents.com/gundam/tournaments";

/** linhas da tabela com link de deck, com o cabeçalho da própria tabela */
const ROWS_JS = `[...document.querySelectorAll("tr")].map((tr) => {
  const a = tr.querySelector('a[href*="?deck="]');
  if (!a) return null;
  const table = tr.closest("table");
  const headers = table ? [...table.querySelectorAll("thead th")].map((th) => th.innerText) : [];
  return { headers, cells: [...tr.querySelectorAll("td")].map((td) => td.innerText), href: a.href };
}).filter(Boolean)`; // expressão (não função): o page.evaluate devolve o valor

async function renderRows(page, format) {
  await page.goto(`${SOURCE}?format=${format}&tab=all`, { waitUntil: "networkidle", timeout: 90_000 });
  await page.waitForTimeout(2500);
  return page.evaluate(ROWS_JS);
}

fs.mkdirSync(cacheDir, { recursive: true });
const rowsByFormat = {};
let browser = null;
try {
  for (const format of formats) {
    const cacheFile = path.join(cacheDir, `${format}.json`);
    if (fs.existsSync(cacheFile) && args.refresh !== "true") {
      rowsByFormat[format] = JSON.parse(fs.readFileSync(cacheFile, "utf8")).rows;
      console.log(`[meta-scrape] ${format}: ${rowsByFormat[format].length} linhas (cache)`);
      continue;
    }
    if (!browser) {
      const { chromium } = await import("playwright");
      browser = await chromium.launch();
    }
    const page = await browser.newPage({ userAgent: "Mozilla/5.0 (portal-gundam-tcg-br; coleta de meta)" });
    const rows = await renderRows(page, format);
    await page.close();
    if (rows.length === 0) throw new Error(`${format}: nenhuma linha com deck — o site mudou ou não carregou`);
    fs.writeFileSync(cacheFile, `${JSON.stringify({ fetchedAt: new Date().toISOString(), rows })}\n`);
    rowsByFormat[format] = rows;
    console.log(`[meta-scrape] ${format}: ${rows.length} linhas`);
    await new Promise((r) => setTimeout(r, PAUSE_MS));
  }
} finally {
  await browser?.close();
}

const lists = [];
const seen = new Set();
const summary = {};
for (const format of formats) {
  let ok = 0;
  let dup = 0;
  let wrongSize = 0;
  for (const row of rowsByFormat[format]) {
    const list = parseDeckbuilderRow(row, format);
    if (!list) continue;
    const size = Object.values(list.main).reduce((a, b) => a + b, 0);
    if (size !== 50) {
      wrongSize++;
      continue;
    }
    // só a linha repetida sai: a mesma lista de jogadores diferentes no mesmo evento é meta e conta
    const key = `${format}|${list.event}|${list.date}|${list.player}|${list.placing}|${canonicalList(list.main)}`;
    if (seen.has(key)) {
      dup++;
      continue;
    }
    seen.add(key);
    lists.push(list);
    ok++;
  }
  if (ok < rowsByFormat[format].length / 2) throw new Error(`${format}: só ${ok} de ${rowsByFormat[format].length} linhas viraram lista — o parse quebrou?`);
  summary[format] = { rows: rowsByFormat[format].length, lists: ok, duplicates: dup, wrongSize };
  console.log(`[meta-scrape] ${format}: ${ok} listas (${dup} duplicadas, ${wrongSize} fora de 50 cartas)`);
}

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, `${JSON.stringify({ date, source: SOURCE, formats: summary, lists }, null, 1)}\n`);
console.log(`[meta-scrape] ${lists.length} listas → ${path.relative(ROOT, outFile)}`);
