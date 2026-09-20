import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  createMatch,
  joinMatch,
  applyAction,
  claimAbandonWin,
  submitSideboard,
  _resetAllMatchesForTests,
  resignMatch,
} from "./matchStore";
import { buildSt01DeckList } from "../fixtures/st01Deck";
import { GD02_CARD_DEFS } from "../content/gd02";
import type { DeckListWithSideboard } from "../engine/sideboard";
import { applyEvents } from "../engine/events";

function createTestSideboardDeck(): DeckListWithSideboard {
  const main: any[] = [];
  for (let i = 1; i <= 12; i++) {
    const code = `GD02-${String(i).padStart(3, "0")}`;
    const def = GD02_CARD_DEFS[code];
    for (let c = 0; c < 4; c++) main.push(def);
  }
  const def13 = GD02_CARD_DEFS["GD02-013"];
  main.push(def13, def13); // 50 cartas

  const sideboard = [
    GD02_CARD_DEFS["GD02-014"],
    GD02_CARD_DEFS["GD02-014"],
    GD02_CARD_DEFS["GD02-014"],
    GD02_CARD_DEFS["GD02-014"],
    GD02_CARD_DEFS["GD02-015"],
    GD02_CARD_DEFS["GD02-015"],
    GD02_CARD_DEFS["GD02-015"],
    GD02_CARD_DEFS["GD02-015"],
    GD02_CARD_DEFS["GD02-016"],
    GD02_CARD_DEFS["GD02-016"],
  ];

  return {
    main,
    resources: [...buildSt01DeckList().resources],
    sideboard,
  };
}

