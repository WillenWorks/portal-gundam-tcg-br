/* Páginas do site servidas pela API: o index.html do build com título, descrição, imagem de prévia e
 * JSON-LD da página pedida (ver server/htmlMeta.ts) e 404 de verdade para endereços que não existem.
 * O nginx manda as páginas para cá e, se a API cair, entrega o index.html puro. */
import fs from "node:fs";
import path from "node:path";
import type { Express } from "express";
import type { PrismaClient } from "@prisma/client";
import { createPageCache, renderHtml, resolveHtmlPage, type BodyLoader, type DetailLoaders } from "../htmlMeta.ts";
import {
  articleBody, articlesIndexBody, cardBody, deckBody, decksIndexBody, rulesBody, rulingBody, seriesBody, seriesIndexBody,
  setBody, setsIndexBody, tournamentBody, tournamentsIndexBody, type CardRow,
} from "../htmlContent.ts";
import { ALL_KEYWORDS } from "../../src/i18n/keywords.ts";
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

const SET_KIND_PT: Record<string, string> = {
  BOOSTER_PACK: "Booster", STARTER_DECK: "Starter deck", ACCESSORIES: "Acessórios", PREMIUM_BANDAI: "Premium Bandai", OTHER: "Outro",
};
const RULE_SOURCE_PT: Record<string, string> = {
  OFFICIAL_FAQ: "FAQ oficial", OFFICIAL_RULES: "Regras oficiais", COMMUNITY_EXPLAINER: "Explicação da comunidade",
};
const cardName = (c: { namePt?: string | null; nameEn: string }) => c.namePt || c.nameEn;
const typePt = (t: string) => CARD_TYPE_PT[t] ?? t;
const placeOf = (t: { city?: string | null; country?: string | null }) => [t.city, t.country].filter(Boolean).join(", ") || undefined;

const CARD_ROW_SELECT = { id: true, code: true, nameEn: true, namePt: true, cardType: true, color: true, level: true, cost: true } as const;
type CardRowSource = { id: string; code: string; nameEn: string; namePt: string | null; cardType: string; color: string | null; level: number | null; cost: number | null };
const toCardRow = (c: CardRowSource): CardRow => ({ id: c.id, code: c.code, name: cardName(c), typeLabel: typePt(c.cardType), colorLabel: colorPt(c.color), level: c.level, cost: c.cost });

/** Cartas (modelos) com pelo menos uma impressão que satisfaz `printWhere`, sem repetir o modelo. */
async function cardRowsFor(prisma: PrismaClient, printWhere: Record<string, unknown>): Promise<CardRow[]> {
  const models = await prisma.cardModel.findMany({
    where: { isActive: true, cardType: { notIn: ["RESOURCE", "EX_RESOURCE", "UNIT_TOKEN"] }, prints: { some: { isActive: true, ...printWhere } } },
    select: CARD_ROW_SELECT,
    orderBy: { code: "asc" },
    take: 600,
  });
  return models.map(toCardRow);
}

