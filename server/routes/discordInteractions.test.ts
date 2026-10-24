import { generateKeyPairSync, sign } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { createDiscordInteractionHandler } from "./discordInteractions";

const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const config = {
  appId: "1563411550826401875",
  publicKey: publicKey.export({ format: "der", type: "spki" }).subarray(-32).toString("hex"),
  botToken: "tok",
  channelId: "1563339185967075389",
  approverIds: new Set(["106821025269813248"]),
};
const now = new Date("2026-10-24T12:00:00Z");
const ts = String(Math.floor(now.getTime() / 1000));
const post = { id: "p1", title: "Carta do dia", caption: "Legenda", imageUrl: "/uploads/social/a.jpg", type: "CARD_SPOTLIGHT", scheduledFor: null };

function signedRequest(body: object, opts: { tamper?: boolean } = {}) {
  const raw = JSON.stringify(body);
  const signature = sign(null, Buffer.from(ts + raw), privateKey).toString("hex");
  const headers: Record<string, string> = { "x-signature-ed25519": signature, "x-signature-timestamp": ts };
  return { body: Buffer.from(opts.tamper ? raw.replace("p1", "p2") : raw), get: (name: string) => headers[name.toLowerCase()] };
}

function fakeRes() {
  const res = { statusCode: 200, payload: undefined as unknown, status: vi.fn(), json: vi.fn() };
  res.status.mockImplementation((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json.mockImplementation((payload: unknown) => {
    res.payload = payload;
    return res;
  });
  return res;
}

const click = (customId: string, userId = "106821025269813248") => ({
  type: 3,
  token: "tok-interacao",
  data: { custom_id: customId, component_type: 2 },
  member: { user: { id: userId, username: "willen" } },
});

function setup(overrides: Partial<Parameters<typeof createDiscordInteractionHandler>[0]> = {}) {
  const editMessage = vi.fn(async (..._args: unknown[]) => {});
  const deps = {
    config: () => config,
    approve: vi.fn(async () => ({ ok: true, post: { ...post, status: "PUBLISHED", instagramPermalink: "https://www.instagram.com/p/x/" } })),
    reject: vi.fn(async () => ({ ...post, status: "REJECTED" })),
    publicUrl: () => "https://anaheimhub.com",
    editMessage,
    now: () => now,
    ...overrides,
  };
  return { deps, editMessage, handler: createDiscordInteractionHandler(deps) };
}

describe("POST /api/discord/interactions", () => {
  it("responde o PING de verificação do Discord", async () => {
    const { handler } = setup();
    const res = fakeRes();
    await handler(signedRequest({ type: 1 }) as any, res as any);
    expect(res.payload).toEqual({ type: 1 });
  });

  it("assinatura que não confere (corpo alterado) → 401 e nada executa", async () => {
    const { handler, deps } = setup();
    const res = fakeRes();
    await handler(signedRequest(click("social:approve:p1"), { tamper: true }) as any, res as any);
    expect(res.statusCode).toBe(401);
    expect(deps.approve).not.toHaveBeenCalled();
  });

  it("sem bot configurado, o endpoint não existe (404)", async () => {
    const { handler } = setup({ config: () => null });
    const res = fakeRes();
    await handler(signedRequest({ type: 1 }) as any, res as any);
    expect(res.statusCode).toBe(404);
  });

  it("Aprovar de quem pode: responde na hora (type 6) e depois troca a mensagem pelo resultado, sem botões", async () => {
    const { handler, deps, editMessage } = setup();
    const res = fakeRes();
    await handler(signedRequest(click("social:approve:p1")) as any, res as any);
    expect(res.payload).toEqual({ type: 6 });
    expect(deps.approve).toHaveBeenCalledWith("p1");
    const [, token, payload] = editMessage.mock.calls[0] as unknown as [unknown, string, { content: string; components: unknown[]; embeds: Array<{ fields: Array<{ value: string }> }> }];
    expect(token).toBe("tok-interacao");
    expect(payload.components).toEqual([]);
    expect(payload.content).toContain("publicado");
    expect(payload.embeds[0].fields[0].value).toContain("Publicado");
  });

  it("Descartar registra quem descartou", async () => {
    const { handler, deps, editMessage } = setup();
    await handler(signedRequest(click("social:reject:p1")) as any, fakeRes() as any);
    expect(deps.reject).toHaveBeenCalledWith("p1", "Descartado pelo Discord por willen");
    const payload = (editMessage.mock.calls[0] as unknown as [unknown, string, { content: string }])[2];
    expect(payload.content).toContain("descartado");
  });

  it("quem não está na lista de aprovadores recebe aviso só para si e o post não muda", async () => {
    const { handler, deps } = setup();
    const res = fakeRes();
    await handler(signedRequest(click("social:approve:p1", "999999999999999999")) as any, res as any);
    expect(res.payload).toEqual({ type: 4, data: { content: "Você não pode aprovar posts.", flags: 64 } });
    expect(deps.approve).not.toHaveBeenCalled();
  });

  it("botão desconhecido → aviso só para quem clicou", async () => {
    const { handler, deps } = setup();
    const res = fakeRes();
    await handler(signedRequest(click("social:delete:p1")) as any, res as any);
    expect((res.payload as { type: number }).type).toBe(4);
    expect(deps.approve).not.toHaveBeenCalled();
  });

  it("aprovação recusada (ex.: já publicado) vira aviso na mensagem e os botões somem", async () => {
    const approve = vi.fn(async () => {
      throw Object.assign(new Error("Este post já foi publicado."), { status: 409 });
    });
    const { handler, editMessage } = setup({ approve });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await handler(signedRequest(click("social:approve:p1")) as any, fakeRes() as any);
    warn.mockRestore();
    const payload = (editMessage.mock.calls[0] as unknown as [unknown, string, { content: string; components: unknown[] }])[2];
    expect(payload.content).toContain("Este post já foi publicado.");
    expect(payload.components).toEqual([]);
  });
});
