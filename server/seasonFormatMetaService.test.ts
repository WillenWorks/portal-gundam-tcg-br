import { describe, expect, it } from "vitest";
import {
  getAvailableFormats,
  getFormatMetaBreakdown,
} from "./seasonFormatMetaService.ts";
import { META_CORES } from "../src/modules/simulator/fixtures/metaCores.ts";

// metaCores.ts é regenerado a cada coleta (PR auto/zero-system-meta): os números vêm do próprio arquivo, não fixos
const F = META_CORES.formats;
const sum = (keys: string[], field: "lists" | "events") => keys.reduce((n, k) => n + F[k as keyof typeof F][field], 0);
const SEASONS = ["GD01", "GD02", "GD03", "GD04", "GD05"];

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
    expect(gd01!.totalLists).toBe(F.GD01.lists);
    expect(gd01!.totalEvents).toBe(F.GD01.events);
    expect(gd01!.archetypeCount).toBe(F.GD01.archetypes.length);
    expect(gd01!.topArchetypes.length).toBeGreaterThan(0);
  });

  it("retorna detalhamento do formato com presença, top cut, vitórias e núcleos", async () => {
    const res = await getFormatMetaBreakdown(mockPrisma, "GD01");
    expect(res).toBeDefined();
    expect(res!.format).toBe("GD01");
    expect(res!.totalLists).toBe(F.GD01.lists);
    expect(res!.totalEvents).toBe(F.GD01.events);
    expect(res!.provenance.totalDecks).toBe(F.GD01.lists);

    const top = res!.archetypes[0];
    const source = F.GD01.archetypes.find((a) => a.name === top.name)!;
    expect(source).toBeDefined();
    expect(top.share).toBeCloseTo(source.share, 6);
    for (const a of res!.archetypes) {
      for (const v of [a.share, a.top8Share, a.winShare]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }

    // Núcleos categorizados (core, flex, tech) e nomes vindos do catálogo quando a carta existe nele
    const withCore = res!.archetypes.find((a) => a.cards.core.length > 0);
    expect(withCore).toBeDefined();
    const cards = res!.archetypes.flatMap((a) => [...a.cards.core, ...a.cards.flex, ...a.cards.tech]);
    const rifle = cards.find((c) => c.code === "GD01-086");
    if (rifle) expect(rifle.namePt).toBe("Rifle Buster");
    for (const c of cards) {
      expect(c.inclusionRate).toBeGreaterThan(0);
      expect(c.inclusionRate).toBeLessThanOrEqual(1);
    }
  });

  it("filtra arquétipos por cor no formato", async () => {
    const res = await getFormatMetaBreakdown(mockPrisma, "GD01", { color: "green" });
    expect(res).toBeDefined();
    expect(res!.archetypes.every((a) => a.colors.includes("green"))).toBe(true);
  });

  it("ordena GD05 unificado no topo de getAvailableFormats (sem GD05.5 separado) e inclui ALL", () => {
    const formats = getAvailableFormats();
    expect(formats[0].format).toBe("GD05");
    expect(formats.some((f) => f.format === "GD05.5")).toBe(false);
    expect(formats.some((f) => f.format === "GD05_COMBINED")).toBe(false);
    expect(formats.some((f) => f.format === "ALL")).toBe(true);
  });

  it("temporada atual unifica GD05 e GD05.5 sob GD05 sem somar duas vezes", async () => {
    // o recorte está contido no GD05
    expect(F["GD05.5"].lists).toBeLessThanOrEqual(F.GD05.lists);

    const res = await getFormatMetaBreakdown(mockPrisma, "GD05");
    expect(res).toBeDefined();
    expect(res!.format).toBe("GD05");
    expect(res!.totalLists).toBe(F.GD05.lists);
    expect(res!.totalEvents).toBe(F.GD05.events);
    expect(res!.provenance.totalDecks).toBe(F.GD05.lists);
    expect(res!.provenance.tournaments[0].name).toContain("Temporada Atual GD05");
    expect(getAvailableFormats()[0].totalLists).toBe(F.GD05.lists);

    // aliases legados como GD05.5 ou GD05_COMBINED também resolvem para GD05
    const resAlias = await getFormatMetaBreakdown(mockPrisma, "GD05_COMBINED");
    expect(resAlias?.format).toBe("GD05");
    const resSub = await getFormatMetaBreakdown(mockPrisma, "GD05.5");
    expect(resSub?.format).toBe("GD05");

    // cada arquétipo com as mesmas listas que tem no GD05
    for (const a of res!.archetypes) {
      const source = F.GD05.archetypes.find((s) => s.name === a.name);
      if (source) expect(a.lists).toBe(source.lists);
    }
  });

  it("retorna agregação de Todas as Temporadas (ALL) sem contar o GD05.5 duas vezes", async () => {
    const res = await getFormatMetaBreakdown(mockPrisma, "ALL");
    expect(res).toBeDefined();
    expect(res!.format).toBe("ALL");
    expect(res!.totalLists).toBe(sum(SEASONS, "lists"));
    expect(res!.totalEvents).toBe(sum(SEASONS, "events"));
    expect(res!.archetypes.length).toBeGreaterThan(20);
  });
});
