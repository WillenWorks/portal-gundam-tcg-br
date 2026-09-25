import { describe, expect, it, vi } from "vitest";
import type { CombatState, PendingDecision } from "../engine/types";
import {
  detectOpponentCommandCast,
  handleOpponentCommandCast,
  resolveCommandAnimationPoints,
  shouldAnimateAttackStrike,
  shouldWaitForBurstReveal,
  type Point2D,
} from "./viewAnimationQueue";

function combat(overrides: Partial<CombatState> & Pick<CombatState, "step" | "attackerId">): CombatState {
  return {
    attackingPlayer: "A",
    defendingPlayer: "B",
    originalTarget: "player",
    currentTarget: "player",
    actionPasses: { A: false, B: false },
    actionPriority: "B",
    ...overrides,
  };
}

describe("shouldAnimateAttackStrike", () => {
  it("não dispara sem combate anterior (nada a animar)", () => {
    expect(shouldAnimateAttackStrike(null, combat({ step: "action", attackerId: "u1" }))).toBe(false);
  });

  it("dispara quando o combate do mesmo atacante desapareceu (settleAutoPasses resolveu tudo síncrono)", () => {
    const prev = combat({ step: "attack", attackerId: "u1" });
    expect(shouldAnimateAttackStrike(prev, null)).toBe(true);
  });

  it("dispara quando o combate chegou em battleEnd, mesmo atacante", () => {
    const prev = combat({ step: "action", attackerId: "u1" });
    const incoming = combat({ step: "battleEnd", attackerId: "u1" });
    expect(shouldAnimateAttackStrike(prev, incoming)).toBe(true);
  });

  it("dispara quando um NOVO combate (atacante diferente) já começou no lugar", () => {
    const prev = combat({ step: "attack", attackerId: "u1" });
    const incoming = combat({ step: "attack", attackerId: "u2" });
    expect(shouldAnimateAttackStrike(prev, incoming)).toBe(true);
  });

  it("NÃO dispara enquanto o mesmo combate continua em andamento (attack/block/action)", () => {
    const prev = combat({ step: "attack", attackerId: "u1" });
    expect(shouldAnimateAttackStrike(prev, combat({ step: "block", attackerId: "u1" }))).toBe(false);
    expect(shouldAnimateAttackStrike(prev, combat({ step: "action", attackerId: "u1" }))).toBe(false);
    expect(shouldAnimateAttackStrike(prev, combat({ step: "damage", attackerId: "u1" }))).toBe(false);
  });
});

describe("shouldWaitForBurstReveal", () => {
  const burst = {
    kind: "burst",
    cardInstanceId: "shield-1",
    cardDef: { code: "ST01-000", nameEn: "Test", cardType: "UNIT" },
    choices: [],
    queuedInstanceIds: [],
  } as unknown as PendingDecision;

  it("não espera sem decisão pendente", () => {
    expect(shouldWaitForBurstReveal(undefined, null)).toBe(false);
  });

  it("não espera decisão de outro tipo", () => {
    expect(shouldWaitForBurstReveal({ kind: "mulligan" } as unknown as PendingDecision, null)).toBe(false);
  });

  it("não espera um Burst já revelado", () => {
    expect(shouldWaitForBurstReveal(burst, "shield-1")).toBe(false);
  });

  it("espera um Burst novo, ainda não revelado", () => {
    expect(shouldWaitForBurstReveal(burst, null)).toBe(true);
    expect(shouldWaitForBurstReveal(burst, "outro-shield")).toBe(true);
  });
});

