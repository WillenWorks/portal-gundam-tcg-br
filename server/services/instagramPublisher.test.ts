import { describe, expect, it, vi } from "vitest";
import {
  countHashtags,
  decryptToken,
  encryptToken,
  normalizeInstagramAltText,
  normalizeInstagramCaption,
  publishInstagramCarousel,
  publishInstagramImage,
  publishInstagramReel,
  publishInstagramStory,
  readInstagramConfig,
  refreshInstagramTokenIfNeeded,
} from "./instagramPublisher";

const env = { JWT_SECRET: "segredo-de-teste" } as NodeJS.ProcessEnv;
const config = { userId: "17841400000000000", envToken: "TOKEN-ENV", version: "v26.0" };

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const prismaWithoutStoredToken = () =>
  ({
    socialIntegrationToken: {
      findUnique: vi.fn().mockResolvedValue(null),
      upsert: vi.fn().mockResolvedValue({}),
    },
  }) as any;

describe("instagramPublisher", () => {
  it("só considera configurado com id numérico e token", () => {
    expect(readInstagramConfig({})).toBeNull();
    expect(readInstagramConfig({ INSTAGRAM_USER_ID: "abc", INSTAGRAM_ACCESS_TOKEN: "x" })).toBeNull();
    expect(readInstagramConfig({ INSTAGRAM_USER_ID: "17841400000000000", INSTAGRAM_ACCESS_TOKEN: "x" })).toEqual({ userId: "17841400000000000", envToken: "x", version: "v26.0" });
  });

  it("criptografa e descriptografa o token (e não aceita chave errada)", () => {
    const enc = encryptToken("meu-token", env);
    expect(enc).not.toContain("meu-token");
    expect(decryptToken(enc, env)).toBe("meu-token");
    expect(() => decryptToken(enc, { JWT_SECRET: "outra" } as NodeJS.ProcessEnv)).toThrow();
  });

  it("limita a legenda a 30 hashtags e 2.200 caracteres", () => {
    const tags = Array.from({ length: 35 }, (_, i) => `#tag${i}`).join(" ");
    const normalized = normalizeInstagramCaption(`Texto\n\n${tags}`);
    expect(countHashtags(normalized)).toBe(30);
    expect(normalizeInstagramCaption("a".repeat(3000)).length).toBe(2200);
  });

  it("normaliza o alt_text de SEO/acessibilidade em uma linha de até 1.000 caracteres", () => {
    expect(normalizeInstagramAltText(undefined)).toBe("");
    expect(normalizeInstagramAltText("   ")).toBe("");
    expect(normalizeInstagramAltText("Carta ST01-001\n\nGundam • Unidade")).toBe("Carta ST01-001 Gundam • Unidade");
    expect(normalizeInstagramAltText("x".repeat(1200)).length).toBe(1000);
  });

  it("publica em três passos (contêiner, status, publicação) sem pôr o token na URL de POST e envia alt_text quando informado", async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const fetchFn = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      if (url.endsWith("/media")) return jsonResponse({ id: "111" });
      if (url.includes("/111?")) return jsonResponse({ status_code: "FINISHED" });
      if (url.endsWith("/media_publish")) return jsonResponse({ id: "222" });
      if (url.includes("/222?")) return jsonResponse({ permalink: "https://www.instagram.com/p/abc/" });
      return jsonResponse({}, 404);
    }) as unknown as typeof fetch;

    const result = await publishInstagramImage(
      prismaWithoutStoredToken(),
      {
        imageUrl: "https://anaheimhub.com/uploads/social/social-GD01-001-1.jpg",
        caption: "Legenda #GundamCardGame",
        altText: "Carta GD01-001 do Gundam Card Game",
      },
      { config, fetchFn, pollDelayMs: 0 },
    );
    expect(result).toEqual({ mediaId: "222", permalink: "https://www.instagram.com/p/abc/" });
    expect(calls[0].url).toBe("https://graph.instagram.com/v26.0/17841400000000000/media");
    expect(calls[0].url).not.toContain("TOKEN");
    expect(String(calls[0].init?.body)).toContain("image_url=");
    expect(decodeURIComponent(String(calls[0].init?.body)).replace(/\+/g, " ")).toContain("alt_text=Carta GD01-001 do Gundam Card Game");
    expect(calls[2].url).toBe("https://graph.instagram.com/v26.0/17841400000000000/media_publish");
  });

  it("recusa imagem que não seja JPEG em https", async () => {
    await expect(
      publishInstagramImage(prismaWithoutStoredToken(), { imageUrl: "https://anaheimhub.com/x.png", caption: "x" }, { config, fetchFn: vi.fn() as any }),
    ).rejects.toThrow(/JPEG/);
  });

  it("erro da API vira mensagem legível e sem token", async () => {
    const fetchFn = vi.fn(async () => jsonResponse({ error: { message: "Invalid access_token=SEGREDO123", code: 190 } }, 400)) as unknown as typeof fetch;
    const err = (await publishInstagramImage(prismaWithoutStoredToken(), { imageUrl: "https://a.com/x.jpg", caption: "x" }, { config, fetchFn }).catch((e: unknown) => e)) as Error;
    expect(err.message).toContain("código 190");
    expect(err.message).not.toContain("SEGREDO123");
  });

  it("contêiner com erro interrompe a publicação", async () => {
    const fetchFn = vi.fn(async (url: string) => (url.endsWith("/media") ? jsonResponse({ id: "111" }) : jsonResponse({ status_code: "ERROR" }))) as unknown as typeof fetch;
    await expect(publishInstagramImage(prismaWithoutStoredToken(), { imageUrl: "https://a.com/x.jpg", caption: "x" }, { config, fetchFn, pollDelayMs: 0 })).rejects.toThrow(/ERROR/);
  });

  it("renova o token quando nunca foi renovado e guarda criptografado", async () => {
    process.env.JWT_SECRET ||= "segredo-de-teste";
    const prisma = prismaWithoutStoredToken();
    const fetchFn = vi.fn(async () => jsonResponse({ access_token: "TOKEN-NOVO", expires_in: 5184000 })) as unknown as typeof fetch;
    const now = new Date("2026-10-23T12:00:00Z");
    expect(await refreshInstagramTokenIfNeeded(prisma, { config, fetchFn, now })).toBe("refreshed");
    const saved = prisma.socialIntegrationToken.upsert.mock.calls[0][0];
    expect(saved.create.tokenEnc).not.toContain("TOKEN-NOVO");
    expect(decryptToken(saved.create.tokenEnc)).toBe("TOKEN-NOVO");
    expect(saved.create.expiresAt.toISOString()).toBe("2026-12-22T12:00:00.000Z");
  });

  it("não renova se a última renovação tem menos de 7 dias", async () => {
    process.env.JWT_SECRET ||= "segredo-de-teste";
    const prisma = {
      socialIntegrationToken: {
        findUnique: vi.fn().mockResolvedValue({ tokenEnc: encryptToken("T"), expiresAt: null, refreshedAt: new Date("2026-10-20T00:00:00Z") }),
        upsert: vi.fn(),
      },
    } as any;
    const fetchFn = vi.fn();
    expect(await refreshInstagramTokenIfNeeded(prisma, { config, fetchFn: fetchFn as any, now: new Date("2026-10-23T00:00:00Z") })).toBe("fresh");
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("carrossel: um contêiner por imagem (com alt_text), espera cada um, cria o pai CAROUSEL e publica", async () => {
    const calls: { url: string; body: string }[] = [];
    let child = 0;
    const fetchFn = vi.fn(async (url: string, init?: RequestInit) => {
      const body = String(init?.body ?? "");
      calls.push({ url, body });
      if (url.endsWith("/media") && body.includes("is_carousel_item=true")) return jsonResponse({ id: String(100 + ++child) });
      if (url.endsWith("/media")) return jsonResponse({ id: "900" });
      if (/\/(101|102|103|900)\?/.test(url)) return jsonResponse({ status_code: "FINISHED" });
      if (url.endsWith("/media_publish")) return jsonResponse({ id: "222" });
      if (url.includes("/222?")) return jsonResponse({ permalink: "https://www.instagram.com/p/car/" });
      return jsonResponse({}, 404);
    }) as unknown as typeof fetch;

    const urls = [1, 2, 3].map((i) => `https://anaheimhub.com/uploads/social/social-x-${i}.jpg`);
    const result = await publishInstagramCarousel(
      prismaWithoutStoredToken(),
      { imageUrls: urls, caption: "Legenda", altTexts: ["Slide 1", "Slide 2", "Slide 3"] },
      { config, fetchFn, pollDelayMs: 0 },
    );
    expect(result).toEqual({ mediaId: "222", permalink: "https://www.instagram.com/p/car/" });
    const posts = calls.filter((c) => c.body);
    // filhos sem legenda, na ordem, com alt_text individual
    expect(posts.slice(0, 3).map((c) => decodeURIComponent(c.body.match(/image_url=([^&]+)/)?.[1] ?? ""))).toEqual(urls);
    expect(posts.slice(0, 3).every((c) => !c.body.includes("caption="))).toBe(true);
    expect(posts.slice(0, 3).map((c) => decodeURIComponent(c.body.match(/alt_text=([^&]+)/)?.[1] ?? "").replace(/\+/g, " "))).toEqual([
      "Slide 1",
      "Slide 2",
      "Slide 3",
    ]);
    const parent = posts[3].body;
    expect(parent).toContain("media_type=CAROUSEL");
    expect(decodeURIComponent(parent)).toContain("children=101,102,103");
    expect(parent).toContain("caption=Legenda");
    expect(posts[4].url).toMatch(/media_publish$/);
    expect(posts[4].body).toContain("creation_id=900");
  });

  it("carrossel: filho recusado interrompe antes de criar o pai", async () => {
    const fetchFn = vi.fn(async (url: string) => (url.endsWith("/media") ? jsonResponse({ id: "101" }) : jsonResponse({ status_code: "ERROR" }))) as unknown as typeof fetch;
    const urls = ["https://a.com/1.jpg", "https://a.com/2.jpg"];
    await expect(publishInstagramCarousel(prismaWithoutStoredToken(), { imageUrls: urls, caption: "x" }, { config, fetchFn, pollDelayMs: 0 })).rejects.toThrow(/ERROR/);
    expect((fetchFn as any).mock.calls.filter(([u]: [string]) => u.endsWith("/media")).length).toBe(1);
  });

  it("carrossel: aceita de 2 a 10 imagens JPEG em https", async () => {
    const fetchFn = vi.fn() as any;
    const run = (imageUrls: string[]) => publishInstagramCarousel(prismaWithoutStoredToken(), { imageUrls, caption: "x" }, { config, fetchFn });
    await expect(run(["https://a.com/1.jpg"])).rejects.toThrow(/2 a 10/);
    await expect(run(Array.from({ length: 11 }, (_, i) => `https://a.com/${i}.jpg`))).rejects.toThrow(/2 a 10/);
    await expect(run(["https://a.com/1.jpg", "https://a.com/2.png"])).rejects.toThrow(/JPEG/);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("Reels: cria contêiner REELS com video_url MP4, cover_url e share_to_feed=true, aguarda FINISHED e publica", async () => {
    const calls: { url: string; body: string }[] = [];
    const fetchFn = vi.fn(async (url: string, init?: RequestInit) => {
      const body = String(init?.body ?? "");
      calls.push({ url, body });
      if (url.endsWith("/media")) return jsonResponse({ id: "555" });
      if (url.includes("/555?")) return jsonResponse({ status_code: "FINISHED" });
      if (url.endsWith("/media_publish")) return jsonResponse({ id: "777" });
      if (url.includes("/777?")) return jsonResponse({ permalink: "https://www.instagram.com/reel/xyz/" });
      return jsonResponse({}, 404);
    }) as unknown as typeof fetch;

    const result = await publishInstagramReel(
      prismaWithoutStoredToken(),
      {
        videoUrl: "https://anaheimhub.com/uploads/social/social-reel-ST01-001-1.mp4",
        coverUrl: "https://anaheimhub.com/uploads/social/social-reel-ST01-001-1-cover.jpg",
        caption: "Revelação da carta da semana #GundamCardGame",
      },
      { config, fetchFn, pollDelayMs: 0 },
    );
    expect(result).toEqual({ mediaId: "777", permalink: "https://www.instagram.com/reel/xyz/" });
    const createBody = decodeURIComponent(calls[0].body).replace(/\+/g, " ");
    expect(createBody).toContain("media_type=REELS");
    expect(createBody).toContain("video_url=https://anaheimhub.com/uploads/social/social-reel-ST01-001-1.mp4");
    expect(createBody).toContain("cover_url=https://anaheimhub.com/uploads/social/social-reel-ST01-001-1-cover.jpg");
    expect(createBody).toContain("share_to_feed=true");
  });

  it("Reels: recusa URL que não seja MP4 em https", async () => {
    await expect(
      publishInstagramReel(prismaWithoutStoredToken(), { videoUrl: "https://anaheimhub.com/x.webm", caption: "x" }, { config, fetchFn: vi.fn() as any }),
    ).rejects.toThrow(/MP4/);
  });

  it("Story: cria contêiner STORIES com video_url MP4 (ou image_url JPEG), aguarda FINISHED e publica", async () => {
    const calls: { url: string; body: string }[] = [];
    const fetchFn = vi.fn(async (url: string, init?: RequestInit) => {
      const body = String(init?.body ?? "");
      calls.push({ url, body });
      if (url.endsWith("/media")) return jsonResponse({ id: "666" });
      if (url.includes("/666?")) return jsonResponse({ status_code: "FINISHED" });
      if (url.endsWith("/media_publish")) return jsonResponse({ id: "888" });
      if (url.includes("/888?")) return jsonResponse({ permalink: "https://www.instagram.com/stories/anaheimhub/888/" });
      return jsonResponse({}, 404);
    }) as unknown as typeof fetch;

    const result = await publishInstagramStory(
      prismaWithoutStoredToken(),
      { videoUrl: "https://anaheimhub.com/uploads/social/social-GD01-010-story-1.mp4" },
      { config, fetchFn, pollDelayMs: 0 },
    );
    expect(result).toEqual({ mediaId: "888", permalink: "https://www.instagram.com/stories/anaheimhub/888/" });
    const createBody = decodeURIComponent(calls[0].body).replace(/\+/g, " ");
    expect(createBody).toContain("media_type=STORIES");
    expect(createBody).toContain("video_url=https://anaheimhub.com/uploads/social/social-GD01-010-story-1.mp4");
  });
});
