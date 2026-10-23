import { describe, expect, it, vi } from "vitest";

const genai = vi.hoisted(() => ({ generateContent: vi.fn() }));
vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = { generateContent: genai.generateContent };
  },
}));
import {
  buildSocialCardHtml,
  captionProblems,
  generateSocialContentWithGemini,
  missingAdDisclosure,
  pickCardForPost,
  publishApprovedPost,
  safeFileStem,
  sendDiscordSocialNotification,
} from "./socialPublisherService";

const cardRow = {
  code: "ST01-001",
  nameEn: "Gundam",
  namePt: null,
  color: "Blue",
  cardType: "UNIT",
  ap: 3,
  hp: 4,
  cost: 3,
  level: 4,
  effectEn: "<Repair 2> (At the end of your turn...)",
  effectPt: "<Repair 2> (No final do seu turno...)",
  imageUrl: "https://example.com/st01-001.png",
};

describe("socialPublisherService", () => {
  it("pickCardForPost devolve a carta pedida com o texto em português e o nome oficial", async () => {
    const prisma = { card: { findFirst: vi.fn().mockResolvedValue(cardRow) }, socialMediaPost: { findMany: vi.fn() } } as any;
    const card = await pickCardForPost(prisma, "st01-001");
    expect(card).toMatchObject({ code: "ST01-001", name: "Gundam", color: "blue", text: "<Repair 2> (No final do seu turno...)" });
    expect(prisma.card.findFirst.mock.calls[0][0].where.code).toBe("ST01-001");
  });

  it("pickCardForPost recusa código com caracteres de caminho", async () => {
    const prisma = { card: { findFirst: vi.fn() } } as any;
    await expect(pickCardForPost(prisma, "../../etc/passwd")).rejects.toThrow(/inválido/);
    expect(prisma.card.findFirst).not.toHaveBeenCalled();
  });

  it("pickCardForPost sorteia entre as cartas elegíveis e evita as dos últimos posts", async () => {
    const prisma = {
      card: { count: vi.fn().mockResolvedValue(10), findFirst: vi.fn().mockResolvedValue(cardRow) },
      socialMediaPost: { findMany: vi.fn().mockResolvedValue([{ cardCode: "GD01-001" }]) },
    } as any;
    await pickCardForPost(prisma, undefined, () => 0.75);
    const args = prisma.card.findFirst.mock.calls[0][0];
    expect(args.skip).toBe(7);
    expect(args.where.code).toEqual({ notIn: ["GD01-001"] });
    expect(args.where.isPrimaryPrint).toBe(true);
  });

  it("modelo fixo (sem chave do Gemini) usa só os dados da carta", async () => {
    const content = await generateSocialContentWithGemini({ code: "ST01-001", name: "Gundam", color: "blue", type: "UNIT", ap: 3, hp: 4, cost: 3, text: "efeito" }, undefined, "");
    expect(content.title).toContain("ST01-001");
    expect(content.fullCaption).toContain("CARTA DO DIA");
    expect(content.fullCaption).toContain("#GundamCardGame");
    expect(content.fullCaption).toContain("Unidade");
  });

  it("Gemini sobrecarregado (503) num modelo: tenta o próximo antes de cair no texto fixo", async () => {
    genai.generateContent.mockReset();
    genai.generateContent
      .mockRejectedValueOnce(new Error('{"error":{"code":503,"status":"UNAVAILABLE"}}'))
      .mockResolvedValueOnce({ text: JSON.stringify({ title: "Gundam em foco", fullCaption: "Legenda do Gemini #GundamCardGame" }) });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const content = await generateSocialContentWithGemini({ code: "ST01-001", name: "Gundam", color: "blue", type: "UNIT", text: "efeito" }, undefined, "chave");
    warn.mockRestore();
    expect(content.fullCaption).toContain("Legenda do Gemini");
    const models = genai.generateContent.mock.calls.map(([req]) => req.model);
    expect(models).toHaveLength(2);
    expect(models[0]).not.toBe(models[1]);
  });

  it("todos os modelos do Gemini falhando: usa o texto fixo", async () => {
    genai.generateContent.mockReset();
    genai.generateContent.mockRejectedValue(new Error("503"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const content = await generateSocialContentWithGemini({ code: "ST01-001", name: "Gundam", color: "blue", type: "UNIT", text: "efeito" }, undefined, "chave");
    warn.mockRestore();
    expect(content.fullCaption).toContain("CARTA DO DIA");
  });

  it("arte: palavras-chave entre < > aparecem escapadas (antes sumiam como tag HTML)", () => {
    const html = buildSocialCardHtml({ code: "ST01-001", name: 'Gundam "<b>"', color: "blue", type: "UNIT", text: "<Repair 2> teste", imageUrl: "javascript:alert(1)" });
    expect(html).toContain("&lt;Repair 2&gt; teste");
    expect(html).toContain("Gundam &quot;&lt;b&gt;&quot;");
    expect(html).not.toContain("javascript:");
    expect(html).toContain("sem vínculo com a Bandai");
  });

  it("nome do arquivo nunca sai da pasta", () => {
    expect(safeFileStem("../../x/GD01-001")).toBe("xGD01-001");
    expect(safeFileStem("///")).toBe("carta");
  });

  it("valida limites da legenda e a identificação de publicidade", () => {
    expect(captionProblems("ok #a")).toEqual([]);
    expect(captionProblems("x".repeat(2201))[0]).toContain("2201");
    expect(captionProblems(Array.from({ length: 31 }, (_, i) => `#t${i}`).join(" "))[0]).toContain("31 hashtags");
    expect(missingAdDisclosure("PRODUCT_AFFILIATE", "Compre já!")).toBe(true);
    expect(missingAdDisclosure("PRODUCT_AFFILIATE", "Compre já! #publi")).toBe(false);
    expect(missingAdDisclosure("CARD_SPOTLIGHT", "Carta do dia")).toBe(false);
  });

  it("Discord: sem webhook (ou com endereço que não é do Discord) não envia", async () => {
    delete process.env.DISCORD_WEBHOOK_URL;
    const post = { id: "p1", title: "T", caption: "L", imageUrl: null, type: "CARD_SPOTLIGHT" };
    expect(await sendDiscordSocialNotification(post, "https://anaheimhub.com")).toBeNull();
    process.env.DISCORD_WEBHOOK_URL = "https://exemplo.com/webhook";
    expect(await sendDiscordSocialNotification(post, "https://anaheimhub.com")).toBeNull();
    delete process.env.DISCORD_WEBHOOK_URL;
  });

  describe("publishApprovedPost", () => {
    const basePost = { id: "p1", type: "CARD_SPOTLIGHT", status: "PUBLISHING", title: "T", caption: "Legenda #GCG", imageUrl: "/uploads/social/social-GD01-001-1.jpg", scheduledFor: null };
    const makePrisma = (claimCount = 1, post: Record<string, unknown> = basePost) =>
      ({
        socialMediaPost: {
          updateMany: vi.fn().mockResolvedValue({ count: claimCount }),
          findUniqueOrThrow: vi.fn().mockResolvedValue(post),
          update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ ...post, ...data })),
        },
      }) as any;

    it("não publica post que não está aprovado (ou já está publicando)", async () => {
      const publish = vi.fn();
      await expect(publishApprovedPost(makePrisma(0), "p1", { publish })).rejects.toThrow(/não está aprovado/);
      expect(publish).not.toHaveBeenCalled();
    });

    it("publica com a URL pública da imagem e marca PUBLISHED", async () => {
      const prisma = makePrisma();
      const publish = vi.fn().mockResolvedValue({ mediaId: "999", permalink: "https://www.instagram.com/p/x/" });
      const result = await publishApprovedPost(prisma, "p1", { publish, publicAppUrl: "https://anaheimhub.com/" });
      expect(publish.mock.calls[0][1].imageUrl).toBe("https://anaheimhub.com/uploads/social/social-GD01-001-1.jpg");
      expect(result.status).toBe("PUBLISHED");
      expect(result.instagramPostId).toBe("999");
    });

    it("sem imagem JPEG marca FAILED com o motivo", async () => {
      const prisma = makePrisma(1, { ...basePost, imageUrl: "/uploads/social/antigo.png" });
      const publish = vi.fn();
      const result = await publishApprovedPost(prisma, "p1", { publish });
      expect(publish).not.toHaveBeenCalled();
      expect(result.status).toBe("FAILED");
      expect(result.publishError).toContain("JPEG");
    });

    it("erro do Instagram marca FAILED e guarda a mensagem", async () => {
      const prisma = makePrisma();
      const publish = vi.fn().mockRejectedValue(new Error("Instagram (publicar): limite atingido"));
      const result = await publishApprovedPost(prisma, "p1", { publish });
      expect(result.status).toBe("FAILED");
      expect(result.publishError).toContain("limite atingido");
    });
  });
});
