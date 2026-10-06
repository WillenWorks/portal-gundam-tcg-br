import { describe, it, expect, vi, beforeEach } from "vitest";
import { loadSimulatorCardLookup, CANONICAL_ART_ALIASES } from "./cardArtService";
import { api } from "@/lib/api";

vi.mock("@/lib/api", () => ({
  api: {
    listCards: vi.fn(),
  },
}));

describe("cardArtService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("carrega cartas e resolve aliases e traduções pré-compiladas", async () => {
    vi.mocked(api.listCards).mockResolvedValue([
      {
        code: "ST01-001",
        imageUrl: "https://example.com/st01-001.jpg",
        nameEn: "Gundam",
      },
      {
        code: "GD02-001",
        imageUrl: "https://example.com/gd02-001.jpg",
        nameEn: "Zeta Gundam",
        effectEn: "Deploy effect",
      },
      {
        code: "R-001",
        imageUrl: "https://example.com/r-001.jpg",
        nameEn: "Resource",
      },
      {
        code: "EXB-001",
        imageUrl: "https://example.com/exb-001.jpg",
        nameEn: "EX Base",
      },
    ]);

    const result = await loadSimulatorCardLookup();

    // Arte e aliases resolvidos
    expect(result.art["ST01-001"]?.imageUrl).toBe("https://example.com/st01-001.jpg");
    expect(result.art["GD02-001"]?.imageUrl).toBe("https://example.com/gd02-001.jpg");
    expect(result.art["ST01-RESOURCE"]?.imageUrl).toBe("https://example.com/r-001.jpg");
    expect(result.art["TOKEN-EX-BASE"]?.imageUrl).toBe("https://example.com/exb-001.jpg");

    // Tradução pré-compilada para ST01-001 presente
    expect(result.cardText["ST01-001"]?.pt).toBeDefined();
    expect(result.cardText["ST01-001"]?.pt).toContain("Durante o seu turno");

    // Tradução em inglês para GD02-001
    expect(result.cardText["GD02-001"]?.en).toBe("Deploy effect");
  });
});