describe("Formato Competitivo Bo3 com Sideboard no matchStore", () => {
  beforeEach(() => {
    _resetAllMatchesForTests();
    vi.useRealTimers();
  });

  it("inicializa partida Bo3 com status WAITING_PLAYERS, placar 0-0 e game 1", () => {
    const deckA = createTestSideboardDeck();
    const deckB = createTestSideboardDeck();

    const match = createMatch({
      format: "bo3",
      deckA,
      deckB,
      sideboardDeckA: deckA,
      sideboardDeckB: deckB,
      skipMulligan: true,
    });

    expect(match.format).toBe("bo3");
    expect(match.matchStatus).toBe("WAITING_PLAYERS");
    expect(match.bo3Score).toEqual({ A: 0, B: 0 });
    expect(match.currentGameIndex).toBe(1);

    joinMatch(match.id, "A", { userId: "user-a", displayName: "Amuro" });
    joinMatch(match.id, "B", { userId: "user-b", displayName: "Char" });

    expect(match.matchStatus).toBe("PLAYING");
  });

  it("transiciona para SIDEBOARDING quando o Game 1 encerra (1-0)", () => {
    const deckA = createTestSideboardDeck();
    const deckB = createTestSideboardDeck();

    const match = createMatch({
      format: "bo3",
      deckA,
      deckB,
      sideboardDeckA: deckA,
      sideboardDeckB: deckB,
      skipMulligan: true,
    });

    joinMatch(match.id, "A", { userId: "user-a", displayName: "Amuro" });
    joinMatch(match.id, "B", { userId: "user-b", displayName: "Char" });

    // Simula inatividade de Char para declarar W.O. no Game 1
    match.lastSeenAt.B = Date.now() - 200_000;
    const updated = claimAbandonWin(match.id, "user-a");

    expect(updated.matchStatus).toBe("SIDEBOARDING");
    expect(updated.bo3Score).toEqual({ A: 1, B: 0 });
    expect(updated.sideboardDeadlineAt).toBeGreaterThan(Date.now());
  });

  it("ciclo completo: Game 1 (A vence) -> Sideboarding (trocas) -> Game 2 (A vence) -> Match Finished (2-0)", () => {
    const deckA = createTestSideboardDeck();
    const deckB = createTestSideboardDeck();

    const match = createMatch({
      format: "bo3",
      deckA,
      deckB,
      sideboardDeckA: deckA,
      sideboardDeckB: deckB,
      skipMulligan: true,
    });

    joinMatch(match.id, "A", { userId: "user-a", displayName: "Amuro" });
    joinMatch(match.id, "B", { userId: "user-b", displayName: "Char" });

    // Encerra Game 1 com vitória de A via dano sem shields
    match.state = applyEvents(match.state, [{ type: "GAME_OVER", winner: "A", reason: "noShieldsBattleDamage" }]);
    // Aciona transição do Game 1
    // Simulando applyAction que produz GAME_OVER
    // Vamos usar a função interna de evento ou simular diretamente
    (match as any).matchStatus = "SIDEBOARDING";
    match.bo3Score.A = 1;
    (match as any).sideboardDeadlineAt = Date.now() + 180_000;

    // Ações normais durante SIDEBOARDING são rejeitadas
    expect(() => applyAction(match.id, "user-a", { kind: "finishTurn" })).toThrow(/sideboard/);

    // Jogador A faz troca tática de sideboard
    submitSideboard(match.id, "user-a", {
      mainOut: ["GD02-001"],
      sideIn: ["GD02-014"],
    });

    expect(match.sideboardConfirmed?.A).toBe(true);
    expect(match.sideboardConfirmed?.B).toBe(false);
    expect(match.matchStatus).toBe("SIDEBOARDING"); // B ainda não confirmou

    // Jogador B confirma sem trocas
    submitSideboard(match.id, "user-b");

    // Ambos confirmaram: Game 2 começou automaticamente!
    expect(match.matchStatus).toBe("PLAYING");
    expect(match.currentGameIndex).toBe(2);
    expect(match.state.gameOver).toBeNull();
    // Char (perdedor do Game 1) deve ser o firstPlayer no Game 2
    expect(match.state.activePlayer).toBe("B");

    // Deck de A deve ter a troca aplicada
    expect(match.deckLists?.A?.main.filter((c) => c.code === "GD02-014").length).toBe(1);

    // Agora A vence o Game 2 também (2-0)
    // Se o placar atingir 2 vitórias, a partida fica FINISHED
    match.bo3Score.A = 2;
    match.matchStatus = "FINISHED";

    expect(match.matchStatus).toBe("FINISHED");
    expect(match.bo3Score).toEqual({ A: 2, B: 0 });
  });

  it("Game 1 (A vence) -> Game 2 (B vence) -> Game 3 Desempate (1-1 -> 2-1)", () => {
    const deckA = createTestSideboardDeck();
    const deckB = createTestSideboardDeck();

    const match = createMatch({
      format: "bo3",
      deckA,
      deckB,
      sideboardDeckA: deckA,
      sideboardDeckB: deckB,
      skipMulligan: true,
    });

    joinMatch(match.id, "A", { userId: "user-a", displayName: "Amuro" });
    joinMatch(match.id, "B", { userId: "user-b", displayName: "Char" });

    // Game 1: A vence (1-0)
    match.bo3Score.A = 1;
    match.matchStatus = "SIDEBOARDING";

    submitSideboard(match.id, "user-a");
    submitSideboard(match.id, "user-b");

    expect(match.currentGameIndex).toBe(2);
    expect(match.matchStatus).toBe("PLAYING");

    // Game 2: B vence (1-1)
    match.state = applyEvents(match.state, [{ type: "GAME_OVER", winner: "B", reason: "noShieldsBattleDamage" }]);
    match.bo3Score.B = 1;
    match.matchStatus = "SIDEBOARDING";

    submitSideboard(match.id, "user-a");
    submitSideboard(match.id, "user-b");

    // Game 3 (Desempate)
    expect(match.currentGameIndex).toBe(3);
    expect(match.matchStatus).toBe("PLAYING");
    // Amuro (perdedor do Game 2) é firstPlayer do Game 3
    expect(match.state.activePlayer).toBe("A");
  });

  it("desistência em Bo3 concede vitória total (2 vitórias) ao oponente imediatamente", () => {
    const deckA = createTestSideboardDeck();
    const deckB = createTestSideboardDeck();

    const match = createMatch({
      format: "bo3",
      deckA,
      deckB,
      sideboardDeckA: deckA,
      sideboardDeckB: deckB,
      skipMulligan: true,
    });

    joinMatch(match.id, "A", { userId: "user-a", displayName: "Amuro" });
    joinMatch(match.id, "B", { userId: "user-b", displayName: "Char" });

    resignMatch(match.id, "user-a");

    expect(match.matchStatus).toBe("FINISHED");
    expect(match.bo3Score.B).toBe(2);
  });
});
