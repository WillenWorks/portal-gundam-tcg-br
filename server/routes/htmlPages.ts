/* Páginas do site servidas pela API: o index.html do build com título, descrição, imagem de prévia e
 * JSON-LD da página pedida (ver server/htmlMeta.ts) e 404 de verdade para endereços que não existem.
 * O nginx manda as páginas para cá e, se a API cair, entrega o index.html puro. */
import fs from "node:fs";
import path from "node:path";
import type { Express } from "express";
import type { PrismaClient } from "@prisma/client";
import { createPageCache, renderHtml, resolveHtmlPage, type DetailLoaders } from "../htmlMeta.ts";
import { GAME_COLOR_LABEL_PT } from "../../src/lib/gundam-catalog.ts";

/** Endereços que não são páginas do site (API, sockets, arquivos). */
export const HTML_PAGE_ROUTE = /^\/(?!api(?:\/|$)|socket\.io|social\.io|uploads\/|assets\/).*/;

/** Lê o index.html do build; relê quando o arquivo muda (deploy atômico troca o link `dist`). */
export function createIndexHtmlReader(distDir: string) {
  let cache: { key: string; html: string } | null = null;
  return function readIndexHtml(): string | null {
    try {
      const file = path.join(distDir, "index.html");
      // `dist` pode ser um link para a versão publicada (deploy atômico): realpath + mtime trocam a chave
      const key = `${fs.realpathSync(file)}:${fs.statSync(file).mtimeMs}`;
      if (cache?.key !== key) cache = { key, html: fs.readFileSync(file, "utf8") };
      return cache.html;
    } catch {
      return null;
    }
  };
}

