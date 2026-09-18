import { afterEach, describe, expect, it } from "vitest";
import { buildSt01DeckList } from "../fixtures/st01Deck";
import {
  _resetAllMatchesForTests,
  applyAction,
  decisionOwner,
  defaultActionFor,
  getMatch,
  type MatchRecord,
} from "./matchStore";
import {
  _resetArenaForTests,
  activeLaneForSeat,
  applyDisconnectAutoPass,
  createLobby,
  engineSeatFor,
  joinLobby,
  startArenaMatch,
  type ArenaMatchRecord,
  type ArenaSeatId,
} from "./arena4pStore";
import type { PlayerId } from "../engine/types";

afterEach(() => {
  _resetAllMatchesForTests();
  _resetArenaForTests();
});

/** 4 pilotos, todos de ST01 — só interessa ter uma Arena 2v2 cheia e pronta. */
function startFullArena(): ArenaMatchRecord {
  const lobby = createLobby("2v2", { userId: "u-A", displayName: "Piloto A", deckKey: "ST01" });
  joinLobby(lobby.id, { userId: "u-B", displayName: "Piloto B", deckKey: "ST01" });
  joinLobby(lobby.id, { userId: "u-C", displayName: "Piloto C", deckKey: "ST01" });
  joinLobby(lobby.id, { userId: "u-D", displayName: "Piloto D", deckKey: "ST01" });
  const decks = {
    seatA: buildSt01DeckList(),
    seatB: buildSt01DeckList(),
    seatC: buildSt01DeckList(),
    seatD: buildSt01DeckList(),
  };
  return startArenaMatch(lobby, decks);
}

/** Simula "os dois lados ficaram AFK a partida inteira" — resolve toda decisão pendente
 *  pela ação-padrão até estabilizar num passo com dono conhecido (main phase, sem
 *  decisão/combate/action-step pendente). Não assume mulligan vs. main phase: só usa a
 *  MESMA `defaultActionFor` que o timer real do servidor usaria. */
function driveToStableDecision(matchId: string, userIdFor: (seat: PlayerId) => string): void {
  for (let i = 0; i < 12; i++) {
    const match = getMatch(matchId)!;
    if (match.state.gameOver) return;
    if (match.state.phase === "main" && !match.state.combat && !match.state.endPhaseAction) return;
    const owner = decisionOwner(match.state);
    if (!owner) return;
    applyAction(matchId, userIdFor(owner), defaultActionFor(match.state));
  }
}

/** `seatX` é sempre quem `createLane` põe no engine seat "A" da lane, `seatY` no "B" (ver `startArenaMatch`). */
function userIdForLane(arenaMatch: ArenaMatchRecord, seatX: ArenaSeatId, seatY: ArenaSeatId) {
  return (playerId: PlayerId): string => {
    const arenaSeat = playerId === "A" ? seatX : seatY;
    return arenaMatch.seats[arenaSeat].userId;
  };
}

describe("applyDisconnectAutoPass", () => {
  it("resolve a decisão pendente do assento desconectado com a ação-padrão e avança a lane", () => {
    const arenaMatch = startFullArena();
    const lane = activeLaneForSeat(arenaMatch, "seatA")!;
    driveToStableDecision(lane.matchId, userIdForLane(arenaMatch, "seatA", "seatB"));

    const match = getMatch(lane.matchId)!;
    const ownerSeat = decisionOwner(match.state);
    expect(ownerSeat).not.toBeNull();
    const expectedAction = defaultActionFor(match.state);
    const historyLengthBefore = match.actionHistory.length;
    const disconnectedArenaSeat: ArenaSeatId = engineSeatFor(lane, "seatA") === ownerSeat ? "seatA" : "seatB";

    applyDisconnectAutoPass(arenaMatch.id, disconnectedArenaSeat);

    const after = getMatch(lane.matchId)!;
    expect(after.actionHistory.length).toBe(historyLengthBefore + 1);
    expect(after.actionHistory.at(-1)).toEqual(expectedAction);
  });

  it("não faz nada se a decisão pendente não é mais deste assento", () => {
    const arenaMatch = startFullArena();
    const lane = activeLaneForSeat(arenaMatch, "seatA")!;
    driveToStableDecision(lane.matchId, userIdForLane(arenaMatch, "seatA", "seatB"));

    const match = getMatch(lane.matchId)!;
    const ownerSeat = decisionOwner(match.state);
    const historyLengthBefore = match.actionHistory.length;
    const versionBefore = match.version;
    const otherArenaSeat: ArenaSeatId = engineSeatFor(lane, "seatA") === ownerSeat ? "seatB" : "seatA";

    applyDisconnectAutoPass(arenaMatch.id, otherArenaSeat);

    const after = getMatch(lane.matchId)!;
    expect(after.actionHistory.length).toBe(historyLengthBefore);
    expect(after.version).toBe(versionBefore);
  });

  it("não faz nada se a Arena já terminou", () => {
    const arenaMatch = startFullArena();
    const lane = activeLaneForSeat(arenaMatch, "seatA")!;
    const versionBefore = getMatch(lane.matchId)!.version;
    arenaMatch.status = "FINISHED";

    expect(() => applyDisconnectAutoPass(arenaMatch.id, "seatA")).not.toThrow();
    expect(getMatch(lane.matchId)!.version).toBe(versionBefore);
  });

  it("não faz nada se o assento não tem lane ativa (já foi eliminado ou a Arena não existe)", () => {
    expect(() => applyDisconnectAutoPass("nao-existe", "seatA")).not.toThrow();

    const arenaMatch = startFullArena();
    arenaMatch.eliminated.add("seatA");
    arenaMatch.lanes.clear(); // sem lane ativa nenhuma pro seatA
    expect(() => applyDisconnectAutoPass(arenaMatch.id, "seatA")).not.toThrow();
  });

  it("não faz nada se a lane já terminou (gameOver)", () => {
    const arenaMatch = startFullArena();
    const lane = activeLaneForSeat(arenaMatch, "seatA")!;
    const match = getMatch(lane.matchId) as MatchRecord;
    // força o fim de jogo sem passar por applyAction — só quer testar o guard de `gameOver`.
    match.state = { ...match.state, gameOver: { winner: "A", reason: "resignation" } };
    const versionBefore = match.version;

    applyDisconnectAutoPass(arenaMatch.id, "seatA");

    expect(getMatch(lane.matchId)!.version).toBe(versionBefore);
  });
});
