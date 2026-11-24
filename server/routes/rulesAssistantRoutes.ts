import type { Express, Request, RequestHandler } from "express";
import type { PrismaClient } from "@prisma/client";
import { answerQuestion, rulesLlmsFromEnv, type RulesLlm } from "../rulesAssistant/ask.ts";
import { cardTextDoc, docFromRulingRow, keywordDocs, type RuleDoc } from "../rulesAssistant/corpus.ts";
import { questionKey } from "../rulesAssistant/normalize.ts";
import { RulesIndex } from "../rulesAssistant/rulesIndex.ts";

/**
 * Assistente de regras pt-BR (spec assistente-de-regras):
 * - GET  /api/rules/search?q=        só a busca, sem LLM e sem login
 * - POST /api/rules/ask              pergunta → resposta com fontes; conta real, cota diária, cache de 24 h
 * - POST /api/rules/ask/:id/feedback 👍/👎 de quem perguntou (alimenta a curadoria)
 */

type Deps = {
  prisma: PrismaClient;
  authRequired: RequestHandler;
  /** conta da requisição; `guest` = sessão de convidado (não pergunta) */
  currentUser: (req: Request) => { userId: string; guest?: boolean } | undefined;
  /** modelos na ordem de uso (testes injetam; padrão: chaves do ambiente) */
  llms?: RulesLlm[];
  now?: () => number;
};

export const RULES_ASK_DAILY_USER_DEFAULT = 10;
export const RULES_ASK_DAILY_GLOBAL_DEFAULT = 300;
const INDEX_TTL_MS = 10 * 60_000;
const CACHE_TTL_MS = 24 * 60 * 60_000;
const CACHE_MAX = 500;
const QUESTION_MIN = 3;
const QUESTION_MAX = 400;
/** fuso do Brasil (UTC−3, sem horário de verão): a cota vira à meia-noite daqui */
const BR_OFFSET_MS = 3 * 60 * 60_000;

export function startOfBrazilDay(nowMs: number): Date {
  const local = nowMs - BR_OFFSET_MS;
  return new Date(local - (local % 86_400_000) + BR_OFFSET_MS);
}

const envInt = (value: string | undefined, fallback: number) => {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
};

type PublicSource = {
  n: number;
  id: string;
  kind: RuleDoc["kind"];
  title: string;
  question: string;
  href: string;
  officialUrl?: string;
  autoTranslated?: boolean;
};

const publicSource = (doc: RuleDoc, i: number): PublicSource => ({
  n: i + 1,
  id: doc.id,
  kind: doc.kind,
  title: doc.title,
  question: doc.questionPt,
  href: doc.href,
  officialUrl: doc.officialUrl,
  autoTranslated: doc.autoTranslated,
});

type CachedAnswer = { at: number; answer: string; citations: number[]; notFound: boolean; sources: RuleDoc[] };

let indexState: { index: RulesIndex; builtAt: number } | null = null;
let indexBuilding: Promise<RulesIndex> | null = null;

/** chamar quando um ruling é criado, editado ou apagado (a próxima pergunta remonta o índice) */
export function invalidateRulesIndex() {
  indexState = null;
}

async function buildIndex(prisma: PrismaClient): Promise<RulesIndex> {
  const rows = await prisma.ruling.findMany({
    where: { isActive: true, deletedAt: null },
    select: {
      id: true,
      sourceType: true,
      title: true,
      questionPt: true,
      answerPt: true,
      questionEn: true,
      answerEn: true,
      relatedKeyword: true,
      relatedPhase: true,
      originalUrl: true,
      cardModel: { select: { code: true, nameEn: true, namePt: true } },
    },
  });
  const docs = rows.map(docFromRulingRow).filter((d): d is RuleDoc => d !== null);
  return new RulesIndex([...docs, ...keywordDocs()]);
}

