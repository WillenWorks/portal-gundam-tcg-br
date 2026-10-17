#!/usr/bin/env node
/* Gera dist/sitemap.xml com as páginas públicas fixas + as de detalhe vindas do banco
 * (cartas, coleções, séries, artigos publicados, torneios e decks públicos).
 *
 * Roda no deploy, depois do `vite build`. É best-effort: sem DATABASE_URL ou com o banco
 * fora do ar, mantém o sitemap estático (public/sitemap.xml, já copiado para dist/) e sai 0
 * — o deploy nunca falha por causa do sitemap.
 *
 *   node scripts/generate-sitemap.mjs [--out=dist/sitemap.xml] */
import "dotenv/config";
import { writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const SITE = "https://anaheimhub.com";
const outArg = process.argv.find((a) => a.startsWith("--out="));
const OUT = resolve(outArg ? outArg.slice(6) : "dist/sitemap.xml");
const MAX_URLS = 45000; // limite do protocolo é 50.000 por arquivo

const STATIC = [
  ["/", "daily", "1.0"], ["/cards", "daily", "0.9"], ["/database", "daily", "0.9"], ["/decks", "daily", "0.9"],
  ["/torneios", "daily", "0.8"], ["/stats", "weekly", "0.8"], ["/arquetipos", "weekly", "0.7"],
  ["/metagame/regional", "weekly", "0.6"], ["/rules", "weekly", "0.7"], ["/sets", "weekly", "0.7"],
  ["/series", "weekly", "0.7"], ["/articles", "daily", "0.7"], ["/privacidade/", "yearly", "0.2"], ["/termos/", "yearly", "0.2"],
];

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const day = (d) => (d instanceof Date && !Number.isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : null);

function entry(path, { lastmod, changefreq, priority } = {}) {
  return [
    "  <url>",
    `    <loc>${esc(SITE + path)}</loc>`,
    lastmod ? `    <lastmod>${lastmod}</lastmod>` : null,
    changefreq ? `    <changefreq>${changefreq}</changefreq>` : null,
    priority ? `    <priority>${priority}</priority>` : null,
    "  </url>",
  ].filter(Boolean).join("\n");
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log("sitemap: sem DATABASE_URL — mantido o sitemap estático.");
    return;
  }
  if (!existsSync(resolve(OUT, ".."))) {
    console.log(`sitemap: pasta de saída não existe (${OUT}) — rode depois do build.`);
    return;
  }
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  try {
    const [cards, sets, series, posts, tournaments, decks] = await Promise.all([
      prisma.cardModel.findMany({ where: { isActive: true }, select: { id: true, updatedAt: true }, orderBy: { code: "asc" } }),
      prisma.cardSet.findMany({ select: { code: true, updatedAt: true }, orderBy: { code: "asc" } }),
      prisma.taxonomyEntry.findMany({ where: { kind: "SOURCE_TITLE" }, select: { slug: true, updatedAt: true }, orderBy: { slug: "asc" } }),
      prisma.post.findMany({ where: { status: "PUBLISHED" }, select: { slug: true, updatedAt: true }, orderBy: { publishedAt: "desc" } }),
      prisma.tournament.findMany({ where: { isActive: true }, select: { id: true, updatedAt: true }, orderBy: { dateStart: "desc" } }),
      prisma.deck.findMany({ where: { visibility: "PUBLIC" }, select: { shareId: true, updatedAt: true }, orderBy: { updatedAt: "desc" }, take: 10000 }),
    ]);
    const urls = STATIC.map(([path, changefreq, priority]) => entry(path, { changefreq, priority }));
    for (const s of sets) urls.push(entry(`/sets/${encodeURIComponent(s.code)}`, { lastmod: day(s.updatedAt), changefreq: "weekly", priority: "0.7" }));
    for (const s of series) urls.push(entry(`/series/${encodeURIComponent(s.slug)}`, { lastmod: day(s.updatedAt), changefreq: "monthly", priority: "0.5" }));
    for (const p of posts) urls.push(entry(`/articles/${encodeURIComponent(p.slug)}`, { lastmod: day(p.updatedAt), changefreq: "monthly", priority: "0.6" }));
    for (const t of tournaments) urls.push(entry(`/torneios/${encodeURIComponent(t.id)}`, { lastmod: day(t.updatedAt), changefreq: "monthly", priority: "0.5" }));
    for (const c of cards) urls.push(entry(`/cards/${encodeURIComponent(c.id)}`, { lastmod: day(c.updatedAt), changefreq: "monthly", priority: "0.6" }));
    for (const d of decks) urls.push(entry(`/deck/${encodeURIComponent(d.shareId)}`, { lastmod: day(d.updatedAt), changefreq: "monthly", priority: "0.4" }));
    const body = urls.slice(0, MAX_URLS).join("\n");
    writeFileSync(OUT, `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`);
    console.log(`sitemap: ${Math.min(urls.length, MAX_URLS)} URLs gravadas em ${OUT} (cartas ${cards.length}, coleções ${sets.length}, séries ${series.length}, artigos ${posts.length}, torneios ${tournaments.length}, decks ${decks.length}).`);
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}

main().catch((err) => {
  console.warn(`sitemap: falhou (${err?.message || err}) — mantido o sitemap estático.`);
});
