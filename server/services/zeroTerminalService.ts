import { GoogleGenAI } from "@google/genai";
import Anthropic from "@anthropic-ai/sdk";
import type { CardInstance, GameState, PlayerId } from "../../src/modules/simulator/engine/types";
import { effectiveAp, effectiveHp, hasKeyword, otherPlayer } from "../../src/modules/simulator/engine/types";
import { getMatch } from "../../src/modules/simulator/server/matchStore";
import { getCardDefByCode } from "../../src/modules/simulator/content/allCardDefs";

export type PilotPersonaId = "amuro" | "char" | "heero" | "analyst" | "adaptive";
export type ZeroPersonaId = "amuro" | "char" | "heero" | "oz_analyst" | "analyst" | "adaptive";

export interface BurstThreatMatrix {
  estimatedBurstProbability: number; // 0.00 a 1.00
  threatSeverity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  knownBurstsInGraveyard: number;
  knownBurstsInBattleArea: number;
  knownBurstsInBase: number;
  totalKnownBurstsSeen: number;
  remainingShieldsCount: number;
  estimatedRemainingBurstsInDeckAndShields: number;
  tacticalWarning: string;
}

export interface DeckCardInput {
  code: string;
  count?: number;
  quantity?: number;
  name?: string;
  nameEn?: string;
  color?: string;
  cardType?: string;
  level?: number;
  cost?: number;
  hasBurst?: boolean;
  traits?: string[];
  card?: any;
}

export interface DeckConsistencyAnalysis {
  totalCards: number;
  consistencyScore: number; // 0..100
  grade: "S" | "A" | "B" | "C" | "D";
  openingProbabilities: {
    turn1PlayProbability: number;
    turn2PlayProbability: number;
    turn3PlayProbability: number;
    pilotInOpeningHandProbability: number;
    turn3IdealPairProbability: number;
  };
  curveBreakdown: {
    cost1Count: number;
    cost2Count: number;
    cost3to4Count: number;
    cost5PlusCount: number;
    averageCost: number;
  };
  cardTypeBreakdown: {
    unitsCount: number;
    pilotsCount: number;
    commandsCount: number;
    basesCount: number;
    burstCount: number;
    lowCostUnitsCount: number;
  };
  colorDistribution: Record<string, number>;
  warnings: string[];
  recommendations: string[];
  suggestedTechCards?: Array<{ code: string; name: string; reason: string }>;
}

export interface ZeroRAGQueryOptions {
  message: string;
  persona?: ZeroPersonaId;
  matchId?: string;
  state?: GameState;
  forceDeterministic?: boolean;
  apiKeyGemini?: string;
  apiKeyClaude?: string;
}

export interface ZeroRAGResponse {
  provider: "gemini" | "claude" | "deterministic";
  persona: ZeroPersonaId;
  personaName: string;
  answer: string;
  matchedRules: Array<{ keyword: string; explanation: string }>;
  confidence: number;
  timestamp: string;
}

export interface TacticalUnitSummary {
  instanceId: string;
  name: string;
  cardCode: string;
  ap: number;
  hp: number;
  remainingHp: number;
  rested: boolean;
  hasBlocker: boolean;
  hasBreach: boolean;
  hasLink: boolean;
  level: number;
  cost: number;
}

export interface TacticalPlayerSummary {
  playerId: PlayerId;
  active: boolean;
  shieldCount: number;
  baseHp: number;
  baseRemainingHp: number;
  hasBase: boolean;
  energyAvailable: number;
  energyTotal: number;
  handCount: number;
  deckCount: number;
  units: TacticalUnitSummary[];
  totalAp: number;
  totalHp: number;
  readyAp: number;
  blockerCount: number;
}

export interface TacticalBoardSummary {
  turnNumber: number;
  activePlayer: PlayerId;
  seat: PlayerId;
  friendly: TacticalPlayerSummary;
  enemy: TacticalPlayerSummary;
  combat?: {
    step: string;
    attackerId: string;
    attackerName: string;
    attackerAp: number;
    target: "player" | string;
    blockerId?: string;
  };
}

export interface TacticalLine {
  priority: number; // 1 (baixa) a 5 (urgente/ótima)
  strategy: "aggressive" | "control" | "tempo" | "defensive";
  actionRecommendation: string;
  targetInstanceId?: string;
  rationale: string;
  winProbabilityDelta: number; // e.g. +0.12
}

export interface ZeroSystemAnalysis {
  provider: "gemini" | "claude" | "deterministic";
  persona: PilotPersonaId;
  resolvedPersona: "amuro" | "char" | "heero" | "analyst";
  timestamp: string;
  threatLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  lethalClockTurns: number;
  winProbabilityEstimate: number; // 0.00 a 1.00
  keyThreats: string[];
  recommendedLines: TacticalLine[];
  tacticalAdvice: string;
  boardSummary: TacticalBoardSummary;
  burstMatrix?: BurstThreatMatrix;
  friendlyLethalReady?: boolean;
  enemyLethalImminent?: boolean;
  sequencingAdvice?: string[];
}

export interface ZeroSystemAnalysisOptions {
  state: GameState;
  seat: PlayerId;
  persona?: PilotPersonaId;
  forceDeterministic?: boolean;
  apiKeyGemini?: string;
  apiKeyClaude?: string;
  geminiClient?: { models: { generateContent: (args: any) => Promise<any> } };
  claudeClient?: { messages: { create: (args: any) => Promise<any> } };
}

function remHp(card: CardInstance, state: GameState): number {
  return Math.max(0, effectiveHp(card, state) - card.damage);
}

function summarizeUnits(units: CardInstance[], state: GameState): TacticalUnitSummary[] {
  return units.map((u) => ({
    instanceId: u.instanceId,
    name: u.def.nameEn || u.def.code,
    cardCode: u.def.code,
    ap: effectiveAp(u, state),
    hp: effectiveHp(u, state),
    remainingHp: remHp(u, state),
    rested: u.rested,
    hasBlocker: hasKeyword(u, "Blocker", state),
    hasBreach: hasKeyword(u, "Breach", state),
    hasLink: Boolean(u.pairedPilotId),
    level: u.def.level ?? 1,
    cost: u.def.cost ?? 1,
  }));
}

function summarizePlayer(playerId: PlayerId, state: GameState): TacticalPlayerSummary {
  const p = state.players[playerId];
  const units = p.battleArea.filter((c) => c.def.cardType === "UNIT");
  const base = p.baseSection[0] ?? null;

  const summarizedUnits = summarizeUnits(units, state);
  const totalAp = summarizedUnits.reduce((sum, u) => sum + u.ap, 0);
  const totalHp = summarizedUnits.reduce((sum, u) => sum + u.remainingHp, 0);
  const readyAp = summarizedUnits.filter((u) => !u.rested).reduce((sum, u) => sum + u.ap, 0);
  const blockerCount = summarizedUnits.filter((u) => u.hasBlocker).length;

  const baseHp = base ? effectiveHp(base, state) : 0;
  const baseRemainingHp = base ? remHp(base, state) : 0;

  const energyAvailable = p.resourceArea.filter((r) => !r.rested).length;
  const energyTotal = p.resourceArea.length;

  return {
    playerId,
    active: state.activePlayer === playerId,
    shieldCount: p.shields.length,
    baseHp,
    baseRemainingHp,
    hasBase: Boolean(base),
    energyAvailable,
    energyTotal,
    handCount: p.hand.length,
    deckCount: p.deck.length,
    units: summarizedUnits,
    totalAp,
    totalHp,
    readyAp,
    blockerCount,
  };
}

