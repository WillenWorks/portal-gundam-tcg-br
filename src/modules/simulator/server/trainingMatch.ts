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

export interface CreateTrainingMatchInput {
  deckId: string;
  /** `unknown` de propósito — vem cru do corpo HTTP; `isTrainingLevel` valida. */
  level: unknown;
  human: { userId: string; displayName: string };
  /** default: aleatório — passe um valor fixo só em teste, pra determinismo. */
  seed?: number;
}

/**
 * Cria a partida de treino: jogador no assento A, bot no B (mesmo deck dos dois
 * lados — o foco é treinar as decisões, não o matchup). Reusa `createMatch` +
 * `joinMatch` do `matchStore`, então nasce com o Mulligan interativo pendente,
 * igual a uma partida normal.
 */
export function createTrainingMatch(input: CreateTrainingMatchInput): { matchId: string } {
  const deckId = typeof input.deckId === "string" ? input.deckId.toUpperCase() : "";
  if (!isValidatedDeck(deckId)) {
    throw new TrainingMatchError(
      `Deck "${input.deckId}" não está liberado para treino. Use um de: ${Object.keys(VALIDATED_DECKS).sort().join(", ")}.`,
    );
  }
  if (!isTrainingLevel(input.level)) {
    throw new TrainingMatchError(`Dificuldade inválida — use "${TRAINING_LEVELS.join('" ou "')}".`);
  }
  if (!input.human.userId || input.human.userId === SIM_BOT_USER_ID) {
    throw new TrainingMatchError("Jogador inválido para uma partida de treino.", 403);
  }

  const deck = VALIDATED_DECKS[deckId];
  const match = createMatch({ deckA: deck.build(), deckB: deck.build(), firstPlayer: "A", seed: input.seed });
  match.deckKeys = { A: deckId, B: deckId };
  joinMatch(match.id, "A", { userId: input.human.userId, displayName: input.human.displayName });
  joinMatch(match.id, "B", {
    userId: SIM_BOT_USER_ID,
    displayName: SIM_BOT_DISPLAY_NAME,
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
