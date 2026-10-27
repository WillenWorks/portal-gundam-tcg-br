// @vitest-environment jsdom
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { BurstDecisionStage } from "./BurstDecisionStage";
import { SCENE_MS } from "../scene/sceneTiming";
import type { PendingDecision } from "../engine/types";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const decision = {
  kind: "burst",
  cardInstanceId: "s1",
  cardDef: { code: "GD01-117", nameEn: "Darkness Finger", cardType: "COMMAND" },
  queuedInstanceIds: [],
} as unknown as Extract<PendingDecision, { kind: "burst" }>;

function setup(opts: { target?: boolean; selected?: number } = {}) {
  const onResolve = vi.fn();
  const onTargetingChange = vi.fn();
  const target = opts.target ? { legalTargetIds: ["u1", "u2"], min: 1, max: 1 } : null;
  const view = render(
    <BurstDecisionStage
      decision={decision}
      art={{}}
      effectText="Escolha 1 Unidade inimiga. Cause 2 de dano a ela."
      target={target}
      selectedCount={opts.selected ?? 0}
      trashAt={{ x: 50, y: 50 }}
      trashW={40}
      onTargetingChange={onTargetingChange}
      onResolve={onResolve}
    />,
  );
  return { ...view, onResolve, onTargetingChange, target };
}

describe("BurstDecisionStage — a decisão do 【Burst】 como na mesa", () => {
  it("modal simples no centro; ativar sem alvo: a carta some usada e então ativa", () => {
    vi.useFakeTimers();
    const { onResolve } = setup();
    expect(screen.getByText("Ativar o 【Burst】?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ativar" }));
    expect(screen.getByTestId("burst-decision")).toHaveAttribute("data-phase", "used");
    expect(onResolve).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(SCENE_MS.play.used + 10));
    expect(onResolve).toHaveBeenCalledWith(true);
  });

  it("com alvo: a escolha vai para o campo (banner pequeno no topo com o texto do efeito); confirmar só com o alvo", () => {
    vi.useFakeTimers();
    const { onResolve, onTargetingChange, rerender, target } = setup({ target: true });
    fireEvent.click(screen.getByRole("button", { name: "Ativar" }));
    act(() => vi.advanceTimersByTime(SCENE_MS.play.used + 10));
    expect(onTargetingChange).toHaveBeenCalledWith(true);
    expect(screen.getByTestId("burst-target-banner")).toHaveTextContent("Cause 2 de dano");
    // nenhum botão de alvo dentro do banner: o alvo é clicado no campo
    expect(screen.queryByRole("button", { name: /u1|u2/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmar" })).toBeDisabled();
    rerender(
      <BurstDecisionStage
        decision={decision}
        art={{}}
        effectText="x"
        target={target}
        selectedCount={1}
        trashAt={null}
        trashW={40}
        onTargetingChange={onTargetingChange}
        onResolve={onResolve}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(onResolve).toHaveBeenCalledWith(true);
    expect(onTargetingChange).toHaveBeenLastCalledWith(false);
  });

  it("não ativar: a carta cai na lixeira e então a decisão vai", () => {
    vi.useFakeTimers();
    const { onResolve } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Mandar pro cemitério" }));
    expect(onResolve).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(SCENE_MS.combat.shield.toTrash + 10));
    expect(onResolve).toHaveBeenCalledWith(false);
  });
});