const CARD_TYPE_PT: Record<string, string> = {
  UNIT: "Unidade", PILOT: "Piloto", COMMAND: "Comando", COMMAND_PILOT: "Comando (Piloto)", BASE: "Base",
  RESOURCE: "Recurso", EX_BASE: "EX Base", EX_RESOURCE: "EX Recurso", UNIT_TOKEN: "Ficha de Unidade",
};
const colorPt = (color?: string | null) => {
  if (!color) return "";
  const key = color.charAt(0).toUpperCase() + color.slice(1).toLowerCase();
  return GAME_COLOR_LABEL_PT[key] ?? color;
};
const dayPt = (date?: Date | null) => (date ? new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" }).format(date) : "");

/** Metadados das páginas de detalhe, lidos do banco. `null` = não existe (vira 404). */
export function createHtmlDetailLoaders(prisma: PrismaClient): DetailLoaders {
  return {
    card: async (key) => {
      const card = await prisma.cardModel.findFirst({
        where: { OR: [{ id: key }, { code: key }], isActive: true },
        select: { code: true, nameEn: true, namePt: true, cardType: true, color: true, level: true, cost: true, prints: { where: { isActive: true }, select: { imageMediumUrl: true, imageUrl: true }, take: 1 } },
      });
      if (!card) return null;
      const name = card.namePt || card.nameEn;
      const traits = [CARD_TYPE_PT[card.cardType] ?? card.cardType, colorPt(card.color), card.level != null ? `nível ${card.level}` : "", card.cost != null ? `custo ${card.cost}` : ""].filter(Boolean).join(", ");
      return {
        title: `${name} (${card.code})`,
        description: `Carta ${card.code} de Gundam Card Game: ${traits}. Veja as impressões, as regras e em quais decks ela aparece.`,
        image: card.prints[0]?.imageMediumUrl || card.prints[0]?.imageUrl,
      };
    },
    deck: async (key) => {
      const deck = await prisma.deck.findUnique({
        where: { shareId: key },
        select: { name: true, visibility: true, coverImage: true, user: { select: { displayName: true, username: true } }, items: { select: { quantity: true, section: true } } },
      });
      if (!deck || deck.visibility === "PRIVATE") return null;
      const main = deck.items.filter((i) => i.section === "main").reduce((sum, i) => sum + i.quantity, 0);
      const author = deck.user?.displayName || deck.user?.username;
      return {
        title: deck.name,
        description: `Deck${author ? ` de ${author}` : ""} para Gundam Card Game${main ? `, com ${main} cartas no deck principal` : ""}: lista completa, curva de custo e estatísticas.`,
        image: deck.coverImage,
        noindex: deck.visibility !== "PUBLIC",
      };
    },
    set: async (key) => {
      const set = await prisma.cardSet.findUnique({ where: { code: key }, select: { code: true, nameEn: true, namePt: true, releaseDate: true, coverImage: true, isActive: true } });
      if (!set || !set.isActive) return null;
      const name = set.namePt || set.nameEn;
      return {
        title: `${name} (${set.code})`,
        description: `Coleção ${set.code} de Gundam Card Game${set.releaseDate ? `, lançada em ${dayPt(set.releaseDate)}` : ""}: todas as cartas da coleção, com filtros e imagens.`,
        image: set.coverImage,
      };
    },
    series: async (key) => {
      const series = await prisma.taxonomyEntry.findFirst({ where: { kind: "SOURCE_TITLE", slug: key, isActive: true }, select: { name: true, description: true, coverImage: true } });
      if (!series) return null;
      return { title: series.name, description: series.description || `Cartas de Gundam Card Game da série ${series.name}.`, image: series.coverImage };
    },
    article: async (key) => {
      const post = await prisma.post.findFirst({ where: { slug: key, status: "PUBLISHED" }, select: { title: true, excerpt: true, coverImage: true, publishedAt: true, updatedAt: true } });
      if (!post) return null;
      return {
        title: post.title,
        description: post.excerpt || undefined,
        image: post.coverImage,
        jsonLd: [{
          "@context": "https://schema.org", "@type": "Article", headline: post.title.slice(0, 110),
          ...(post.publishedAt ? { datePublished: post.publishedAt.toISOString() } : {}), dateModified: post.updatedAt.toISOString(),
          publisher: { "@type": "Organization", name: "Anaheim Hub", url: "https://anaheimhub.com" },
        }],
      };
    },
    tournament: async (key) => {
      const t = await prisma.tournament.findFirst({ where: { id: key, isActive: true }, select: { name: true, organizer: true, city: true, country: true, dateStart: true, participantCount: true } });
      if (!t) return null;
      return {
        title: t.name,
        description: `Resultados de ${t.name}${t.city ? `, em ${t.city}` : ""}${t.dateStart ? ` (${dayPt(t.dateStart)})` : ""}: classificação, pódio e decks${t.participantCount ? ` de ${t.participantCount} jogadores` : ""}.`,
        jsonLd: [{
          "@context": "https://schema.org", "@type": "Event", name: t.name,
          ...(t.dateStart ? { startDate: t.dateStart.toISOString() } : {}),
          ...(t.city ? { location: { "@type": "Place", name: t.organizer || t.city, address: { "@type": "PostalAddress", addressLocality: t.city, ...(t.country ? { addressCountry: t.country } : {}) } } } : {}),
          ...(t.organizer ? { organizer: { "@type": "Organization", name: t.organizer } } : {}),
        }],
      };
    },
  };
}

/** Registra a rota das páginas. Sem index.html (dev sem build) → segue para o próximo handler. */
export function registerHtmlPages(app: Express, { distDir, loaders }: { distDir: string; loaders: DetailLoaders }) {
  const readIndexHtml = createIndexHtmlReader(distDir);
  const pageCache = createPageCache();

  app.get(HTML_PAGE_ROUTE, async (req, res, next) => {
    const template = readIndexHtml();
    if (!template) return next();
    res.setHeader("Cache-Control", "no-cache");
    res.type("html");
    try {
      const page = await pageCache(req.path, () => resolveHtmlPage(req.path, loaders));
      res.status(page.status).send(renderHtml(template, page));
    } catch (error) {
      // banco fora do ar: entrega o index.html do build como antes (o React monta a página do mesmo jeito)
      console.error("[html] metadados indisponíveis para", req.path, error instanceof Error ? error.message : error);
      res.status(200).send(template);
    }
  });
}
