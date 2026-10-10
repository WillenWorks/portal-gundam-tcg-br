import { describe, expect, it } from "vitest";
import { buildPlan, nameAliases, normalizeSourceTitle } from "./apply-gcg-official-curation.mjs";

describe("normalizeSourceTitle", () => {
  it("retorna null pra valores vazios ou marcador de ausência ('-')", () => {
    expect(normalizeSourceTitle(null)).toBeNull();
    expect(normalizeSourceTitle(undefined)).toBeNull();
    expect(normalizeSourceTitle("")).toBeNull();
    expect(normalizeSourceTitle("-")).toBeNull();
  });

  it("mantém títulos que já vêm no formato canônico", () => {
    expect(normalizeSourceTitle("Mobile Suit Gundam SEED")).toBe("Mobile Suit Gundam SEED");
    expect(normalizeSourceTitle("Mobile Suit Gundam Unicorn")).toBe("Mobile Suit Gundam Unicorn");
    expect(normalizeSourceTitle("Mobile Suit Gundam GQuuuuuuX")).toBe("Mobile Suit Gundam GQuuuuuuX");
  });

  it("corrige as variações de grafia conhecidas do scrape oficial (ver docs/10)", () => {
    expect(normalizeSourceTitle("Mobile Suit Gundam IRON-BLOODED ORPHANS")).toBe("Mobile Suit Gundam: Iron-Blooded Orphans");
    expect(normalizeSourceTitle("Mobile Suit Gundam SEED DESTINY")).toBe("Mobile Suit Gundam SEED Destiny");
    expect(normalizeSourceTitle("Mobile Suit Gundam: Char's Counterattack")).toBe("Mobile Suit Gundam Char's Counterattack");
    expect(normalizeSourceTitle("Mobile Suit V Gundam")).toBe("Mobile Suit Victory Gundam");
    expect(normalizeSourceTitle("∀ Gundam")).toBe("Turn A Gundam");
    expect(normalizeSourceTitle("Mobile Suit Z Gundam")).toBe("Mobile Suit Zeta Gundam");
  });

  it("normaliza aspas curvas pra aspas retas antes de comparar", () => {
    // aspas curvas (\u2019) apareciam em algumas linhas do scrape; sem essa normalização
    // "Hathaway\u2019s Flash" nunca bateria com a entrada canônica que usa aspas retas.
    expect(normalizeSourceTitle("Mobile Suit Gundam: Hathaway\u2019s Flash")).toBe("Mobile Suit Gundam: Hathaway's Flash");
  });

  it("descarta linhas com bug de concatenação (vários títulos grudados numa carta genérica)", () => {
    // caso real: EXR-006 "EX Resource" veio com 2 source titles colados no scrape.
    const concatenado = "Mobile Suit Gundam: Char's Counterattack Mobile Suit Gundam: Hathaway's Flash";
    expect(normalizeSourceTitle(concatenado)).toBeNull();
  });

  it("remove prefixo duplicado quando só repete 'Mobile Suit Gundam' colado", () => {
    expect(normalizeSourceTitle("Mobile Suit Gundam Mobile Suit Gundam GQuuuuuuX")).toBe("Mobile Suit Gundam GQuuuuuuX");
  });

  it("não mexe em títulos que não têm correção mapeada", () => {
    expect(normalizeSourceTitle("SD Gundam G Generation ETERNAL")).toBe("SD Gundam G Generation ETERNAL");
    expect(normalizeSourceTitle("After War Gundam X")).toBe("After War Gundam X");
  });
});

describe("buildPlan — vínculos piloto ↔ unidade", () => {
  const card = (code, cardType, name, extra = {}) => ({ code, cardType, name, link: "-", effect: "", ...extra });

  it("usa o nome alternativo do piloto (Milliardo também é [Zechs Merquise])", () => {
    const plan = buildPlan([
      card("ST12-001", "UNIT", "Gundam Epyon", { link: "[Zechs Merquise]" }),
      card("GD03-090", "PILOT", "Zechs Merquise"),
      card("ST12-011", "PILOT", "Milliardo Peacecraft", { effect: "This card's name is also treated as [Zechs Merquise].\n\n【Burst】Add this card to your hand." }),
    ]);
    const pairs = plan.pilotUnitRelations.map((r) => `${r.pilotCode}>${r.unitCode}`);
    expect(pairs).toEqual(expect.arrayContaining(["GD03-090>ST12-001", "ST12-011>ST12-001"]));
  });

  it("liga todos os pilotos de um link com barra e registra o traço à parte", () => {
    const plan = buildPlan([
      card("U1", "UNIT", "Nu", { link: "(Londo Bell) Trait / [Amuro Ray]" }),
      card("U2", "UNIT", "Gundam", { link: "[Kai Shiden] / [Hayato Kobayashi]" }),
      card("U3", "UNIT", "GQuuuuuuX", { link: "[Amate Yuzuriha (Machu)] / [Nyaan]" }),
      card("P1", "PILOT", "Amuro Ray"),
      card("P2", "PILOT", "Kai Shiden"),
      card("P3", "PILOT", "Hayato Kobayashi"),
      card("P4", "PILOT", "Amate Yuzuriha (Machu)"),
      card("P5", "PILOT", "Nyaan"),
    ]);
    const pairs = plan.pilotUnitRelations.map((r) => `${r.pilotCode}>${r.unitCode}`).sort();
    expect(pairs).toEqual(["P1>U1", "P2>U2", "P3>U2", "P4>U3", "P5>U3"]);
    expect(plan.traitLinkedSkipped.map((t) => t.traitName)).toEqual(["Londo Bell"]);
  });

  it("nameAliases lê um ou vários nomes", () => {
    expect(nameAliases("This card's name is also treated as [Marida Cruz].")).toEqual(["Marida Cruz"]);
    expect(nameAliases("This card's name is also treated as [A] and [B].")).toEqual(["A", "B"]);
    expect(nameAliases("【Deploy】Draw 1.")).toEqual([]);
  });

  it("dataset oficial real: Epyon tem Zechs e Milliardo; Banshee tem Marida e Ple-Twelve", async () => {
    const { readFile } = await import("node:fs/promises");
    const official = JSON.parse(await readFile(new URL("../data/gcg-official-cards.json", import.meta.url), "utf8")).cards;
    const plan = buildPlan(official);
    const pilotsOf = (unit) => plan.pilotUnitRelations.filter((r) => r.unitCode === unit).map((r) => r.pilotCode);
    expect(pilotsOf("ST12-001")).toContain("ST12-011");
    const banshees = official.filter((c) => c.cardType === "UNIT" && /Banshee/.test(c.name) && /Marida/.test(c.link ?? ""));
    expect(banshees.length).toBeGreaterThan(0);
    for (const b of banshees) expect(pilotsOf(b.code)).toContain("ST12-012");
  });
});
