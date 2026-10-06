// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { BurstModal } from "./BurstModal";
import type { PendingDecision } from "@/modules/simulator/engine/types";

afterEach(cleanup);

type BurstDecision = Extract<PendingDecision, { kind: "burst" }>;

const baseDecision: BurstDecision = {
  kind: "burst",
  cardInstanceId: "c1",
  cardDef: {
    code: "GD01-001",
    nameEn: "RX-78-2 Gundam",
    cardType: "UNIT",
    color: "blue",
  },
  choices: ["activate", "trash"],
  queuedInstanceIds: [],
};

describe("BurstModal", () => {
  it("renderiza o modal de Burst com nome da carta e opções Ativar/Mandar pro trash", () => {
    const onResolve = vi.fn();
    render(<BurstModal decision={baseDecision} art={{}} onResolve={onResolve} />);

    expect(screen.getAllByText(/RX-78-2 Gundam/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Sua shield foi quebrada\. Ativar o efeito de Burst\?/i)).toBeInTheDocument();

    const activateBtn = screen.getByRole("button", { name: /ativar efeito/i });
    const trashBtn = screen.getByRole("button", { name: /mandar pro trash/i });

    expect(activateBtn).toBeInTheDocument();
    expect(trashBtn).toBeInTheDocument();

    fireEvent.click(activateBtn);
    expect(onResolve).toHaveBeenCalledWith(true);

    fireEvent.click(trashBtn);
    expect(onResolve).toHaveBeenCalledWith(false);
  });

  it("exibe sufixo de fila quando há mais shields quebradas simultaneamente", () => {
    const decisionWithQueue: BurstDecision = {
      ...baseDecision,
      queuedInstanceIds: ["c2", "c3"],
    };
    render(<BurstModal decision={decisionWithQueue} art={{}} onResolve={vi.fn()} />);

    expect(screen.getByText(/\(\+2 na fila\)/i)).toBeInTheDocument();
  });

  it("desabilita botões quando busy é true", () => {
    render(<BurstModal decision={baseDecision} art={{}} busy onResolve={vi.fn()} />);

    expect(screen.getByRole("button", { name: /ativar efeito/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /mandar pro trash/i })).toBeDisabled();
  });
});
