import { describe, expect, it } from "vitest";
import { deriveStateFromCity, getRegionalMetagame } from "./regionalMetaService.ts";

describe("deriveStateFromCity", () => {
  it("reconhece capitais e cidades comuns pelo dicionário", () => {
    expect(deriveStateFromCity("São Paulo", null).uf).toBe("SP");
    expect(deriveStateFromCity("curitiba", "Brasil").uf).toBe("PR");
    expect(deriveStateFromCity("Rio de Janeiro", "BR").uf).toBe("RJ");
  });

  it("reconhece sufixo explícito de UF (Cidade - UF)", () => {
    const result = deriveStateFromCity("Cidade Desconhecida - PR", "Brasil");
    expect(result.uf).toBe("PR");
    expect(result.cityLabel).toBe("Cidade Desconhecida");
  });

  it("cidade fora do dicionário e sem sufixo cai em 'Não informado', nunca inventa estado", () => {
    const result = deriveStateFromCity("Vila Fictícia Sem Cadastro", "Brasil");
    expect(result.uf).toBeNull();
    expect(result.stateLabel).toBe("Não informado");
  });

  it("país diferente de Brasil usa o próprio país como 'estado'", () => {
    const result = deriveStateFromCity("Tokyo", "Japão");
    expect(result.uf).toBeNull();
    expect(result.stateLabel).toBe("Japão");
  });

  it("cidade vazia devolve 'Não informado' sem quebrar", () => {
    expect(deriveStateFromCity("", "Brasil").stateLabel).toBe("Não informado");
    expect(deriveStateFromCity(null, "Brasil").stateLabel).toBe("Não informado");
  });
});

describe("getRegionalMetagame", () => {
  const CARD_WING = { id: "c-wing", cardModelId: "wing", nameEn: "Wing Gundam", namePt: null, color: "White", setId: "set-1", cardType: "UNIT" };
  const CARD_ZAKU = { id: "c-zaku", cardModelId: "zaku", nameEn: "Zaku II", namePt: null, color: "Red", setId: "set-1", cardType: "UNIT" };

  function makeFakePrisma() {
    const TOURNAMENT_ENTRIES = [
      // São Paulo, 3 decks com Wing Gundam (loja "LGS Paulista")
      { deckSnapshotId: "S1", wins: 2, losses: 0, draws: 0, tournament: { country: "Brasil", city: "São Paulo", organizer: "LGS Paulista" } },
      { deckSnapshotId: "S2", wins: 1, losses: 1, draws: 0, tournament: { country: "Brasil", city: "São Paulo", organizer: "LGS Paulista" } },
      { deckSnapshotId: "S3", wins: 0, losses: 2, draws: 0, tournament: { country: "Brasil", city: "São Paulo", organizer: "LGS Paulista" } },
      { deckSnapshotId: "S4", wins: 0, losses: 2, draws: 0, tournament: { country: "Brasil", city: "São Paulo", organizer: "LGS Paulista" } },
      // Curitiba, 4 decks com Zaku (sem Wing Gundam nenhuma)
      { deckSnapshotId: "S5", wins: 2, losses: 0, draws: 0, tournament: { country: "Brasil", city: "Curitiba", organizer: "LGS Sulista" } },
      { deckSnapshotId: "S6", wins: 2, losses: 0, draws: 0, tournament: { country: "Brasil", city: "Curitiba", organizer: "LGS Sulista" } },
      { deckSnapshotId: "S7", wins: 1, losses: 1, draws: 0, tournament: { country: "Brasil", city: "Curitiba", organizer: "LGS Sulista" } },
      { deckSnapshotId: "S8", wins: 0, losses: 2, draws: 0, tournament: { country: "Brasil", city: "Curitiba", organizer: "LGS Sulista" } },
    ];
    const SNAPSHOT_ITEMS: Record<string, Array<{ quantity: number; card: typeof CARD_WING }>> = {
      S1: [{ quantity: 4, card: CARD_WING }],
      S2: [{ quantity: 4, card: CARD_WING }],
      S3: [{ quantity: 4, card: CARD_WING }],
      S4: [{ quantity: 2, card: CARD_ZAKU }],
      S5: [{ quantity: 4, card: CARD_ZAKU }],
      S6: [{ quantity: 4, card: CARD_ZAKU }],
      S7: [{ quantity: 4, card: CARD_ZAKU }],
      S8: [{ quantity: 4, card: CARD_ZAKU }],
    };

    return {
      tournamentEntry: { findMany: async () => TOURNAMENT_ENTRIES },
      hostedEventParticipant: { findMany: async () => [] },
      deckSnapshotItem: {
        findMany: async ({ where }: { where: { deckSnapshotId: { in: string[] } } }) => {
          const ids = where.deckSnapshotId.in;
          return ids.flatMap((id) => (SNAPSHOT_ITEMS[id] || []).map((item) => ({ deckSnapshotId: id, ...item })));
        },
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
  }

  it("agrupa por estado corretamente e calcula winrate nacional", async () => {
    const prisma = makeFakePrisma();
    const result = await getRegionalMetagame(prisma, { seasonId: null });

    expect(result.totalDecks).toBe(8);
    expect(result.national.totalDecks).toBe(8);

    const sp = result.states.find((s) => s.key === "SP");
    const pr = result.states.find((s) => s.key === "PR");
    expect(sp?.totalDecks).toBe(4);
    expect(pr?.totalDecks).toBe(4);
    // SP: wins 2+1+0+0=3, losses 0+1+2+2=5 -> winRate 3/8 = 37.5%
    expect(sp?.winRate).toBeCloseTo(37.5, 1);
  });

  it("presença de carta em uma cidade (Wing Gundam em SP) vira anomalia contra a média nacional quando SP é o foco", async () => {
    const prisma = makeFakePrisma();
    const result = await getRegionalMetagame(prisma, { seasonId: null, stateUf: "SP" });

    const wingAnomaly = result.anomalies.find((a) => a.kind === "card" && a.label === "Wing Gundam");
    expect(wingAnomaly).toBeDefined();
    expect(wingAnomaly!.regionRate).toBeGreaterThan(wingAnomaly!.nationalRate);
    expect(result.alerts.some((msg) => msg.includes("Wing Gundam"))).toBe(true);
  });

  it("agrupa lojas dentro da cidade selecionada", async () => {
    const prisma = makeFakePrisma();
    const result = await getRegionalMetagame(prisma, { seasonId: null, stateUf: "PR", city: "Curitiba" });
    expect(result.stores).toHaveLength(1);
    expect(result.stores[0].label).toBe("LGS Sulista");
    expect(result.stores[0].totalDecks).toBe(4);
  });

  it("sem nenhum snapshot elegível, devolve resultado vazio sem quebrar", async () => {
    const prisma = {
      tournamentEntry: { findMany: async () => [] },
      hostedEventParticipant: { findMany: async () => [] },
      deckSnapshotItem: { findMany: async () => [] },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    const result = await getRegionalMetagame(prisma, { seasonId: null });
    expect(result.totalDecks).toBe(0);
    expect(result.states).toEqual([]);
    expect(result.alerts).toEqual([]);
  });
});
