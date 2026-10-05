// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DataSourceNote } from "./DataSourceNote";
import type { MetagameProvenance } from "@/lib/api";

afterEach(cleanup);

const mockProvenance: MetagameProvenance = {
  totalDecks: 24,
  totalTournaments: 3,
  startDate: "2026-03-01T12:00:00.000Z",
  endDate: "2026-03-15T12:00:00.000Z",
  tournaments: [
    {
      id: "t1",
      name: "Regional São Paulo Gundam 2026",
      date: "2026-03-01T12:00:00.000Z",
      organizer: "Bandai Namco BR",
      playerCount: 64,
      deckCount: 16,
      tier: "LARGE_OFFICIAL",
      sourceUrl: "https://tcg.bandai.co.jp/events/sp2026",
    },
    {
      id: "t2",
      name: "Store Championship Tokyo Toys",
      date: "2026-03-08T12:00:00.000Z",
      organizer: "Tokyo Toys Campinas",
      playerCount: 16,
      deckCount: 4,
      tier: "SMALL_OFFICIAL",
      sourceUrl: null,
    },
    {
      id: "t3",
      name: "Torneio Semanal Anime Geek",
      date: "2026-03-15T12:00:00.000Z",
      organizer: "Anime Geek Curitiba",
      playerCount: 12,
      deckCount: 4,
      tier: "COMMUNITY",
      sourceUrl: "https://animegeek.com.br/torneios/42",
    },
  ],
};

describe("DataSourceNote", () => {
  it("renderiza resumo textual inline com contagem de decks, torneios e intervalo de datas", () => {
    render(<DataSourceNote provenance={mockProvenance} />);

    expect(
      screen.getByText(/Baseado em 24 listas de 3 torneios \(de 01\/03\/2026 a 15\/03\/2026\)/i)
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ver 3 torneios/i })).toBeInTheDocument();
  });

  it("renderiza variante banner com título e nota de ponderação amostral", () => {
    render(
      <DataSourceNote
        provenance={mockProvenance}
        variant="banner"
        weightNote="Torneios maiores pesam mais na computação."
      />
    );

    expect(screen.getByText(/Transparência de Metagame & Proveniência/i)).toBeInTheDocument();
    expect(screen.getByText(/Torneios maiores pesam mais na computação\./i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Inspecionar 3 torneios/i })).toBeInTheDocument();
  });

  it("abre o diálogo expansível ao clicar e exibe dados dos torneios", () => {
    render(<DataSourceNote provenance={mockProvenance} />);

    const openBtn = screen.getByRole("button", { name: /Ver 3 torneios/i });
    fireEvent.click(openBtn);

    // Diálogo aberto
    expect(screen.getByText(/Proveniência e Origem dos Dados Competitivos/i)).toBeInTheDocument();
    expect(screen.getByText("Regional São Paulo Gundam 2026")).toBeInTheDocument();
    expect(screen.getByText("Bandai Namco BR")).toBeInTheDocument();
    expect(screen.getByText("Store Championship Tokyo Toys")).toBeInTheDocument();
    expect(screen.getByText("Torneio Semanal Anime Geek")).toBeInTheDocument();

    // Link da fonte oficial
    const links = screen.getAllByRole("link", { name: /Fonte Oficial/i });
    expect(links.length).toBe(2);
    expect(links[0]).toHaveAttribute("href", "https://tcg.bandai.co.jp/events/sp2026");
  });

  it("filtra a lista de torneios no diálogo pelo campo de busca", () => {
    render(<DataSourceNote provenance={mockProvenance} />);

    fireEvent.click(screen.getByRole("button", { name: /Ver 3 torneios/i }));

    const searchInput = screen.getByPlaceholderText(/Buscar torneio ou organizador/i);
    fireEvent.change(searchInput, { target: { value: "Tokyo" } });

    expect(screen.getByText("Store Championship Tokyo Toys")).toBeInTheDocument();
    expect(screen.queryByText("Regional São Paulo Gundam 2026")).not.toBeInTheDocument();
    expect(screen.queryByText("Torneio Semanal Anime Geek")).not.toBeInTheDocument();
  });

  it("exibe mensagem adequada quando amostragem está vazia", () => {
    render(<DataSourceNote totalDecks={0} totalTournaments={0} />);

    expect(screen.getByText(/Amostragem em processamento para este recorte\./i)).toBeInTheDocument();
  });
});
