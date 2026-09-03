// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { PendingDecision } from "@/modules/simulator/engine/types";
import { AbilityResolutionModal } from "./AbilityResolutionModal";

afterEach(cleanup);

type AR = Extract<PendingDecision, { kind: "abilityResolution" }>;

const enemyUnit = [
  { instanceId: "e1", label: "Zaku II" },
  { instanceId: "e2", label: "Guncannon" },
];
const emptyScopes = { enemyUnit: [], friendlyUnit: [], ownResource: [] };

const whenPaired: AR = {
  kind: "abilityResolution",
  trigger: "When Paired",
  queue: [
    { sourceInstanceId: "p1", specId: "ST01-010-WhenPaired", label: "Choose 1 enemy Unit. Rest it.", optional: false, needsTarget: true, targetScope: "enemyUnit" },
  ],
};

describe("AbilityResolutionModal", () => {
  it("mandatório + alvo (enemyUnit): confirma só depois de escolher; envia o targetId", () => {
    const onResolve = vi.fn();
    render(<AbilityResolutionModal decision={whenPaired} targetsByScope={{ ...emptyScopes, enemyUnit }} onResolve={onResolve} />);
    const confirm = screen.getByRole("button", { name: "Confirmar" });
    expect(confirm).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Guncannon" }));
    fireEvent.click(confirm);
    expect(onResolve).toHaveBeenCalledWith([{ specId: "ST01-010-WhenPaired", activate: true, targetIds: ["e2"] }]);
  });

  it("sem alvo no escopo: confirma direto (efeito não faz nada)", () => {
    const onResolve = vi.fn();
    render(<AbilityResolutionModal decision={whenPaired} targetsByScope={emptyScopes} onResolve={onResolve} />);
    expect(screen.getByText(/Nenhum alvo legal/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(onResolve).toHaveBeenCalledWith([{ specId: "ST01-010-WhenPaired", activate: true, targetIds: [] }]);
  });

  it("Attack + ownResource: mostra o cabeçalho do 【Attack】 e os recursos como alvo", () => {
    const attack: AR = {
      kind: "abilityResolution",
      trigger: "Attack",
      queue: [{ sourceInstanceId: "s1", specId: "ST01-011-Attack", label: "Choose 1 of your Resources. Set it as active.", optional: false, needsTarget: true, targetScope: "ownResource" }],
    };
    const onResolve = vi.fn();
    render(
      <AbilityResolutionModal
        decision={attack}
        targetsByScope={{ ...emptyScopes, ownResource: [{ instanceId: "r1", label: "Recurso 1 (gasto)" }] }}
        onResolve={onResolve}
      />,
    );
    expect(screen.getByText(/【Attack】/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Recurso 1 (gasto)" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(onResolve).toHaveBeenCalledWith([{ specId: "ST01-011-Attack", activate: true, targetIds: ["r1"] }]);
  });

  it("optativo: 'Pular' → activate false", () => {
    const optional: AR = {
      kind: "abilityResolution",
      trigger: "When Paired",
      queue: [{ sourceInstanceId: "p1", specId: "X-1", label: "You may draw 1.", optional: true, needsTarget: false, targetScope: "enemyUnit" }],
    };
    const onResolve = vi.fn();
    render(<AbilityResolutionModal decision={optional} targetsByScope={emptyScopes} onResolve={onResolve} />);
    fireEvent.click(screen.getByRole("button", { name: "Pular" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(onResolve).toHaveBeenCalledWith([{ specId: "X-1", activate: false, targetIds: [] }]);
  });
});
