/* Análise de uma carta spoilada com os dados do próprio site: cartas com os mesmos traits, sinergias, arquétipos em
 * que ela encaixa e cartas parecidas já lançadas. Funções puras (testadas em spoilerAnalysis.test.ts); quem carrega
 * catálogo e torneios é loadSpoilerAnalysisContext.
 *
 * Tudo aqui sai de dado real: trait impresso, texto de efeito, condição de Link, listas de torneio. Nada de "nota" ou
 * previsão: o artigo mostra o que o catálogo e o metagame dizem e deixa a opinião para o texto revisado. */
import type { PrismaClient } from "@prisma/client";
import type { SpoilerCardData } from "./spoilerExtract.ts";
import type { TournamentCardUsage } from "./socialContent.ts";

export type CatalogCard = {
  id: string;
  code: string;
  name: string;
  cardType: string;
  color: string | null;
  level: number | null;
  cost: number | null;
  ap: number | null;
  hp: number | null;
  traits: string[];
  linkText: string | null;
  pilotName: string | null;
  effectEn: string | null;
};

export type ArchetypeProfile = {
  name: string;
  slug: string;
  colors: string[];
  /** fatia das listas com arquétipo na janela (0–1) */
  share: number;
  lists: number;
  /** cartas core/flex do arquétipo (código base) */
  coreCodes: string[];
};

export type SpoilerAnalysisContext = {
  catalog: CatalogCard[];
  usage: Map<string, TournamentCardUsage>;
  archetypes: ArchetypeProfile[];
  /** janela dos dados de torneio, para o texto (ex.: "últimos 90 dias") */
  windowLabel: string;
};

export type RelatedCard = { card: CatalogCard; reason: string; decks: number };
export type ArchetypeFit = { archetype: ArchetypeProfile; reason: string; sharedCoreCards: CatalogCard[] };
export type SimilarCard = { card: CatalogCard; diff: string; decks: number };

export type SpoilerAnalysis = {
  sameTraits: RelatedCard[];
  synergies: RelatedCard[];
  archetypes: ArchetypeFit[];
  similar: SimilarCard[];
};

const norm = (s: string) => s.trim().toLowerCase();
const baseCode = (code: string) => code.replace(/_[A-Za-z0-9]+$/, "").toUpperCase();
const colorsOf = (color: string | null) => (color ? color.split(/[/,|]/).map((c) => norm(c)).filter(Boolean) : []);
const decksOf = (ctx: SpoilerAnalysisContext, card: CatalogCard) => ctx.usage.get(baseCode(card.code))?.decks ?? 0;

/** Traits citados entre parênteses num texto de efeito, só os que existem de verdade no catálogo. */
export function traitsMentioned(text: string | null | undefined, knownTraits: Set<string>): string[] {
  if (!text) return [];
  const found = new Set<string>();
  for (const m of text.matchAll(/\(([^()]{2,40})\)/g)) {
    const t = norm(m[1]);
    if (knownTraits.has(t)) found.add(t);
  }
  return [...found];
}

/** Nomes entre colchetes de uma condição de Link (ex.: "[Amuro Ray]"). */
const linkNames = (linkText: string | null | undefined) => (linkText ? [...linkText.matchAll(/\[([^\]]+)\]/g)].map((m) => norm(m[1])) : []);

const pretty = (traits: string[], original: string[]) => traits.map((t) => original.find((o) => norm(o) === t) ?? t).join(", ");

function rank<T extends { decks: number; card: CatalogCard }>(items: T[], limit: number, score: (item: T) => number = () => 0): T[] {
  return items.sort((a, b) => score(b) - score(a) || b.decks - a.decks || a.card.code.localeCompare(b.card.code)).slice(0, limit);
}

