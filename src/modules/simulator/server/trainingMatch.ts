import { createMatch, joinMatch, type MatchSeat } from "./matchStore";
import type { PlayerId } from "../engine/types";
import { VALIDATED_DECKS, isValidatedDeck } from "../content/validatedDecks";

/**
 * Modo treino solo contra o bot heurístico (docs/44 Fase 2 §4.2 / §10.2).
 *
 * Este módulo é a lógica pura de "montar uma partida de treino": valida o deck
 * (só `VALIDATED_DECKS` — ST01..ST04) e a dificuldade, cria a `MatchRecord` com
 * o jogador no assento A e o bot no B, e devolve o `matchId`. A rota HTTP
 * (`POST /api/simulator/training/new`, `server/index.ts`) é só uma casca fina
 * em volta disto — o que deixa a regra testável sem subir o Express.
 *
 * O bot NÃO é um usuário do banco: é um assento sintético identificado por
 * `SIM_BOT_USER_ID`. O worker (`services/sim-bot/`) se autentica como esse
 * mesmo id (JWT em `SIM_BOT_TOKEN`) pra aplicar as ações pela API autoritativa.
 */

export const SIM_BOT_USER_ID = "sim-bot";
export const SIM_BOT_DISPLAY_NAME = "Bot de Treino";

export const TRAINING_LEVELS = ["facil", "normal", "dificil", "zero_system"] as const;
export type TrainingLevel = (typeof TRAINING_LEVELS)[number];

export const PILOT_PERSONAS = ["amuro", "char", "heero", "adaptive"] as const;
export type PilotPersona = (typeof PILOT_PERSONAS)[number];

export function isTrainingLevel(value: unknown): value is TrainingLevel {
  return typeof value === "string" && (TRAINING_LEVELS as readonly string[]).includes(value);
}

export function isPilotPersona(value: unknown): value is PilotPersona {
  return typeof value === "string" && (PILOT_PERSONAS as readonly string[]).includes(value);
}

export class TrainingMatchError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "TrainingMatchError";
    this.status = status;
  }
}

import type { DeckList } from "../engine/setup";
import { counterForPlayerDeck, type MatchupTable, type ZeroCounterResult, type ZeroCounterSummary } from "../engine/bot/zeroCounter";

export interface CreateTrainingMatchInput {
  /** Legado: define o deck para ambos os lados caso playerDeckId / botDeckId não sejam passados. */
  deckId?: string;
  /** Identificador do deck do jogador (ex: "ST01" ou ID de deck salvo). */
  playerDeckId?: string;
  /** Identificador do deck do bot (ex: "ST02" ou ID de deck salvo; se omitido, usa o do jogador). */
  botDeckId?: string;
  /** DeckList pré-construída opcional para o jogador A. */
  playerDeckList?: DeckList;
  /** DeckList pré-construída opcional para o bot B. */
  botDeckList?: DeckList;
  /** `unknown` de propósito — vem cru do corpo HTTP; `isTrainingLevel` valida. */
  level: unknown;
  /** Persona tática do Zero System (opcional para level zero_system). */
  persona?: unknown;
  /** resumo do counter quando o deck do bot foi escolhido contra o do jogador (Zero System) */
  botCounter?: ZeroCounterSummary;
  human: { userId: string; displayName: string };
  /** default: aleatório — passe um valor fixo só em teste, pra determinismo. */
  seed?: number;
  /**
   * Quem começa a partida (compra no turno 1). Default: sorteio 50/50, igual
   * ao matchmaking PvP (`createMatch` na fila). Passe um valor fixo só em
   * teste — NÃO deriva do `seed`, que já alimenta o RNG de embaralhamento do
   * baralho e do mulligan (`createRng(seed ^ nonce)`); reaproveitar o mesmo
   * seed cru pra essa decisão correlacionaria as duas coisas.
   */
  firstPlayer?: PlayerId;
}

/**
 * Cria a partida de treino: jogador no assento A, bot no B.
 * Suporta qualquer combinação de starter decks (ST01..ST04) e decks customizados do usuário.
 */
