import { describe, expect, it } from "vitest";
import { createGame } from "./setup";
import { buildVanillaDeckList } from "../fixtures/vanillaDeck";
import { advanceToMainPhase, finishTurnAndAdvance, runDrawPhase, runEndPhase, runResourcePhase, runStartPhase, runTurnChange } from "./phases";
import { applyEvent } from "./events";

function baseGame() {
  return createGame(buildVanillaDeckList(), buildVanillaDeckList(), { seed: 5, firstPlayer: "A" });
}

/** `baseGame` nasce no turno 1 (onde o 1º jogador não compra). Testes que
 *  exercitam uma Draw Phase "normal" avançam pro turno 2. */
function turn2(): ReturnType<typeof baseGame> {
  return { ...baseGame(), turnNumber: 2 };
}

describe("fases de turno (Comprehensive Rules seção 7)", () => {
  it("1º jogador NÃO compra na Draw Phase do turno 1 (Comprehensive Rules 6-3)", () => {
    const state = baseGame();
    const beforeHand = state.players.A.hand.length;
    const beforeDeck = state.players.A.deck.length;
    const next = runDrawPhase(runStartPhase(state));
    expect(next.phase).toBe("draw");
    expect(next.players.A.hand).toHaveLength(beforeHand); // inalterada
    expect(next.players.A.deck).toHaveLength(beforeDeck);
  });

  it("Draw Phase compra exatamente 1 carta do deck pro jogador ativo (turno 2+)", () => {
    const state = turn2();
    const before = state.players.A.deck.length;
    const beforeHand = state.players.A.hand.length;
    const next = runDrawPhase(runStartPhase(state));
    expect(next.players.A.deck).toHaveLength(before - 1);
    expect(next.players.A.hand).toHaveLength(beforeHand + 1);
    expect(next.phase).toBe("draw");
  });

  it("Resource Phase compra exatamente 1 carta do resource deck pra resource area", () => {
    const state = baseGame();
    let next = runStartPhase(state);
    next = runDrawPhase(next);
    next = runResourcePhase(next);
    expect(next.players.A.resourceDeck).toHaveLength(9);
    expect(next.players.A.resourceArea).toHaveLength(1);
    expect(next.phase).toBe("resource");
  });

  it("advanceToMainPhase roda Start->Draw->Resource->Main em sequência", () => {
    const state = baseGame();
    const next = advanceToMainPhase(state);
    expect(next.phase).toBe("main");
    const phaseChanges = next.eventLog
      .filter((e): e is Extract<typeof e, { type: "PHASE_CHANGE" }> => e.type === "PHASE_CHANGE")
      .map((e) => e.phase);
    expect(phaseChanges).toEqual(["start", "draw", "resource", "main"]);
  });

  it("perde por deck-out ao precisar comprar na Draw Phase sem cartas (Comprehensive Rules 1-2-2-2)", () => {
    let state = turn2();
    state = { ...state, players: { ...state.players, A: { ...state.players.A, deck: [] } } };
    const next = runDrawPhase(runStartPhase(state));
    expect(next.gameOver).toEqual({ winner: "B", reason: "deckOut" });
  });

  it("End Phase descarta até o limite de 10 cartas na mão", () => {
    let state = baseGame();
    // força 13 cartas na mão do jogador ativo
    const extra = state.players.A.deck.slice(0, 8).map((c) => ({ ...c, zone: "hand" as const }));
    state = {
      ...state,
      players: {
        ...state.players,
        A: { ...state.players.A, hand: [...state.players.A.hand, ...extra], deck: state.players.A.deck.slice(8) },
      },
    };
    expect(state.players.A.hand.length).toBeGreaterThan(10);
    const next = runEndPhase(state);
    expect(next.players.A.hand).toHaveLength(10);
  });

  it("finishTurnAndAdvance troca o jogador ativo e incrementa o turno", () => {
    const state = advanceToMainPhase(baseGame());
    const next = finishTurnAndAdvance(state);
    expect(next.activePlayer).toBe("B");
    expect(next.turnNumber).toBe(2);
    expect(next.phase).toBe("main");
  });

  it("Start Phase reativa cartas rested do jogador ativo", () => {
    let state = baseGame();
    const unitId = state.players.A.battleArea[0]?.instanceId;
    // sem unit em campo ainda no setup — testa via resourceArea, que sempre tem carta pro jogador 2
    state = runTurnChange(runEndPhase(advanceToMainPhase(state))); // agora é o turno de B
    const restedResource = state.players.B.resourceArea[0];
    expect(restedResource).toBeDefined();
    let withRest = applyEvent(state, { type: "REST_CARD", instanceId: restedResource.instanceId });
    withRest = runStartPhase(withRest);
    expect(withRest.players.B.resourceArea[0].rested).toBe(false);
    expect(unitId).toBeUndefined(); // battleArea começa vazia, nenhuma unit implantada no setup
  });

  it("CLEAR_TURN_MODIFIERS (via End Phase) remove modificadores endOfTurn mas mantém permanent", () => {
    let state = baseGame();
    const unit = state.players.A.deck[0];
    state = {
      ...state,
      players: {
        ...state.players,
        A: {
          ...state.players.A,
          battleArea: [
            {
              ...unit,
              zone: "battleArea",
              statModifiers: [
                { stat: "ap", amount: 2, duration: "endOfTurn", appliedOnTurn: state.turnNumber },
                { stat: "hp", amount: 1, duration: "permanent", appliedOnTurn: state.turnNumber },
              ],
            },
          ],
        },
      },
    };
    const next = runEndPhase(state);
    const card = next.players.A.battleArea[0];
    expect(card.statModifiers).toHaveLength(1);
    expect(card.statModifiers[0].duration).toBe("permanent");
  });
});
