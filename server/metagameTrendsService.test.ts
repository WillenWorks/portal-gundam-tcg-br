import { describe, expect, it } from "vitest";
import { getMetagameStats } from "./metagameTrendsService.ts";

/** Carta mínima válida pro shape esperado pelo serviço. */
function card(overrides: Partial<{ id: string; cardModelId: string; nameEn: string; color: string | null; setId: string | null; cardType: string; trait: string | null; traits: string[]; series: string | null; sourceTitle: string | null }> = {}) {
  return {
    id: overrides.id ?? "print-1",
    cardModelId: overrides.cardModelId ?? overrides.id ?? "print-1",
    nameEn: overrides.nameEn ?? "Card",
    namePt: null,
    color: overrides.color ?? "Blue",
    setId: overrides.setId ?? "set-1",
    cardType: overrides.cardType ?? "UNIT",
    trait: overrides.trait ?? null,
    traits: overrides.traits ?? [],
    series: overrides.series ?? null,
    sourceTitle: overrides.sourceTitle ?? null,
  };
}

const CARD_A = card({ id: "A", nameEn: "Card A" });
const CARD_B = card({ id: "B", nameEn: "Card B", color: "Green" });
const CARD_C = card({ id: "C", nameEn: "Card C", color: "Red" });

const day = (n: number) => new Date(`2026-01-0${n}T00:00:00.000Z`);

/** 6 snapshots -- A só aparece nos 3 primeiros (declinando), C só nos 3 últimos
 *  (subindo), B aparece em 4 dos 6 com presença estável nos dois períodos. */
const TOURNAMENT_ENTRIES = [
  { deckSnapshotId: "S1", wins: 2, losses: 0, draws: 0, tournament: { dateStart: day(1) } },
  { deckSnapshotId: "S2", wins: 1, losses: 1, draws: 0, tournament: { dateStart: day(2) } },
  { deckSnapshotId: "S3", wins: 0, losses: 1, draws: 0, tournament: { dateStart: day(3) } },
  { deckSnapshotId: "S4", wins: 1, losses: 0, draws: 0, tournament: { dateStart: day(4) } },
  { deckSnapshotId: "S5", wins: 2, losses: 0, draws: 0, tournament: { dateStart: day(5) } },
  { deckSnapshotId: "S6", wins: 0, losses: 2, draws: 0, tournament: { dateStart: day(6) } },
];

const SNAPSHOT_ITEMS: Record<string, Array<{ quantity: number; card: typeof CARD_A }>> = {
  S1: [{ quantity: 1, card: CARD_A }, { quantity: 2, card: CARD_B }],
  S2: [{ quantity: 1, card: CARD_A }, { quantity: 1, card: CARD_B }],
  S3: [{ quantity: 1, card: CARD_A }],
  S4: [{ quantity: 3, card: CARD_B }, { quantity: 1, card: CARD_C }],
  S5: [{ quantity: 1, card: CARD_B }, { quantity: 1, card: CARD_C }],
  S6: [{ quantity: 1, card: CARD_C }],
};

function makeFakePrisma() {
  return {
    tournamentEntry: {
      findMany: async () => TOURNAMENT_ENTRIES,
    },
    hostedEventParticipant: {
      findMany: async () => [],
    },
    deckSnapshotItem: {
      findMany: async ({ where }: { where: { deckSnapshotId: { in: string[] } } }) => {
        const ids = where.deckSnapshotId.in;
        return ids.flatMap((id) => (SNAPSHOT_ITEMS[id] || []).map((item) => ({ deckSnapshotId: id, ...item })));
      },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe("getMetagameStats", () => {
  it("calcula presença, winrate e cópias médias por carta corretamente", async () => {
    const prisma = makeFakePrisma();
    const stats = await getMetagameStats(prisma, { seasonId: null });

    expect(stats.totalDecks).toBe(6);

    const byId = Object.fromEntries(stats.topCards.map((c) => [c.cardModelId, c]));
    // A: aparece em S1,S2,S3 -> wins 2+1+0=3, losses 0+1+1=2 -> winRate 60%
    expect(byId.A.appearances).toBe(3);
    expect(byId.A.winRate).toBe(60);
    expect(byId.A.presenceRate).toBeCloseTo(50, 1); // 3/6
    // B: aparece em S1,S2,S4,S5, cópias 2+1+3+1=7 -> avgCopies 1.75
    expect(byId.B.appearances).toBe(4);
    expect(byId.B.avgCopies).toBeCloseTo(1.75, 2);
    // C: aparece em S4,S5,S6 -> wins 1+2+0=3, losses 0+0+2=2 -> winRate 60%
    expect(byId.C.appearances).toBe(3);
    expect(byId.C.winRate).toBe(60);
  });

  it("detecta tendencia de alta (C) e de queda (A) no corte por mediana, e nao lista B (estavel)", async () => {
    const prisma = makeFakePrisma();
    const stats = await getMetagameStats(prisma, { seasonId: null });

    expect(stats.trend).not.toBeNull();
    expect(stats.trend?.priorCount).toBe(3);
    expect(stats.trend?.recentCount).toBe(3);

    const risingIds = stats.risingCards.map((c) => c.cardModelId);
    const decliningIds = stats.decliningCards.map((c) => c.cardModelId);

    expect(risingIds).toContain("C");
    expect(decliningIds).toContain("A");
    expect(risingIds).not.toContain("B");
    expect(decliningIds).not.toContain("B");

    const cTrend = stats.risingCards.find((c) => c.cardModelId === "C")!;
    expect(cTrend.priorPresenceRate).toBe(0);
    expect(cTrend.recentPresenceRate).toBe(100);
    expect(cTrend.trendDelta).toBe(100);

    const aTrend = stats.decliningCards.find((c) => c.cardModelId === "A")!;
    expect(aTrend.priorPresenceRate).toBe(100);
    expect(aTrend.recentPresenceRate).toBe(0);
    expect(aTrend.trendDelta).toBe(-100);
  });

  it("filtra por cor -- deck elegivel precisa ter ao menos 1 carta da cor pedida", async () => {
    const prisma = makeFakePrisma();
    // Só C é vermelho -- só S4/S5/S6 (onde C aparece) devem contar.
    const stats = await getMetagameStats(prisma, { seasonId: null, color: "Red" });
    expect(stats.totalDecks).toBe(3);
  });

  it("devolve estado vazio resiliente sem nenhum snapshot no recorte", async () => {
    const prisma = {
      tournamentEntry: { findMany: async () => [] },
      hostedEventParticipant: { findMany: async () => [] },
      deckSnapshotItem: { findMany: async () => [] },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    const stats = await getMetagameStats(prisma, { seasonId: null });
    expect(stats.totalDecks).toBe(0);
    expect(stats.topCards).toEqual([]);
    expect(stats.trend).toBeNull();
  });

  it("nao calcula tendencia com amostra pequena demais (menos de 4 decks datados)", async () => {
    const prisma = {
      tournamentEntry: {
        findMany: async () => TOURNAMENT_ENTRIES.slice(0, 3),
      },
      hostedEventParticipant: { findMany: async () => [] },
      deckSnapshotItem: {
        findMany: async ({ where }: { where: { deckSnapshotId: { in: string[] } } }) =>
          where.deckSnapshotId.in.flatMap((id) => (SNAPSHOT_ITEMS[id] || []).map((item) => ({ deckSnapshotId: id, ...item }))),
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    const stats = await getMetagameStats(prisma, { seasonId: null });
    expect(stats.trend).toBeNull();
    expect(stats.risingCards).toEqual([]);
    expect(stats.decliningCards).toEqual([]);
  });
});
