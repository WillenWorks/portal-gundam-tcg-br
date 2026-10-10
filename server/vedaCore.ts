// Lógica pura das rotas /api/veda/* (sem banco): recebe os torneios, inscrições e listas já carregados e monta as
// respostas do contrato (src/lib/veda/types.ts). O carregamento e o cache ficam em vedaService.ts.
import type {
  GameColor,
  Paginated,
  VedaArchetypeDetail,
  VedaArchetypeRef,
  VedaArchetypeRow,
  VedaCardInclusion,
  VedaCardUsage,
  VedaDeckCard,
  VedaDecklist,
  VedaExportList,
  VedaFilters,
  VedaMetaSlice,
  VedaPlace,
  VedaPlayer,
  VedaPlayerRef,
  VedaPlayerResult,
  VedaSample,
  VedaSource,
  VedaSourceId,
  VedaStanding,
  VedaSummary,
  VedaTier,
  VedaTournamentCard,
  VedaTournamentDetail,
} from "../src/lib/veda/types.ts";

export const SMALL_SAMPLE = 10;
export const MAX_LIMIT = 100;
export const DEFAULT_LIMIT = 24;
const CORE_INCLUSION = 0.8;
const FLEX_INCLUSION = 0.4;
const MIN_LISTED_INCLUSION = 0.1;
const COLORS: GameColor[] = ["Blue", "Green", "Red", "White", "Purple"];

export interface RawTournament {
  id: string;
  name: string;
  organizer: string | null;
  country: string | null;
  city: string | null;
  uf: string | null;
  season: string | null;
  tier: VedaTier;
  sourceUrl: string | null;
  participantCount: number | null;
  roundCount: number | null;
  date: string | null; // ISO
  updatedAt: string;
}

export interface RawEntry {
  id: string;
  tournamentId: string;
  playerName: string;
  placement: number | null;
  wins: number | null;
  losses: number | null;
  draws: number | null;
  archetype: string | null;
  deckSnapshotId: string | null;
}

export interface RawCard {
  cardModelId: string | null;
  code: string;
  nameEn: string;
  namePt: string | null;
  cardType: string;
  color: string | null;
  level: number | null;
  cost: number | null;
  imageUrl: string | null;
}

export interface VedaData {
  tournaments: RawTournament[];
  entries: RawEntry[];
  /** snapshotId → [{ cardId, quantity }] (só a seção main) */
  snapshots: Map<string, Array<{ cardId: string; quantity: number }>>;
  cards: Map<string, RawCard>;
  seasons: Array<{ code: string; name: string; isCurrent: boolean }>;
}

// ---------- utilitários ----------

export function slugify(value: string): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const SOURCES: Record<VedaSourceId, VedaSource> = {
  egman: { id: "egman", name: "Egman Events", attribution: "Fonte: Egman Events", url: "https://deckbuilder.egmanevents.com/gundam/tournaments" },
  digilab: { id: "digilab", name: "DigiLab", attribution: "Dados: DigiLab (digilab.cards)", url: "https://gundam.digilab.cards" },
  manual: { id: "manual", name: "AnaheimHub", attribution: "Reportado no AnaheimHub", url: null },
};

export function sourceOf(sourceUrl: string | null): VedaSource {
  if (sourceUrl?.includes("egmanevents.com")) return SOURCES.egman;
  if (sourceUrl?.includes("digilab.cards")) return SOURCES.digilab;
  return SOURCES.manual;
}

export function placementLabel(placement: number | null): string {
  return placement == null ? "—" : `${placement}º`;
}

export function recordOf(e: Pick<RawEntry, "wins" | "losses" | "draws">): string | null {
  if (e.wins == null || e.losses == null) return null;
  return e.draws ? `${e.wins}-${e.losses}-${e.draws}` : `${e.wins}-${e.losses}`;
}

export function playerRef(name: string): VedaPlayerRef {
  return { name, slug: slugify(name) || "sem-nome" };
}

