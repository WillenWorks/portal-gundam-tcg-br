/*
 * Base métrica do metagame competitivo (StatsPage) -- SEMPRE a partir de DeckSnapshot
 * travado num resultado real (TournamentEntry ou HostedEventParticipant já finalizado),
 * nunca de Deck/DeckItem público. Ver comentário original em server/index.ts sobre por
 * que essa é a única fonte tratada como "resultado real".
 *
 * Métricas cobertas (pedido do usuário, inspirado em Wingtable/Egman Events/MTGGoldfish):
 *   - Presença por carta (Meta Share / Inclusion Rate) -- já existia.
 *   - Winrate por carta: mesma leitura de GET /api/cards/:id/stats (wins/losses/draws
 *     do resultado do deck que carrega a carta), generalizada em lote pra todas as
 *     cartas do recorte de uma vez (1 passada pelos snapshots, não 1 por carta).
 *   - Cópias médias por carta (avgCopies) -- consistência de build.
 *   - Tendência (rising/declining): divide os decks elegíveis em dois períodos pela
 *     DATA DO EVENTO (Tournament.dateStart / HostedEvent.dateStart, não a data da
 *     snapshot) usando um corte pela MEDIANA de contagem, não uma janela de calendário
 *     fixa -- com poucos decks cadastrados uma janela fixa (ex: 30 dias) resultaria
 *     quase sempre em 0 de um lado. O corte por mediana sempre produz dois grupos
 *     não-vazios (a partir de uma amostra mínima), e a leitura fica mais precisa à
 *     medida que mais eventos são cadastrados -- exatamente o "quanto mais se
 *     cadastre, mais acurado" pedido.
 *   - Distribuição por trait e por série/obra de origem, mesmo critério "por deck"
 *     (não por cópia) já usado em colorDistribution.
 *
 * Filtros: seasonId/setId (já existiam) + color, trait, series (deck elegível = tem
 * >=1 carta batendo o filtro, mesmo critério de setId) + startDate/endDate (recorta
 * pela data do evento antes de qualquer cálculo).
 */
import { HostedEventStatus, HostedEventMatchResult, type PrismaClient } from "@prisma/client";
import { NON_STATS_SECTIONS, NON_STATS_CARD_TYPES } from "../src/lib/deck-legality.ts";

const TOP_CARDS_LIMIT = 15;
const TREND_LIMIT = 8;
const MIN_SNAPSHOTS_FOR_TREND = 4;
const MIN_PER_WINDOW_FOR_TREND = 2;

export interface MetagameStatsParams {
  seasonId: string | null;
  setId?: string;
  color?: string;
  trait?: string;
  series?: string;
  startDate?: Date;
  endDate?: Date;
}

type CardFields = {
  id: string;
  cardModelId: string | null;
  nameEn: string;
  namePt: string | null;
  color: string | null;
  setId: string | null;
  cardType: string;
  trait: string | null;
  traits: string[];
  series: string | null;
  sourceTitle: string | null;
};

type ItemRow = { deckSnapshotId: string; quantity: number; card: CardFields | null };

function cardMatchesTrait(card: CardFields, trait: string) {
  return card.trait === trait || card.traits.includes(trait);
}
function cardMatchesSeries(card: CardFields, series: string) {
  return card.series === series || card.sourceTitle === series;
}

