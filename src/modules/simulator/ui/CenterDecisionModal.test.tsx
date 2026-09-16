// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { CenterDecisionModal } from "./CenterDecisionModal";

afterEach(cleanup);

describe("CenterDecisionModal", () => {
  it("renders idle end-turn banner when it is your turn and confirmEndTurnOpen is true", () => {
    const onEndTurn = vi.fn();
    render(
      <CenterDecisionModal
        state={{ kind: "idle", yourTurn: true, phaseLabel: "Fase Principal", timerSeconds: 30, turnNumber: 2 }}
        confirmEndTurnOpen={true}
        onEndTurn={onEndTurn}
      />
    );

    const btn = screen.getByRole("button", { name: /encerrar turno/i });
    expect(btn).toBeInTheDocument();
    fireEvent.click(btn);
    expect(onEndTurn).toHaveBeenCalledTimes(1);

    const cancelBtn = screen.getByRole("button", { name: /continuar jogando/i });
    expect(cancelBtn).toBeInTheDocument();
  });

  it("does not render idle modal when confirmEndTurnOpen is false or undefined", () => {
    const { container } = render(
      <CenterDecisionModal
        state={{ kind: "idle", yourTurn: true, phaseLabel: "Fase Principal", timerSeconds: 30, turnNumber: 2 }}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("does not render when it is not your turn and no abandon is available", () => {
    const { container } = render(
      <CenterDecisionModal
        state={{ kind: "idle", yourTurn: false, phaseLabel: "Turno Oponente", timerSeconds: 30, turnNumber: 2 }}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders claim abandon modal when opponent disconnected and abandonAvailable is true", () => {
    const onClaimAbandon = vi.fn();
    render(
      <CenterDecisionModal
        state={{ kind: "abandonAvailable", idleSeconds: 60 }}
        onClaimAbandon={onClaimAbandon}
      />
    );

    expect(screen.getByText(/oponente inativo/i)).toBeInTheDocument();
    const btn = screen.getByRole("button", { name: /declarar vitória por abandono/i });
    fireEvent.click(btn);
    expect(onClaimAbandon).toHaveBeenCalledTimes(1);
  });

  // docs/52 — as decisões de jogada regular saíram do modal central: vivem no
  // TopTacticalHUD (MatchPrompt) e no ActionDock. Nunca mais um card bloqueante
  // no centro da tela pra essas 4 situações.
  it("never renders a center modal for defending (moved to TopTacticalHUD)", () => {
    const { container } = render(<CenterDecisionModal state={{ kind: "defending" }} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("never renders a center modal for actionStep (moved to TopTacticalHUD)", () => {
    const { container } = render(
      <CenterDecisionModal state={{ kind: "actionStep", scope: "combat", autoPass: false, hasPlay: true }} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("never renders a center modal for attacking (declare attack happens on the board)", () => {
    const { container } = render(
      <CenterDecisionModal state={{ kind: "attacking", attackerName: "Gundam RX-78-2" }} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("never renders a center modal for pending target/resource selection (moved to TopTacticalHUD)", () => {
    const { container } = render(
      <CenterDecisionModal
        state={{
          kind: "pending",
          verb: "Escolher",
          cardName: "Unit Alvo",
          selectedCount: 1,
          hint: "Selecione 1 Unit inimiga",
          cost: null,
          canConfirm: true,
        }}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });
});
