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

describe("import-official-set — booster GD06 (Stardust Trails)", () => {
  const { set, rows } = buildCatalogRows("GD06", { ...data, translations: new Map(read("data/translations-gd06.json").map((t) => [t.code, t.effectPt])) });

  it("set de booster com o nome do produto, lançamento em 30/10 e capa local", () => {
    expect(set).toMatchObject({ nameEn: "Stardust Trails", setType: "BOOSTER_PACK", coverImage: "/images/sets/gd06.webp" });
    expect(set.releaseDate.toISOString()).toBe("2026-10-30T12:00:00.000Z");
  });

  it("130 cartas + 8 tokens; as 5 Special (reimpressões de GD02/GD05) ficam fora do set", () => {
    expect(rows).toHaveLength(138);
    expect(rows.every((r) => r.code.startsWith("GD06-") || /^T-03[0-7]$/.test(r.code))).toBe(true);
    for (const r of rows) expect(r.cards[0].imageUrl, r.code).toMatch(/^https:\/\/tcgplayer-cdn\.tcgplayer\.com\//);
  });

  it("token de Base (Axis) entra como BASE com HP e sem custo", () => {
    expect(rows.find((r) => r.code === "T-037").model).toMatchObject({ cardType: "BASE", hp: 5, cost: null, level: null });
    expect(rows.find((r) => r.code === "T-031").model).toMatchObject({ cardType: "UNIT", ap: 2, hp: 3 });
  });

  it("Command com 【Pilot】 e texto em pt-BR no formato do catálogo", () => {
    const sturm = rows.find((r) => r.code === "GD06-119").model;
    expect(sturm).toMatchObject({ cardType: "COMMAND", pilotName: "Schwarz Bruder", ap: 1, hp: 2 });
    expect(sturm.effectPt.startsWith("[Action]")).toBe(true);
  });
});
