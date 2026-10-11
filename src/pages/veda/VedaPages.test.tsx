// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: null,
    isAuthenticated: false,
    login: vi.fn(),
    loginWithGoogle: vi.fn(),
    register: vi.fn(),
    refreshMe: vi.fn(),
    setCurrentUser: vi.fn(),
    logout: vi.fn(),
  }),
  AuthProvider: ({ children }: any) => children,
}));

vi.mock("@/contexts/ThemeContext", () => ({
  useTheme: () => ({
    theme: "dark",
    setTheme: vi.fn(),
    systemTheme: "dark",
  }),
  ThemeProvider: ({ children }: any) => children,
}));

import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import VedaTournamentsPage from "@/pages/veda/VedaTournamentsPage";
import VedaTournamentReportPage from "@/pages/veda/VedaTournamentReportPage";
import VedaDecklistPage from "@/pages/veda/VedaDecklistPage";
import VedaPlayerPage from "@/pages/veda/VedaPlayerPage";
import VedaArchetypesPage from "@/pages/veda/VedaArchetypesPage";
import VedaArchetypeDetailPage from "@/pages/veda/VedaArchetypeDetailPage";
import { vedaApi } from "@/lib/veda/api";

function renderWithRoute(ui: React.ReactElement, path: string) {
  const { hook } = memoryLocation({ path });
  return render(<Router hook={hook}>{ui}</Router>);
}

