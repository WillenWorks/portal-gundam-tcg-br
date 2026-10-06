// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { FormatArchetypeCoresPanel } from "./FormatArchetypeCoresPanel";
import { api, type FormatMetaResponse } from "@/lib/api";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  document.body.innerHTML = "";
  document.body.removeAttribute("data-scroll-locked");
  document.body.style.pointerEvents = "";
});

const mockFormatList = [
  {
    format: "GD01",
    totalLists: 400,
    totalEvents: 45,
    archetypeCount: 12,
    topArchetypes: [
      { name: "Earth Federation Agro", share: 0.28, colors: ["Azul"] },
      { name: "Zeon Rush", share: 0.22, colors: ["Vermelho"] },
    ],
  },
  {
    format: "GD02",
    totalLists: 350,
    totalEvents: 38,
    archetypeCount: 15,
    topArchetypes: [
      { name: "Earth Federation Agro", share: 0.24, colors: ["Azul"] },
    ],
  },
];

const mockFormatMetaGD01: FormatMetaResponse = {
  format: "GD01",
  totalLists: 400,
  totalEvents: 45,
  generatedAt: "2026-03-20T00:00:00.000Z",
  sourceUrl: "https://gundam-tcg.com/events/gd01",
  provenance: {
    totalDecks: 400,
    totalTournaments: 45,
    startDate: "2026-01-01T00:00:00.000Z",
    endDate: "2026-03-01T00:00:00.000Z",
    tournaments: [
      {
        id: "ev-1",
        name: "Torneio GD01 Open",
        date: "2026-01-15T00:00:00.000Z",
        organizer: "Bandai",
        playerCount: 128,
        deckCount: 32,
        tier: "LARGE_OFFICIAL",
        sourceUrl: "https://gundam-tcg.com/events/gd01/1",
      },
    ],
  },
  archetypes: [
    {
      id: "ef-agro",
      name: "Earth Federation Agro",
      colors: ["Azul"],
      keyCard: "GD01-001",
      keyCardDetail: {
        code: "GD01-001",
        name: "RX-78-2 Gundam",
        namePt: "Gundam RX-78-2",
        imageUrl: "/rx78.png",
        imageMediumUrl: "/rx78-m.png",
        color: "Azul",
        cardType: "Unit",
        cost: 3,
        level: 3,
        tier: "core" as const,
        inclusionRate: 0.98,
        modeCopies: 4,
        avgCopies: 3.9,
      },
      lists: 112,
      share: 0.28,
      top8Share: 0.35,
      winShare: 0.32,
      points: 420.5,
      isSmallSample: false,
      sampleWarning: null,
      cards: {
        core: [
          {
            code: "GD01-001",
            name: "RX-78-2 Gundam",
            namePt: "Gundam RX-78-2",
            imageUrl: "/rx78.png",
            imageMediumUrl: "/rx78-m.png",
            color: "Azul",
            cardType: "Unit",
            cost: 3,
            level: 3,
            tier: "core" as const,
            inclusionRate: 0.98,
            modeCopies: 4,
            avgCopies: 3.9,
          },
        ],
        flex: [
          {
            code: "GD01-005",
            name: "Guncannon",
            namePt: "Guncannon Suporte",
            imageUrl: "/gc.png",
            imageMediumUrl: "/gc-m.png",
            color: "Azul",
            cardType: "Unit",
            cost: 2,
            level: 2,
            tier: "flex" as const,
            inclusionRate: 0.65,
            modeCopies: 3,
            avgCopies: 2.8,
          },
        ],
        tech: [
          {
            code: "GD01-020",
            name: "Hyper Bazooka",
            namePt: "Hiper Bazuca",
            imageUrl: "/hb.png",
            imageMediumUrl: "/hb-m.png",
            color: "Azul",
            cardType: "Command",
            cost: 1,
            level: null,
            tier: "tech" as const,
            inclusionRate: 0.22,
            modeCopies: 2,
            avgCopies: 1.5,
          },
        ],
      },
      medianDecklist: {
        "GD01-001": 4,
        "GD01-005": 3,
        "GD01-020": 2,
      },
    },
    {
      id: "rare-rogue",
      name: "Rogue Hybrid Strike",
      colors: ["Vermelho", "Branco"],
      keyCard: "GD01-099",
      keyCardDetail: null,
      lists: 6,
      share: 0.015,
      top8Share: 0.01,
      winShare: 0.012,
      points: 15.0,
      isSmallSample: true,
      sampleWarning: "Amostra pequena (< 10 listas no formato)",
      cards: {
        core: [],
        flex: [],
        tech: [],
      },
      medianDecklist: {
        "GD01-099": 3,
      },
    },
  ],
};

