import { GoogleGenAI } from "@google/genai";
import Anthropic from "@anthropic-ai/sdk";
import type { CardInstance, GameState, PlayerId } from "../../src/modules/simulator/engine/types";
import { effectiveAp, effectiveHp, hasKeyword, otherPlayer } from "../../src/modules/simulator/engine/types";
import { getMatch } from "../../src/modules/simulator/server/matchStore";

export type PilotPersonaId = "amuro" | "char" | "heero" | "adaptive";

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
  resolvedPersona: "amuro" | "char" | "heero";
  timestamp: string;
  threatLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  lethalClockTurns: number;
  winProbabilityEstimate: number; // 0.00 a 1.00
  keyThreats: string[];
  recommendedLines: TacticalLine[];
  tacticalAdvice: string;
  boardSummary: TacticalBoardSummary;
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
    name: u.def.nameEn || u.def.nameJa || u.def.code,
    cardCode: u.def.code,
    ap: effectiveAp(u, state),
    hp: effectiveHp(u, state),
    remainingHp: remHp(u, state),
    rested: u.rested,
    hasBlocker: hasKeyword(u, "Blocker", state),
    hasBreach: hasKeyword(u, "Breach", state),
    hasLink: Boolean(u.pairedPilotInstanceId),
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
      blockerId: state.combat.blockerId ?? undefined,
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
): "amuro" | "char" | "heero" {
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

export function calculateTacticalMetrics(board: TacticalBoardSummary, persona: "amuro" | "char" | "heero"): {
  threatLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  lethalClockTurns: number;
  winProbabilityEstimate: number;
  keyThreats: string[];
  recommendedLines: TacticalLine[];
  tacticalAdvice: string;
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

  // 5. Recommended Lines & Persona Advice
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
  };
}

export async function analyzeWithGemini(
  board: TacticalBoardSummary,
  persona: "amuro" | "char" | "heero",
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
Gere uma mensagem tática curta em português (pt-BR), de até 3 frases, incorporando a personalidade de ${persona.toUpperCase()} (${persona === "amuro" ? "analítico, protetor, focado em Newtype e defesa" : persona === "char" ? "audacioso, três vezes mais rápido, ofensivo fulminante" : "frio, calculista, objetivo militar implacável do Zero System"}).
Responda APENAS o texto da fala do piloto.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
    });

    const text = response.text?.trim();
    if (text) {
      return { tacticalAdvice: text, strategicInsight: `Análise quântica do Gemini 3.8 Flash para ${persona}` };
    }
  } catch (err) {
    // Gemini falhou — o orquestrador fará fallback para Claude ou Determinístico
  }
  return null;
}

export async function analyzeWithClaude(
  board: TacticalBoardSummary,
  persona: "amuro" | "char" | "heero",
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
  } catch (err) {
    // Claude falhou — fallback determinístico
  }
  return null;
}

export async function analyzeTacticalState(options: ZeroSystemAnalysisOptions): Promise<ZeroSystemAnalysis> {
  const { state, seat, persona = "adaptive", forceDeterministic = false } = options;

  const boardSummary = extractTacticalBoardSummary(state, seat);
  const resolvedPersona = resolveEffectivePersona(boardSummary, persona);
  const metrics = calculateTacticalMetrics(boardSummary, resolvedPersona);

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
