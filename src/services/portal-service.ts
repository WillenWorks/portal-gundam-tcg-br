/* Service layer aligned to the persistent local store and ready for future Prisma/API adapters. */
import type { CardRecord, DeckEntry, DeckRecord } from "@/modules/core/types";
import {
  getDashboardMetrics,
  getDeck,
  listCards,
  listRules,
  listTournaments,
  saveDeck,
} from "@/lib/portal-db";

type ExpandedDeckEntry = CardRecord & { quantity: number };

export const catalogService = {
  listCards(): CardRecord[] {
    return listCards();
  },
  searchCards(query: string): CardRecord[] {
    const q = query.trim().toLowerCase();
    if (!q) return listCards();
    return listCards().filter((card) =>
      [card.name, card.namePt, card.code, card.series, card.trait, ...card.keywords]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q)),
    );
  },
};

export const rulesService = {
  list() {
    return listRules();
  },
};

export const tournamentService = {
  list() {
    return listTournaments();
  },
};

export const dashboardService = {
  metrics() {
    return getDashboardMetrics();
  },
};

export const deckService = {
  getStarterDeck(): DeckRecord {
    return getDeck();
  },

  persistDeck(deck: DeckRecord) {
    saveDeck(deck);
  },

  expandEntries(entries: DeckEntry[]): ExpandedDeckEntry[] {
    return entries
      .map((entry) => {
        const card = listCards().find((item) => item.id === entry.cardId);
        if (!card) return null;
        return { ...card, quantity: entry.quantity };
      })
      .filter((item): item is ExpandedDeckEntry => item !== null);
  },

  calculateStats(entries: DeckEntry[]) {
    const expanded = entries
      .map((entry) => {
        const card = listCards().find((item) => item.id === entry.cardId);
        return card ? { ...card, quantity: entry.quantity } : null;
      })
      .filter(Boolean) as (CardRecord & { quantity: number })[];

    const mainDeckCount = expanded.reduce((sum, item) => sum + item.quantity, 0);
    const lowCostCount = expanded.filter((item) => item.cost <= 2).reduce((sum, item) => sum + item.quantity, 0);
    const avgCost = mainDeckCount
      ? expanded.reduce((sum, item) => sum + item.cost * item.quantity, 0) / mainDeckCount
      : 0;

    const colorMap = expanded.reduce<Record<string, number>>((acc, item) => {
      acc[item.color] = (acc[item.color] ?? 0) + item.quantity;
      return acc;
    }, {});

    const typeMap = expanded.reduce<Record<string, number>>((acc, item) => {
      acc[item.type] = (acc[item.type] ?? 0) + item.quantity;
      return acc;
    }, {});

    return {
      mainDeckCount,
      lowCostCount,
      lowCostRate: mainDeckCount ? Math.round((lowCostCount / mainDeckCount) * 100) : 0,
      avgCost: avgCost.toFixed(2),
      colorMap,
      typeMap,
      consistencyNote:
        lowCostCount >= 12
          ? "Curva inicial saudável para abrir jogadas cedo."
          : "Baixa densidade de custo baixo; revisar pressão inicial e mulligan.",
    };
  },
};