export function extractTacticalBoardSummary(state: GameState, seat: PlayerId): TacticalBoardSummary {
  const opp = otherPlayer(seat);
  const friendly = summarizePlayer(seat, state);
  const enemy = summarizePlayer(opp, state);

  let combatSummary: TacticalBoardSummary["combat"];
  if (state.combat) {
    const atkCard = [...state.players.A.battleArea, ...state.players.B.battleArea].find(
      (c) => c.instanceId === state.combat!.attackerId,
    );
    const targetStr =
      state.combat.currentTarget === "player"
        ? "player"
        : state.combat.currentTarget.unitId;

    combatSummary = {
      step: state.combat.step,
      attackerId: state.combat.attackerId,
      attackerName: atkCard ? (atkCard.def.nameEn || atkCard.def.code) : "Unknown",
      attackerAp: atkCard ? effectiveAp(atkCard, state) : 0,
      target: targetStr,
      blockerId: state.combat.blockerUsedBy ?? undefined,
    };
  }

  return {
    turnNumber: state.turnNumber,
    activePlayer: state.activePlayer,
    seat,
    friendly,
    enemy,
    combat: combatSummary,
  };
}

export function resolveEffectivePersona(
  board: TacticalBoardSummary,
  persona: PilotPersonaId = "adaptive",
): "amuro" | "char" | "heero" | "analyst" {
  if (persona !== "adaptive") return persona;

  const f = board.friendly;
  const e = board.enemy;

  // Se escudos baixos ou ameaça iminente de dano alto -> Amuro (Defesa/Preservação)
  if (f.shieldCount <= 2 || e.readyAp >= f.baseRemainingHp + f.shieldCount * 2) {
    return "amuro";
  }

  // Se o oponente está vulnerável a letal ou escudos baixos -> Char (Agressão Rápida)
  if (e.shieldCount <= 2 || f.readyAp >= e.baseRemainingHp + e.shieldCount * 2) {
    return "char";
  }

  // Estado neutro ou equilibrado -> Heero (Cálculo Frio de Alvos e Trocas Ótimas)
  return "heero";
}

export function computeBurstThreatMatrix(
  stateOrBoard: GameState | TacticalBoardSummary,
  defendingSeat?: PlayerId,
): BurstThreatMatrix {
  // Caso 1: Chamado com GameState completo
  if ("players" in stateOrBoard && defendingSeat) {
    const opp = stateOrBoard.players[defendingSeat];
    const remainingShieldsCount = opp.shields.length;
    if (remainingShieldsCount === 0) {
      return {
        estimatedBurstProbability: 0,
        threatSeverity: "LOW",
        knownBurstsInGraveyard: 0,
        knownBurstsInBattleArea: 0,
        knownBurstsInBase: 0,
        totalKnownBurstsSeen: 0,
        remainingShieldsCount: 0,
        estimatedRemainingBurstsInDeckAndShields: 0,
        tacticalWarning: "Oponente sem escudos restantes. Risco de Burst nulo neste momento.",
      };
    }

    const isBurst = (c: CardInstance) =>
      Boolean(
        c.def.hasBurst ||
        c.def.triggerKeywords?.includes("Burst") ||
        c.def.keywordTags?.some((k) => k.toLowerCase().includes("burst"))
      );

    const knownBurstsInGraveyard = opp.trash.filter(isBurst).length;
    const knownBurstsInBattleArea = opp.battleArea.filter(isBurst).length;
    const knownBurstsInBase = opp.baseSection.filter(isBurst).length;
    const totalKnownBurstsSeen = knownBurstsInGraveyard + knownBurstsInBattleArea + knownBurstsInBase;

    // Deck padrão tem ~12 bursts (faixa de 8 a 16)
    const estimatedDeckTotalBursts = 12;
    const remainingUnseenCards = Math.max(1, opp.deck.length + opp.shields.length);
    const estimatedRemainingBurstsInDeckAndShields = Math.max(
      0,
      Math.min(estimatedDeckTotalBursts - totalKnownBurstsSeen, remainingUnseenCards),
    );

    let rawProb = estimatedRemainingBurstsInDeckAndShields / remainingUnseenCards;
    rawProb = Math.max(0.05, Math.min(0.85, rawProb));
    const estimatedBurstProbability = Math.round(rawProb * 100) / 100;

    let threatSeverity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    let tacticalWarning: string;

    if (estimatedBurstProbability >= 0.45) {
      threatSeverity = "CRITICAL";
      tacticalWarning = "ALERTA MÁXIMO DE BURST: Poucos bursts foram revelados até agora. Alta probabilidade de reversão imediata ao quebrar o próximo escudo! Ataque com Unidades secundárias primeiro.";
    } else if (estimatedBurstProbability >= 0.28) {
      threatSeverity = "HIGH";
      tacticalWarning = "Ameaça elevada de Burst. Evite atacar primeiro com sua Unidade principal ou Link Unit para não sofrer remoção surpresa.";
    } else if (estimatedBurstProbability >= 0.15) {
      threatSeverity = "MEDIUM";
      tacticalWarning = "Probabilidade moderada de Burst no próximo escudo. Mantenha cautela na ordem de ataque.";
    } else {
      threatSeverity = "LOW";
      tacticalWarning = "Múltiplos Bursts do adversário já foram descartados ou revelados. Risco de virada por escudo é reduzido.";
    }

    return {
      estimatedBurstProbability,
      threatSeverity,
      knownBurstsInGraveyard,
      knownBurstsInBattleArea,
      knownBurstsInBase,
      totalKnownBurstsSeen,
      remainingShieldsCount,
      estimatedRemainingBurstsInDeckAndShields,
      tacticalWarning,
    };
  }

  // Caso 2: Chamado com TacticalBoardSummary
  const board = stateOrBoard as TacticalBoardSummary;
  const remainingShieldsCount = board.enemy.shieldCount;
  if (remainingShieldsCount === 0) {
    return {
      estimatedBurstProbability: 0,
      threatSeverity: "LOW",
      knownBurstsInGraveyard: 0,
      knownBurstsInBattleArea: 0,
      knownBurstsInBase: 0,
      totalKnownBurstsSeen: 0,
      remainingShieldsCount: 0,
      estimatedRemainingBurstsInDeckAndShields: 0,
      tacticalWarning: "Oponente sem escudos restantes. Risco de Burst nulo.",
    };
  }

  const rawProb = Math.min(0.65, Math.max(0.1, (remainingShieldsCount * 2) / 28));
  const estimatedBurstProbability = Math.round(rawProb * 100) / 100;
  const threatSeverity = estimatedBurstProbability >= 0.35 ? "HIGH" : estimatedBurstProbability >= 0.2 ? "MEDIUM" : "LOW";

  return {
    estimatedBurstProbability,
    threatSeverity,
    knownBurstsInGraveyard: 0,
    knownBurstsInBattleArea: 0,
    knownBurstsInBase: 0,
    totalKnownBurstsSeen: 0,
    remainingShieldsCount,
    estimatedRemainingBurstsInDeckAndShields: Math.round(remainingShieldsCount * 1.5),
    tacticalWarning: threatSeverity === "HIGH"
      ? "Risco de Burst relevante em escudos intactos. Ataque com cautela."
      : "Risco moderado de Burst no próximo escudo.",
  };
}

