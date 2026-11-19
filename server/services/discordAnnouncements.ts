/* Anúncios automáticos no Discord público: spoiler aprovado → #spoilers; artigo publicado → #anúncios; torneio
 * marcado ou encerrado → #torneios. Cada anúncio tem uma chave em DiscordAnnouncement: republicar um artigo, reiniciar a
 * API ou clicar duas vezes não posta de novo. Falha no Discord nunca derruba a ação no site (fire-and-forget).
 * Desliga com DISCORD_ANNOUNCE_ENABLED="false". */
import type { PrismaClient } from "@prisma/client";
import { absoluteHttpsUrl, discordPublicUrl, sharedDiscordGuild, type DiscordChannelKind, type DiscordGuild } from "./discordGuild.ts";

const BRAND_COLOR = 0x22d3ee;
const SPOILER_COLOR = 0xf43f5e;
const TOURNAMENT_COLOR = 0xf59e0b;
/** o Discord junta até 4 embeds com o mesmo `url` numa galeria */
const GALLERY_MAX = 4;

export type DiscordMessage = { content?: string; embeds: Record<string, unknown>[] };

const cut = (text: string | null | undefined, max: number) => {
  const value = (text || "").replace(/\s+/g, " ").trim();
  return value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value;
};

export function articleMessage(input: { title: string; excerpt?: string | null; url: string; image?: string }): DiscordMessage {
  return {
    content: "📰 **Matéria nova no Anaheim Hub**",
    embeds: [{ title: cut(input.title, 250), url: input.url, description: cut(input.excerpt, 400) || undefined, color: BRAND_COLOR, ...(input.image ? { image: { url: input.image } } : {}), footer: { text: "anaheimhub.com" } }],
  };
}

export function spoilerMessage(input: { title: string; excerpt?: string | null; url: string; images: string[]; updated?: boolean }): DiscordMessage {
  const [first, ...rest] = input.images.slice(0, GALLERY_MAX);
  return {
    content: input.updated ? "🔄 **Spoiler atualizado** (versão em inglês)" : "🃏 **Spoiler do dia**",
    embeds: [
      { title: cut(input.title, 250), url: input.url, description: cut(input.excerpt, 400) || undefined, color: SPOILER_COLOR, ...(first ? { image: { url: first } } : {}), footer: { text: "Tradução e análise completas no site" } },
      ...rest.map((image) => ({ url: input.url, image: { url: image } })),
    ],
  };
}

const dateBr = (date: Date) => date.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

export function eventScheduledMessage(input: { name: string; dateStart: Date; venue?: string | null; city?: string | null; format?: string | null; maxPlayers?: number | null; description?: string | null; url: string }): DiscordMessage {
  const fields = [
    { name: "Quando", value: dateBr(input.dateStart), inline: true },
    input.venue || input.city ? { name: "Onde", value: cut([input.venue, input.city].filter(Boolean).join(" · "), 200), inline: true } : null,
    input.maxPlayers ? { name: "Vagas", value: String(input.maxPlayers), inline: true } : null,
  ].filter(Boolean);
  return {
    content: "📅 **Torneio marcado**",
    embeds: [{ title: cut(input.name, 250), url: input.url, description: cut(input.description, 400) || undefined, color: TOURNAMENT_COLOR, fields, footer: { text: "Inscrição e check-in pelo anaheimhub.com" } }],
  };
}

export function eventResultsMessage(input: { name: string; city?: string | null; url: string; top: { rank: number; name: string; record?: string }[] }): DiscordMessage {
  const medal = (rank: number) => ["🥇", "🥈", "🥉"][rank - 1] ?? `${rank}º`;
  const lines = input.top.slice(0, 8).map((p) => `${medal(p.rank)} ${cut(p.name, 60)}${p.record ? ` · ${p.record}` : ""}`);
  return {
    content: "🏁 **Resultado de torneio**",
    embeds: [{ title: cut(input.name, 250), url: input.url, description: lines.join("\n") || undefined, color: TOURNAMENT_COLOR, footer: { text: input.city ? `${cut(input.city, 80)} · decks e classificação no site` : "Decks e classificação no site" } }],
  };
}

