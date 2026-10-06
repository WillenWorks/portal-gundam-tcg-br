import { HostedEventMatchResult, HostedEventStatus, type PrismaClient } from "@prisma/client";
import { NON_STATS_CARD_TYPES } from "../src/lib/deck-legality.ts";
import type { MetagameProvenance, TournamentProvenanceItem } from "./metagameTrendsService.ts";

export interface PowerRankingSignatureCard {
  id: string;
  code: string;
  name: string;
  imageUrl: string | null;
  imageMediumUrl: string | null;
  color: string | null;
}

export interface PowerRankingTournamentPlacement {
  tournamentId: string;
  tournamentName: string;
  date: string | null;
  organizer: string | null;
  tier: string | null;
  sourceUrl: string | null;
  playerCount: number | null;
  placement: number | null;
  wins: number | null;
  losses: number | null;
  draws: number | null;
}

export interface PowerRankingEntry {
  archetype: string;
  colors: string[];
  signatureCard: PowerRankingSignatureCard | null;
  deckCount: number;
  metaShare: number; // 0..1, sobre o total de entradas com arquétipo declarado no recorte
  topCutConversion: number; // 0..1, proporção de listas que atingiram o Top 8 do evento
  isSmallSample: boolean; // true se deckCount < 4 (alerta de amostra pequena)
  wins: number;
  losses: number;
  draws: number;
  recordedMatches: number; // wins+losses+draws somados -- 0 quando nenhuma entrada tem placar lançado
  winRate: number | null; // null quando recordedMatches === 0 ("sem dados de placar")
  powerRankingScore: number; // 0..10, composto normalizado (winrate ajustado + meta share relativo)
  bestPlacement: number | null;
  sampleTournaments: Array<{ id: string; name: string }>;
  tournamentPlacements: PowerRankingTournamentPlacement[];
}

export interface PowerRankingsResult {
  rankings: PowerRankingEntry[];
  provenance: MetagameProvenance;
}

type ArchetypeEntryRow = {
  archetype: string | null;
  placement: number | null;
  wins: number | null;
  losses: number | null;
  draws: number | null;
  tournament: {
    id: string;
    name: string;
    dateStart?: Date | null;
    organizer?: string | null;
    participantCount?: number | null;
    tier?: any;
    sourceUrl?: string | null;
  };
  deckSnapshot: {
    items: Array<{
      quantity: number;
      card: {
        id: string;
        code: string;
        nameEn: string;
        namePt: string | null;
        color: string | null;
        cardType: string;
        rarity: string | null;
        cost: number | null;
        setId: string | null;
        imageUrl: string | null;
        imageMediumUrl: string | null;
      };
    }>;
  } | null;
};

/** Escolhe a carta-assinatura de uma decklist congelada: prioriza unidade LR/Rare de
 *  maior custo, mesma heurística usada em identifyDeckArchetype (metaAnalyticsService) --
 *  reimplementada aqui (não exportada de lá) pra evitar acoplar os dois motores de
 *  arquétipo, que respondem a perguntas diferentes (deck público vs. resultado real). */
function pickSignatureCard(items: NonNullable<ArchetypeEntryRow["deckSnapshot"]>["items"]): PowerRankingSignatureCard | null {
  const units = items
    .filter((item) => item.card.cardType === "UNIT")
    .sort((a, b) => {
      const isLrA = (a.card.rarity || "").includes("LR") || (a.card.rarity || "").includes("Legend");
      const isLrB = (b.card.rarity || "").includes("LR") || (b.card.rarity || "").includes("Legend");
      if (isLrA && !isLrB) return -1;
      if (!isLrA && isLrB) return 1;
      const rA = (a.card.rarity || "").includes("R") ? 2 : 1;
      const rB = (b.card.rarity || "").includes("R") ? 2 : 1;
      if (rA !== rB) return rB - rA;
      return (b.card.cost ?? 0) - (a.card.cost ?? 0) || b.quantity - a.quantity;
    });
  const best = units[0] || items[0];
  if (!best) return null;
  const c = best.card;
  return {
    id: c.id,
    code: c.code,
    name: c.namePt || c.nameEn,
    imageUrl: c.imageMediumUrl || c.imageUrl,
    imageMediumUrl: c.imageMediumUrl || c.imageUrl,
    color: c.color,
  };
}

