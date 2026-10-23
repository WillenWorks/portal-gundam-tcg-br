import { describe, expect, it, vi } from "vitest";
import { pickCardForPost, generateSocialContentWithGemini, sendDiscordSocialNotification } from "./socialPublisherService";

describe("socialPublisherService", () => {
  it("pickCardForPost retorna dados da carta solicitada", async () => {
    const mockPrisma = {
      card: {
        findFirst: vi.fn().mockResolvedValue({
          code: "ST01-001",
          nameEn: "RX-78-2 Gundam",
          color: "blue",
          cardType: "UNIT",
          ap: 4,
          hp: 4,
          cost: 3,
          effectEn: "Quando ataca: compre 1 carta.",
          imageUrl: "https://example.com/st01-001.png",
        }),
      },
      socialMediaPost: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    } as any;

    const card = await pickCardForPost(mockPrisma, "ST01-001");
    expect(card.code).toBe("ST01-001");
    expect(card.name).toBe("RX-78-2 Gundam");
    expect(card.color).toBe("blue");
  });

  it("generateSocialContentWithGemini gera legenda estruturada de fallback sem API key", async () => {
    const card = {
      code: "ST01-001",
      name: "RX-78-2 Gundam",
      color: "blue",
      type: "Unit",
      ap: 4,
      hp: 4,
      cost: 3,
      text: "Quando ataca: compre 1 carta.",
    };

    const content = await generateSocialContentWithGemini(card, undefined, "");
    expect(content.title).toContain("ST01-001");
    expect(content.fullCaption).toContain("CARTA DO DIA");
    expect(content.fullCaption).toContain("#GundamCardGame");
    expect(content.hashtags.length).toBeGreaterThan(0);
  });

  it("sendDiscordSocialNotification não falha se DISCORD_WEBHOOK_URL não estiver configurada", async () => {
    delete process.env.DISCORD_WEBHOOK_URL;
    const result = await sendDiscordSocialNotification(
      {
        id: "post-1",
        title: "Teste",
        caption: "Legenda de teste",
        imageUrl: "/uploads/social/test.png",
        type: "CARD_SPOTLIGHT",
      },
      "https://anaheimhub.com"
    );
    expect(result).toBeNull();
  });
});
