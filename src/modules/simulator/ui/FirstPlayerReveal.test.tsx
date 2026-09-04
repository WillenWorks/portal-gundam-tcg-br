// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { FirstPlayerReveal } from "./FirstPlayerReveal";

afterEach(cleanup);

describe("FirstPlayerReveal", () => {
  it("mostra o texto certo por lado", () => {
    const { rerender } = render(<FirstPlayerReveal goesFirst onDismiss={vi.fn()} />);
    expect(screen.getByText("Você joga primeiro")).toBeInTheDocument();
    rerender(<FirstPlayerReveal goesFirst={false} onDismiss={vi.fn()} />);
    expect(screen.getByText("Oponente joga primeiro")).toBeInTheDocument();
  });

  it("clicar no overlay dispara onDismiss", () => {
    const onDismiss = vi.fn();
    render(<FirstPlayerReveal goesFirst onDismiss={onDismiss} />);
    screen.getByRole("button", { name: "Continuar" }).click();
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("auto-dismiss dispara mesmo com o pai re-renderizando com onDismiss nova (relógio de 1s)", () => {
    vi.useFakeTimers();
    try {
      let calls = 0;
      const next = () => (
        <FirstPlayerReveal
          goesFirst
          onDismiss={() => {
            calls += 1;
          }}
          autoDismissMs={3500}
        />
      );
      const { rerender } = render(next());
      for (let s = 0; s < 3; s += 1) {
        vi.advanceTimersByTime(1000);
        rerender(next()); // closure nova a cada tick, como no SimulatorMatchPage
      }
      expect(calls).toBe(0);
      vi.advanceTimersByTime(600); // total 3600ms > 3500ms
      expect(calls).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
