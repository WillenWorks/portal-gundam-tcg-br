import { generateKeyPairSync, sign } from "node:crypto";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import express from "express";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { registerDiscordInteractionRoute } from "./discordInteractionRoute";

const { publicKey, privateKey } = generateKeyPairSync("ed25519");
let server: Server;
let base = "";

beforeAll(async () => {
  vi.stubEnv("DISCORD_APP_ID", "1563411550826401875");
  vi.stubEnv("DISCORD_APP_PUBLIC_KEY", publicKey.export({ format: "der", type: "spki" }).subarray(-32).toString("hex"));
  vi.stubEnv("DISCORD_BOT_TOKEN", "tok");
  vi.stubEnv("DISCORD_CHANNEL_ID", "1563339185967075389");
  vi.stubEnv("DISCORD_APPROVER_IDS", "106821025269813248");
  const app = express();
  // mesma ordem do server/index.ts: a rota do Discord antes do json global
  registerDiscordInteractionRoute(app, {} as never);
  app.use(express.json());
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  vi.unstubAllEnvs();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe("rota /api/discord/interactions no Express", () => {
  it("o corpo chega cru (não passa pelo express.json): PING assinado → PONG", async () => {
    const body = JSON.stringify({ type: 1 });
    const ts = String(Math.floor(Date.now() / 1000));
    const res = await fetch(`${base}/api/discord/interactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Signature-Ed25519": sign(null, Buffer.from(ts + body), privateKey).toString("hex"), "X-Signature-Timestamp": ts },
      body,
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ type: 1 });
  });

  it("sem assinatura → 401 (é o teste que o Discord faz ao salvar a URL)", async () => {
    const res = await fetch(`${base}/api/discord/interactions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: '{"type":1}' });
    expect(res.status).toBe(401);
  });
});
