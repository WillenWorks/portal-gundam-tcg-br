import { describe, expect, it } from "vitest";
import { getCardDefByCode } from "../content/allCardDefs";
import { META_CORES } from "./metaCores";

const total = (m: Record<string, number>) => Object.values(m).reduce((a, b) => a + b, 0);
const ALLOWED_KEYS = new Set(["generatedAt", "source", "formats"]);

describe("fixture metaCores (gerada por gundam:meta:cores)", () => {
  const formats = Object.entries(META_CORES.formats);

  it("cobre GD01..GD05 e só tem os campos esperados (nada de jogador)", () => {
    expect(Object.keys(META_CORES).every((k) => ALLOWED_KEYS.has(k))).toBe(true);
    expect(formats.map(([f]) => f)).toEqual(expect.arrayContaining(["GD01", "GD02", "GD03", "GD04", "GD05"]));
    expect(JSON.stringify(META_CORES)).not.toMatch(/"player"/);
  });

  for (const [format, fmt] of formats) {
    it(`${format}: arquétipos consistentes`, () => {
      expect(fmt.archetypes.length).toBeGreaterThan(0);
      expect(new Set(fmt.archetypes.map((a) => a.id)).size).toBe(fmt.archetypes.length);
      expect(new Set(fmt.archetypes.map((a) => a.name)).size).toBe(fmt.archetypes.length);
      const shares = fmt.archetypes.reduce((s, a) => s + a.share, 0);
      expect(shares).toBeLessThanOrEqual(1.001);
      for (const a of fmt.archetypes) {
        expect(a.colors.length, a.id).toBeLessThanOrEqual(2);
        expect(total(a.median), a.id).toBe(50);
        expect(a.variants.map((v) => v.id), a.id).toContain(a.bestVariantId);
        for (const v of a.variants) expect(total(v.median), v.id).toBe(50);
        expect(a.cards.filter((c) => c.tier === "core").length, a.id).toBeGreaterThan(0);
        // simulável = núcleo e ajuste no catálogo do simulador
        if (a.simulavel) for (const c of a.cards.filter((x) => x.tier !== "tech")) expect(getCardDefByCode(c.code), `${a.id} ${c.code}`).toBeDefined();
        for (const code of a.cartasFora) expect(getCardDefByCode(code), `${a.id} ${code}`).toBeUndefined();
      }
    });
  }

  it("GD05 tem os arquétipos de topo jogáveis no simulador", () => {
    const top = META_CORES.formats.GD05.archetypes.slice(0, 5);
    expect(top.filter((a) => a.simulavel).length).toBeGreaterThanOrEqual(4);
  });
});
