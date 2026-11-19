/* Conectar o Discord na conta do site (OAuth2, escopo "identify": só o ID e o nome, nada de servidores ou e-mail).
 *
 *  POST   /api/me/discord/link      → endereço de autorização do Discord (o "state" é um JWT de 10 min com a conta)
 *  GET    /api/auth/discord/callback → troca o código, grava a conta do Discord e dá os cargos; volta para /profile
 *  DELETE /api/me/discord            → tira os cargos administrados e desconecta
 *
 * Precisa de DISCORD_APP_ID e DISCORD_CLIENT_SECRET; o endereço de volta
 * (https://anaheimhub.com/api/auth/discord/callback) tem que estar em OAuth2 → Redirects no portal do Discord. */
import { randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";
import type { Express, Request, RequestHandler, Response } from "express";
import type { PrismaClient } from "@prisma/client";
import { discordPublicUrl, sharedDiscordGuild } from "../services/discordGuild.ts";
import { describeRoleError, syncMemberRoles, syncUserDiscordRoles } from "../services/discordRoles.ts";

const DISCORD_API = "https://discord.com/api/v10";
const STATE_PURPOSE = "discord-link";
const SNOWFLAKE = /^\d{5,25}$/;

export type DiscordOAuthConfig = { clientId: string; clientSecret: string; redirectUri: string };

export function readDiscordOAuthConfig(env: NodeJS.ProcessEnv = process.env): DiscordOAuthConfig | null {
  const clientId = (env.DISCORD_APP_ID || "").trim();
  const clientSecret = (env.DISCORD_CLIENT_SECRET || "").trim();
  if (!SNOWFLAKE.test(clientId) || !clientSecret) return null;
  return { clientId, clientSecret, redirectUri: `${discordPublicUrl(env)}/api/auth/discord/callback` };
}

export function discordAuthorizeUrl(config: DiscordOAuthConfig, state: string): string {
  const params = new URLSearchParams({ client_id: config.clientId, response_type: "code", redirect_uri: config.redirectUri, scope: "identify", state, prompt: "consent" });
  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

export function signLinkState(jwtSecret: string, userId: string): string {
  return jwt.sign({ purpose: STATE_PURPOSE, userId, n: randomBytes(8).toString("hex") }, jwtSecret, { expiresIn: "10m" });
}

export function verifyLinkState(jwtSecret: string, state: string): string | null {
  try {
    const payload = jwt.verify(state, jwtSecret);
    if (typeof payload === "string" || payload.purpose !== STATE_PURPOSE || typeof payload.userId !== "string") return null;
    return payload.userId;
  } catch {
    return null;
  }
}

type FetchFn = typeof fetch;

/** Código do OAuth → conta do Discord (id + nome de exibição). */
export async function fetchDiscordIdentity(config: DiscordOAuthConfig, code: string, fetchFn: FetchFn = fetch): Promise<{ id: string; username: string }> {
  const tokenRes = await fetchFn(`${DISCORD_API}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, grant_type: "authorization_code", code, redirect_uri: config.redirectUri }).toString(),
  });
  if (!tokenRes.ok) throw new Error(`troca do código recusada (${tokenRes.status})`);
  const token = (await tokenRes.json()) as { access_token?: string; token_type?: string };
  if (!token.access_token) throw new Error("o Discord não devolveu o token");
  const meRes = await fetchFn(`${DISCORD_API}/users/@me`, { headers: { Authorization: `Bearer ${token.access_token}` } });
  if (!meRes.ok) throw new Error(`conta do Discord não lida (${meRes.status})`);
  const me = (await meRes.json()) as { id?: string; username?: string; global_name?: string | null };
  if (!me.id || !SNOWFLAKE.test(me.id)) throw new Error("conta do Discord sem ID");
  return { id: me.id, username: (me.global_name || me.username || "").slice(0, 64) || me.id };
}

type Deps = {
  prisma: PrismaClient;
  authRequired: RequestHandler;
  jwtSecret: string;
  invalidateSession: (userId: string) => void;
  currentUserId: (req: Request) => string | undefined;
  fetchFn?: FetchFn;
  env?: NodeJS.ProcessEnv;
};

/** Resultado que o perfil mostra (?discord=…): conectado, ocupado (outra conta do site), cancelado, erro. */
const backToProfile = (res: Response, env: NodeJS.ProcessEnv, status: "conectado" | "ocupado" | "cancelado" | "erro" | "expirado") =>
  res.redirect(302, `${discordPublicUrl(env)}/profile?discord=${status}`);

export function registerDiscordLinkRoutes(app: Express, deps: Deps) {
  const { prisma, authRequired, jwtSecret, invalidateSession, currentUserId } = deps;
  const env = () => deps.env ?? process.env;

  app.post("/api/me/discord/link", authRequired, (req: Request, res: Response) => {
    const userId = currentUserId(req);
    if (!userId) return res.status(401).json({ error: "Faça login para conectar o Discord." });
    const config = readDiscordOAuthConfig(env());
    if (!config) return res.status(503).json({ error: "Conexão com o Discord ainda não configurada." });
    res.setHeader("Cache-Control", "no-store");
    res.json({ url: discordAuthorizeUrl(config, signLinkState(jwtSecret, userId)) });
  });

  app.get("/api/auth/discord/callback", async (req: Request, res: Response) => {
    res.setHeader("Cache-Control", "no-store");
    const config = readDiscordOAuthConfig(env());
    if (!config) return backToProfile(res, env(), "erro");
    if (typeof req.query.error === "string") return backToProfile(res, env(), "cancelado");
    const userId = typeof req.query.state === "string" ? verifyLinkState(jwtSecret, req.query.state) : null;
    if (!userId) return backToProfile(res, env(), "expirado");
    const code = typeof req.query.code === "string" ? req.query.code.slice(0, 200) : "";
    if (!code) return backToProfile(res, env(), "erro");

    let identity: { id: string; username: string };
    try {
      identity = await fetchDiscordIdentity(config, code, deps.fetchFn);
    } catch (err) {
      console.warn("[discord] conexão da conta falhou:", err instanceof Error ? err.message : err);
      return backToProfile(res, env(), "erro");
    }

    const owner = await prisma.user.findUnique({ where: { discordId: identity.id }, select: { id: true } });
    if (owner && owner.id !== userId) return backToProfile(res, env(), "ocupado");
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, isActive: true, discordId: true } });
    if (!user?.isActive) return backToProfile(res, env(), "erro");

    // trocou de conta do Discord: a antiga perde os cargos antes
    const guild = sharedDiscordGuild(env());
    if (guild && user.discordId && user.discordId !== identity.id) {
      await syncMemberRoles(guild, user.discordId, null).catch((err) => console.warn("[discord] cargos da conta antiga não retirados:", describeRoleError(err)));
    }
    await prisma.user.update({ where: { id: userId }, data: { discordId: identity.id, discordUsername: identity.username, discordLinkedAt: new Date() } });
    invalidateSession(userId);
    await syncUserDiscordRoles(prisma, userId, guild).catch((err) => console.warn("[discord] cargos não dados ao conectar:", describeRoleError(err)));
    return backToProfile(res, env(), "conectado");
  });

  app.delete("/api/me/discord", authRequired, async (req: Request, res: Response) => {
    const userId = currentUserId(req);
    if (!userId) return res.status(401).json({ error: "Faça login." });
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { discordId: true } });
    const guild = sharedDiscordGuild(env());
    if (guild && user?.discordId) {
      await syncMemberRoles(guild, user.discordId, null).catch((err) => console.warn("[discord] cargos não retirados ao desconectar:", describeRoleError(err)));
    }
    await prisma.user.update({ where: { id: userId }, data: { discordId: null, discordUsername: null, discordLinkedAt: null } });
    invalidateSession(userId);
    res.json({ ok: true });
  });
}
