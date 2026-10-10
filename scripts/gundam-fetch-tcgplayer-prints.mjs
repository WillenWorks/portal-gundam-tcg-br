/**
 * Baixa as impressões (normal e paralelas "+") de grupos do TCGplayer pelo espelho público tcgcsv.com (categoria 86 =
 * Gundam Card Game) e grava em `data/tcgplayer-prints.json`: código, raridade, nome, produto e imagem no CDN do
 * TCGplayer — o mesmo CDN das imagens que o catálogo já usa (o site oficial bloqueia exibir as imagens dele em outro
 * domínio). Consumido por `prisma/import-official-set.mjs`.
 *
 *   node scripts/gundam-fetch-tcgplayer-prints.mjs --groups=24800,24801,24802,24803   # ST11–ST14
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "data/tcgplayer-prints.json");
const CATEGORY = 86;

/** produto do tcgcsv → impressão (só cartas: produto com "Number") */
export function toPrint(product, groupName) {
  const ext = Object.fromEntries((product.extendedData ?? []).map((e) => [e.name, e.value]));
  if (!ext.Number) return null;
  const base = `https://tcgplayer-cdn.tcgplayer.com/product/${product.productId}`;
  return {
    code: ext.Number,
    productId: product.productId,
    name: product.name,
    rarity: ext.Rarity ?? null,
    group: groupName,
    url: product.url,
    image: { small: `${base}_200w.jpg`, medium: `${base}_400w.jpg`, large: `${base}_in_1000x1000.jpg` },
  };
}

async function getJson(url) {
  const res = await fetch(url, { headers: { "User-Agent": "AnaheimHub catalog sync" } });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json();
}

async function main() {
  const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")).map(([k, v]) => [k, v ?? true]));
  const groups = String(args.groups ?? "").split(",").map(Number).filter(Boolean);
  if (!groups.length) {
    console.error("uso: node scripts/gundam-fetch-tcgplayer-prints.mjs --groups=24800,24801");
    process.exit(2);
  }
  const names = new Map((await getJson(`https://tcgcsv.com/tcgplayer/${CATEGORY}/groups`)).results.map((g) => [g.groupId, g.name]));
  const current = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : [];
  const byProduct = new Map(current.map((p) => [p.productId, p]));
  for (const groupId of groups) {
    const products = (await getJson(`https://tcgcsv.com/tcgplayer/${CATEGORY}/${groupId}/products`)).results;
    const prints = products.map((p) => toPrint(p, names.get(groupId) ?? String(groupId))).filter(Boolean);
    for (const p of prints) byProduct.set(p.productId, p);
    console.log(`[tcgplayer-prints] ${names.get(groupId)}: ${prints.length} impressões`);
  }
  const all = [...byProduct.values()].sort((a, b) => a.code.localeCompare(b.code) || a.productId - b.productId);
  writeFileSync(OUT, JSON.stringify(all, null, 2) + "\n");
  console.log(`[tcgplayer-prints] ${all.length} impressões em ${path.relative(ROOT, OUT)}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
