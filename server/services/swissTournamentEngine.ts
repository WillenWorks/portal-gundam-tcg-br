/**
 * Motor de Torneios e Pareamento Suíço Determinístico (docs/55, Terminal 3).
 *
 * Implementa o algoritmo oficial de torneios de TCG (estilo Bandai / WotC):
 * 1. Cálculo de Tie-Breakers oficiais:
 *    - Match Points (Vitória = 3, Empate = 1, Derrota = 0, BYE = 3).
 *    - MWR (Match Win Rate com piso de 33%).
 *    - OMW% (Opponent Match Win % - média do MWR dos oponentes com piso de 33%).
 *    - GWR / GW% (Game Win Rate com piso de 33%).
 *    - OGW% (Opponent Game Win % - média do GWR dos oponentes com piso de 33%).
 * 2. Pareamento Suíço por Brackets de Pontuação:
 *    - Prevenção estrita de rematches (dois jogadores nunca se enfrentam duas vezes no suíço).
 *    - Algoritmo determinístico de busca com backtracking para resolução de downfloats.
 *    - Atribuição de BYE determinística para contagem ímpar (menor pontuação sem BYE prévio).
 *    - Ordenação sequencial de mesas (Top Tables com maiores pontuações nas mesas 1, 2...).
 * 3. Chaveamento de Top Cut (Single Elimination):
 *    - Top 4 (1v4, 2v3).
 *    - Top 8 (1v8, 4v5, 2v7, 3v6).
 *    - Top 16 (1v16, 8v9, 4v13, 5v12, 2v15, 7v10, 3v14, 6v11).
 */

export interface SwissParticipant {
  id: string;
  userId: string;
  displayName: string;
  username?: string;
  avatarUrl?: string | null;
  deckName?: string | null;
  deckSnapshotId?: string | null;
  isDropped?: boolean;
}

export type SwissMatchResult = "PENDING" | "PLAYER_A_WIN" | "PLAYER_B_WIN" | "DRAW" | "BYE";

export interface SwissMatch {
  id?: string;
  roundNumber: number;
  tableNumber?: number | null;
  participantAId: string;
  participantBId: string | null; // null = BYE
  result: SwissMatchResult;
  gamesWonA?: number;
  gamesWonB?: number;
}

export interface SwissStandingRow {
  rank: number;
  participantId: string;
  userId: string;
  displayName: string;
  username?: string;
  avatarUrl?: string | null;
  deckName?: string | null;
  deckSnapshotId?: string | null;
  matchPoints: number;
  matchesPlayed: number;
  matchWins: number;
  matchDraws: number;
  matchLosses: number;
  byes: number;
  gamesWon: number;
  gamesLost: number;
  gamesDraw: number;
  matchWinRate: number; // MWR com piso mínimo 0.33
  gameWinRate: number; // GW% com piso mínimo 0.33
  omwPercent: number; // Opponent Match Win %
  ogwPercent: number; // Opponent Game Win %
  opponentsFaced: string[];
}

export interface GeneratedPairing {
  tableNumber: number;
  participantAId: string;
  participantBId: string | null; // null = BYE
  isBye: boolean;
}

export interface TopCutBracketMatch {
  matchIndex: number;
  tableNumber: number;
  seedA: number;
  seedB: number;
  participantA: SwissParticipant;
  participantB: SwissParticipant;
}

export interface TopCutBracket {
  cutSize: 4 | 8 | 16;
  roundName: string;
  matches: TopCutBracketMatch[];
}

const MIN_WIN_RATE = 0.33;

/**
 * Calcula a classificação oficial (Standings) do torneio suíço com tie-breakers OMW% e OGW%.
 */
