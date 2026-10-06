// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { CardPlayabilityBadge } from "./CardPlayabilityBadge";
import { CardPlayabilityDetailBox } from "./CardPlayabilityDetailBox";
import { SetPlayabilityProgress } from "./SetPlayabilityProgress";
import * as cardPlayabilityModule from "./useCardPlayability";

afterEach(cleanup);

describe("CardPlayabilityBadge — Selo visual de jogabilidade", () => {
  it("renderiza o selo 'Apta' para status apta com ícone e classes corretas", () => {
    render(
      <CardPlayabilityBadge
        status="apta"
        code="ST01-001"
      />,
    );

    const badge = screen.getByText(/apta/i);
    expect(badge).toBeInTheDocument();
    expect(badge.parentElement).toHaveClass("text-emerald-300");
  });

  it("renderiza o selo 'Em revisão' com contagem opcional de cláusulas", () => {
    render(
      <CardPlayabilityBadge
        status="revisao"
        code="EB01-003"
        missingClauses={["When Destroyed: draw 1 card", "Main: rest this unit"]}
        showMissingCount
      />,
    );

    expect(screen.getByText(/em revisão \(2\)/i)).toBeInTheDocument();
  });

  it("renderiza o selo 'Fora do simulador' para cartas não catalogadas", () => {
    render(
      <CardPlayabilityBadge
        status="fora"
        code="UNKNOWN-001"
      />,
    );

    const badge = screen.getByText(/fora do simulador/i);
    expect(badge).toBeInTheDocument();
    expect(badge.parentElement).toHaveClass("text-slate-400");
  });

  it("respeita a prop size (xs, sm, md)", () => {
    const { rerender } = render(
      <CardPlayabilityBadge status="apta" size="xs" />,
    );
    expect(screen.getByText("Apta")).toBeInTheDocument();

    rerender(<CardPlayabilityBadge status="apta" size="md" />);
    expect(screen.getByText(/apta para jogar/i)).toBeInTheDocument();
  });
});

describe("CardPlayabilityDetailBox — Painel detalhado de jogabilidade para CardDetail", () => {
  it("renderiza detalhes de carta apta confirmando liberação no simulador", () => {
    render(
      <CardPlayabilityDetailBox
        code="ST01-001"
        entry={{
          code: "ST01-001",
          status: "apta",
          set: "ST01",
        }}
      />,
    );

    expect(screen.getByText(/carta 100% pronta para jogar/i)).toBeInTheDocument();
    expect(screen.getByText(/todas as regras, gatilhos e efeitos/i)).toBeInTheDocument();
  });

  it("renderiza lista de cláusulas pendentes para carta em revisão", () => {
    render(
      <CardPlayabilityDetailBox
        code="EB01-003"
        entry={{
          code: "EB01-003",
          status: "revisao",
          set: "EB01",
          totalClauses: 3,
          implementedClauses: 1,
          missingClauses: [
            "【Deploy】 Exile 1 G-Generation card from trash.",
            "【When Attacking】 Deal 1000 damage.",
          ],
        }}
      />,
    );

    expect(screen.getByText(/carta em revisão no motor do simulador/i)).toBeInTheDocument();
    expect(screen.getByText(/1 de 3 cláusulas/i)).toBeInTheDocument();
    expect(screen.getByText(/o que falta implementar no simulador/i)).toBeInTheDocument();
    expect(screen.getByText(/"【Deploy】 Exile 1 G-Generation card from trash."/i)).toBeInTheDocument();
    expect(screen.getByText(/"【When Attacking】 Deal 1000 damage."/i)).toBeInTheDocument();
  });

  it("renderiza aviso para carta fora do simulador", () => {
    render(
      <CardPlayabilityDetailBox
        code="ST11-001"
        entry={{
          code: "ST11-001",
          status: "fora",
          set: "ST11",
        }}
      />,
    );

    expect(screen.getByText(/fora do catálogo ativo do simulador/i)).toBeInTheDocument();
  });
});

describe("SetPlayabilityProgress — Progresso de implementação por set", () => {
  it("renderiza o painel de coleções com dados do hook", () => {
    vi.spyOn(cardPlayabilityModule, "useAllCardsPlayability").mockReturnValue({
      cards: {},
      sets: {
        ST01: { set: "ST01", total: 16, aptas: 16, revisao: 0, fora: 0, percentAptas: 100 },
        EB01: { set: "EB01", total: 90, aptas: 59, revisao: 31, fora: 0, percentAptas: 65.6 },
      },
      summary: { total: 106, aptas: 75, revisao: 31, fora: 0, percentAptas: 70.8 },
      isLoading: false,
      isReady: true,
    });

    render(<SetPlayabilityProgress defaultOpen />);

    expect(screen.getByText(/progresso de implementação por coleção/i)).toBeInTheDocument();
    expect(screen.getByText(/70.8% das cartas prontas/i)).toBeInTheDocument();
    expect(screen.getByText("ST01")).toBeInTheDocument();
    expect(screen.getByText("EB01")).toBeInTheDocument();
    expect(screen.getByText("65.6%")).toBeInTheDocument();
    expect(screen.getAllByText(/31 em revisão/i).length).toBeGreaterThanOrEqual(1);
  });
});

describe("Critérios de aceite da Fase 2 (A3)", () => {
  it("sem lista fixa de cartas no front: o selo reflete dinamicamente a resposta da API", () => {
    // Simula uma carta de EB01 mudando para 'apta' quando o motor fecha o set
    const { rerender } = render(
      <CardPlayabilityBadge
        code="EB01-050"
        entry={{ code: "EB01-050", status: "revisao", set: "EB01" }}
      />,
    );
    expect(screen.getByText(/em revisão/i)).toBeInTheDocument();

    // Quando o motor atualiza a carta para apta, a UI reflete sem alteração de código
    rerender(
      <CardPlayabilityBadge
        code="EB01-050"
        entry={{ code: "EB01-050", status: "apta", set: "EB01" }}
      />,
    );
    expect(screen.getByText(/apta/i)).toBeInTheDocument();
  });

  it("renderiza link para a base de regras quando asLink=true", () => {
    render(
      <CardPlayabilityBadge
        status="apta"
        code="ST01-001"
        asLink
      />,
    );

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/rules");
  });

  it("fornece texto descritivo de tooltip em pt-BR para acessibilidade", () => {
    render(
      <CardPlayabilityBadge
        status="apta"
        code="ST01-001"
      />,
    );

    const trigger = screen.getByTitle(/apta para jogar no simulador/i);
    expect(trigger).toBeInTheDocument();
  });
});
