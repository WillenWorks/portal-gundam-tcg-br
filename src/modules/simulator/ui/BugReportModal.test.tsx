// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { BugReportModal } from "./BugReportModal";
import type { BugReportSnapshot } from "./captureSnapshot";

afterEach(cleanup);

describe("BugReportModal", () => {
  const sampleSnapshot: BugReportSnapshot = {
    timestamp: Date.now(),
    matchId: "match-123",
    seat: "A",
    opponentSeat: "B",
    isAgainstBot: true,
    botLevel: "Heurístico",
    turnNumber: 5,
    phase: "main",
    activePlayer: "A",
    myShieldCount: 4,
    oppShieldCount: 2,
    myResourceCount: { total: 4, active: 3, rested: 1 },
    oppResourceCount: { total: 4, active: 4, rested: 0 },
    myUnitsInPlay: ["ST01-001"],
    oppUnitsInPlay: ["ST02-001"],
    screenshotBase64: "data:image/png;base64,samplebase64data",
    battleLogRecent: ["Turno 5 iniciado"],
    browserInfo: {
      userAgent: "Vitest Browser",
      screenWidth: 1920,
      screenHeight: 1080,
      viewportWidth: 1920,
      viewportHeight: 900,
    },
  };

  it("renderiza spinner durante captura de tela", () => {
    render(<BugReportModal capturing onSubmit={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText("Capturando snapshot e print da tela…")).toBeInTheDocument();
  });

  it("exibe resumo do snapshot, opção de ver screenshot e permite enviar relato", () => {
    const onSubmit = vi.fn();
    render(<BugReportModal snapshot={sampleSnapshot} onSubmit={onSubmit} onClose={vi.fn()} />);

    expect(screen.getByText(/Turno 5/i)).toBeInTheDocument();
    expect(screen.getByText("main")).toBeInTheDocument();
    expect(screen.getByText("Partida vs Bot")).toBeInTheDocument();
    expect(screen.getByText("Ver print anexado da tela")).toBeInTheDocument();

    // Abre prévia do screenshot
    fireEvent.click(screen.getByText("Ver print anexado da tela"));
    expect(screen.getByAltText("Screenshot da Partida")).toBeInTheDocument();

    // Digita texto e envia
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "O bot atacou minha base mas não descontou escudo" } });

    const submitBtn = screen.getByRole("button", { name: "Enviar Relatório" });
    fireEvent.click(submitBtn);

    expect(onSubmit).toHaveBeenCalledWith("O bot atacou minha base mas não descontou escudo");
  });

  it("chama onClose e não envia nada ao clicar em Cancelar", () => {
    const onSubmit = vi.fn();
    const onClose = vi.fn();
    render(<BugReportModal snapshot={sampleSnapshot} onSubmit={onSubmit} onClose={onClose} />);

    const cancelBtn = screen.getByRole("button", { name: "Cancelar (Descartar)" });
    fireEvent.click(cancelBtn);

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("renderiza confirmação de sucesso com shortCode", () => {
    const onClose = vi.fn();
    render(<BugReportModal shortCode="BUG-ABC123" onSubmit={vi.fn()} onClose={onClose} />);

    expect(screen.getByText("Relatório Arquivado")).toBeInTheDocument();
    expect(screen.getByText("BUG-ABC123")).toBeInTheDocument();

    const closeBtn = screen.getByRole("button", { name: "Fechar" });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
