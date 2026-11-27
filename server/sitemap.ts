/* sitemap.xml com as páginas públicas fixas + as de detalhe vindas do banco. Só entra o que a página de verdade
 * deixa indexar (mesmas regras de server/routes/htmlPages.ts e src/lib/seoRules.ts): sitemap com URL `noindex`
 * vira alerta no Search Console e gasta rastreio à toa.
 *
 * Gerado em dois momentos: no deploy (scripts/generate-sitemap.ts, dentro da pasta da versão nova) e pelo servidor
 * enquanto roda (createSitemapRefresher), para o artigo publicado entre um deploy e outro entrar logo com `lastmod`
 * novo — o Google relê o sitemap e vê a mudança sem esperar o próximo deploy. */
import fs from "node:fs";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";
import { DECK_MAIN_SIZE } from "../src/lib/deck-legality.ts";
import { playerIsIndexable } from "../src/lib/seoRules.ts";
import { SITE_URL } from "../src/lib/pageMetaRoutes.ts";
import { playerRef, type VedaIndex } from "./vedaCore.ts";

export const SITEMAP_MAX_URLS = 45000; // limite do protocolo é 50.000 por arquivo

export type SitemapEntry = { path: string; lastmod?: Date | string | null; changefreq?: string; priority?: string };

export const STATIC_SITEMAP: SitemapEntry[] = [
  ["/", "daily", "1.0"], ["/cards", "daily", "0.9"], ["/decks", "daily", "0.9"],
  ["/torneios", "daily", "0.8"], ["/stats", "weekly", "0.8"], ["/arquetipos", "weekly", "0.7"],
  ["/metagame/regional", "weekly", "0.6"], ["/rules", "weekly", "0.7"], ["/sets", "weekly", "0.7"],
  ["/series", "weekly", "0.7"], ["/articles", "daily", "0.7"], ["/sobre", "monthly", "0.4"], ["/apoie", "monthly", "0.3"],
  ["/apoiadores", "weekly", "0.3"], ["/privacidade", "yearly", "0.2"], ["/termos", "yearly", "0.2"],
].map(([p, changefreq, priority]) => ({ path: p, changefreq, priority }));

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function day(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

export function renderSitemap(entries: SitemapEntry[]): string {
  const body = entries.slice(0, SITEMAP_MAX_URLS).map((e) => {
    const lastmod = day(e.lastmod);
    return [
      "  <url>",
      `    <loc>${esc(SITE_URL + e.path)}</loc>`,
      lastmod ? `    <lastmod>${lastmod}</lastmod>` : null,
      e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
      e.priority ? `    <priority>${e.priority}</priority>` : null,
      "  </url>",
    ].filter(Boolean).join("\n");
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body.join("\n")}\n</urlset>\n`;
}

/** Jogadores do Veda que a página deixa indexar, com a data do torneio mais recente como `lastmod`. */
export function indexablePlayerEntries(ix: Pick<VedaIndex, "data" | "byId">): SitemapEntry[] {
  const players = new Map<string, { results: Array<{ hasDecklist: boolean }>; last: string | null }>();
  for (const e of ix.data.entries) {
    const t = ix.byId.get(e.tournamentId);
    if (!t) continue; // mesma regra de vedaCore.player: resultado sem torneio não aparece na página
    const slug = playerRef(e.playerName).slug;
    const p = players.get(slug) ?? { results: [], last: null };
    p.results.push({ hasDecklist: !!e.deckSnapshotId });
    const date = t.date ?? t.updatedAt;
    if (date && (!p.last || date > p.last)) p.last = date;
    players.set(slug, p);
  }
  return [...players.entries()]
    .filter(([, p]) => playerIsIndexable(p))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([slug, p]) => ({ path: `/jogadores/${encodeURIComponent(slug)}`, lastmod: p.last, changefreq: "weekly", priority: "0.4" }));
}

export async function sitemapEntries(prisma: PrismaClient, vedaIndex?: () => Promise<Pick<VedaIndex, "data" | "byId">>): Promise<SitemapEntry[]> {
  const [cards, sets, series, posts, tournaments, decks, players] = await Promise.all([
    prisma.cardModel.findMany({ where: { isActive: true }, select: { id: true, updatedAt: true }, orderBy: { code: "asc" } }),
    prisma.cardSet.findMany({ where: { isActive: true }, select: { code: true, updatedAt: true }, orderBy: { code: "asc" } }),
    prisma.taxonomyEntry.findMany({ where: { kind: "SOURCE_TITLE", isActive: true }, select: { slug: true, updatedAt: true }, orderBy: { slug: "asc" } }),
    // rascunho e em revisão ficam fora: para o público a página deles é 404
    prisma.post.findMany({ where: { status: "PUBLISHED" }, select: { slug: true, updatedAt: true, publishedAt: true }, orderBy: { publishedAt: "desc" } }),
    // torneio sem nenhum resultado cadastrado fica de fora (a página dele é noindex: não há o que mostrar)
    prisma.tournament.findMany({ where: { isActive: true, entries: { some: {} } }, select: { id: true, updatedAt: true }, orderBy: { dateStart: "desc" } }),
    prisma.deck.findMany({ where: { visibility: "PUBLIC" }, select: { id: true, shareId: true, updatedAt: true }, orderBy: { updatedAt: "desc" }, take: 10000 }),
    vedaIndex ? vedaIndex().then(indexablePlayerEntries) : Promise.resolve([]),
  ]);
  // Só deck completo (deck principal com 50 cartas) entra: rascunho é página rala e a página dele é noindex
  const mainTotals = decks.length
    ? await prisma.deckItem.groupBy({ by: ["deckId"], where: { deckId: { in: decks.map((d) => d.id) }, section: "main" }, _sum: { quantity: true } })
    : [];
  const completeDecks = new Set(mainTotals.filter((row) => (row._sum.quantity ?? 0) >= DECK_MAIN_SIZE).map((row) => row.deckId));
  const latest = (...dates: Array<Date | null | undefined>) =>
    dates.filter((d): d is Date => d instanceof Date).sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

  return [
    ...STATIC_SITEMAP,
    ...posts.map((p) => ({ path: `/articles/${encodeURIComponent(p.slug)}`, lastmod: latest(p.updatedAt, p.publishedAt), changefreq: "monthly", priority: "0.6" })),
    ...sets.map((s) => ({ path: `/sets/${encodeURIComponent(s.code)}`, lastmod: s.updatedAt, changefreq: "weekly", priority: "0.7" })),
    ...series.map((s) => ({ path: `/series/${encodeURIComponent(s.slug)}`, lastmod: s.updatedAt, changefreq: "monthly", priority: "0.5" })),
    ...tournaments.map((t) => ({ path: `/torneios/${encodeURIComponent(t.id)}`, lastmod: t.updatedAt, changefreq: "monthly", priority: "0.5" })),
    ...players,
    ...cards.map((c) => ({ path: `/cards/${encodeURIComponent(c.id)}`, lastmod: c.updatedAt, changefreq: "monthly", priority: "0.6" })),
    ...decks.filter((d) => completeDecks.has(d.id)).map((d) => ({ path: `/deck/${encodeURIComponent(d.shareId)}`, lastmod: d.updatedAt, changefreq: "monthly", priority: "0.4" })),
  ];
}

/** Grava por arquivo temporário + rename: o nginx nunca entrega um sitemap pela metade. */
export function writeSitemapFile(file: string, xml: string) {
  const tmp = path.join(path.dirname(file), `.sitemap-${process.pid}-${Date.now()}.xml`);
  fs.writeFileSync(tmp, xml);
  fs.renameSync(tmp, file);
}

/** Regrava `<distDir>/sitemap.xml` com o servidor no ar: no boot, a cada `everyMs` e (agrupado em `debounceMs`)
 *  quando algo público muda — artigo publicado, editado ou despublicado. Falha só loga: fica o sitemap anterior. */
export function createSitemapRefresher(opts: {
  distDir: string;
  build: () => Promise<string>;
  debounceMs?: number;
  log?: Pick<Console, "info" | "warn">;
}) {
  const { distDir, build, debounceMs = 30_000, log = console } = opts;
  let timer: NodeJS.Timeout | null = null;
  let running: Promise<void> | null = null;
  let again = false;

  const run = async (): Promise<void> => {
    if (running) {
      again = true;
      return running;
    }
    running = (async () => {
      try {
        if (!fs.existsSync(path.join(distDir, "index.html"))) return; // dev sem build: não há onde gravar
        writeSitemapFile(path.join(distDir, "sitemap.xml"), await build());
      } catch (error) {
        log.warn("[sitemap] não foi possível regravar:", error instanceof Error ? error.message : error);
      }
    })().finally(() => {
      running = null;
    });
    await running;
    if (again) {
      again = false;
      await run();
    }
  };

  return {
    run,
    /** Pede uma regravação; várias seguidas viram uma só. */
    request() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        void run();
      }, debounceMs);
      timer.unref?.();
    },
    start(everyMs = 60 * 60_000, firstMs = 60_000) {
      setTimeout(() => void run(), firstMs).unref();
      setInterval(() => void run(), everyMs).unref();
    },
  };
}
