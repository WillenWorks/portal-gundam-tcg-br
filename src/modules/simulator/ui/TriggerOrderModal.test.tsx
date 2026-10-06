// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { TriggerOrderModal } from "./TriggerOrderModal";
import type { PendingDecision } from "@/modules/simulator/engine/types";

afterEach(cleanup);

type TriggerOrderDecision = Extract<PendingDecision, { kind: "triggerOrder" }>;

const baseDecision: TriggerOrderDecision = {
  kind: "triggerOrder",
  triggers: [
    { instanceId: "i1", trigger: "Deploy", specId: "trig-1", label: "Efeito 1 (Gundam)" },
    { instanceId: "i2", trigger: "Deploy", specId: "trig-2", label: "Efeito 2 (Zaku)" },
    { instanceId: "i3", trigger: "When Paired", specId: "trig-3", label: "Efeito 3 (Pilot)" },
  ],
};

describe("TriggerOrderModal", () => {
  it("renderiza os gatilhos e permite reordenar com setas", () => {
    const onResolve = vi.fn();
    render(<TriggerOrderModal decision={baseDecision} onResolve={onResolve} />);

    expect(screen.getByText(/Ordem dos gatilhos/i)).toBeInTheDocument();
    expect(screen.getByText("Efeito 1 (Gundam)")).toBeInTheDocument();
    expect(screen.getByText("Efeito 2 (Zaku)")).toBeInTheDocument();
    expect(screen.getByText("Efeito 3 (Pilot)")).toBeInTheDocument();

    const moveDownButtons = screen.getAllByRole("button", { name: /mover para depois/i });
    expect(moveDownButtons).toHaveLength(3);

    // Mover o primeiro para baixo (troca trig-1 com trig-2)
    fireEvent.click(moveDownButtons[0]);

    // Confirma
    const confirmBtn = screen.getByRole("button", { name: /confirmar ordem/i });
    fireEvent.click(confirmBtn);

    expect(onResolve).toHaveBeenCalledWith(["trig-2", "trig-1", "trig-3"]);
  });

  it("desabilita botão de confirmação quando busy", () => {
    render(<TriggerOrderModal decision={baseDecision} busy onResolve={vi.fn()} />);
    expect(screen.getByRole("button", { name: /confirmar ordem/i })).toBeDisabled();
  });
});
