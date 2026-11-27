/* Páginas do site servidas pela API: o index.html do build com título, descrição, imagem de prévia e
 * JSON-LD da página pedida (ver server/htmlMeta.ts) e 404 de verdade para endereços que não existem.
 * O nginx manda as páginas para cá e, se a API cair, entrega o index.html puro. */
import fs from "node:fs";
import path from "node:path";
import type { Express } from "express";
import type { PrismaClient } from "@prisma/client";
import { DECK_MAIN_SIZE } from "../../src/lib/deck-legality.ts";
import { playerIsIndexable } from "../../src/lib/seoRules.ts";
import { onPublicContentChanged } from "../seoRefresh.ts";
import { createPageCache, renderHtml, resolveHtmlPage, type BodyLoader, type BodyResult, type DetailLoaders, type PageCacheState, type PreloadImage } from "../htmlMeta.ts";
import { HOME_HERO_SIZES, articleImageSources } from "../../src/lib/articleImageSources.ts";
import {
  aboutBody, supportBody, supportersBody, archetypeBody, archetypesIndexBody, articleBody, articlesIndexBody, playerBody, cardBody, deckBody, decksIndexBody, rulesBody, rulingBody, seriesBody, seriesIndexBody,
  decklistBody, metagameStatsBody, regionalMetaBody, setBody, setsIndexBody, tournamentBody, tournamentsIndexBody, type CardRow,
} from "../htmlContent.ts";
import { ALL_KEYWORDS } from "../../src/i18n/keywords.ts";
import { ABOUT_CONTACT, ABOUT_LEAD, ABOUT_SECTIONS, ABOUT_TITLE, ABOUT_UPDATED } from "../../src/lib/aboutContent.ts";
import { SUPPORT_LEAD, SUPPORT_TIER_PERKS, SUPPORT_TITLE, SUPPORT_WHY, SUPPORTERS_LEAD, SUPPORTERS_TITLE, groupSupportersByTier, supportChannels } from "../../src/lib/supportContent.ts";
import { GAME_COLOR_LABEL_PT } from "../../src/lib/gundam-catalog.ts";
import { SUPPORTER_TIERS, supporterTierInfo } from "../../src/lib/supporters.ts";
import { listPublicSupporters } from "./supporterRoutes.ts";
import { LATEST_SEASON } from "../../src/lib/seasons.ts";
import { getMetagameStats } from "../metagameTrendsService.ts";
import { getRegionalMetagame } from "../services/regionalMetaService.ts";

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
      // A carta abre pelo id, pelo código (GD01-001) ou por uma impressão (id/código da impressão, como a API
      // /api/cards/:id). Todas viram a mesma página, com o endereço oficial /cards/<id> no canonical.
      const code = key.trim().toUpperCase();
      const direct = await prisma.cardModel.findFirst({ where: { OR: [{ id: key }, { code }], isActive: true }, select: { id: true } });
      const modelId = direct?.id
        ?? (await prisma.card.findFirst({ where: { OR: [{ id: key }, { code }] }, orderBy: { isPrimaryPrint: "desc" }, select: { cardModelId: true } }))?.cardModelId;
      if (!modelId) return null;
      const card = await prisma.cardModel.findFirst({
        where: { id: modelId, isActive: true },
        select: {
          id: true, code: true, nameEn: true, namePt: true, cardType: true, color: true, level: true, cost: true, ap: true, hp: true,
          traits: true, trait: true, series: true, sourceTitle: true, zone: true, linkText: true, effectPt: true, effectEn: true, legalityStatus: true,
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
        canonicalPath: `/cards/${card.id}`,
        body: cardBody({
          name, nameEn: card.nameEn, code: card.code, typeLabel: typePt(card.cardType), colorLabel: colorPt(card.color),
          level: card.level, cost: card.cost, ap: card.ap, hp: card.hp, traits: traitList, series: card.sourceTitle || card.series,
          zone: card.zone, link: card.linkText, effectPt: card.effectPt, effectEn: card.effectEn,
          prints: card.prints.map((p) => ({ code: p.code, label: p.printLabel, rarity: p.rarity, set: p.set?.isActive ? { code: p.set.code, name: p.set.namePt || p.set.nameEn } : null })),
          rulings,
          preview: card.legalityStatus === "preview",
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
        // deck incompleto (rascunho, lista pela metade) abre pelo link mas fica fora do Google: é página rala
        noindex: deck.visibility !== "PUBLIC" || main < DECK_MAIN_SIZE,
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

/** Arquétipos e jogadores, dos dados de torneio do Zero System (o mesmo índice que a página usa). */
async function metaBodyFrom(prisma: PrismaClient, path: string): Promise<string | BodyResult | null> {
  const [{ getVedaIndex }, veda] = await Promise.all([import("../vedaService.ts"), import("../vedaCore.ts")]);
  const ix = await getVedaIndex(prisma);
  if (path === "/arquetipos") {
    const rows = veda.archetypeRows(ix, {});
    const s = veda.summary(ix);
    return archetypesIndexBody(
      rows.map((r) => ({ name: r.archetype.name, slug: r.archetype.slug, colors: r.archetype.colors, lists: r.lists, share: r.share, wins: r.wins, top8Share: r.top8Share })),
      { tournaments: s.sample.tournaments, lists: rows.reduce((n, r) => n + r.lists, 0) },
    );
  }
  let slug = path.split("/")[2] ?? "";
  try { slug = decodeURIComponent(slug); } catch { return { notFound: true }; }
  if (path.startsWith("/arquetipos/")) {
    const d = veda.archetypeDetail(ix, slug, {});
    if (!d) return { notFound: true };
    const name = d.row.archetype.name;
    return {
      title: `${name} — arquétipo`,
      description: `${name}: ${Math.round(d.row.share * 100)}% do metagame em ${d.row.lists} listas, ${d.row.wins} títulos, cartas mais usadas e resultados recentes em torneios de Gundam Card Game.`,
      body: archetypeBody({
        name, colors: d.row.archetype.colors, lists: d.row.lists, share: d.row.share, wins: d.row.wins, top8Share: d.row.top8Share,
        sample: { tournaments: d.sample.tournaments, from: d.sample.from, to: d.sample.to },
        cards: d.cards.map((c) => ({ cardModelId: c.card.cardModelId, code: c.card.code, name: c.card.namePt || c.card.name, inclusion: c.inclusion, avgCopies: c.avgCopies, tier: c.tier })),
        results: d.recentResults.map((r) => ({ tournamentId: r.tournamentId, tournamentName: r.tournamentName, date: r.date, placementLabel: r.placementLabel, player: r.player })),
      }),
    };
  }
  const p = veda.player(ix, slug);
  if (!p) return { notFound: true };
  return {
    title: `${p.player.name} — resultados`,
    description: `${p.player.name} em torneios de Gundam Card Game: ${p.tournaments} torneios, ${p.wins} títulos, ${p.top8} top 8 e os arquétipos que jogou.`,
    // perfil sem nenhuma lista publicada só repete a linha da classificação do torneio: fica pelo link, fora do Google
    // (mesma regra do navegador e do sitemap: src/lib/seoRules.ts)
    noindex: !playerIsIndexable(p),
    body: playerBody({
      name: p.player.name, tournaments: p.tournaments, wins: p.wins, top8: p.top8,
      archetypes: p.archetypes.map((a) => ({ name: a.archetype.name, slug: a.archetype.slug, count: a.count })),
      results: p.results.slice(0, 50).map((r) => ({ tournamentId: r.tournamentId, tournamentName: r.tournamentName, date: r.date, placementLabel: r.placementLabel, record: r.record, archetype: r.archetype })),
    }),
  };
}

/** Conteúdo das páginas de lista e de regras (as que não são de detalhe). `null` = fica o texto do index.html. */
const listCardSelect = { cardModelId: true, id: true, code: true, nameEn: true, namePt: true, cardType: true } as const;

/** /torneios/:id/lista/:entryId — a lista que o jogador usou (cópia congelada; sem ela, o deck vinculado). */
async function decklistPage(prisma: PrismaClient, tournamentId: string, entryId: string): Promise<BodyResult> {
  const entry = await prisma.tournamentEntry.findFirst({
    where: { id: entryId, tournamentId, tournament: { isActive: true } },
    select: {
      playerName: true, placement: true, wins: true, losses: true, draws: true, archetype: true,
      tournament: { select: { id: true, name: true, dateStart: true, participantCount: true, _count: { select: { entries: true } } } },
      deckSnapshot: { select: { items: { select: { quantity: true, section: true, card: { select: listCardSelect } } } } },
      deck: { select: { visibility: true, items: { select: { quantity: true, section: true, card: { select: listCardSelect } } } } },
    },
  });
  if (!entry) return { notFound: true };
  const raw = entry.deckSnapshot?.items ?? (entry.deck && entry.deck.visibility !== "PRIVATE" ? entry.deck.items : []);
  const items = raw
    .map((i) => ({ quantity: i.quantity, section: i.section, card: { id: i.card.cardModelId || i.card.id, code: i.card.code, name: cardName(i.card), typeLabel: typePt(i.card.cardType) } }))
    .sort((a, b) => a.card.code.localeCompare(b.card.code));
  const t = entry.tournament;
  const date = dayPt(t.dateStart) || undefined;
  return {
    title: `Lista de ${entry.playerName} — ${t.name}`,
    description: `Deck${entry.archetype ? ` ${entry.archetype}` : ""} usado por ${entry.playerName} em ${t.name}${entry.placement ? ` (${entry.placement}º lugar)` : ""}: lista completa de cartas.`,
    // resultado sem lista cadastrada: a página só repetiria a linha da classificação
    noindex: items.length === 0,
    body: decklistBody({
      tournament: { id: t.id, name: t.name, date }, playerName: entry.playerName, placement: entry.placement,
      wins: entry.wins, losses: entry.losses, draws: entry.draws, archetype: entry.archetype,
      totalPlayers: t.participantCount ?? t._count.entries, items,
    }),
  };
}

/** Temporada atual — o mesmo padrão ("current") que /api/stats/metagame e /api/metagame/regional usam. */
async function currentSeason(prisma: PrismaClient) {
  return (await prisma.season.findFirst({ where: { isCurrent: true }, select: { id: true, name: true } }))
    ?? (await prisma.season.findFirst({ where: { code: LATEST_SEASON }, select: { id: true, name: true } }));
}

const comboPt = (combo: string) => combo.split(" + ").map((c) => colorPt(c) || c).join(" + ");

async function statsPage(prisma: PrismaClient): Promise<string> {
  const season = await currentSeason(prisma);
  const m = await getMetagameStats(prisma, { seasonId: season?.id ?? null });
  const p = m.provenance;
  const period = p.startDate && p.endDate ? `de ${dayPt(new Date(p.startDate))} a ${dayPt(new Date(p.endDate))}` : undefined;
  return metagameStatsBody({
    seasonName: season?.name, totalDecks: m.totalDecks, totalTournaments: p.totalTournaments, period,
    topCards: m.topCards.slice(0, 20).map((c) => ({ id: c.cardModelId, code: c.code, name: c.name, colorLabel: colorPt(c.color), presenceRate: c.presenceRate, avgCopies: c.avgCopies, winRate: c.winRate })),
    colors: m.colorDistribution.map((c) => ({ label: colorPt(c.color) || c.color, decks: c.decks, presenceRate: c.presenceRate })),
    combos: m.colorCombos.map((c) => ({ label: comboPt(c.combo), decks: c.decks, presenceRate: c.presenceRate })),
    traits: m.traitDistribution.map((t) => ({ label: t.trait, decks: t.decks, presenceRate: t.presenceRate })),
    rising: m.risingCards.slice(0, 8).map((c) => ({ id: c.cardModelId, code: c.code, name: c.name, colorLabel: colorPt(c.color), presenceRate: c.recentPresenceRate, delta: c.trendDelta })),
    tournaments: p.tournaments.slice(0, 15).map((t) => ({ id: t.id, name: t.name, date: t.date ? dayPt(new Date(t.date)) : undefined, decks: t.deckCount })),
  });
}

async function regionalPage(prisma: PrismaClient): Promise<string> {
  const season = await currentSeason(prisma);
  const r = await getRegionalMetagame(prisma, { seasonId: season?.id ?? null });
  const region = (g: (typeof r)["national"]) => ({
    label: g.label, totalDecks: g.totalDecks, winRate: g.winRate,
    colors: g.colorDistribution.map((c) => ({ label: colorPt(c.color) || c.color, decks: c.decks, presenceRate: c.presenceRate })),
    topCards: g.topCards.map((c) => ({ id: c.cardModelId, code: "", name: c.name, colorLabel: colorPt(c.color), presenceRate: c.presenceRate, avgCopies: c.avgCopies })),
  });
  return regionalMetaBody({
    seasonName: season?.name, totalDecks: r.totalDecks, national: region(r.national),
    states: r.states.map(region), cities: r.cities.map(region),
    anomalies: r.anomalies.map((a) => ({ scope: a.scopeLabel, label: a.kind === "color" ? colorPt(a.label) || a.label : a.label, regionRate: a.regionRate, nationalRate: a.nationalRate, deltaPp: a.deltaPp })),
  });
}

/** Imagens do 1º slide do destaque da home (fundo desfocado + imagem), nos mesmos endereços que o
 *  HomeArticlesCarousel pede: o navegador baixa junto com o HTML em vez de esperar o JavaScript e a API. */
export function homeHeroPreload(post: { homeImage: string | null; coverImage: string | null } | null): PreloadImage[] {
  const image = post && articleImageSources(post.homeImage || post.coverImage || "", HOME_HERO_SIZES);
  if (!image) return [];
  const main: PreloadImage = { href: image.src, srcset: image.srcSet, sizes: image.sizes };
  return image.blur === image.src ? [main] : [{ href: image.blur }, main];
}

export function createHtmlBodyLoader(prisma: PrismaClient): BodyLoader {
  const metaBody = (path: string) => metaBodyFrom(prisma, path);
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
      case "/": {
        // mesma ordem da vitrine em GET /api/posts (o mais novo pela data de publicação)
        const post = await prisma.post.findFirst({
          where: { status: "PUBLISHED" },
          orderBy: [{ publishedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
          select: { homeImage: true, coverImage: true },
        });
        const preloadImages = homeHeroPreload(post);
        return preloadImages.length ? { preloadImages } : null;
      }
      case "/apoie":
        return supportBody({
          title: SUPPORT_TITLE, lead: SUPPORT_LEAD, why: SUPPORT_WHY,
          channels: supportChannels({
            supportUrl: process.env.VITE_SUPPORT_URL, pixKey: process.env.VITE_SUPPORT_PIX_KEY, instagramUrl: process.env.VITE_INSTAGRAM_URL,
            discordUrl: process.env.VITE_DISCORD_INVITE_URL,
          }),
          tiers: SUPPORTER_TIERS.map((t) => ({ icon: t.icon, label: t.label, minMonthly: t.minMonthly, perks: SUPPORT_TIER_PERKS[t.key] ?? [] })),
          supporters: (await listPublicSupporters(prisma).catch(() => [])).map((p) => ({ name: p.name, tierLabel: supporterTierInfo(p.tier)?.label })),
        });
      case "/apoiadores":
        return supportersBody({
          title: SUPPORTERS_TITLE,
          lead: SUPPORTERS_LEAD,
          groups: groupSupportersByTier(await listPublicSupporters(prisma).catch(() => [])),
        });
      case "/sobre":
        return aboutBody({ title: ABOUT_TITLE, lead: ABOUT_LEAD, updated: ABOUT_UPDATED, contact: ABOUT_CONTACT, sections: ABOUT_SECTIONS });
      case "/cards":
      case "/database":
        return setsIndex("Catálogo de cartas de Gundam Card Game", "Todas as cartas do jogo organizadas por coleção: Unidades, Pilotos, Comandos e Bases, com efeitos em português, dados de nível, custo, AP e HP, e as regras de cada carta.");
      case "/sets":
        return setsIndex("Coleções de Gundam Card Game", "Boosters, starter decks e produtos especiais lançados, com a data de lançamento e a lista de cartas de cada um.");
      case "/series": {
        const series = await prisma.taxonomyEntry.findMany({ where: { kind: "SOURCE_TITLE", isActive: true }, orderBy: { name: "asc" }, select: { slug: true, name: true, description: true } });
        return seriesIndexBody(series);
      }
      case "/articles":
      case "/novidades": {
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
      case "/stats":
        return statsPage(prisma);
      case "/metagame/regional":
        return regionalPage(prisma);
      case "/rules": {
        const rulings = await prisma.ruling.findMany({ where: { isActive: true }, orderBy: { title: "asc" }, take: 500, select: rulingSelect });
        return rulesBody({
          keywords: ALL_KEYWORDS.map((k) => ({ name: k.name, raw: k.raw, descriptionPt: k.descriptionPt, examplePt: k.examplePt, rulesSection: k.rulesSection, category: k.category })),
          rulings: rulings.map((r) => ({ id: r.id, title: r.title, question: r.questionPt || r.questionEn, answer: r.answerPt || r.answerEn, keyword: r.relatedKeyword })),
        });
      }
    }
    if (path === "/arquetipos" || path.startsWith("/arquetipos/") || path.startsWith("/jogadores/")) return metaBody(path);
    const listMatch = /^\/torneios\/([^/]+)\/lista\/([^/]+)$/.exec(path);
    if (listMatch) return decklistPage(prisma, listMatch[1], listMatch[2]);
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
/** Páginas aquecidas sem visita: as principais do sitemap; o resto (artigos, torneios recentes) vem de `warmPaths`. */
export const WARM_STATIC_PATHS = [
  "/", "/cards", "/sets", "/series", "/articles", "/torneios", "/decks", "/stats", "/metagame/regional",
  "/arquetipos", "/rules", "/sobre", "/apoie", "/apoiadores",
];
const WARM_FIRST_MS = 15_000;
const WARM_EVERY_MS = 20 * 60_000;

export function registerHtmlPages(
  app: Express,
  { distDir, loaders, bodyFor, warmPaths }: { distDir: string; loaders: DetailLoaders; bodyFor?: BodyLoader; warmPaths?: () => Promise<string[]> },
) {
  const readIndexHtml = createIndexHtmlReader(distDir);
  const pageCache = createPageCache();
  const build = (path: string) => () => resolveHtmlPage(path, loaders, bodyFor);
  // publicou/editou artigo: a página sai do cache na hora (sem isso, quem pediu o rascunho antes deixava 404 + noindex guardado)
  onPublicContentChanged((paths) => {
    for (const p of paths) pageCache.invalidate(p);
    pageCache.invalidateNotFound();
  });

  app.get(HTML_PAGE_ROUTE, async (req, res, next) => {
    const template = readIndexHtml();
    if (!template) return next();
    res.setHeader("Cache-Control", "no-cache");
    res.type("html");
    const started = performance.now();
    let state: PageCacheState = "miss";
    try {
      const page = await pageCache(req.path, build(req.path), (s) => (state = s));
      // DevTools → Network → Timing mostra quanto o servidor levou e se veio do cache
      res.setHeader("Server-Timing", `html;dur=${(performance.now() - started).toFixed(1)};desc="${state}"`);
      res.status(page.status).send(renderHtml(template, page));
    } catch (error) {
      // banco fora do ar: entrega o index.html do build como antes (o React monta a página do mesmo jeito)
      console.error("[html] metadados indisponíveis para", req.path, error instanceof Error ? error.message : error);
      res.status(200).send(template);
    }
  });

  // Aquecimento: com pouco tráfego, a primeira visita de cada página esperava o banco. Monta as principais no boot
  // e a cada 20 min, uma por vez (não disputa o banco com as visitas).
  if (!warmPaths) return;
  const warm = async () => {
    if (!readIndexHtml()) return;
    let paths = WARM_STATIC_PATHS;
    try {
      paths = [...new Set([...WARM_STATIC_PATHS, ...(await warmPaths())])];
    } catch (error) {
      console.warn("[html] lista de páginas para aquecer indisponível:", error instanceof Error ? error.message : error);
    }
    for (const path of paths) {
      try {
        await pageCache.warm(path, build(path));
      } catch {
        // página que falhou fica para a próxima visita/rodada
      }
    }
  };
  setTimeout(() => void warm(), WARM_FIRST_MS).unref();
  setInterval(() => void warm(), WARM_EVERY_MS).unref();
}