/** Cores pelo rótulo ("Purple / Red Banshee") ou, se não houver, pelas duas cores mais presentes na lista */
export function archetypeColors(label: string | null, deck: Array<{ card: RawCard; quantity: number }> | null): GameColor[] {
  const lead = String(label ?? "").match(/^\s*((?:blue|green|red|white|purple)(?:\s*\/\s*(?:blue|green|red|white|purple))*)\b/i);
  if (lead) {
    const fromLabel = lead[1].split("/").map((p) => COLORS.find((x) => x.toLowerCase() === p.trim().toLowerCase()));
    return [...new Set(fromLabel.filter((c): c is GameColor => !!c))];
  }
  if (!deck?.length) return [];
  const count = new Map<GameColor, number>();
  for (const { card, quantity } of deck) {
    const c = COLORS.find((x) => x === card.color);
    if (c) count.set(c, (count.get(c) ?? 0) + quantity);
  }
  // ordem alfabética, a mesma dos rótulos da DigiLab ("Purple / Red"), para o slug bater entre as fontes
  return [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([c]) => c).sort();
}

export function archetypeRef(label: string | null, colors: GameColor[]): VedaArchetypeRef | null {
  if (!label?.trim()) return null;
  const name = label.trim();
  const hasColorsInName = colors.length > 0 && colors.every((c) => name.toLowerCase().includes(c.toLowerCase()));
  const slug = slugify(hasColorsInName ? name : `${[...colors].sort().join(" ")} ${name}`);
  return { name, slug, colors };
}

function sampleOf(entries: RawEntry[], byId: Map<string, RawTournament>): VedaSample {
  const tIds = new Set(entries.map((e) => e.tournamentId));
  const dates = [...tIds].map((id) => byId.get(id)?.date).filter((d): d is string => !!d).sort();
  const lists = entries.filter((e) => e.deckSnapshotId).length;
  return { lists, tournaments: tIds.size, from: dates[0] ?? null, to: dates.at(-1) ?? null, small: lists < SMALL_SAMPLE };
}

// ---------- índice ----------

export class VedaIndex {
  readonly byId: Map<string, RawTournament>;
  readonly entriesByTournament = new Map<string, RawEntry[]>();
  readonly entryById = new Map<string, RawEntry>();
  private readonly deckCache = new Map<string, Array<{ card: RawCard; quantity: number }>>();

  constructor(readonly data: VedaData) {
    this.byId = new Map(data.tournaments.map((t) => [t.id, t]));
    for (const e of data.entries) {
      this.entryById.set(e.id, e);
      const list = this.entriesByTournament.get(e.tournamentId) ?? [];
      list.push(e);
      this.entriesByTournament.set(e.tournamentId, list);
    }
    for (const list of this.entriesByTournament.values()) list.sort((a, b) => (a.placement ?? 9999) - (b.placement ?? 9999));
  }

  deck(e: RawEntry): Array<{ card: RawCard; quantity: number }> | null {
    if (!e.deckSnapshotId) return null;
    const cached = this.deckCache.get(e.deckSnapshotId);
    if (cached) return cached;
    const items = this.data.snapshots.get(e.deckSnapshotId) ?? [];
    const deck = items.flatMap((i) => {
      const card = this.data.cards.get(i.cardId);
      return card ? [{ card, quantity: i.quantity }] : [];
    });
    this.deckCache.set(e.deckSnapshotId, deck);
    return deck;
  }

  archetypeOf(e: RawEntry): VedaArchetypeRef | null {
    return archetypeRef(e.archetype, archetypeColors(e.archetype, this.deck(e)));
  }

  place(t: RawTournament): VedaPlace {
    return { city: t.city, uf: t.uf, country: t.country, store: t.organizer };
  }

  /** inscrições dos torneios que passam no filtro */
  entriesFor(tournaments: RawTournament[]): RawEntry[] {
    return tournaments.flatMap((t) => this.entriesByTournament.get(t.id) ?? []);
  }
}

// ---------- filtros ----------

export interface TournamentFilter {
  season?: string;
  tier?: string;
  source?: string;
  country?: string;
  uf?: string;
  city?: string;
  store?: string;
  q?: string;
  from?: string;
  to?: string;
}

const norm = (s: string | null | undefined) => slugify(s ?? "");

export function filterTournaments(ix: VedaIndex, f: TournamentFilter): RawTournament[] {
  return ix.data.tournaments
    .filter((t) => {
      if (f.season && t.season !== f.season) return false;
      if (f.tier && t.tier !== f.tier) return false;
      if (f.source && sourceOf(t.sourceUrl).id !== f.source) return false;
      if (f.country && norm(t.country) !== norm(f.country)) return false;
      if (f.uf && (t.uf ?? "").toUpperCase() !== f.uf.toUpperCase()) return false;
      if (f.city && norm(t.city) !== norm(f.city)) return false;
      if (f.store && norm(t.organizer) !== norm(f.store)) return false;
      if (f.from && (!t.date || t.date < f.from)) return false;
      if (f.to && (!t.date || t.date.slice(0, 10) > f.to.slice(0, 10))) return false;
      if (f.q) {
        const q = norm(f.q);
        if (![t.name, t.organizer, t.city].some((v) => norm(v).includes(q))) return false;
      }
      return true;
    })
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
}

