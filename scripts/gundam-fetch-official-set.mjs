/**
 * Baixa um set do site oficial (gundam-gcg.com) — lista do pacote + página de detalhe de cada carta — e grava:
 *   - `data/gcg-official-cards.json`: texto oficial (mesmo formato do dataset gcg-api; substitui as cartas do set);
 *   - `data/gcg-official-stats.json`: Lv./custo/cor/AP/HP/zona/raridade por código (o apitcg não tem os sets novos);
 *   - `data/gcg-official-faq.json`: o Q&A oficial de cada carta (referência de autoria do motor).
 * Artes paralelas (`_p1`…) ficam de fora. Tokens do pacote (T-0NN) entram com o set do "Where to get it".
 *
 *   node scripts/gundam-fetch-official-set.mjs --package=616011            # ST11
 *   node scripts/gundam-fetch-official-set.mjs --package=616011,616012     # vários
 *   node scripts/gundam-fetch-official-set.mjs --package=616011 --dry-run  # só imprime
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = "https://www.gundam-gcg.com/en/cards";
const DELAY_MS = 250;

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', "#039": "'", apos: "'", nbsp: " " };
export function decodeEntities(s) {
  return s.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (m, e) => {
    if (ENTITIES[e.toLowerCase()] !== undefined) return ENTITIES[e.toLowerCase()];
    if (e.startsWith("#x")) return String.fromCodePoint(parseInt(e.slice(2), 16));
    if (e.startsWith("#")) return String.fromCodePoint(Number(e.slice(1)));
    return m;
  });
}

/** texto de um bloco HTML do jeito do dataset: `<br>` vira quebra, tags somem, sem espaço nas pontas das linhas */
export function htmlText(html) {
  const text = decodeEntities(html.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, ""));
  return text
    .split("\n")
    .map((l) => l.trim())
    .join("\n")
    .replace(/^\n+|\n+$/g, "");
}

function field(html, title) {
  const re = new RegExp(`<dt class="dataTit">${title}</dt>\\s*<dd class="dataTxt[^"]*">([\\s\\S]*?)</dd>`);
  const m = html.match(re);
  return m ? htmlText(m[1]) : undefined;
}

/** página de detalhe → { card (formato do dataset), stats, faq } */
export function parseDetail(code, html) {
  const name = htmlText(html.match(/<h1 class="cardName">([\s\S]*?)<\/h1>/)?.[1] ?? "");
  const rarity = htmlText(html.match(/<div class="rarity">([\s\S]*?)<\/div>/)?.[1] ?? "");
  const overview = html.match(/<div class="cardDataRow overview">\s*<div class="dataTxt[^"]*">([\s\S]*?)<\/div>/)?.[1];
  const effect = overview !== undefined ? htmlText(overview) || "-" : "-";
  const traitsText = field(html, "Trait") ?? "-";
  const traits = traitsText === "-" ? [] : [...traitsText.matchAll(/\(([^)]+)\)/g)].map((m) => m[1].trim());
  const link = field(html, "Link") ?? "-";
  const where = field(html, "Where to get it") ?? "";
  const setCode = where.match(/\[([A-Z]+\d+)\]/)?.[1] ?? code.split("-")[0];
  const card = {
    code,
    name,
    // o site às vezes escreve "UNIT・TOKEN"; o dataset usa "UNIT TOKEN"
    cardType: (field(html, "TYPE") ?? "").replace(/[・･]/g, " "),
    setCode,
    sourceTitle: field(html, "Source Title") ?? "-",
    traits,
    link,
    linkRefs: link === "-" ? [] : [...link.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1].trim()),
    effect,
    detailUrl: `${BASE}/detail.php?detailSearch=${code}`,
  };
  const stats = {
    Level: field(html, "Lv\\."),
    Cost: field(html, "COST"),
    Color: field(html, "COLOR"),
    "Attack Points": field(html, "AP"),
    "Hit Points": field(html, "HP"),
    Zone: field(html, "Zone"),
    Rarity: rarity,
  };
  const faq = [...html.matchAll(/<div class="qaCol">([\s\S]*?)<\/dl>/g)].map(([, block]) => ({
    id: htmlText(block.match(/<h3 class="qaColNum">([\s\S]*?)<\/h3>/)?.[1] ?? ""),
    date: htmlText(block.match(/<p class="qaColDate">([\s\S]*?)<\/p>/)?.[1] ?? "").replace(/\s*Updated$/, ""),
    question: htmlText(block.match(/<dt class="qaColQuestion">([\s\S]*?)<\/dt>/)?.[1] ?? ""),
    answer: htmlText(block.match(/<dd class="qaColAnswer">([\s\S]*?)<\/dd>/)?.[1] ?? ""),
  }));
  return { card, stats, faq };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(url) {
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (AnaheimHub catalog sync)" } });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.text();
}

