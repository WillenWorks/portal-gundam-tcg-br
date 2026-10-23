import { describe, expect, it, vi } from "vitest";
import {
  countHashtags,
  decryptToken,
  encryptToken,
  normalizeInstagramCaption,
  publishInstagramImage,
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

  it("publica em três passos (contêiner, status, publicação) sem pôr o token na URL de POST", async () => {
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
      { imageUrl: "https://anaheimhub.com/uploads/social/social-GD01-001-1.jpg", caption: "Legenda #GundamCardGame" },
      { config, fetchFn, pollDelayMs: 0 },
    );
    expect(result).toEqual({ mediaId: "222", permalink: "https://www.instagram.com/p/abc/" });
    expect(calls[0].url).toBe("https://graph.instagram.com/v26.0/17841400000000000/media");
    expect(calls[0].url).not.toContain("TOKEN");
    expect(String(calls[0].init?.body)).toContain("image_url=");
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
});
