/*
 * Importa no catálogo (CardSet / CardModel / Card) sets que o apitcg ainda não tem, a partir dos dados oficiais
 * baixados por `scripts/gundam-fetch-official-set.mjs`:
 *   - texto: data/gcg-official-cards.json   - stats/raridade: data/gcg-official-stats.json
 *   - pt-BR: data/translations-*.json        - produto (nome/capa): data/official-products.json
 *   - impressões e imagens: data/tcgplayer-prints.json (`scripts/gundam-fetch-tcgplayer-prints.mjs`)
 * Imagem: CDN do TCGplayer, como o resto do catálogo — o site oficial bloqueia exibir as imagens dele em outro domínio
 * (Cross-Origin-Resource-Policy). Paralelas (C+/LR+) entram como impressões extras do mesmo modelo. Texto gravado no
 * formato do catálogo ([Deploy] … <br>), igual ao `--apply` das traduções (`normalizeForCatalog`).
 *
 * Idempotente (upsert: modelo por código, impressão por externalId `official:<code>[:<produto>]`). Não toca em nenhuma
 * carta fora dos sets pedidos nem em carta do set que já tenha vindo de outra fonte.
 *
 *   node prisma/import-official-set.mjs --sets=ST11,ST12,ST13,ST14            # dry-run (padrão)
 *   node prisma/import-official-set.mjs --sets=ST11,ST12,ST13,ST14 --apply    # grava
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { normalizeForCatalog } from "../scripts/translate-card-effects.mjs";
import { extractKeywords, extractTriggerKeywords } from "./extract-keyword-effects.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (rel) => JSON.parse(readFileSync(path.join(ROOT, rel), "utf8"));

/** Lançamento confirmado nas páginas oficiais dos produtos (gundam-gcg.com/en/products/<set>.html); gravado ao meio-dia UTC pra não virar o dia anterior no fuso do Brasil */
const RELEASE_DATES = { ST11: "2026-09-25", ST12: "2026-09-25", ST13: "2026-09-25", ST14: "2026-09-25" };
const STARTER_NUMBER = (code) => Number(code.slice(2));
const RARITY = { C: "Common", U: "Uncommon", R: "Rare", LR: "Legend Rare", P: "Promo" };
const CARD_TYPE = { UNIT: "UNIT", PILOT: "PILOT", COMMAND: "COMMAND", BASE: "BASE", "UNIT TOKEN": "UNIT" };
const OFFICIAL_DETAIL = (code) => `https://www.gundam-gcg.com/en/cards/detail.php?detailSearch=${code}`;

const int = (v) => {
  const n = Number(String(v ?? "").replace(/^\+/, ""));
  return v === undefined || v === null || v === "" || v === "-" || !Number.isFinite(n) ? null : n;
};
const title = (s) => (s && s !== "-" ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : null);
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function loadTranslations() {
  const byCode = new Map();
  for (const f of readdirSync(path.join(ROOT, "data")).filter((f) => /^translations-.*\.json$/.test(f))) {
    for (const row of readJson(`data/${f}`)) if (row.status === "OK" && row.effectPt) byCode.set(row.code, row.effectPt);
  }
  return byCode;
}