describe("Opponent Command Cast Animation", () => {
  const commandCardDef = {
    code: "ST01-014",
    nameEn: "Overflag Maneuver",
    cardType: "COMMAND",
    color: "BLUE",
    cost: 2,
  };

  function makePlayer(id: "A" | "B"): any {
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

  function makeView(): any {
    return {
      phase: "main",
      round: 1,
      turnPlayer: "B",
      firstPlayer: "A",
      combat: null,
      pendingDecision: { A: null, B: null },
      winner: null,
      gameOver: false,
      players: {
        A: makePlayer("A"),
        B: makePlayer("B"),
      },
    };
  }

  it("detectOpponentCommandCast: detecta quando oponente (B) joga Comando da mão pro trash", () => {
    const prev = makeView();
    prev.players.B.hand = [{ hidden: true, instanceId: "cmd-1", owner: "B", zone: "hand" }];

    const incoming = makeView();
    incoming.players.B.hand = [];
    incoming.players.B.trash = [
      {
        instanceId: "cmd-1",
        owner: "B",
        controller: "B",
        zone: "trash",
        def: commandCardDef,
        damage: 0,
        rested: false,
        counterAttackBonus: 0,
      } as any,
    ];

    expect(detectOpponentCommandCast(prev as any, incoming as any, "A")).toEqual(commandCardDef);
  });

  it("detectOpponentCommandCast: ignora se o jogador local (A) foi quem jogou", () => {
    const prev = makeView();
    prev.players.A.hand = [{ instanceId: "cmd-1", owner: "A", zone: "hand", def: commandCardDef } as any];

    const incoming = makeView();
    incoming.players.A.hand = [];
    incoming.players.A.trash = [{ instanceId: "cmd-1", owner: "A", zone: "trash", def: commandCardDef } as any];

    expect(detectOpponentCommandCast(prev as any, incoming as any, "A")).toBeNull();
  });

  it("detectOpponentCommandCast: ignora se a carta não é do tipo COMMAND (ex: UNIT descartada)", () => {
    const prev = makeView();
    prev.players.B.hand = [{ hidden: true, instanceId: "unit-1", owner: "B", zone: "hand" }];

    const incoming = makeView();
    incoming.players.B.hand = [];
    incoming.players.B.trash = [
      {
        instanceId: "unit-1",
        owner: "B",
        controller: "B",
        zone: "trash",
        def: { ...commandCardDef, cardType: "UNIT" },
      } as any,
    ];

    expect(detectOpponentCommandCast(prev as any, incoming as any, "A")).toBeNull();
  });

  it("resolveCommandAnimationPoints: usa coordenadas reais quando disponíveis", () => {
    const board = {
      rectOf: (key: string) => {
        if (key === "hand:opponent") return { left: 100, top: 40, width: 200, height: 60 } as DOMRect;
        if (key === "trashStation:B") return { left: 600, top: 300, width: 80, height: 100 } as DOMRect;
        return null;
      },
    };

    const points = resolveCommandAnimationPoints(board, "B", { x: 400, y: 300 });
    expect(points.origin).toEqual({ x: 200, y: 70 });
    expect(points.dest).toEqual({ x: 640, y: 350 });
  });

  it("resolveCommandAnimationPoints: recorre ao fallback seguro pro centro se rect for nulo ou zero (não nasce em 0,0)", () => {
    const board = {
      rectOf: () => null,
    };

    const points = resolveCommandAnimationPoints(board, "B", { x: 450, y: 350 });
    expect(points.origin).toEqual({ x: 450, y: 350 });
    expect(points.dest).toEqual({ x: 450, y: 350 });
  });

  it("view chega com Comando do oponente jogado → animação dispara com origin/dest corretos → efeito só aparece resolvido na view após o onDone", async () => {
    const prev = makeView();
    prev.players.B.hand = [{ hidden: true, instanceId: "cmd-1", owner: "B", zone: "hand" }];

    const incoming = makeView();
    incoming.players.B.hand = [];
    incoming.players.B.trash = [
      {
        instanceId: "cmd-1",
        owner: "B",
        controller: "B",
        zone: "trash",
        def: commandCardDef,
      } as any,
    ];

    let animationFinished = false;
    let viewApplied = false;
    let capturedOrigin: Point2D | null = null;
    let capturedDest: Point2D | null = null;
    let capturedCardDef: any = null;

    let resolveAnimation: () => void = () => {};
    const animateCommand = vi.fn(async ({ cardDef, origin, dest }) => {
      capturedCardDef = cardDef;
      capturedOrigin = origin;
      capturedDest = dest;
      await new Promise<void>((resolve) => {
        resolveAnimation = () => {
          animationFinished = true;
          resolve();
        };
      });
    });

    const applyView = vi.fn(() => {
      viewApplied = true;
    });

    const board = {
      rectOf: (key: string) => {
        if (key === "hand:opponent") return { left: 100, top: 50, width: 100, height: 50 } as DOMRect;
        if (key === "trashStation:B") return { left: 500, top: 200, width: 60, height: 80 } as DOMRect;
        return null;
      },
    };

    const promise = (async () => {
      await handleOpponentCommandCast({
        prevView: prev as any,
        incomingView: incoming as any,
        viewerSeat: "A",
        board,
        fallbackCenter: { x: 400, y: 300 },
        animateCommand,
      });
      applyView();
    })();

    // 1. Antes do onDone: animação disparou com origin/dest corretos, mas a view AINDA NÃO foi aplicada
    expect(animateCommand).toHaveBeenCalledTimes(1);
    expect(capturedCardDef).toEqual(commandCardDef);
    expect(capturedOrigin).toEqual({ x: 150, y: 75 });
    expect(capturedDest).toEqual({ x: 530, y: 240 });
    expect(animationFinished).toBe(false);
    expect(viewApplied).toBe(false);

    // 2. Dispara onDone da animação
    resolveAnimation();
    await promise;

    // 3. Após o onDone: view com o efeito resolvido foi aplicada
    expect(animationFinished).toBe(true);
    expect(viewApplied).toBe(true);
  });
});
