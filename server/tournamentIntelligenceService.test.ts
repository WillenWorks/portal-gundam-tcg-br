import { describe, expect, it } from "vitest";
import { getPowerRankings, getPowerRankingsWithProvenance, getWeeklyTrends } from "./tournamentIntelligenceService.ts";

const day = (n: number) => new Date(`2026-02-0${n}T12:00:00.000Z`);

function makeFakeCard(id: string, code: string, cardType = "UNIT", rarity = "R", cost = 4) {
  return {
    id,
    code,
    nameEn: `Card ${code}`,
    namePt: `Carta ${code}`,
    color: "Blue",
    cardType,
    rarity,
    cost,
    setId: "GD01",
    imageUrl: null,
    imageMediumUrl: null,
  };
}

const CARD_1 = makeFakeCard("c1", "GD01-001", "UNIT", "LR", 5);
const CARD_2 = makeFakeCard("c2", "GD01-002", "UNIT", "R", 3);

const FAKE_ENTRIES = [
  {
    archetype: "Wing Zero",
    placement: 1,
    wins: 5,
    losses: 0,
    draws: 0,
    tournament: {
      id: "tourney-1",
      name: "Grand Prix São Paulo",
      dateStart: day(2),
      organizer: "Bandai Brasil",
      participantCount: 64,
      tier: "LARGE_OFFICIAL",
      sourceUrl: "https://gundam-gcg.com/events/gp-sp",
    },
    deckSnapshot: {
      items: [
        { quantity: 4, card: CARD_1 },
        { quantity: 4, card: CARD_2 },
      ],
    },
  },
  {
    archetype: "Wing Zero",
    placement: 3,
    wins: 4,
    losses: 1,
    draws: 0,
    tournament: {
      id: "tourney-2",
      name: "Store Tournament Campinas",
      dateStart: day(5),
      organizer: "Loja Asticassia",
      participantCount: 16,
      tier: "SMALL_OFFICIAL",
      sourceUrl: null,
    },
    deckSnapshot: {
      items: [
        { quantity: 4, card: CARD_1 },
      ],
    },
  },
  {
    archetype: "Zeon Aggro",
    placement: 2,
    wins: 4,
    losses: 1,
    draws: 0,
    tournament: {
      id: "tourney-1",
      name: "Grand Prix São Paulo",
      dateStart: day(2),
      organizer: "Bandai Brasil",
      participantCount: 64,
      tier: "LARGE_OFFICIAL",
      sourceUrl: "https://gundam-gcg.com/events/gp-sp",
    },
    deckSnapshot: {
      items: [
        { quantity: 4, card: CARD_2 },
      ],
    },
  },
];

describe("tournamentIntelligenceService - Power Rankings & Provenance", () => {
  it("calcula rankings e proveniência global dos torneios", async () => {
    const fakePrisma = {
      tournamentEntry: {
        findMany: async () => FAKE_ENTRIES,
      },
    } as any;

    const result = await getPowerRankingsWithProvenance(fakePrisma, {});
    expect(result.rankings).toHaveLength(2);

    const wing = result.rankings.find((r) => r.archetype === "Wing Zero");
    expect(wing).toBeDefined();
    expect(wing?.deckCount).toBe(2);
    expect(wing?.bestPlacement).toBe(1);
    expect(wing?.tournamentPlacements).toHaveLength(2);
    expect(wing?.tournamentPlacements[0].placement).toBe(1);
    expect(wing?.tournamentPlacements[0].tournamentName).toBe("Grand Prix São Paulo");
    expect(wing?.tournamentPlacements[0].sourceUrl).toBe("https://gundam-gcg.com/events/gp-sp");
    expect(wing?.tournamentPlacements[0].organizer).toBe("Bandai Brasil");

    expect(result.provenance.totalDecks).toBe(3);
    expect(result.provenance.totalTournaments).toBe(2);
    expect(result.provenance.startDate).toBe(day(2).toISOString());
    expect(result.provenance.endDate).toBe(day(5).toISOString());
    expect(result.provenance.tournaments).toHaveLength(2);
  });

  it("mantém retrocompatibilidade em getPowerRankings retornando array simples", async () => {
    const fakePrisma = {
      tournamentEntry: {
        findMany: async () => FAKE_ENTRIES,
      },
    } as any;

    const rankings = await getPowerRankings(fakePrisma, {});
    expect(Array.isArray(rankings)).toBe(true);
    expect(rankings).toHaveLength(2);
  });

  it("lida com lista vazia de entradas sem quebrar", async () => {
    const fakePrisma = {
      tournamentEntry: {
        findMany: async () => [],
      },
    } as any;

    const result = await getPowerRankingsWithProvenance(fakePrisma, {});
    expect(result.rankings).toEqual([]);
    expect(result.provenance.totalDecks).toBe(0);
    expect(result.provenance.totalTournaments).toBe(0);
    expect(result.provenance.tournaments).toEqual([]);
  });

  it("calcula série temporal semanal e sinalização de amostra pequena com getWeeklyTrends", async () => {
    const fakePrisma = {
      tournamentEntry: {
        findMany: async () => FAKE_ENTRIES,
      },
    } as any;

    const result = await getWeeklyTrends(fakePrisma, {});
    expect(result.weeks.length).toBeGreaterThan(0);
    expect(result.topArchetypes).toContain("Wing Zero");
    expect(result.provenance.totalDecks).toBe(3);
    expect(result.provenance.totalTournaments).toBe(2);

    const week1 = result.weeks[0];
    expect(week1).toBeDefined();
    expect(week1.totalLists).toBe(3);
    // 3 listas < 6 => isSmallSample true
    expect(week1.isSmallSample).toBe(true);
    expect(week1.sampleWarning).toContain("Amostra semanal reduzida");

    const wing = week1.archetypes.find((a) => a.name === "Wing Zero");
    expect(wing).toBeDefined();
    expect(wing?.lists).toBe(2);
    expect(wing?.share).toBeCloseTo(2 / 3, 2);
    expect(wing?.winRate).toBeGreaterThan(0);

    const zeon = week1.archetypes.find((a) => a.name === "Zeon Aggro");
    expect(zeon).toBeDefined();
    expect(zeon?.lists).toBe(1);
    expect(zeon?.share).toBeCloseTo(1 / 3, 2);
    // 1 lista < 3 => isSmallSample true
    expect(zeon?.isSmallSample).toBe(true);
  });
});