/**
 * Power Rankings semanal (ver PLANO_METAGAME_TORNEIOS_TELEMETRIA.md §2.3): agrupa os
 * TournamentEntry com arquétipo declarado (dado real de torneio reportado, nunca deck
 * público) e calcula Meta Share + Winrate + escore composto por arquétipo.
 *
 * Winrate usa suavização Laplace (wins+1)/(jogos+2) pra evitar que um único resultado
 * isolado (1 vitória, 0 derrotas) dispare pro topo do ranking -- mesmo critério de
 * resiliência estatística já usado no motor VEDA pra amostras pequenas.
 */
export async function getPowerRankingsWithProvenance(
  prisma: PrismaClient,
  params: {
    seasonId?: string | null;
    setId?: string | null;
    tier?: string | null;
    startDate?: string | null;
    endDate?: string | null;
  },
): Promise<PowerRankingsResult> {
  const whereTournament: any = { isActive: true };
  if (params.seasonId) whereTournament.seasonId = params.seasonId;
  if (params.tier && params.tier !== "ALL") whereTournament.tier = params.tier;
  if (params.startDate || params.endDate) {
    whereTournament.dateStart = {};
    if (params.startDate) whereTournament.dateStart.gte = new Date(params.startDate);
    if (params.endDate) whereTournament.dateStart.lte = new Date(params.endDate);
  }

  const rows = await prisma.tournamentEntry.findMany({
    where: {
      archetype: { not: null },
      tournament: whereTournament,
    },
    select: {
      archetype: true,
      placement: true,
      wins: true,
      losses: true,
      draws: true,
      tournament: {
        select: {
          id: true,
          name: true,
          dateStart: true,
          organizer: true,
          participantCount: true,
          tier: true,
          sourceUrl: true,
        },
      },
      deckSnapshot: { select: { items: { select: { quantity: true, card: { select: { id: true, code: true, nameEn: true, namePt: true, color: true, cardType: true, rarity: true, cost: true, setId: true, imageUrl: true, imageMediumUrl: true } } } } } },
    },
  });

  const scoped: ArchetypeEntryRow[] = params.setId
    ? rows.filter((row) => row.deckSnapshot?.items.some((item) => item.card.setId === params.setId))
    : rows;

  const emptyProvenance: MetagameProvenance = {
    totalDecks: 0,
    totalTournaments: 0,
    startDate: null,
    endDate: null,
    tournaments: [],
  };

  if (!scoped.length) return { rankings: [], provenance: emptyProvenance };

  const byArchetype = new Map<string, ArchetypeEntryRow[]>();
  for (const row of scoped) {
    const key = (row.archetype || "").trim();
    if (!key) continue;
    const list = byArchetype.get(key) || [];
    list.push(row);
    byArchetype.set(key, list);
  }

  const totalEntries = scoped.filter((row) => (row.archetype || "").trim()).length;

  const raw = Array.from(byArchetype.entries()).map(([archetype, entries]) => {
    let wins = 0;
    let losses = 0;
    let draws = 0;
    let bestPlacement: number | null = null;
    const tournamentMap = new Map<string, string>();
    let bestEntryForSignature: ArchetypeEntryRow | null = null;

    for (const entry of entries) {
      wins += entry.wins ?? 0;
      losses += entry.losses ?? 0;
      draws += entry.draws ?? 0;
      if (entry.placement != null && (bestPlacement == null || entry.placement < bestPlacement)) {
        bestPlacement = entry.placement;
      }
      tournamentMap.set(entry.tournament.id, entry.tournament.name);
      if (entry.deckSnapshot?.items.length) {
        const isBetter =
          !bestEntryForSignature ||
          (entry.placement != null && (bestEntryForSignature.placement == null || entry.placement < bestEntryForSignature.placement));
        if (isBetter) bestEntryForSignature = entry;
      }
    }

    const recordedMatches = wins + losses + draws;
    const winRate = recordedMatches > 0 ? Number((wins / recordedMatches).toFixed(4)) : null;
    const adjustedWinRate = (wins + 1) / (recordedMatches + 2);

    const relevantItems = bestEntryForSignature?.deckSnapshot?.items.filter((item) => !NON_STATS_CARD_TYPES.includes(item.card.cardType as any)) || [];
    const colors = Array.from(new Set(relevantItems.map((item) => item.card.color).filter((c): c is string => Boolean(c)))).sort();
    const signatureCard = relevantItems.length ? pickSignatureCard(relevantItems) : null;

    const tournamentPlacements: PowerRankingTournamentPlacement[] = entries
      .map((entry) => ({
        tournamentId: entry.tournament.id,
        tournamentName: entry.tournament.name,
        date: entry.tournament.dateStart ? entry.tournament.dateStart.toISOString() : null,
        organizer: entry.tournament.organizer ?? null,
        tier: entry.tournament.tier ? String(entry.tournament.tier) : null,
        sourceUrl: entry.tournament.sourceUrl ?? null,
        playerCount: entry.tournament.participantCount ?? null,
        placement: entry.placement ?? null,
        wins: entry.wins ?? null,
        losses: entry.losses ?? null,
        draws: entry.draws ?? null,
      }))
      .sort((a, b) => (a.placement ?? 999) - (b.placement ?? 999));

    const topCutEntries = entries.filter((e) => e.placement != null && e.placement <= 8).length;
    const topCutConversion = entries.length > 0 ? Number((topCutEntries / entries.length).toFixed(4)) : 0;
    const isSmallSample = entries.length < 4;

    return {
      archetype,
      colors,
      signatureCard,
      deckCount: entries.length,
      metaShare: totalEntries > 0 ? Number((entries.length / totalEntries).toFixed(4)) : 0,
      topCutConversion,
      isSmallSample,
      wins,
      losses,
      draws,
      recordedMatches,
      winRate,
      adjustedWinRate,
      bestPlacement,
      sampleTournaments: Array.from(tournamentMap.entries()).map(([id, name]) => ({ id, name })),
      tournamentPlacements,
    };
  });

  const maxShare = Math.max(...raw.map((r) => r.metaShare), 0.0001);

  const rankings: PowerRankingEntry[] = raw
    .map((r) => ({
      archetype: r.archetype,
      colors: r.colors,
      signatureCard: r.signatureCard,
      deckCount: r.deckCount,
      metaShare: r.metaShare,
      topCutConversion: r.topCutConversion,
      isSmallSample: r.isSmallSample,
      wins: r.wins,
      losses: r.losses,
      draws: r.draws,
      recordedMatches: r.recordedMatches,
      winRate: r.winRate,
      powerRankingScore: Number((10 * (0.6 * r.adjustedWinRate + 0.4 * (r.metaShare / maxShare))).toFixed(1)),
      bestPlacement: r.bestPlacement,
      sampleTournaments: r.sampleTournaments,
      tournamentPlacements: r.tournamentPlacements,
    }))
    .sort((a, b) => b.powerRankingScore - a.powerRankingScore || b.metaShare - a.metaShare);

  // Proveniência global dos torneios que alimentam o Power Rankings
  const globalTournaments = new Map<string, TournamentProvenanceItem>();
  let earliestDate: Date | null = null;
  let latestDate: Date | null = null;

  for (const row of scoped) {
    const t = row.tournament;
    if (!t) continue;
    if (t.dateStart) {
      if (!earliestDate || t.dateStart.getTime() < earliestDate.getTime()) earliestDate = t.dateStart;
      if (!latestDate || t.dateStart.getTime() > latestDate.getTime()) latestDate = t.dateStart;
    }
    const existing = globalTournaments.get(t.id);
    if (existing) {
      existing.deckCount += 1;
    } else {
      globalTournaments.set(t.id, {
        id: t.id,
        name: t.name,
        date: t.dateStart ? t.dateStart.toISOString() : null,
        organizer: t.organizer ?? null,
        playerCount: t.participantCount ?? null,
        tier: String(t.tier || "SMALL_OFFICIAL"),
        sourceUrl: t.sourceUrl ?? null,
        deckCount: 1,
      });
    }
  }

  const provenance: MetagameProvenance = {
    totalDecks: totalEntries,
    totalTournaments: globalTournaments.size,
    startDate: earliestDate ? earliestDate.toISOString() : null,
    endDate: latestDate ? latestDate.toISOString() : null,
    tournaments: Array.from(globalTournaments.values()).sort((a, b) => {
      const da = a.date ? new Date(a.date).getTime() : 0;
      const db = b.date ? new Date(b.date).getTime() : 0;
      return db - da || b.deckCount - a.deckCount;
    }),
  };

  return { rankings, provenance };
}

