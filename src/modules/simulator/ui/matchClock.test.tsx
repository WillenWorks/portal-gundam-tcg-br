// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { currentSecond, secondsSince, secondsUntil, useClockNow, useIsPast } from "./matchClock";

describe("matchClock", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-23T12:00:00.300Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("secondsUntil arredonda para cima, secondsSince para baixo, nunca negativos", () => {
    expect(secondsUntil(10_500, 10_000)).toBe(1);
    expect(secondsUntil(9_000, 10_000)).toBe(0);
    expect(secondsUntil(null, 10_000)).toBeNull();
    expect(secondsSince(8_200, 10_000)).toBe(1);
    expect(secondsSince(12_000, 10_000)).toBe(0);
    expect(currentSecond(12_999)).toBe(12_000);
  });

  it("useClockNow re-renderiza só quem o lê, a cada virada de segundo", () => {
    let clockRenders = 0;
    let parentRenders = 0;
    function Clock() {
      clockRenders++;
      return <span data-testid="t">{useClockNow()}</span>;
    }
    function Parent() {
      parentRenders++;
      return <Clock />;
    }
    render(<Parent />);
    const start = Number(screen.getByTestId("t").textContent);
    for (let i = 0; i < 3; i++) act(() => vi.advanceTimersByTime(1_000));
    expect(Number(screen.getByTestId("t").textContent)).toBe(start + 3_000);
    expect(clockRenders).toBe(4);
    expect(parentRenders).toBe(1);
  });

  it("useIsPast vira verdadeiro no instante do alvo e recomeça com alvo novo", () => {
    function Probe({ target }: { target: number | null }) {
      return <span data-testid="p">{String(useIsPast(target))}</span>;
    }
    const t0 = Date.now();
    const { rerender } = render(<Probe target={t0 + 5_000} />);
    expect(screen.getByTestId("p").textContent).toBe("false");
    act(() => vi.advanceTimersByTime(4_999));
    expect(screen.getByTestId("p").textContent).toBe("false");
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByTestId("p").textContent).toBe("true");
    // o oponente deu sinal: novo "visto por último" → espera de novo
    rerender(<Probe target={Date.now() + 5_000} />);
    expect(screen.getByTestId("p").textContent).toBe("false");
    rerender(<Probe target={null} />);
    expect(screen.getByTestId("p").textContent).toBe("false");
  });
});
