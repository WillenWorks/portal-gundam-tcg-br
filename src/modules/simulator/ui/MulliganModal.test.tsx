// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MulliganModal } from "./MulliganModal";
import { buildSt01DeckList } from "../fixtures/st01Deck";
import type { CardInstance } from "../engine/types";

afterEach(cleanup);

const hand = buildSt01DeckList()
  .main.slice(0, 5)
  .map((def, i) => ({ instanceId: `A-${i}`, def, owner: "A", zone: "hand", rested: false, damage: 0 }) as unknown as CardInstance);

describe("MulliganModal — as cartas cabem na caixa em qualquer display", () => {
  it("5 colunas iguais que encolhem; o teto é o tamanho da carta na mão", () => {
    render(<MulliganModal hand={hand} art={{}} cardW={83} onResolve={vi.fn()} />);
    const grid = screen.getByTestId("mulligan-hand");
    expect(grid.style.gridTemplateColumns).toBe("repeat(5, minmax(0, 1fr))");
    expect(grid.style.maxWidth).toBe(`${5 * 83 + 4 * 6}px`);
    expect(grid.children).toHaveLength(5);
    for (const card of Array.from(grid.children)) expect((card as HTMLElement).style.width).toBe("100%");
  });
});
