import { afterEach, describe, expect, it } from "vitest";
import { buildSt01DeckList } from "../fixtures/st01Deck";
import { buildSt02DeckList } from "../fixtures/st02Deck";
import {
  _resetAllMatchesForTests,
  applyAction,
  createMatch,
  joinMatch,
  matchViewFor,
  sceneWaitMsFor,
  setScenePace,
  setScenePacingEnabled,
} from "./matchStore";
import { SCENE_MS, mulliganRedrawMs, openingIntroMs, setupFinishMs } from "../scene/sceneTiming";

afterEach(() => {
  _resetAllMatchesForTests();
});

/** partida em jogo com os dois assentos; o turno passa com 3 ações (fim de turno + os dois passes) */
function seatedMatch() {
  const match = createMatch({ deckA: buildSt01DeckList(), deckB: buildSt02DeckList(), seed: 1, firstPlayer: "A", skipMulligan: true });
  joinMatch(match.id, "A", { userId: "user-1", displayName: "A" });
  joinMatch(match.id, "B", { userId: "user-2", displayName: "B" });
  return match;
}

function passTurn(matchId: string, active: "user-1" | "user-2" = "user-1") {
  const other = active === "user-1" ? "user-2" : "user-1";
  applyAction(matchId, active, { kind: "finishTurn" });
  applyAction(matchId, other, { kind: "passEndPhaseAction" });
  return applyAction(matchId, active, { kind: "passEndPhaseAction" });
}

describe("cena no servidor (spec simulador-cadencia-de-mesa)", () => {
  it("desligada (padrão dos testes): nada a esperar, prazo como antes", () => {
    const match = seatedMatch();
    const before = Date.now();
    const after = passTurn(match.id);
    expect(after.sceneEndsAt ?? null).toBeNull();
    expect(sceneWaitMsFor(match.id)).toBe(0);
    expect(matchViewFor(after, "B").sceneEndsAt).toBeNull();
    expect(after.turnDeadlineAt! - before).toBeLessThanOrEqual(300_000 + 50);
  });

  it("ligada: a virada de turno vira cena; o prazo do próximo jogador começa depois dela", () => {
    setScenePacingEnabled(true);
    const match = seatedMatch();
    const before = Date.now();
    const after = passTurn(match.id);
    const wait = sceneWaitMsFor(match.id);
    // fim de turno + "seu turno", recuperação, compra, principal
    expect(wait).toBeGreaterThanOrEqual(4 * SCENE_MS.banner);
    expect(matchViewFor(after, "A").sceneEndsAt).toBe(after.sceneEndsAt);
    expect(after.turnDeadlineAt! - before).toBeGreaterThanOrEqual(300_000 + wait - 50);
  });

  it("ritmo rápido de todos os jogadores: sem espera; um jogador no cinemático já basta para esperar", () => {
    setScenePacingEnabled(true);
    const match = seatedMatch();
    setScenePace(match.id, "user-1", "classic");
    setScenePace(match.id, "user-2", "classic");
    passTurn(match.id);
    expect(sceneWaitMsFor(match.id)).toBe(0);
    setScenePace(match.id, "user-2", "cinematic");
    passTurn(match.id, "user-2");
    expect(sceneWaitMsFor(match.id)).toBeGreaterThan(0);
    expect(matchViewFor(match, "B").scenePace).toBe("cinematic");
    expect(matchViewFor(match, "A").scenePace).toBe("classic");
  });

  it("abertura: moeda e mão inicial antes da 1ª decisão; troca de mão e o fim da preparação também viram cena", () => {
    setScenePacingEnabled(true);
    const match = createMatch({ deckA: buildSt01DeckList(), deckB: buildSt02DeckList(), seed: 1, firstPlayer: "A" });
    joinMatch(match.id, "A", { userId: "user-1", displayName: "A" });
    expect(sceneWaitMsFor(match.id)).toBe(0); // um assento só: ninguém vê a abertura ainda
    joinMatch(match.id, "B", { userId: "user-2", displayName: "B" });
    const opening = sceneWaitMsFor(match.id);
    expect(opening).toBeGreaterThan(openingIntroMs() - 100);
    expect(opening).toBeLessThanOrEqual(openingIntroMs());
    // o 1º jogador troca a mão: os dois veem a mão voltar, embaralhar e 5 novas saírem
    applyAction(match.id, "user-1", { kind: "resolveMulligan", keep: false });
    const afterRedraw = sceneWaitMsFor(match.id);
    expect(afterRedraw).toBeGreaterThanOrEqual(opening + mulliganRedrawMs() - 100);
    // o 2º fica com a mão: escudos, EX e os banners do turno 1
    applyAction(match.id, "user-2", { kind: "resolveMulligan", keep: true });
    expect(sceneWaitMsFor(match.id)).toBeGreaterThanOrEqual(afterRedraw + setupFinishMs() - 100);
  });

  it("abertura no ritmo rápido não segura ninguém", () => {
    setScenePacingEnabled(true);
    const match = createMatch({ deckA: buildSt01DeckList(), deckB: buildSt02DeckList(), seed: 1, firstPlayer: "A" });
    joinMatch(match.id, "A", { userId: "user-1", displayName: "A", scenePace: "classic" });
    joinMatch(match.id, "B", { userId: "user-2", displayName: "B", scenePace: "classic" });
    expect(sceneWaitMsFor(match.id)).toBe(0);
    applyAction(match.id, "user-1", { kind: "resolveMulligan", keep: false });
    applyAction(match.id, "user-2", { kind: "resolveMulligan", keep: true });
    expect(sceneWaitMsFor(match.id)).toBe(0);
  });

  it("cenas em sequência se somam (a tela toca os lotes em fila)", () => {
    setScenePacingEnabled(true);
    const match = seatedMatch();
    passTurn(match.id);
    const first = sceneWaitMsFor(match.id);
    passTurn(match.id, "user-2");
    expect(sceneWaitMsFor(match.id)).toBeGreaterThan(first);
  });
});
