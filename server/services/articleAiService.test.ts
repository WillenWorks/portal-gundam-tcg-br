import { describe, expect, it, vi } from "vitest";
import {
  buildArticleAiPrompt,
  buildFallbackArticle,
  generateArticleWithAi,
  slugifyArticle,
} from "./articleAiService";

describe("articleAiService", () => {
  it("slugifyArticle formata slugs limpos sem acentos ou caracteres especiais", () => {
    expect(slugifyArticle("Guia de Abertura: Os Melhores Decks de 2026! / ST01")).toBe("guia-de-abertura-os-melhores-decks-de-2026-st01");
    expect(slugifyArticle("Análise de Épicos & Pilotos")).toBe("analise-de-epicos-pilotos");
  });

  it("buildArticleAiPrompt inclui persona, diretrizes de hovercards [[CODIGO]] e sumário de cartas", () => {
    const cards = [
      { code: "GD01-010", namePt: "Gundam Exia", nameEn: "Gundam Exia", color: "Blue", cardType: "UNIT", cost: 3, ap: 4, hp: 3, effectText: "Ao atacar, compra 1 carta." },
    ];
    const prompt = buildArticleAiPrompt(
      { topic: "Deck Celestial Being", context: "Focar em velocidade", postType: "GUIDE" },
      cards,
    );
    expect(prompt).toContain("Principal Jornalista e Analista Estratégico");
    expect(prompt).toContain("[[CODIGO_DA_CARTA]]");
    expect(prompt).toContain("[[GD01-010]]");
    expect(prompt).toContain("Deck Celestial Being");
    expect(prompt).toContain("Focar em velocidade");
  });

  it("buildFallbackArticle gera artigo completo estruturado com markdown e citações de cartas quando a IA estiver offline", () => {
    const cards = [
      { code: "GD01-010", namePt: "Gundam Exia", color: "Blue", imageUrl: "https://cdn.example.com/exia.jpg" },
    ];
    const article = buildFallbackArticle({ topic: "Guia de Exia Blue", postType: "GUIDE" }, cards);

    expect(article.title).toBe("Guia de Exia Blue");
    expect(article.slug).toBe("guia-de-exia-blue");
    expect(article.postType).toBe("GUIDE");
    expect(article.contentMd).toContain("## Visão Geral do Metagame");
    expect(article.contentMd).toContain("[[GD01-010]]");
    expect(article.coverImage).toBe("https://cdn.example.com/exia.jpg");
    expect(article.suggestedCards[0].code).toBe("GD01-010");
  });

  it("generateArticleWithAi retorna artigo válido utilizando o fallback determinístico se nenhuma chave for fornecida", async () => {
    const prisma = {
      card: {
        findMany: vi.fn().mockResolvedValue([
          { code: "ST01-001", namePt: "Gundam", nameEn: "Gundam", imageUrl: "https://cdn.example.com/gundam.jpg", arts: [] },
        ]),
      },
    } as any;

    const res = await generateArticleWithAi(prisma, {
      topic: "Novo Meta ST01",
      apiKeyGemini: "",
      apiKeyClaude: "",
    });

    expect(res.title).toContain("Novo Meta ST01");
    expect(res.contentMd).toContain("[[ST01-001]]");
    expect(res.coverImage).toBe("https://cdn.example.com/gundam.jpg");
  });
});