export function paginate<T>(items: T[], offset = 0, limit = DEFAULT_LIMIT): Paginated<T> {
  const o = Math.max(0, Math.floor(offset) || 0);
  const l = Math.min(MAX_LIMIT, Math.max(1, Math.floor(limit) || DEFAULT_LIMIT));
  return { items: items.slice(o, o + l), total: items.length, offset: o, limit: l, hasMore: o + l < items.length };
}

// ---------- respostas ----------

export function tournamentCard(ix: VedaIndex, t: RawTournament): VedaTournamentCard {
  const entries = ix.entriesByTournament.get(t.id) ?? [];
  const champ = entries.find((e) => e.placement === 1) ?? null;
  return {
    id: t.id,
    name: t.name,
    date: t.date,
    tier: t.tier,
    season: t.season,
    place: ix.place(t),
    participantCount: t.participantCount,
    entriesCount: entries.length,
    decklistsCount: entries.filter((e) => e.deckSnapshotId).length,
    winner: champ ? { player: playerRef(champ.playerName), archetype: ix.archetypeOf(champ), entryId: champ.id } : null,
    source: sourceOf(t.sourceUrl),
    sourceUrl: t.sourceUrl,
  };
}

export function tournamentDetail(ix: VedaIndex, id: string): VedaTournamentDetail | null {
  const t = ix.byId.get(id);
  if (!t) return null;
  const entries = ix.entriesByTournament.get(t.id) ?? [];
  const standings: VedaStanding[] = entries.map((e) => ({
    entryId: e.id,
    placement: e.placement,
    placementLabel: placementLabel(e.placement),
    player: playerRef(e.playerName),
    archetype: ix.archetypeOf(e),
    record: recordOf(e),
    hasDecklist: !!e.deckSnapshotId,
  }));
  const meta = new Map<string, VedaMetaSlice>();
  for (const s of standings) {
    if (!s.archetype) continue;
    const m = meta.get(s.archetype.slug) ?? { archetype: s.archetype, count: 0, share: 0, bestPlacement: null };
    m.count += 1;
    if (s.placement != null && (m.bestPlacement == null || s.placement < m.bestPlacement)) m.bestPlacement = s.placement;
    meta.set(s.archetype.slug, m);
  }
  const slices = [...meta.values()].map((m) => ({ ...m, share: entries.length ? m.count / entries.length : 0 }));
  slices.sort((a, b) => b.count - a.count || (a.bestPlacement ?? 9999) - (b.bestPlacement ?? 9999));
  return { ...tournamentCard(ix, t), roundCount: t.roundCount, standings, meta: slices };
}

const TYPE_ORDER = ["UNIT", "PILOT", "COMMAND", "BASE", "RESOURCE", "TOKEN"];

function deckCard(card: RawCard, quantity: number): VedaDeckCard {
  return { cardModelId: card.cardModelId, code: card.code, name: card.nameEn, namePt: card.namePt, cardType: card.cardType, color: card.color, level: card.level, cost: card.cost, quantity, imageUrl: card.imageUrl };
}

