/* Publicação no Instagram pela API oficial (Instagram API with Instagram Login, graph.instagram.com).
 *
 * Não precisa de Página do Facebook nem de App Review quando o app só publica na própria conta
 * (acesso padrão). Configuração no .env do servidor:
 *   INSTAGRAM_USER_ID       id da conta profissional (Business ou Creator) no Instagram
 *   INSTAGRAM_ACCESS_TOKEN  token de longa duração (60 dias) gerado no painel do app da Meta
 *   INSTAGRAM_API_VERSION   opcional (padrão v26.0)
 *
 * O token é renovado sozinho (a cada 7 dias) e o novo valor fica no banco, criptografado com uma chave
 * derivada de SOCIAL_TOKEN_SECRET (ou do JWT_SECRET). O token nunca vai para log nem para mensagem de erro.
 *
 * Regras da Meta que valem aqui: só JPEG para fotos e MP4 (H.264/AAC) para Reels, a mídia precisa estar
 * num endereço público na hora da publicação, legenda até 2.200 caracteres e 30 hashtags, até 100 posts pela API a cada 24 h. */
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import type { PrismaClient } from "@prisma/client";

const PROVIDER = "instagram";
const GRAPH_HOST = "https://graph.instagram.com";
const REFRESH_EVERY_MS = 7 * 24 * 3600_000;
const TOKEN_TTL_MS = 60 * 24 * 3600_000;

export const INSTAGRAM_CAPTION_MAX = 2200;
// o Instagram passou a aceitar no máximo 5 hashtags por post (anúncio de dez/2025); as excedentes saem
export const INSTAGRAM_HASHTAG_MAX = 5;
export const INSTAGRAM_ALT_TEXT_MAX = 1000;

export type InstagramConfig = { userId: string; envToken: string; version: string };

export function readInstagramConfig(env: NodeJS.ProcessEnv = process.env): InstagramConfig | null {
  const userId = (env.INSTAGRAM_USER_ID || "").trim();
  const envToken = (env.INSTAGRAM_ACCESS_TOKEN || "").trim();
  if (!/^\d{5,25}$/.test(userId) || !envToken) return null;
  const version = /^v\d{1,3}\.\d$/.test(env.INSTAGRAM_API_VERSION || "") ? String(env.INSTAGRAM_API_VERSION) : "v26.0";
  return { userId, envToken, version };
}

/* ---------- token criptografado no banco ---------- */

function tokenKey(env: NodeJS.ProcessEnv = process.env): Buffer {
  const secret = env.SOCIAL_TOKEN_SECRET || env.JWT_SECRET || "";
  if (!secret) throw new Error("Defina SOCIAL_TOKEN_SECRET (ou JWT_SECRET) para guardar o token do Instagram.");
  return Buffer.from(hkdfSync("sha256", secret, "anaheimhub-social", "instagram-token", 32));
}

export function encryptToken(token: string, env: NodeJS.ProcessEnv = process.env): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", tokenKey(env), iv);
  const enc = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), enc].map((b) => b.toString("base64url")).join(".");
}