export function tournamentMessage(input: { name: string; city?: string | null; country?: string | null; participants?: number | null; url: string }): DiscordMessage {
  const where = [input.city, input.country].filter(Boolean).join(", ");
  const details = [where, input.participants ? `${input.participants} jogadores` : ""].filter(Boolean).join(" · ");
  return {
    content: "📊 **Novo torneio no metagame**",
    embeds: [{ title: cut(input.name, 250), url: input.url, description: details || undefined, color: TOURNAMENT_COLOR, footer: { text: "Listas e estatísticas no anaheimhub.com" } }],
  };
}

type AnnounceDeps = { guild?: DiscordGuild | null; enabled?: boolean };

const announceEnabled = () => process.env.DISCORD_ANNOUNCE_ENABLED !== "false";

/** Bot configurado e anúncios ligados? Os anúncios checam antes de ler o banco (testes e ambientes sem bot não pagam nada). */
function activeGuild(deps: AnnounceDeps): DiscordGuild | null {
  if (!(deps.enabled ?? announceEnabled())) return null;
  return deps.guild !== undefined ? deps.guild : sharedDiscordGuild();
}

/** Posta uma vez por chave. A chave é gravada ANTES de postar (dois cliques ao mesmo tempo não duplicam);
 *  se o Discord falhar, ela sai de novo para a próxima tentativa. */
export async function announceOnce(prisma: PrismaClient, key: string, kind: DiscordChannelKind, message: DiscordMessage, deps: AnnounceDeps = {}): Promise<"sent" | "duplicate" | "off" | "no-channel"> {
  const guild = activeGuild(deps);
  if (!guild) return "off";
  try {
    await prisma.discordAnnouncement.create({ data: { key } });
  } catch {
    return "duplicate";
  }
  try {
    const sent = await guild.post(kind, message);
    if (!sent) {
      await prisma.discordAnnouncement.delete({ where: { key } }).catch(() => {});
      return "no-channel";
    }
    await prisma.discordAnnouncement.update({ where: { key }, data: { channelId: sent.channelId, messageId: sent.messageId } });
    return "sent";
  } catch (err) {
    await prisma.discordAnnouncement.delete({ where: { key } }).catch(() => {});
    throw err;
  }
}

/** Artigo publicado. Se ele é o artigo de uma proposta de spoiler, vai para #spoilers com as imagens das cartas. */
export async function announcePublishedArticle(prisma: PrismaClient, postId: string, deps: AnnounceDeps = {}) {
  if (!activeGuild(deps)) return "off";
  const post = await prisma.post.findUnique({ where: { id: postId }, select: { id: true, slug: true, title: true, excerpt: true, coverImage: true, status: true } });
  if (!post || post.status !== "PUBLISHED") return "skip";
  const base = discordPublicUrl();
  const url = `${base}/articles/${encodeURIComponent(post.slug)}`;
  const digest = await prisma.spoilerDigest.findFirst({ where: { articleId: post.id }, orderBy: { createdAt: "desc" }, select: { captures: { select: { imageUrl: true, status: true } } } });
  if (digest) {
    const images = digest.captures.filter((c) => c.status === "DIGESTED").map((c) => absoluteHttpsUrl(c.imageUrl, base)).filter((u): u is string => !!u);
    return announceOnce(prisma, `post:${post.id}`, "spoilers", spoilerMessage({ title: post.title, excerpt: post.excerpt, url, images: images.length ? images : [absoluteHttpsUrl(post.coverImage, base)].filter((u): u is string => !!u) }), deps);
  }
  return announceOnce(prisma, `post:${post.id}`, "announcements", articleMessage({ title: post.title, excerpt: post.excerpt, url, image: absoluteHttpsUrl(post.coverImage, base) }), deps);
}

