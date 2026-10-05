import { describe, expect, it } from "vitest";
import { analyzeFormat, eventWeight, listOverlap, placementPoints, type CatalogLookup, type RawMetaList } from "./coreAnalysis";

/**
 * Catálogo sintético: arquétipo A (azul/branco, chefe A-BOSS Lv.7), arquétipo B (vermelho/verde,
 * chefe B-BOSS Lv.6) e cartas genéricas. "X-NEW" fica fora do catálogo.
 */
const CARDS: Record<string, { type: string; level: number; color: string }> = {};
const add = (code: string, type: string, level: number, color: string) => (CARDS[code] = { type, level, color });
for (let i = 1; i <= 12; i++) add(`A-${i}`, i % 3 === 0 ? "COMMAND" : "UNIT", (i % 5) + 1, i % 2 ? "blue" : "white");
add("A-BOSS", "UNIT", 7, "blue");
for (let i = 1; i <= 12; i++) add(`B-${i}`, i % 3 === 0 ? "COMMAND" : "UNIT", (i % 5) + 1, i % 2 ? "red" : "green");
add("B-BOSS", "UNIT", 6, "red");
for (let i = 1; i <= 3; i++) for (let j = 1; j <= 8; j++) add(`BX${i}-${j}`, "UNIT", 2, j % 2 ? "red" : "green");
add("A-FLEX", "UNIT", 3, "white");
add("A-TECH", "COMMAND", 2, "blue");
for (let i = 1; i <= 5; i++) add(`A-ALT${i}`, "UNIT", 4, "white");
const catalog: CatalogLookup = (code) => CARDS[code];

/** núcleo de A: chefe + A-1..A-10, ×4 = 44 cartas; `extra` completa as 50 */
function deckA(extra: Record<string, number>): Record<string, number> {
  const d: Record<string, number> = { "A-BOSS": 4 };
  for (let i = 1; i <= 10; i++) d[`A-${i}`] = 4;
  return { ...d, ...extra };
}
function deckB(extra: Record<string, number>): Record<string, number> {
  const d: Record<string, number> = { "B-BOSS": 4 };
  for (let i = 1; i <= 10; i++) d[`B-${i}`] = 4;
  return { ...d, ...extra };
}

let seq = 0;
function list(main: Record<string, number>, over: Partial<RawMetaList> = {}): RawMetaList {
  seq++;
  return { format: "GD05", event: `Evento ${seq % 4}`, eventType: "Large Official Event", date: "2026-08-01", placing: (seq % 8) + 1, label: null, main, ...over };
}

const A_LISTS = [
  ...Array.from({ length: 6 }, () => list(deckA({ "A-FLEX": 4, "A-11": 2 }), { label: "A Boss" })),
  ...Array.from({ length: 3 }, () => list(deckA({ "A-FLEX": 2, "A-TECH": 2, "A-11": 2 }), { label: "A Boss" })),
  // variante de A: troca metade do núcleo por A-ALT1..5 (sobreposição < 0,55, mas mesmo chefe e mesmas cores)
  ...Array.from({ length: 4 }, () =>
    list(
      { "A-BOSS": 4, "A-1": 4, "A-2": 4, "A-3": 4, "A-4": 4, "A-ALT1": 4, "A-ALT2": 4, "A-ALT3": 4, "A-ALT4": 4, "A-ALT5": 4, "A-11": 4, "A-FLEX": 4, "A-12": 2 },
      { label: "Blue White A", placing: 1 },
    ),
  ),
];
const B_LISTS = Array.from({ length: 5 }, () => list(deckB({ "B-11": 4, "B-12": 2 }), { label: "B Boss" }));
const total = (m: Record<string, number>) => Object.values(m).reduce((a, b) => a + b, 0);

describe("helpers", () => {
  it("as listas sintéticas têm 50 cartas", () => {
    for (const l of [...A_LISTS, ...B_LISTS]) expect(total(l.main)).toBe(50);
  });

  it("listOverlap = cópias em comum / 50", () => {
    expect(listOverlap({ X: 4, Y: 2 }, { X: 2, Y: 2, Z: 4 })).toBeCloseTo(4 / 50);
  });

  it("peso do evento: regional/grande 3, loja japonesa 0,5, resto 1", () => {
    expect(eventWeight({ event: "Gen Con Regionals", eventType: "Large Official Event" })).toBe(3);
    expect(eventWeight({ event: "CoreTCG's Los Angeles Regionals", eventType: "Official Event" })).toBe(3);
    expect(eventWeight({ event: "Newtype Challenge", eventType: "Small Official Event" })).toBe(0.5);
    expect(eventWeight({ event: "Shop Battle", eventType: "Unofficial Event" })).toBe(0.5);
    expect(eventWeight({ event: "Store Tournament", eventType: "Small Official" })).toBe(1);
  });

  it("pontos por colocação decrescem e colocação desconhecida vale pouco", () => {
    expect(placementPoints(1)).toBeGreaterThan(placementPoints(2));
    expect(placementPoints(4)).toBeGreaterThan(placementPoints(8));
    expect(placementPoints(8)).toBeGreaterThan(placementPoints(16));
    expect(placementPoints(null)).toBe(placementPoints(16));
  });
});

