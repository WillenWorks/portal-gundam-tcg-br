// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { DeckDealAnimation } from "./DeckDealAnimation";

/** avança timers dentro de `act` pra o React flushar os setState. */
function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function mockMatchMedia(reduced: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((q: string) => ({
      matches: reduced,
      media: q,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

describe("DeckDealAnimation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("shuffle: aplica a classe de embaralhamento e chama onDone ao fim", () => {
    mockMatchMedia(false);
    const onDone = vi.fn();
    const { container } = render(<DeckDealAnimation mode="shuffle" onDone={onDone} label="Embaralhando…" />);
    expect(container.querySelector(".sim-anim-shuffle")).not.toBeNull();
    expect(screen.getByText("Embaralhando…")).toBeInTheDocument();
    expect(onDone).not.toHaveBeenCalled();
    advance(1400);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("deal-hand: 5 cartas viajando com a classe de deal", () => {
    mockMatchMedia(false);
    const onDone = vi.fn();
    const { container } = render(<DeckDealAnimation mode="deal-hand" onDone={onDone} />);
    expect(container.querySelectorAll(".sim-anim-deal")).toHaveLength(5);
    advance(1200);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("deal-shields: 6 cartas", () => {
    mockMatchMedia(false);
    const { container } = render(<DeckDealAnimation mode="deal-shields" onDone={vi.fn()} />);
    expect(container.querySelectorAll(".sim-anim-deal")).toHaveLength(6);
  });

  it("mulligan: passa por return → shuffle → deal e termina", () => {
    mockMatchMedia(false);
    const onDone = vi.fn();
    const { container } = render(<DeckDealAnimation mode="mulligan" onDone={onDone} />);
    expect(container.querySelectorAll(".sim-anim-return")).toHaveLength(5);
    advance(360);
    expect(container.querySelector(".sim-anim-shuffle")).not.toBeNull();
    advance(1300);
    expect(container.querySelectorAll(".sim-anim-deal")).toHaveLength(5);
    advance(1500);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("prefers-reduced-motion: sem animação, onDone quase imediato", () => {
    mockMatchMedia(true);
    const onDone = vi.fn();
    const { container } = render(<DeckDealAnimation mode="deal-hand" onDone={onDone} />);
    expect(container.querySelector(".sim-anim-deal")).toBeNull();
    advance(100);
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
