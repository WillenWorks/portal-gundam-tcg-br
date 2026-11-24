/* eslint-disable @typescript-eslint/no-explicit-any -- banco em memória: linhas soltas, como o Prisma devolve */
import express, { type NextFunction, type Request, type Response } from "express";
import type { AddressInfo } from "node:net";
import { beforeEach, describe, expect, it } from "vitest";
import type { RulesLlm } from "../rulesAssistant/ask.ts";
import { invalidateRulesIndex, registerRulesAssistantRoutes, startOfBrazilDay } from "./rulesAssistantRoutes.ts";

type Row = Record<string, any>;

const RULINGS: Row[] = [
  {
    id: "r-blocker",
    sourceType: "OFFICIAL_FAQ",
    title: "Keywords",
    questionPt: "O <Blocker> de uma Unidade descansada pode ser ativado?",
    answerPt: "Não. Para usar o Blocker a Unidade precisa estar ativa, porque ela é descansada para bloquear.",
    questionEn: "Can a rested Unit's <Blocker> be activated?",
    answerEn: "No.",
    relatedKeyword: "Blocker",
    relatedPhase: "keywords",
    originalUrl: "https://example.test/faq#blocker",
    cardModel: null,
  },
  {
    id: "r-deck",
    sourceType: "OFFICIAL_RULES",
    title: "Preparing to Play",
    questionPt: "Quantas cartas o deck principal precisa ter?",
    answerPt: "Exatamente 50 cartas.",
    questionEn: null,
    answerEn: null,
    relatedKeyword: null,
    relatedPhase: "preparing_to_play",
    originalUrl: null,
    cardModel: null,
  },
];

function fakePrisma(questions: Row[]) {
  let seq = 0;
  const countWhere = (where: Row) =>
    questions.filter(
      (q) =>
        (where.userId === undefined || q.userId === where.userId) &&
        (!where.createdAt?.gte || q.createdAt >= where.createdAt.gte) &&
        (where.cached === undefined || q.cached === where.cached) &&
        (!where.model || q.model != null),
    ).length;
  return {
    ruling: { findMany: async () => RULINGS },
    cardModel: { findMany: async () => [] },
    rulesQuestion: {
      count: async ({ where }: { where: Row }) => countWhere(where),
      create: async ({ data }: { data: Row }) => {
        const row = { id: `q${++seq}`, createdAt: new Date(), ...data };
        questions.push(row);
        return { id: row.id };
      },
      updateMany: async ({ where, data }: { where: Row; data: Row }) => {
        const rows = questions.filter((q) => q.id === where.id && q.userId === where.userId);
        rows.forEach((q) => Object.assign(q, data));
        return { count: rows.length };
      },
    },
  } as any;
}

/** modelo falso: cita o 1º trecho quando ele fala de Blocker; senão diz que não encontrou */
function fakeLlm(calls: string[]): RulesLlm {
  return async (_system, user) => {
    calls.push(user);
    const first = user.split("\n\n")[1] ?? "";
    const output = first.includes("Blocker") ? { answer: "Não: o Blocker exige a Unidade ativa [1].", citations: [1], notFound: false } : { answer: "", citations: [], notFound: true };
    return { output, model: "fake-model", inputTokens: 100, outputTokens: 20 };
  };
}

function makeApp(questions: Row[], calls: string[], llms?: RulesLlm[]) {
  const app = express();
  app.use(express.json());
  const authRequired = (req: Request, res: Response, next: NextFunction) => (req.header("x-user") ? next() : res.status(401).end());
  registerRulesAssistantRoutes(app, {
    prisma: fakePrisma(questions),
    authRequired,
    currentUser: (req) => {
      const id = req.header("x-user");
      return id ? { userId: id, guest: req.header("x-guest") === "1" } : undefined;
    },
    llms: llms ?? [fakeLlm(calls)],
  });
  return app;
}