/** JSON do dataset: indentação de 2 sem espaços no começo da linha (formato atual do arquivo) */
function writeDataset(file, data) {
  writeFileSync(file, JSON.stringify(data, null, 2).replace(/^ +/gm, "") + "\n");
}

async function main() {
  const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")).map(([k, v]) => [k, v ?? true]));
  const packages = String(args.package ?? "").split(",").filter(Boolean);
  if (!packages.length) {
    console.error("uso: node scripts/gundam-fetch-official-set.mjs --package=616011[,616012] [--dry-run]");
    process.exit(2);
  }
  const fetched = [];
  for (const pkg of packages) {
    const list = await get(`${BASE}/index.php?search=true&package=${pkg}`);
    const codes = [...new Set([...list.matchAll(/detailSearch=([A-Za-z0-9-]+)(?=["&])/g)].map((m) => m[1]))];
    console.log(`[fetch-official] pacote ${pkg}: ${codes.length} cartas (${codes[0]} … ${codes[codes.length - 1]})`);
    for (const code of codes) {
      await sleep(DELAY_MS);
      fetched.push(parseDetail(code, await get(`${BASE}/detail.php?detailSearch=${code}`)));
    }
  }
  if (args["dry-run"]) {
    for (const f of fetched) console.log(JSON.stringify(f));
    return;
  }

  const cardsFile = path.join(REPO, "data/gcg-official-cards.json");
  const dataset = JSON.parse(readFileSync(cardsFile, "utf8"));
  const newCodes = new Set(fetched.map((f) => f.card.code));
  dataset.cards = [...dataset.cards.filter((c) => !newCodes.has(c.code)), ...fetched.map((f) => f.card)];
  dataset.cardCount = dataset.cards.length;
  writeDataset(cardsFile, dataset);

  const statsFile = path.join(REPO, "data/gcg-official-stats.json");
  const stats = existsSync(statsFile) ? JSON.parse(readFileSync(statsFile, "utf8")) : {};
  for (const f of fetched) stats[f.card.code] = f.stats;
  writeFileSync(statsFile, JSON.stringify(Object.fromEntries(Object.entries(stats).sort(([a], [b]) => a.localeCompare(b))), null, 2) + "\n");

  const faqFile = path.join(REPO, "data/gcg-official-faq.json");
  const faq = existsSync(faqFile) ? JSON.parse(readFileSync(faqFile, "utf8")) : {};
  for (const f of fetched) if (f.faq.length) faq[f.card.code] = f.faq;
  writeFileSync(faqFile, JSON.stringify(Object.fromEntries(Object.entries(faq).sort(([a], [b]) => a.localeCompare(b))), null, 2) + "\n");

  const withFaq = fetched.filter((f) => f.faq.length).length;
  console.log(`[fetch-official] ${fetched.length} cartas gravadas (${withFaq} com Q&A) — dataset agora com ${dataset.cardCount}`);
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) await main();
