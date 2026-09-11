/** Nota de Abertura (Opening Hand Score) — Portal Gundam TCG Brasil
 *
 * Corrige um erro relatado pelo usuário: o simulador de mão inicial antigo só olhava
 * o CUSTO da carta pra decidir "jogável no T1", ignorando o NÍVEL — uma carta pode
 * ter custo 1 e ainda ser impossível de jogar cedo porque o nível exige recursos em
 * campo que só se acumulam ao longo dos turnos. Também ignorava o TIPO da carta: uma
 * mão cheia de Pilotos/Comandos de custo baixo não é uma "boa abertura" de verdade,
 * porque o jogo depende de Unidades em campo pra atacar/bloquear.
 *
 * Regra oficial replicada do motor de simulação (ver
 * src/modules/simulator/engine/deploy.ts): uma carta só pode ser jogada quando
 * `resourceArea.length >= nível`. A área de recursos cresce ~1 por turno (mesmo
 * ritmo que financia o custo), então o turno mínimo real de qualquer carta é:
 *
 *     turnoMinimo = max(custo, nível)
 *
 * Isso é o que faltava: uma Unidade de custo 1 e nível 4 só entra em campo no
 * turno 4, não no turno 1.
 *
 * A partir daí, cada carta recebe um peso de "desenvolvimento de campo" pelo tipo
 * (Unidade > Base > Piloto > Comando) e um fator de urgência pelo turno mínimo
 * (quanto mais cedo jogável, maior o fator). A nota da mão (0-100) é a média
 * ponderada das 5 cartas. Por fim, comparamos essa nota contra uma simulação de
 * Monte Carlo de milhares de mãos possíveis do MESMO deck pra saber se a mão em
 * questão está estatisticamente acima ou abaixo do que o deck costuma abrir —
 * essa comparação relativa é o que de fato informa a decisão de Mulligan (uma
 * "nota 40" pode ser ótima num deck lento e ruim num deck agressivo).
 */

import { buildDeckPopulation, shuffleDraw } from "./deck-sampling.ts";

export type HandScoreCard = {
  type?: string | null;
  cardType?: string | null;
  cost?: number | null;
  level?: number | null;
};

/** Turno mínimo em que a carta pode entrar em campo, assumindo desenvolvimento
 *  normal de recursos (~1 por turno). Custo e nível negativos/inválidos contam 0. */
export function earliestPlayableTurn(card: HandScoreCard): number {
  const cost = typeof card.cost === "number" && card.cost > 0 ? card.cost : 0;
  const level = typeof card.level === "number" && card.level > 0 ? card.level : 0;
  return Math.max(cost, level);
}

/** Peso de desenvolvimento de campo por tipo. Unidade ataca/bloqueia e decide o
 *  jogo; Base ocupa espaço e pode defender/gerar valor mas não ataca; Piloto
 *  sozinho só multiplica uma Unidade que já precisa estar em campo (baixo valor
 *  isolado); Comando é efeito pontual que não fica no campo. */
export const CARD_TYPE_BOARD_WEIGHT: Record<string, number> = {
  UNIT: 1,
  BASE: 0.6,
  PILOT: 0.3,
  COMMAND_PILOT: 0.3,
  COMMAND: 0.2,
};
const DEFAULT_BOARD_WEIGHT = 0.15;

export function boardWeightFor(card: HandScoreCard): number {
  const type = (card.type || card.cardType || "").toUpperCase();
  return CARD_TYPE_BOARD_WEIGHT[type] ?? DEFAULT_BOARD_WEIGHT;
}

const BOARD_CARD_TYPES = new Set(["UNIT", "BASE"]);
const SUPPORT_ONLY_TYPES = new Set(["PILOT", "COMMAND", "COMMAND_PILOT"]);

function normalizedType(card: HandScoreCard): string {
  return (card.type || card.cardType || "").toUpperCase();
}

/** Unidade ou Base -- os únicos tipos que de fato ocupam o campo de batalha (atacam
 *  ou bloqueiam). Usado em qualquer estatística de "abertura jogável" pra não contar
 *  Piloto/Comando de custo baixo como se fossem uma jogada de desenvolvimento de
 *  campo (ver opening-hand-score.ts, motivo do erro relatado pelo usuário). */
export function isBoardDevelopmentCard(card: HandScoreCard): boolean {
  return BOARD_CARD_TYPES.has(normalizedType(card));
}

export function isUnitCard(card: HandScoreCard): boolean {
  return normalizedType(card) === "UNIT";
}

/** Turno-limite considerado "abertura cedo" nas estatísticas agregadas do deck
 *  inteiro (lowCostStats/lowLevelUnitStats) -- mesmo corte usado em scoreOpeningHand. */
export const EARLY_TURN_THRESHOLD = 2;

/** Fator de urgência pelo turno mínimo — decai suavemente até o turno 6+, onde o
 *  impacto na qualidade DESSA mão inicial específica já é marginal (a carta não é
 *  ruim no deck, só não ajuda a avaliar a abertura). */
const TURN_FACTORS = [1, 1, 0.75, 0.55, 0.4, 0.28, 0.18];
export function turnFactorFor(turn: number): number {
  const idx = Math.min(Math.max(Math.round(turn), 0), TURN_FACTORS.length - 1);
  return TURN_FACTORS[idx];
}