export function computeSwissStandings(
  participants: SwissParticipant[],
  matches: SwissMatch[],
): SwissStandingRow[] {
  const pMap = new Map<string, SwissParticipant>(participants.map((p) => [p.id, p]));

  interface StatsAccumulator {
    matchPoints: number;
    matchesPlayed: number;
    matchWins: number;
    matchDraws: number;
    matchLosses: number;
    byes: number;
    gamesWon: number;
    gamesLost: number;
    gamesDraw: number;
    opponentsFaced: Set<string>;
  }

  const stats = new Map<string, StatsAccumulator>();
  for (const p of participants) {
    stats.set(p.id, {
      matchPoints: 0,
      matchesPlayed: 0,
      matchWins: 0,
      matchDraws: 0,
      matchLosses: 0,
      byes: 0,
      gamesWon: 0,
      gamesLost: 0,
      gamesDraw: 0,
      opponentsFaced: new Set<string>(),
    });
  }

  // 1. Processar resultados de partidas
  for (const m of matches) {
    if (m.result === "PENDING") continue;

    const sA = stats.get(m.participantAId);
    if (!sA) continue;

    if (m.result === "BYE" || !m.participantBId) {
      sA.matchPoints += 3;
      sA.matchesPlayed += 1;
      sA.matchWins += 1;
      sA.byes += 1;
      sA.gamesWon += 2;
      continue;
    }

    const sB = stats.get(m.participantBId);
    if (!sB) continue;

    sA.matchesPlayed += 1;
    sB.matchesPlayed += 1;
    sA.opponentsFaced.add(m.participantBId);
    sB.opponentsFaced.add(m.participantAId);

    // Contagem de jogos (Bo3 default se não informado: 2-0 / 2-1 / 1-1)
    const gWonA = m.gamesWonA ?? (m.result === "PLAYER_A_WIN" ? 2 : m.result === "PLAYER_B_WIN" ? 0 : 1);
    const gWonB = m.gamesWonB ?? (m.result === "PLAYER_B_WIN" ? 2 : m.result === "PLAYER_A_WIN" ? 0 : 1);

    sA.gamesWon += gWonA;
    sA.gamesLost += gWonB;
    sB.gamesWon += gWonB;
    sB.gamesLost += gWonA;

    if (m.result === "PLAYER_A_WIN") {
      sA.matchPoints += 3;
      sA.matchWins += 1;
      sB.matchLosses += 1;
    } else if (m.result === "PLAYER_B_WIN") {
      sB.matchPoints += 3;
      sB.matchWins += 1;
      sA.matchLosses += 1;
    } else if (m.result === "DRAW") {
      sA.matchPoints += 1;
      sB.matchPoints += 1;
      sA.matchDraws += 1;
      sB.matchDraws += 1;
    }
  }

  // 2. Calcular MWR e GWR individuais (com piso mínimo de 0.33)
  const individualRates = new Map<string, { mwr: number; gwr: number }>();
  for (const [pId, s] of stats.entries()) {
    const rawMwr = s.matchesPlayed > 0 ? s.matchPoints / (s.matchesPlayed * 3) : MIN_WIN_RATE;
    const mwr = Math.max(MIN_WIN_RATE, rawMwr);

    const totalGames = s.gamesWon + s.gamesLost + s.gamesDraw;
    const rawGwr = totalGames > 0 ? (s.gamesWon * 3 + s.gamesDraw * 1) / (totalGames * 3) : MIN_WIN_RATE;
    const gwr = Math.max(MIN_WIN_RATE, rawGwr);

    individualRates.set(pId, { mwr, gwr });
  }

  // 3. Calcular OMW% e OGW%
  const rows: Omit<SwissStandingRow, "rank">[] = [];
  for (const [pId, s] of stats.entries()) {
    const p = pMap.get(pId)!;
    const rates = individualRates.get(pId)!;
    const oppIds = Array.from(s.opponentsFaced);

    let omw = MIN_WIN_RATE;
    let ogw = MIN_WIN_RATE;

    if (oppIds.length > 0) {
      let sumOppMwr = 0;
      let sumOppGwr = 0;
      for (const oppId of oppIds) {
        const oppRates = individualRates.get(oppId);
        sumOppMwr += oppRates ? oppRates.mwr : MIN_WIN_RATE;
        sumOppGwr += oppRates ? oppRates.gwr : MIN_WIN_RATE;
      }
      omw = sumOppMwr / oppIds.length;
      ogw = sumOppGwr / oppIds.length;
    }

    rows.push({
      participantId: p.id,
      userId: p.userId,
      displayName: p.displayName,
      username: p.username,
      avatarUrl: p.avatarUrl,
      deckName: p.deckName,
      deckSnapshotId: p.deckSnapshotId,
      matchPoints: s.matchPoints,
      matchesPlayed: s.matchesPlayed,
      matchWins: s.matchWins,
      matchDraws: s.matchDraws,
      matchLosses: s.matchLosses,
      byes: s.byes,
      gamesWon: s.gamesWon,
      gamesLost: s.gamesLost,
      gamesDraw: s.gamesDraw,
      matchWinRate: Math.round(rates.mwr * 10000) / 10000,
      gameWinRate: Math.round(rates.gwr * 10000) / 10000,
      omwPercent: Math.round(omw * 10000) / 10000,
      ogwPercent: Math.round(ogw * 10000) / 10000,
      opponentsFaced: oppIds,
    });
  }

  // 4. Ordenação oficial de Tie-Breakers:
  //    1. Match Points (Desc)
  //    2. OMW% (Desc)
  //    3. Game Win Rate (Desc)
  //    4. OGW% (Desc)
  //    5. Determinístico por ID
  rows.sort((a, b) => {
    if (b.matchPoints !== a.matchPoints) return b.matchPoints - a.matchPoints;
    if (Math.abs(b.omwPercent - a.omwPercent) > 1e-6) return b.omwPercent - a.omwPercent;
    if (Math.abs(b.gameWinRate - a.gameWinRate) > 1e-6) return b.gameWinRate - a.gameWinRate;
    if (Math.abs(b.ogwPercent - a.ogwPercent) > 1e-6) return b.ogwPercent - a.ogwPercent;
    return a.participantId.localeCompare(b.participantId);
  });

  return rows.map((row, idx) => ({
    rank: idx + 1,
    ...row,
  }));
}

