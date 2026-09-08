import { afterEach, describe, expect, it } from "vitest";

import {
  _resetAllMatchesForTests,
  applyAction,
  createMatch,
  getMatch,
  joinMatch,
  resignMatch,
  decisionOwner,
  defaultActionFor,
  setMatchLogSink,
  type MatchLogDraft,
} from "./matchStore";
import { createTrainingMatch } from "./trainingMatch";
import { driveBotTurn } from "../../../../services/sim-bot/driveBotTurn.mjs";
import { buildSt01DeckList } from "../fixtures/st01Deck";
import { buildSt02DeckList } from "../fixtures/st02Deck";
import { computeSimulatorMetaStats } from "./matchStats";
import { createGame } from "../engine/setup";
import { advanceToMainPhase } from "../engine/phases";
import { applyPlayerAction, type PlayerAction } from "../engine/actions";
import { ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver } from "../content";

afterEach(() => {
  _resetAllMatchesForTests();
});

const USER_A = { userId: "user-a", displayName: "Jogador A" };
const USER_B = { userId: "user-b", displayName: "Jogador B" };

describe("Simulator Match Logging e Telemetria", () => {
  it("acumula histórico de ações em actionHistory e entrega ao matchLogSink no fim da partida", async () => {
    let capturedLog: MatchLogDraft | null = null;
    setMatchLogSink((draft) => {
      capturedLog = draft;
    });

    const match = createMatch({
      deckA: buildSt01DeckList(),
      deckB: buildSt02DeckList(),
      seed: 42,
      skipMulligan: true,
      mode: "ranked",
    });

    joinMatch(match.id, "A", USER_A);
    joinMatch(match.id, "B", USER_B);

    // Aplica uma ação qualquer (ex: passar a main phase / end phase)
    const passAction: PlayerAction = { kind: "finishTurn" };
    applyAction(match.id, USER_A.userId, passAction);

    expect(match.actionHistory).toHaveLength(1);
    expect(match.actionHistory[0]).toEqual(passAction);
    expect(capturedLog).toBeNull(); // partida ainda não terminou

    // Usuário B desiste -> fim de jogo
    resignMatch(match.id, USER_B.userId);

    expect(match.state.gameOver).not.toBeNull();
    expect(capturedLog).not.toBeNull();
    expect(capturedLog!.matchId).toBe(match.id);
    expect(capturedLog!.mode).toBe("ranked");
    expect(capturedLog!.winner).toBe("A");
    expect(capturedLog!.winReason).toBe("resignation");
    expect(capturedLog!.seed).toBe(42);
    expect(capturedLog!.actions).toHaveLength(1);
  });

  it("registra partidas de treino com mode 'training'", () => {
    let capturedLog: MatchLogDraft | null = null;
    setMatchLogSink((draft) => {
      capturedLog = draft;
    });

    const { matchId } = createTrainingMatch({
      deckId: "ST01",
      level: "normal",
      human: USER_A,
      seed: 123,
    });

    resignMatch(matchId, USER_A.userId);

    expect(capturedLog).not.toBeNull();
    expect(capturedLog!.mode).toBe("training");
    expect(capturedLog!.winner).toBe("B"); // O humano desistiu, bot venceu
  });

  it("garante replay determinístico das ações gravadas no log", () => {
    const seed = 999;
    const deckA = buildSt01DeckList();
    const deckB = buildSt02DeckList();

    const match = createMatch({
      deckA,
      deckB,
      seed,
      skipMulligan: true,
    });

    joinMatch(match.id, "A", USER_A);
    joinMatch(match.id, "B", USER_B);

    // Aplica passos de jogo usando defaultActionFor
    for (let step = 0; step < 4; step++) {
      const owner = decisionOwner(match.state);
      if (!owner) break;
      const user = owner === "A" ? USER_A : USER_B;
      applyAction(match.id, user.userId, defaultActionFor(match.state));
    }

    const recordedActions = [...match.actionHistory];
    expect(recordedActions.length).toBeGreaterThanOrEqual(2);

    // Replay do zero com mesmo seed e decks
    let replayedState = createGame(deckA, deckB, { seed, firstPlayer: "A" });
    replayedState = advanceToMainPhase(replayedState);

    for (const act of recordedActions) {
      const owner = decisionOwner(replayedState);
      if (!owner) break;
      replayedState = applyPlayerAction(
        replayedState,
        owner,
        act,
        ALL_EFFECT_SPECS,
        defaultPredicateResolver,
        defaultTargetFilterResolver,
      );
    }

    // Compara campos de estado relevantes
    expect(replayedState.turnNumber).toBe(match.state.turnNumber);
    expect(replayedState.activePlayer).toBe(match.state.activePlayer);
    expect(replayedState.players.A.shields).toHaveLength(match.state.players.A.shields.length);
  });

  it("computa estatísticas de metagame corretamente a partir dos logs", async () => {
    // Mock prisma client
    const mockLogs = [
      {
        id: "1",
        deckKeyA: "ST01",
        deckKeyB: "ST02",
        winner: "A",
        winReason: "noShieldsBattleDamage",
        turns: 12,
        durationMs: 450000,
      },
      {
        id: "2",
        deckKeyA: "ST01",
        deckKeyB: "ST02",
        winner: "B",
        winReason: "noShieldsBattleDamage",
        turns: 14,
        durationMs: 500000,
      },
      {
        id: "3",
        deckKeyA: "ST02",
        deckKeyB: "ST03",
        winner: "A",
        winReason: "deckOut",
        turns: 20,
        durationMs: 700000,
      },
    ];

    const mockPrisma = {
      simulatorMatchLog: {
        findMany: async () => mockLogs,
      },
    } as any;

    const stats = await computeSimulatorMetaStats(mockPrisma);

    expect(stats.totalMatches).toBe(3);
    expect(stats.firstPlayerWinrate).toBeCloseTo(2 / 3, 2); // 2 vitórias de A em 3 partidas
    expect(stats.avgTurns).toBeCloseTo((12 + 14 + 20) / 3, 1);
    expect(stats.winReasons.noShieldsBattleDamage).toBe(2);
    expect(stats.winReasons.deckOut).toBe(1);

    const st01 = stats.deckPerformance.find((d) => d.deckKey === "ST01");
    expect(st01).toBeDefined();
    expect(st01!.matches).toBe(2);
    expect(st01!.wins).toBe(1);
    expect(st01!.winrate).toBe(0.5);
  });

  it("permite ao jogador logado jogar partida solo de treino contra o bot com regras autoritativas", async () => {
    const { matchId } = createTrainingMatch({
      deckId: "ST01",
      level: "normal",
      human: USER_A,
      seed: 777,
    });

    const match = getMatch(matchId)!;
    expect(match).toBeDefined();
    expect(match.mode).toBe("training");
    expect(match.seats.A?.userId).toBe(USER_A.userId);
    expect(match.seats.B?.userId).toBe("sim-bot");
    expect(match.seats.B?.bot?.level).toBe("normal");

    // Ambos resolvem mulligan
    applyAction(matchId, USER_A.userId, { kind: "resolveMulligan", keep: true });

    // O bot resolve o mulligan dele usando driveBotTurn
    await driveBotTurn({
      initialState: match.state,
      seat: "B",
      level: "normal",
      seed: 123,
      commit: (action) => {
        applyAction(matchId, "sim-bot", action as never);
      },
    });

    // Partida avança para Main Phase do Turno 1
    expect(match.state.turnNumber).toBeGreaterThanOrEqual(1);

    // Humano passa o turno 1
    applyAction(matchId, USER_A.userId, { kind: "finishTurn" });

    // Bot joga o turno 2 dele via heurística autoritativa
    const actionsBefore = match.actionHistory.length;
    const botResult = await driveBotTurn({
      initialState: match.state,
      seat: "B",
      level: "normal",
      seed: 456,
      commit: (action) => {
        applyAction(matchId, "sim-bot", action as never);
      },
    });

    expect(botResult.actionsApplied).toBeGreaterThanOrEqual(1);
    expect(match.actionHistory.length).toBeGreaterThan(actionsBefore);
    expect(match.state.gameOver).toBeFalsy();
  });
});
