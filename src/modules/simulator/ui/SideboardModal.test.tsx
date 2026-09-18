// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { SideboardModal } from "./SideboardModal";
import type { DeckListWithSideboard } from "@/modules/simulator/engine/sideboard";
import type { CardDef } from "@/modules/simulator/engine/types";

afterEach(cleanup);

function makeDummyCard(code: string, color = "Blue", cardType: CardDef["cardType"] = "UNIT"): CardDef {
  return {
    code,
    nameEn: `Test Card ${code}`,
    cardType,
    color,
    level: 3,
    cost: 2,
  };
}

function makeMockDeck(): DeckListWithSideboard {
  // 50 cartas no main: 48 cópias da carta A + 2 cópias da carta B
  const main: CardDef[] = [];
  for (let i = 0; i < 48; i++) {
    main.push(makeDummyCard(`CARD-MAIN-${Math.floor(i / 4)}`));
  }
  main.push(makeDummyCard("CARD-MAIN-OUT-1"));
  main.push(makeDummyCard("CARD-MAIN-OUT-2"));

  // 2 cartas no sideboard
  const sideboard: CardDef[] = [
    makeDummyCard("CARD-SIDE-IN-1"),
    makeDummyCard("CARD-SIDE-IN-2"),
  ];

  // 10 recursos
  const resources: CardDef[] = [];
  for (let i = 0; i < 10; i++) {
    resources.push(makeDummyCard("RES-01", "Blue", "RESOURCE"));
  }

  return { main, sideboard, resources };
}

describe("SideboardModal UI Component", () => {
  it("renderiza o cabeçalho tático com placar, timer e identificadores Bo3", () => {
    const deck = makeMockDeck();
    render(
      <SideboardModal
        matchId="match-123"
        seat="A"
        initialDeck={deck}
        bo3Score={{ A: 1, B: 0 }}
        currentGameIndex={2}
        sideboardDeadlineAt={Date.now() + 180_000}
        art={{}}
        onConfirmSwaps={vi.fn()}
      />
    );

    expect(screen.getByText(/FASE DE SIDEBOARD TÁTICO/i)).toBeInTheDocument();
    expect(screen.getByText(/Bo3 \/\/ Jogo 2/i)).toBeInTheDocument();
    expect(screen.getByText(/P1: 1/i)).toBeInTheDocument();
    expect(screen.getByText(/P2: 0/i)).toBeInTheDocument();
    expect(screen.getByText(/Tempo Restante/i)).toBeInTheDocument();
  });

  it("exibe contadores de Main Deck (50/50) e Sideboard inicial (2/10)", () => {
    const deck = makeMockDeck();
    render(
      <SideboardModal
        matchId="match-123"
        seat="A"
        initialDeck={deck}
        art={{}}
        onConfirmSwaps={vi.fn()}
      />
    );

    expect(screen.getByText("50/50")).toBeInTheDocument();
    expect(screen.getByText("2/10")).toBeInTheDocument();
    expect(screen.getByText("DECK LEGALIZADO")).toBeInTheDocument();
  });

  it("permite manter deck sem trocas habilitando o botão de ação imediatamente", () => {
    const deck = makeMockDeck();
    const onConfirm = vi.fn();
    render(
      <SideboardModal
        matchId="match-123"
        seat="A"
        initialDeck={deck}
        art={{}}
        onConfirmSwaps={onConfirm}
      />
    );

    const button = screen.getByRole("button", { name: /Manter Deck Sem Trocas/i });
    expect(button).toBeEnabled();

    fireEvent.click(button);
    expect(onConfirm).toHaveBeenCalledWith({ mainOut: [], sideIn: [] });
  });

  it("interação de troca: retirar 1 carta do Main e adicionar 1 do Sideboard chama onConfirmSwaps com os códigos", () => {
    const deck = makeMockDeck();
    const onConfirm = vi.fn();
    render(
      <SideboardModal
        matchId="match-123"
        seat="A"
        initialDeck={deck}
        art={{}}
        onConfirmSwaps={onConfirm}
      />
    );

    // Clica no botão "SIDE" de uma carta do main deck
    const sideButtons = screen.getAllByRole("button", { name: /SIDE/i });
    expect(sideButtons.length).toBeGreaterThan(0);
    fireEvent.click(sideButtons[0]);

    // Agora o Main tem 49 cartas (desbalanceado)
    expect(screen.getByText("49/50")).toBeInTheDocument();
    expect(screen.getByText(/Trocas devem ser 1:1/i)).toBeInTheDocument();

    // Clica no botão "MAIN" de uma carta do sideboard para reequilibrar
    const mainButtons = screen.getAllByRole("button", { name: /MAIN/i });
    expect(mainButtons.length).toBeGreaterThan(0);
    fireEvent.click(mainButtons[0]);

    // Agora o Main volta a ter 50 cartas (balanceado 1:1)
    expect(screen.getByText("50/50")).toBeInTheDocument();
    const confirmButton = screen.getByRole("button", { name: /Confirmar Trocas de Sideboard/i });
    expect(confirmButton).toBeEnabled();

    fireEvent.click(confirmButton);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    const callArg = onConfirm.mock.calls[0][0];
    expect(callArg.mainOut).toHaveLength(1);
    expect(callArg.sideIn).toHaveLength(1);
  });

  it("exibe feedback claro de aguardando oponente quando o jogador já confirmou", () => {
    const deck = makeMockDeck();
    render(
      <SideboardModal
        matchId="match-123"
        seat="A"
        initialDeck={deck}
        sideboardConfirmed={{ A: true, B: false }}
        art={{}}
        onConfirmSwaps={vi.fn()}
      />
    );

    expect(screen.getByText(/Suas trocas foram transmitidas com sucesso!/i)).toBeInTheDocument();
    expect(screen.getByText(/Aguardando confirmação tática do oponente/i)).toBeInTheDocument();
    expect(screen.getByText(/Trocas Confirmadas/i)).toBeInTheDocument();
  });
});
