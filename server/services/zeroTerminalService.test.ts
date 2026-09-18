import { describe, expect, it, vi } from "vitest";
import type { CardDef, CardInstance, GameState, PlayerId } from "../../src/modules/simulator/engine/types";
import { createMatch } from "../../src/modules/simulator/server/matchStore";
import {
  extractTacticalBoardSummary,
  resolveEffectivePersona,
  calculateTacticalMetrics,
  analyzeTacticalState,
  getTacticalTelemetry,
} from "./zeroTerminalService";

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
  friendlyBase?: CardInstance[];
  enemyBase?: CardInstance[];
  combat?: GameState["combat"];
} = {}): GameState {
  const fUnits = overrides.friendlyUnits ?? [];
  const eUnits = overrides.enemyUnits ?? [];
  const fBase = overrides.friendlyBase ?? [];
  const eBase = overrides.enemyBase ?? [];

  return {
    turnNumber: 4,
    activePlayer: "A",
    firstPlayer: "A",
    phase: "main",
    step: "action",
    combat: overrides.combat ?? null,
    endPhaseAction: null,
    pendingDecision: { A: null, B: null },
    gameOver: null,
    eventLog: [],
    rngState: 42,
    players: {
      A: {
        id: "A",
        deck: [],
        resourceDeck: [],
        shields: Array(overrides.friendlyShields ?? 5).fill(null).map((_, i) => card(`shield_a_${i}`, "A", def({ code: "S", cardType: "COMMAND" }), { zone: "shields" })),
        resourceArea: [
          card("res1", "A", def({ code: "R1", cardType: "UNIT" }), { zone: "resourceArea" }),
          card("res2", "A", def({ code: "R2", cardType: "UNIT" }), { zone: "resourceArea" }),
        ],
        battleArea: fUnits,
        baseSection: fBase,
        trash: [],
        exile: [],
        hand: [card("h1", "A", def({ code: "H1", cardType: "UNIT" }), { zone: "hand" })],
      },
      B: {
        id: "B",
        deck: [],
        resourceDeck: [],
        shields: Array(overrides.enemyShields ?? 5).fill(null).map((_, i) => card(`shield_b_${i}`, "B", def({ code: "S", cardType: "COMMAND" }), { zone: "shields" })),
        resourceArea: [],
        battleArea: eUnits,
        baseSection: eBase,
        trash: [],
        exile: [],
        hand: [],
      },
    },
  } as unknown as GameState;
}

