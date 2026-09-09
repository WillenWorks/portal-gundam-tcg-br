import { describe, expect, it } from "vitest";
import {
  _resetAllMatchesForTests,
  applyAction,
  decisionOwner,
  getMatch,
} from "./matchStore";
import { createTrainingMatch, SIM_BOT_USER_ID } from "./trainingMatch";
import { driveBotTurn } from "../../../../services/sim-bot/driveBotTurn.mjs";
import {
  buildDeckListFromUserDeck,
  UserDeckSimulatorError,
  type UserDeckInput,
} from "../content/userDeckBuilder";
import { ST01_CARD_DEFS } from "../fixtures/st01Deck";

describe("Decks Customizados do Usuário no Modo Treino Solo", () => {
  const HUMAN = { userId: "user-custom", displayName: "Treinador Gundam" };

  // Monta um deck customizado válido de 50 cartas + recursos usando cartas oficiais suportadas
  function createSampleUserDeck(name: string): UserDeckInput {
    return {
      name,
      items: [
        // 50 cartas principais (múltiplas cópias dentro da legalidade)
        { card: { code: "ST01-001" }, quantity: 4, section: "main" }, // Gundam (4)
        { card: { code: "ST01-003" }, quantity: 4, section: "main" }, // Guncannon (4)
        { card: { code: "ST01-004" }, quantity: 4, section: "main" }, // Guntank (4)
        { card: { code: "ST01-005" }, quantity: 4, section: "main" }, // GM (4)
        { card: { code: "ST01-006" }, quantity: 4, section: "main" }, // Aerial Score 6 (4)
        { card: { code: "ST01-008" }, quantity: 4, section: "main" }, // Demi Trainer (4)
        { card: { code: "ST01-009" }, quantity: 4, section: "main" }, // Zowort (4)
        { card: { code: "ST01-010" }, quantity: 4, section: "main" }, // Amuro Ray (4)
        { card: { code: "ST01-011" }, quantity: 4, section: "main" }, // Suletta Mercury (4)
        { card: { code: "ST01-012" }, quantity: 4, section: "main" }, // Thoroughly Damaged (4)
        { card: { code: "ST01-013" }, quantity: 4, section: "main" }, // Kais Resolve (4)
        { card: { code: "ST01-014" }, quantity: 3, section: "main" }, // Unforeseen Incident (3)
        { card: { code: "ST01-016" }, quantity: 3, section: "main" }, // Asticassia (3)
        // 10 recursos
        { card: { code: "ST01-RESOURCE" }, quantity: 10, section: "resource" },
      ],
    };
  }

  it("converte com sucesso um deck customizado do usuário em DeckList válida", () => {
    const userDeck = createSampleUserDeck("Meu Deck Favorito");
    const deckList = buildDeckListFromUserDeck(userDeck);

    expect(deckList.main.length).toBe(50);
    expect(deckList.resources.length).toBe(10);
    expect(deckList.main[0].code).toBe("ST01-001");
  });

  it("rejeita com erro amigável se o deck possuir cartas ainda não implementadas no simulador", () => {
    const invalidDeck: UserDeckInput = {
      name: "Deck com Carta Não Implementada",
      items: [
        { card: { code: "UNKNOWN-999" }, quantity: 4, section: "main" },
        { card: { code: "ST01-001" }, quantity: 46, section: "main" },
        { card: { code: "ST01-RESOURCE" }, quantity: 10, section: "resource" },
      ],
    };

    expect(() => buildDeckListFromUserDeck(invalidDeck)).toThrow(UserDeckSimulatorError);
    try {
      buildDeckListFromUserDeck(invalidDeck);
    } catch (err: any) {
      expect(err.message).toContain("UNKNOWN-999");
      expect(err.message).toContain("ainda não implementadas no simulador");
    }
  });

  it("rejeita com erro se o deck principal não tiver exatamente 50 cartas", () => {
    const shortDeck: UserDeckInput = {
      name: "Deck Incompleto",
      items: [
        { card: { code: "ST01-001" }, quantity: 20, section: "main" },
        { card: { code: "ST01-RESOURCE" }, quantity: 10, section: "resource" },
      ],
    };

    expect(() => buildDeckListFromUserDeck(shortDeck)).toThrow(UserDeckSimulatorError);
  });

  it("executa partida de treino solo com o humano usando deck customizado contra o bot usando ST01", async () => {
    _resetAllMatchesForTests();
    const customDeck = createSampleUserDeck("Deck do Willen");
    const customList = buildDeckListFromUserDeck(customDeck);

    const { matchId: mId } = createTrainingMatch({
      playerDeckId: customDeck.name,
      botDeckId: "ST01",
      playerDeckList: customList,
      level: "normal",
      human: HUMAN,
      seed: 99,
    });

    const m = getMatch(mId)!;
    expect(m.deckKeys).toEqual({ A: "Deck do Willen", B: "ST01" });

    // Mulligan
    applyAction(mId, HUMAN.userId, { kind: "resolveMulligan", keep: true });
    await driveBotTurn({
      initialState: m.state,
      seat: "B",
      level: "normal",
      seed: 99,
      commit: (act) => applyAction(mId, SIM_BOT_USER_ID, act as never),
    });

    // Turno 1 (Humano)
    expect(m.state.turnNumber).toBe(1);
    expect(m.state.activePlayer).toBe("A");
    applyAction(mId, HUMAN.userId, { kind: "finishTurn" });

    // Turno 2 (Bot com ST01)
    expect(m.state.turnNumber).toBe(2);
    expect(m.state.activePlayer).toBe("B");

    let iterations = 0;
    while (decisionOwner(m.state) === "B" && !m.state.gameOver && iterations < 15) {
      iterations++;
      const current = getMatch(mId)!;
      await driveBotTurn({
        initialState: current.state,
        seat: "B",
        level: "normal",
        seed: 99 + iterations,
        commit: (act) => applyAction(mId, SIM_BOT_USER_ID, act as never),
      });
    }

    // O bot joga e passa normalmente, voltando pro Turno 3 (Humano com deck customizado)
    expect(m.state.turnNumber).toBe(3);
    expect(m.state.activePlayer).toBe("A");
  });

  it("executa partida de treino solo com o BOT usando o deck customizado do usuário", async () => {
    _resetAllMatchesForTests();
    const customDeck = createSampleUserDeck("Deck do Usuário para o Bot");
    const customList = buildDeckListFromUserDeck(customDeck);

    const { matchId: mId } = createTrainingMatch({
      playerDeckId: "ST02",
      botDeckId: customDeck.name,
      botDeckList: customList,
      level: "normal",
      human: HUMAN,
      seed: 123,
    });

    const m = getMatch(mId)!;
    expect(m.deckKeys).toEqual({ A: "ST02", B: "Deck do Usuário para o Bot" });

    // Mulligan
    applyAction(mId, HUMAN.userId, { kind: "resolveMulligan", keep: true });
    await driveBotTurn({
      initialState: m.state,
      seat: "B",
      level: "normal",
      seed: 123,
      commit: (act) => applyAction(mId, SIM_BOT_USER_ID, act as never),
    });

    // Humano passa Turno 1
    applyAction(mId, HUMAN.userId, { kind: "finishTurn" });

    // Bot joga Turno 2 usando o deck customizado do usuário
    expect(m.state.turnNumber).toBe(2);
    expect(m.state.activePlayer).toBe("B");

    const botTurnActions: any[] = [];
    let iterations = 0;
    while (decisionOwner(m.state) === "B" && !m.state.gameOver && iterations < 15) {
      iterations++;
      const current = getMatch(mId)!;
      await driveBotTurn({
        initialState: current.state,
        seat: "B",
        level: "normal",
        seed: 123 + iterations,
        commit: (act) => {
          botTurnActions.push(act);
          applyAction(mId, SIM_BOT_USER_ID, act as never);
        },
      });
    }

    expect(botTurnActions.some((a) => a.kind === "deployCard")).toBe(true);
    expect(botTurnActions.some((a) => a.kind === "finishTurn")).toBe(true);

    // Avança suavemente para o Turno 3 do jogador humano
    expect(m.state.turnNumber).toBe(3);
    expect(m.state.activePlayer).toBe("A");
  });
});
