/* Regras de conteúdo da agenda do Instagram (funções puras, sem banco): rodízio de raridade da carta do dia,
 * relatório semanal de torneios e escolha do deck em destaque, a partir do índice do Veda já carregado. */
import { cardInclusion, filterTournaments, recordOf, type RawEntry, type RawTournament, type VedaIndex } from "../vedaCore.ts";
import type { GameColor, VedaTier } from "../../src/lib/veda/types.ts";

export type RarityTier = "LR" | "R" | "U" | "C";
export const RARITY_ROTATION: RarityTier[] = ["LR", "R", "U", "C"];

/** Como a raridade aparece na impressão principal (o banco tem os dois formatos, conforme a fonte). */
export const PRIMARY_RARITY_VALUES: Record<RarityTier, string[]> = {
  LR: ["LR", "Legend Rare"],
  R: ["R", "Rare"],
  U: ["U", "Uncommon"],
  C: ["C", "Common"],
};

/** Raridade do banco → faixa do rodízio. "+" marca arte alternativa da mesma faixa; Promo, token e recurso ficam de fora. */
export function rarityTier(rarity: string | null | undefined): RarityTier | null {
  const base = String(rarity ?? "").replace(/\+/g, "").trim().toLowerCase();
  if (base === "lr" || base === "legend rare") return "LR";
  if (base === "r" || base === "rare") return "R";
  if (base === "u" || base === "uncommon") return "U";
  if (base === "c" || base === "common") return "C";
  return null;
}

/** Ordem de tentativa depois do último post: a faixa seguinte primeiro; se faltar carta nela, as próximas. */
export function rarityAttemptOrder(last: RarityTier | null): RarityTier[] {
  const start = last ? (RARITY_ROTATION.indexOf(last) + 1) % RARITY_ROTATION.length : 0;
  return RARITY_ROTATION.map((_, i) => RARITY_ROTATION[(start + i) % RARITY_ROTATION.length]);
}

// ---------- arrobas (@instagram) de lojas organizadoras ----------

const HANDLE_PATTERN = /^@?([A-Za-z0-9._]{1,30})$/;

const normalizeStoreKey = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/**
 * Lojas brasileiras de TCG com @arroba conhecido no Instagram. Pode ser complementado ou sobrescrito no .env por
 * SOCIAL_STORE_HANDLES="Nome da Loja=@arroba,Outra Loja=@outra".
 */
export const KNOWN_STORE_INSTAGRAM_HANDLES: Record<string, string> = {
  "taverna game house": "tavernagamehouse",
  meruru: "merurutcg",
  "forja hobby store": "forjahobbystore",
  "epic game": "epicgameoficial",
  "bazar de bagda": "bazardebagda",
  "domain games": "domaingames",
  "anime hunter": "animehunteroficial",
  "mont cardshop": "montcardshop",
  "liga tcg": "ligatcg",
};

function parseEnvStoreHandles(env: NodeJS.ProcessEnv = process.env): Record<string, string> {
  const raw = (env.SOCIAL_STORE_HANDLES || "").trim();
  if (!raw) return {};
  const map: Record<string, string> = {};
  for (const pair of raw.split(",")) {
    const eq = pair.indexOf("=");
    if (eq <= 0) continue;
    const key = normalizeStoreKey(pair.slice(0, eq));
    const match = pair.slice(eq + 1).trim().match(HANDLE_PATTERN);
    if (key && match) map[key] = match[1].toLowerCase();
  }
  return map;
}

/** Devolve o `@arroba` da loja no Instagram (ex.: `"@tavernagamehouse"`), ou `null` quando não mapeada. */
export function storeInstagramHandle(store: string | null | undefined, env: NodeJS.ProcessEnv = process.env): string | null {
  const key = normalizeStoreKey(String(store ?? ""));
  if (!key) return null;
  const overrides = parseEnvStoreHandles(env);
  const direct = overrides[key] ?? KNOWN_STORE_INSTAGRAM_HANDLES[key];
  if (direct) return `@${direct}`;
  for (const [k, handle] of Object.entries({ ...KNOWN_STORE_INSTAGRAM_HANDLES, ...overrides })) {
    if (k.length >= 5 && (key.startsWith(`${k} `) || key.endsWith(` ${k}`))) return `@${handle}`;
  }
  return null;
}