export function decklist(ix: VedaIndex, entryId: string): VedaDecklist | null {
  const e = ix.entryById.get(entryId);
  const t = e ? ix.byId.get(e.tournamentId) : null;
  const deck = e ? ix.deck(e) : null;
  if (!e || !t || !deck?.length) return null;
  const byType = new Map<string, VedaDeckCard[]>();
  const curve: Record<string, number> = {};
  for (const { card, quantity } of deck) {
    const list = byType.get(card.cardType) ?? [];
    list.push(deckCard(card, quantity));
    byType.set(card.cardType, list);
    if (card.cost != null) curve[String(card.cost)] = (curve[String(card.cost)] ?? 0) + quantity;
  }
  const groups = [...byType.entries()]
    .sort(([a], [b]) => (TYPE_ORDER.indexOf(a) + 1 || 99) - (TYPE_ORDER.indexOf(b) + 1 || 99))
    .map(([cardType, cards]) => ({
      cardType,
      count: cards.reduce((n, c) => n + c.quantity, 0),
      cards: cards.sort((a, b) => (a.level ?? 99) - (b.level ?? 99) || (a.cost ?? 99) - (b.cost ?? 99) || a.code.localeCompare(b.code)),
    }));
  const archetype = ix.archetypeOf(e);
  return {
    entryId: e.id,
    tournament: { id: t.id, name: t.name, date: t.date, season: t.season, place: ix.place(t) },
    player: playerRef(e.playerName),
    placement: e.placement,
    placementLabel: placementLabel(e.placement),
    record: recordOf(e),
    archetype,
    colors: archetype?.colors ?? archetypeColors(null, deck),
    totalCards: deck.reduce((n, d) => n + d.quantity, 0),
    groups,
    curve,
    deckCode: deck.map((d) => `${d.card.code}:${d.quantity}`).join(","),
    source: sourceOf(t.sourceUrl),
    sourceUrl: t.sourceUrl,
  };
}

function playerResult(ix: VedaIndex, e: RawEntry): VedaPlayerResult | null {
  const t = ix.byId.get(e.tournamentId);
  if (!t) return null;
  return {
    tournamentId: t.id,
    tournamentName: t.name,
    date: t.date,
    season: t.season,
    place: ix.place(t),
    entryId: e.id,
    placement: e.placement,
    placementLabel: placementLabel(e.placement),
    archetype: ix.archetypeOf(e),
    record: recordOf(e),
    hasDecklist: !!e.deckSnapshotId,
  };
}

const byDateDesc = (a: { date: string | null }, b: { date: string | null }) => (b.date ?? "").localeCompare(a.date ?? "");

export function player(ix: VedaIndex, slug: string, season?: string): VedaPlayer | null {
  const entries = ix.data.entries.filter((e) => playerRef(e.playerName).slug === slug && (!season || ix.byId.get(e.tournamentId)?.season === season));
  if (!entries.length) return null;
  const results = entries.map((e) => playerResult(ix, e)).filter((r): r is VedaPlayerResult => !!r).sort(byDateDesc);
  const arch = new Map<string, { archetype: VedaArchetypeRef; count: number }>();
  for (const r of results) {
    if (!r.archetype) continue;
    const a = arch.get(r.archetype.slug) ?? { archetype: r.archetype, count: 0 };
    a.count += 1;
    arch.set(r.archetype.slug, a);
  }
  return {
    player: playerRef(entries[0].playerName),
    tournaments: new Set(entries.map((e) => e.tournamentId)).size,
    wins: entries.filter((e) => e.placement === 1).length,
    top8: entries.filter((e) => e.placement != null && e.placement <= 8).length,
    archetypes: [...arch.values()].sort((a, b) => b.count - a.count),
    results,
    nameMayBeShared: true,
  };
}

export function archetypeRows(ix: VedaIndex, f: TournamentFilter): VedaArchetypeRow[] {
  const entries = ix.entriesFor(filterTournaments(ix, f));
  const withArch = entries.map((e) => ({ e, a: ix.archetypeOf(e) })).filter((x): x is { e: RawEntry; a: VedaArchetypeRef } => !!x.a);
  const totalWins = withArch.filter((x) => x.e.placement === 1).length;
  const rows = new Map<string, VedaArchetypeRow & { top8: number }>();
  for (const { e, a } of withArch) {
    const r = rows.get(a.slug) ?? { archetype: a, lists: 0, share: 0, top8Share: 0, wins: 0, winShare: 0, bestPlacement: null, top8: 0 };
    r.lists += 1;
    if (e.placement === 1) r.wins += 1;
    if (e.placement != null && e.placement <= 8) r.top8 += 1;
    if (e.placement != null && (r.bestPlacement == null || e.placement < r.bestPlacement)) r.bestPlacement = e.placement;
    rows.set(a.slug, r);
  }
  return [...rows.values()]
    .map(({ top8, ...r }) => ({ ...r, share: withArch.length ? r.lists / withArch.length : 0, top8Share: r.lists ? top8 / r.lists : 0, winShare: totalWins ? r.wins / totalWins : 0 }))
    .sort((a, b) => b.lists - a.lists || b.wins - a.wins);
}