describe("Zero Terminal Service — Inteligência Tática e Multimodal", () => {
  describe("extractTacticalBoardSummary", () => {
    it("extrai métricas e zonas completas do jogador e oponente", () => {
      const gundam = card("rx78", "A", def({ code: "RX-78-2", cardType: "UNIT", ap: 5, hp: 5 }));
      const blocker = card("gc", "A", def({ code: "GC", cardType: "UNIT", ap: 2, hp: 4, effectKeywords: ["Blocker"] }));
      const zaku = card("zaku", "B", def({ code: "MS-06", cardType: "UNIT", ap: 4, hp: 3, effectKeywords: ["Breach"] }));

      const state = createTestState({
        friendlyUnits: [gundam, blocker],
        enemyUnits: [zaku],
        friendlyShields: 4,
        enemyShields: 3,
      });

      const summary = extractTacticalBoardSummary(state, "A");

      expect(summary.turnNumber).toBe(4);
      expect(summary.seat).toBe("A");
      expect(summary.friendly.shieldCount).toBe(4);
      expect(summary.enemy.shieldCount).toBe(3);
      expect(summary.friendly.units).toHaveLength(2);
      expect(summary.enemy.units).toHaveLength(1);
      expect(summary.friendly.totalAp).toBe(7);
      expect(summary.friendly.blockerCount).toBe(1);
      expect(summary.enemy.units[0].hasBreach).toBe(true);
    });

    it("inclui contexto detalhado de combate ativo quando em andamento", () => {
      const state = createTestState({
        friendlyUnits: [card("u1", "A", def({ code: "U1", cardType: "UNIT", ap: 3, hp: 3 }))],
        enemyUnits: [card("u2", "B", def({ code: "U2", cardType: "UNIT", ap: 4, hp: 4 }))],
        combat: {
          step: "block",
          attackerId: "u2",
          attackingPlayer: "B",
          defendingPlayer: "A",
          originalTarget: "player",
          currentTarget: "player",
          actionPasses: { A: false, B: false },
          actionPriority: "A",
        } as GameState["combat"],
      });

      const summary = extractTacticalBoardSummary(state, "A");
      expect(summary.combat).toBeDefined();
      expect(summary.combat?.attackerId).toBe("u2");
      expect(summary.combat?.target).toBe("player");
      expect(summary.combat?.step).toBe("block");
    });
  });

  describe("resolveEffectivePersona", () => {
    it("mantém a persona explícita quando configurada", () => {
      const state = createTestState();
      const summary = extractTacticalBoardSummary(state, "A");
      expect(resolveEffectivePersona(summary, "amuro")).toBe("amuro");
      expect(resolveEffectivePersona(summary, "char")).toBe("char");
      expect(resolveEffectivePersona(summary, "heero")).toBe("heero");
    });

    it("persona adaptativa comuta para Amuro quando sob perigo crítico (escudos <= 2)", () => {
      const state = createTestState({ friendlyShields: 1 });
      const summary = extractTacticalBoardSummary(state, "A");
      expect(resolveEffectivePersona(summary, "adaptive")).toBe("amuro");
    });

    it("persona adaptativa comuta para Char quando o oponente está em vulnerabilidade letal (escudos <= 2)", () => {
      const state = createTestState({ friendlyShields: 5, enemyShields: 2 });
      const summary = extractTacticalBoardSummary(state, "A");
      expect(resolveEffectivePersona(summary, "adaptive")).toBe("char");
    });

    it("persona adaptativa comuta para Heero em tabuleiro equilibrado", () => {
      const state = createTestState({ friendlyShields: 5, enemyShields: 5 });
      const summary = extractTacticalBoardSummary(state, "A");
      expect(resolveEffectivePersona(summary, "adaptive")).toBe("heero");
    });
  });

  describe("calculateTacticalMetrics & analyzeTacticalState", () => {
    it("determina threatLevel CRITICAL quando o jogador está com 0 escudos", () => {
      const state = createTestState({
        friendlyShields: 0,
        enemyUnits: [card("zaku", "B", def({ code: "MS-06", cardType: "UNIT", ap: 5, hp: 3 }))],
      });
      const summary = extractTacticalBoardSummary(state, "A");
      const metrics = calculateTacticalMetrics(summary, "amuro");
      expect(metrics.threatLevel).toBe("CRITICAL");
      expect(metrics.lethalClockTurns).toBe(1);
    });

    it("identifica ameaças com keywords de Blocker e Breach", () => {
      const state = createTestState({
        enemyUnits: [
          card("boss", "B", def({ code: "BOSS", cardType: "UNIT", ap: 6, hp: 6, effectKeywords: ["Breach"] })),
        ],
      });
      const summary = extractTacticalBoardSummary(state, "A");
      const metrics = calculateTacticalMetrics(summary, "heero");
      expect(metrics.keyThreats.some((t) => t.includes("Breach"))).toBe(true);
    });

    it("gera linhas táticas e conselho na voz de Char em modo determinístico", async () => {
      const state = createTestState({
        friendlyUnits: [card("sazabi", "A", def({ code: "MSN-04", cardType: "UNIT", ap: 7, hp: 7 }))],
        enemyShields: 1,
      });

      const analysis = await analyzeTacticalState({
        state,
        seat: "A",
        persona: "char",
        forceDeterministic: true,
      });

      expect(analysis.provider).toBe("deterministic");
      expect(analysis.resolvedPersona).toBe("char");
      expect(analysis.recommendedLines.length).toBeGreaterThan(0);
      expect(analysis.tacticalAdvice).toContain("Char Aznable");
      expect(analysis.recommendedLines[0].strategy).toBe("aggressive");
    });

    it("gera linhas táticas e conselho na voz de Amuro em modo determinístico", async () => {
      const state = createTestState({
        friendlyShields: 2,
        friendlyUnits: [card("gc", "A", def({ code: "GC", cardType: "UNIT", ap: 2, hp: 4, effectKeywords: ["Blocker"] }))],
      });

      const analysis = await analyzeTacticalState({
        state,
        seat: "A",
        persona: "amuro",
        forceDeterministic: true,
      });

      expect(analysis.provider).toBe("deterministic");
      expect(analysis.resolvedPersona).toBe("amuro");
      expect(analysis.tacticalAdvice).toContain("Amuro Ray");
    });

    it("gera linhas táticas e conselho na voz de Heero em modo determinístico", async () => {
      const state = createTestState({
        friendlyShields: 4,
        enemyShields: 4,
      });

      const analysis = await analyzeTacticalState({
        state,
        seat: "A",
        persona: "heero",
        forceDeterministic: true,
      });

      expect(analysis.provider).toBe("deterministic");
      expect(analysis.resolvedPersona).toBe("heero");
      expect(analysis.tacticalAdvice).toContain("Heero Yuy");
    });
  });

  describe("getTacticalTelemetry", () => {
    it("busca partida ativa no matchStore e gera telemetria", async () => {
      const match = createMatch({
        deckA: { main: Array(50).fill("GD01-001"), resources: Array(10).fill("ST01-015") },
        deckB: { main: Array(50).fill("GD01-001"), resources: Array(10).fill("ST01-015") },
        seed: 123,
      });

      const telemetry = await getTacticalTelemetry(match.id, "A", { forceDeterministic: true });
      expect(telemetry).toBeDefined();
      expect(telemetry.boardSummary.turnNumber).toBe(1);
      expect(telemetry.boardSummary.seat).toBe("A");
      expect(telemetry.provider).toBe("deterministic");
    });

    it("lança erro se a partida não for encontrada", async () => {
      await expect(getTacticalTelemetry("match-inexistente", "A")).rejects.toThrow(/não encontrada/);
    });
  });

  describe("Provedores de IA e Fallback Resiliente", () => {
    it("utiliza Gemini quando cliente e resposta estao disponiveis", async () => {
      const state = createTestState();
      const mockGenerate = vi.fn().mockResolvedValue({ text: "Amuro Gemini: 'Detectando avanço inimigo!'" });
      const mockGemini = {
        models: { generateContent: mockGenerate },
      };

      const analysis = await analyzeTacticalState({
        state,
        seat: "A",
        persona: "amuro",
        geminiClient: mockGemini,
      });

      expect(analysis.provider).toBe("gemini");
      expect(analysis.tacticalAdvice).toBe("Amuro Gemini: 'Detectando avanço inimigo!'");
      expect(mockGenerate).toHaveBeenCalled();
    });

    it("faz fallback para Claude quando Gemini falha", async () => {
      const state = createTestState();
      const mockGemini = {
        models: { generateContent: vi.fn().mockRejectedValue(new Error("Gemini quota exceeded")) },
      };
      const mockClaude = {
        messages: {
          create: vi.fn().mockResolvedValue({
            content: [{ type: "text", text: "Char Claude: 'Velocidade três vezes superior!'" }],
          }),
        },
      };

      const analysis = await analyzeTacticalState({
        state,
        seat: "A",
        persona: "char",
        geminiClient: mockGemini,
        claudeClient: mockClaude,
      });

      expect(analysis.provider).toBe("claude");
      expect(analysis.tacticalAdvice).toBe("Char Claude: 'Velocidade três vezes superior!'");
    });

    it("faz fallback para o motor deterministico quando ambos os servicos de IA falham", async () => {
      const state = createTestState();
      const mockGemini = {
        models: { generateContent: vi.fn().mockRejectedValue(new Error("Gemini down")) },
      };
      const mockClaude = {
        messages: {
          create: vi.fn().mockRejectedValue(new Error("Claude down")),
        },
      };

      const analysis = await analyzeTacticalState({
        state,
        seat: "A",
        persona: "heero",
        geminiClient: mockGemini,
        claudeClient: mockClaude,
      });

      expect(analysis.provider).toBe("deterministic");
      expect(analysis.tacticalAdvice).toContain("Heero Yuy");
    });
  });
});
