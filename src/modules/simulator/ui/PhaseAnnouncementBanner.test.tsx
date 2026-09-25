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

  it("does not reset timer or play sound repeatedly when parent re-renders with new onDone reference", () => {
    vi.useFakeTimers();
    const onDone = vi.fn();
    const { rerender } = render(<PhaseAnnouncementBanner phase="FASE PRINCIPAL" durationMs={1000} onDone={() => onDone()} />);

    // Simula re-renders a cada 300ms com closures novas
    act(() => {
      vi.advanceTimersByTime(300);
    });
    rerender(<PhaseAnnouncementBanner phase="FASE PRINCIPAL" durationMs={1000} onDone={() => onDone()} />);

    act(() => {
      vi.advanceTimersByTime(300);
    });
    rerender(<PhaseAnnouncementBanner phase="FASE PRINCIPAL" durationMs={1000} onDone={() => onDone()} />);

    act(() => {
      vi.advanceTimersByTime(450);
    });

    expect(onDone).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("exibe legendas temáticas contextuais para FASE DE AÇÕES e FIM DE TURNO", () => {
    const { rerender } = render(<PhaseAnnouncementBanner phase="FASE DE AÇÕES" />);
    expect(screen.getByText("FASE DE AÇÕES")).toBeInTheDocument();
    expect(screen.getByText("PASSO DE INTERVENÇÃO / RESPOSTA")).toBeInTheDocument();

    rerender(<PhaseAnnouncementBanner phase="FIM DE TURNO" />);
    expect(screen.getByText("FIM DE TURNO")).toBeInTheDocument();
    expect(screen.getByText("ENCERRAMENTO DE TURNO")).toBeInTheDocument();
  });
});

