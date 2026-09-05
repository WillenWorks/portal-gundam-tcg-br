// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render } from "@testing-library/react";
import type { CombatState } from "@/modules/simulator/engine/types";
import { CombatLane } from "./CombatLane";
import { playerAreaKey, playerShieldKey } from "./useBoardElements";

afterEach(cleanup);

function combat(over: Partial<CombatState> = {}): CombatState {
  return {
    step: "attack",
    attackerId: "atk-1",
    attackingPlayer: "A",
    defendingPlayer: "B",
    originalTarget: "player",
    currentTarget: "player",
    actionPasses: { A: false, B: false },
    actionPriority: "B",
    ...over,
  } as CombatState;
}

function rect(x: number, y: number): DOMRect {
  return { width: 20, height: 20, top: y, left: x, right: x + 20, bottom: y + 20, x, y, toJSON: () => ({}) } as DOMRect;
}

describe("CombatLane — mira (Frente 4, docs/38 §3.4)", () => {
  it("ataque no jogador mira a coluna Base/Escudos (lateral esquerda), não o centro da Battle Area", () => {
    const seen: string[] = [];
    const rectOf = vi.fn((key: string) => {
      seen.push(key);
      if (key === "atk-1") return rect(500, 400);
      if (key === playerShieldKey("B")) return rect(40, 120);
      return null;
    });

    render(<CombatLane combat={combat()} attacker={null} targetUnit={null} viewerSeat="A" rectOf={rectOf} />);

    expect(seen).toContain(playerShieldKey("B"));
    expect(seen).not.toContain(playerAreaKey("B"));
  });

  it("cai pra Battle Area quando a coluna Base/Escudos ainda não foi registrada", () => {
    const seen: string[] = [];
    const rectOf = vi.fn((key: string) => {
      seen.push(key);
      if (key === "atk-1") return rect(500, 400);
      if (key === playerAreaKey("B")) return rect(300, 200);
      return null; // shield key não registrado
    });

    render(<CombatLane combat={combat()} attacker={null} targetUnit={null} viewerSeat="A" rectOf={rectOf} />);

    expect(seen).toContain(playerShieldKey("B"));
    expect(seen).toContain(playerAreaKey("B"));
  });

  it("ataque numa Unit mira o instanceId da Unit", () => {
    const seen: string[] = [];
    const rectOf = vi.fn((key: string) => {
      seen.push(key);
      return key === "atk-1" || key === "unit-9" ? rect(100, 100) : null;
    });

    render(
      <CombatLane
        combat={combat({ currentTarget: { unitId: "unit-9" } })}
        attacker={null}
        targetUnit={null}
        viewerSeat="A"
        rectOf={rectOf}
      />,
    );

    expect(seen).toContain("unit-9");
    expect(seen).not.toContain(playerShieldKey("B"));
  });
});