/**
 * Gera os pareamentos de uma rodada do torneio suíço com prevenção estrita de rematches
 * e atribuição justa de BYE para número ímpar.
 */
export function generateSwissPairings(
  participants: SwissParticipant[],
  previousMatches: SwissMatch[],
  _roundNumber: number,
): GeneratedPairing[] {
  // Filtrar apenas jogadores ativos (não dropados)
  const active = participants.filter((p) => !p.isDropped);
  if (active.length === 0) return [];
  if (active.length === 1) {
    return [
      {
        tableNumber: 1,
        participantAId: active[0].id,
        participantBId: null,
        isBye: true,
      },
    ];
  }

  // Construir matriz de histórico de confrontos e BYEs
  const facedMap = new Map<string, Set<string>>();
  const byesMap = new Map<string, number>();

  for (const p of active) {
    facedMap.set(p.id, new Set<string>());
    byesMap.set(p.id, 0);
  }

  for (const m of previousMatches) {
    if (!facedMap.has(m.participantAId)) continue;
    if (m.result === "BYE" || !m.participantBId) {
      byesMap.set(m.participantAId, (byesMap.get(m.participantAId) ?? 0) + 1);
    } else {
      facedMap.get(m.participantAId)?.add(m.participantBId);
      facedMap.get(m.participantBId)?.add(m.participantAId);
    }
  }

  // Classificação atual para agrupamento em brackets
  const currentStandings = computeSwissStandings(active, previousMatches);
  const standingsMap = new Map(currentStandings.map((s) => [s.participantId, s]));

  let pairingPool = [...active];
  let byePairing: GeneratedPairing | null = null;

  // Se número ímpar, seleciona exatamente 1 jogador para BYE
  if (pairingPool.length % 2 !== 0) {
    // Candidatos que nunca receberam BYE
    let byeCandidates = pairingPool.filter((p) => (byesMap.get(p.id) ?? 0) === 0);
    if (byeCandidates.length === 0) {
      byeCandidates = [...pairingPool];
    }

    // Ordenar candidatos pelo menor número de pontos (e pior rank)
    byeCandidates.sort((a, b) => {
      const sA = standingsMap.get(a.id);
      const sB = standingsMap.get(b.id);
      const ptsA = sA?.matchPoints ?? 0;
      const ptsB = sB?.matchPoints ?? 0;
      if (ptsA !== ptsB) return ptsA - ptsB; // Menor pontuação primeiro
      const rankA = sA?.rank ?? 999;
      const rankB = sB?.rank ?? 999;
      return rankB - rankA; // Pior rank primeiro
    });

    const byeRecipient = byeCandidates[0];
    pairingPool = pairingPool.filter((p) => p.id !== byeRecipient.id);

    byePairing = {
      tableNumber: 0, // Será ajustado no fim
      participantAId: byeRecipient.id,
      participantBId: null,
      isBye: true,
    };
  }

  // Ordenar pool por pontuação / ranking atual (do maior pro menor)
  pairingPool.sort((a, b) => {
    const sA = standingsMap.get(a.id);
    const sB = standingsMap.get(b.id);
    const rankA = sA?.rank ?? 999;
    const rankB = sB?.rank ?? 999;
    return rankA - rankB;
  });

  // Algoritmo de busca por pareamento com backtracking
  const pairs = backtrackPairing(pairingPool, facedMap, standingsMap);

  if (!pairs) {
    // Fallback extremo: se for matematicamente impossível evitar rematch sem relaxar
    // (ex: torneio de 4 jogadores na rodada 4 onde todos já se enfrentaram), relaxa restrição
    const fallbackPairs = fallbackPairing(pairingPool);
    return formatTablePairings(fallbackPairs, byePairing, standingsMap);
  }

  return formatTablePairings(pairs, byePairing, standingsMap);
}

/**
 * Algoritmo com backtracking para encontrar pareamento sem rematches minimizando
 * a diferença de pontuação entre os oponentes.
 */
