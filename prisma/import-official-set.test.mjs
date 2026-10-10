import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { buildCatalogRows } from "./import-official-set.mjs";

const read = (rel) => JSON.parse(readFileSync(new URL(`../${rel}`, import.meta.url), "utf8"));
const data = {
  cards: read("data/gcg-official-cards.json").cards,
  stats: read("data/gcg-official-stats.json"),
  products: read("data/official-products.json"),
  translations: new Map(read("data/translations-st11-14.json").map((t) => [t.code, t.effectPt])),
  prints: read("data/tcgplayer-prints.json"),
};

describe("import-official-set — linhas do catálogo a partir dos dados oficiais", () => {
  const { set, rows } = buildCatalogRows("ST11", data);

  it("set de starter com nome, data ao meio-dia UTC e capa local", () => {
    expect(set.nameEn).toBe("Starter Deck 11: Aquatic Assault");
    expect(set.setType).toBe("STARTER_DECK");
    expect(set.releaseDate.toISOString()).toBe("2026-09-25T12:00:00.000Z");
    expect(set.coverImage).toBe("/images/sets/st11.webp");
  });

  it("16 cartas + o token T-028; cada uma com a impressão normal primeiro e a paralela (+) depois", () => {
    expect(rows.map((r) => r.code)).toContain("T-028");
    expect(rows).toHaveLength(17);
    const zgok = rows.find((r) => r.code === "ST11-001");
    expect(zgok.cards.map((c) => [c.rarity, c.isPrimaryPrint])).toEqual([
      ["Legend Rare", true],
      ["LR+", false],
    ]);
    expect(zgok.cards[1].nameEn).toBe("Char's Z'Gok (LR+)");
    expect(new Set(zgok.cards.map((c) => c.externalId)).size).toBe(2);
  });

  it("texto no formato do catálogo ([Gatilho] … <br>), pt-BR junto e stats oficiais", () => {
    const zgok = rows.find((r) => r.code === "ST11-001").model;
    expect(zgok.effectEn.startsWith("[During Pair] While 2 or more")).toBe(true);
    expect(zgok.effectEn).toContain("<br>[Deploy]");
    expect(zgok.effectPt.startsWith("[During Pair] Enquanto")).toBe(true);
    expect(zgok).toMatchObject({ cardType: "UNIT", color: "Blue", level: 4, cost: 3, ap: 3, hp: 3, linkText: "[Char Aznable]", zone: "Earth" });
    expect(zgok.traits).toEqual(["Zeon", "Marine"]);
  });

  it("imagem do CDN do TCGplayer (o site oficial bloqueia exibir em outro domínio)", () => {
    for (const r of rows) for (const c of r.cards) expect(c.imageUrl, c.externalId).toMatch(/^https:\/\/tcgplayer-cdn\.tcgplayer\.com\/product\/\d+_400w\.jpg$/);
  });

  it("Piloto (stats +2/+1) e Command com 【Pilot】 ficam com os campos certos", () => {
    const char = rows.find((r) => r.code === "ST11-011").model;
    expect(char).toMatchObject({ cardType: "PILOT", ap: 2, hp: 1 });
    expect(rows.find((r) => r.code === "ST11-014").model.pilotName).toBe("Marco Morassim");
  });
});
