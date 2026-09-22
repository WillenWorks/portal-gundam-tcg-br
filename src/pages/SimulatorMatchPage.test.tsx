import { describe, expect, it, vi } from "vitest";
import {
  detectOpponentCommandCast,
  handleOpponentCommandCast,
  resolveCommandAnimationPoints,
  type Point2D,
} from "../modules/simulator/ui/viewAnimationQueue";
import type { CardDef, CardInstance } from "../modules/simulator/engine/types";
import type { ViewGameState, ViewPlayerState } from "../modules/simulator/engine/viewState";

describe("SimulatorMatchPage — Animação de Comando do Oponente / Bot", () => {
  const commandDef: CardDef = {
    code: "ST01-014",
    nameEn: "Overflag Maneuver",
    cardType: "COMMAND",
    color: "BLUE",
    cost: 2,
  };

  function createPlayer(id: "A" | "B"): ViewPlayerState {
    return {
      id,
      deck: [],
      resourceDeck: [],
      shields: [],
      resourceArea: [],
      battleArea: [],
      baseSection: [],
      trash: [],
      exile: [],
      hand: [],
      counts: {
        deck: 0,
        resourceDeck: 0,
        shields: 0,
        resourceArea: 0,
        battleArea: 0,
        baseSection: 0,
        trash: 0,
        exile: 0,
        hand: 0,
      },
    };
  }

  function createView(overrides?: Partial<ViewGameState>): ViewGameState {
    return {
      turnNumber: 1,
      activePlayer: "B",
      phase: "main",
      combat: null,
      endPhaseAction: null,
      pendingDecision: { A: null, B: null },
      winner: null,
      gameOver: null,
      players: {
        A: createPlayer("A"),
        B: createPlayer("B"),
      },
      ...overrides,
    } as ViewGameState;
  }

  it("detecta Comando jogado pelo oponente via diff de mão para trash", () => {
    const prev = createView();
    prev.players.B.hand = [{ hidden: true, instanceId: "cmd-b-1", owner: "B", zone: "hand" }];

    const incoming = createView();
    incoming.players.B.hand = [];
    incoming.players.B.trash = [
      {
        instanceId: "cmd-b-1",
        owner: "B",
        controller: "B",
        zone: "trash",
        def: commandDef,
        damage: 0,
        rested: false,
        counterAttackBonus: 0,
      } as unknown as CardInstance,
    ];

    const detected = detectOpponentCommandCast(prev, incoming, "A");
    expect(detected).toEqual(commandDef);
  });

  it("calcula origin e dest usando board.rectOf ou fallback seguro", () => {
    const boardWithRects = {
      rectOf: (key: string) => {
        if (key === "hand:opponent") return { left: 120, top: 40, width: 160, height: 60 } as DOMRect;
        if (key === "trashStation:B") return { left: 550, top: 220, width: 70, height: 90 } as DOMRect;
        return null;
      },
    };

    const points = resolveCommandAnimationPoints(boardWithRects, "B", { x: 400, y: 300 });
    expect(points.origin).toEqual({ x: 200, y: 70 });
    expect(points.dest).toEqual({ x: 585, y: 265 });

    // Fallback quando elementos não têm rect (não nasce em 0,0)
    const emptyBoard = { rectOf: () => null };
    const fallbackPoints = resolveCommandAnimationPoints(emptyBoard, "B", { x: 400, y: 300 });
    expect(fallbackPoints.origin).toEqual({ x: 400, y: 300 });
    expect(fallbackPoints.dest).toEqual({ x: 400, y: 300 });
  });

  it("view chega com Comando do oponente jogado → animação dispara com origin/dest corretos → efeito só aparece resolvido na view após o onDone", async () => {
    const prev = createView();
    prev.players.B.hand = [{ hidden: true, instanceId: "cmd-b-1", owner: "B", zone: "hand" }];

    // incoming tem o efeito resolvido (ex: comando no trash, efeito aplicado)
    const incoming = createView();
    incoming.players.B.hand = [];
    incoming.players.B.trash = [
      {
        instanceId: "cmd-b-1",
        owner: "B",
        controller: "B",
        zone: "trash",
        def: commandDef,
      } as unknown as CardInstance,
    ];

    let animationFinished = false;
    let viewApplied = false;
    let capturedParams: { cardDef: CardDef; origin: Point2D; dest: Point2D } | null = null;
    let triggerOnDone: () => void = () => {};

    const animateCommand = vi.fn(async (params: { cardDef: CardDef; origin: Point2D; dest: Point2D }) => {
      capturedParams = params;
      await new Promise<void>((resolve) => {
        triggerOnDone = () => {
          animationFinished = true;
          resolve();
        };
      });
    });

    const applyMatchView = vi.fn(() => {
      viewApplied = true;
    });

    const board = {
      rectOf: (key: string) => {
        if (key === "hand:opponent") return { left: 100, top: 40, width: 100, height: 40 } as DOMRect;
        if (key === "trashStation:B") return { left: 500, top: 200, width: 80, height: 100 } as DOMRect;
        return null;
      },
    };

    const processPipelinePromise = (async () => {
      await handleOpponentCommandCast({
        prevView: prev,
        incomingView: incoming,
        viewerSeat: "A",
        board,
        fallbackCenter: { x: 300, y: 200 },
        animateCommand,
      });
      applyMatchView();
    })();

    // 1. Animação disparou com dados corretos
    expect(animateCommand).toHaveBeenCalledTimes(1);
    expect(capturedParams).toBeDefined();
    expect(capturedParams!.cardDef).toEqual(commandDef);
    expect(capturedParams!.origin).toEqual({ x: 150, y: 60 });
    expect(capturedParams!.dest).toEqual({ x: 540, y: 250 });

    // 2. Antes do onDone: efeito AINDA NÃO foi aplicado na view
    expect(animationFinished).toBe(false);
    expect(viewApplied).toBe(false);

    // 3. Executa onDone
    triggerOnDone();
    await processPipelinePromise;

    // 4. Depois do onDone: efeito aparece resolvido na view
    expect(animationFinished).toBe(true);
    expect(viewApplied).toBe(true);
  });
});