export function calculateTacticalMetrics(
  board: TacticalBoardSummary,
  persona: "amuro" | "char" | "heero" | "analyst",
  burstMatrix?: BurstThreatMatrix,
): {
  threatLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  lethalClockTurns: number;
  winProbabilityEstimate: number;
  keyThreats: string[];
  recommendedLines: TacticalLine[];
  tacticalAdvice: string;
  burstMatrix?: BurstThreatMatrix;
  friendlyLethalReady?: boolean;
  enemyLethalImminent?: boolean;
  sequencingAdvice?: string[];
} {
  const f = board.friendly;
  const e = board.enemy;

  // 1. Lethal Clock
  const friendlyHealthPool = (f.hasBase ? f.baseRemainingHp : 0) + f.shieldCount * 2;
  const enemyHealthPool = (e.hasBase ? e.baseRemainingHp : 0) + e.shieldCount * 2;

  let lethalClockTurns: number;
  if (e.totalAp <= 0) {
    lethalClockTurns = 99;
  } else {
    lethalClockTurns = Math.max(1, Math.ceil(friendlyHealthPool / Math.max(1, e.totalAp)));
  }

  // 2. Threat Level
  let threatLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  if (f.shieldCount === 0 || e.readyAp >= friendlyHealthPool || lethalClockTurns <= 1) {
    threatLevel = "CRITICAL";
  } else if (e.readyAp > (f.hasBase ? f.baseRemainingHp : 0) || lethalClockTurns <= 2 || e.totalAp > f.totalHp + 4) {
    threatLevel = "HIGH";
  } else if (e.totalAp >= f.totalAp || e.units.length > f.units.length) {
    threatLevel = "MEDIUM";
  } else {
    threatLevel = "LOW";
  }

  // 3. Win Probability Estimate (0.05 a 0.95)
  const shieldDelta = f.shieldCount - e.shieldCount;
  const apDelta = f.totalAp - e.totalAp;
  const hpDelta = f.totalHp - e.totalHp;
  const handDelta = f.handCount - e.handCount;
  const rawScore = 0.5 + shieldDelta * 0.07 + apDelta * 0.02 + hpDelta * 0.015 + handDelta * 0.02;
  const winProbabilityEstimate = Math.min(0.95, Math.max(0.05, Math.round(rawScore * 100) / 100));

  // 4. Key Threats
  const keyThreats: string[] = [];
  for (const u of e.units) {
    const reasons: string[] = [];
    if (u.ap >= 4) reasons.push(`${u.ap} AP`);
    if (u.hasBreach) reasons.push("Breach");
    if (u.hasBlocker) reasons.push("Blocker");
    if (u.hasLink) reasons.push("Linked");
    if (reasons.length > 0) {
      keyThreats.push(`${u.name} [${u.cardCode}] (${reasons.join(", ")})`);
    }
  }
  if (keyThreats.length === 0 && e.units.length > 0) {
    keyThreats.push(`${e.units[0].name} [${e.units[0].cardCode}]`);
  }

  // 5. Matriz de Burst & Sequencing Advisor
  const matrix = burstMatrix ?? computeBurstThreatMatrix(board);
  const friendlyLethalReady = f.readyAp >= enemyHealthPool && (e.blockerCount === 0 || f.units.filter((u) => !u.rested).length > e.blockerCount);
  const enemyLethalImminent = e.totalAp >= friendlyHealthPool || e.readyAp >= friendlyHealthPool;

  const sequencingAdvice: string[] = [];
  if (friendlyLethalReady) {
    sequencingAdvice.push("FINALIZAÇÃO CONFIRMADA: Seu AP pronto supera a vida/escudos do oponente. Declare ataques diretos para vitória imediata.");
  }
  if (e.blockerCount > 0 && f.handCount > 0) {
    sequencingAdvice.push("Neutralize os Blockers inimigos com ações de Commands antes de declarar os ataques principais.");
  }
  if (matrix.threatSeverity === "CRITICAL" || matrix.threatSeverity === "HIGH") {
    sequencingAdvice.push("ORDEM DE ATAQUE: Unidades menores devem atacar primeiro para absorver possíveis Bursts antes da sua Unidade principal.");
  }
  if (f.units.some((u) => !u.hasLink && u.cardCode)) {
    sequencingAdvice.push("Considere parear Piloto compatível antes do ataque para ativar habilidade de Link e atacar imediatamente.");
  }

  // 6. Recommended Lines & Persona Advice
  const recommendedLines: TacticalLine[] = [];
  let tacticalAdvice = "";

  if (persona === "amuro") {
    // Linha Amuro: Preservação e Contra-ataque
    if (f.blockerCount > 0 && threatLevel !== "LOW") {
      recommendedLines.push({
        priority: 5,
        strategy: "defensive",
        actionRecommendation: "Manter Blocker ativo na retaguarda para proteger Base e absorver o próximo ataque inimigo.",
        rationale: "Sobrevivência da Base é prioridade máxima para sustentar o avanço no late game.",
        winProbabilityDelta: +0.08,
      });
    }

    const tradeTargets = e.units.filter((u) => u.remainingHp <= Math.max(...f.units.map((fu) => fu.ap), 0));
    if (tradeTargets.length > 0) {
      const topTarget = tradeTargets[0];
      recommendedLines.push({
        priority: 4,
        strategy: "control",
        actionRecommendation: `Realizar troca favorável abatendo ${topTarget.name}.`,
        targetInstanceId: topTarget.instanceId,
        rationale: "Remover atacantes do oponente sem perder peças fundamentais garante controle de ritmo.",
        winProbabilityDelta: +0.10,
      });
    }

    recommendedLines.push({
      priority: 3,
      strategy: "tempo",
      actionRecommendation: "Implantar unidade de custo eficiente ou emparelhar piloto para consolidar Link.",
      rationale: "Aumentar o valor por recurso com sinergia de piloto eleva a resiliência do tabuleiro.",
      winProbabilityDelta: +0.05,
    });

    tacticalAdvice =
      threatLevel === "CRITICAL"
        ? "Amuro Ray: 'O impacto inimigo é iminente! Não podemos arriscar a Base agora. Todos os blockers em prontidão imediata!'"
        : "Amuro Ray: 'Consigo ver a rota de avanço deles. Se mantivermos a compostura e eliminarmos as unidades avançadas, venceremos pelo controle.'";
  } else if (persona === "char") {
    // Linha Char: Agressão Fulminante e Pressão Direta
    recommendedLines.push({
      priority: 5,
      strategy: "aggressive",
      actionRecommendation: "Concentrar fogo direto nos escudos do jogador adversário.",
      rationale: "Três vezes mais rápido: pressão contínua na vida força o oponente a gastar turnos bloqueando em vez de progredir.",
      winProbabilityDelta: +0.14,
    });

    const blockers = e.units.filter((u) => u.hasBlocker);
    if (blockers.length > 0) {
      recommendedLines.push({
        priority: 4,
        strategy: "control",
        actionRecommendation: `Neutralizar o Blocker inimigo (${blockers[0].name}) para abrir caminho aos atacantes.`,
        targetInstanceId: blockers[0].instanceId,
        rationale: "Derrubar a barricada inimiga garante penetração total dos ataques principais.",
        winProbabilityDelta: +0.11,
      });
    }

    recommendedLines.push({
      priority: 3,
      strategy: "tempo",
      actionRecommendation: "Mobilizar unidades com alto AP ou Breach para acelerar a corrida pelo dano.",
      rationale: "No Gundam TCG, hesitação é fatal. Quebre os escudos antes que o oponente estruture defesas.",
      winProbabilityDelta: +0.07,
    });

    tacticalAdvice =
      threatLevel === "CRITICAL"
        ? "Char Aznable: 'Eles pensam que nos encurralaram? A melhor defesa é aniquilar a linha deles antes que possam piscar!'"
        : "Char Aznable: 'Mostre a eles a velocidade do Cometa Vermelho. Ataque o ponto mais fraco e não conceda um instante de fôlego!'";
  } else if (persona === "analyst") {
    // Linha Analista OZ / Anaheim Electronics: Rulings, Metagame & Risco Estatístico
    recommendedLines.push({
      priority: 5,
      strategy: "control",
      actionRecommendation: "Verificar matriz de probabilidade de Burst antes de declarar ataques à base.",
      rationale: "Mitigação estatística: 1 Burst imprevisto pode reverter a vantagem de tempo em 2 turnos.",
      winProbabilityDelta: +0.15,
    });
    recommendedLines.push({
      priority: 4,
      strategy: "tempo",
      actionRecommendation: "Sincronizar resolução de triggers e pareamento de Link Units na Main Phase.",
      rationale: "Maximizar eficiência de custo por ponto de poder conforme curvas competitivas.",
      winProbabilityDelta: +0.10,
    });
    recommendedLines.push({
      priority: 3,
      strategy: "defensive",
      actionRecommendation: "Preservar reserva de energia para ativação de comandos reativos no turno adversário.",
      rationale: "Garante resposta prioritária a ameaças de alto impacto.",
      winProbabilityDelta: +0.07,
    });

    tacticalAdvice = matrix && matrix.threatSeverity === "HIGH"
      ? "Estrategista da OZ: 'Atenção ao risco elevado na matriz de Burst dos escudos. Recomendo neutralizar unidades de apoio antes de investir contra a base.'"
      : "Estrategista da OZ: 'Telemetria Anaheim sincronizada. Mantenha controle rígido da curva de recursos e execute jogadas dentro do timing ótimo.'";
  } else {
    // Linha Heero: Zero System Cálculo Objetivo
    const isLethalPossible = f.readyAp >= enemyHealthPool;

    if (isLethalPossible) {
      recommendedLines.push({
        priority: 5,
        strategy: "aggressive",
        actionRecommendation: "Executar sequência letal direta. Alvo: vitória imediata na partida.",
        rationale: "Cálculo do Zero System confirmou 100% de probabilidade de término de jogo neste turno.",
        winProbabilityDelta: +0.40,
      });
    } else {
      recommendedLines.push({
        priority: 5,
        strategy: "control",
        actionRecommendation: "Otimizar dano nas unidades de maior AP por custo de HP do inimigo.",
        rationale: "Minimizar o potencial de dano recebido por recurso investido pelo oponente.",
        winProbabilityDelta: +0.12,
      });

      recommendedLines.push({
        priority: 4,
        strategy: "tempo",
        actionRecommendation: "Utilizar comandos táticos para neutralização prévia antes de declarar ataque.",
        rationale: "Neutralização remota impede ativação de blockers no step de combate.",
        winProbabilityDelta: +0.08,
      });
    }

    recommendedLines.push({
      priority: 3,
      strategy: "defensive",
      actionRecommendation: "Calcular margem de contra-ataque antes de esgotar atacantes.",
      rationale: "Manter taxa de sobrevivência acima do limiar crítico de dano letal.",
      winProbabilityDelta: +0.06,
    });

    tacticalAdvice = isLethalPossible
      ? "Heero Yuy: 'Alvo confirmado. Iniciando eliminação do comandante inimigo. Probabilidade de sucesso: total.'"
      : "Heero Yuy: 'Zero System acionado. Todas as variáveis de combate mapeadas. Prosseguindo com eliminação sistemática de ameaças.'";
  }

  return {
    threatLevel,
    lethalClockTurns,
    winProbabilityEstimate,
    keyThreats,
    recommendedLines,
    tacticalAdvice,
    burstMatrix: matrix,
    friendlyLethalReady,
    enemyLethalImminent,
    sequencingAdvice,
  };
}

