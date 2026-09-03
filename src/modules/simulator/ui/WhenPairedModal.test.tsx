// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { PendingDecision } from "@/modules/simulator/engine/types";
import { WhenPairedModal } from "./WhenPairedModal";

afterEach(cleanup);

type WP = Extract<PendingDecision, { kind: "whenPaired" }>;

const single: WP = {
  kind: "whenPaired",
  queue: [{ sourceInstanceId: "p1", specId: "ST01-010-WhenPaired", label: "Choose 1 enemy Unit with 5 or less HP. Rest it.", optional: false, needsTarget: true }],
};

const targets = [
  { instanceId: "e1", label: "Zaku II" },
  { instanceId: "e2", label: "Guncannon" },
];

describe("WhenPairedModal", () => {
  it("efeito mandatório + alvo: só confirma depois de escolher o alvo", () => {
    const onResolve = vi.fn();
    render(<WhenPairedModal decision={single} targetOptions={targets} onResolve={onResolve} />);
    const confirm = screen.getByRole("button", { name: "Confirmar" });
    expect(confirm).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Guncannon" }));
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);
    expect(onResolve).toHaveBeenCalledWith([
      { specId: "ST01-010-WhenPaired", activate: true, targetIds: ["e2"] },
    ]);
  });

  it("sem alvos disponíveis: confirma direto (efeito não faz nada)", () => {
    const onResolve = vi.fn();
    render(<WhenPairedModal decision={single} targetOptions={[]} onResolve={onResolve} />);
    expect(screen.getByText(/Nenhum alvo legal/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(onResolve).toHaveBeenCalledWith([{ specId: "ST01-010-WhenPaired", activate: true, targetIds: [] }]);
  });

  it("efeito optativo: 'Pular' → activate false, sem exigir alvo", () => {
    const optional: WP = {
      kind: "whenPaired",
      queue: [{ sourceInstanceId: "p1", specId: "X-1", label: "You may draw 1.", optional: true, needsTarget: false }],
    };
    const onResolve = vi.fn();
    render(<WhenPairedModal decision={optional} targetOptions={[]} onResolve={onResolve} />);
    fireEvent.click(screen.getByRole("button", { name: "Pular" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(onResolve).toHaveBeenCalledWith([{ specId: "X-1", activate: false, targetIds: [] }]);
  });

  it("2 efeitos: envia na ordem montada (setas up/down)", () => {
    const two: WP = {
      kind: "whenPaired",
      queue: [
        { sourceInstanceId: "u1", specId: "A", label: "Efeito A", optional: false, needsTarget: false },
        { sourceInstanceId: "p1", specId: "B", label: "Efeito B", optional: false, needsTarget: false },
      ],
    };
    const onResolve = vi.fn();
    render(<WhenPairedModal decision={two} targetOptions={[]} onResolve={onResolve} />);
    // sobe o B (segundo item) pra 1º
    const upButtons = screen.getAllByRole("button").filter((b) => b.querySelector("svg.lucide-arrow-up"));
    fireEvent.click(upButtons[1]);
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(onResolve.mock.calls[0][0].map((r: { specId: string }) => r.specId)).toEqual(["B", "A"]);
  });
});