/** Formata o nome da loja com o `@arroba` quando conhecido (ex.: `"Taverna Game House (@tavernagamehouse)"`). */
export function formatStoreWithInstagram(store: string | null | undefined, env: NodeJS.ProcessEnv = process.env): string {
  const clean = String(store ?? "").trim();
  if (!clean) return "";
  const handle = storeInstagramHandle(clean, env);
  if (!handle || clean.toLowerCase().includes(handle.toLowerCase())) return clean;
  return `${clean} (${handle})`;
}

// ---------- segunda: torneios do Brasil da semana ----------

export const WEEKLY_REPORT_MAX_TOURNAMENTS = 8;
const TOP_PLACES = 4;
const TIER_RANK: Record<VedaTier, number> = { LARGE_OFFICIAL: 0, SMALL_OFFICIAL: 1, RANKED: 2, TEAM: 3, UNOFFICIAL: 4 };

export type ReportArchetype = { name: string; slug: string; colors: GameColor[] };
export type ReportPlace = { placement: number; player: string; archetype: ReportArchetype | null; record: string | null };
export type WeeklyTournament = {
  id: string;
  /** tipo do evento sem a loja e a data (ex.: "Locals", "Store Championship") */
  event: string;
  store: string | null;
  city: string | null;
  uf: string | null;
  /** AAAA-MM-DD (a data do torneio é só dia, sem hora) */
  date: string | null;
  players: number;
  tier: VedaTier;
  top: ReportPlace[];
};
export type WeeklyReport = {
  from: string;
  to: string;
  /** torneios que ganham slide próprio, em ordem de data */
  featured: WeeklyTournament[];
  /** os demais (mais de 8 na semana), resumidos no fechamento */
  others: WeeklyTournament[];
  totalPlayers: number;
  cities: string[];
  /** arquétipos campeões, do que mais venceu para o que menos */
  champions: Array<{ archetype: ReportArchetype; wins: number }>;
  /** arquétipos mais jogados na semana (inscrições com arquétipo informado), até 5 */
  mostPlayed: Array<{ archetype: ReportArchetype; lists: number; share: number }>;
};

/** "Locals @ Taverna Game House — 2026-10-21" → "Locals" (loja e data já aparecem à parte). */
export function eventLabel(name: string, store: string | null): string {
  let label = name.replace(/\s*[—–-]\s*\d{4}-\d{2}-\d{2}\s*$/, "").trim();
  const at = label.lastIndexOf("@");
  if (store && at >= 0 && label.slice(at + 1).trim().toLowerCase() === store.trim().toLowerCase()) label = label.slice(0, at).trim();
  return label || name;
}

function weeklyTournament(ix: VedaIndex, t: RawTournament): WeeklyTournament {
  const entries = ix.entriesByTournament.get(t.id) ?? [];
  const top = entries
    .filter((e) => e.placement != null && e.placement <= TOP_PLACES)
    .slice(0, TOP_PLACES)
    .map((e) => ({ placement: e.placement as number, player: e.playerName, archetype: ix.archetypeOf(e), record: recordOf(e) }));
  return {
    id: t.id,
    event: eventLabel(t.name, t.organizer),
    store: t.organizer,
    city: t.city,
    uf: t.uf,
    date: t.date ? t.date.slice(0, 10) : null,
    players: t.participantCount ?? entries.length,
    tier: t.tier,
    top,
  };
}