describe("Páginas Públicas Veda", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("VedaTournamentsPage", () => {
    it("renderiza a página e carrega os torneios", async () => {
      vi.spyOn(vedaApi, "getFilters").mockResolvedValue({
        seasons: [{ code: "GD05", name: "Temporada GD05", isCurrent: true }],
        tiers: ["LARGE_OFFICIAL"],
        sources: [{ id: "digilab", name: "DigiLab", attribution: "Dados: DigiLab (digilab.cards)", url: "https://digilab.cards" }],
        countries: ["Brasil"],
        ufs: [{ uf: "SP", cities: ["São Paulo"] }],
        stores: [],
      });

      vi.spyOn(vedaApi, "getTournaments").mockResolvedValue({
        items: [
          {
            id: "event-1",
            name: "Regional São Paulo GD05",
            date: "2026-10-10T00:00:00.000Z",
            tier: "LARGE_OFFICIAL",
            season: "GD05",
            place: { city: "São Paulo", uf: "SP", country: "Brasil", store: "Loja Alpha" },
            participantCount: 32,
            entriesCount: 32,
            decklistsCount: 28,
            winner: {
              player: { name: "Kira Yamato", slug: "kira-yamato" },
              archetype: { name: "Freedom Rush", slug: "freedom-rush", colors: ["Blue", "White"] },
              entryId: "entry-1",
            },
            source: { id: "digilab", name: "DigiLab", attribution: "Dados: DigiLab (digilab.cards)", url: "https://digilab.cards/event/1" },
            sourceUrl: "https://digilab.cards/event/1",
          },
        ],
        total: 1,
        offset: 0,
        limit: 24,
        hasMore: false,
      });

      renderWithRoute(<VedaTournamentsPage />, "/torneios");

      await waitFor(() => {
        expect(screen.getByText("Regional São Paulo GD05")).toBeDefined();
        expect(screen.getByText("Kira Yamato")).toBeDefined();
        expect(screen.getByText("Freedom Rush")).toBeDefined();
      });
    });
  });

  describe("VedaTournamentReportPage", () => {
    it("renderiza o report do evento com quebra de meta e campeão", async () => {
      vi.spyOn(vedaApi, "getTournament").mockResolvedValue({
        id: "event-1",
        name: "Championship Campinas",
        date: "2026-10-05T00:00:00.000Z",
        tier: "LARGE_OFFICIAL",
        season: "GD05",
        place: { city: "Campinas", uf: "SP", country: "Brasil", store: "Loja Beta" },
        participantCount: 40,
        entriesCount: 40,
        decklistsCount: 35,
        roundCount: 6,
        winner: {
          player: { name: "Athrun Zala", slug: "athrun-zala" },
          archetype: { name: "Justice Control", slug: "justice-control", colors: ["Red"] },
          entryId: "entry-champ",
        },
        source: { id: "digilab", name: "DigiLab", attribution: "Dados: DigiLab (digilab.cards)", url: "https://digilab.cards" },
        sourceUrl: "https://digilab.cards/event/beta",
        meta: [
          {
            archetype: { name: "Justice Control", slug: "justice-control", colors: ["Red"] },
            count: 10,
            share: 0.25,
            bestPlacement: 1,
          },
        ],
        standings: [
          {
            entryId: "entry-champ",
            placement: 1,
            placementLabel: "1º",
            player: { name: "Athrun Zala", slug: "athrun-zala" },
            archetype: { name: "Justice Control", slug: "justice-control", colors: ["Red"] },
            record: "6-0-0",
            hasDecklist: true,
          },
        ],
      });

      renderWithRoute(<VedaTournamentReportPage />, "/torneios/event-1");

      await waitFor(() => {
        expect(screen.getAllByText("Championship Campinas").length).toBeGreaterThan(0);
        expect(screen.getAllByText("Athrun Zala").length).toBeGreaterThan(0);
        expect(screen.getByText(/Inspecionar Decklist Campeã/i)).toBeDefined();
        expect(screen.getByText("Divisão do Metagame do Torneio")).toBeDefined();
      });
    });
  });

  describe("VedaDecklistPage", () => {
    it("renderiza os grupos de cartas e curva de energia", async () => {
      vi.spyOn(vedaApi, "getDecklist").mockResolvedValue({
        entryId: "entry-123",
        tournament: {
          id: "event-1",
          name: "Torneio Teste",
          date: "2026-10-01T00:00:00.000Z",
          season: "GD05",
          place: { city: "Curitiba", uf: "PR", country: "Brasil", store: null },
        },
        player: { name: "Heero Yuy", slug: "heero-yuy" },
        placement: 1,
        placementLabel: "1º",
        record: "5-0",
        archetype: { name: "Wing Beatdown", slug: "wing-beatdown", colors: ["White", "Green"] },
        colors: ["White", "Green"],
        totalCards: 50,
        groups: [
          {
            cardType: "UNIT",
            count: 30,
            cards: [
              {
                cardModelId: "cm-wing",
                code: "GD01-001",
                name: "Wing Gundam",
                namePt: "Wing Gundam",
                cardType: "UNIT",
                color: "White",
                level: 5,
                cost: 4,
                quantity: 4,
                imageUrl: "https://example.com/wing.jpg",
              },
            ],
          },
        ],
        curve: { "4": 4 },
        deckCode: "GD01-001:4",
        source: { id: "egman", name: "Egman Events", attribution: "Fonte: Egman Events", url: null },
        sourceUrl: null,
      });

      renderWithRoute(<VedaDecklistPage />, "/torneios/event-1/lista/entry-123");

      await waitFor(() => {
        expect(screen.getAllByText("Wing Gundam").length).toBeGreaterThan(0);
        expect(screen.getByText("Copiar para o Deckbuilder")).toBeDefined();
        expect(screen.getByText("Curva de Custo de Energia")).toBeDefined();
      });
    });
  });

  describe("VedaPlayerPage", () => {
    it("renderiza o perfil do jogador e o aviso de homônimos", async () => {
      vi.spyOn(vedaApi, "getPlayer").mockResolvedValue({
        player: { name: "Setsuna F. Seiei", slug: "setsuna-f-seiei" },
        tournaments: 12,
        wins: 3,
        top8: 8,
        archetypes: [
          {
            archetype: { name: "Exia Aggro", slug: "exia-aggro", colors: ["Blue"] },
            count: 10,
          },
        ],
        results: [
          {
            tournamentId: "event-exia",
            tournamentName: "Copa Gundam",
            date: "2026-09-20T00:00:00.000Z",
            season: "GD04",
            place: { city: "Belo Horizonte", uf: "MG", country: "Brasil", store: null },
            entryId: "entry-exia-1",
            placement: 1,
            placementLabel: "1º",
            archetype: { name: "Exia Aggro", slug: "exia-aggro", colors: ["Blue"] },
            record: "5-0",
            hasDecklist: true,
          },
        ],
        nameMayBeShared: true,
      });

      renderWithRoute(<VedaPlayerPage />, "/jogadores/setsuna-f-seiei");

      await waitFor(() => {
        expect(screen.getAllByText("Setsuna F. Seiei").length).toBeGreaterThan(0);
        expect(screen.getAllByText("Exia Aggro").length).toBeGreaterThan(0);
        expect(screen.getByText(/Homônimos podem ser agrupados/i)).toBeDefined();
      });
    });
  });

  describe("VedaArchetypesPage e VedaArchetypeDetailPage", () => {
    it("renderiza ranking em VedaArchetypesPage", async () => {
      vi.spyOn(vedaApi, "getFilters").mockResolvedValue({
        seasons: [{ code: "GD05", name: "GD05", isCurrent: true }],
        tiers: ["LARGE_OFFICIAL"],
        sources: [],
        countries: [],
        ufs: [],
        stores: [],
      });

      vi.spyOn(vedaApi, "getArchetypes").mockResolvedValue([
        {
          archetype: { name: "Zeon Rush", slug: "zeon-rush", colors: ["Red"] },
          lists: 50,
          share: 0.35,
          top8Share: 0.6,
          wins: 5,
          winShare: 0.4,
          bestPlacement: 1,
        },
      ]);

      renderWithRoute(<VedaArchetypesPage />, "/arquetipos");

      await waitFor(() => {
        expect(screen.getByText("Zeon Rush")).toBeDefined();
        expect(screen.getByText("35.0%")).toBeDefined();
      });
    });

    it("renderiza anatomia de cartas em VedaArchetypeDetailPage", async () => {
      vi.spyOn(vedaApi, "getArchetype").mockResolvedValue({
        row: {
          archetype: { name: "Zeon Rush", slug: "zeon-rush", colors: ["Red"] },
          lists: 50,
          share: 0.35,
          top8Share: 0.6,
          wins: 5,
          winShare: 0.4,
          bestPlacement: 1,
        },
        sample: { lists: 50, tournaments: 10, from: null, to: null, small: false },
        cards: [
          {
            card: {
              cardModelId: "cm-zaku",
              code: "ST01-001",
              name: "Zaku II",
              namePt: "Zaku II",
              cardType: "UNIT",
              color: "Red",
              level: 2,
              cost: 1,
              quantity: 4,
              imageUrl: null,
            },
            inclusion: 0.95,
            avgCopies: 3.9,
            tier: "core",
          },
        ],
        recentResults: [],
        sampleDecklists: [],
      });

      renderWithRoute(<VedaArchetypeDetailPage />, "/arquetipos/zeon-rush");

      await waitFor(() => {
        expect(screen.getAllByText("Zeon Rush").length).toBeGreaterThan(0);
        expect(screen.getAllByText("Zaku II").length).toBeGreaterThan(0);
        expect(screen.getByText("Núcleo")).toBeDefined();
        expect(screen.getByText("95%")).toBeDefined();
      });
    });
  });
});
