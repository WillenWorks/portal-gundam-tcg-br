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
  getArenaMatch,
  joinLobby,
  notifyMatchMaybeArenaLane,
  startArenaMatch,
  type ArenaLane,
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

// ---------------------------------------------------------------------------
// Bracket: rodada 1 -> desempate (2v2) / final (FFA) -> fim da Arena.
//
// Não joga a partida de verdade (o motor de regras já é coberto à exaustão em
// engine/*.test.ts, gundam:fuzz e gundam:golden) — só força o `gameOver` de
// cada lane (mesmo padrão do teste "não faz nada se a lane já terminou" acima)
// e verifica que `notifyMatchMaybeArenaLane` (chamado pela camada de socket em
// produção, server/simulatorSocket4p.ts:162) evolui o bracket corretamente.
// Cobre o item "QA E2E: resolução completa até o fim de uma lane (bracket,
// desempate, final)" que RESULTADO-QA-WAVE2-ARENA4P.md deixou como não
// testado — Sprint 2 (docs/debates 2026-09-18).
// ---------------------------------------------------------------------------
describe("bracket da Arena 4P — avanço rodada 1 -> desempate/final -> fim", () => {
  function startFullArenaMode(mode: "2v2" | "ffa"): ArenaMatchRecord {
    const lobby = createLobby(mode, { userId: "u-A", displayName: "Piloto A", deckKey: "ST01" });
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

  /** Força a lane a terminar com `winningSeat` vencedor e propaga pro bracket da Arena
   *  (mesmo hook que `server/simulatorSocket4p.ts` chama em produção). */
  function forceLaneWin(lane: ArenaLane, winningSeat: ArenaSeatId): void {
    const match = getMatch(lane.matchId) as MatchRecord;
    const winnerEngineSeat = engineSeatFor(lane, winningSeat);
    match.state = { ...match.state, gameOver: { winner: winnerEngineSeat, reason: "resignation" } };
    notifyMatchMaybeArenaLane(lane.matchId);
  }

  it("2v2: mesmo time vence as 2 lanes da rodada 1 -> termina a Arena direto, sem lane de desempate", () => {
    const arenaMatch = startFullArenaMode("2v2");
    // Times: team1 = [seatA, seatC], team2 = [seatB, seatD].
    const laneAB = activeLaneForSeat(arenaMatch, "seatA")!;
    const laneCD = activeLaneForSeat(arenaMatch, "seatC")!;

    forceLaneWin(laneAB, "seatA");
    let after = getArenaMatch(arenaMatch.id)!;
    expect(after.status).toBe("ACTIVE"); // só 1 das 2 lanes da rodada 1 terminou
    expect(after.eliminated.has("seatB")).toBe(true);
    expect([...after.lanes.values()].filter((l) => l.status === "active")).toHaveLength(1);

    forceLaneWin(laneCD, "seatC"); // seatC também é team1 -> 2-0 pro time 1
    after = getArenaMatch(arenaMatch.id)!;
    expect(after.status).toBe("FINISHED");
    expect(after.winner).toEqual({ kind: "team", team: 1 });
    // 2-0 não precisa de desempate: só as 2 lanes da rodada 1 existiram.
    expect(after.lanes.size).toBe(2);
  });

  it("2v2: times empatam 1-1 -> spawna lane de desempate; quem vencer decide o time campeão", () => {
    const arenaMatch = startFullArenaMode("2v2");
    const laneAB = activeLaneForSeat(arenaMatch, "seatA")!;
    const laneCD = activeLaneForSeat(arenaMatch, "seatC")!;

    forceLaneWin(laneAB, "seatA"); // team1
    forceLaneWin(laneCD, "seatD"); // team2 -> 1-1

    let after = getArenaMatch(arenaMatch.id)!;
    expect(after.status).toBe("ACTIVE");
    expect(after.lanes.size).toBe(3); // rodada 1 (2) + desempate (1)
    const tiebreak = [...after.lanes.values()].find((l) => l.kind === "team_tiebreak");
    expect(tiebreak).toBeDefined();
    expect(tiebreak!.status).toBe("active");
    expect([tiebreak!.engineSeatOf.A, tiebreak!.engineSeatOf.B].sort()).toEqual(["seatA", "seatD"]);

    forceLaneWin(tiebreak!, "seatD"); // team2 vence o desempate
    after = getArenaMatch(arenaMatch.id)!;
    expect(after.status).toBe("FINISHED");
    expect(after.winner).toEqual({ kind: "team", team: 2 });
  });

  it("ffa: os 2 vencedores da rodada 1 se enfrentam na lane final; vencedor é o campeão", () => {
    const arenaMatch = startFullArenaMode("ffa");
    const laneR1a = activeLaneForSeat(arenaMatch, "seatA")!;
    const laneR1b = activeLaneForSeat(arenaMatch, "seatC")!;
    expect(laneR1a.kind).toBe("ffa_r1");

    forceLaneWin(laneR1a, "seatB");
    forceLaneWin(laneR1b, "seatC");

    let after = getArenaMatch(arenaMatch.id)!;
    expect(after.status).toBe("ACTIVE");
    const final = [...after.lanes.values()].find((l) => l.kind === "ffa_final");
    expect(final).toBeDefined();
    expect([final!.engineSeatOf.A, final!.engineSeatOf.B].sort()).toEqual(["seatB", "seatC"]);
    // 3º/4º lugar (perdedores da rodada 1) já ficam eliminados, sem lane própria.
    expect(after.eliminated.has("seatA")).toBe(true);
    expect(after.eliminated.has("seatD")).toBe(true);

    forceLaneWin(final!, "seatC");
    after = getArenaMatch(arenaMatch.id)!;
    expect(after.status).toBe("FINISHED");
    expect(after.winner).toEqual({ kind: "seat", seat: "seatC" });
  });

  it("notifyMatchMaybeArenaLane é no-op pra matchId que não pertence a nenhuma Arena", () => {
    expect(() => notifyMatchMaybeArenaLane("nao-existe")).not.toThrow();
  });
});