async function call(app: express.Express, method: string, url: string, { body, as, guest }: { body?: unknown; as?: string; guest?: boolean } = {}) {
  const server = app.listen(0);
  const { port } = server.address() as AddressInfo;
  try {
    const res = await fetch(`http://127.0.0.1:${port}${url}`, {
      method,
      headers: { "content-type": "application/json", ...(as ? { "x-user": as } : {}), ...(guest ? { "x-guest": "1" } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, json: (await res.json().catch(() => null)) as any };
  } finally {
    server.close();
  }
}

describe("rotas do assistente de regras", () => {
  let questions: Row[];
  let calls: string[];
  beforeEach(() => {
    invalidateRulesIndex();
    questions = [];
    calls = [];
    delete process.env.RULES_ASK_DAILY_USER;
    delete process.env.RULES_ASK_DAILY_GLOBAL;
  });

  it("busca sem login devolve os trechos", async () => {
    const res = await call(makeApp(questions, calls), "GET", "/api/rules/search?q=bloqueador%20descansado");
    expect(res.status).toBe(200);
    // o verbete do glossário e o ruling vêm juntos no topo
    expect(res.json.sources.slice(0, 2).map((s: any) => s.id).sort()).toEqual(["kw:blocker", "r-blocker"]);
    expect(calls).toHaveLength(0);
  });

  it("pergunta exige conta real", async () => {
    const app = makeApp(questions, calls);
    expect((await call(app, "POST", "/api/rules/ask", { body: { question: "blocker descansado bloqueia?" } })).status).toBe(401);
    expect((await call(app, "POST", "/api/rules/ask", { body: { question: "blocker descansado bloqueia?" }, as: "g1", guest: true })).status).toBe(403);
  });

  it("responde com fonte citada e registra a pergunta", async () => {
    const res = await call(makeApp(questions, calls), "POST", "/api/rules/ask", { body: { question: "meu bloqueador descansado pode bloquear?" }, as: "u1" });
    expect(res.status).toBe(200);
    expect(res.json.notFound).toBe(false);
    expect(res.json.cited).toEqual([1]);
    expect(res.json.sources.map((s: any) => s.id)).toContain("r-blocker");
    expect(res.json.remainingToday).toBe(9);
    expect(questions[0]).toMatchObject({ userId: "u1", citedIds: [res.json.sources[0].id], model: "fake-model", cached: false });
  });

  it("pergunta repetida sai do cache sem gastar cota", async () => {
    const app = makeApp(questions, calls);
    await call(app, "POST", "/api/rules/ask", { body: { question: "Blocker descansado pode bloquear?" }, as: "u1" });
    const again = await call(app, "POST", "/api/rules/ask", { body: { question: "o blocker DESCANSADO pode bloquear" }, as: "u2" });
    expect(again.json.cached).toBe(true);
    expect(again.json.remainingToday).toBe(10);
    expect(calls).toHaveLength(1);
  });

  it("cota diária por conta: 429 com os trechos, sem chamar o modelo", async () => {
    process.env.RULES_ASK_DAILY_USER = "1";
    const app = makeApp(questions, calls);
    await call(app, "POST", "/api/rules/ask", { body: { question: "blocker descansado bloqueia?" }, as: "u1" });
    const res = await call(app, "POST", "/api/rules/ask", { body: { question: "quantas cartas tem o deck?" }, as: "u1" });
    expect(res.status).toBe(429);
    expect(res.json.sources[0].id).toBe("r-deck");
    expect(calls).toHaveLength(1);
  });

  it("teto global do dia", async () => {
    process.env.RULES_ASK_DAILY_GLOBAL = "1";
    const app = makeApp(questions, calls);
    await call(app, "POST", "/api/rules/ask", { body: { question: "blocker descansado bloqueia?" }, as: "u1" });
    expect((await call(app, "POST", "/api/rules/ask", { body: { question: "quantas cartas tem o deck?" }, as: "u2" })).status).toBe(429);
  });

  it("sem modelo configurado responde só com a busca e não gasta cota", async () => {
    const res = await call(makeApp(questions, calls, []), "POST", "/api/rules/ask", { body: { question: "quantas cartas tem o deck?" }, as: "u1" });
    expect(res.json).toMatchObject({ notFound: true, assistantAvailable: false, remainingToday: 10 });
    expect(res.json.sources[0].id).toBe("r-deck");
  });

  it("avaliação só de quem perguntou", async () => {
    const app = makeApp(questions, calls);
    const asked = await call(app, "POST", "/api/rules/ask", { body: { question: "blocker descansado bloqueia?" }, as: "u1" });
    expect((await call(app, "POST", `/api/rules/ask/${asked.json.id}/feedback`, { body: { value: -1 }, as: "u2" })).status).toBe(404);
    expect((await call(app, "POST", `/api/rules/ask/${asked.json.id}/feedback`, { body: { value: 2 }, as: "u1" })).status).toBe(400);
    expect((await call(app, "POST", `/api/rules/ask/${asked.json.id}/feedback`, { body: { value: -1, note: "faltou o caso X" }, as: "u1" })).status).toBe(200);
    expect(questions[0]).toMatchObject({ feedback: -1, feedbackNote: "faltou o caso X" });
  });

  it("o dia da cota vira à meia-noite de Brasília", () => {
    // 02:30 UTC de 24/11 = 23:30 de 23/11 em Brasília
    expect(startOfBrazilDay(Date.UTC(2026, 10, 24, 2, 30)).toISOString()).toBe("2026-11-23T03:00:00.000Z");
    expect(startOfBrazilDay(Date.UTC(2026, 10, 24, 3, 30)).toISOString()).toBe("2026-11-24T03:00:00.000Z");
  });
});