export function analyzeSpoiler(spoiler: SpoilerCardData, ctx: SpoilerAnalysisContext): SpoilerAnalysis {
  const spoilerCode = spoiler.code ? baseCode(spoiler.code) : null;
  const catalog = ctx.catalog.filter((c) => baseCode(c.code) !== spoilerCode);
  const knownTraits = new Set(ctx.catalog.flatMap((c) => c.traits.map(norm)));
  const myTraits = spoiler.traits.map(norm);
  const myTraitSet = new Set(myTraits);
  const myName = norm(spoiler.nameEn);

  // 1. mesmos traits
  const sameTraits = rank(
    catalog
      .map((card) => {
        const shared = card.traits.map(norm).filter((t) => myTraitSet.has(t));
        return shared.length ? { card, decks: decksOf(ctx, card), shared, reason: `Trait em comum: ${pretty(shared, spoiler.traits)}` } : null;
      })
      .filter((x): x is RelatedCard & { shared: string[] } => !!x),
    8,
    (x) => x.shared.length,
  ).map(({ card, reason, decks }) => ({ card, reason, decks }));

  // 2. sinergias: efeito que cita trait, condição de Link por nome ou por trait
  const synergyMap = new Map<string, RelatedCard & { weight: number }>();
  const add = (card: CatalogCard, reason: string, weight: number) => {
    const prev = synergyMap.get(card.id);
    if (!prev || prev.weight < weight) synergyMap.set(card.id, { card, reason, decks: decksOf(ctx, card), weight });
  };
  const wantsTraits = traitsMentioned(spoiler.effectEn, knownTraits);
  const wantsNames = spoiler.cardType === "UNIT" ? linkNames(spoiler.linkText) : [];
  const linkTraits = spoiler.cardType === "UNIT" ? traitsMentioned(spoiler.linkText, knownTraits) : [];
  for (const card of catalog) {
    const cardTraits = card.traits.map(norm);
    const hit = wantsTraits.filter((t) => cardTraits.includes(t));
    if (hit.length) add(card, `O efeito da carta nova cita ${pretty(hit, card.traits)}, trait desta carta`, 3);
    const mentionsMe = traitsMentioned(card.effectEn, knownTraits).filter((t) => myTraitSet.has(t));
    if (mentionsMe.length) add(card, `O efeito desta carta cita ${pretty(mentionsMe, spoiler.traits)}, trait da carta nova`, 3);
    if (card.cardType === "PILOT" || card.cardType === "COMMAND") {
      const pilot = norm(card.pilotName || card.name);
      if (wantsNames.includes(pilot)) add(card, `Piloto que faz Link com a carta nova`, 4);
      const pilotHit = linkTraits.filter((t) => cardTraits.includes(t));
      if (pilotHit.length) add(card, `Piloto com o trait da condição de Link (${pretty(pilotHit, card.traits)})`, 2);
    }
    if (spoiler.cardType === "PILOT" && card.cardType === "UNIT") {
      if (linkNames(card.linkText).includes(myName)) add(card, `Unidade que faz Link com este piloto`, 4);
      const viaTrait = traitsMentioned(card.linkText, knownTraits).filter((t) => myTraitSet.has(t));
      if (viaTrait.length) add(card, `Unidade com Link por trait (${pretty(viaTrait, spoiler.traits)})`, 2);
    }
  }
  const synergies = rank([...synergyMap.values()], 8, (x) => x.weight).map(({ card, reason, decks }) => ({ card, reason, decks }));

  // 3. arquétipos: cor em comum e/ou traits do núcleo do arquétipo
  const myColors = colorsOf(spoiler.color);
  const byCode = new Map(ctx.catalog.map((c) => [baseCode(c.code), c]));
  const archetypes = ctx.archetypes
    .map((archetype) => {
      const core = archetype.coreCodes.map((code) => byCode.get(baseCode(code))).filter((c): c is CatalogCard => !!c);
      const sharedCore = core.filter((c) => c.traits.some((t) => myTraitSet.has(norm(t))));
      const affinity = core.length ? sharedCore.length / core.length : 0;
      const colorMatch = archetype.colors.some((c) => myColors.includes(norm(c)));
      if (!colorMatch && affinity < 0.3) return null;
      if (!colorMatch && !sharedCore.length) return null;
      const score = (colorMatch ? 1 : 0) + affinity * 2 + archetype.share;
      const reasons = [
        colorMatch ? `mesma cor (${archetype.colors.join("/")})` : null,
        sharedCore.length ? `${sharedCore.length} de ${core.length} cartas do núcleo têm trait em comum` : null,
      ].filter(Boolean);
      return { archetype, reason: reasons.join(" · "), sharedCoreCards: sharedCore.slice(0, 4), score, affinity };
    })
    .filter((x): x is ArchetypeFit & { score: number; affinity: number } => !!x && (x.affinity > 0 || myTraits.length === 0))
    .sort((a, b) => b.score - a.score || b.archetype.lists - a.archetype.lists)
    .slice(0, 3)
    .map(({ archetype, reason, sharedCoreCards }) => ({ archetype, reason, sharedCoreCards }));

  // 4. cartas parecidas já lançadas: mesmo tipo, cor e custo
  const similar = catalog
    .filter((c) => c.cardType === spoiler.cardType && spoiler.cost != null && c.cost === spoiler.cost && colorsOf(c.color).some((x) => myColors.includes(x)))
    .map((card) => {
      const parts: string[] = [];
      if (spoiler.level != null && card.level != null && card.level !== spoiler.level) parts.push(`nível ${card.level} (a nova: ${spoiler.level})`);
      const delta = (label: string, mine: number | null, theirs: number | null) => {
        if (mine == null || theirs == null || mine === theirs) return;
        parts.push(`${label} ${theirs} (a nova: ${mine})`);
      };
      delta("AP", spoiler.ap, card.ap);
      delta("HP", spoiler.hp, card.hp);
      const distance = Math.abs((card.level ?? 0) - (spoiler.level ?? 0)) * 2 + Math.abs((card.ap ?? 0) - (spoiler.ap ?? 0)) + Math.abs((card.hp ?? 0) - (spoiler.hp ?? 0));
      return { card, diff: parts.length ? parts.join(" · ") : "mesmos números", decks: decksOf(ctx, card), distance };
    })
    .sort((a, b) => a.distance - b.distance || b.decks - a.decks || a.card.code.localeCompare(b.card.code))
    .slice(0, 4)
    .map(({ card, diff, decks }) => ({ card, diff, decks }));

  return { sameTraits, synergies, archetypes, similar };
}