export function registerRulesAssistantRoutes(app: Express, deps: Deps) {
  const { prisma, authRequired } = deps;
  const now = deps.now ?? (() => Date.now());
  const llms = deps.llms ?? rulesLlmsFromEnv();
  const cache = new Map<string, CachedAnswer>();

  async function getIndex(): Promise<RulesIndex> {
    if (indexState && now() - indexState.builtAt < INDEX_TTL_MS) return indexState.index;
    if (!indexBuilding) {
      indexBuilding = buildIndex(prisma)
        .then((index) => {
          indexState = { index, builtAt: now() };
          return index;
        })
        .finally(() => {
          indexBuilding = null;
        });
    }
    return indexBuilding;
  }

  /** busca + texto das cartas citadas (do banco) na frente */
  async function retrieve(question: string, cardCode?: string): Promise<RuleDoc[]> {
    const index = await getIndex();
    const { results, cardCodes } = index.search(question, { limit: 8, cardCodes: cardCode ? [cardCode] : [] });
    const codes = cardCodes.slice(0, 3);
    const cards = codes.length
      ? await prisma.cardModel.findMany({
          where: { code: { in: codes } },
          select: { code: true, nameEn: true, namePt: true, effectPt: true, effectEn: true },
        })
      : [];
    const cardDocs = cards.map(cardTextDoc).filter((d): d is RuleDoc => d !== null);
    return [...cardDocs, ...results.map((r) => r.doc)];
  }

  app.get("/api/rules/search", async (req, res) => {
    const q = typeof req.query.q === "string" ? req.query.q.trim().slice(0, QUESTION_MAX) : "";
    if (q.length < QUESTION_MIN) return res.json({ sources: [] });
    const docs = await retrieve(q);
    res.json({ sources: docs.slice(0, 8).map(publicSource) });
  });

  app.post("/api/rules/ask", authRequired, async (req, res) => {
    const user = deps.currentUser(req);
    if (!user?.userId || user.guest) {
      return res.status(403).json({ error: "Entre com a sua conta para perguntar ao assistente." });
    }
    const body = (req.body ?? {}) as { question?: unknown; cardCode?: unknown };
    const question = typeof body.question === "string" ? body.question.replace(/\s+/g, " ").trim() : "";
    if (question.length < QUESTION_MIN || question.length > QUESTION_MAX) {
      return res.status(400).json({ error: `A pergunta precisa ter de ${QUESTION_MIN} a ${QUESTION_MAX} caracteres.` });
    }
    const cardCode = typeof body.cardCode === "string" && /^[A-Za-z]{1,4}\d{0,2}-\d{3}$/.test(body.cardCode) ? body.cardCode.toUpperCase() : undefined;
    const started = now();
    const dailyUser = envInt(process.env.RULES_ASK_DAILY_USER, RULES_ASK_DAILY_USER_DEFAULT);
    const dailyGlobal = envInt(process.env.RULES_ASK_DAILY_GLOBAL, RULES_ASK_DAILY_GLOBAL_DEFAULT);
    const since = startOfBrazilDay(started);
    // só conta o que chamou o modelo (cache e modo só-busca não gastam cota)
    const usedToday = await prisma.rulesQuestion.count({ where: { userId: user.userId, createdAt: { gte: since }, cached: false, model: { not: null } } });

    const normalized = questionKey(question);
    const cacheKey = `${normalized}|${cardCode ?? ""}`;
    const hit = cache.get(cacheKey);
    let outcome: { answer: string; citations: number[]; notFound: boolean; sources: RuleDoc[]; model: string | null; inputTokens?: number; outputTokens?: number };
    let cached = false;
    if (hit && started - hit.at < CACHE_TTL_MS) {
      outcome = { ...hit, model: null };
      cached = true;
    } else {
      const docs = await retrieve(question, cardCode);
      const globalToday = usedToday >= dailyUser ? 0 : await prisma.rulesQuestion.count({ where: { createdAt: { gte: since }, cached: false, model: { not: null } } });
      if (usedToday >= dailyUser || globalToday >= dailyGlobal) {
        return res.status(429).json({
          error:
            usedToday >= dailyUser
              ? `Você já fez as ${dailyUser} perguntas de hoje. Os trechos mais próximos estão abaixo; amanhã a cota renova.`
              : "O assistente atingiu o limite de hoje. Os trechos mais próximos estão abaixo.",
          sources: docs.slice(0, 6).map(publicSource),
          remainingToday: Math.max(0, dailyUser - usedToday),
        });
      }
      outcome = await answerQuestion(question, docs, llms);
      if (outcome.model) {
        if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
        cache.set(cacheKey, { at: started, answer: outcome.answer, citations: outcome.citations, notFound: outcome.notFound, sources: outcome.sources });
      }
    }

    const record = await prisma.rulesQuestion.create({
      data: {
        userId: user.userId,
        question,
        normalized,
        answer: outcome.notFound ? null : outcome.answer,
        sourceIds: outcome.sources.map((d) => d.id),
        citedIds: outcome.citations.map((n) => outcome.sources[n - 1]?.id).filter((id): id is string => Boolean(id)),
        notFound: outcome.notFound,
        cached,
        model: outcome.model,
        inputTokens: outcome.inputTokens ?? null,
        outputTokens: outcome.outputTokens ?? null,
        latencyMs: now() - started,
      },
      select: { id: true },
    });
    const spent = !cached && outcome.model ? 1 : 0;
    res.json({
      id: record.id,
      answer: outcome.answer,
      notFound: outcome.notFound,
      cited: outcome.citations,
      sources: outcome.sources.map(publicSource),
      cached,
      // sem modelo configurado a rota responde só com a busca
      assistantAvailable: llms.length > 0,
      remainingToday: Math.max(0, dailyUser - usedToday - spent),
    });
  });

  app.post("/api/rules/ask/:id/feedback", authRequired, async (req, res) => {
    const user = deps.currentUser(req);
    if (!user?.userId || user.guest) return res.status(403).json({ error: "Entre com a sua conta." });
    const id = String(req.params.id ?? "");
    const body = (req.body ?? {}) as { value?: unknown; note?: unknown };
    if (!id || (body.value !== 1 && body.value !== -1)) return res.status(400).json({ error: "Avaliação inválida." });
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 1000) : null;
    const updated = await prisma.rulesQuestion.updateMany({ where: { id, userId: user.userId }, data: { feedback: body.value, feedbackNote: note || null } });
    if (updated.count === 0) return res.status(404).json({ error: "Pergunta não encontrada." });
    res.json({ ok: true });
  });
}