/** Metadados e conteúdo das páginas de detalhe, lidos do banco. `null` = não existe (vira 404). */
export function createHtmlDetailLoaders(prisma: PrismaClient): DetailLoaders {
  return {
    card: async (key) => {
      const card = await prisma.cardModel.findFirst({
        where: { OR: [{ id: key }, { code: key }], isActive: true },
        select: {
          id: true, code: true, nameEn: true, namePt: true, cardType: true, color: true, level: true, cost: true, ap: true, hp: true,
          traits: true, trait: true, series: true, sourceTitle: true, zone: true, linkText: true, effectPt: true, effectEn: true,
          prints: { where: { isActive: true }, orderBy: [{ isPrimaryPrint: "desc" }, { code: "asc" }], select: { id: true, code: true, printLabel: true, rarity: true, imageMediumUrl: true, imageUrl: true, set: { select: { code: true, nameEn: true, namePt: true, isActive: true } } } },
          rulings: { where: { isActive: true }, select: { title: true, questionPt: true, answerPt: true, questionEn: true, answerEn: true } },
        },
      });
      if (!card) return null;
      const name = cardName(card);
      const traits = [typePt(card.cardType), colorPt(card.color), card.level != null ? `nível ${card.level}` : "", card.cost != null ? `custo ${card.cost}` : ""].filter(Boolean).join(", ");
      // rulings cadastrados numa impressão específica também valem para a carta
      const printRulings = await prisma.ruling.findMany({
        where: { isActive: true, cardModelId: null, cardId: { in: card.prints.map((p) => p.id) } },
        select: { title: true, questionPt: true, answerPt: true, questionEn: true, answerEn: true },
      });
      const rulings = [...card.rulings, ...printRulings].map((r) => ({ title: r.title, question: r.questionPt || r.questionEn, answer: r.answerPt || r.answerEn }));
      const traitList = card.traits.length ? card.traits : card.trait ? [card.trait] : [];
      return {
        title: `${name} (${card.code})`,
        description: `Carta ${card.code} de Gundam Card Game: ${traits}. Veja as impressões, as regras e em quais decks ela aparece.`,
        image: card.prints[0]?.imageMediumUrl || card.prints[0]?.imageUrl,
        body: cardBody({
          name, nameEn: card.nameEn, code: card.code, typeLabel: typePt(card.cardType), colorLabel: colorPt(card.color),
          level: card.level, cost: card.cost, ap: card.ap, hp: card.hp, traits: traitList, series: card.sourceTitle || card.series,
          zone: card.zone, link: card.linkText, effectPt: card.effectPt, effectEn: card.effectEn,
          prints: card.prints.map((p) => ({ code: p.code, label: p.printLabel, rarity: p.rarity, set: p.set?.isActive ? { code: p.set.code, name: p.set.namePt || p.set.nameEn } : null })),
          rulings,
        }),
      };
    },
    deck: async (key) => {
      const deck = await prisma.deck.findUnique({
        where: { shareId: key },
        select: {
          name: true, visibility: true, coverImage: true, notes: true, user: { select: { displayName: true, username: true } },
          items: { select: { quantity: true, section: true, card: { select: { cardModelId: true, id: true, code: true, nameEn: true, namePt: true, cardType: true } } } },
        },
      });
      if (!deck || deck.visibility === "PRIVATE") return null;
      const main = deck.items.filter((i) => i.section === "main").reduce((sum, i) => sum + i.quantity, 0);
      const author = deck.user?.displayName || deck.user?.username;
      return {
        title: deck.name,
        description: `Deck${author ? ` de ${author}` : ""} para Gundam Card Game${main ? `, com ${main} cartas no deck principal` : ""}: lista completa, curva de custo e estatísticas.`,
        image: deck.coverImage,
        noindex: deck.visibility !== "PUBLIC",
        body: deckBody({
          name: deck.name, author, description: deck.notes,
          items: deck.items
            .map((i) => ({ quantity: i.quantity, section: i.section, card: { id: i.card.cardModelId || i.card.id, code: i.card.code, name: cardName(i.card), typeLabel: typePt(i.card.cardType) } }))
            .sort((a, b) => a.card.code.localeCompare(b.card.code)),
        }),
      };
    },
    set: async (key) => {
      const set = await prisma.cardSet.findUnique({
        where: { code: key },
        select: { id: true, code: true, nameEn: true, namePt: true, releaseDate: true, coverImage: true, isActive: true, setType: true, shortDescription: true, contentSummaryPt: true, contentSummaryEn: true, productNotes: true, season: { select: { name: true } } },
      });
      if (!set || !set.isActive) return null;
      const name = set.namePt || set.nameEn;
      const cards = await cardRowsFor(prisma, { setId: set.id });
      return {
        title: `${name} (${set.code})`,
        description: `Coleção ${set.code} de Gundam Card Game${set.releaseDate ? `, lançada em ${dayPt(set.releaseDate)}` : ""}: todas as cartas da coleção, com filtros e imagens.`,
        image: set.coverImage,
        body: setBody({
          code: set.code, name, releaseDate: dayPt(set.releaseDate) || undefined, typeLabel: SET_KIND_PT[set.setType], season: set.season?.name,
          description: set.contentSummaryPt || set.shortDescription || set.contentSummaryEn, notes: set.productNotes, cards,
        }),
      };
    },
    series: async (key) => {
      const series = await prisma.taxonomyEntry.findFirst({ where: { kind: "SOURCE_TITLE", slug: key, isActive: true }, select: { name: true, description: true, coverImage: true, officialUrl: true } });
      if (!series) return null;
      const cards = await cardRowsFor(prisma, { OR: [{ sourceTitle: series.name }, { series: series.name }] });
      return {
        title: series.name,
        description: series.description || `Cartas de Gundam Card Game da série ${series.name}.`,
        image: series.coverImage,
        body: seriesBody({ name: series.name, description: series.description, officialUrl: series.officialUrl, cards }),
      };
    },
    article: async (key) => {
      const post = await prisma.post.findFirst({
        where: { slug: key, status: "PUBLISHED" },
        select: { title: true, excerpt: true, contentMd: true, tags: true, coverImage: true, publishedAt: true, updatedAt: true, author: { select: { displayName: true, username: true } } },
      });
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
        body: articleBody({ title: post.title, excerpt: post.excerpt, contentMd: post.contentMd, tags: post.tags, author: post.author?.displayName || post.author?.username, publishedAt: dayPt(post.publishedAt) || undefined }),
      };
    },
    tournament: async (key) => {
      const t = await prisma.tournament.findFirst({
        where: { id: key, isActive: true },
        select: {
          id: true, name: true, organizer: true, city: true, country: true, format: true, dateStart: true, participantCount: true, roundCount: true,
          entries: { orderBy: [{ placement: { sort: "asc", nulls: "last" } }, { playerName: "asc" }], select: { id: true, placement: true, playerName: true, wins: true, losses: true, draws: true, archetype: true, deckId: true, deckSnapshotId: true } },
        },
      });
      if (!t) return null;
      return {
        title: t.name,
        description: `Resultados de ${t.name}${t.city ? `, em ${t.city}` : ""}${t.dateStart ? ` (${dayPt(t.dateStart)})` : ""}: classificação, pódio e decks${t.participantCount ? ` de ${t.participantCount} jogadores` : ""}.`,
        // torneio cadastrado sem nenhum resultado ainda: a página existe, mas não tem o que mostrar ao Google
        noindex: t.entries.length === 0,
        jsonLd: [{
          "@context": "https://schema.org", "@type": "Event", name: t.name,
          ...(t.dateStart ? { startDate: t.dateStart.toISOString() } : {}),
          ...(t.city ? { location: { "@type": "Place", name: t.organizer || t.city, address: { "@type": "PostalAddress", addressLocality: t.city, ...(t.country ? { addressCountry: t.country } : {}) } } } : {}),
          ...(t.organizer ? { organizer: { "@type": "Organization", name: t.organizer } } : {}),
        }],
        body: tournamentBody({
          id: t.id, name: t.name, date: dayPt(t.dateStart) || undefined, place: placeOf(t), organizer: t.organizer, format: t.format,
          participantCount: t.participantCount, roundCount: t.roundCount,
          entries: t.entries.map((e) => ({ id: e.id, placement: e.placement, playerName: e.playerName, wins: e.wins, losses: e.losses, draws: e.draws, archetype: e.archetype, hasList: Boolean(e.deckSnapshotId || e.deckId) })),
        }),
      };
    },
  };
}

