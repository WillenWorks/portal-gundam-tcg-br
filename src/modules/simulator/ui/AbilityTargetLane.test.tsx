// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { AbilityTargetLane } from "./AbilityTargetLane";

const rect = (x: number, y: number) => ({ left: x, top: y, width: 40, height: 60, right: x + 40, bottom: y + 60, x, y, toJSON: () => ({}) }) as DOMRect;

describe("AbilityTargetLane", () => {
  afterEach(cleanup);

  it("desenha uma linha por alvo medido, a partir da carta de origem", () => {
    const rects: Record<string, DOMRect> = { src: rect(100, 100), t1: rect(400, 100), t2: rect(400, 300) };
    const { container } = render(
      <AbilityTargetLane sourceId="src" targets={[{ id: "t1", pool: "enemy" }, { id: "t2", pool: "ally" }]} rectOf={(k) => rects[k] ?? null} />,
    );
    expect(screen.getByTestId("ability-target-lane")).toBeInTheDocument();
    // 2 linhas (glow + tracejada) por alvo
    expect(container.querySelectorAll("line")).toHaveLength(4);
  });

  it("não desenha nada sem a carta de origem ou sem alvo medido na mesa", () => {
    render(<AbilityTargetLane sourceId="sumiu" targets={[{ id: "t1", pool: "enemy" }]} rectOf={() => null} />);
    expect(screen.queryByTestId("ability-target-lane")).toBeNull();
  });
});
