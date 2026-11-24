import path from "node:path";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadFileCorpus } from "./corpus.ts";
import { normalizeText, questionKey, tokenize } from "./normalize.ts";
import { cardCodesIn, RulesIndex } from "./rulesIndex.ts";

const ROOT = path.resolve(import.meta.dirname, "../..");
const index = new RulesIndex(loadFileCorpus(ROOT));
const golden = JSON.parse(readFileSync(path.join(import.meta.dirname, "golden.json"), "utf8")) as {
  questions: Array<{ q: string; expect: string[] }>;
};

describe("normalize", () => {
  it("sinônimos pt e o nome oficial viram o mesmo termo", () => {
    expect(tokenize("bloqueador")).toEqual(tokenize("Blocker"));
    expect(tokenize("primeiro ataque")).toEqual(["firststrike"]);
    expect(tokenize("【First Strike】")).toEqual(["firststrike"]);
    expect(tokenize("Activate·Main")).toEqual(["activatemain"]);
  });
  it("sem acento e sem stopword", () => {
    expect(normalizeText("Ação Destruída")).toBe("acao destruida");
    expect(tokenize("o que é a mão")).toEqual(["hand"]);
  });
  it("a chave da pergunta ignora acento, caixa e palavra vazia", () => {
    expect(questionKey("Blocker descansado pode bloquear?")).toBe(questionKey("o blocker DESCANSADO pode bloquear"));
  });
});

describe("RulesIndex", () => {
  it("acha código de carta na pergunta", () => {
    expect(cardCodesIn("o GD01-001 e o st01-010 com EXB-001")).toEqual(["GD01-001", "ST01-010", "EXB-001"]);
  });

  it("código de carta traz o FAQ dela no topo", () => {
    const { results, cardCodes } = index.search("dúvida sobre a GD01-001", { limit: 3 });
    expect(cardCodes).toContain("GD01-001");
    expect(results[0].doc.cardCode).toBe("GD01-001");
  });

  it("keyword reconhecida traz o verbete do glossário", () => {
    const { results, keywords } = index.search("como funciona o bloqueador?", { limit: 6 });
    expect(keywords).toContain("blocker");
    expect(results.some((r) => r.doc.id === "kw:blocker")).toBe(true);
  });

  it("recall@6 no conjunto de ouro ≥ 90%", () => {
    const answerable = golden.questions.filter((g) => g.expect.length > 0);
    const misses: string[] = [];
    for (const g of answerable) {
      const top = index.search(g.q, { limit: 6 }).results.map((r) => r.doc.questionPt);
      if (!g.expect.some((e) => top.some((q) => q.includes(e)))) misses.push(g.q);
    }
    const recall = 1 - misses.length / answerable.length;
    expect(answerable.length).toBeGreaterThanOrEqual(40);
    expect(recall, `faltaram: ${misses.join(" | ")}`).toBeGreaterThanOrEqual(0.9);
  });
});