export function decryptToken(payload: string, env: NodeJS.ProcessEnv = process.env): string {
  const [iv, tag, enc] = payload.split(".").map((p) => Buffer.from(p, "base64url"));
  if (!iv || !tag || !enc) throw new Error("Token do Instagram salvo em formato inválido.");
  const decipher = createDecipheriv("aes-256-gcm", tokenKey(env), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

type TokenRow = { tokenEnc: string; expiresAt: Date | null; refreshedAt: Date };

async function loadStoredToken(prisma: PrismaClient): Promise<TokenRow | null> {
  return prisma.socialIntegrationToken.findUnique({ where: { provider: PROVIDER } }).catch(() => null);
}

/** Token em uso: o renovado (banco) ou, na primeira vez, o do .env. */
export async function getInstagramToken(prisma: PrismaClient, config: InstagramConfig): Promise<{ token: string; expiresAt: Date | null; refreshedAt: Date | null; source: "db" | "env" }> {
  const stored = await loadStoredToken(prisma);
  if (stored) {
    try {
      return { token: decryptToken(stored.tokenEnc), expiresAt: stored.expiresAt, refreshedAt: stored.refreshedAt, source: "db" };
    } catch {
      /* chave trocada: volta para o token do .env */
    }
  }
  return { token: config.envToken, expiresAt: null, refreshedAt: null, source: "env" };
}

/* ---------- chamadas à API ---------- */

export class InstagramApiError extends Error {}

type FetchLike = typeof fetch;

/** Mensagem de erro da Graph API, sem nada que possa conter o token. */
async function graphError(res: Response, step: string): Promise<InstagramApiError> {
  const body = (await res.json().catch(() => null)) as { error?: { message?: string; code?: number } } | null;
  const msg = String(body?.error?.message || `HTTP ${res.status}`).replace(/access_token=[^&\s]+/gi, "access_token=[removido]").slice(0, 300);
  return new InstagramApiError(`Instagram (${step}): ${msg}${body?.error?.code ? ` [código ${body.error.code}]` : ""}`);
}

async function graphPost(fetchFn: FetchLike, url: string, params: Record<string, string>, step: string) {
  const res = await fetchFn(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
    redirect: "error",
  });
  if (!res.ok) throw await graphError(res, step);
  return (await res.json()) as Record<string, unknown>;
}

async function graphGet(fetchFn: FetchLike, url: string, params: Record<string, string>, step: string) {
  const res = await fetchFn(`${url}?${new URLSearchParams(params).toString()}`, { redirect: "error" });
  if (!res.ok) throw await graphError(res, step);
  return (await res.json()) as Record<string, unknown>;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export type PublishResult = { mediaId: string; permalink: string | null };

type PublishDeps = { config?: InstagramConfig | null; fetchFn?: FetchLike; pollDelayMs?: number; maxPolls?: number };
const JPEG_HTTPS = /^https:\/\/[^/]+\/.+\.jpe?g$/i;
const MP4_HTTPS = /^https:\/\/[^/]+\/.+\.mp4$/i;
export const INSTAGRAM_CAROUSEL_MAX = 10;

async function publishContext(prisma: PrismaClient, deps: PublishDeps) {
  const config = deps.config === undefined ? readInstagramConfig() : deps.config;
  if (!config) throw new InstagramApiError("Instagram não configurado (INSTAGRAM_USER_ID e INSTAGRAM_ACCESS_TOKEN).");
  const { token } = await getInstagramToken(prisma, config);
  return {
    config,
    token,
    fetchFn: deps.fetchFn ?? fetch,
    pollDelayMs: deps.pollDelayMs ?? 5000,
    maxPolls: deps.maxPolls ?? 12,
    base: `${GRAPH_HOST}/${config.version}`,
  };
}
type PublishContext = Awaited<ReturnType<typeof publishContext>>;

async function createContainer(ctx: PublishContext, params: Record<string, string>): Promise<string> {
  const container = await graphPost(ctx.fetchFn, `${ctx.base}/${ctx.config.userId}/media`, { ...params, access_token: ctx.token }, "criar contêiner");
  const containerId = String(container.id || "");
  if (!/^\d+$/.test(containerId)) throw new InstagramApiError("Instagram não devolveu o id do contêiner.");
  return containerId;
}

async function waitContainer(ctx: PublishContext, containerId: string): Promise<void> {
  for (let i = 0; i < ctx.maxPolls; i += 1) {
    const status = await graphGet(ctx.fetchFn, `${ctx.base}/${containerId}`, { fields: "status_code", access_token: ctx.token }, "status do contêiner");
    const code = String(status.status_code || "");
    if (code === "FINISHED") return;
    if (code === "ERROR" || code === "EXPIRED") throw new InstagramApiError(`Instagram recusou a mídia (status ${code}).`);
    if (i === ctx.maxPolls - 1) throw new InstagramApiError("Instagram não terminou de processar a mídia a tempo; tente publicar de novo.");
    await sleep(ctx.pollDelayMs);
  }
}

async function publishContainer(ctx: PublishContext, containerId: string): Promise<PublishResult> {
  const published = await graphPost(ctx.fetchFn, `${ctx.base}/${ctx.config.userId}/media_publish`, { creation_id: containerId, access_token: ctx.token }, "publicar");
  const mediaId = String(published.id || "");
  if (!/^\d+$/.test(mediaId)) throw new InstagramApiError("Instagram não devolveu o id do post publicado.");

  let permalink: string | null = null;
  try {
    const info = await graphGet(ctx.fetchFn, `${ctx.base}/${mediaId}`, { fields: "permalink", access_token: ctx.token }, "link do post");
    permalink = typeof info.permalink === "string" && info.permalink.startsWith("https://") ? info.permalink : null;
  } catch {
    /* o post já saiu; o link é só conveniência */
  }
  return { mediaId, permalink };
}

/** Publica uma imagem (JPEG em endereço público) com legenda e texto alternativo opcional (SEO/acessibilidade). */
export async function publishInstagramImage(
  prisma: PrismaClient,
  input: { imageUrl: string; caption: string; altText?: string },
  deps: PublishDeps = {},
): Promise<PublishResult> {
  if (!JPEG_HTTPS.test(input.imageUrl)) throw new InstagramApiError("A imagem precisa ser um JPEG em endereço https público.");
  const ctx = await publishContext(prisma, deps);
  const altText = normalizeInstagramAltText(input.altText);
  const containerId = await createContainer(ctx, {
    image_url: input.imageUrl,
    caption: normalizeInstagramCaption(input.caption),
    ...(altText ? { alt_text: altText } : {}),
  });
  await waitContainer(ctx, containerId);
  return publishContainer(ctx, containerId);
}

/**
 * Publica um carrossel (2 a 10 JPEGs na mesma proporção). Um contêiner por imagem, criado e processado em sequência
 * (o pai criado antes de os filhos terminarem dá invalid_children); depois o contêiner CAROUSEL com a legenda.
 */
export async function publishInstagramCarousel(
  prisma: PrismaClient,
  input: { imageUrls: string[]; caption: string; altTexts?: string[] },
  deps: PublishDeps = {},
): Promise<PublishResult> {
  if (input.imageUrls.length < 2 || input.imageUrls.length > INSTAGRAM_CAROUSEL_MAX) throw new InstagramApiError("O carrossel precisa ter de 2 a 10 imagens.");
  if (!input.imageUrls.every((url) => JPEG_HTTPS.test(url))) throw new InstagramApiError("Todas as imagens do carrossel precisam ser JPEG em endereço https público.");
  const ctx = await publishContext(prisma, deps);
  const children: string[] = [];
  for (let i = 0; i < input.imageUrls.length; i += 1) {
    const imageUrl = input.imageUrls[i];
    const altText = normalizeInstagramAltText(input.altTexts?.[i]);
    const childId = await createContainer(ctx, {
      image_url: imageUrl,
      is_carousel_item: "true",
      ...(altText ? { alt_text: altText } : {}),
    });
    await waitContainer(ctx, childId);
    children.push(childId);
  }
  const parentId = await createContainer(ctx, { media_type: "CAROUSEL", children: children.join(","), caption: normalizeInstagramCaption(input.caption) });
  await waitContainer(ctx, parentId);
  return publishContainer(ctx, parentId);
}

/**
 * Publica um Reel (MP4 H.264/AAC em endereço https público) com legenda e capa opcional.
 * O processamento de vídeo na Meta pode levar mais ciclos de verificação que uma imagem estática.
 */
export async function publishInstagramReel(
  prisma: PrismaClient,
  input: { videoUrl: string; caption: string; coverUrl?: string | null; shareToFeed?: boolean },
  deps: PublishDeps = {},
): Promise<PublishResult> {
  if (!MP4_HTTPS.test(input.videoUrl)) throw new InstagramApiError("O vídeo do Reel precisa ser um MP4 em endereço https público.");
  if (input.coverUrl && !JPEG_HTTPS.test(input.coverUrl)) throw new InstagramApiError("A capa do Reel precisa ser um JPEG em endereço https público.");
  const ctx = await publishContext(prisma, { ...deps, maxPolls: deps.maxPolls ?? 24 });
  const containerId = await createContainer(ctx, {
    media_type: "REELS",
    video_url: input.videoUrl,
    caption: normalizeInstagramCaption(input.caption),
    share_to_feed: input.shareToFeed === false ? "false" : "true",
    ...(input.coverUrl ? { cover_url: input.coverUrl } : {}),
  });
  await waitContainer(ctx, containerId);
  return publishContainer(ctx, containerId);
}

/**
 * Publica um Story (vídeo MP4 H.264/AAC ou imagem JPEG 9:16 em endereço https público).
 * Stories ficam no topo do perfil por 24h e não recebem legenda textual na Graph API.
 */
export async function publishInstagramStory(
  prisma: PrismaClient,
  input: { videoUrl?: string | null; imageUrl?: string | null },
  deps: PublishDeps = {},
): Promise<PublishResult> {
  const videoUrl = input.videoUrl?.trim() || "";
  const imageUrl = input.imageUrl?.trim() || "";
  if (!videoUrl && !imageUrl) throw new InstagramApiError("O Story precisa de um vídeo MP4 ou imagem JPEG em endereço https público.");
  if (videoUrl && !MP4_HTTPS.test(videoUrl)) throw new InstagramApiError("O vídeo do Story precisa ser um MP4 em endereço https público.");
  if (!videoUrl && !JPEG_HTTPS.test(imageUrl)) throw new InstagramApiError("A imagem do Story precisa ser um JPEG em endereço https público.");
  const ctx = await publishContext(prisma, { ...deps, maxPolls: deps.maxPolls ?? (videoUrl ? 24 : 12) });
  const containerId = await createContainer(ctx, {
    media_type: "STORIES",
    ...(videoUrl ? { video_url: videoUrl } : { image_url: imageUrl }),
  });
  await waitContainer(ctx, containerId);
  return publishContainer(ctx, containerId);
}

/** Renova o token de longa duração (vale mais 60 dias) quando a última renovação tem mais de 7 dias. */
export async function refreshInstagramTokenIfNeeded(
  prisma: PrismaClient,
  deps: { config?: InstagramConfig | null; fetchFn?: FetchLike; now?: Date } = {},
): Promise<"refreshed" | "fresh" | "not-configured"> {
  const config = deps.config === undefined ? readInstagramConfig() : deps.config;
  if (!config) return "not-configured";
  const now = deps.now ?? new Date();
  const current = await getInstagramToken(prisma, config);
  if (current.refreshedAt && now.getTime() - current.refreshedAt.getTime() < REFRESH_EVERY_MS) return "fresh";
  const data = await graphGet(deps.fetchFn ?? fetch, `${GRAPH_HOST}/refresh_access_token`, { grant_type: "ig_refresh_token", access_token: current.token }, "renovar token");
  const token = String(data.access_token || "");
  if (!token) throw new InstagramApiError("Instagram não devolveu o token renovado.");
  const expiresIn = Number(data.expires_in);
  const expiresAt = new Date(now.getTime() + (Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn * 1000 : TOKEN_TTL_MS));
  const tokenEnc = encryptToken(token);
  await prisma.socialIntegrationToken.upsert({
    where: { provider: PROVIDER },
    create: { provider: PROVIDER, tokenEnc, expiresAt, refreshedAt: now },
    update: { tokenEnc, expiresAt, refreshedAt: now },
  });
  return "refreshed";
}

/* ---------- legenda & alt_text ---------- */

/** Garante os limites do Instagram: no máximo `INSTAGRAM_HASHTAG_MAX` hashtags (as excedentes saem) e 2.200 caracteres. */
export function normalizeInstagramCaption(caption: string): string {
  let count = 0;
  let text = caption.replace(/\r\n/g, "\n").replace(/(^|\s)#([\p{L}\p{N}_]+)/gu, (match, lead: string) => {
    count += 1;
    return count <= INSTAGRAM_HASHTAG_MAX ? match : lead;
  });
  text = text.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (text.length > INSTAGRAM_CAPTION_MAX) text = `${text.slice(0, INSTAGRAM_CAPTION_MAX - 1).trimEnd()}…`;
  return text;
}

export function countHashtags(caption: string): number {
  return (caption.match(/(^|\s)#[\p{L}\p{N}_]+/gu) || []).length;
}

/** Normaliza o texto alternativo (alt_text) da imagem para SEO e acessibilidade no Instagram (até 1.000 caracteres). */
export function normalizeInstagramAltText(altText: string | null | undefined): string {
  const clean = String(altText ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return "";
  return clean.length > INSTAGRAM_ALT_TEXT_MAX ? `${clean.slice(0, INSTAGRAM_ALT_TEXT_MAX - 1).trimEnd()}…` : clean;
}
