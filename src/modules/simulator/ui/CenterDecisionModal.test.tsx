// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { CenterDecisionModal } from "./CenterDecisionModal";

afterEach(cleanup);

describe("CenterDecisionModal", () => {
  it("renders idle end-turn banner when it is your turn", () => {
    const onEndTurn = vi.fn();
    render(
      <CenterDecisionModal
        state={{ kind: "idle", yourTurn: true, phaseLabel: "Fase Principal", timerSeconds: 30, turnNumber: 2 }}
        onEndTurn={onEndTurn}
      />
    );

    const btn = screen.getByRole("button", { name: /encerrar turno/i });
    expect(btn).toBeInTheDocument();
    fireEvent.click(btn);
    expect(onEndTurn).toHaveBeenCalledTimes(1);
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

  it("renders defending decision modal with skip button", () => {
    const onSkipBlock = vi.fn();
    render(
      <CenterDecisionModal
        state={{ kind: "defending" }}
        onSkipBlock={onSkipBlock}
      />
    );

    expect(screen.getByText(/ataque recebido/i)).toBeInTheDocument();

    const skipBtn = screen.getByRole("button", { name: /não bloquear/i });
    fireEvent.click(skipBtn);
    expect(onSkipBlock).toHaveBeenCalledTimes(1);
  });

  it("renders actionStep decision modal with pass turn button", () => {
    const onPass = vi.fn();
    render(
      <CenterDecisionModal
        state={{ kind: "actionStep", scope: "combat", autoPass: false, hasPlay: true }}
        onPass={onPass}
      />
    );

    expect(screen.getByText(/passo de ação/i)).toBeInTheDocument();
    const passBtn = screen.getByRole("button", { name: /passar turno/i });
    fireEvent.click(passBtn);
    expect(onPass).toHaveBeenCalledTimes(1);
  });

  it("renders attacking decision modal with attack player and cancel buttons", () => {
    const onDeclareAttackPlayer = vi.fn();
    const onCancelAttack = vi.fn();
    render(
      <CenterDecisionModal
        state={{ kind: "attacking", attackerName: "Gundam RX-78-2" }}
        onDeclareAttackPlayer={onDeclareAttackPlayer}
        onCancelAttack={onCancelAttack}
      />
    );

    expect(screen.getByText(/ataque declarado/i)).toBeInTheDocument();
    expect(screen.getByText(/gundam rx-78-2/i)).toBeInTheDocument();

    const atkBtn = screen.getByRole("button", { name: /atacar o jogador/i });
    fireEvent.click(atkBtn);
    expect(onDeclareAttackPlayer).toHaveBeenCalledTimes(1);

    const cancelBtn = screen.getByRole("button", { name: /cancelar/i });
    fireEvent.click(cancelBtn);
    expect(onCancelAttack).toHaveBeenCalledTimes(1);
  });

  it("renders pending prompt decision modal with confirm and cancel buttons", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
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
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    expect(screen.getByText(/definir alvo \/ recursos/i)).toBeInTheDocument();
    expect(screen.getByText(/selecione 1 unit inimiga/i)).toBeInTheDocument();

    const confirmBtn = screen.getByRole("button", { name: /confirmar/i });
    fireEvent.click(confirmBtn);
    expect(onConfirm).toHaveBeenCalledTimes(1);

    const cancelBtn = screen.getByRole("button", { name: /cancelar/i });
    fireEvent.click(cancelBtn);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
