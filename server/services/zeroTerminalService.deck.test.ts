import { describe, expect, it } from "vitest";
import {
  combinations,
  hypergeometricPAtLeastK,
  analyzeDeckConsistency,
  consultZeroTerminalRAG,
  computeBurstThreatMatrix,
  calculateTacticalMetrics,
  extractTacticalBoardSummary,
  OFFICIAL_GLOSSARY_RULES,
} from "./zeroTerminalService";
import type { CardDef, CardInstance, GameState, PlayerId } from "../../src/modules/simulator/engine/types";

function def(partial: Partial<CardDef> & Pick<CardDef, "code" | "cardType">): CardDef {
  return {
    nameEn: partial.code,
    color: "blue",
    ...partial,
  };
}

function card(id: string, owner: PlayerId, cardDef: CardDef, extra: Partial<CardInstance> = {}): CardInstance {
  return {
    instanceId: id,
    def: cardDef,
    owner,
    zone: "battleArea",
    rested: false,
    damage: 0,
    statModifiers: [],
    keywordGrants: [],
    usedKeywordsThisTurn: [],
    enteredZoneOnTurn: 0,
    ...extra,
  };
}

function createTestState(overrides: {
  friendlyShields?: number;
  enemyShields?: number;
  friendlyUnits?: CardInstance[];
  enemyUnits?: CardInstance[];
  enemyTrash?: CardInstance[];
  enemyBattleArea?: CardInstance[];
} = {}): GameState {
  const fUnits = overrides.friendlyUnits ?? [];
  const eUnits = overrides.enemyUnits ?? overrides.enemyBattleArea ?? [];
  const eTrash = overrides.enemyTrash ?? [];

  return {
    turnNumber: 3,
    activePlayer: "A",
    firstPlayer: "A",
    phase: "main",
    step: "action",
    combat: null,
    endPhaseAction: null,
    pendingDecision: { A: null, B: null },
    gameOver: null,
    eventLog: [],
    nextInstanceSeq: 1,
    players: {
      A: {
        id: "A",
        hand: [],
        deck: [],
        battleArea: fUnits,
        shields: Array.from({ length: overrides.friendlyShields ?? 5 }, (_, i) =>
          card(`sA-${i}`, "A", def({ code: "S-A", cardType: "UNIT" })),
        ),
        resourceArea: [],
        resourceDeck: [],
        baseSection: [],
        trash: [],
        exile: [],
      },
      B: {
        id: "B",
        hand: [],
        deck: Array.from({ length: 20 }, (_, i) =>
          card(`dB-${i}`, "B", def({ code: "D-B", cardType: "UNIT" })),
        ),
        battleArea: eUnits,
        shields: Array.from({ length: overrides.enemyShields ?? 5 }, (_, i) =>
          card(`sB-${i}`, "B", def({ code: "S-B", cardType: "UNIT" })),
        ),
        resourceArea: [],
        resourceDeck: [],
        baseSection: [],
        trash: eTrash,
        exile: [],
      },
    },
  };
}

describe("zeroTerminalService — Burst Threat Matrix", () => {
  it("calcula probabilidade nula quando oponente está sem escudos", () => {
    const state = createTestState({ enemyShields: 0 });
    const matrix = computeBurstThreatMatrix(state, "B");
    expect(matrix.estimatedBurstProbability).toBe(0);
    expect(matrix.threatSeverity).toBe("LOW");
    expect(matrix.remainingShieldsCount).toBe(0);
    expect(matrix.tacticalWarning).toContain("sem escudos");
  });

  it("calcula ameaça crítica quando poucos bursts foram vistos e restam muitos escudos", () => {
    const state = createTestState({
      enemyShields: 5,
      enemyTrash: [], // nenhum burst revelado
    });
    const matrix = computeBurstThreatMatrix(state, "B");
    expect(matrix.remainingShieldsCount).toBe(5);
    expect(matrix.estimatedBurstProbability).toBeGreaterThanOrEqual(0.40);
    expect(matrix.threatSeverity).toBe("CRITICAL");
    expect(matrix.tacticalWarning).toContain("ALERTA MÁXIMO");
  });

  it("reduz o nível de ameaça quando múltiplos bursts já foram descartados", () => {
    const burstCards = Array.from({ length: 9 }, (_, i) =>
      card(`tb-${i}`, "B", def({ code: `BURST-${i}`, cardType: "COMMAND", hasBurst: true })),
    );
    const state = createTestState({
      enemyShields: 3,
      enemyTrash: burstCards,
    });
    const matrix = computeBurstThreatMatrix(state, "B");
    expect(matrix.totalKnownBurstsSeen).toBe(9);
    expect(matrix.threatSeverity).toBe("LOW");
    expect(matrix.estimatedBurstProbability).toBeLessThanOrEqual(0.15);
  });
});