function backtrackPairing(
  remaining: SwissParticipant[],
  facedMap: Map<string, Set<string>>,
  standingsMap: Map<string, SwissStandingRow>,
): [SwissParticipant, SwissParticipant][] | null {
  if (remaining.length === 0) return [];
  if (remaining.length % 2 !== 0) return null;

  const current = remaining[0];
  const others = remaining.slice(1);
  const currentFaced = facedMap.get(current.id) ?? new Set();

  // Candidatos válidos que current ainda não enfrentou
  const validCandidates: SwissParticipant[] = [];
  for (const candidate of others) {
    if (!currentFaced.has(candidate.id)) {
      validCandidates.push(candidate);
    }
  }

  // Ordenar candidatos por proximidade de pontos em relação ao jogador atual
  const currentPoints = standingsMap.get(current.id)?.matchPoints ?? 0;
  validCandidates.sort((a, b) => {
    const ptsA = standingsMap.get(a.id)?.matchPoints ?? 0;
    const ptsB = standingsMap.get(b.id)?.matchPoints ?? 0;
    const diffA = Math.abs(currentPoints - ptsA);
    const diffB = Math.abs(currentPoints - ptsB);
    return diffA - diffB;
  });

  for (const candidate of validCandidates) {
    const nextRemaining = others.filter((p) => p.id !== candidate.id);
    const subResult = backtrackPairing(nextRemaining, facedMap, standingsMap);
    if (subResult !== null) {
      return [[current, candidate], ...subResult];
    }
  }

  return null;
}

/**
 * Pareamento de fallback para cenários de saturação de rematches.
 */
function fallbackPairing(players: SwissParticipant[]): [SwissParticipant, SwissParticipant][] {
  const result: [SwissParticipant, SwissParticipant][] = [];
  for (let i = 0; i < players.length; i += 2) {
    if (i + 1 < players.length) {
      result.push([players[i], players[i + 1]]);
    }
  }
  return result;
}

/**
 * Atribui os números de mesa (Mesa 1, 2, 3...) ordenados pela pontuação das mesas (Feature Tables).
 */
function formatTablePairings(
  pairs: [SwissParticipant, SwissParticipant][],
  byePairing: GeneratedPairing | null,
  standingsMap: Map<string, SwissStandingRow>,
): GeneratedPairing[] {
  // Ordenar pares pela soma de pontos dos jogadores (maiores pontuações nas mesas menores)
  pairs.sort((a, b) => {
    const ptsA = (standingsMap.get(a[0].id)?.matchPoints ?? 0) + (standingsMap.get(a[1].id)?.matchPoints ?? 0);
    const ptsB = (standingsMap.get(b[0].id)?.matchPoints ?? 0) + (standingsMap.get(b[1].id)?.matchPoints ?? 0);
    return ptsB - ptsA;
  });

  const pairings: GeneratedPairing[] = [];
  let table = 1;

  for (const [p1, p2] of pairs) {
    pairings.push({
      tableNumber: table++,
      participantAId: p1.id,
      participantBId: p2.id,
      isBye: false,
    });
  }

  if (byePairing) {
    byePairing.tableNumber = table;
    pairings.push(byePairing);
  }

  return pairings;
}

/**
 * Gera a estrutura de chaveamento de Top Cut (Single Elimination) a partir dos Standings finais.
 */
export function generateTopCutBracket(
  standings: SwissStandingRow[],
  participants: SwissParticipant[],
  cutSize: 4 | 8 | 16,
): TopCutBracket {
  if (standings.length < cutSize) {
    throw new Error(`Não há participantes suficientes (${standings.length}) para gerar um Top ${cutSize}.`);
  }

  const pMap = new Map<string, SwissParticipant>(participants.map((p) => [p.id, p]));
  const topCutRows = standings.slice(0, cutSize);

  let seedPairs: [number, number][];
  let roundName: string;

  if (cutSize === 4) {
    roundName = "Top 4 (Semifinais)";
    seedPairs = [
      [1, 4],
      [2, 3],
    ];
  } else if (cutSize === 8) {
    roundName = "Top 8 (Quartas de Final)";
    seedPairs = [
      [1, 8],
      [4, 5],
      [2, 7],
      [3, 6],
    ];
  } else {
    roundName = "Top 16 (Oitavas de Final)";
    seedPairs = [
      [1, 16],
      [8, 9],
      [4, 13],
      [5, 12],
      [2, 15],
      [7, 10],
      [3, 14],
      [6, 11],
    ];
  }

  const matches: TopCutBracketMatch[] = seedPairs.map(([seedA, seedB], index) => {
    const rowA = topCutRows[seedA - 1];
    const rowB = topCutRows[seedB - 1];
    const partA = pMap.get(rowA.participantId)!;
    const partB = pMap.get(rowB.participantId)!;

    return {
      matchIndex: index + 1,
      tableNumber: index + 1,
      seedA,
      seedB,
      participantA: partA,
      participantB: partB,
    };
  });

  return {
    cutSize,
    roundName,
    matches,
  };
}
