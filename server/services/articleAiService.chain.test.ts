/* Cadeia de IA do gerador de artigos: Gemini (vários modelos) → Claude → modelo fixo, com a preferência do painel e o
 * registro de quem escreveu (`generationMeta`). */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";

const genai = vi.hoisted(() => ({ generateContent: vi.fn() }));
vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = { generateContent: genai.generateContent };
  },
}));

const claude = vi.hoisted(() => ({ parse: vi.fn() }));
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    beta = { messages: { parse: claude.parse } };
  },
}));

import { CLAUDE_ARTICLE_MODEL, GEMINI_ARTICLE_MODELS, generateArticleWithAi } from "./articleAiService";

const prisma = { card: { findMany: vi.fn().mockResolvedValue([]) } } as unknown as PrismaClient;
const article = { title: "Guia do ST01", slug: "guia-st01", excerpt: "Resumo.", postType: "GUIDE", contentMd: "# Guia\n\nTexto.", tags: [] };

beforeEach(() => {
  genai.generateContent.mockReset();
  claude.parse.mockReset();
});

describe("generateArticleWithAi — cadeia de IA", () => {
  it("Gemini respondendo: usa o artigo dele e registra o modelo", async () => {
    genai.generateContent.mockResolvedValue({ text: JSON.stringify(article) });
    const res = await generateArticleWithAi(prisma, { topic: "ST01", apiKeyGemini: "g", apiKeyClaude: "c" });
    expect(res.title).toBe("Guia do ST01");
    expect(res.generationMeta).toMatchObject({ provider: "gemini", model: GEMINI_ARTICLE_MODELS[0] });
    expect(claude.parse).not.toHaveBeenCalled();
  });

  it("Gemini devolvendo JSON sem o texto não trava a cadeia: o Claude ainda é tentado", async () => {
    genai.generateContent.mockResolvedValue({ text: JSON.stringify({ title: "Só título" }) });
    claude.parse.mockResolvedValue({ stop_reason: "end_turn", parsed_output: article });
    const res = await generateArticleWithAi(prisma, { topic: "ST01", apiKeyGemini: "g", apiKeyClaude: "c" });
    expect(claude.parse).toHaveBeenCalledTimes(1);
    expect(res.generationMeta).toMatchObject({ provider: "claude", model: CLAUDE_ARTICLE_MODEL });
    expect(res.contentMd).toContain("Texto.");
  });

  it("o Claude é chamado com o modelo atual, o mesmo que vai para o registro", async () => {
    claude.parse.mockResolvedValue({ stop_reason: "end_turn", parsed_output: article });
    await generateArticleWithAi(prisma, { topic: "ST01", apiKeyGemini: "", apiKeyClaude: "c" });
    expect(claude.parse.mock.calls[0][0].model).toBe(CLAUDE_ARTICLE_MODEL);
  });

  it("preferência pelo Claude: ele vem primeiro; o Gemini só se ele falhar", async () => {
    claude.parse.mockResolvedValue({ stop_reason: "end_turn", parsed_output: article });
    const res = await generateArticleWithAi(prisma, { topic: "ST01", apiKeyGemini: "g", apiKeyClaude: "c", modelPreference: "claude" });
    expect(res.generationMeta?.provider).toBe("claude");
    expect(genai.generateContent).not.toHaveBeenCalled();
  });

  it("recusa do Claude conta como falha", async () => {
    claude.parse.mockResolvedValue({ stop_reason: "refusal", parsed_output: null });
    const res = await generateArticleWithAi(prisma, { topic: "ST01", apiKeyGemini: "", apiKeyClaude: "c" });
    expect(res.generationMeta?.provider).toBe("fallback");
  });
});
