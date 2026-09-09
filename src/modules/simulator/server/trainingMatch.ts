import { createMatch, joinMatch } from "./matchStore";
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

export const TRAINING_LEVELS = ["facil", "normal", "dificil"] as const;
export type TrainingLevel = (typeof TRAINING_LEVELS)[number];

export function isTrainingLevel(value: unknown): value is TrainingLevel {
  return typeof value === "string" && (TRAINING_LEVELS as readonly string[]).includes(value);
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
  human: { userId: string; displayName: string };
  /** default: aleatório — passe um valor fixo só em teste, pra determinismo. */
  seed?: number;
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
    firstPlayer: "A",
    seed: input.seed,
    mode: "training",
  });
  const keyA = isValidatedDeck(upperPlayer) ? upperPlayer : rawPlayerId;
  const keyB = isValidatedDeck(upperBot) ? upperBot : rawBotId;
  match.deckKeys = { A: keyA, B: keyB };
  joinMatch(match.id, "A", {
    userId: input.human.userId,
    displayName: input.human.displayName,
    autoPassActionStep: true,
  });
  joinMatch(match.id, "B", {
    userId: SIM_BOT_USER_ID,
    displayName: SIM_BOT_DISPLAY_NAME,
    autoPassActionStep: true,
    bot: { policy: input.level === "dificil" ? "mcts" : "heuristic", level: input.level },
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
