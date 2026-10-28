// @vitest-environment jsdom
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { CoinToss, coinRotation } from "./CoinToss";
import { coinTossMs } from "../scene/sceneTiming";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("coinRotation — a moeda para no lado de quem começa", () => {
  it("de qualquer lado inicial, gira várias voltas e termina no lado certo", () => {
    for (const start of ["heads", "tails"] as const) {
      for (const goesFirst of [true, false]) {
        const r = coinRotation(start, goesFirst);
        expect(((r.finalDeg % 360) + 360) % 360).toBe(goesFirst ? 0 : 180);
        expect(r.finalDeg - r.startDeg).toBeGreaterThanOrEqual(5 * 360);
        expect(r.apexDeg).toBeGreaterThan(r.startDeg);
        expect(r.apexDeg).toBeLessThan(r.finalDeg);
      }
    }
  });
});

describe("CoinToss", () => {
  it("só diz quem começa depois que a moeda cai, e termina no tempo que o servidor espera", () => {
    vi.useFakeTimers();
    let calls = 0;
    const next = () => (
      <CoinToss
        goesFirst={false}
        startFace="heads"
        onDone={() => {
          calls += 1;
        }}
      />
    );
    const { rerender } = render(next());
    expect(screen.queryByText("Oponente começa")).not.toBeInTheDocument();
    // o pai re-renderiza a cada segundo com um callback novo: os timers não podem reiniciar
    for (let elapsed = 0; elapsed < coinTossMs() - 1600; elapsed += 1000) {
      act(() => vi.advanceTimersByTime(1000));
      rerender(next());
    }
    act(() => vi.advanceTimersByTime(600));
    expect(screen.getByText("Oponente começa")).toBeInTheDocument();
    expect(screen.getByTestId("coin")).toHaveAttribute("data-face", "tails");
    expect(calls).toBe(0);
    act(() => vi.advanceTimersByTime(coinTossMs()));
    expect(calls).toBe(1);
  });
});
