import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const scriptPath = fileURLToPath(new URL("./gundam-coverage.mjs", import.meta.url));
const jsonPath = fileURLToPath(
  new URL("../src/modules/simulator/content/_index/coverage.json", import.meta.url),
);
const mdPath = fileURLToPath(new URL("../docs/_generated/coverage.md", import.meta.url));

const GATED_SETS = ["ST01", "ST02", "ST03", "ST04"];

function generate() {
  execFileSync(process.execPath, [scriptPath], { encoding: "utf8" });
  return {
    json: JSON.parse(readFileSync(jsonPath, "utf8")),
    md: readFileSync(mdPath, "utf8"),
  };
}

/** `**ST01:** 12 implementada · 0 implementada* · 4 vanilla · 0 deferida · 0 faltando` */
function mdCountsFor(md, set) {
  const line = md.split("\n").find((l) => l.startsWith(`**${set}:**`));
  if (!line) throw new Error(`resumo de ${set} não encontrado no coverage.md`);
  const n = (label) => Number(new RegExp(`(\\d+) ${label.replace("*", "\\*")}(?: |$)`).exec(line)?.[1]);
  return {
    impl: n("implementada"),
    implStar: n("implementada*"),
    vanilla: n("vanilla"),
    deferida: n("deferida"),
    faltando: n("faltando"),
  };
}

describe("gundam-coverage — coverage.json", () => {
  const { json, md } = generate();

  it("é determinístico: rodar 2× dá o mesmo arquivo", () => {
    const first = readFileSync(jsonPath, "utf8");
    execFileSync(process.execPath, [scriptPath], { encoding: "utf8" });
    expect(readFileSync(jsonPath, "utf8")).toBe(first);
  });

  it("`generatedFrom` é a contagem de specs", () => {
    expect(json.generatedFrom).toMatch(/^\d+ specs$/);
  });

  it("cobre ST01–ST04 com as 16 cartas de cada set, ordenadas por code", () => {
    expect(Object.keys(json.sets)).toEqual(GATED_SETS);
    for (const set of GATED_SETS) {
      const codes = json.sets[set].cards.map((c) => c.code);
      expect(codes).toHaveLength(16);
      expect(codes).toEqual([...codes].sort());
      expect(codes.every((c) => c.startsWith(`${set}-`))).toBe(true);
    }
  });

  it("os `counts` batem com os status das cartas e somam o total do set", () => {
    for (const set of GATED_SETS) {
      const { cards, counts } = json.sets[set];
      const derived = { impl: 0, implStar: 0, vanilla: 0, deferida: 0, faltando: 0 };
      const key = {
        implementada: "impl",
        "implementada*": "implStar",
        vanilla: "vanilla",
        deferida: "deferida",
        faltando: "faltando",
      };
      for (const c of cards) derived[key[c.status]]++;
      expect(counts).toEqual(derived);
      expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(cards.length);
    }
  });

  it("bate com a classificação do coverage.md (mesma fonte)", () => {
    for (const set of GATED_SETS) {
      expect(json.sets[set].counts, set).toEqual(mdCountsFor(md, set));
    }
  });

  it("cláusulas deferidas de uma carta são trechos literais do texto EN oficial", () => {
    const official = JSON.parse(
      readFileSync(fileURLToPath(new URL("../data/gcg-official-cards.json", import.meta.url)), "utf8"),
    ).cards;
    const effOf = new Map(official.map((c) => [c.code, (c.effect ?? "").replace(/\s+/g, " ").trim()]));
    for (const set of GATED_SETS) {
      for (const card of json.sets[set].cards) {
        for (const clause of card.deferredClauses) {
          expect(effOf.get(card.code) ?? "", `${card.code}: "${clause}"`).toContain(
            clause.replace(/\s+/g, " ").trim(),
          );
        }
      }
    }
  });
});
