// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import {
  DeckSimulatorNotice,
  DeckSimulatorPill,
  type UnplayableCardSummary,
} from "./DeckSimulatorNotice";
import type { CardRecord } from "@/modules/core/types";

afterEach(cleanup);

const mockCardRecord = (code: string, name: string): CardRecord => ({
  id: `card-${code}`,
  code,
  name,
  namePt: `${name} (PT)`,
  type: "UNIT",
  color: "Blue",
  cost: 3,
  level: 3,
  ap: 3,
  hp: 3,
  keywords: [],
  triggerKeywords: [],
  trait: "Earth Federation",
  series: "Mobile Suit Gundam",
  rarity: "C",
  effect: "",
  linkText: "",
  cardModelId: `model-${code}`,
  printId: `print-${code}`,
});

describe("DeckSimulatorNotice — Diagnóstico e avisos de simulador no Deckbuilder", () => {
  it("renderiza o selo verde de 100% Apto quando o deck está completo (50 cartas) e todas são aptas", () => {
    render(
      <DeckSimulatorNotice
        unplayableCards={[]}
        totalUnplayableCopies={0}
        mainDeckCount={50}
        expectedDeckSize={50}
      />,
    );

    expect(screen.getByTestId("deck-simulator-playable-notice")).toBeInTheDocument();
    expect(screen.getByText(/100% Apto para o Simulador/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Todas as 50 cartas do deck principal estão implementadas no motor/i),
    ).toBeInTheDocument();
  });

  it("não renderiza aviso quando não há cartas em revisão mas o deck ainda está incompleto (< 50)", () => {
    const { container } = render(
      <DeckSimulatorNotice
        unplayableCards={[]}
        totalUnplayableCopies={0}
        mainDeckCount={35}
        expectedDeckSize={50}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("renderiza o aviso em amarelo detalhando cartas em revisão e número de cópias", () => {
    const unplayableCards: UnplayableCardSummary[] = [
      {
        card: mockCardRecord("EB01-003", "Gundam Ez8"),
        entry: {
          code: "EB01-003",
          status: "revisao",
          set: "EB01",
          missingClauses: ["When Destroyed: draw 1"],
        },
        count: 4,
        status: "revisao",
        missingClauses: ["When Destroyed: draw 1"],
      },
      {
        card: mockCardRecord("EB01-010", "RX-79 Ground Gundam"),
        entry: {
          code: "EB01-010",
          status: "revisao",
          set: "EB01",
          missingClauses: ["Main: Rest this unit"],
        },
        count: 2,
        status: "revisao",
        missingClauses: ["Main: Rest this unit"],
      },
    ];

    render(
      <DeckSimulatorNotice
        unplayableCards={unplayableCards}
        totalUnplayableCopies={6}
        mainDeckCount={50}
        expectedDeckSize={50}
      />,
    );

    expect(screen.getByTestId("deck-simulator-unplayable-notice")).toBeInTheDocument();
    expect(screen.getByText(/Aviso de Cobertura do Simulador · 2 carta\(s\) em revisão/i)).toBeInTheDocument();
    expect(screen.getByText(/6 cópia\(s\) afetada\(s\)/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Este deck não pode ser usado no simulador ainda: 2 cartas estão em revisão no motor de regras/i),
    ).toBeInTheDocument();

    // Itens individuais renderizados
    expect(screen.getByTestId("unplayable-card-item-EB01-003")).toBeInTheDocument();
    expect(screen.getByTestId("unplayable-card-item-EB01-010")).toBeInTheDocument();
    expect(screen.getByText(/Gundam Ez8/i)).toBeInTheDocument();
    expect(screen.getByText("(4x)")).toBeInTheDocument();
    expect(screen.getByText("(2x)")).toBeInTheDocument();
  });

  it("trata singular quando apenas 1 carta está em revisão", () => {
    const unplayableCards: UnplayableCardSummary[] = [
      {
        card: mockCardRecord("EB01-003", "Gundam Ez8"),
        entry: {
          code: "EB01-003",
          status: "revisao",
          set: "EB01",
        },
        count: 3,
        status: "revisao",
      },
    ];

    render(
      <DeckSimulatorNotice
        unplayableCards={unplayableCards}
        totalUnplayableCopies={3}
        mainDeckCount={50}
        expectedDeckSize={50}
      />,
    );

    expect(
      screen.getByText(/Este deck não pode ser usado no simulador ainda: 1 carta está em revisão no motor de regras/i),
    ).toBeInTheDocument();
  });
});

describe("DeckSimulatorPill — Pílula de status no cabeçalho do Deckbuilder", () => {
  it("renderiza pílula verde quando o deck é apto", () => {
    render(
      <DeckSimulatorPill
        isPlayable={true}
        unplayableCount={0}
        unplayableCodes={[]}
      />,
    );

    const pill = screen.getByTestId("deck-simulator-pill-playable");
    expect(pill).toBeInTheDocument();
    expect(screen.getByText("Simulador: Apto")).toBeInTheDocument();
  });

  it("renderiza pílula amarela quando há cartas em revisão", () => {
    render(
      <DeckSimulatorPill
        isPlayable={false}
        unplayableCount={2}
        unplayableCodes={["EB01-003", "EB01-010"]}
      />,
    );

    const pill = screen.getByTestId("deck-simulator-pill-unplayable");
    expect(pill).toBeInTheDocument();
    expect(screen.getByText("Simulador: 2 em revisão")).toBeInTheDocument();
  });
});
