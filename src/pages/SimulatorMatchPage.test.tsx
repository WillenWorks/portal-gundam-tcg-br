import { describe, expect, it, vi } from "vitest";
import {
  detectOpponentCommandCast,
  handleOpponentCommandCast,
  resolveCommandAnimationPoints,
  type Point2D,
} from "../modules/simulator/ui/viewAnimationQueue";
import type { CardDef, CardInstance } from "../modules/simulator/engine/types";
import type { ViewGameState, ViewPlayerState } from "../modules/simulator/engine/viewState";
import { buildTurnStagedViews, buildTurn1StagedViews, endOfTurnBanners } from "./SimulatorMatchPage";

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

  describe("endOfTurnBanners — virada de turno (Action Step da End Phase já encerrado)", () => {
    it("FASE DE AÇÕES já anunciada (view anterior na End Phase) → só FIM DE TURNO", () => {
      const prev = createView({ phase: "end", endPhaseAction: { passes: { A: false, B: true }, priority: "A" } });
      expect(endOfTurnBanners(prev)).toEqual(["FIM DE TURNO"]);
    });

    it("End Phase resolvida inteira no servidor (auto-pass dos dois) → FASE DE AÇÕES e FIM DE TURNO", () => {
      const prev = createView({ phase: "main" });
      expect(endOfTurnBanners(prev)).toEqual(["FASE DE AÇÕES", "FIM DE TURNO"]);
    });

    it("Hand Step pendente (endPhaseAction já null, phase ainda end) → só FIM DE TURNO", () => {
      const prev = createView({ phase: "end", endPhaseAction: null });
      expect(endOfTurnBanners(prev)).toEqual(["FIM DE TURNO"]);
    });
  });

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