/** Catálogo ativo (sem prévias) + uso em torneio e arquétipos dos últimos 90 dias. */
export async function loadSpoilerAnalysisContext(prisma: PrismaClient, now = new Date()): Promise<SpoilerAnalysisContext> {
  const models = await prisma.cardModel.findMany({
    where: { isActive: true, NOT: { legalityStatus: "preview" }, cardType: { in: ["UNIT", "PILOT", "COMMAND", "COMMAND_PILOT", "BASE"] } },
    select: { id: true, code: true, nameEn: true, cardType: true, color: true, level: true, cost: true, ap: true, hp: true, traits: true, trait: true, linkText: true, pilotName: true, effectEn: true },
  });
  const catalog: CatalogCard[] = models.map((m) => ({
    id: m.id, code: m.code, name: m.nameEn, cardType: m.cardType, color: m.color, level: m.level, cost: m.cost, ap: m.ap, hp: m.hp,
    traits: m.traits.length ? m.traits : m.trait ? m.trait.split("|").map((t) => t.trim()).filter(Boolean) : [],
    linkText: m.linkText, pilotName: m.pilotName, effectEn: m.effectEn,
  }));

  const WINDOW_DAYS = 90;
  let usage = new Map<string, TournamentCardUsage>();
  let archetypes: ArchetypeProfile[] = [];
  try {
    const [{ getVedaIndex }, { archetypeRows, archetypeDetail }, { rankTournamentCards }] = await Promise.all([
      import("../vedaService.ts"),
      import("../vedaCore.ts"),
      import("./socialContent.ts"),
    ]);
    const ix = await getVedaIndex(prisma);
    usage = new Map(rankTournamentCards(ix, now, WINDOW_DAYS).map((u) => [u.code, u]));
    const filter = { from: new Date(now.getTime() - WINDOW_DAYS * 86_400_000).toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) };
    archetypes = archetypeRows(ix, filter)
      .filter((row) => row.lists >= 3)
      .slice(0, 15)
      .map((row) => {
        const detail = archetypeDetail(ix, row.archetype.slug, filter);
        return {
          name: row.archetype.name,
          slug: row.archetype.slug,
          colors: row.archetype.colors,
          share: row.share,
          lists: row.lists,
          coreCodes: (detail?.cards ?? []).filter((c) => c.tier !== "tech").map((c) => c.card.code),
        };
      });
  } catch (err) {
    console.warn("[spoilers] sem dados de torneio para a análise:", err instanceof Error ? err.message : err);
  }
  return { catalog, usage, archetypes, windowLabel: `últimos ${WINDOW_DAYS} dias` };
}