describe("zeroTerminalService — Hipergeométrica e Consistência de Deck", () => {
  it("combinações matemáticas calculam corretamente nCk", () => {
    expect(combinations(5, 0)).toBe(1);
    expect(combinations(5, 1)).toBe(5);
    expect(combinations(5, 2)).toBe(10);
    expect(combinations(5, 5)).toBe(1);
    expect(combinations(5, 6)).toBe(0);
    expect(combinations(50, 5)).toBe(2118760);
  });

  it("hypergeometricPAtLeastK calcula probabilidade de compra", () => {
    // 50 cartas, 14 sucessos, mão de 5: P(X >= 1) ~ 0.822
    const p14 = hypergeometricPAtLeastK(50, 14, 5, 1);
    expect(p14).toBeCloseTo(0.822, 2);

    // 0 sucessos no deck: 0% de chance
    expect(hypergeometricPAtLeastK(50, 0, 5, 1)).toBe(0);

    // Todos os cards são sucesso: 100% de chance
    expect(hypergeometricPAtLeastK(50, 50, 5, 1)).toBe(1);
  });

  it("analisa deck equilibrado com nota S ou A", () => {
    const deck = [
      // 14 Unidades Custo 1 e 2
      { code: "GD01-001", count: 4, cardType: "UNIT", cost: 1, color: "Blue" },
      { code: "GD01-002", count: 4, cardType: "UNIT", cost: 2, color: "Blue" },
      { code: "GD01-003", count: 6, cardType: "UNIT", cost: 2, color: "Blue" },
      // 8 Pilotos
      { code: "GD01-010", count: 4, cardType: "PILOT", cost: 1, color: "Blue" },
      { code: "GD01-011", count: 4, cardType: "PILOT", cost: 2, color: "Blue" },
      // 16 Unidades Midrange (custo 3-4)
      { code: "GD01-012", count: 8, cardType: "UNIT", cost: 3, color: "Blue" },
      { code: "GD01-013", count: 8, cardType: "UNIT", cost: 4, color: "Blue" },
      // 6 Finalizadores (custo 5)
      { code: "GD01-014", count: 6, cardType: "UNIT", cost: 5, color: "Blue", hasBurst: true },
      // 2 Bases
      { code: "GD01-020", count: 2, cardType: "BASE", cost: 2, color: "Blue", hasBurst: true },
      // 4 Comandos
      { code: "GD01-030", count: 4, cardType: "COMMAND", cost: 2, color: "Blue", hasBurst: true },
    ];

    const result = analyzeDeckConsistency(deck);
    expect(result.totalCards).toBe(50);
    expect(result.grade === "S" || result.grade === "A").toBe(true);
    expect(result.consistencyScore).toBeGreaterThanOrEqual(80);
    expect(result.openingProbabilities.turn1PlayProbability).toBeGreaterThan(0.75);
    expect(result.warnings.length).toBe(0);
    expect(result.suggestedTechCards?.length).toBeGreaterThan(0);
  });

  it("identifica alertas de curva pesada e falta de unidades de early game", () => {
    const greedyDeck = [
      // Apenas 2 cartas de early game
      { code: "HEAVY-1", count: 2, cardType: "UNIT", cost: 2, color: "Red" },
      // 20 cartas de custo 5+
      { code: "HEAVY-5", count: 20, cardType: "UNIT", cost: 6, color: "Red" },
      // 18 cartas de custo 4
      { code: "HEAVY-4", count: 18, cardType: "UNIT", cost: 4, color: "Red" },
      // 10 Comandos
      { code: "CMD", count: 10, cardType: "COMMAND", cost: 3, color: "Red" },
    ];

    const result = analyzeDeckConsistency(greedyDeck);
    expect(result.totalCards).toBe(50);
    expect(result.consistencyScore).toBeLessThan(65);
    expect(result.warnings.some((w) => w.includes("Early game vulnerável"))).toBe(true);
    expect(result.warnings.some((w) => w.includes("Curva excessivamente pesada"))).toBe(true);
  });

  it("alerta quando o deck possui 3 ou mais cores", () => {
    const rainbowDeck = [
      { code: "C-BLUE", count: 18, cardType: "UNIT", cost: 2, color: "Blue" },
      { code: "C-RED", count: 16, cardType: "UNIT", cost: 2, color: "Red" },
      { code: "C-GREEN", count: 16, cardType: "UNIT", cost: 2, color: "Green" },
    ];

    const result = analyzeDeckConsistency(rainbowDeck);
    expect(result.warnings.some((w) => w.includes("Violação de regras: foram detectadas 3 cores"))).toBe(true);
  });
});

