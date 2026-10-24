/* Regras de conteúdo da agenda do Instagram (funções puras, sem banco): rodízio de raridade da carta do dia,
 * relatório semanal de torneios e escolha do deck em destaque, a partir do índice do Veda já carregado. */
import { filterTournaments, recordOf, type RawTournament, type VedaIndex } from "../vedaCore.ts";
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