export async function analyzeWithGemini(
  board: TacticalBoardSummary,
  persona: "amuro" | "char" | "heero" | "analyst",
  metrics: ReturnType<typeof calculateTacticalMetrics>,
  apiKey?: string,
  clientOverride?: { models: { generateContent: (args: any) => Promise<any> } },
): Promise<{ tacticalAdvice: string; strategicInsight?: string } | null> {
  const resolvedKey = apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
  if (!resolvedKey && !clientOverride) return null;

  try {
    const ai = clientOverride || new GoogleGenAI({ apiKey: resolvedKey! });
    const prompt = `Você é o subsistema tático do Zero System operando no jogo Gundam Card Game TCG.
Persona do Piloto: ${persona.toUpperCase()}
Estado do Tabuleiro:
- Turno: ${board.turnNumber}
- Assento do Jogador: ${board.seat}
- Escudos do Jogador: ${board.friendly.shieldCount} | Vida da Base: ${board.friendly.baseRemainingHp}
- Escudos do Oponente: ${board.enemy.shieldCount} | Vida da Base: ${board.enemy.baseRemainingHp}
- Total AP Campo: Aliado ${board.friendly.totalAp} vs Inimigo ${board.enemy.totalAp}
- Nível de Ameaça: ${metrics.threatLevel} (Lethal Clock: ${metrics.lethalClockTurns} turnos)
- Probabilidade Estimada de Vitória: ${(metrics.winProbabilityEstimate * 100).toFixed(0)}%
- Ameaças Chave: ${metrics.keyThreats.join("; ")}

Instrução:
Gere uma mensagem tática curta em português (pt-BR), de até 3 frases, incorporando a personalidade de ${persona.toUpperCase()} (${persona === "amuro" ? "analítico, protetor, focado em Newtype e defesa" : persona === "char" ? "audacioso, três vezes mais rápido, ofensivo fulminante" : persona === "analyst" ? "especialista militar e engenheiro da Anaheim Electronics, focado em metagame, telemetria e rulings oficiais" : "frio, calculista, objetivo militar implacável do Zero System"}).
Responda APENAS o texto da fala do piloto.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
    });

    const text = response.text?.trim();
    if (text) {
      return { tacticalAdvice: text, strategicInsight: `Análise quântica do Gemini 3.8 Flash para ${persona}` };
    }
  } catch {
    // Gemini falhou — o orquestrador fará fallback para Claude ou Determinístico
  }
  return null;
}

export async function analyzeWithClaude(
  board: TacticalBoardSummary,
  persona: "amuro" | "char" | "heero" | "analyst",
  metrics: ReturnType<typeof calculateTacticalMetrics>,
  apiKey?: string,
  clientOverride?: { messages: { create: (args: any) => Promise<any> } },
): Promise<{ tacticalAdvice: string; strategicInsight?: string } | null> {
  const resolvedKey = apiKey || process.env.ANTHROPIC_API_KEY;
  if (!resolvedKey && !clientOverride) return null;

  try {
    const anthropic = clientOverride || new Anthropic({ apiKey: resolvedKey! });
    const prompt = `Você é o subsistema tático Zero System no Gundam Card Game.
Persona: ${persona.toUpperCase()}
Ameaça: ${metrics.threatLevel}, Lethal Clock: ${metrics.lethalClockTurns} turnos.
Escudos: Aliado ${board.friendly.shieldCount} vs Oponente ${board.enemy.shieldCount}.
Dê um comando tático conciso (1 a 2 frases) na voz e tom do piloto ${persona.toUpperCase()}.`;

    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 200,
      messages: [{ role: "user", content: prompt }],
    });

    const block = response.content[0];
    if (block && block.type === "text" && block.text.trim()) {
      return { tacticalAdvice: block.text.trim(), strategicInsight: `Avaliação do Claude 3.5 Sonnet para ${persona}` };
    }
  } catch {
    // Claude falhou — fallback determinístico
  }
  return null;
}

export async function analyzeTacticalState(options: ZeroSystemAnalysisOptions): Promise<ZeroSystemAnalysis> {
  const { state, seat, persona = "adaptive", forceDeterministic = false } = options;

  const boardSummary = extractTacticalBoardSummary(state, seat);
  const resolvedPersona = resolveEffectivePersona(boardSummary, persona);
  const oppSeat = otherPlayer(seat);
  const burstMatrix = computeBurstThreatMatrix(state, oppSeat);
  const metrics = calculateTacticalMetrics(boardSummary, resolvedPersona, burstMatrix);

  let provider: "gemini" | "claude" | "deterministic" = "deterministic";
  let finalAdvice = metrics.tacticalAdvice;

  if (!forceDeterministic) {
    // 1. Tenta Gemini (Principal)
    const geminiResult = await analyzeWithGemini(
      boardSummary,
      resolvedPersona,
      metrics,
      options.apiKeyGemini,
      options.geminiClient,
    );
    if (geminiResult) {
      provider = "gemini";
      finalAdvice = geminiResult.tacticalAdvice;
    } else {
      // 2. Tenta Claude (Fallback Secundário)
      const claudeResult = await analyzeWithClaude(
        boardSummary,
        resolvedPersona,
        metrics,
        options.apiKeyClaude,
        options.claudeClient,
      );
      if (claudeResult) {
        provider = "claude";
        finalAdvice = claudeResult.tacticalAdvice;
      }
    }
  }

  return {
    provider,
    persona,
    resolvedPersona,
    timestamp: new Date().toISOString(),
    threatLevel: metrics.threatLevel,
    lethalClockTurns: metrics.lethalClockTurns,
    winProbabilityEstimate: metrics.winProbabilityEstimate,
    keyThreats: metrics.keyThreats,
    recommendedLines: metrics.recommendedLines,
    tacticalAdvice: finalAdvice,
    boardSummary,
    burstMatrix,
    friendlyLethalReady: metrics.friendlyLethalReady,
    enemyLethalImminent: metrics.enemyLethalImminent,
    sequencingAdvice: metrics.sequencingAdvice,
  };
}

export async function getTacticalTelemetry(
  matchId: string,
  seat: PlayerId,
  options: { persona?: PilotPersonaId; forceDeterministic?: boolean } = {},
): Promise<ZeroSystemAnalysis> {
  const match = getMatch(matchId);
  if (!match) {
    throw new Error(`Partida ${matchId} não encontrada para análise do Zero System.`);
  }

  return analyzeTacticalState({
    state: match.state,
    seat,
    persona: options.persona ?? "adaptive",
    forceDeterministic: options.forceDeterministic,
  });
}

// --- 2. Análise de Consistência e Distribuição Hipergeométrica do Deckbuilder ---

export function combinations(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  const kEff = Math.min(k, n - k);
  let c = 1;
  for (let i = 1; i <= kEff; i++) {
    c = (c * (n - (kEff - i))) / i;
  }
  return c;
}

export function hypergeometricPAtLeastK(
  populationSize: number,
  successesInPop: number,
  sampleSize: number,
  minSuccesses: number = 1,
): number {
  if (successesInPop <= 0 || sampleSize <= 0) return 0;
  if (minSuccesses <= 0) return 1;
  const N = Math.max(1, Math.round(populationSize));
  const K = Math.min(N, Math.max(0, Math.round(successesInPop)));
  const n = Math.min(N, Math.max(0, Math.round(sampleSize)));

  if (K < minSuccesses) return 0;

  const totalWays = combinations(N, n);
  if (totalWays <= 0) return 0;

  let pLessThanK = 0;
  for (let x = 0; x < minSuccesses; x++) {
    const successWays = combinations(K, x);
    const failWays = combinations(N - K, n - x);
    pLessThanK += (successWays * failWays) / totalWays;
  }

  const p = 1 - pLessThanK;
  return Math.min(1, Math.max(0, Math.round(p * 1000) / 1000));
}

export function analyzeDeckConsistency(cardsInput: any[]): DeckConsistencyAnalysis {
  const normalizedCards: Array<{
    code: string;
    count: number;
    name: string;
    color: string;
    cardType: string;
    cost: number;
    level: number;
    hasBurst: boolean;
    traits: string[];
  }> = [];

  for (const item of cardsInput || []) {
    let code = "";
    let count = 1;
    if (typeof item === "string") {
      code = item;
      count = 1;
    } else if (item && typeof item === "object") {
      code = item.code || item.card?.code || item.id || "";
      count = Number(item.count ?? item.quantity ?? 1);
    }
    if (!code) continue;

    const def = getCardDefByCode(code);
    const rawCard = item && typeof item === "object" ? (item.card || item) : {};

    const cardType = (rawCard.cardType || rawCard.type || def?.cardType || "UNIT").toUpperCase();
    if (cardType === "RESOURCE") continue;

    const color = (rawCard.color || def?.color || "Blue").toLowerCase();
    const cost = Number(rawCard.cost ?? def?.cost ?? 2);
    const level = Number(rawCard.level ?? def?.level ?? (cardType === "UNIT" ? 3 : 1));
    const hasBurst = Boolean(
      rawCard.hasBurst ??
      def?.hasBurst ??
      rawCard.triggerKeywords?.includes("Burst") ??
      def?.triggerKeywords?.includes("Burst") ??
      rawCard.keywordTags?.some((k: string) => String(k).toLowerCase().includes("burst"))
    );
    const name = rawCard.namePt || rawCard.name || rawCard.nameEn || def?.nameEn || code;
    const traits = rawCard.traits || def?.traits || [];

    normalizedCards.push({
      code: code.toUpperCase(),
      count: Math.max(1, count),
      name,
      color,
      cardType,
      cost,
      level,
      hasBurst,
      traits,
    });
  }

  const totalCards = normalizedCards.reduce((sum, c) => sum + c.count, 0);
  const unitsCount = normalizedCards.filter((c) => c.cardType === "UNIT").reduce((sum, c) => sum + c.count, 0);
  const pilotsCount = normalizedCards.filter((c) => c.cardType === "PILOT").reduce((sum, c) => sum + c.count, 0);
  const commandsCount = normalizedCards.filter((c) => c.cardType === "COMMAND").reduce((sum, c) => sum + c.count, 0);
  const basesCount = normalizedCards.filter((c) => c.cardType === "BASE").reduce((sum, c) => sum + c.count, 0);
  const burstCount = normalizedCards.filter((c) => c.hasBurst).reduce((sum, c) => sum + c.count, 0);

  const lowCostUnitsCount = normalizedCards
    .filter((c) => c.cardType === "UNIT" && (c.cost <= 2 || c.level <= 2))
    .reduce((sum, c) => sum + c.count, 0);

  const cost1Count = normalizedCards.filter((c) => c.cost === 1).reduce((sum, c) => sum + c.count, 0);
  const cost2Count = normalizedCards.filter((c) => c.cost === 2).reduce((sum, c) => sum + c.count, 0);
  const cost3to4Count = normalizedCards.filter((c) => c.cost >= 3 && c.cost <= 4).reduce((sum, c) => sum + c.count, 0);
  const cost5PlusCount = normalizedCards.filter((c) => c.cost >= 5).reduce((sum, c) => sum + c.count, 0);

  const totalCostWeighted = normalizedCards.reduce((sum, c) => sum + c.cost * c.count, 0);
  const averageCost = totalCards > 0 ? Number((totalCostWeighted / totalCards).toFixed(2)) : 0;

  const colorDistribution: Record<string, number> = {};
  for (const c of normalizedCards) {
    colorDistribution[c.color] = (colorDistribution[c.color] || 0) + c.count;
  }
  const uniqueColors = Object.keys(colorDistribution);

  // Cálculo Hipergeométrico
  const population = totalCards > 0 ? totalCards : 50;
  const turn1PlayProbability = hypergeometricPAtLeastK(population, lowCostUnitsCount, 5, 1);
  const turn2PlayProbability = hypergeometricPAtLeastK(population, lowCostUnitsCount, 6, 1);
  const turn3PlayProbability = hypergeometricPAtLeastK(population, lowCostUnitsCount, 7, 1);
  const pilotInOpeningHandProbability = hypergeometricPAtLeastK(population, pilotsCount, 5, 1);
  const pilotByTurn3Probability = hypergeometricPAtLeastK(population, pilotsCount, 7, 1);
  const turn3IdealPairProbability = Math.round(turn3PlayProbability * pilotByTurn3Probability * 1000) / 1000;

  // Pontuação e Grade
  let score = 50;
  if (turn2PlayProbability >= 0.85) score += 25;
  else if (turn2PlayProbability >= 0.70) score += 15;
  else if (turn2PlayProbability >= 0.50) score += 5;
  else score -= 15;

  if (pilotsCount >= 6 && pilotsCount <= 10) score += 15;
  else if (pilotsCount >= 4 && pilotsCount <= 12) score += 8;
  else score -= 10;

  if (uniqueColors.length === 1) score += 10;
  else if (uniqueColors.length === 2) score += 5;
  else score -= 25;

  if (totalCards === 50) score += 5;
  else score -= 15;

  if (cost5PlusCount > 14) score -= 15;
  else if (averageCost >= 2.0 && averageCost <= 3.3) score += 10;

  const consistencyScore = Math.max(5, Math.min(100, score));
  let grade: "S" | "A" | "B" | "C" | "D";
  if (consistencyScore >= 90) grade = "S";
  else if (consistencyScore >= 80) grade = "A";
  else if (consistencyScore >= 68) grade = "B";
  else if (consistencyScore >= 50) grade = "C";
  else grade = "D";

  // Alertas e Recomendações
  const warnings: string[] = [];
  const recommendations: string[] = [];

  if (totalCards !== 50) {
    warnings.push(`Tamanho irregular: deck possui ${totalCards} cartas (o formato oficial exige exatamente 50 cartas principais).`);
  }

  if (lowCostUnitsCount < 10) {
    warnings.push(`Early game vulnerável: apenas ${lowCostUnitsCount} Unidades de custo 1-2. Risco de ${(100 - turn2PlayProbability * 100).toFixed(0)}% de passar os primeiros turnos sem campo.`);
    recommendations.push("Inclua entre 12 e 16 unidades de nível 1-2 (custo 1-2) para estabilizar a saída.");
  }

  if (pilotsCount < 4) {
    warnings.push(`Pilotos insuficientes: apenas ${pilotsCount} cartas. Link Units e aceleração de rush ficarão comprometidas.`);
    recommendations.push("Mantenha uma proporção de 6 a 10 pilotos sinérgicos com suas Unidades principais.");
  } else if (pilotsCount > 12) {
    warnings.push(`Excesso de Pilotos (${pilotsCount}): risco de comprar mãos sem Unidades compatíveis para parear.`);
  }

  if (cost5PlusCount > 14) {
    warnings.push(`Curva excessivamente pesada: ${cost5PlusCount} cartas de custo 5+. Alta probabilidade de mãos mortas nos turnos 1 a 3.`);
    recommendations.push("Substitua parte dos finalizadores caros por comandos rápidos ou Unidades de transição (custo 3-4).");
  }

  if (uniqueColors.length > 2) {
    warnings.push(`Violação de regras: foram detectadas ${uniqueColors.length} cores no deck. O regulamento oficial Bandai permite no máximo 2 cores.`);
  }

  if (burstCount < 8) {
    recommendations.push("Seu deck possui poucos efeitos Burst. Adicionar cartas com Burst aumenta a resiliência contra agressões rápidas.");
  }

  const suggestedTechCards: Array<{ code: string; name: string; reason: string }> = [];
  if (colorDistribution["blue"]) {
    suggestedTechCards.push(
      { code: "GD01-015", name: "Gundam Aerial", reason: "Blocker essencial e reciclador de recursos defensivos no meta azul." },
      { code: "ST01-010", name: "Suletta Mercury", reason: "Piloto excelente para acelerar Link Unit e gerar compras consistentes." },
    );
  }
  if (colorDistribution["red"]) {
    suggestedTechCards.push(
      { code: "ST03-001", name: "Sinanju", reason: "Pressão agressiva direta nos escudos inimigos com High-Maneuver." },
      { code: "ST03-010", name: "Full Frontal", reason: "Gatilho When Paired para implantar Unidades adicionais gratuitamente." },
    );
  }
  if (colorDistribution["green"]) {
    suggestedTechCards.push(
      { code: "ST02-001", name: "Wing Gundam", reason: "Finalizador versátil capaz de abater Unidades descansadas." },
      { code: "ST02-010", name: "Heero Yuy", reason: "Excelente sinergia de combate para garantir trocas favoráveis." },
    );
  }
  if (colorDistribution["white"]) {
    suggestedTechCards.push(
      { code: "GD02-001", name: "Strike Freedom", reason: "Unidade de alta mobilidade com Breach para perfurar defesas." },
      { code: "ST04-001", name: "Kira Yamato", reason: "Piloto de alto valor para proteção e longevidade da mesa." },
    );
  }

  return {
    totalCards,
    consistencyScore,
    grade,
    openingProbabilities: {
      turn1PlayProbability,
      turn2PlayProbability,
      turn3PlayProbability,
      pilotInOpeningHandProbability,
      turn3IdealPairProbability,
    },
    curveBreakdown: {
      cost1Count,
      cost2Count,
      cost3to4Count,
      cost5PlusCount,
      averageCost,
    },
    cardTypeBreakdown: {
      unitsCount,
      pilotsCount,
      commandsCount,
      basesCount,
      burstCount,
      lowCostUnitsCount,
    },
    colorDistribution,
    warnings,
    recommendations,
    suggestedTechCards: suggestedTechCards.slice(0, 4),
  };
}

// --- 3. Zero Terminal RAG Conversacional & Base de Regras (docs/17) ---

export interface GlossaryRuleEntry {
  keyword: string;
  aliases: string[];
  explanation: string;
  category: "EFFECT_KEYWORD" | "TRIGGER_KEYWORD" | "CORE_MECHANIC";
}

export const OFFICIAL_GLOSSARY_RULES: GlossaryRuleEntry[] = [
  {
    keyword: "Blocker",
    aliases: ["blocker", "bloquear", "bloqueador", "block", "bloqueio"],
    explanation: "Quando o oponente declara ataque, você pode descansar essa Unit pra mudar o alvo do ataque pra ela. Protege outra Unit sua trocando quem recebe o dano.",
    category: "EFFECT_KEYWORD",
  },
  {
    keyword: "Burst",
    aliases: ["burst", "escudo", "trigger de escudo", "dano de escudo"],
    explanation: "Efeito que ativa quando a carta é revelada como escudo destruído em batalha, em vez de simplesmente ir pro descarte — concede uma vantagem tática, recuperação ou remoção imediata.",
    category: "TRIGGER_KEYWORD",
  },
  {
    keyword: "Link Unit",
    aliases: ["link", "link unit", "during link", "parear", "pair", "rush"],
    explanation: "Uma Unit pareada com seu Piloto compatível (por traço ou nome) torna-se Link Unit. O principal bônus mecânico é poder atacar no mesmo turno em que entra em jogo (rush) e manter habilidades ativas de Link.",
    category: "CORE_MECHANIC",
  },
  {
    keyword: "Breach",
    aliases: ["breach", "breach x", "rompimento", "dano penetrante"],
    explanation: "Quando essa Unit destrói uma Unit inimiga com dano de batalha DURANTE O SEU TURNO, causa X de dano direto na primeira carta da área de escudo do oponente (a Base, se houver, ou o escudo do topo). Se o oponente não tiver nem Base nem escudo, o efeito não ativa.",
    category: "EFFECT_KEYWORD",
  },
  {
    keyword: "Repair",
    aliases: ["repair", "repair x", "curar", "cura", "recuperar hp"],
    explanation: "No fim do seu turno, essa Unit recupera X pontos de HP. Não cura instantaneamente durante a batalha — só no fechamento do turno do seu controlador.",
    category: "EFFECT_KEYWORD",
  },
  {
    keyword: "Support",
    aliases: ["support", "support x", "suporte", "dar ap"],
    explanation: "Descansando essa Unit durante sua fase principal, concede AP+X para 1 outra Unit aliada até o fim do turno. O valor soma em efeitos existentes, não duplica.",
    category: "EFFECT_KEYWORD",
  },
  {
    keyword: "First Strike",
    aliases: ["first strike", "ataque primeiro", "primeiro golpe", "iniciativa"],
    explanation: "Durante uma batalha, essa Unit causa dano ANTES da Unit inimiga. Se o dano dela já for suficiente pra destruir o alvo, o inimigo pode nem chegar a causar dano de volta.",
    category: "EFFECT_KEYWORD",
  },
  {
    keyword: "High-Maneuver",
    aliases: ["high-maneuver", "high maneuver", "imparavel", "inbloqueavel", "sem bloqueio"],
    explanation: "Essa Unit não pode ser bloqueada. Ataques dela sempre acertam o alvo original escolhido, mesmo que o oponente tenha Blocker disponível.",
    category: "EFFECT_KEYWORD",
  },
  {
    keyword: "Suppression",
    aliases: ["suppression", "supressao", "dois escudos", "dano duplo"],
    explanation: "Quando o dano de batalha dessa Unit atinge o escudo do oponente, atinge os 2 primeiros escudos ao mesmo tempo, não só 1.",
    category: "EFFECT_KEYWORD",
  },
  {
    keyword: "Deploy",
    aliases: ["deploy", "ao entrar", "iniciar", "entrar em jogo"],
    explanation: "O efeito ativa no momento em que a carta entra em jogo (é colocada na mesa), automaticamente — não precisa de ação extra do jogador pra disparar.",
    category: "TRIGGER_KEYWORD",
  },
  {
    keyword: "Once per Turn",
    aliases: ["once per turn", "uma vez por turno", "opt"],
    explanation: "Limite de uso mecânico — esse efeito só pode ser ativado 1 vez por turno, mesmo que a condição pra ativar aconteça de novo no mesmo turno.",
    category: "TRIGGER_KEYWORD",
  },
  {
    keyword: "When Paired",
    aliases: ["when paired", "ao parear", "momento de parear"],
    explanation: "Dispara no exato momento em que o pareamento com o Piloto acontece (não durante todo o tempo pareado, só no instante da ação de parear).",
    category: "TRIGGER_KEYWORD",
  },
  {
    keyword: "During Pair",
    aliases: ["during pair", "enquanto pareado"],
    explanation: "O efeito permanece ativo durante todo o tempo em que a Unit estiver pareada com um Piloto (ou modo piloto de command).",
    category: "TRIGGER_KEYWORD",
  },
  {
    keyword: "Sideboard",
    aliases: ["sideboard", "troca de cartas", "bo3", "reserva"],
    explanation: "Em partidas no formato Melhor de 3 (Bo3), cada jogador pode cadastrar até 10 cartas no Sideboard. Entre os Jogos 1 e 2 (e Jogo 3 se houver), há 180 segundos para realizar substituições. O deck final deve manter exatamente 50 cartas respeitando o limite de até 2 cores e 4 cópias por carta.",
    category: "CORE_MECHANIC",
  },
  {
    keyword: "Mulligan",
    aliases: ["mulligan", "trocar mao", "mao inicial"],
    explanation: "No início da partida, após comprar a mão inicial de 5 cartas, cada jogador tem a opção de fazer 1 Mulligan: devolver a mão e comprar 5 novas cartas.",
    category: "CORE_MECHANIC",
  },
  {
    keyword: "Base",
    aliases: ["base", "secao de base", "vida da base", "destruir base"],
    explanation: "A Base fornece pontos de vida adicionais e proteção para os escudos. Danos direcionados ao jogador atingem primeiro a Base antes de começarem a quebrar escudos.",
    category: "CORE_MECHANIC",
  },
];

export async function consultZeroTerminalRAG(options: ZeroRAGQueryOptions): Promise<ZeroRAGResponse> {
  const { message, persona = "heero", forceDeterministic = false } = options;
  const q = message.toLowerCase().trim();

  // 1. Busca por matching no glossário oficial
  const matchedRules = OFFICIAL_GLOSSARY_RULES.filter((r) =>
    r.aliases.some((alias) => q.includes(alias)) || q.includes(r.keyword.toLowerCase()),
  );

  const matched = matchedRules.length > 0 ? matchedRules : [OFFICIAL_GLOSSARY_RULES[0]]; // fallback Blocker
  const personaName =
    persona === "amuro"
      ? "Amuro Ray"
      : persona === "char"
      ? "Char Aznable"
      : persona === "oz_analyst" || persona === "analyst"
      ? "Estrategista da OZ"
      : "Heero Yuy";

  const contextText = matched.map((m) => `[${m.keyword}]: ${m.explanation}`).join("\n");

  let provider: "gemini" | "claude" | "deterministic" = "deterministic";
  let finalAnswer = "";

  if (!forceDeterministic) {
    // 1. Tenta Gemini (Principal)
    const geminiKey = options.apiKeyGemini || process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
    if (geminiKey) {
      try {
        const ai = new GoogleGenAI({ apiKey: geminiKey });
        const prompt = `Você é o subsistema tático Zero System no Gundam Card Game, respondendo na voz da persona: ${personaName}.
Diretrizes Oficiais de Tradução e Regras (docs/17):
- Nomes de keywords em inglês mantêm-se em inglês (ex: Blocker, Breach, Repair, Burst, Link Unit).
- Explicações mecânicas em português pt-BR claro e preciso.

Contexto Mecânico das Regras Oficiais:
${contextText}

Pergunta do Jogador: "${message}"

Instrução:
Responda de forma direta e objetiva (2 a 4 frases), explicando o funcionamento mecânico oficial da regra e incorporando o tom característico de ${personaName}.`;

        const response = await ai.models.generateContent({
          model: "gemini-3.8-flash",
          contents: prompt,
        });
        const text = response.text?.trim();
        if (text) {
          provider = "gemini";
          finalAnswer = text;
        }
      } catch {
        // Fallback para Claude
      }
    }

    if (!finalAnswer) {
      // 2. Tenta Claude (Fallback)
      const claudeKey = options.apiKeyClaude || process.env.ANTHROPIC_API_KEY;
      if (claudeKey) {
        try {
          const anthropic = new Anthropic({ apiKey: claudeKey });
          const response = await anthropic.messages.create({
            model: "claude-3-5-sonnet-20241022",
            max_tokens: 300,
            messages: [
              {
                role: "user",
                content: `Você é o Zero System no Gundam Card Game com persona ${personaName}.\nContexto oficial: ${contextText}\nPergunta: "${message}"\nResponda em pt-BR com precisão de regras em 2-3 frases no tom do personagem.`,
              },
            ],
          });
          const block = response.content[0];
          if (block && block.type === "text" && block.text.trim()) {
            provider = "claude";
            finalAnswer = block.text.trim();
          }
        } catch {
          // Fallback para Determinístico
        }
      }
    }
  }

  // 3. Resposta Determinística
  if (!finalAnswer) {
    const mainRule = matched[0];
    if (persona === "amuro") {
      finalAnswer = `Amuro Ray: 'Entendido. Segundo as regras oficiais de combate, sobre ${mainRule.keyword}: ${mainRule.explanation} Mantenha o foco na leitura da mesa para antecipar os próximos passos do adversário.'`;
    } else if (persona === "char") {
      finalAnswer = `Char Aznable: 'Preste bastante atenção: sobre ${mainRule.keyword}: ${mainRule.explanation} No Gundam TCG, quem compreende o ritmo da batalha age três vezes mais rápido que o oponente!'`;
    } else if (persona === "oz_analyst" || persona === "analyst") {
      finalAnswer = `Estrategista da OZ: 'Conforme as Regras Oficiais do Gundam Card Game (Comprehensive Rules v1.8): a mecânica de ${mainRule.keyword} estabelece que: ${mainRule.explanation} Recomenda-se aplicar este procedimento para assegurar conformidade competitiva.'`;
    } else {
      finalAnswer = `Heero Yuy: 'Zero System acionado. Diretriz tática de ${mainRule.keyword}: ${mainRule.explanation} Parâmetros mapeados. Prossiga com a execução da missão.'`;
    }
  }

  return {
    provider,
    persona,
    personaName,
    answer: finalAnswer,
    matchedRules: matched.map((m) => ({ keyword: m.keyword, explanation: m.explanation })),
    confidence: matchedRules.length > 0 ? 0.95 : 0.7,
    timestamp: new Date().toISOString(),
  };
}
