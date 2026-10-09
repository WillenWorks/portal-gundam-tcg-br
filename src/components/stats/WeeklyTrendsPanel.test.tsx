// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { WeeklyTrendsPanel } from "./WeeklyTrendsPanel";
import { api, type WeeklyTrendsResponse } from "@/lib/api";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  document.body.innerHTML = "";
  document.body.removeAttribute("data-scroll-locked");
  document.body.style.pointerEvents = "";
});

const mockWeeklyTrendsData: WeeklyTrendsResponse = {
  season: { id: "s1", code: "GD01", name: "Gundam Format 1" },
  seasonId: "s1",
  tier: null,
  weightNote: "Cada lista conta igual, independente do tamanho do torneio.",
  weeks: [
    {
      weekKey: "2026-W11",
      weekLabel: "Semana 11 (09/03 a 15/03)",
      startDate: "2026-03-09T00:00:00.000Z",
      endDate: "2026-03-15T23:59:59.999Z",
      totalLists: 16,
      totalEvents: 2,
      isSmallSample: false,
      sampleWarning: null,
      archetypes: [
        {
          name: "Earth Federation Agro",
          colors: ["Azul"],
          lists: 8,
          share: 0.5,
          winRate: 0.62,
          isSmallSample: false,
        },
        {
          name: "Zeon Rush",
          colors: ["Vermelho"],
          lists: 5,
          share: 0.3125,
          winRate: 0.55,
          isSmallSample: false,
        },
        {
          name: "Tech Wing Control",
          colors: ["Verde"],
          lists: 2,
          share: 0.125,
          winRate: 0.5,
          isSmallSample: true,
        },
      ],
    },
    {
      weekKey: "2026-W12",
      weekLabel: "Semana 12 (16/03 a 22/03)",
      startDate: "2026-03-16T00:00:00.000Z",
      endDate: "2026-03-22T23:59:59.999Z",
      totalLists: 4,
      totalEvents: 1,
      isSmallSample: true,
      sampleWarning: "Amostra preliminar (< 6 listas nesta semana). Sujeito a alta volatilidade.",
      archetypes: [
        {
          name: "Earth Federation Agro",
          colors: ["Azul"],
          lists: 3,
          share: 0.75,
          winRate: 0.67,
          isSmallSample: false,
        },
        {
          name: "Zeon Rush",
          colors: ["Vermelho"],
          lists: 1,
          share: 0.25,
          winRate: 0.4,
          isSmallSample: true,
        },
      ],
    },
  ],
  topArchetypes: ["Earth Federation Agro", "Zeon Rush", "Tech Wing Control"],
  provenance: {
    totalDecks: 20,
    totalTournaments: 3,
    startDate: "2026-03-09T00:00:00.000Z",
    endDate: "2026-03-22T23:59:59.999Z",
    tournaments: [
      {
        id: "t-1",
        name: "Regional São Paulo",
        date: "2026-03-10T14:00:00.000Z",
        organizer: "Bandai",
        playerCount: 64,
        deckCount: 16,
        tier: "LARGE_OFFICIAL",
        sourceUrl: "https://bandai.com/sp",
      },
      {
        id: "t-2",
        name: "Store Cup SP",
        date: "2026-03-18T19:00:00.000Z",
        organizer: "Loja Parceira",
        playerCount: 16,
        deckCount: 4,
        tier: "SMALL_OFFICIAL",
        sourceUrl: null,
      },
    ],
  },
};

describe("WeeklyTrendsPanel", () => {
  beforeEach(() => {
    vi.spyOn(api, "getWeeklyTrends").mockResolvedValue(mockWeeklyTrendsData);
  });

  it("renderiza o painel de evolução semanal com cabeçalho e chamada de API", async () => {
    render(<WeeklyTrendsPanel seasonId="s1" />);

    expect(screen.getByText(/CONSOLIDANDO SÉRIE TEMPORAL SEMANAL.../i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/Evolução Semanal dos Arquétipos/i)).toBeInTheDocument();
      expect(screen.getByText(/Semana 11 \(09\/03 a 15\/03\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Semana 12 \(16\/03 a 22\/03\)/i)).toBeInTheDocument();
    });

    expect(api.getWeeklyTrends).toHaveBeenCalledWith({
      seasonId: "s1",
      tier: undefined,
      startDate: undefined,
      endDate: undefined,
    });
  });

  it("exibe proveniência de dados e nota de ponderação amostral", async () => {
    render(<WeeklyTrendsPanel seasonId="s1" />);

    await waitFor(() => {
      expect(screen.getByText(/Série temporal semanal baseada em 20 listas de 3 torneios/i)).toBeInTheDocument();
      expect(screen.getByText(/Cada lista conta igual, independente do tamanho do torneio/i)).toBeInTheDocument();
    });
  });

  it("sinaliza amostra robusta vs amostra preliminar (< 6 listas) nas semanas", async () => {
    render(<WeeklyTrendsPanel seasonId="s1" />);

    await waitFor(() => {
      // Semana 11 tem 16 listas -> Amostra Robusta
      expect(screen.getByText(/Amostra Robusta/i)).toBeInTheDocument();
      // Semana 12 tem 4 listas -> Amostra preliminar
      expect(screen.getByText(/Amostra preliminar \(4 listas\)/i)).toBeInTheDocument();
    });
  });

  it("sinaliza 'Poucos dados' para arquétipos com menos de 3 listas na semana", async () => {
    render(<WeeklyTrendsPanel seasonId="s1" />);

    await waitFor(() => {
      const fewDataBadges = screen.getAllByText(/Poucos dados/i);
      expect(fewDataBadges.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("permite alternar entre visualização por semana e modo comparativo em tabela", async () => {
    render(<WeeklyTrendsPanel seasonId="s1" />);

    await waitFor(() => {
      expect(screen.getByText(/Semana 11 \(09\/03 a 15\/03\)/i)).toBeInTheDocument();
    });

    // Clica no botão "Comparativo"
    const compareButton = screen.getByRole("button", { name: /Comparativo/i });
    fireEvent.click(compareButton);

    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText(/Arquétipo Líder/i)).toBeInTheDocument();
    expect(screen.getByText(/Amostra reduzida/i)).toBeInTheDocument();
    expect(screen.getByText(/Amostra robusta/i)).toBeInTheDocument();

    // Volta para o modo Por Semana
    const weeksButton = screen.getByRole("button", { name: /Por Semana/i });
    fireEvent.click(weeksButton);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("filtra por arquétipo selecionado na barra de filtros", async () => {
    render(<WeeklyTrendsPanel seasonId="s1" />);

    await waitFor(() => {
      expect(screen.getByText("Tech Wing Control", { selector: "span" })).toBeInTheDocument();
    });

    // Seleciona arquétipo "Zeon Rush"
    const archetypeSelect = screen.getByDisplayValue(/Todos os Arquétipos/i);
    fireEvent.change(archetypeSelect, { target: { value: "Zeon Rush" } });

    // Tech Wing Control não deve aparecer mais nos cards de arquétipos
    expect(screen.queryByText("Tech Wing Control", { selector: "span" })).not.toBeInTheDocument();
    expect(screen.getAllByText("Zeon Rush", { selector: "span" }).length).toBeGreaterThanOrEqual(1);

    // Botão limpar filtros deve aparecer
    const clearButton = screen.getByRole("button", { name: /Limpar filtros/i });
    fireEvent.click(clearButton);
    expect(screen.getByText("Tech Wing Control", { selector: "span" })).toBeInTheDocument();
  });
});
