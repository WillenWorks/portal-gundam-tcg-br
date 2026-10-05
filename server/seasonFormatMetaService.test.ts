import { describe, expect, it } from "vitest";
import {
  getAvailableFormats,
  getFormatMetaBreakdown,
  getFormatsEvolution,
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

  it("calcula evolução temporal dos arquétipos entre os formatos GD01..GD05", () => {
    const evolution = getFormatsEvolution();
    expect(evolution.length).toBeGreaterThan(0);

    const wingZero = evolution.find((e) => e.name.toLowerCase().includes("wing zero"));
    expect(wingZero).toBeDefined();
    expect(wingZero!.points.length).toBeGreaterThanOrEqual(2);
    expect(wingZero!.points.some((p) => p.format === "GD01")).toBe(true);
  });
});
