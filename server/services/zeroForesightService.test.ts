import { describe, expect, it } from "vitest";
import {
  applyFusionTiers,
  applyScenarioShift,
  buildForesightInsights,
  buildPairwiseWinProbability,
  runForesightMonteCarlo,
  runZeroForesightSimulation,
  seededRandom,
  type ForesightArchetypeInput,
} from "./zeroForesightService.ts";

describe("seededRandom", () => {
  it("é determinístico para a mesma seed", () => {
    const a = seededRandom(42);
    const b = seededRandom(42);
    const seqA = Array.from({ length: 5 }, () => a());
    const seqB = Array.from({ length: 5 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it("produz valores dentro de [0, 1)", () => {
    const rng = seededRandom(7);
    for (let i = 0; i < 100; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("buildPairwiseWinProbability", () => {
  const archetypes: ForesightArchetypeInput[] = [
    { archetype: "Blue Control", metaShare: 0.3, winRate: 0.6 },
    { archetype: "Red Rush", metaShare: 0.3, winRate: 0.5 },
    { archetype: "Green Midrange", metaShare: 0.4, winRate: 0.3 },
  ];

  it("mesmo arquétipo contra si mesmo é sempre 50/50", () => {
    const prob = buildPairwiseWinProbability(archetypes, []);
    expect(prob("Blue Control", "Blue Control")).toBe(0.5);
  });

  it("sem matriz real, cai no fallback Bradley-Terry (winrateA / (winrateA+winrateB))", () => {
    const prob = buildPairwiseWinProbability(archetypes, []);
    const expected = 0.6 / (0.6 + 0.3);
    expect(prob("Blue Control", "Green Midrange")).toBeCloseTo(expected, 4);
  });

  it("com amostra real grande, favorece fortemente o dado real da matriz de confrontos", () => {
    const prob = buildPairwiseWinProbability(archetypes, [
      { archetypeA: "Blue Control", archetypeB: "Green Midrange", winRate: 0.9, sampleSize: 100 },
    ]);
    expect(prob("Blue Control", "Green Midrange")).toBeGreaterThan(0.85);
  });

  it("com amostra pequena, não confia 100% no dado real (faz blend com o modelo)", () => {
    const prob = buildPairwiseWinProbability(archetypes, [
      { archetypeA: "Blue Control", archetypeB: "Green Midrange", winRate: 0.99, sampleSize: 8 },
    ]);
    const pureReal = 0.99;
    expect(prob("Blue Control", "Green Midrange")).toBeLessThan(pureReal);
  });

  it("nunca devolve probabilidade fora de [WINRATE_FLOOR, WINRATE_CEIL]", () => {
    const extreme: ForesightArchetypeInput[] = [
      { archetype: "God Tier", metaShare: 0.5, winRate: 1 },
      { archetype: "Trash Tier", metaShare: 0.5, winRate: 0 },
    ];
    const prob = buildPairwiseWinProbability(extreme, []);
    expect(prob("God Tier", "Trash Tier")).toBeLessThanOrEqual(0.95);
    expect(prob("Trash Tier", "God Tier")).toBeGreaterThanOrEqual(0.05);
  });
});

describe("applyScenarioShift", () => {
  const archetypes: ForesightArchetypeInput[] = [
    { archetype: "Red Rush", metaShare: 0.2, winRate: 0.5 },
    { archetype: "Blue Control", metaShare: 0.3, winRate: 0.55 },
    { archetype: "Green Midrange", metaShare: 0.5, winRate: 0.45 },
  ];

  it("sem deltas, devolve os arquétipos inalterados", () => {
    const result = applyScenarioShift(archetypes, {});
    expect(result).toBe(archetypes);
  });

  it("desloca o arquétipo alvo e redistribui proporcionalmente nos demais, somando 1", () => {
    const result = applyScenarioShift(archetypes, { "Red Rush": 0.1 });
    const byName = Object.fromEntries(result.map((a) => [a.archetype, a.metaShare]));

    expect(byName["Red Rush"]).toBeGreaterThan(0.2);
    // Blue Control (0.3) e Green Midrange (0.5) perdem share proporcional ao seu peso --
    // Green tinha mais peso, então perde mais em termos absolutos.
    expect(byName["Blue Control"]).toBeLessThan(0.3);
    expect(byName["Green Midrange"]).toBeLessThan(0.5);

    const total = result.reduce((sum, a) => sum + a.metaShare, 0);
    expect(total).toBeCloseTo(1, 4);
  });

  it("nunca deixa um arquétipo com presença negativa", () => {
    const result = applyScenarioShift(archetypes, { "Red Rush": 0.9 });
    result.forEach((a) => expect(a.metaShare).toBeGreaterThan(0));
  });
});

describe("runForesightMonteCarlo", () => {
  const archetypes: ForesightArchetypeInput[] = [
    { archetype: "Blue Control", metaShare: 0.34, winRate: 0.65 },
    { archetype: "Red Rush", metaShare: 0.33, winRate: 0.5 },
    { archetype: "Green Midrange", metaShare: 0.33, winRate: 0.35 },
  ];

  it("com seed fixa, produz resultado determinístico e reprodutível", async () => {
    const a = await runForesightMonteCarlo({ archetypes, iterations: 300, seed: 123 });
    const b = await runForesightMonteCarlo({ archetypes, iterations: 300, seed: 123 });
    expect(a).toEqual(b);
  });

  it("respeita o piso mínimo de iterações mesmo se pedirem menos", async () => {
    const result = await runForesightMonteCarlo({ archetypes, iterations: 1, seed: 1 });
    expect(result.iterations).toBeGreaterThanOrEqual(100);
  });

  it("todo arquétipo com presença > 0 aparece no resultado com winrate projetado válido", async () => {
    const result = await runForesightMonteCarlo({ archetypes, iterations: 2000, seed: 77 });
    expect(result.archetypes).toHaveLength(3);
    for (const r of result.archetypes) {
      expect(r.appearances).toBeGreaterThan(0);
      expect(r.projectedWinRate).not.toBeNull();
      expect(r.projectedWinRate).toBeGreaterThanOrEqual(0);
      expect(r.projectedWinRate).toBeLessThanOrEqual(1);
      expect(r.top8ConversionRate).toBeGreaterThanOrEqual(0);
      expect(r.top16ConversionRate).toBeGreaterThanOrEqual(r.top8ConversionRate);
    }
  });

  it("o arquétipo com winrate estruturalmente maior converte mais pra Top 8 no agregado", async () => {
    const result = await runForesightMonteCarlo({ archetypes, iterations: 4000, seed: 99 });
    const byName = Object.fromEntries(result.archetypes.map((r) => [r.archetype, r]));
    expect(byName["Blue Control"].top8ConversionRate).toBeGreaterThan(byName["Green Midrange"].top8ConversionRate);
  });

  it("sem arquétipos com presença, devolve resultado vazio sem rodar simulação", async () => {
    const result = await runForesightMonteCarlo({ archetypes: [], iterations: 500 });
    expect(result.iterations).toBe(0);
    expect(result.archetypes).toEqual([]);
  });
});

describe("applyFusionTiers", () => {
  it("funde score simulado com o powerRankingScore real e ordena por fusionScore desc", () => {
    const simulated = [
      { archetype: "A", metaShare: 0.5, appearances: 100, projectedWinRate: 0.4, top8ConversionRate: 0.1, top16ConversionRate: 0.2, fusionScore: null, tier: null },
      { archetype: "B", metaShare: 0.5, appearances: 100, projectedWinRate: 0.7, top8ConversionRate: 0.3, top16ConversionRate: 0.5, fusionScore: null, tier: null },
    ];
    const realScores = new Map([["A", 9], ["B", 2]]);
    const fused = applyFusionTiers(simulated, realScores);

    expect(fused[0].archetype).toBe("A"); // dado real puxa A pra cima mesmo com sim. pior
    expect(fused[0].tier).not.toBeNull();
    expect(fused.every((f) => f.fusionScore !== null)).toBe(true);
  });

  it("sem dado real, usa só o score simulado (não quebra)", () => {
    const simulated = [
      { archetype: "A", metaShare: 1, appearances: 100, projectedWinRate: 0.6, top8ConversionRate: 0.2, top16ConversionRate: 0.3, fusionScore: null, tier: null },
    ];
    const fused = applyFusionTiers(simulated, new Map());
    expect(fused[0].fusionScore).not.toBeNull();
    expect(fused[0].tier).not.toBeNull();
  });
});

describe("buildForesightInsights", () => {
  it("descreve o driver de presença e os movers de winrate no formato esperado", () => {
    const baseline = [
      { archetype: "Red Rush", metaShare: 0.2, appearances: 100, projectedWinRate: 0.5, top8ConversionRate: 0.2, top16ConversionRate: 0.3, fusionScore: 5, tier: "Tier 2" },
      { archetype: "Blue Control", metaShare: 0.3, appearances: 100, projectedWinRate: 0.5, top8ConversionRate: 0.2, top16ConversionRate: 0.3, fusionScore: 5, tier: "Tier 2" },
      { archetype: "Green Midrange", metaShare: 0.5, appearances: 100, projectedWinRate: 0.5, top8ConversionRate: 0.2, top16ConversionRate: 0.3, fusionScore: 5, tier: "Tier 2" },
    ];
    const scenario = [
      { archetype: "Red Rush", metaShare: 0.3, appearances: 100, projectedWinRate: 0.5, top8ConversionRate: 0.2, top16ConversionRate: 0.3, fusionScore: 5, tier: "Tier 2" },
      { archetype: "Blue Control", metaShare: 0.28, appearances: 100, projectedWinRate: 0.574, top8ConversionRate: 0.3, top16ConversionRate: 0.4, fusionScore: 8, tier: "Tier 1" },
      { archetype: "Green Midrange", metaShare: 0.42, appearances: 100, projectedWinRate: 0.458, top8ConversionRate: 0.1, top16ConversionRate: 0.2, fusionScore: 3, tier: "Tier 2" },
    ];

    const insights = buildForesightInsights(baseline, scenario);
    const presenceInsight = insights.find((i) => i.type === "presence_impact");
    expect(presenceInsight?.message).toContain("Red Rush");
    expect(presenceInsight?.message).toContain("Blue Control");
    expect(presenceInsight?.message).toContain("Green Midrange");
    expect(presenceInsight?.message).toMatch(/ganha \d+\.\d% de winrate/);
    expect(presenceInsight?.message).toMatch(/cai \d+\.\d% de winrate/);

    const tierInsight = insights.find((i) => i.type === "tier_shift");
    expect(tierInsight?.message).toBe("Blue Control muda de Tier 2 para Tier 1 sob esse cenário.");
  });

  it("sem deslocamento significativo de presença, não gera insight de impacto", () => {
    const baseline = [
      { archetype: "A", metaShare: 0.5, appearances: 100, projectedWinRate: 0.5, top8ConversionRate: 0.2, top16ConversionRate: 0.3, fusionScore: 5, tier: "Tier 2" },
    ];
    const scenario = [
      { archetype: "A", metaShare: 0.5001, appearances: 100, projectedWinRate: 0.5, top8ConversionRate: 0.2, top16ConversionRate: 0.3, fusionScore: 5, tier: "Tier 2" },
    ];
    expect(buildForesightInsights(baseline, scenario)).toEqual([]);
  });
});

describe("runZeroForesightSimulation (orquestrador)", () => {
  function makeFakePrisma(rankings: unknown[], matchup: unknown) {
    return {
      tournamentEntry: { findMany: async () => rankings },
      hostedEventMatch: { findMany: async () => matchup },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
  }

  const RANKING_ROWS = [
    {
      archetype: "Blue Control",
      placement: 1,
      wins: 6,
      losses: 1,
      draws: 0,
      tournament: { id: "t1", name: "Torneio 1" },
      deckSnapshot: { items: [{ quantity: 1, card: { id: "c1", code: "GD01-001", nameEn: "Card 1", namePt: null, color: "Blue", cardType: "UNIT", rarity: "R", cost: 3, setId: "set-1", imageUrl: null, imageMediumUrl: null } }] },
    },
    {
      archetype: "Red Rush",
      placement: 2,
      wins: 4,
      losses: 3,
      draws: 0,
      tournament: { id: "t1", name: "Torneio 1" },
      deckSnapshot: { items: [{ quantity: 1, card: { id: "c2", code: "GD01-002", nameEn: "Card 2", namePt: null, color: "Red", cardType: "UNIT", rarity: "R", cost: 2, setId: "set-1", imageUrl: null, imageMediumUrl: null } }] },
    },
  ];

  it("devolve relatório vazio quando não há arquétipos com dados suficientes", async () => {
    const prisma = makeFakePrisma([], []);
    const report = await runZeroForesightSimulation(prisma, { seasonId: null, iterations: 200 });
    expect(report.baseline).toEqual([]);
    expect(report.sampleSize).toBe(0);
  });

  it("roda baseline e cenário, produzindo insights quando presenceDeltas é passado", async () => {
    const prisma = makeFakePrisma(RANKING_ROWS, []);
    const report = await runZeroForesightSimulation(prisma, {
      seasonId: null,
      iterations: 500,
      scenario: { presenceDeltas: { "Red Rush": 0.15 } },
    });

    expect(report.baseline.length).toBe(2);
    expect(report.scenario).not.toBeNull();
    expect(report.scenario?.length).toBe(2);
    expect(report.baseline.every((a) => a.tier)).toBe(true);
  });

  it("sem cenário, não roda a segunda simulação (scenario permanece null)", async () => {
    const prisma = makeFakePrisma(RANKING_ROWS, []);
    const report = await runZeroForesightSimulation(prisma, { seasonId: null, iterations: 300 });
    expect(report.scenario).toBeNull();
    expect(report.insights).toEqual([]);
  });
});
