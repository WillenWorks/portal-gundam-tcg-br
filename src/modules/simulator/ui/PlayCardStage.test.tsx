// @vitest-environment jsdom
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { PlayCardStage, type PlayStage } from "./PlayCardStage";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const base: PlayStage = {
  key: 1,
  instanceId: "u1",
  card: { def: { code: "ST01-001", nameEn: "Gundam", cardType: "UNIT" } },
  phase: "rise",
  from: { x: 100, y: 800 },
  fromW: 60,
  hold: { x: 640, y: 400 },
  holdW: 200,
};

const box = () => screen.getByTestId("play-card-stage").firstElementChild as HTMLElement;

describe("PlayCardStage — a carta jogada da mão", () => {
  it("sai da mão no tamanho dela e sobe à mostra", () => {
    vi.useFakeTimers();
    render(<PlayCardStage stage={base} />);
    expect(box().style.width).toBe("60px");
    act(() => vi.advanceTimersByTime(40));
    expect(box().style.width).toBe("200px");
  });

  it("cai na vaga exata, no tamanho da vaga; a Command some usada", () => {
    vi.useFakeTimers();
    const { rerender } = render(<PlayCardStage stage={base} />);
    act(() => vi.advanceTimersByTime(40));
    rerender(<PlayCardStage stage={{ ...base, phase: "drop", target: { x: 300, y: 500 }, targetW: 80 }} />);
    expect(screen.getByTestId("play-card-stage")).toHaveAttribute("data-phase", "drop");
    expect(box().style.width).toBe("80px");
    expect(box().style.left).toBe(`${300 - 40}px`);
    rerender(<PlayCardStage stage={{ ...base, phase: "used" }} />);
    expect(box().style.opacity).toBe("0");
  });
});