/** Torneios brasileiros da semana (segunda a domingo); com mais de 8, ganham slide os de mais jogadores. */
export function buildWeeklyReport(ix: VedaIndex, range: { from: string; to: string }, max = WEEKLY_REPORT_MAX_TOURNAMENTS): WeeklyReport {
  const raw = filterTournaments(ix, { country: "brasil", from: range.from, to: range.to });
  const all = raw.map((t) => weeklyTournament(ix, t));
  const played = new Map<string, { archetype: ReportArchetype; lists: number }>();
  let withArchetype = 0;
  for (const e of ix.entriesFor(raw)) {
    const arch = ix.archetypeOf(e);
    if (!arch) continue;
    withArchetype += 1;
    const p = played.get(arch.slug) ?? { archetype: arch, lists: 0 };
    p.lists += 1;
    played.set(arch.slug, p);
  }
  const ranked = [...all].sort((a, b) => b.players - a.players || TIER_RANK[a.tier] - TIER_RANK[b.tier] || (a.date ?? "").localeCompare(b.date ?? ""));
  const byDate = (a: WeeklyTournament, b: WeeklyTournament) => (a.date ?? "").localeCompare(b.date ?? "") || b.players - a.players;
  const champions = new Map<string, { archetype: ReportArchetype; wins: number }>();
  for (const t of all) {
    const arch = t.top.find((p) => p.placement === 1)?.archetype;
    if (!arch) continue;
    const c = champions.get(arch.slug) ?? { archetype: arch, wins: 0 };
    c.wins += 1;
    champions.set(arch.slug, c);
  }
  const cities = [...new Set(all.map((t) => (t.city ? `${t.city}${t.uf ? `-${t.uf}` : ""}` : null)).filter((c): c is string => !!c))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  return {
    ...range,
    featured: ranked.slice(0, max).sort(byDate),
    others: ranked.slice(max).sort(byDate),
    totalPlayers: all.reduce((sum, t) => sum + t.players, 0),
    cities,
    champions: [...champions.values()].sort((a, b) => b.wins - a.wins || a.archetype.name.localeCompare(b.archetype.name)),
    mostPlayed: [...played.values()]
      .sort((a, b) => b.lists - a.lists || a.archetype.name.localeCompare(b.archetype.name))
      .slice(0, 5)
      .map((p) => ({ ...p, share: p.lists / withArchetype })),
  };
}

export const reportTournamentCount = (r: WeeklyReport) => r.featured.length + r.others.length;

/** "2026-10-19" → "19/10" */
export const dayMonth = (iso: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "—");

// ---------- sexta: deck em destaque ----------

export const FEATURED_DECK_WINDOW_DAYS = 30;
/** mínimo de listas na janela para o arquétipo concorrer; sem nenhum elegível, tenta com o segundo valor */
export const FEATURED_DECK_MIN_LISTS = [15, 8];
export const FEATURED_DECK_NO_REPEAT_DAYS = 28;
const KEY_CARDS_MAX = 8;
const DAY_MS = 24 * 3600_000;

export type FeaturedDeck = {
  archetype: ReportArchetype;
  window: { from: string; to: string };
  lists: number;
  wins: number;
  /** fração das colocações no top 25% do torneio: não infla com local pequeno, onde todo mundo é "top 8" */
  topRate: number;
  tournaments: number;
  /** listas brasileiras do arquétipo na janela */
  brLists: number;
  /** a lista mostrada: campeã mais recente; sem campeã, a de melhor colocação mais recente */
  entry: { id: string; player: string; placement: number | null; record: string | null; tournament: string; store: string | null; city: string | null; uf: string | null; date: string | null };
  cards: Array<{ code: string; name: string; cardType: string; cost: number | null; level: number | null; quantity: number; imageUrl: string | null }>;
  keyCards: Array<{ code: string; name: string; imageUrl: string | null; inclusion: number; copies: number }>;
};

const isTopQuarter = (placement: number | null, players: number) => placement != null && players > 0 && placement <= Math.max(1, Math.ceil(players / 4));
const TYPE_ORDER = ["UNIT", "PILOT", "COMMAND", "BASE", "RESOURCE"];

/**
 * Arquétipo de maior rendimento nos últimos 30 dias (todas as fontes): entre os que têm listas suficientes e pelo
 * menos uma decklist, o de maior taxa de top 25%; desempate por títulos e volume. Pula os destacados nas últimas 4
 * semanas (`recentSlugs`).
 */
export function pickFeaturedDeck(ix: VedaIndex, now: Date, recentSlugs: string[] = []): FeaturedDeck | null {
  const window = { from: new Date(now.getTime() - FEATURED_DECK_WINDOW_DAYS * DAY_MS).toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) };
  const tournaments = filterTournaments(ix, window);
  type Stat = { archetype: ReportArchetype; entries: RawEntry[]; wins: number; top: number; ranked: number; tournaments: Set<string>; br: number };
  const stats = new Map<string, Stat>();
  for (const t of tournaments) {
    const entries = ix.entriesByTournament.get(t.id) ?? [];
    const players = t.participantCount ?? entries.length;
    const brazil = Boolean(t.uf) || /^bra[sz]il$/i.test(t.country ?? "");
    for (const e of entries) {
      const archetype = ix.archetypeOf(e);
      if (!archetype) continue;
      const s = stats.get(archetype.slug) ?? { archetype, entries: [], wins: 0, top: 0, ranked: 0, tournaments: new Set<string>(), br: 0 };
      s.entries.push(e);
      s.tournaments.add(t.id);
      if (e.placement === 1) s.wins += 1;
      if (e.placement != null) {
        s.ranked += 1;
        if (isTopQuarter(e.placement, players)) s.top += 1;
      }
      if (brazil) s.br += 1;
      stats.set(archetype.slug, s);
    }
  }
  const recent = new Set(recentSlugs);
  const rate = (s: Stat) => (s.ranked ? s.top / s.ranked : 0);
  let chosen: Stat | undefined;
  for (const min of FEATURED_DECK_MIN_LISTS) {
    chosen = [...stats.values()]
      .filter((s) => s.entries.length >= min && !recent.has(s.archetype.slug) && s.entries.some((e) => e.deckSnapshotId && ix.deck(e)?.length))
      .sort((a, b) => rate(b) - rate(a) || b.wins - a.wins || b.entries.length - a.entries.length)[0];
    if (chosen) break;
  }
  if (!chosen) return null;

  const dateOf = (e: RawEntry) => ix.byId.get(e.tournamentId)?.date ?? "";
  const withList = chosen.entries.filter((e) => e.deckSnapshotId && ix.deck(e)?.length);
  const pick = [...withList].sort((a, b) => (a.placement ?? 9999) - (b.placement ?? 9999) || dateOf(b).localeCompare(dateOf(a)))[0];
  const champion = withList.filter((e) => e.placement === 1).sort((a, b) => dateOf(b).localeCompare(dateOf(a)))[0];
  const shown = champion ?? pick;
  const t = ix.byId.get(shown.tournamentId);
  const deck = ix.deck(shown) ?? [];

  const merged = new Map<string, FeaturedDeck["cards"][number]>();
  for (const { card, quantity } of deck) {
    const prev = merged.get(card.code);
    merged.set(card.code, { code: card.code, name: card.nameEn, cardType: card.cardType, cost: card.cost, level: card.level, quantity: (prev?.quantity ?? 0) + quantity, imageUrl: card.imageUrl });
  }
  const cards = [...merged.values()].sort(
    (a, b) => (TYPE_ORDER.indexOf(a.cardType) + 1 || 99) - (TYPE_ORDER.indexOf(b.cardType) + 1 || 99) || (a.level ?? 99) - (b.level ?? 99) || (a.cost ?? 99) - (b.cost ?? 99) || a.code.localeCompare(b.code),
  );
  const keyCards = cardInclusion(ix, withList)
    .filter((c) => c.tier === "core")
    .slice(0, KEY_CARDS_MAX)
    .map((c) => ({ code: c.card.code, name: c.card.name, imageUrl: c.card.imageUrl, inclusion: c.inclusion, copies: c.card.quantity }));

  return {
    archetype: chosen.archetype,
    window,
    lists: chosen.entries.length,
    wins: chosen.wins,
    topRate: rate(chosen),
    tournaments: chosen.tournaments.size,
    brLists: chosen.br,
    entry: {
      id: shown.id,
      player: shown.playerName,
      placement: shown.placement,
      record: recordOf(shown),
      tournament: t ? eventLabel(t.name, t.organizer) : "",
      store: t?.organizer ?? null,
      city: t?.city ?? null,
      uf: t?.uf ?? null,
      date: t?.date ? t.date.slice(0, 10) : null,
    },
    cards,
    keyCards,
  };
}

// ---------- artigo: texto que a IA resume para a legenda ----------

/** Teto do texto do artigo enviado à IA (o resumo usa só o começo de matérias muito longas). */
export const ARTICLE_TEXT_MAX = 8000;

/**
 * Markdown do artigo → texto corrido: some a marcação, imagens, blocos de código e HTML; [[GD01-001]] e links
 * ficam só com o texto. Corta no limite sem partir palavra.
 */
export function articlePlainText(markdown: string, max = ARTICLE_TEXT_MAX): string {
  const text = String(markdown ?? "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[\[([^[\]]+)\]\]/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}(?:#{1,6}|>|[-*+]|\d+[.)])\s+/gm, "")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/(\*\*|__|\*|_|~~)(\S(?:[\s\S]*?\S)?)\1/g, "$2")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}