describe("SimulatorMatchPage — Fases de Turno e Sincronização de Draw e Recuperação", () => {
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
      turnNumber: 2,
      activePlayer: "A",
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

  it(
    "buildTurnStagedViews segura rests até viewRecovery e draw até viewDraw (Turno do Player)",
    () => {

    const restedUnit: CardInstance = {
      instanceId: "u-1",
      owner: "A",
      controller: "A",
      zone: "battleArea",
      rested: true,
      damage: 0,
      statModifiers: [],
      keywordGrants: [],
      usedKeywordsThisTurn: [],
      enteredZoneOnTurn: 1,
      def: {
        code: "ST01-001",
        nameEn: "Gundam",
        cardType: "UNIT",
        color: "blue",
        cost: 2,
        level: 1,
        ap: 3,
        hp: 3,
      },
    };

    const prevView = createView({
      turnNumber: 1,
      activePlayer: "B",
    });
    // Jogador A tinha a unidade virada/rested no turno anterior e 4 cartas na mão
    prevView.players.A.battleArea = [restedUnit];
    prevView.players.A.hand = [
      { instanceId: "h1", owner: "A", zone: "hand" } as CardInstance,
      { instanceId: "h2", owner: "A", zone: "hand" } as CardInstance,
      { instanceId: "h3", owner: "A", zone: "hand" } as CardInstance,
      { instanceId: "h4", owner: "A", zone: "hand" } as CardInstance,
    ];
    prevView.players.A.counts.hand = 4;
    prevView.players.A.counts.deck = 40;

    // IncomingView (motor processou recuperação + compra + recursos + main):
    const incomingGameState = createView({
      turnNumber: 2,
      activePlayer: "A",
      phase: "main",
    });
    // No motor, unidade já estaria destombada:
    incomingGameState.players.A.battleArea = [{ ...restedUnit, rested: false }];
    // Mão recebeu 5ª carta (draw):
    incomingGameState.players.A.hand = [
      ...prevView.players.A.hand,
      { instanceId: "h5", owner: "A", zone: "hand" } as CardInstance,
    ];
    incomingGameState.players.A.counts.hand = 5;
    incomingGameState.players.A.counts.deck = 39;

    const incomingMatchView = {
      seat: "A" as const,
      perspective: "A" as const,
      view: incomingGameState,
    };

    const staged = buildTurnStagedViews(prevView, incomingMatchView);

    // 1. viewAnnounced ("SEU TURNO"):
    // - Unidade AINDA VIRADA (rested = true)
    // - Mão AINDA com 4 cartas (draw NÃO aconteceu)
    // - Deck AINDA com 40 cartas
    const announcedP = staged.viewAnnounced.view.players.A;
    expect(staged.viewAnnounced.view.phase).toBe("start");
    expect((announcedP.battleArea[0] as CardInstance).rested).toBe(true);
    expect(announcedP.hand.length).toBe(4);
    expect(announcedP.counts.hand).toBe(4);
    expect(announcedP.counts.deck).toBe(40);

    // 2. viewRecovery ("FASE DE RECUPERAÇÃO"):
    // - Unidade DESVIRA (rested = false)
    // - Mão AINDA com 4 cartas (draw continua NÃO acontecendo)
    // - Deck AINDA com 40 cartas
    const recoveryP = staged.viewRecovery.view.players.A;
    expect(staged.viewRecovery.view.phase).toBe("start");
    expect((recoveryP.battleArea[0] as CardInstance).rested).toBe(false);
    expect(recoveryP.hand.length).toBe(4);
    expect(recoveryP.counts.hand).toBe(4);
    expect(recoveryP.counts.deck).toBe(40);

    // 3. viewDraw ("FASE DE COMPRA"):
    // - Unidade permanece desvirada
    // - Mão agora tem 5 cartas (draw aconteceu!)
    // - Deck agora tem 39 cartas
    const drawP = staged.viewDraw.view.players.A;
    expect(staged.viewDraw.view.phase).toBe("draw");
    expect((drawP.battleArea[0] as CardInstance).rested).toBe(false);
    expect(drawP.hand.length).toBe(5);
    expect(drawP.counts.hand).toBe(5);
    expect(drawP.counts.deck).toBe(39);

    // 4. viewMain ("FASE PRINCIPAL"):
    // - Fase = "main"
    expect(staged.viewMain.view.phase).toBe("main");
  }, 15000);

  it(
    "buildTurnStagedViews segura rests e draw do oponente/bot quando for o turno dele",
    () => {

    const oppRestedUnit: CardInstance = {
      instanceId: "u-bot-1",
      owner: "B",
      controller: "B",
      zone: "battleArea",
      rested: true,
      damage: 0,
      statModifiers: [],
      keywordGrants: [],
      usedKeywordsThisTurn: [],
      enteredZoneOnTurn: 1,
      def: {
        code: "ST01-002",
        nameEn: "Guncannon",
        cardType: "UNIT",
        color: "blue",
        cost: 2,
        level: 1,
        ap: 2,
        hp: 4,
      },
    };

    const prevView = createView({
      turnNumber: 2,
      activePlayer: "A",
    });
    // Oponente B tinha a unidade virada e 3 cartas ocultas na mão
    prevView.players.B.battleArea = [oppRestedUnit];
    prevView.players.B.hand = [
      { hidden: true, instanceId: "bh1", owner: "B", zone: "hand" },
      { hidden: true, instanceId: "bh2", owner: "B", zone: "hand" },
      { hidden: true, instanceId: "bh3", owner: "B", zone: "hand" },
    ];
    prevView.players.B.counts.hand = 3;
    prevView.players.B.counts.deck = 42;

    // Turno passa para o bot (B):
    const incomingGameState = createView({
      turnNumber: 3,
      activePlayer: "B",
      phase: "main",
    });
    incomingGameState.players.B.battleArea = [{ ...oppRestedUnit, rested: false }];
    incomingGameState.players.B.hand = [
      ...prevView.players.B.hand,
      { hidden: true, instanceId: "bh4", owner: "B", zone: "hand" },
    ];
    incomingGameState.players.B.counts.hand = 4;
    incomingGameState.players.B.counts.deck = 41;

    const incomingMatchView = {
      seat: "A" as const, // Viewer é o player humano A
      perspective: "A" as const,
      view: incomingGameState,
    };

    const staged = buildTurnStagedViews(prevView, incomingMatchView);

    // 1. viewAnnounced ("TURNO DO OPONENTE"):
    const announcedB = staged.viewAnnounced.view.players.B;
    expect((announcedB.battleArea[0] as CardInstance).rested).toBe(true);
    expect(announcedB.hand.length).toBe(3);
    expect(announcedB.counts.hand).toBe(3);
    expect(announcedB.counts.deck).toBe(42);

    // 2. viewRecovery ("FASE DE RECUPERAÇÃO"):
    const recoveryB = staged.viewRecovery.view.players.B;
    expect((recoveryB.battleArea[0] as CardInstance).rested).toBe(false);
    expect(recoveryB.hand.length).toBe(3);
    expect(recoveryB.counts.hand).toBe(3);

    // 3. viewDraw ("FASE DE COMPRA"):
    const drawB = staged.viewDraw.view.players.B;
    expect(drawB.hand.length).toBe(4);
    expect(drawB.counts.hand).toBe(4);
    expect(drawB.counts.deck).toBe(41);
  }, 15000);

  it(
    "buildTurn1StagedViews segura o draw da 6ª carta até a fase de compra no Turno 1",
    () => {

    const currentGameState = createView({
      turnNumber: 1,
      activePlayer: "A",
      phase: "main",
    });
    // No backend, após criar jogo e shields, jogador 1 já recebeu 6 cartas (5 da mão inicial + 1 do draw)
    currentGameState.players.A.hand = [
      { instanceId: "c1", owner: "A", zone: "hand" } as CardInstance,
      { instanceId: "c2", owner: "A", zone: "hand" } as CardInstance,
      { instanceId: "c3", owner: "A", zone: "hand" } as CardInstance,
      { instanceId: "c4", owner: "A", zone: "hand" } as CardInstance,
      { instanceId: "c5", owner: "A", zone: "hand" } as CardInstance,
      { instanceId: "c6", owner: "A", zone: "hand" } as CardInstance,
    ];
    currentGameState.players.A.counts.hand = 6;
    currentGameState.players.A.counts.deck = 44;

    const currentMatchView = {
      seat: "A" as const,
      perspective: "A" as const,
      view: currentGameState,
    };

    const staged = buildTurn1StagedViews(currentMatchView);

    // 1. viewAnnounced ("SEU TURNO"):
    // - Mão limitada a 5 cartas
    // - Deck reflete 45 cartas (+1 que ainda não foi comprada visualmente)
    expect(staged.viewAnnounced.view.players.A.hand.length).toBe(5);
    expect(staged.viewAnnounced.view.players.A.counts.hand).toBe(5);
    expect(staged.viewAnnounced.view.players.A.counts.deck).toBe(45);

    // 2. viewRecovery ("FASE DE RECUPERAÇÃO"):
    // - Permanece com 5 cartas
    expect(staged.viewRecovery.view.players.A.hand.length).toBe(5);

    // 3. viewDraw ("FASE DE COMPRA"):
    // - Recebe a 6ª carta
    expect(staged.viewDraw.view.players.A.hand.length).toBe(6);
    expect(staged.viewDraw.view.phase).toBe("draw");
  }, 15000);
});


