/* eslint-disable @typescript-eslint/no-explicit-any -- banco em memória: linhas soltas, como o Prisma devolve */
import express, { type NextFunction, type Request, type Response } from "express";
import type { AddressInfo } from "node:net";
import { describe, expect, it, vi } from "vitest";
import { discordAuthorizeUrl, readDiscordOAuthConfig, registerDiscordLinkRoutes, signLinkState, verifyLinkState } from "./discordLinkRoutes.ts";

const SECRET = "segredo-de-teste";
// sem DISCORD_BOT_TOKEN: não há servidor para dar cargos, só a conexão da conta
const env = { DISCORD_APP_ID: "1563411550826401875", DISCORD_CLIENT_SECRET: "oauth-secret", PUBLIC_APP_URL: "https://anaheimhub.com" };

describe("estado e endereço do OAuth", () => {
  it("state assinado volta a conta; adulterado ou de outro propósito não", () => {
    const state = signLinkState(SECRET, "u1");
    expect(verifyLinkState(SECRET, state)).toBe("u1");
    expect(verifyLinkState("outro-segredo", state)).toBeNull();
    expect(verifyLinkState(SECRET, `${state}x`)).toBeNull();
  });

  it("pede só o escopo identify e volta para o callback do domínio público", () => {
    const config = readDiscordOAuthConfig(env)!;
    const url = new URL(discordAuthorizeUrl(config, "st"));
    expect(url.origin + url.pathname).toBe("https://discord.com/oauth2/authorize");
    expect(url.searchParams.get("scope")).toBe("identify");
    expect(url.searchParams.get("redirect_uri")).toBe("https://anaheimhub.com/api/auth/discord/callback");
    expect(readDiscordOAuthConfig({ DISCORD_APP_ID: "1563411550826401875" })).toBeNull();
  });
});

function setup(users: any[]) {
  const db = { users };
  const prisma: any = {
    user: {
      findUnique: async ({ where }: any) => db.users.find((u) => (where.id ? u.id === where.id : u.discordId === where.discordId)) ?? null,
      update: async ({ where, data }: any) => Object.assign(db.users.find((u) => u.id === where.id), data),
    },
  };
  const fetchFn = vi.fn(async (url: string) => {
    if (url.endsWith("/oauth2/token")) return new Response(JSON.stringify({ access_token: "at", token_type: "Bearer" }), { status: 200 });
    if (url.endsWith("/users/@me")) return new Response(JSON.stringify({ id: "424242424242", username: "amuro", global_name: "Amuro Ray" }), { status: 200 });
    return new Response("{}", { status: 404 });
  });
  const app = express();
  const authRequired = (req: Request, res: Response, next: NextFunction) => {
    const id = req.get("x-user");
    if (!id) return res.status(401).json({ error: "Token ausente." });
    (req as any).user = { userId: id };
    next();
  };
  const invalidateSession = vi.fn();
  registerDiscordLinkRoutes(app, { prisma, authRequired, jwtSecret: SECRET, invalidateSession, currentUserId: (req) => (req as any).user?.userId, fetchFn: fetchFn as unknown as typeof fetch, env });
  const server = app.listen(0);
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { db, base, server, fetchFn, invalidateSession };
}

describe("rotas", () => {
  it("POST /api/me/discord/link exige login e devolve o endereço do Discord", async () => {
    const { base, server } = setup([{ id: "u1", isActive: true, discordId: null }]);
    try {
      expect((await fetch(`${base}/api/me/discord/link`, { method: "POST" })).status).toBe(401);
      const body = (await (await fetch(`${base}/api/me/discord/link`, { method: "POST", headers: { "x-user": "u1" } })).json()) as { url: string };
      const state = new URL(body.url).searchParams.get("state")!;
      expect(verifyLinkState(SECRET, state)).toBe("u1");
    } finally {
      server.close();
    }
  });

  it("callback grava a conta do Discord e volta para o perfil", async () => {
    const { base, server, db, invalidateSession } = setup([{ id: "u1", isActive: true, discordId: null }]);
    try {
      const res = await fetch(`${base}/api/auth/discord/callback?code=abc&state=${signLinkState(SECRET, "u1")}`, { redirect: "manual" });
      expect(res.status).toBe(302);
      expect(res.headers.get("location")).toBe("https://anaheimhub.com/profile?discord=conectado");
      expect(db.users[0]).toMatchObject({ discordId: "424242424242", discordUsername: "Amuro Ray" });
      expect(invalidateSession).toHaveBeenCalledWith("u1");
    } finally {
      server.close();
    }
  });

  it("Discord de outra conta do site → ocupado, sem gravar", async () => {
    const { base, server, db } = setup([
      { id: "u1", isActive: true, discordId: null },
      { id: "u2", isActive: true, discordId: "424242424242" },
    ]);
    try {
      const res = await fetch(`${base}/api/auth/discord/callback?code=abc&state=${signLinkState(SECRET, "u1")}`, { redirect: "manual" });
      expect(res.headers.get("location")).toContain("discord=ocupado");
      expect(db.users[0].discordId).toBeNull();
    } finally {
      server.close();
    }
  });

  it("state inválido ou cancelado no Discord não chama a API do Discord", async () => {
    const { base, server, fetchFn } = setup([{ id: "u1", isActive: true, discordId: null }]);
    try {
      const a = await fetch(`${base}/api/auth/discord/callback?code=abc&state=forjado`, { redirect: "manual" });
      expect(a.headers.get("location")).toContain("discord=expirado");
      const b = await fetch(`${base}/api/auth/discord/callback?error=access_denied`, { redirect: "manual" });
      expect(b.headers.get("location")).toContain("discord=cancelado");
      expect(fetchFn).not.toHaveBeenCalled();
    } finally {
      server.close();
    }
  });

  it("DELETE /api/me/discord desconecta", async () => {
    const { base, server, db } = setup([{ id: "u1", isActive: true, discordId: "424242424242", discordUsername: "Amuro" }]);
    try {
      expect((await fetch(`${base}/api/me/discord`, { method: "DELETE", headers: { "x-user": "u1" } })).status).toBe(200);
      expect(db.users[0]).toMatchObject({ discordId: null, discordUsername: null });
    } finally {
      server.close();
    }
  });
});
