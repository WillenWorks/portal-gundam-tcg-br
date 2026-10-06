import { describe, it, expect, vi } from "vitest";
import { captureSimulatorSnapshot } from "./captureSnapshot";
import type { PlayerId } from "@/modules/simulator/engine/types";
import type { ViewGameState } from "@/modules/simulator/engine/viewState";
import type { SimulatorMatchView } from "@/lib/api";

describe("captureSimulatorSnapshot", () => {
  it("monta snapshot com dados do jogo e bot", async () => {
    const mockView = {
      turnNumber: 4,
      phase: "main",
      activePlayer: "A" as PlayerId,
      players: {
        A: {
          counts: { shields: 5, deck: 40, hand: 4, trash: 2, exile: 0 },
          battleArea: [{ instanceId: "u1", def: { code: "ST01-001" }, rested: false }],
          resourceArea: [{ instanceId: "r1", rested: false }, { instanceId: "r2", rested: true }],
        },
        B: {
          counts: { shields: 3, deck: 38, hand: 5, trash: 3, exile: 0 },
          battleArea: [{ instanceId: "u2", def: { code: "ST02-001" }, rested: true }],
          resourceArea: [{ instanceId: "r3", rested: false }],
        },
      },
    } as unknown as ViewGameState;

    const mockMatchView: SimulatorMatchView = {
      matchId: "match-test-99",
      seat: "A",
      transport: "sse",
      turnDeadlineAt: null,
      lastSeenAt: { A: Date.now(), B: Date.now() },
      view: mockView,
      seats: {
        A: { userId: "user-1" },
        B: { userId: "bot-sim", bot: true },
      },
    } as unknown as SimulatorMatchView;

    const snapshot = await captureSimulatorSnapshot(null, {
      matchId: "match-test-99",
      seat: "A",
      opponentSeat: "B",
      matchView: mockMatchView,
      view: mockView,
      battleLog: [{ seq: 1, text: "Gundam atacou", kind: "combat" }],
    });

    expect(snapshot.matchId).toBe("match-test-99");
    expect(snapshot.turnNumber).toBe(4);
    expect(snapshot.phase).toBe("main");
    expect(snapshot.isAgainstBot).toBe(true);
    expect(snapshot.myShieldCount).toBe(5);
    expect(snapshot.oppShieldCount).toBe(3);
    expect(snapshot.myResourceCount.total).toBe(2);
    expect(snapshot.myResourceCount.active).toBe(1);
    expect(snapshot.myResourceCount.rested).toBe(1);
    expect(snapshot.myUnitsInPlay).toEqual(["ST01-001"]);
    expect(snapshot.oppUnitsInPlay).toEqual(["ST02-001"]);
    expect(snapshot.battleLogRecent).toEqual(["Gundam atacou"]);
  });
});
