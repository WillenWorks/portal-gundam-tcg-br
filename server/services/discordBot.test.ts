import { generateKeyPairSync, sign } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  editInteractionMessage,
  parseSocialCustomId,
  postBotMessage,
  readDiscordBotConfig,
  socialButtons,
  verifyDiscordSignature,
} from "./discordBot";

// par de chaves Ed25519 de teste; a chave pública vai em hex, como o Developer Portal mostra
const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const publicKeyHex = publicKey.export({ format: "der", type: "spki" }).subarray(-32).toString("hex");
const signBody = (timestamp: string, body: string) => sign(null, Buffer.from(timestamp + body), privateKey).toString("hex");

const env = {
  DISCORD_APP_ID: "1563411550826401875",
  DISCORD_APP_PUBLIC_KEY: publicKeyHex,
  DISCORD_BOT_TOKEN: "token-do-bot",
  DISCORD_CHANNEL_ID: "1563339185967075389",
  DISCORD_APPROVER_IDS: "106821025269813248, 222222222222222222, lixo",
};

describe("readDiscordBotConfig", () => {
  it("lê as cinco variáveis e a lista de aprovadores", () => {
    const config = readDiscordBotConfig(env);
    expect(config?.channelId).toBe("1563339185967075389");
    expect([...(config?.approverIds ?? [])]).toEqual(["106821025269813248", "222222222222222222"]);
  });

  it("faltando qualquer uma (ou chave pública fora do formato), não há bot", () => {
    expect(readDiscordBotConfig({ ...env, DISCORD_BOT_TOKEN: "" })).toBeNull();
    expect(readDiscordBotConfig({ ...env, DISCORD_APPROVER_IDS: " , " })).toBeNull();
    expect(readDiscordBotConfig({ ...env, DISCORD_APP_PUBLIC_KEY: "xyz" })).toBeNull();
  });
});

describe("verifyDiscordSignature", () => {
  const now = new Date("2026-10-24T12:00:00Z");
  const ts = String(Math.floor(now.getTime() / 1000));
  const body = JSON.stringify({ type: 1 });

  it("aceita a assinatura do Discord sobre timestamp + corpo cru", () => {
    expect(verifyDiscordSignature(publicKeyHex, signBody(ts, body), ts, Buffer.from(body), now)).toBe(true);
  });

  it("recusa corpo alterado, assinatura de outra chave, cabeçalhos vazios e timestamp velho (replay)", () => {
    const other = generateKeyPairSync("ed25519").privateKey;
    expect(verifyDiscordSignature(publicKeyHex, signBody(ts, body), ts, Buffer.from('{"type":3}'), now)).toBe(false);
    expect(verifyDiscordSignature(publicKeyHex, sign(null, Buffer.from(ts + body), other).toString("hex"), ts, Buffer.from(body), now)).toBe(false);
    expect(verifyDiscordSignature(publicKeyHex, "", ts, Buffer.from(body), now)).toBe(false);
    expect(verifyDiscordSignature(publicKeyHex, "zz", ts, Buffer.from(body), now)).toBe(false);
    const old = String(Math.floor(now.getTime() / 1000) - 600);
    expect(verifyDiscordSignature(publicKeyHex, signBody(old, body), old, Buffer.from(body), now)).toBe(false);
  });
});

describe("botões do post", () => {
  it("custom_id leva a ação e o id do post, e volta igual", () => {
    const [row] = socialButtons("clx123");
    const ids = row.components.map((button) => button.custom_id);
    expect(ids).toEqual(["social:approve:clx123", "social:reject:clx123"]);
    expect(parseSocialCustomId("social:approve:clx123")).toEqual({ action: "approve", postId: "clx123" });
    expect(parseSocialCustomId("social:reject:clx123")).toEqual({ action: "reject", postId: "clx123" });
  });

  it("custom_id de outra coisa (ou malformado) é ignorado", () => {
    expect(parseSocialCustomId("social:delete:clx123")).toBeNull();
    expect(parseSocialCustomId("outro:approve:clx123")).toBeNull();
    expect(parseSocialCustomId("social:approve:")).toBeNull();
    expect(parseSocialCustomId("social:approve:../x")).toBeNull();
  });
});

describe("chamadas à API do Discord", () => {
  const config = readDiscordBotConfig(env)!;

  it("postBotMessage envia ao canal com o token do bot", async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    expect(await postBotMessage(config, { content: "oi" }, fetchFn)).toBe(true);
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe("https://discord.com/api/v10/channels/1563339185967075389/messages");
    expect(init.headers.Authorization).toBe("Bot token-do-bot");
  });

  it("postBotMessage devolve false quando o Discord recusa (sem permissão no canal)", async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: false, status: 403 });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await postBotMessage(config, { content: "oi" }, fetchFn)).toBe(false);
    warn.mockRestore();
  });

  it("editInteractionMessage edita a mensagem do clique pelo token da interação", async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    await editInteractionMessage(config, "tok-interacao", { components: [] }, fetchFn);
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe("https://discord.com/api/v10/webhooks/1563411550826401875/tok-interacao/messages/@original");
    expect(init.method).toBe("PATCH");
  });
});
