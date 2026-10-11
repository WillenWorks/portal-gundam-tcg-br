import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { vedaApi, VedaApiError } from "@/lib/veda/api";

describe("vedaApi client", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("getSummary faz GET em /api/veda/summary", async () => {
    const mockSummary = {
      sample: { lists: 100, tournaments: 10, from: null, to: null, small: false },
      players: 80,
      seasons: [],
      sources: [],
      lastTournamentDate: null,
      updatedAt: null,
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockSummary,
    } as Response);

    const result = await vedaApi.getSummary();
    expect(result).toEqual(mockSummary);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/veda/summary"),
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("getTournaments serializa query params corretamente", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [], total: 0, offset: 0, limit: 24, hasMore: false }),
    } as Response);

    await vedaApi.getTournaments({
      season: "GD05",
      tier: "LARGE_OFFICIAL",
      uf: "SP",
      limit: 10,
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/veda\/tournaments\?.*season=GD05.*tier=LARGE_OFFICIAL.*uf=SP.*limit=10/),
      expect.anything(),
    );
  });

  it("getTournament codifica o id do torneio", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "tourney-1/xyz", name: "Regional" }),
    } as Response);

    await vedaApi.getTournament("tourney-1/xyz");
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/veda/tournaments/tourney-1%2Fxyz"),
      expect.anything(),
    );
  });

  it("lança VedaApiError com a mensagem de erro do servidor em caso de 404", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: "Torneio não encontrado." }),
    } as Response);

    await expect(vedaApi.getTournament("inexistente")).rejects.toThrowError(VedaApiError);
    await expect(vedaApi.getTournament("inexistente")).rejects.toThrow("Torneio não encontrado.");
  });
});