export function createTrainingMatch(input: CreateTrainingMatchInput): { matchId: string } {
  const rawPlayerId = (input.playerDeckId || input.deckId || "").trim();
  const rawBotId = (input.botDeckId || rawPlayerId).trim();

  if (!rawPlayerId) {
    throw new TrainingMatchError("Deck do jogador não informado.");
  }
  if (!isTrainingLevel(input.level)) {
    throw new TrainingMatchError(`Dificuldade inválida — use "${TRAINING_LEVELS.join('" ou "')}".`);
  }
  if (!input.human.userId || input.human.userId === SIM_BOT_USER_ID) {
    throw new TrainingMatchError("Jogador inválido para uma partida de treino.", 403);
  }

  const upperPlayer = rawPlayerId.toUpperCase();
  const upperBot = rawBotId.toUpperCase();

  let deckA: DeckList;
  if (input.playerDeckList) {
    deckA = input.playerDeckList;
  } else if (isValidatedDeck(upperPlayer)) {
    deckA = VALIDATED_DECKS[upperPlayer].build();
  } else {
    throw new TrainingMatchError(
      `Deck do jogador "${rawPlayerId}" não está liberado para treino. Use um dos starters (${Object.keys(VALIDATED_DECKS).sort().join(", ")}) ou um deck válido do seu perfil.`,
    );
  }

  let deckB: DeckList;
  if (input.botDeckList) {
    deckB = input.botDeckList;
  } else if (isValidatedDeck(upperBot)) {
    deckB = VALIDATED_DECKS[upperBot].build();
  } else {
    throw new TrainingMatchError(
      `Deck do bot "${rawBotId}" não está liberado para treino. Use um dos starters (${Object.keys(VALIDATED_DECKS).sort().join(", ")}) ou um deck válido do seu perfil.`,
    );
  }

  const match = createMatch({
    deckA,
    deckB,
    firstPlayer: input.firstPlayer ?? (Math.random() < 0.5 ? "A" : "B"),
    seed: input.seed,
    mode: "training",
  });
  const keyA = isValidatedDeck(upperPlayer) ? upperPlayer : rawPlayerId;
  const keyB = isValidatedDeck(upperBot) ? upperBot : rawBotId;
  match.deckKeys = { A: keyA, B: keyB };
  if (input.botCounter) match.botCounter = input.botCounter;
  joinMatch(match.id, "A", {
    userId: input.human.userId,
    displayName: input.human.displayName,
    autoPassActionStep: true,
  });
  if (input.persona !== undefined && !isPilotPersona(input.persona)) {
    throw new TrainingMatchError(`Persona inválida — use "${PILOT_PERSONAS.join('" ou "')}".`);
  }
  const resolvedPersona = isPilotPersona(input.persona) ? input.persona : "adaptive";
  const botPolicy = input.level === "zero_system" ? "zero_system" : input.level === "dificil" ? "mcts" : "heuristic";

  const botSeatConfig: NonNullable<MatchSeat["bot"]> = {
    policy: botPolicy,
    level: input.level as TrainingLevel,
  };
  if (input.persona || input.level === "zero_system") {
    botSeatConfig.persona = resolvedPersona;
  }

  joinMatch(match.id, "B", {
    userId: SIM_BOT_USER_ID,
    // com counter, a persona que vale é a do counter (a mesma do aviso da UI)
    displayName:
      input.level === "zero_system"
        ? `Zero System (${(input.botCounter?.persona ?? resolvedPersona).toUpperCase()})`
        : SIM_BOT_DISPLAY_NAME,
    autoPassActionStep: true,
    bot: botSeatConfig,
  });
  return { matchId: match.id };
}

/** Resolve o assento do bot num blob `seats` cru (vindo do banco, no worker). */
export function botSeatFromSeats(seats: unknown): "A" | "B" | null {
  if (typeof seats !== "object" || seats === null) return null;
  const record = seats as Record<string, { bot?: unknown } | null | undefined>;
  if (record.A?.bot) return "A";
  if (record.B?.bot) return "B";
  return null;
}

/**
 * Zero System sem deck do bot escolhido → counter do deck do jogador (spec
 * bot-zero-system-forte). `botDeckId` explícito, outro nível ou matriz vazia → `null`
 * (o bot usa o deck pedido).
 */
export function resolveZeroCounter(input: {
  level: unknown;
  botDeckId: unknown;
  playerDeck: DeckList;
  table: MatchupTable;
}): ZeroCounterResult | null {
  if (input.level !== "zero_system") return null;
  if (String(input.botDeckId ?? "").trim()) return null;
  if (input.table.decks.length === 0) return null;
  return counterForPlayerDeck(input.playerDeck, input.table);
}