const mockEvolution = [
  {
    name: "Earth Federation Agro",
    colors: ["Azul"],
    points: [
      { format: "GD01", lists: 112, share: 0.28, top8Share: 0.35, winShare: 0.32, points: 420.5 },
      { format: "GD02", lists: 84, share: 0.24, top8Share: 0.26, winShare: 0.25, points: 310.0 },
    ],
  },
];

describe("FormatArchetypeCoresPanel", () => {
  beforeEach(() => {
    vi.spyOn(api, "getFormatList").mockResolvedValue(mockFormatList);
    vi.spyOn(api, "getFormatMeta").mockResolvedValue(mockFormatMetaGD01);
    vi.spyOn(api, "getFormatEvolution").mockResolvedValue(mockEvolution);
  });

  it("renderiza o painel de formatos com abas e estatísticas do formato selecionado", async () => {
    render(<FormatArchetypeCoresPanel />);

    await waitFor(() => {
      expect(screen.getByText(/Metagame por Formato & Núcleos de Arquétipo/i)).toBeInTheDocument();
      expect(screen.getByText("Earth Federation Agro")).toBeInTheDocument();
      expect(screen.getByText("Rogue Hybrid Strike")).toBeInTheDocument();
    });

    // Proporções exibidas (formatadas como XX.X%)
    expect(screen.getByText("28.0%")).toBeInTheDocument(); // Meta share
    expect(screen.getByText("35.0%")).toBeInTheDocument(); // Top cut
    expect(screen.getByText("32.0%")).toBeInTheDocument(); // Win share
  });

  it("sinaliza arquétipos com amostra pequena de forma destacada", async () => {
    render(<FormatArchetypeCoresPanel />);

    await waitFor(() => {
      expect(screen.getByText("Rogue Hybrid Strike")).toBeInTheDocument();
    });

    // Badge de poucos dados
    const smallSampleBadges = screen.getAllByText(/Poucos dados/i);
    expect(smallSampleBadges.length).toBeGreaterThan(0);
  });

  it("abre modal para explorar o núcleo do arquétipo com divisão em Core, Flex e Tech", async () => {
    render(<FormatArchetypeCoresPanel />);

    await waitFor(() => {
      expect(screen.getByText("Earth Federation Agro")).toBeInTheDocument();
    });

    // Clicar em "Explorar Núcleo Completo"
    const exploreButtons = screen.getAllByRole("button", { name: /Explorar Núcleo/i });
    fireEvent.click(exploreButtons[0]);

    // Modal aberto
    await waitFor(() => {
      const dialog = screen.getByRole("dialog");
      expect(dialog).toBeInTheDocument();
      expect(dialog.textContent).toContain("Núcleo do Arquétipo");
      expect(dialog.textContent).toContain("Cartas Núcleo");
      expect(dialog.textContent).toContain("Slots de Ajuste Fino");
      expect(dialog.textContent).toContain("Ferramentas Específicas");
      expect(dialog.textContent).toContain("Gundam RX-78-2");
      expect(dialog.textContent).toContain("Guncannon");
      expect(dialog.textContent).toContain("Hiper Bazuca");
    });
  });

  it("abre modal de lista consensual mediana com contagem de cópias", async () => {
    render(<FormatArchetypeCoresPanel />);

    await waitFor(() => {
      expect(screen.getByText("Earth Federation Agro")).toBeInTheDocument();
    });

    // Clicar em "Lista Mediana Consolidada"
    const medianButtons = screen.getAllByRole("button", { name: /Lista Mediana/i });
    fireEvent.click(medianButtons[0]);

    await waitFor(() => {
      const dialog = screen.getByRole("dialog");
      expect(dialog).toBeInTheDocument();
      expect(dialog.textContent).toContain("Lista Mediana");
      expect(dialog.textContent).toContain("GD01-001");
      expect(dialog.textContent).toContain("4x");
    });
  });

  it("permite alternar para a visão de evolução temporal entre formatos GD01-GD05", async () => {
    render(<FormatArchetypeCoresPanel />);

    await waitFor(() => {
      expect(screen.getByText(/Metagame por Formato & Núcleos de Arquétipo/i)).toBeInTheDocument();
    });

    const evolutionTabBtn = screen.getByRole("button", { name: /Evolução Temporal/i });
    fireEvent.click(evolutionTabBtn);

    await waitFor(() => {
      expect(screen.getByText(/Trajetória de Relevância por Formato/i)).toBeInTheDocument();
      expect(screen.getByText("Earth Federation Agro")).toBeInTheDocument();
    });
  });
});
