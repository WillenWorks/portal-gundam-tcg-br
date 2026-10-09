import { describe, expect, it } from "vitest";
import { compareMatrices, renderReport } from "./zeroMatrix.mjs";

const current = { decks: ["ST01", "ST02", "ST03"], gamesPerPair: 10, rate: [[null, 0.4, 0.6], [0.6, null, 0.5], [0.4, 0.5, null]] };
const next = {
  decks: ["ST02", "ST01", "GD05-ORB"],
  params: { gamesPerPair: 10, level: "normal" },
  rulesSha: "rules-novo",
  rate: [[null, 0.9, 0.5], [0.1, null, 0.3], [0.5, 0.7, null]],
};

describe("compareMatrices (matriz nova × matriz em uso no counter)", () => {
  it("lista decks que entram e saem e casa as taxas pelo nome, não pela posição", () => {
    const c = compareMatrices(current, next);
    expect(c.added).toEqual(["GD05-ORB"]);
    expect(c.removed).toEqual(["ST03"]);
    // ST01×ST02 era 0,4 e agora é 0,1 (linha ST01 na matriz nova é a 2ª)
    expect(c.biggestChanges).toHaveLength(1);
    expect(c.biggestChanges[0]).toMatchObject({ row: "ST01", col: "ST02", before: 0.4, after: 0.1 });
  });

  it("o relatório avisa quando a matriz foi medida com outras regras e traz o comando de atualização", () => {
    const md = renderReport({ matrixPath: "docs/bot/m.json", report: next, current, comparison: compareMatrices(current, next), currentRulesSha: "rules-atual" });
    expect(md).toContain("medida com outras regras");
    expect(md).toContain("--write-fixture");
    const semVersao = renderReport({ matrixPath: "docs/bot/m.json", report: { ...next, rulesSha: undefined }, current, comparison: compareMatrices(current, next), currentRulesSha: "rules-atual" });
    expect(semVersao).toContain("gere de novo");
  });
});
