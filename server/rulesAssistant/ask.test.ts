import { describe, expect, it } from "vitest";
import { answerQuestion, buildUserPrompt, validateAnswer, type RulesLlm } from "./ask.ts";
import type { RuleDoc } from "./corpus.ts";

const doc = (id: string, q: string, a: string): RuleDoc => ({ id, kind: "ruling", title: "T", questionPt: q, answerPt: a, href: `/rules/${id}` });
const DOCS = [doc("a", "O Blocker descansado bloqueia?", "Não."), doc("b", "Quantas cartas no deck?", "50.")];

describe("validateAnswer", () => {
  it("aceita resposta com [n] dentro dos trechos", () => {
    expect(validateAnswer({ answer: "Não bloqueia [1].", citations: [1], notFound: false }, 2)).toEqual({ answer: "Não bloqueia [1].", citations: [1], notFound: false });
  });
  it("junta as citações do texto às da lista", () => {
    expect(validateAnswer({ answer: "Não [1], e o deck tem 50 [2].", citations: [1], notFound: false }, 2).citations).toEqual([1, 2]);
  });
  it("citação fora dos trechos invalida a resposta", () => {
    expect(validateAnswer({ answer: "Sim [3].", citations: [3], notFound: false }, 2).notFound).toBe(true);
  });
  it("resposta sem [n] no texto vira não encontrado", () => {
    expect(validateAnswer({ answer: "Sim, pode.", citations: [1], notFound: false }, 2).notFound).toBe(true);
  });
  it("formato inválido vira não encontrado", () => {
    expect(validateAnswer({ texto: "oi" }, 2)).toEqual({ answer: "", citations: [], notFound: true });
  });
});

describe("answerQuestion", () => {
  it("numera os trechos no prompt", () => {
    expect(buildUserPrompt("pergunta?", DOCS)).toContain("[2] (ruling \"T\")\nP: Quantas cartas no deck?");
  });
  it("cai no modelo de reserva quando o primeiro falha", async () => {
    const broken: RulesLlm = async () => {
      throw new Error("fora do ar");
    };
    const backup: RulesLlm = async () => ({ output: { answer: "Não [1].", citations: [1], notFound: false }, model: "reserva" });
    const out = await answerQuestion("blocker?", DOCS, [broken, backup]);
    expect(out).toMatchObject({ answer: "Não [1].", model: "reserva", notFound: false });
  });
  it("sem trechos não chama o modelo", async () => {
    let called = false;
    const out = await answerQuestion("x", [], [async () => ((called = true), null)]);
    expect(out.notFound).toBe(true);
    expect(called).toBe(false);
  });
});
