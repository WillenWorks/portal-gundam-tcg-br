// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, act } from "@testing-library/react";
import { PhaseAnnouncementBanner } from "./PhaseAnnouncementBanner";

afterEach(cleanup);

describe("PhaseAnnouncementBanner", () => {
  it("renders phase title and subtitle", () => {
    render(<PhaseAnnouncementBanner phase="FASE PRINCIPAL" sub="SISTEMA TÁTICO ATIVO" />);
    expect(screen.getByText(/FASE PRINCIPAL/i)).toBeInTheDocument();
    expect(screen.getByText(/SISTEMA TÁTICO ATIVO/i)).toBeInTheDocument();
  });

  it("calls onDone after specified duration", () => {
    vi.useFakeTimers();
    const onDone = vi.fn();
    render(<PhaseAnnouncementBanner phase="FASE DE COMPRA" durationMs={800} onDone={onDone} />);

    expect(onDone).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(850);
    });

    expect(onDone).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