export async function getPowerRankings(
  prisma: PrismaClient,
  params: {
    seasonId?: string | null;
    setId?: string | null;
    tier?: string | null;
    startDate?: string | null;
    endDate?: string | null;
  },
): Promise<PowerRankingEntry[]> {
  const result = await getPowerRankingsWithProvenance(prisma, params);
  return result.rankings;
}

export interface WeeklyArchetypeTrend {
  name: string;
  colors: string[];
  lists: number;
  share: number; // 0..1
  winRate: number | null;
  isSmallSample: boolean;
}

export interface WeeklyTrendPoint {
  weekKey: string;
  weekLabel: string;
  startDate: string;
  endDate: string;
  totalLists: number;
  totalEvents: number;
  isSmallSample: boolean;
  sampleWarning: string | null;
  archetypes: WeeklyArchetypeTrend[];
}

export interface WeeklyTrendsResult {
  seasonId: string | null;
  tier: string | null;
  weeks: WeeklyTrendPoint[];
  topArchetypes: string[];
  provenance: MetagameProvenance;
  weightNote: string;
}

function getWeekKeyAndRange(d: Date): { weekKey: string; weekLabel: string; start: Date; end: Date } {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = date.getUTCDay();
  const diffToMonday = (day === 0 ? -6 : 1) - day;
  const monday = new Date(date);
  monday.setUTCDate(date.getUTCDate() + diffToMonday);
  monday.setUTCHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  sunday.setUTCHours(23, 59, 59, 999);

  const target = new Date(monday.valueOf());
  const dayNr = (monday.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setUTCMonth(0, 1);
  if (target.getUTCDay() !== 4) {
    target.setUTCMonth(0, 1 + ((4 - target.getUTCDay() + 7) % 7));
  }
  const weekNumber = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
  const year = monday.getUTCFullYear();
  const weekKey = `${year}-W${String(weekNumber).padStart(2, "0")}`;

  const formatD = (dt: Date) => `${String(dt.getUTCDate()).padStart(2, "0")}/${String(dt.getUTCMonth() + 1).padStart(2, "0")}`;
  const weekLabel = `Semana ${weekNumber} (${formatD(monday)} a ${formatD(sunday)})`;

  return { weekKey, weekLabel, start: monday, end: sunday };
}

/**
 * Fase 3 -- Evolução Temporal Semanal e Sinalização de Amostra Pequena
 * Agrupa os resultados competitivos reais por semana ISO e calcula a trajetória de Meta Share e Winrate.
 */
export async function getWeeklyTrends(
  prisma: PrismaClient,
  params: {
    seasonId?: string | null;
    tier?: string | null;
    startDate?: string | null;
    endDate?: string | null;
  },
): Promise<WeeklyTrendsResult> {
  const whereTournament: any = { isActive: true };
  if (params.seasonId) whereTournament.seasonId = params.seasonId;
  if (params.tier && params.tier !== "ALL") whereTournament.tier = params.tier;
  if (params.startDate || params.endDate) {
    whereTournament.dateStart = {};
    if (params.startDate) whereTournament.dateStart.gte = new Date(params.startDate);
    if (params.endDate) whereTournament.dateStart.lte = new Date(params.endDate);
  }

  const rows = await prisma.tournamentEntry.findMany({
    where: {
      archetype: { not: null },
      tournament: whereTournament,
    },
    select: {
      archetype: true,
      placement: true,
      wins: true,
      losses: true,
      draws: true,
      tournament: {
        select: {
          id: true,
          name: true,
          dateStart: true,
          organizer: true,
          participantCount: true,
          tier: true,
          sourceUrl: true,
        },
      },
      deckSnapshot: {
        select: {
          items: {
            select: {
              card: {
                select: {
                  color: true,
                },
              },
            },
          },
        },
      },
    },
  });

  // Agrupamento por semana
  type WeekBucket = {
    weekKey: string;
    weekLabel: string;
    start: Date;
    end: Date;
    events: Map<string, {
      id: string;
      name: string;
      date: string | null;
      organizer: string | null;
      playerCount: number | null;
      tier: string;
      sourceUrl: string | null;
      deckCount: number;
    }>;
    entries: typeof rows;
  };

  const weekBuckets = new Map<string, WeekBucket>();
  const allEventsMap = new Map<string, {
    id: string;
    name: string;
    date: string | null;
    organizer: string | null;
    playerCount: number | null;
    tier: string;
    sourceUrl: string | null;
    deckCount: number;
  }>();

  let earliestDate: Date | null = null;
  let latestDate: Date | null = null;

  for (const row of rows) {
    const rawDate = row.tournament.dateStart ? new Date(row.tournament.dateStart) : new Date();
    if (!earliestDate || rawDate.getTime() < earliestDate.getTime()) earliestDate = rawDate;
    if (!latestDate || rawDate.getTime() > latestDate.getTime()) latestDate = rawDate;

    // Registra evento global
    const evId = row.tournament.id;
    const existingEv = allEventsMap.get(evId);
    if (existingEv) {
      existingEv.deckCount += 1;
    } else {
      allEventsMap.set(evId, {
        id: evId,
        name: row.tournament.name,
        date: row.tournament.dateStart ? row.tournament.dateStart.toISOString() : null,
        organizer: row.tournament.organizer ?? null,
        playerCount: row.tournament.participantCount ?? null,
        tier: String(row.tournament.tier ?? "COMMUNITY"),
        sourceUrl: row.tournament.sourceUrl ?? null,
        deckCount: 1,
      });
    }

    const { weekKey, weekLabel, start, end } = getWeekKeyAndRange(rawDate);
    let bucket = weekBuckets.get(weekKey);
    if (!bucket) {
      bucket = {
        weekKey,
        weekLabel,
        start,
        end,
        events: new Map(),
        entries: [],
      };
      weekBuckets.set(weekKey, bucket);
    }

    bucket.entries.push(row);
    const evInWeek = bucket.events.get(evId);
    if (evInWeek) {
      evInWeek.deckCount += 1;
    } else {
      bucket.events.set(evId, {
        id: evId,
        name: row.tournament.name,
        date: row.tournament.dateStart ? row.tournament.dateStart.toISOString() : null,
        organizer: row.tournament.organizer ?? null,
        playerCount: row.tournament.participantCount ?? null,
        tier: String(row.tournament.tier ?? "COMMUNITY"),
        sourceUrl: row.tournament.sourceUrl ?? null,
        deckCount: 1,
      });
    }
  }

  // Ordena semanas cronologicamente
  const sortedWeeks = Array.from(weekBuckets.values()).sort((a, b) => a.start.getTime() - b.start.getTime());

  const globalArchetypeCounts = new Map<string, number>();

  const weekPoints: WeeklyTrendPoint[] = sortedWeeks.map((bucket) => {
    const totalLists = bucket.entries.length;
    const isSmallSample = totalLists < 6;
    const sampleWarning = isSmallSample
      ? `Amostra semanal reduzida (${totalLists} listas) — flutuações podem ser pontuais.`
      : null;

    // Agrupa arquétipos da semana
    const archMap = new Map<string, {
      name: string;
      colors: Set<string>;
      lists: number;
      wins: number;
      losses: number;
      draws: number;
    }>();

    for (const entry of bucket.entries) {
      const archName = (entry.archetype || "Desconhecido").trim();
      globalArchetypeCounts.set(archName, (globalArchetypeCounts.get(archName) || 0) + 1);

      let archItem = archMap.get(archName);
      if (!archItem) {
        archItem = {
          name: archName,
          colors: new Set(),
          lists: 0,
          wins: 0,
          losses: 0,
          draws: 0,
        };
        archMap.set(archName, archItem);
      }

      archItem.lists += 1;
      archItem.wins += entry.wins ?? 0;
      archItem.losses += entry.losses ?? 0;
      archItem.draws += entry.draws ?? 0;

      for (const item of entry.deckSnapshot?.items || []) {
        if (item.card?.color) archItem.colors.add(item.card.color);
      }
    }

    const archetypes: WeeklyArchetypeTrend[] = Array.from(archMap.values())
      .map((a) => {
        const matches = a.wins + a.losses + a.draws;
        const winRate = matches > 0 ? Number(((a.wins + 1) / (matches + 2)).toFixed(4)) : null;
        return {
          name: a.name,
          colors: Array.from(a.colors).sort(),
          lists: a.lists,
          share: totalLists > 0 ? Number((a.lists / totalLists).toFixed(4)) : 0,
          winRate,
          isSmallSample: a.lists < 3,
        };
      })
      .sort((a, b) => b.share - a.share || b.lists - a.lists);

    return {
      weekKey: bucket.weekKey,
      weekLabel: bucket.weekLabel,
      startDate: bucket.start.toISOString(),
      endDate: bucket.end.toISOString(),
      totalLists,
      totalEvents: bucket.events.size,
      isSmallSample,
      sampleWarning,
      archetypes,
    };
  });

  const topArchetypes = Array.from(globalArchetypeCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map((e) => e[0]);

  const allTournaments = Array.from(allEventsMap.values()).sort((a, b) => {
    const da = a.date ? new Date(a.date).getTime() : 0;
    const db = b.date ? new Date(b.date).getTime() : 0;
    return db - da || b.deckCount - a.deckCount;
  });

  const provenance: MetagameProvenance = {
    totalDecks: rows.length,
    totalTournaments: allTournaments.length,
    startDate: earliestDate ? earliestDate.toISOString() : null,
    endDate: latestDate ? latestDate.toISOString() : null,
    tournaments: allTournaments,
  };

  return {
    seasonId: params.seasonId ?? null,
    tier: params.tier ?? null,
    weeks: weekPoints,
    topArchetypes,
    provenance,
    weightNote: "Ponderação Amostral: Grandes Torneios e Regionais possuem peso amostral superior a torneios locais.",
  };
}

export interface MatchupCell {
  archetypeA: string;
  archetypeB: string;
  wins: number;
  losses: number;
  draws: number;
  winRate: number | null;
}

export interface MatchupMatrixResult {
  archetypes: string[];
  cells: MatchupCell[];
  wr1st: Record<string, number | null>;
  wr2nd: Record<string, number | null>;
  diceWinRate: Record<string, number | null>;
  sampleSize: number;
  hasData: boolean;
}

/**
 * Matriz de Confrontos (Fase 3, ver §2.4 do plano) -- SCAFFOLD. Lê HostedEventMatch de
 * eventos concluídos cruzando o arquétipo declarado de cada HostedEventParticipant
 * (campo novo, ver schema) e a telemetria de iniciativa (firstPlayerParticipantId /
 * diceWinnerParticipantId, também novos). Hoje não existe nenhuma UI que preencha esses
 * três campos -- o resultado normal é hasData=false até esse fluxo existir. A função em
 * si já está correta e pronta pra quando essa captura for implementada.
 */
export async function getMatchupMatrix(
  prisma: PrismaClient,
  params: { seasonId?: string | null; sinceDate?: Date | null },
): Promise<MatchupMatrixResult> {
  const matches = await prisma.hostedEventMatch.findMany({
    where: {
      result: { in: [HostedEventMatchResult.PLAYER_A_WIN, HostedEventMatchResult.PLAYER_B_WIN, HostedEventMatchResult.DRAW] },
      participantBId: { not: null },
      round: {
        event: {
          isActive: true,
          status: HostedEventStatus.COMPLETED,
          ...(params.seasonId ? { seasonId: params.seasonId } : {}),
          ...(params.sinceDate ? { dateStart: { gte: params.sinceDate } } : {}),
        },
      },
    },
    select: {
      result: true,
      participantAId: true,
      participantBId: true,
      firstPlayerParticipantId: true,
      diceWinnerParticipantId: true,
      participantA: { select: { id: true, archetype: true } },
      participantB: { select: { id: true, archetype: true } },
    },
  });

  const usable = matches.filter((m) => m.participantA.archetype?.trim() && m.participantB?.archetype?.trim());

  const archetypeSet = new Set<string>();
  const cellMap = new Map<string, MatchupCell>();
  const initiativeTally = new Map<string, { firstWins: number; firstGames: number; secondWins: number; secondGames: number; diceWins: number; diceGames: number }>();

  const bumpInitiative = (archetype: string) => {
    if (!initiativeTally.has(archetype)) {
      initiativeTally.set(archetype, { firstWins: 0, firstGames: 0, secondWins: 0, secondGames: 0, diceWins: 0, diceGames: 0 });
    }
    return initiativeTally.get(archetype)!;
  };

  for (const match of usable) {
    const archA = match.participantA.archetype!.trim();
    const archB = match.participantB!.archetype!.trim();
    archetypeSet.add(archA);
    archetypeSet.add(archB);

    const aWon = match.result === HostedEventMatchResult.PLAYER_A_WIN;
    const bWon = match.result === HostedEventMatchResult.PLAYER_B_WIN;
    const draw = match.result === HostedEventMatchResult.DRAW;

    const cellKey = `${archA}|||${archB}`;
    const cell = cellMap.get(cellKey) || { archetypeA: archA, archetypeB: archB, wins: 0, losses: 0, draws: 0, winRate: null };
    if (aWon) cell.wins += 1;
    else if (bWon) cell.losses += 1;
    else if (draw) cell.draws += 1;
    cellMap.set(cellKey, cell);

    const reverseKey = `${archB}|||${archA}`;
    const reverseCell = cellMap.get(reverseKey) || { archetypeA: archB, archetypeB: archA, wins: 0, losses: 0, draws: 0, winRate: null };
    if (bWon) reverseCell.wins += 1;
    else if (aWon) reverseCell.losses += 1;
    else if (draw) reverseCell.draws += 1;
    cellMap.set(reverseKey, reverseCell);

    if (match.firstPlayerParticipantId) {
      const firstIsA = match.firstPlayerParticipantId === match.participantAId;
      const firstArchetype = firstIsA ? archA : archB;
      const secondArchetype = firstIsA ? archB : archA;
      const firstWon = firstIsA ? aWon : bWon;
      const secondWon = firstIsA ? bWon : aWon;
      if (!draw) {
        const firstStats = bumpInitiative(firstArchetype);
        firstStats.firstGames += 1;
        if (firstWon) firstStats.firstWins += 1;
        const secondStats = bumpInitiative(secondArchetype);
        secondStats.secondGames += 1;
        if (secondWon) secondStats.secondWins += 1;
      }
    }

    if (match.diceWinnerParticipantId && !draw) {
      const diceIsA = match.diceWinnerParticipantId === match.participantAId;
      const diceArchetype = diceIsA ? archA : archB;
      const diceWon = diceIsA ? aWon : bWon;
      const diceStats = bumpInitiative(diceArchetype);
      diceStats.diceGames += 1;
      if (diceWon) diceStats.diceWins += 1;
    }
  }

  for (const cell of cellMap.values()) {
    const total = cell.wins + cell.losses + cell.draws;
    cell.winRate = total > 0 ? Number((cell.wins / total).toFixed(4)) : null;
  }

  const wr1st: Record<string, number | null> = {};
  const wr2nd: Record<string, number | null> = {};
  const diceWinRate: Record<string, number | null> = {};
  for (const [archetype, stats] of initiativeTally.entries()) {
    wr1st[archetype] = stats.firstGames > 0 ? Number((stats.firstWins / stats.firstGames).toFixed(4)) : null;
    wr2nd[archetype] = stats.secondGames > 0 ? Number((stats.secondWins / stats.secondGames).toFixed(4)) : null;
    diceWinRate[archetype] = stats.diceGames > 0 ? Number((stats.diceWins / stats.diceGames).toFixed(4)) : null;
  }

  return {
    archetypes: Array.from(archetypeSet).sort(),
    cells: Array.from(cellMap.values()),
    wr1st,
    wr2nd,
    diceWinRate,
    sampleSize: usable.length,
    hasData: usable.length > 0,
  };
}