/** Conteúdo das páginas de lista e de regras (as que não são de detalhe). `null` = fica o texto do index.html. */
export function createHtmlBodyLoader(prisma: PrismaClient): BodyLoader {
  const setsIndex = async (title: string, lead: string) => {
    const sets = await prisma.cardSet.findMany({
      where: { isActive: true },
      orderBy: [{ releaseDate: { sort: "desc", nulls: "last" } }, { code: "asc" }],
      select: { code: true, nameEn: true, namePt: true, releaseDate: true, setType: true, _count: { select: { cards: { where: { isActive: true } } } } },
    });
    return setsIndexBody(title, lead, sets.map((s) => ({ code: s.code, name: s.namePt || s.nameEn, releaseDate: dayPt(s.releaseDate) || undefined, typeLabel: SET_KIND_PT[s.setType], cardCount: s._count.cards })));
  };
  const rulingSelect = { id: true, title: true, questionPt: true, answerPt: true, questionEn: true, answerEn: true, relatedKeyword: true } as const;

  return async (path) => {
    switch (path) {
      case "/cards":
      case "/database":
        return setsIndex("Catálogo de cartas de Gundam Card Game", "Todas as cartas do jogo organizadas por coleção: Unidades, Pilotos, Comandos e Bases, com efeitos em português, dados de nível, custo, AP e HP, e as regras de cada carta.");
      case "/sets":
        return setsIndex("Coleções de Gundam Card Game", "Boosters, starter decks e produtos especiais lançados, com a data de lançamento e a lista de cartas de cada um.");
      case "/series": {
        const series = await prisma.taxonomyEntry.findMany({ where: { kind: "SOURCE_TITLE", isActive: true }, orderBy: { name: "asc" }, select: { slug: true, name: true, description: true } });
        return seriesIndexBody(series);
      }
      case "/articles": {
        const posts = await prisma.post.findMany({ where: { status: "PUBLISHED" }, orderBy: { publishedAt: "desc" }, take: 100, select: { slug: true, title: true, excerpt: true, publishedAt: true } });
        return articlesIndexBody(posts.map((p) => ({ slug: p.slug, title: p.title, excerpt: p.excerpt, publishedAt: dayPt(p.publishedAt) || undefined })));
      }
      case "/torneios":
      case "/tournaments": {
        const list = await prisma.tournament.findMany({
          where: { isActive: true, entries: { some: {} } },
          orderBy: { dateStart: { sort: "desc", nulls: "last" } },
          take: 100,
          select: { id: true, name: true, city: true, country: true, dateStart: true, participantCount: true, _count: { select: { entries: true } }, entries: { where: { placement: 1 }, take: 1, select: { playerName: true, archetype: true } } },
        });
        return tournamentsIndexBody(list.map((t) => ({ id: t.id, name: t.name, date: dayPt(t.dateStart) || undefined, place: placeOf(t), players: t.participantCount ?? t._count.entries, winner: t.entries[0]?.playerName, winnerArchetype: t.entries[0]?.archetype })));
      }
      case "/decks": {
        const decks = await prisma.deck.findMany({ where: { visibility: "PUBLIC" }, orderBy: { updatedAt: "desc" }, take: 60, select: { shareId: true, name: true, user: { select: { displayName: true, username: true } } } });
        return decksIndexBody(decks.map((d) => ({ shareId: d.shareId, name: d.name, author: d.user?.displayName || d.user?.username })));
      }
      case "/rules": {
        const rulings = await prisma.ruling.findMany({ where: { isActive: true }, orderBy: { title: "asc" }, take: 500, select: rulingSelect });
        return rulesBody({
          keywords: ALL_KEYWORDS.map((k) => ({ name: k.name, raw: k.raw, descriptionPt: k.descriptionPt, examplePt: k.examplePt, rulesSection: k.rulesSection, category: k.category })),
          rulings: rulings.map((r) => ({ id: r.id, title: r.title, question: r.questionPt || r.questionEn, answer: r.answerPt || r.answerEn, keyword: r.relatedKeyword })),
        });
      }
    }
    const rule = /^\/rules\/([^/]+)$/.exec(path);
    if (rule) {
      let id = rule[1];
      try { id = decodeURIComponent(id); } catch { return null; }
      const r = await prisma.ruling.findFirst({
        where: { id, isActive: true },
        select: { ...rulingSelect, examplePlayPt: true, sourceType: true, cardModel: { select: { id: true, code: true, nameEn: true, namePt: true } } },
      });
      if (!r) return null;
      return rulingBody({
        title: r.title, question: r.questionPt || r.questionEn, answer: r.answerPt || r.answerEn, example: r.examplePlayPt, keyword: r.relatedKeyword,
        source: RULE_SOURCE_PT[r.sourceType], card: r.cardModel ? { id: r.cardModel.id, code: r.cardModel.code, name: cardName(r.cardModel) } : null,
      });
    }
    return null;
  };
}

/** Registra a rota das páginas. Sem index.html (dev sem build) → segue para o próximo handler. */
export function registerHtmlPages(app: Express, { distDir, loaders, bodyFor }: { distDir: string; loaders: DetailLoaders; bodyFor?: BodyLoader }) {
  const readIndexHtml = createIndexHtmlReader(distDir);
  const pageCache = createPageCache();

  app.get(HTML_PAGE_ROUTE, async (req, res, next) => {
    const template = readIndexHtml();
    if (!template) return next();
    res.setHeader("Cache-Control", "no-cache");
    res.type("html");
    try {
      const page = await pageCache(req.path, () => resolveHtmlPage(req.path, loaders, bodyFor));
      res.status(page.status).send(renderHtml(template, page));
    } catch (error) {
      // banco fora do ar: entrega o index.html do build como antes (o React monta a página do mesmo jeito)
      console.error("[html] metadados indisponíveis para", req.path, error instanceof Error ? error.message : error);
      res.status(200).send(template);
    }
  });
}