export function cardPlayScore(card: HandScoreCard): number {
  return boardWeightFor(card) * turnFactorFor(earliestPlayableTurn(card));
}

export interface HandScoreBreakdown {
  score: number; // 0..100
  hasEarlyUnit: boolean;
  earlyUnitCount: number;
  earlyBoardCount: number; // Unidade OU Base jogável até EARLY_TURN_THRESHOLD
  supportOnlyCount: number; // Piloto/Comando na mão (não desenvolvem campo sozinhos)
  perCard: Array<{ card: HandScoreCard; earliestTurn: number; boardWeight: number; contribution: number }>;
}

export function scoreOpeningHand(hand: HandScoreCard[]): HandScoreBreakdown {
  if (!hand.length) {
    return { score: 0, hasEarlyUnit: false, earlyUnitCount: 0, earlyBoardCount: 0, supportOnlyCount: 0, perCard: [] };
  }

  const perCard = hand.map((card) => {
    const earliestTurn = earliestPlayableTurn(card);
    const boardWeight = boardWeightFor(card);
    return { card, earliestTurn, boardWeight, contribution: boardWeight * turnFactorFor(earliestTurn) };
  });

  const earlyUnitCount = perCard.filter((p) => normalizedType(p.card) === "UNIT" && p.earliestTurn <= EARLY_TURN_THRESHOLD).length;
  const earlyBoardCount = perCard.filter((p) => BOARD_CARD_TYPES.has(normalizedType(p.card)) && p.earliestTurn <= EARLY_TURN_THRESHOLD).length;
  const supportOnlyCount = perCard.filter((p) => SUPPORT_ONLY_TYPES.has(normalizedType(p.card))).length;

  const rawSum = perCard.reduce((sum, p) => sum + p.contribution, 0);
  const score = Math.round((rawSum / hand.length) * 100);

  return { score, hasEarlyUnit: earlyUnitCount > 0, earlyUnitCount, earlyBoardCount, supportOnlyCount, perCard };
}

export type HandVerdict = "MULLIGAN" | "SITUACIONAL" | "MANTER";

export interface OpeningHandVerdict {
  handScore: number;
  deckMeanScore: number;
  deckStdDev: number;
  percentile: number; // % das mãos simuladas do MESMO deck com nota <= a desta
  sampleSize: number;
  verdict: HandVerdict;
  verdictLabel: string;
}

const SIMULATION_SAMPLES = 1500;
const MULLIGAN_PERCENTILE = 30;
const KEEP_PERCENTILE = 65;

/** Compara a nota da mão dada contra uma simulação de Monte Carlo de milhares de
 *  mãos possíveis do MESMO deck (amostra sem reposição, mesmo motor de sorteio do
 *  simulador de mão inicial) — decide se a mão está estatisticamente ruim, mediana
 *  ou boa pra ESSE deck específico, não contra um padrão genérico. */
export function evaluateOpeningHandAgainstDeck<T extends HandScoreCard & { quantity: number }>(
  hand: HandScoreCard[],
  deckRows: T[],
  handSize = 5,
  samples = SIMULATION_SAMPLES,
): OpeningHandVerdict {
  const handBreakdown = scoreOpeningHand(hand);
  const population = buildDeckPopulation(deckRows);

  if (population.length < handSize) {
    return {
      handScore: handBreakdown.score,
      deckMeanScore: handBreakdown.score,
      deckStdDev: 0,
      percentile: 50,
      sampleSize: 0,
      verdict: "SITUACIONAL",
      verdictLabel: "Deck pequeno demais pra comparação estatística ainda.",
    };
  }

  const simulatedScores: number[] = [];
  for (let i = 0; i < samples; i++) {
    simulatedScores.push(scoreOpeningHand(shuffleDraw(population, handSize)).score);
  }
  const meanScore = simulatedScores.reduce((s, v) => s + v, 0) / simulatedScores.length;
  const variance = simulatedScores.reduce((s, v) => s + (v - meanScore) ** 2, 0) / simulatedScores.length;
  const stdDev = Math.sqrt(variance);
  const belowOrEqual = simulatedScores.filter((v) => v <= handBreakdown.score).length;
  const percentile = Math.round((belowOrEqual / simulatedScores.length) * 100);

  let verdict: HandVerdict = "SITUACIONAL";
  let verdictLabel = "Mão mediana pro seu deck — decisão situacional conforme o matchup.";
  if (handBreakdown.earlyBoardCount === 0) {
    verdict = "MULLIGAN";
    verdictLabel = "Sem Unidade ou Base jogável nos 2 primeiros turnos — recomenda-se Mulligan.";
  } else if (percentile < MULLIGAN_PERCENTILE) {
    verdict = "MULLIGAN";
    verdictLabel = `Mão abaixo da média do seu deck (percentil ${percentile}) — considere o Mulligan.`;
  } else if (percentile >= KEEP_PERCENTILE) {
    verdict = "MANTER";
    verdictLabel = `Mão acima da média do seu deck (percentil ${percentile}) — boa abertura, mantenha.`;
  }

  return {
    handScore: handBreakdown.score,
    deckMeanScore: Math.round(meanScore),
    deckStdDev: Math.round(stdDev),
    percentile,
    sampleSize: samples,
    verdict,
    verdictLabel,
  };
}