/** Proposta de spoiler aprovada: artigo novo → anúncio normal; versão em inglês que atualizou o artigo → "atualizado". */
export async function announceSpoilerDigest(prisma: PrismaClient, digestId: string, deps: AnnounceDeps = {}) {
  if (!activeGuild(deps)) return "off";
  const digest = await prisma.spoilerDigest.findUnique({ where: { id: digestId }, select: { id: true, articleId: true, updatesArticleId: true, status: true, captures: { select: { imageUrl: true, status: true } } } });
  if (!digest || digest.status !== "PUBLISHED" || !digest.articleId) return "skip";
  const updated = Boolean(digest.updatesArticleId && digest.updatesArticleId === digest.articleId);
  if (!updated) return announcePublishedArticle(prisma, digest.articleId, deps);
  const post = await prisma.post.findUnique({ where: { id: digest.articleId }, select: { slug: true, title: true, excerpt: true, coverImage: true } });
  if (!post) return "skip";
  const base = discordPublicUrl();
  const images = digest.captures.filter((c) => c.status === "DIGESTED").map((c) => absoluteHttpsUrl(c.imageUrl, base)).filter((u): u is string => !!u);
  return announceOnce(prisma, `post:${digest.articleId}:digest:${digest.id}`, "spoilers", spoilerMessage({ title: post.title, excerpt: post.excerpt, url: `${base}/articles/${encodeURIComponent(post.slug)}`, images, updated: true }), deps);
}

/** Evento ao vivo do organizador: marcado (SCHEDULED) ou encerrado (COMPLETED, com o top da classificação). */
export async function announceHostedEvent(
  prisma: PrismaClient,
  eventId: string,
  standings: () => Promise<{ rank: number; user: { displayName?: string | null; username?: string | null }; wins?: number; draws?: number; losses?: number }[]>,
  deps: AnnounceDeps = {},
) {
  if (!activeGuild(deps)) return "off";
  const event = await prisma.hostedEvent.findUnique({ where: { id: eventId }, select: { id: true, name: true, description: true, venueName: true, city: true, format: true, maxPlayers: true, dateStart: true, status: true, isActive: true } });
  if (!event || !event.isActive) return "skip";
  const base = discordPublicUrl();
  if (event.status === "SCHEDULED" && event.dateStart.getTime() > Date.now()) {
    return announceOnce(prisma, `event:${event.id}:scheduled`, "tournaments", eventScheduledMessage({ ...event, venue: event.venueName, url: `${base}/eventos/${event.id}/checkin` }), deps);
  }
  if (event.status === "COMPLETED") {
    const rows = await standings();
    const top = rows.slice(0, 4).map((r) => ({ rank: r.rank, name: r.user.displayName || r.user.username || "Jogador", record: r.wins === undefined ? undefined : `${r.wins}-${r.losses ?? 0}${r.draws ? `-${r.draws}` : ""}` }));
    return announceOnce(prisma, `event:${event.id}:results`, "tournaments", eventResultsMessage({ name: event.name, city: event.city, url: `${base}/torneios`, top }), deps);
  }
  return "skip";
}

/** Torneio cadastrado pela equipe (resultado externo que entra no metagame). */
export async function announceTournament(prisma: PrismaClient, tournamentId: string, deps: AnnounceDeps = {}) {
  if (!activeGuild(deps)) return "off";
  const t = await prisma.tournament.findUnique({ where: { id: tournamentId }, select: { id: true, name: true, city: true, country: true, participantCount: true, isActive: true } });
  if (!t || !t.isActive) return "skip";
  return announceOnce(prisma, `tournament:${t.id}`, "tournaments", tournamentMessage({ name: t.name, city: t.city, country: t.country, participants: t.participantCount, url: `${discordPublicUrl()}/torneios/${t.id}` }), deps);
}

/** Dispara sem esperar; erro do Discord só vira log. */
export function queueDiscordAnnouncement(label: string, run: () => Promise<unknown>) {
  void run().catch((err) => console.warn(`[discord] anúncio (${label}) falhou:`, err instanceof Error ? err.message : err));
}