export async function getMetagameStats(prisma: PrismaClient, params: MetagameStatsParams) {
  const { seasonId, setId, color, trait, series, startDate, endDate } = params;

  const eventDateFilter = (startDate || endDate) ? { dateStart: { ...(startDate ? { gte: startDate } : {}), ...(endDate ? { lte: endDate } : {}) } } : {};

  const [reportEntries, hostedParticipants] = await Promise.all([
    prisma.tournamentEntry.findMany({
      where: { deckSnapshotId: { not: null }, tournament: { isActive: true, ...(seasonId ? { seasonId } : {}), ...eventDateFilter } },
      select: { deckSnapshotId: true, wins: true, losses: true, draws: true, tournament: { select: { dateStart: true } } },
    }),
    prisma.hostedEventParticipant.findMany({
      where: { deckSnapshotId: { not: null }, event: { status: HostedEventStatus.COMPLETED, isActive: true, ...(seasonId ? { seasonId } : {}), ...eventDateFilter } },
      select: {
        deckSnapshotId: true,
        event: { select: { dateStart: true } },
        matchesAsA: { select: { result: true } },
        matchesAsB: { select: { result: true } },
      },
    }),
  ]);

  // Resultado (wins/losses/draws) e data do evento por snapshot -- só a PRIMEIRA
  // ocorrência conta (um snapshot normalmente vincula a um único resultado histórico).
  const snapshotOutcome = new Map<string, { wins: number; losses: number; draws: number; eventDate: Date | null }>();
  for (const entry of reportEntries) {
    if (!entry.deckSnapshotId || snapshotOutcome.has(entry.deckSnapshotId)) continue;
    snapshotOutcome.set(entry.deckSnapshotId, { wins: entry.wins ?? 0, losses: entry.losses ?? 0, draws: entry.draws ?? 0, eventDate: entry.tournament.dateStart });
  }
  for (const participant of hostedParticipants) {
    if (!participant.deckSnapshotId || snapshotOutcome.has(participant.deckSnapshotId)) continue;
    let wins = 0, losses = 0, draws = 0;
    for (const m of participant.matchesAsA) {
      if (m.result === HostedEventMatchResult.PLAYER_A_WIN || m.result === HostedEventMatchResult.BYE) wins += 1;
      else if (m.result === HostedEventMatchResult.PLAYER_B_WIN) losses += 1;
      else if (m.result === HostedEventMatchResult.DRAW) draws += 1;
    }
    for (const m of participant.matchesAsB) {
      if (m.result === HostedEventMatchResult.PLAYER_B_WIN) wins += 1;
      else if (m.result === HostedEventMatchResult.PLAYER_A_WIN) losses += 1;
      else if (m.result === HostedEventMatchResult.DRAW) draws += 1;
    }
    snapshotOutcome.set(participant.deckSnapshotId, { wins, losses, draws, eventDate: participant.event.dateStart });
  }

  const snapshotIds = Array.from(snapshotOutcome.keys());
  const empty = {
    setId: setId ?? null,
    totalDecks: 0,
    topCards: [] as unknown[],
    colorDistribution: [] as unknown[],
    colorCombos: [] as unknown[],
    traitDistribution: [] as unknown[],
    seriesDistribution: [] as unknown[],
    trend: null as { windowStart: string; windowMid: string; windowEnd: string; priorCount: number; recentCount: number } | null,
    risingCards: [] as unknown[],
    decliningCards: [] as unknown[],
  };
  if (!snapshotIds.length) return empty;

  const items: ItemRow[] = await prisma.deckSnapshotItem.findMany({
    where: { deckSnapshotId: { in: snapshotIds }, section: { notIn: NON_STATS_SECTIONS } },
    select: {
      deckSnapshotId: true,
      quantity: true,
      card: { select: { id: true, cardModelId: true, nameEn: true, namePt: true, color: true, setId: true, cardType: true, trait: true, traits: true, series: true, sourceTitle: true } },
    },
  });

  const bySnapshot = new Map<string, ItemRow[]>();
  for (const item of items) {
    const list = bySnapshot.get(item.deckSnapshotId) || [];
    list.push(item);
    bySnapshot.set(item.deckSnapshotId, list);
  }

  const deckMatchesScopedFilter = (list: ItemRow[]) => {
    if (!setId && !color && !trait && !series) return true;
    return list.some((entry) => {
      const card = entry.card;
      if (!card) return false;
      if (setId && card.setId !== setId) return false;
      if (color && card.color !== color) return false;
      if (trait && !cardMatchesTrait(card, trait)) return false;
      if (series && !cardMatchesSeries(card, series)) return false;
      return true;
    });
  };

  const eligibleSnapshotIds = snapshotIds.filter((id) => deckMatchesScopedFilter(bySnapshot.get(id) || []));
  const totalDecks = eligibleSnapshotIds.length;
  if (!totalDecks) return { ...empty, totalDecks: 0 };

  const presenceRate = (decks: number) => (totalDecks > 0 ? Number(((decks / totalDecks) * 100).toFixed(1)) : null);

  type CardAgg = { key: string; name: string; color: string | null; decks: number; totalCopies: number; wins: number; losses: number; draws: number };
  const cardCount = new Map<string, CardAgg>();
  const colorCount = new Map<string, number>();
  const comboCount = new Map<string, number>();
  const traitCount = new Map<string, number>();
  const seriesCount = new Map<string, number>();

  const computeDeckAggregates = (ids: string[]) => {
    const localCardCount = new Map<string, CardAgg>();
    for (const snapshotId of ids) {
      const list = bySnapshot.get(snapshotId) || [];
      const outcome = snapshotOutcome.get(snapshotId)!;
      const seen = new Set<string>();
      for (const entry of list) {
        const card = entry.card;
        if (!card || NON_STATS_CARD_TYPES.includes(card.cardType)) continue;
        const key = card.cardModelId || card.id;
        const agg = localCardCount.get(key) || { key, name: card.namePt || card.nameEn, color: card.color, decks: 0, totalCopies: 0, wins: 0, losses: 0, draws: 0 };
        agg.totalCopies += entry.quantity;
        if (!seen.has(key)) {
          seen.add(key);
          agg.decks += 1;
          agg.wins += outcome.wins;
          agg.losses += outcome.losses;
          agg.draws += outcome.draws;
        }
        localCardCount.set(key, agg);
      }
    }
    return localCardCount;
  };

  for (const snapshotId of eligibleSnapshotIds) {
    const list = bySnapshot.get(snapshotId) || [];
    const outcome = snapshotOutcome.get(snapshotId)!;
    const seenCards = new Set<string>();
    const deckColors = new Set<string>();
    const deckTraits = new Set<string>();
    const deckSeries = new Set<string>();

    for (const entry of list) {
      const card = entry.card;
      if (!card || NON_STATS_CARD_TYPES.includes(card.cardType)) continue;
      if (card.color) deckColors.add(card.color);
      if (card.trait) deckTraits.add(card.trait);
      card.traits.forEach((t) => deckTraits.add(t));
      const seriesLabel = card.series || card.sourceTitle;
      if (seriesLabel) deckSeries.add(seriesLabel);

      const key = card.cardModelId || card.id;
      const agg = cardCount.get(key) || { key, name: card.namePt || card.nameEn, color: card.color, decks: 0, totalCopies: 0, wins: 0, losses: 0, draws: 0 };
      agg.totalCopies += entry.quantity;
      if (!seenCards.has(key)) {
        seenCards.add(key);
        agg.decks += 1;
        agg.wins += outcome.wins;
        agg.losses += outcome.losses;
        agg.draws += outcome.draws;
      }
      cardCount.set(key, agg);
    }

    deckColors.forEach((c) => colorCount.set(c, (colorCount.get(c) ?? 0) + 1));
    deckTraits.forEach((t) => traitCount.set(t, (traitCount.get(t) ?? 0) + 1));
    deckSeries.forEach((s) => seriesCount.set(s, (seriesCount.get(s) ?? 0) + 1));
    if (deckColors.size) comboCount.set(Array.from(deckColors).sort().join(" + "), (comboCount.get(Array.from(deckColors).sort().join(" + ")) ?? 0) + 1);
  }

  const winRateFor = (agg: CardAgg) => {
    const total = agg.wins + agg.losses + agg.draws;
    return total > 0 ? Number(((agg.wins / total) * 100).toFixed(1)) : null;
  };

  const topCards = Array.from(cardCount.values())
    .sort((a, b) => b.decks - a.decks)
    .slice(0, TOP_CARDS_LIMIT)
    .map((entry) => ({
      cardModelId: entry.key,
      name: entry.name,
      color: entry.color,
      appearances: entry.decks,
      presenceRate: presenceRate(entry.decks),
      avgCopies: entry.decks > 0 ? Number((entry.totalCopies / entry.decks).toFixed(2)) : null,
      winRate: winRateFor(entry),
      recordedMatches: entry.wins + entry.losses + entry.draws,
    }));

  const colorDistribution = Array.from(colorCount.entries()).sort((a, b) => b[1] - a[1]).map(([c, decks]) => ({ color: c, decks, presenceRate: presenceRate(decks) }));
  const colorCombos = Array.from(comboCount.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([combo, decks]) => ({ combo, decks, presenceRate: presenceRate(decks) }));
  const traitDistribution = Array.from(traitCount.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([t, decks]) => ({ trait: t, decks, presenceRate: presenceRate(decks) }));
  const seriesDistribution = Array.from(seriesCount.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([s, decks]) => ({ series: s, decks, presenceRate: presenceRate(decks) }));

  // Tendência: corte por MEDIANA de contagem de decks elegíveis (ordenados pela data
  // real do evento), não janela de calendário fixa -- ver comentário no topo do arquivo.
  let trend: typeof empty.trend = null;
  let risingCards: unknown[] = [];
  let decliningCards: unknown[] = [];

  const datedSnapshots = eligibleSnapshotIds
    .map((id) => ({ id, date: snapshotOutcome.get(id)!.eventDate }))
    .filter((row): row is { id: string; date: Date } => row.date !== null)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  if (datedSnapshots.length >= MIN_SNAPSHOTS_FOR_TREND) {
    const mid = Math.floor(datedSnapshots.length / 2);
    const priorSnapshots = datedSnapshots.slice(0, mid);
    const recentSnapshots = datedSnapshots.slice(mid);

    if (priorSnapshots.length >= MIN_PER_WINDOW_FOR_TREND && recentSnapshots.length >= MIN_PER_WINDOW_FOR_TREND) {
      const priorIds = priorSnapshots.map((s) => s.id);
      const recentIds = recentSnapshots.map((s) => s.id);
      const priorAgg = computeDeckAggregates(priorIds);
      const recentAgg = computeDeckAggregates(recentIds);
      const priorTotal = priorIds.length;
      const recentTotal = recentIds.length;

      const allKeys = new Set([...priorAgg.keys(), ...recentAgg.keys()]);
      const deltas = Array.from(allKeys).map((key) => {
        const priorRate = priorTotal > 0 ? ((priorAgg.get(key)?.decks ?? 0) / priorTotal) * 100 : 0;
        const recentRate = recentTotal > 0 ? ((recentAgg.get(key)?.decks ?? 0) / recentTotal) * 100 : 0;
        const sample = recentAgg.get(key) || priorAgg.get(key)!;
        return { cardModelId: key, name: sample.name, color: sample.color, priorPresenceRate: Number(priorRate.toFixed(1)), recentPresenceRate: Number(recentRate.toFixed(1)), trendDelta: Number((recentRate - priorRate).toFixed(1)) };
      });

      risingCards = deltas.filter((d) => d.trendDelta > 0).sort((a, b) => b.trendDelta - a.trendDelta).slice(0, TREND_LIMIT);
      decliningCards = deltas.filter((d) => d.trendDelta < 0).sort((a, b) => a.trendDelta - b.trendDelta).slice(0, TREND_LIMIT);

      trend = {
        windowStart: priorSnapshots[0].date.toISOString(),
        windowMid: recentSnapshots[0].date.toISOString(),
        windowEnd: recentSnapshots[recentSnapshots.length - 1].date.toISOString(),
        priorCount: priorTotal,
        recentCount: recentTotal,
      };
    }
  }

  return { setId: setId ?? null, totalDecks, topCards, colorDistribution, colorCombos, traitDistribution, seriesDistribution, trend, risingCards, decliningCards };
}
