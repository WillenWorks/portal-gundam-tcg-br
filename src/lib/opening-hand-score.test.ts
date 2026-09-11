import { describe, expect, it, vi, afterEach } from "vitest";
import {
  earliestPlayableTurn,
  boardWeightFor,
  turnFactorFor,
  scoreOpeningHand,
  evaluateOpeningHandAgainstDeck,
  type HandScoreCard,
} from "./opening-hand-score.ts";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("earliestPlayableTurn", () => {
  it("usa o maior entre custo e nível -- reproduz o caso relatado (custo 1, nível 4)", () => {
    expect(earliestPlayableTurn({ cost: 1, level: 4 })).toBe(4);
  });

  it("usa o custo quando o nível é menor", () => {
    expect(earliestPlayableTurn({ cost: 3, level: 1 })).toBe(3);
  });

  it("trata custo/nível ausentes ou inválidos como 0", () => {
    expect(earliestPlayableTurn({})).toBe(0);
    expect(earliestPlayableTurn({ cost: null, level: undefined })).toBe(0);
    expect(earliestPlayableTurn({ cost: -1, level: -2 })).toBe(0);
  });
});

describe("boardWeightFor", () => {
  it("dá peso máximo pra Unidade e decrescente pra Base/Piloto/Comando", () => {
    expect(boardWeightFor({ type: "UNIT" })).toBe(1);
    expect(boardWeightFor({ type: "BASE" })).toBeLessThan(1);
    expect(boardWeightFor({ type: "PILOT" })).toBeLessThan(boardWeightFor({ type: "BASE" }));
    expect(boardWeightFor({ type: "COMMAND" })).toBeLessThan(boardWeightFor({ type: "PILOT" }));
  });

  it("é case-insensitive e aceita cardType como alias de type", () => {
    expect(boardWeightFor({ type: "unit" })).toBe(1);
    expect(boardWeightFor({ cardType: "UNIT" })).toBe(1);
  });

  it("usa um peso padrão baixo pra tipos desconhecidos, sem quebrar", () => {
    expect(boardWeightFor({ type: "RESOURCE" })).toBeGreaterThan(0);
    expect(boardWeightFor({})).toBeGreaterThan(0);
  });
});

describe("turnFactorFor", () => {
  it("é máximo nos turnos 0 e 1 e decresce a partir daí", () => {
    expect(turnFactorFor(0)).toBe(1);
    expect(turnFactorFor(1)).toBe(1);
    expect(turnFactorFor(2)).toBeLessThan(turnFactorFor(1));
    expect(turnFactorFor(3)).toBeLessThan(turnFactorFor(2));
  });

  it("satura pro turno mais alto da tabela em vez de zerar ou estourar", () => {
    expect(turnFactorFor(20)).toBe(turnFactorFor(6));
    expect(turnFactorFor(20)).toBeGreaterThan(0);
  });
});

describe("scoreOpeningHand", () => {
  it("dá nota 100 pra 5 Unidades de custo 1 e nível 1 (o caso ideal citado pelo usuário)", () => {
    const hand: HandScoreCard[] = Array.from({ length: 5 }, () => ({ type: "UNIT", cost: 1, level: 1 }));
    expect(scoreOpeningHand(hand).score).toBe(100);
  });

  it("penaliza uma Unidade de custo baixo mas nível alto -- reproduz o bug relatado", () => {
    const lowCostHighLevel = scoreOpeningHand([{ type: "UNIT", cost: 1, level: 6 }]).score;
    const trueLowCurve = scoreOpeningHand([{ type: "UNIT", cost: 1, level: 1 }]).score;
    expect(lowCostHighLevel).toBeLessThan(trueLowCurve);
  });

  it("dá nota bem mais baixa pra uma mão de Pilotos/Comandos de custo baixo do que uma de Unidades equivalentes", () => {
    const supportHand: HandScoreCard[] = [
      { type: "PILOT", cost: 1, level: 1 },
      { type: "PILOT", cost: 1, level: 1 },
      { type: "COMMAND", cost: 1 },
      { type: "COMMAND", cost: 1 },
      { type: "PILOT", cost: 1, level: 1 },
    ];
    const unitHand: HandScoreCard[] = Array.from({ length: 5 }, () => ({ type: "UNIT", cost: 1, level: 1 }));
    const supportScore = scoreOpeningHand(supportHand);
    const unitScore = scoreOpeningHand(unitHand);
    expect(supportScore.score).toBeLessThan(unitScore.score);
    expect(supportScore.hasEarlyUnit).toBe(false);
    expect(supportScore.supportOnlyCount).toBe(5);
  });

  it("reconhece Base como desenvolvimento de campo (early board) mesmo não sendo Unidade", () => {
    const hand: HandScoreCard[] = [{ type: "BASE", cost: 1, level: 1 }];
    const result = scoreOpeningHand(hand);
    expect(result.hasEarlyUnit).toBe(false);
    expect(result.earlyBoardCount).toBe(1);
  });

  it("devolve nota 0 e flags neutras pra mão vazia, sem quebrar", () => {
    expect(scoreOpeningHand([])).toEqual({ score: 0, hasEarlyUnit: false, earlyUnitCount: 0, earlyBoardCount: 0, supportOnlyCount: 0, perCard: [] });
  });
});

