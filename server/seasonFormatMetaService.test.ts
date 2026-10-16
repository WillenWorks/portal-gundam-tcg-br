import { describe, expect, it } from "vitest";
import {
  getAvailableFormats,
  getFormatMetaBreakdown,
} from "./seasonFormatMetaService.ts";

const mockPrisma: any = {
  card: {
    findMany: async () => [
      {
        code: "GD01-024",
        nameEn: "Wing Gundam",
        namePt: "Wing Gundam",
        imageUrl: "/img/wing.png",
        imageMediumUrl: "/img/wing-m.png",
        color: "green",
        cardType: "UNIT",
        cost: 6,
        level: 6,
      },
      {
        code: "GD01-086",
        nameEn: "Buster Rifle",
        namePt: "Rifle Buster",
        imageUrl: "/img/rifle.png",
        imageMediumUrl: "/img/rifle-m.png",
        color: "white",
        cardType: "COMMAND",
        cost: 3,
        level: null,
      },
    ],
  },
};

describe("seasonFormatMetaService", () => {
  it("lista os formatos disponíveis com estatísticas consolidadas", () => {
    const formats = getAvailableFormats();
    expect(formats.length).toBeGreaterThanOrEqual(5);

    const gd01 = formats.find((f) => f.format === "GD01");
    expect(gd01).toBeDefined();
    expect(gd01!.totalLists).toBe(340);
    expect(gd01!.totalEvents).toBe(25);
    expect(gd01!.archetypeCount).toBeGreaterThan(0);
    expect(gd01!.topArchetypes.length).toBeGreaterThan(0);
  });

  it("retorna detalhamento do formato com presença, top cut, vitórias e núcleos", async () => {
    const res = await getFormatMetaBreakdown(mockPrisma, "GD01");
    expect(res).toBeDefined();
    expect(res!.format).toBe("GD01");
    expect(res!.totalLists).toBe(340);
    expect(res!.totalEvents).toBe(25);
    expect(res!.provenance.totalDecks).toBe(340);

    const wingZero = res!.archetypes.find((a) => a.name === "Wing Zero");
    expect(wingZero).toBeDefined();
    expect(wingZero!.share).toBeCloseTo(0.349, 2);
    expect(wingZero!.top8Share).toBeCloseTo(0.338, 2);
    expect(wingZero!.winShare).toBeCloseTo(0.35, 2);

    // Núcleos categorizados: core, flex, tech
    expect(wingZero!.cards.core.length).toBeGreaterThan(0);
    expect(wingZero!.cards.flex.length).toBeGreaterThan(0);
    expect(wingZero!.cards.tech.length).toBeGreaterThan(0);

    const busterRifle = wingZero!.cards.core.find((c) => c.code === "GD01-086");
    expect(busterRifle).toBeDefined();
    expect(busterRifle!.namePt).toBe("Rifle Buster");
    expect(busterRifle!.inclusionRate).toBe(1);
    expect(busterRifle!.modeCopies).toBe(4);
  });

  it("filtra arquétipos por cor no formato", async () => {
    const res = await getFormatMetaBreakdown(mockPrisma, "GD01", { color: "green" });
    expect(res).toBeDefined();
    expect(res!.archetypes.every((a) => a.colors.includes("green"))).toBe(true);
  });

  it("ordena GD05_COMBINED no topo de getAvailableFormats e inclui ALL", () => {
    const formats = getAvailableFormats();
    expect(formats[0].format).toBe("GD05_COMBINED");
    expect(formats[0].totalLists).toBe(680);
    expect(formats[0].totalEvents).toBe(177);
    expect(formats.some((f) => f.format === "ALL")).toBe(true);
  });

  it("retorna agregação matemática precisa para a temporada GD05 / GD05.5", async () => {
    const res = await getFormatMetaBreakdown(mockPrisma, "GD05_COMBINED");
    expect(res).toBeDefined();
    expect(res!.format).toBe("GD05_COMBINED");
    expect(res!.totalLists).toBe(680);
    expect(res!.totalEvents).toBe(177);
    expect(res!.provenance.totalDecks).toBe(680);
    expect(res!.provenance.tournaments[0].name).toContain("Temporada Atual GD05 & GD05.5");

    // Strike Freedom Gundam é o líder absoluto com 171 listas (150 de GD05 + 21 de GD05.5)
    const strikeFreedom = res!.archetypes.find((a) => a.name === "Strike Freedom Gundam");
    expect(strikeFreedom).toBeDefined();
    expect(strikeFreedom!.lists).toBe(171);
    expect(strikeFreedom!.share).toBeCloseTo(0.251, 2);
  });

  it("retorna agregação de Todas as Temporadas (ALL)", async () => {
    const res = await getFormatMetaBreakdown(mockPrisma, "ALL");
    expect(res).toBeDefined();
    expect(res!.format).toBe("ALL");
    expect(res!.totalLists).toBe(1555);
    expect(res!.totalEvents).toBe(265);
    expect(res!.archetypes.length).toBeGreaterThan(20);
  });
});