export function cardInclusion(ix: VedaIndex, entries: RawEntry[]): VedaCardInclusion[] {
  const decks = entries.map((e) => ix.deck(e)).filter((d): d is Array<{ card: RawCard; quantity: number }> => !!d?.length);
  const stats = new Map<string, { card: RawCard; lists: number; copies: number; byQty: Map<number, number> }>();
  for (const deck of decks) {
    const seen = new Map<string, { card: RawCard; quantity: number }>();
    for (const d of deck) {
      const prev = seen.get(d.card.code);
      seen.set(d.card.code, { card: d.card, quantity: (prev?.quantity ?? 0) + d.quantity });
    }
    for (const { card, quantity } of seen.values()) {
      const s = stats.get(card.code) ?? { card, lists: 0, copies: 0, byQty: new Map() };
      s.lists += 1;
      s.copies += quantity;
      s.byQty.set(quantity, (s.byQty.get(quantity) ?? 0) + 1);
      stats.set(card.code, s);
    }
  }
  return [...stats.values()]
    .map((s) => {
      const inclusion = decks.length ? s.lists / decks.length : 0;
      const mode = [...s.byQty.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0];
      const tier: VedaCardInclusion["tier"] = inclusion >= CORE_INCLUSION ? "core" : inclusion >= FLEX_INCLUSION ? "flex" : "tech";
      return { card: deckCard(s.card, mode), inclusion, avgCopies: s.copies / s.lists, tier };
    })
    .filter((c) => c.inclusion >= MIN_LISTED_INCLUSION)
    .sort((a, b) => b.inclusion - a.inclusion || b.avgCopies - a.avgCopies);
}

export function archetypeDetail(ix: VedaIndex, slug: string, f: TournamentFilter): VedaArchetypeDetail | null {
  const row = archetypeRows(ix, f).find((r) => r.archetype.slug === slug);
  if (!row) return null;
  const entries = ix.entriesFor(filterTournaments(ix, f)).filter((e) => ix.archetypeOf(e)?.slug === slug);
  const results = entries
    .map((e) => {
      const r = playerResult(ix, e);
      return r ? { ...r, player: playerRef(e.playerName) } : null;
    })
    .filter((r): r is VedaPlayerResult & { player: VedaPlayerRef } => !!r)
    .sort((a, b) => byDateDesc(a, b) || (a.placement ?? 9999) - (b.placement ?? 9999));
  return {
    row,
    sample: sampleOf(entries, ix.byId),
    cards: cardInclusion(ix, entries),
    recentResults: results.slice(0, 20),
    sampleDecklists: results
      .filter((r) => r.hasDecklist)
      .sort((a, b) => (a.placement ?? 9999) - (b.placement ?? 9999) || byDateDesc(a, b))
      .slice(0, 6)
      .map((r) => ({ entryId: r.entryId, player: r.player, placementLabel: r.placementLabel, tournamentName: r.tournamentName, date: r.date })),
  };
}

export function cardUsage(ix: VedaIndex, cardModelId: string, f: TournamentFilter): VedaCardUsage | null {
  const code = [...ix.data.cards.values()].find((c) => c.cardModelId === cardModelId)?.code;
  if (!code) return null;
  const entries = ix.entriesFor(filterTournaments(ix, f)).filter((e) => e.deckSnapshotId);
  const using = entries
    .map((e) => ({ e, qty: (ix.deck(e) ?? []).filter((d) => d.card.code === code).reduce((n, d) => n + d.quantity, 0) }))
    .filter((x) => x.qty > 0);
  const arch = new Map<string, { archetype: VedaArchetypeRef; lists: number; total: number }>();
  for (const e of entries) {
    const a = ix.archetypeOf(e);
    if (!a) continue;
    const r = arch.get(a.slug) ?? { archetype: a, lists: 0, total: 0 };
    r.total += 1;
    arch.set(a.slug, r);
  }
  for (const { e } of using) {
    const a = ix.archetypeOf(e);
    if (a) arch.get(a.slug)!.lists += 1;
  }
  return {
    cardModelId,
    code,
    sample: sampleOf(entries, ix.byId),
    lists: using.length,
    inclusion: entries.length ? using.length / entries.length : 0,
    avgCopies: using.length ? using.reduce((n, x) => n + x.qty, 0) / using.length : 0,
    archetypes: [...arch.values()]
      .filter((a) => a.lists > 0)
      .map((a) => ({ archetype: a.archetype, lists: a.lists, inclusion: a.lists / a.total }))
      .sort((a, b) => b.lists - a.lists),
    recentDecklists: using
      .map(({ e, qty }) => ({ e, qty, t: ix.byId.get(e.tournamentId) }))
      .filter((x) => x.t)
      .sort((a, b) => (b.t?.date ?? "").localeCompare(a.t?.date ?? "") || (a.e.placement ?? 9999) - (b.e.placement ?? 9999))
      .slice(0, 10)
      .map(({ e, qty, t }) => ({ entryId: e.id, player: playerRef(e.playerName), placementLabel: placementLabel(e.placement), tournamentId: t!.id, tournamentName: t!.name, date: t!.date, quantity: qty })),
  };
}