describe("evaluateOpeningHandAgainstDeck", () => {
  function repeat<T>(row: T, quantity: number) {
    return { ...row, quantity } as T & { quantity: number };
  }

  it("recomenda Mulligan quando não há Unidade nem Base jogável cedo, mesmo com custo baixo", () => {
    const deckRows = [repeat<HandScoreCard>({ type: "UNIT", cost: 2, level: 2 }, 50)];
    const hand: HandScoreCard[] = [
      { type: "PILOT", cost: 1, level: 1 },
      { type: "COMMAND", cost: 1 },
      { type: "PILOT", cost: 1, level: 1 },
      { type: "COMMAND", cost: 1 },
      { type: "COMMAND", cost: 2 },
    ];
    const verdict = evaluateOpeningHandAgainstDeck(hand, deckRows);
    expect(verdict.verdict).toBe("MULLIGAN");
  });

  it("recomenda Manter quando a mão amostrada bate exatamente com o teto do deck (Monte Carlo determinístico)", () => {
    // Todo sorteio possível devolve a mesma mão (deck homogêneo) -- a mão testada é
    // idêntica ao que qualquer simulação vai gerar, então cai no topo (percentil 100).
    const deckRows = [repeat<HandScoreCard>({ type: "UNIT", cost: 1, level: 1 }, 50)];
    const hand: HandScoreCard[] = Array.from({ length: 5 }, () => ({ type: "UNIT", cost: 1, level: 1 }));
    const verdict = evaluateOpeningHandAgainstDeck(hand, deckRows, 5, 200);
    expect(verdict.percentile).toBe(100);
    expect(verdict.verdict).toBe("MANTER");
  });

  it("cai no caminho de amostra insuficiente quando o deck tem menos cartas que o tamanho da mão", () => {
    const deckRows = [repeat<HandScoreCard>({ type: "UNIT", cost: 1, level: 1 }, 3)];
    const hand: HandScoreCard[] = [{ type: "UNIT", cost: 1, level: 1 }];
    const verdict = evaluateOpeningHandAgainstDeck(hand, deckRows, 5, 200);
    expect(verdict.sampleSize).toBe(0);
    expect(verdict.verdict).toBe("SITUACIONAL");
  });

  it("o percentil sempre fica entre 0 e 100 mesmo com deck heterogêneo real", () => {
    const deckRows: Array<HandScoreCard & { quantity: number }> = [
      repeat<HandScoreCard>({ type: "UNIT", cost: 1, level: 1 }, 4),
      repeat<HandScoreCard>({ type: "UNIT", cost: 2, level: 2 }, 4),
      repeat<HandScoreCard>({ type: "UNIT", cost: 4, level: 5 }, 4),
      repeat<HandScoreCard>({ type: "PILOT", cost: 1, level: 1 }, 4),
      repeat<HandScoreCard>({ type: "COMMAND", cost: 1 }, 4),
      repeat<HandScoreCard>({ type: "BASE", cost: 2, level: 1 }, 4),
    ];
    const hand: HandScoreCard[] = [
      { type: "UNIT", cost: 1, level: 1 },
      { type: "PILOT", cost: 1, level: 1 },
      { type: "COMMAND", cost: 1 },
      { type: "UNIT", cost: 4, level: 5 },
      { type: "BASE", cost: 2, level: 1 },
    ];
    const verdict = evaluateOpeningHandAgainstDeck(hand, deckRows, 5, 300);
    expect(verdict.percentile).toBeGreaterThanOrEqual(0);
    expect(verdict.percentile).toBeLessThanOrEqual(100);
    expect(verdict.sampleSize).toBe(300);
  });
});
