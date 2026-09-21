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

  it("aceita nivel zero_system com persona adaptativa por padrao", () => {
    const { matchId } = createTrainingMatch({ deckId: "ST01", level: "zero_system", human: HUMAN });
    expect(matchId).toBeDefined();
    expect(getMatch(matchId)?.seats.B?.bot).toEqual({
      policy: "zero_system",
      level: "zero_system",
      persona: "adaptive",
    });
    expect(getMatch(matchId)?.seats.B?.displayName).toBe("Zero System (ADAPTIVE)");
  });

  it("aceita nivel zero_system com persona customizada (char)", () => {
    const { matchId } = createTrainingMatch({ deckId: "ST01", level: "zero_system", persona: "char", human: HUMAN });
    expect(matchId).toBeDefined();
    expect(getMatch(matchId)?.seats.B?.bot).toEqual({
      policy: "zero_system",
      level: "zero_system",
      persona: "char",
    });
    expect(getMatch(matchId)?.seats.B?.displayName).toBe("Zero System (CHAR)");
  });

  it("recusa persona invalida com status 400", () => {
    expect(() =>
      createTrainingMatch({ deckId: "ST01", level: "zero_system", persona: "kira_yamato", human: HUMAN }),
    ).toThrow(TrainingMatchError);
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

  it("sorteia o firstPlayer quando não informado (nunca undefined, sempre A ou B)", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 30; i += 1) {
      const { matchId } = createTrainingMatch({ deckId: "ST01", level: "facil", human: HUMAN });
      const state = getMatch(matchId)!.state;
      seen.add(state.activePlayer);
    }
    // Com 30 tentativas e 50/50, a chance de nunca sortear um dos lados é
    // ~2^-29 — na prática, prova que os dois ramos existem sem travar em RNG mockado.
    expect(seen).toEqual(new Set(["A", "B"]));
  });

  it("respeita firstPlayer explícito = A (humano compra no turno 1)", () => {
    const { matchId } = createTrainingMatch({ deckId: "ST01", level: "facil", human: HUMAN, firstPlayer: "A", seed: 7 });
    expect(getMatch(matchId)!.state.activePlayer).toBe("A");
  });

  it("respeita firstPlayer explícito = B (bot compra e faz mulligan no turno 1)", () => {
    const { matchId } = createTrainingMatch({ deckId: "ST01", level: "facil", human: HUMAN, firstPlayer: "B", seed: 7 });
    const match = getMatch(matchId)!;
    expect(match.state.activePlayer).toBe("B");
    // O mulligan interativo é atribuído ao firstPlayer primeiro (setup.ts) — com o
    // bot começando, é o assento B que tem a decisão pendente, não o A.
    expect(decisionOwner(match.state)).toBe("B");
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

    const { matchId } = createTrainingMatch({ deckId: "ST01", level: "normal", human: HUMAN, seed: 3, firstPlayer: "A" });

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
    const { matchId } = createTrainingMatch({ deckId: "ST01", level: "normal", human: HUMAN, seed: 3, firstPlayer: "A" });
    expect(() => driveHumanUntilNotActive(matchId)).not.toThrow();
  });

  it("bot começando (firstPlayer=B): enfileira o mulligan do bot IMEDIATAMENTE na criação, antes de qualquer ação do humano", () => {
    const calls: BotTurnRequest[] = [];
    setBotTurnSink((req) => calls.push(req));

    const { matchId } = createTrainingMatch({ deckId: "ST01", level: "normal", human: HUMAN, seed: 3, firstPlayer: "B" });

    // `armTurnTimer` roda dentro de `createMatch` — o bot já deve ter sido
    // enfileirado pra resolver o próprio mulligan sem nenhuma ação prévia do humano.
    expect(decisionOwner(getMatch(matchId)!.state)).toBe("B");
    expect(calls.length).toBeGreaterThanOrEqual(1);
    expect(calls[0]).toMatchObject({ matchId, seat: "B", level: "normal" });
    expect(calls.filter((c) => c.seat === "A")).toHaveLength(0);
  });
});