describe("analyzeFormat", () => {
  const fmt = analyzeFormat([...B_LISTS, ...A_LISTS], catalog);

  it("separa os arquétipos e junta a variante de A pelo chefe e pelas cores", () => {
    expect(fmt.archetypes.map((a) => a.id)).toEqual(["GD05-blue-white-A-BOSS", "GD05-green-red-B-BOSS"]);
    const a = fmt.archetypes[0];
    expect(a.lists).toBe(13);
    expect(a.variants).toHaveLength(2);
    expect(a.variants.reduce((n, v) => n + v.lists, 0)).toBe(13);
  });

  it("nome = rótulo mais comum; cores = as 2 com mais cópias", () => {
    const [a, b] = fmt.archetypes;
    expect(a.name).toBe("A Boss");
    expect(a.colors).toEqual(["blue", "white"]);
    expect(b.colors).toEqual(["green", "red"]);
  });

  it("classifica núcleo / ajuste / tech pela taxa de inclusão e guarda a cópia mais comum", () => {
    const a = fmt.archetypes[0];
    const card = (code: string) => a.cards.find((c) => c.code === code);
    expect(card("A-BOSS")).toMatchObject({ tier: "core", rate: 1, mode: 4 });
    expect(card("A-FLEX")).toMatchObject({ tier: "core", mode: 4 }); // 13/13
    expect(card("A-ALT1")).toMatchObject({ tier: "flex" }); // 4/13 ≈ 0,31
    expect(card("A-TECH")).toMatchObject({ tier: "tech" }); // 3/13 ≈ 0,23
  });

  it("presença no torneio ponderada soma 1 e a melhor variante é a que mais vence", () => {
    expect(fmt.archetypes.reduce((s, a) => s + a.share, 0)).toBeCloseTo(1);
    const a = fmt.archetypes[0];
    const best = a.variants.find((v) => v.id === a.bestVariantId);
    expect(best?.median["A-ALT1"]).toBe(4); // a variante que só tem 1º lugar
    expect(total(a.median)).toBe(50);
  });

  it("marca carta fora do catálogo e o arquétipo deixa de ser simulável se ela for núcleo ou ajuste", () => {
    const withNew = B_LISTS.map((l) => {
      const { "B-12": _, ...main } = l.main;
      return { ...l, main: { ...main, "X-NEW": 2 } };
    });
    const b = analyzeFormat(withNew, catalog).archetypes[0];
    expect(b.cartasFora).toEqual(["X-NEW"]);
    expect(b.simulavel).toBe(false);
  });

  it("é determinístico (mesma entrada em outra ordem → mesmo resultado)", () => {
    const again = analyzeFormat([...A_LISTS].reverse().concat(B_LISTS), catalog);
    expect(JSON.stringify(again)).toBe(JSON.stringify(fmt));
  });

  it("descarta arquétipo com menos de 3 listas", () => {
    expect(analyzeFormat([...A_LISTS, ...B_LISTS.slice(0, 2)], catalog).archetypes.map((a) => a.id)).toEqual(["GD05-blue-white-A-BOSS"]);
  });

  it("arquétipo sem variante com 3 listas usa a maior como única (melhor variante sempre existe)", () => {
    // 3 listas de B que só dividem chefe + B-1..B-4 (sobreposição 0,4 → 3 grupos de 1), mesmo arquétipo
    const spread = [1, 2, 3].map((i) => {
      const main: Record<string, number> = { "B-BOSS": 4, "B-1": 4, "B-2": 4, "B-3": 4, "B-4": 4 };
      for (let j = 1; j <= 7; j++) main[`BX${i}-${j}`] = 4;
      main[`BX${i}-8`] = 2;
      return list(main, { label: "B" });
    });
    const b = analyzeFormat(spread, catalog).archetypes[0];
    expect(b.lists).toBe(3);
    expect(b.variants).toHaveLength(1);
    expect(b.variants.map((v) => v.id)).toContain(b.bestVariantId);
  });

  it("nome repetido no formato ganha as cores", () => {
    const sameName = analyzeFormat([...A_LISTS, ...B_LISTS.map((l) => ({ ...l, label: "A Boss" }))], catalog);
    expect(sameName.archetypes.map((a) => a.name)).toEqual(["A Boss (blue/white)", "A Boss (green/red)"]);
  });

  it("não leva nome de jogador para a saída", () => {
    const out = analyzeFormat(A_LISTS.map((l) => ({ ...l, player: "Fulano" }) as RawMetaList), catalog);
    expect(JSON.stringify(out)).not.toContain("Fulano");
  });
});