describe("zeroTerminalService — RAG Conversacional de Regras", () => {
  it("glossário oficial possui as 7 keywords de efeito e gatilhos de doc 17", () => {
    const keywords = OFFICIAL_GLOSSARY_RULES.map((r) => r.keyword);
    expect(keywords).toContain("Blocker");
    expect(keywords).toContain("Burst");
    expect(keywords).toContain("Breach");
    expect(keywords).toContain("Repair");
    expect(keywords).toContain("Support");
    expect(keywords).toContain("Link Unit");
    expect(keywords).toContain("Sideboard");
  });

  it("responde dúvidas sobre Blocker na voz de Heero em modo determinístico", async () => {
    const response = await consultZeroTerminalRAG({
      message: "Como funciona a habilidade de Blocker no ataque?",
      persona: "heero",
      forceDeterministic: true,
    });

    expect(response.provider).toBe("deterministic");
    expect(response.persona).toBe("heero");
    expect(response.personaName).toBe("Heero Yuy");
    expect(response.answer).toContain("Heero Yuy");
    expect(response.answer).toContain("Blocker");
    expect(response.matchedRules.some((r) => r.keyword === "Blocker")).toBe(true);
  });

  it("responde dúvidas sobre Burst na voz de Char em modo determinístico", async () => {
    const response = await consultZeroTerminalRAG({
      message: "O que acontece quando quebro um escudo e tem Burst?",
      persona: "char",
      forceDeterministic: true,
    });

    expect(response.provider).toBe("deterministic");
    expect(response.persona).toBe("char");
    expect(response.answer).toContain("Char Aznable");
    expect(response.answer).toContain("três vezes mais rápido");
    expect(response.matchedRules.some((r) => r.keyword === "Burst")).toBe(true);
  });

  it("responde na persona de Estrategista da OZ para dúvidas regulamentares", async () => {
    const response = await consultZeroTerminalRAG({
      message: "Quantas cartas posso trocar no Sideboard no Bo3?",
      persona: "oz_analyst",
      forceDeterministic: true,
    });

    expect(response.persona).toBe("oz_analyst");
    expect(response.personaName).toBe("Estrategista da OZ");
    expect(response.answer).toContain("Estrategista da OZ");
    expect(response.answer).toContain("Sideboard");
    expect(response.matchedRules.some((r) => r.keyword === "Sideboard")).toBe(true);
  });

  it("aceita persona 'analyst' e mapeia para Estrategista da OZ", async () => {
    const response = await consultZeroTerminalRAG({
      message: "Como funciona a habilidade Link Unit?",
      persona: "analyst",
      forceDeterministic: true,
    });

    expect(response.persona).toBe("analyst");
    expect(response.personaName).toBe("Estrategista da OZ");
    expect(response.answer).toContain("Estrategista da OZ");
    expect(response.matchedRules.some((r) => r.keyword === "Link Unit")).toBe(true);
  });
});

describe("zeroTerminalService — Sequencing Advisor e Finalização Letal", () => {
  it("adiciona conselho de finalização confirmada quando há letal na mesa", () => {
    const state = createTestState({
      friendlyUnits: [
        card("gundam-god", "A", def({ code: "GOD", cardType: "UNIT", ap: 10, hp: 5 })),
      ],
      enemyShields: 1, // total health pool inimigo = 2
    });

    const summary = extractTacticalBoardSummary(state, "A");
    const metrics = calculateTacticalMetrics(summary, "heero");
    expect(metrics.friendlyLethalReady).toBe(true);
    expect(metrics.sequencingAdvice?.some((s) => s.includes("FINALIZAÇÃO CONFIRMADA"))).toBe(true);
  });
});
