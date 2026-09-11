import { HostedEventMatchResult, HostedEventStatus, type PrismaClient } from "@prisma/client";
import { NON_STATS_CARD_TYPES } from "../src/lib/deck-legality.ts";

export interface PowerRankingSignatureCard {
  id: string;
  code: string;
  name: string;
  imageUrl: string | null;
  imageMediumUrl: string | null;
  color: string | null;
}

export interface PowerRankingEntry {
  archetype: string;
  colors: string[];
  signatureCard: PowerRankingSignatureCard | null;
  deckCount: number;
  metaShare: number; // 0..1, sobre o total de entradas com arquétipo declarado no recorte
  wins: number;
  losses: number;
  draws: number;
  recordedMatches: number; // wins+losses+draws somados -- 0 quando nenhuma entrada tem placar lançado
  winRate: number | null; // null quando recordedMatches === 0 ("sem dados de placar")
  powerRankingScore: number; // 0..10, composto normalizado (winrate ajustado + meta share relativo)
  bestPlacement: number | null;
  sampleTournaments: Array<{ id: string; name: string }>;
}

type ArchetypeEntryRow = {
  archetype: string | null;
  placement: number | null;
  wins: number | null;
  losses: number | null;
  draws: number | null;
  tournament: { id: string; name: string };
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
function pickSignatureCard(items: ArchetypeEntryRow["deckSnapshot"] extends infer T ? NonNullable<T>["items"] : never): PowerRankingSignatureCard | null {
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
export async function getPowerRankings(
  prisma: PrismaClient,
  params: { seasonId?: string | null; setId?: string | null },
): Promise<PowerRankingEntry[]> {
  const rows = await prisma.tournamentEntry.findMany({
    where: {
      archetype: { not: null },
      tournament: { isActive: true, ...(params.seasonId ? { seasonId: params.seasonId } : {}) },
    },
    select: {
      archetype: true,
      placement: true,
      wins: true,
      losses: true,
      draws: true,
      tournament: { select: { id: true, name: true } },
      deckSnapshot: { select: { items: { select: { quantity: true, card: { select: { id: true, code: true, nameEn: true, namePt: true, color: true, cardType: true, rarity: true, cost: true, setId: true, imageUrl: true, imageMediumUrl: true } } } } } },
    },
  });

  const scoped: ArchetypeEntryRow[] = params.setId
    ? rows.filter((row) => row.deckSnapshot?.items.some((item) => item.card.setId === params.setId))
    : rows;

  if (!scoped.length) return [];

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

    return {
      archetype,
      colors,
      signatureCard,
      deckCount: entries.length,
      metaShare: totalEntries > 0 ? Number((entries.length / totalEntries).toFixed(4)) : 0,
      wins,
      losses,
      draws,
      recordedMatches,
      winRate,
      adjustedWinRate,
      bestPlacement,
      sampleTournaments: Array.from(tournamentMap.entries()).map(([id, name]) => ({ id, name })),
    };
  });

  const maxShare = Math.max(...raw.map((r) => r.metaShare), 0.0001);

  return raw
    .map((r) => ({
      archetype: r.archetype,
      colors: r.colors,
      signatureCard: r.signatureCard,
      deckCount: r.deckCount,
      metaShare: r.metaShare,
      wins: r.wins,
      losses: r.losses,
      draws: r.draws,
      recordedMatches: r.recordedMatches,
      winRate: r.winRate,
      powerRankingScore: Number((10 * (0.6 * r.adjustedWinRate + 0.4 * (r.metaShare / maxShare))).toFixed(1)),
      bestPlacement: r.bestPlacement,
      sampleTournaments: r.sampleTournaments,
    }))
    .sort((a, b) => b.powerRankingScore - a.powerRankingScore || b.metaShare - a.metaShare);
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
