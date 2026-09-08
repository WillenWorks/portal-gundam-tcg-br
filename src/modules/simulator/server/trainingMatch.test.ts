import { afterEach, describe, expect, it } from "vitest";

import {
  _resetAllMatchesForTests,
  applyAction,
  botSeatFor,
  decisionOwner,
  defaultActionFor,
  getMatch,
  resignMatch,
  setBotTurnSink,
  type BotTurnRequest,
} from "./matchStore";
import {
  SIM_BOT_USER_ID,
  TrainingMatchError,
  botSeatFromSeats,
  createTrainingMatch,
} from "./trainingMatch";

afterEach(() => {
  _resetAllMatchesForTests();
});

const HUMAN = { userId: "human-1", displayName: "Willen" };

/** Aplica a ação-padrão pelo assento do humano até a vez ser de outro (ou fim de jogo). */
function driveHumanUntilNotActive(matchId: string): void {
  for (let i = 0; i < 50; i += 1) {
    const match = getMatch(matchId);
    if (!match || match.state.gameOver) return;
    if (decisionOwner(match.state) !== "A") return;
    applyAction(matchId, HUMAN.userId, defaultActionFor(match.state));
  }
}

describe("createTrainingMatch", () => {
  it("recusa deck não-validado com status 400", () => {
    expect(() => createTrainingMatch({ deckId: "ST99", level: "normal", human: HUMAN })).toThrow(TrainingMatchError);
    try {
      createTrainingMatch({ deckId: "ST99", level: "normal", human: HUMAN });
    } catch (err) {
      expect(err).toBeInstanceOf(TrainingMatchError);
      expect((err as TrainingMatchError).status).toBe(400);
    }
  });

  it("recusa dificuldade inválida com status 400", () => {
    try {
      createTrainingMatch({ deckId: "ST01", level: "impossivel", human: HUMAN });
      throw new Error("deveria ter lançado");
    } catch (err) {
      expect(err).toBeInstanceOf(TrainingMatchError);
      expect((err as TrainingMatchError).status).toBe(400);
    }
  });

  it("aceita nivel dificil para o bot de treino", () => {
    const { matchId } = createTrainingMatch({ deckId: "ST01", level: "dificil", human: HUMAN });
    expect(matchId).toBeDefined();
    expect(getMatch(matchId)?.seats.B?.bot).toEqual({ policy: "mcts", level: "dificil" });
  });

  it("recusa o próprio bot como jogador humano", () => {
    expect(() =>
      createTrainingMatch({ deckId: "ST01", level: "normal", human: { userId: SIM_BOT_USER_ID, displayName: "x" } }),
    ).toThrow(TrainingMatchError);
  });

  it("cria a partida com o jogador no A e o bot no B", () => {
    const { matchId } = createTrainingMatch({ deckId: "ST01", level: "facil", human: HUMAN, seed: 7 });
    const match = getMatch(matchId);
    expect(match).toBeDefined();
    expect(match!.seats.A?.userId).toBe(HUMAN.userId);
    expect(match!.seats.A?.bot).toBeUndefined();
    expect(match!.seats.B?.userId).toBe(SIM_BOT_USER_ID);
    expect(match!.seats.B?.bot).toEqual({ policy: "heuristic", level: "facil" });
    expect(botSeatFor(match!)).toBe("B");
    expect(match!.deckKeys).toEqual({ A: "ST01", B: "ST01" });
  });

  it("aceita o deck em minúsculas", () => {
    const { matchId } = createTrainingMatch({ deckId: "st02", level: "normal", human: HUMAN });
    expect(getMatch(matchId)!.deckKeys.A).toBe("ST02");
  });
});

describe("botSeatFromSeats", () => {
  it("acha o assento de bot num blob cru", () => {
    expect(botSeatFromSeats({ A: { userId: "x" }, B: { userId: "sim-bot", bot: { level: "normal" } } })).toBe("B");
    expect(botSeatFromSeats({ A: { userId: "x", bot: { level: "facil" } }, B: { userId: "y" } })).toBe("A");
    expect(botSeatFromSeats({ A: { userId: "x" }, B: { userId: "y" } })).toBeNull();
    expect(botSeatFromSeats(null)).toBeNull();
  });
});

describe("matchStore — enfileira o turno do bot", () => {
  it("enfileira quando vira a vez do bot; não enfileira no turno do humano nem em fim de jogo", () => {
    const calls: BotTurnRequest[] = [];
    setBotTurnSink((req) => calls.push(req));

    const { matchId } = createTrainingMatch({ deckId: "ST01", level: "normal", human: HUMAN, seed: 3 });

    // Resolve o mulligan do humano (e qualquer decisão inicial dele). Enquanto for
    // a vez do humano, nada é enfileirado.
    driveHumanUntilNotActive(matchId);
    expect(calls.filter((c) => c.seat === "A")).toHaveLength(0);

    // Agora é a vez do bot (mulligan ou turno) — deve ter enfileirado pelo menos 1×.
    expect(decisionOwner(getMatch(matchId)!.state)).toBe("B");
    expect(calls.length).toBeGreaterThanOrEqual(1);
    expect(calls[calls.length - 1]).toMatchObject({ matchId, seat: "B", level: "normal" });

    // Fim de jogo (desistência do humano) não enfileira.
    const before = calls.length;
    resignMatch(matchId, HUMAN.userId);
    expect(getMatch(matchId)!.state.gameOver).toBeTruthy();
    expect(calls.length).toBe(before);
  });

  it("não enfileira nada quando não há sink registrado", () => {
    const { matchId } = createTrainingMatch({ deckId: "ST01", level: "normal", human: HUMAN, seed: 3 });
    expect(() => driveHumanUntilNotActive(matchId)).not.toThrow();
  });
});