/** linhas do catálogo pra um set: { set, rows: [{ code, model, cards }] } (cards[0] = impressão normal) */
export function buildCatalogRows(setCode, { cards, stats, products, translations, prints = [] }) {
  const product = products.find((p) => p.title?.includes(`[${setCode}]`));
  if (!product) throw new Error(`${setCode}: produto não achado em data/official-products.json`);
  const productName = product.title.replace(/\s*\[[A-Z0-9]+\]\s*$/, "");
  const setCards = cards.filter((c) => c.setCode === setCode).sort((a, b) => a.code.localeCompare(b.code));
  if (!setCards.length) throw new Error(`${setCode}: nenhuma carta em data/gcg-official-cards.json`);
  const sourceTitles = [...new Set(setCards.map((c) => c.sourceTitle).filter((t) => t && t !== "-"))];
  const isStarter = /^ST\d+$/.test(setCode);
  const set = {
    code: setCode,
    nameEn: isStarter ? `Starter Deck ${String(STARTER_NUMBER(setCode)).padStart(2, "0")}: ${productName}` : productName,
    releaseDate: RELEASE_DATES[setCode] ? new Date(`${RELEASE_DATES[setCode]}T12:00:00.000Z`) : null,
    officialUrl: product.productPage ?? null,
    coverImage: `/images/sets/${setCode.toLowerCase()}.webp`,
    setType: isStarter ? "STARTER_DECK" : "BOOSTER_PACK",
    productCodeAlt: slug(isStarter ? `starter-deck-${String(STARTER_NUMBER(setCode)).padStart(2, "0")}-${productName}` : productName),
    sourceTitles,
    metadataJson: { source: "gundam-gcg.com", productImage: product.image ?? null, productPage: product.productPage ?? null },
  };
  const rows = setCards.map((c) => {
    const st = stats[c.code] ?? {};
    const cardType = CARD_TYPE[c.cardType];
    if (!cardType) throw new Error(`${c.code}: tipo "${c.cardType}" sem mapeamento`);
    const isToken = c.cardType === "UNIT TOKEN";
    const effectEn = c.effect && c.effect !== "-" ? normalizeForCatalog(c.effect) : null;
    const pt = translations.get(c.code);
    const effectPt = pt ? normalizeForCatalog(pt) : null;
    const pilotName = (c.effect ?? "").match(/【Pilot】\[([^\]]+)\]/)?.[1] ?? null;
    const shared = {
      code: c.code,
      nameEn: c.name,
      cardType,
      cardSubtypes: [],
      color: title(st.Color),
      level: int(st.Level),
      cost: int(st.Cost),
      ap: int(st["Attack Points"]),
      hp: int(st["Hit Points"]),
      trait: c.traits.join(" | ") || null,
      traits: c.traits,
      series: c.sourceTitle && c.sourceTitle !== "-" ? c.sourceTitle : null,
      sourceTitle: c.sourceTitle && c.sourceTitle !== "-" ? c.sourceTitle : null,
      zone: st.Zone && st.Zone !== "-" ? st.Zone : null,
      linkText: c.link ?? "-",
      pilotName,
      effectEn,
      effectPt,
      triggerKeywords: extractTriggerKeywords(effectEn),
      keywordTags: extractKeywords(effectEn),
      effectKeywords: [],
      legalityStatus: "legal",
      isActive: true,
      deletedAt: null,
    };
    const rarity = isToken ? "Common" : (RARITY[st.Rarity] ?? st.Rarity ?? null);
    const codePrints = prints.filter((p) => p.code === c.code);
    // a impressão normal é a de raridade sem "+"; as paralelas (C+, LR+…) viram impressões extras do mesmo modelo
    const primary = codePrints.find((p) => !p.rarity?.includes("+")) ?? null;
    const parallels = codePrints.filter((p) => p !== primary);
    const originalAttributes = { ...st, Trait: c.traits.map((t) => `(${t})`).join(" "), Link: c.link, Effect: c.effect };
    const cards = [
      printRow(shared, c.code, primary, { externalId: `official:${c.code}`, nameEn: c.name, rarity, isPrimaryPrint: true, originalAttributes }),
      ...parallels.map((p) =>
        printRow(shared, c.code, p, { externalId: `official:${c.code}:${p.productId}`, nameEn: p.name, rarity: p.rarity, isPrimaryPrint: false, originalAttributes }),
      ),
    ];
    return { code: c.code, model: shared, cards };
  });
  return { set, rows };
}