export function summary(ix: VedaIndex): VedaSummary {
  const entries = ix.data.entries;
  const sources = new Map<VedaSourceId, VedaSource & { tournaments: number }>();
  for (const t of ix.data.tournaments) {
    const s = sourceOf(t.sourceUrl);
    const row = sources.get(s.id) ?? { ...s, tournaments: 0 };
    row.tournaments += 1;
    sources.set(s.id, row);
  }
  const dates = ix.data.tournaments.map((t) => t.date).filter((d): d is string => !!d).sort();
  const updated = ix.data.tournaments.map((t) => t.updatedAt).sort();
  return {
    sample: sampleOf(entries, ix.byId),
    players: new Set(entries.map((e) => playerRef(e.playerName).slug)).size,
    seasons: ix.data.seasons.map((s) => ({ ...s, tournaments: ix.data.tournaments.filter((t) => t.season === s.code).length })),
    sources: [...sources.values()].sort((a, b) => b.tournaments - a.tournaments),
    lastTournamentDate: dates.at(-1) ?? null,
    updatedAt: updated.at(-1) ?? null,
  };
}

export function filters(ix: VedaIndex): VedaFilters {
  const ufs = new Map<string, Set<string>>();
  const stores = new Map<string, { name: string; city: string | null; uf: string | null }>();
  const countries = new Set<string>();
  const tiers = new Set<VedaTier>();
  const sources = new Map<VedaSourceId, VedaSource>();
  for (const t of ix.data.tournaments) {
    tiers.add(t.tier);
    const s = sourceOf(t.sourceUrl);
    sources.set(s.id, s);
    if (t.country) countries.add(t.country);
    if (t.uf) {
      const set = ufs.get(t.uf) ?? new Set<string>();
      if (t.city) set.add(t.city);
      ufs.set(t.uf, set);
    }
    if (t.organizer && t.city) stores.set(slugify(t.organizer), { name: t.organizer, city: t.city, uf: t.uf });
  }
  return {
    seasons: ix.data.seasons,
    tiers: [...tiers],
    sources: [...sources.values()],
    countries: [...countries].sort(),
    ufs: [...ufs.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([uf, cities]) => ({ uf, cities: [...cities].sort() })),
    stores: [...stores.values()].sort((a, b) => a.name.localeCompare(b.name)),
  };
}

const TIER_EVENT_TYPE: Record<VedaTier, string> = {
  LARGE_OFFICIAL: "Large Official Event",
  SMALL_OFFICIAL: "Small Official Event",
  UNOFFICIAL: "Unofficial Event",
  RANKED: "Small Official Event",
  TEAM: "Unofficial Event",
};

/** listas com decklist, no formato meta-raw (o mesmo da coleta da Egman), para a matriz/treino do bot */
export function exportLists(ix: VedaIndex, f: TournamentFilter & { since?: string }): VedaExportList[] {
  const out: VedaExportList[] = [];
  for (const t of filterTournaments(ix, { ...f, from: f.since ?? f.from })) {
    for (const e of ix.entriesByTournament.get(t.id) ?? []) {
      const deck = ix.deck(e);
      if (!deck?.length || !t.season) continue;
      const main: Record<string, number> = {};
      for (const d of deck) main[d.card.code] = (main[d.card.code] ?? 0) + d.quantity;
      out.push({
        format: t.season,
        event: t.name,
        eventType: TIER_EVENT_TYPE[t.tier],
        date: t.date?.slice(0, 10) ?? null,
        placing: e.placement,
        record: recordOf(e),
        label: e.archetype,
        player: e.playerName,
        main,
        source: sourceOf(t.sourceUrl).id,
        country: t.country,
        uf: t.uf,
      });
    }
  }
  return out;
}
