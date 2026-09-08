import type { PrismaClient } from "@prisma/client";
import type { PlayerAction } from "../engine/actions";

export interface SimulatorMetaStats {
  totalMatches: number;
  firstPlayerWinrate: number;
  avgTurns: number;
  winReasons: Record<string, number>;
  deckPerformance: Array<{
    deckKey: string;
    matches: number;
    wins: number;
    winrate: number;
  }>;
  matchups: Array<{
    deckA: string;
    deckB: string;
    matches: number;
    winsA: number;
    winsB: number;
    winrateA: number;
  }>;
}

export interface SimulatorCardPlayStat {
  cardCode: string;
  timesPlayed: number;
  wins: number;
  losses: number;
  playWinrate: number;
}

export interface SimulatorCardStats {
  totalAnalyzedMatches: number;
  cards: SimulatorCardPlayStat[];
}

export interface MetaStatsFilter {
  mode?: "casual" | "ranked" | "training" | "all";
  minTurns?: number;
  since?: Date;
}

/**
 * Computa estatísticas agregadas de metagame a partir de SimulatorMatchLog.
 */
export async function computeSimulatorMetaStats(
  prisma: PrismaClient,
  filter: MetaStatsFilter = {},
): Promise<SimulatorMetaStats> {
  const where: {
    mode?: string;
    turns?: { gte: number };
    createdAt?: { gte: Date };
  } = {};

  if (filter.mode && filter.mode !== "all") {
    where.mode = filter.mode;
  }
  if (filter.minTurns != null) {
    where.turns = { gte: filter.minTurns };
  }
  if (filter.since) {
    where.createdAt = { gte: filter.since };
  }

  const logs = await prisma.simulatorMatchLog.findMany({
    where,
    select: {
      id: true,
      deckKeyA: true,
      deckKeyB: true,
      winner: true,
      winReason: true,
      turns: true,
      durationMs: true,
    },
    orderBy: { createdAt: "desc" },
    take: 5000,
  });

  if (logs.length === 0) {
    return {
      totalMatches: 0,
      firstPlayerWinrate: 0,
      avgTurns: 0,
      winReasons: {},
      deckPerformance: [],
      matchups: [],
    };
  }

  let firstPlayerWins = 0;
  let turnsSum = 0;
  const winReasons: Record<string, number> = {};
  const deckWins: Record<string, { matches: number; wins: number }> = {};
  const matchupMap = new Map<string, { deckA: string; deckB: string; matches: number; winsA: number; winsB: number }>();

  for (const log of logs) {
    turnsSum += log.turns;
    winReasons[log.winReason] = (winReasons[log.winReason] ?? 0) + 1;

    if (log.winner === "A") {
      firstPlayerWins += 1;
    }

    const keyA = log.deckKeyA || "Custom-A";
    const keyB = log.deckKeyB || "Custom-B";

    // Estatísticas por deck
    if (!deckWins[keyA]) deckWins[keyA] = { matches: 0, wins: 0 };
    if (!deckWins[keyB]) deckWins[keyB] = { matches: 0, wins: 0 };

    deckWins[keyA].matches += 1;
    deckWins[keyB].matches += 1;

    if (log.winner === "A") deckWins[keyA].wins += 1;
    else if (log.winner === "B") deckWins[keyB].wins += 1;

    // Estatísticas de confronto A x B ordenados alfabeticamente
    const [normA, normB, inverted] = keyA <= keyB ? [keyA, keyB, false] : [keyB, keyA, true];
    const matchupKey = `${normA} vs ${normB}`;
    let mEntry = matchupMap.get(matchupKey);
    if (!mEntry) {
      mEntry = { deckA: normA, deckB: normB, matches: 0, winsA: 0, winsB: 0 };
      matchupMap.set(matchupKey, mEntry);
    }
    mEntry.matches += 1;
    if (log.winner === "A") {
      if (!inverted) mEntry.winsA += 1;
      else mEntry.winsB += 1;
    } else if (log.winner === "B") {
      if (!inverted) mEntry.winsB += 1;
      else mEntry.winsA += 1;
    }
  }

  const deckPerformance = Object.entries(deckWins).map(([deckKey, stat]) => ({
    deckKey,
    matches: stat.matches,
    wins: stat.wins,
    winrate: stat.matches > 0 ? Number((stat.wins / stat.matches).toFixed(3)) : 0,
  }));

  const matchups = Array.from(matchupMap.values()).map((m) => ({
    ...m,
    winrateA: m.matches > 0 ? Number((m.winsA / m.matches).toFixed(3)) : 0,
  }));

  return {
    totalMatches: logs.length,
    firstPlayerWinrate: Number((firstPlayerWins / logs.length).toFixed(3)),
    avgTurns: Number((turnsSum / logs.length).toFixed(1)),
    winReasons,
    deckPerformance: deckPerformance.sort((a, b) => b.matches - a.matches),
    matchups: matchups.sort((a, b) => b.matches - a.matches),
  };
}

/**
 * Computa estatísticas de cartas jogadas e taxas de vitória associadas.
 */
export async function computeSimulatorCardStats(
  prisma: PrismaClient,
  limitMatches = 1000,
): Promise<SimulatorCardStats> {
  const logs = await prisma.simulatorMatchLog.findMany({
    where: {
      turns: { gte: 3 }, // Desconsidera abandono relâmpago
    },
    select: {
      id: true,
      winner: true,
      actions: true,
    },
    orderBy: { createdAt: "desc" },
    take: limitMatches,
  });

  const cardStatsMap = new Map<string, { timesPlayed: number; wins: number; losses: number }>();

  for (const log of logs) {
    const rawActions = log.actions;
    if (!Array.isArray(rawActions)) continue;

    // Rastreia cartas únicas jogadas por cada jogador nesta partida
    const playedByPlayer: Record<"A" | "B", Set<string>> = { A: new Set(), B: new Set() };

    for (const action of rawActions as PlayerAction[]) {
      if (!action || typeof action !== "object") continue;
      // Extrai código ou id de carta jogada (deploy / command)
      let cardCode: string | undefined;
      let playerSeat: "A" | "B" | undefined;

      if (action.kind === "deployCard") {
        // cardInstanceId costuma ser "A-X" ou def.code
        cardCode = action.cardInstanceId;
      }

      if (cardCode) {
        // Se puder inferir o seat:
        if (cardCode.startsWith("A-")) playerSeat = "A";
        else if (cardCode.startsWith("B-")) playerSeat = "B";

        if (playerSeat) {
          playedByPlayer[playerSeat].add(cardCode);
        }
      }
    }

    // Consolida vitórias/derrotas
    for (const seat of ["A", "B"] as const) {
      const isWinner = log.winner === seat;
      for (const card of playedByPlayer[seat]) {
        let entry = cardStatsMap.get(card);
        if (!entry) {
          entry = { timesPlayed: 0, wins: 0, losses: 0 };
          cardStatsMap.set(card, entry);
        }
        entry.timesPlayed += 1;
        if (isWinner) entry.wins += 1;
        else entry.losses += 1;
      }
    }
  }

  const cards: SimulatorCardPlayStat[] = Array.from(cardStatsMap.entries())
    .map(([cardCode, stat]) => ({
      cardCode,
      timesPlayed: stat.timesPlayed,
      wins: stat.wins,
      losses: stat.losses,
      playWinrate: stat.timesPlayed > 0 ? Number((stat.wins / stat.timesPlayed).toFixed(3)) : 0,
    }))
    .sort((a, b) => b.timesPlayed - a.timesPlayed);

  return {
    totalAnalyzedMatches: logs.length,
    cards,
  };
}