/** uma impressão (Card) — imagem no CDN do TCGplayer, mesmo esquema das cartas que vieram do apitcg */
function printRow(shared, code, print, { externalId, nameEn, rarity, isPrimaryPrint, originalAttributes }) {
  const img = print?.image ?? { small: null, medium: null, large: null };
  const sourceUrl = print?.url ?? OFFICIAL_DETAIL(code);
  return {
    ...shared,
    nameEn,
    externalId,
    rarity,
    isPrimaryPrint,
    imageUrl: img.medium,
    thumbUrl: img.small,
    imageSmallUrl: img.small,
    imageMediumUrl: img.medium,
    imageLargeUrl: img.large,
    imageSourceUrl: print ? "TCGplayer CDN" : null,
    officialUrl: sourceUrl,
    metadataJson: {
      source: "gundam-gcg.com + TCGplayer",
      sourceCode: code,
      officialDetailUrl: OFFICIAL_DETAIL(code),
      tcgplayer: print ? { id: String(print.productId), url: print.url } : null,
      originalAttributes,
      artVariants: print
        ? [
            {
              id: `tcgplayer-image:${print.productId}`,
              label: "TCGplayer",
              url: img.medium,
              thumbUrl: img.small,
              smallUrl: img.small,
              mediumUrl: img.medium,
              largeUrl: img.large,
              sourceUrl,
              rarity,
              isPrimary: true,
              position: 0,
            },
          ]
        : [],
    },
  };
}

async function main() {
  const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")).map(([k, v]) => [k, v ?? true]));
  const sets = String(args.sets ?? "").split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
  if (!sets.length) {
    console.error("uso: node prisma/import-official-set.mjs --sets=ST11,ST12 [--apply]");
    process.exit(2);
  }
  const apply = Boolean(args.apply);
  const data = {
    cards: readJson("data/gcg-official-cards.json").cards,
    stats: readJson("data/gcg-official-stats.json"),
    products: (() => {
      const p = readJson("data/official-products.json");
      return Array.isArray(p) ? p : (p.products ?? Object.values(p));
    })(),
    translations: loadTranslations(),
    prints: readJson("data/tcgplayer-prints.json"),
  };
  const prisma = new PrismaClient();
  try {
    for (const setCode of sets) {
      const { set, rows } = buildCatalogRows(setCode, data);
      const existing = await prisma.card.findMany({ where: { code: { in: rows.map((r) => r.code) } }, select: { code: true, externalId: true } });
      const foreign = existing.filter((e) => e.externalId && !e.externalId.startsWith("official:"));
      console.log(
        `[import-official-set] ${setCode} "${set.nameEn}": ${rows.length} cartas, ${rows.reduce((n, r) => n + r.cards.length, 0)} impressões ` +
          `(${rows.filter((r) => r.model.effectPt).length} com pt-BR, ${rows.filter((r) => !r.cards[0].imageUrl).length} sem imagem), ` +
          `${existing.length} já no banco${foreign.length ? ` — ${foreign.length} de outra fonte (${foreign.map((f) => f.code).join(", ")}), não mexo nelas` : ""}`,
      );
      if (!apply) continue;
      const foreignCodes = new Set(foreign.map((f) => f.code));
      await prisma.$transaction(async (tx) => {
        const savedSet = await tx.cardSet.upsert({
          where: { code: set.code },
          update: { nameEn: set.nameEn, releaseDate: set.releaseDate, officialUrl: set.officialUrl, setType: set.setType, sourceTitles: set.sourceTitles, isActive: true, deletedAt: null },
          create: set,
        });
        for (const r of rows) {
          if (foreignCodes.has(r.code)) continue;
          const model = await tx.cardModel.upsert({ where: { code: r.code }, update: r.model, create: r.model });
          for (const card of r.cards) {
            await tx.card.upsert({
              where: { externalId: card.externalId },
              update: { ...card, cardModelId: model.id, setId: savedSet.id },
              create: { ...card, cardModelId: model.id, setId: savedSet.id },
            });
          }
        }
      });
      console.log(`[import-official-set] ${setCode}: gravado.`);
    }
    if (!apply) console.log("[import-official-set] dry-run — nada gravado (use --apply).");
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
