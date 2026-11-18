/* eslint-disable @typescript-eslint/no-explicit-any -- banco em memória: linhas soltas, como o Prisma devolve */
import { describe, expect, it, vi } from "vitest";
import {
  announceHostedEvent,
  announceOnce,
  announcePublishedArticle,
  announceSpoilerDigest,
  eventResultsMessage,
  eventScheduledMessage,
  spoilerMessage,
} from "./discordAnnouncements";
import type { DiscordGuild } from "./discordGuild";

function fakeGuild(result: { channelId: string; messageId: string } | null = { channelId: "c1", messageId: "m1" }) {
  const post = vi.fn(async (..._args: unknown[]) => result);
  return { guild: { post } as unknown as DiscordGuild, post };
}

function fakePrisma(seed: { posts?: any[]; digests?: any[]; events?: any[] } = {}) {
  const keys = new Map<string, any>();
  const prisma: any = {
    discordAnnouncement: {
      create: vi.fn(async ({ data }: any) => {
        if (keys.has(data.key)) throw new Error("Unique constraint");
        keys.set(data.key, { ...data });
        return data;
      }),
      update: vi.fn(async ({ where, data }: any) => Object.assign(keys.get(where.key), data)),
      delete: vi.fn(async ({ where }: any) => keys.delete(where.key)),
    },
    post: { findUnique: async ({ where }: any) => (seed.posts ?? []).find((p) => p.id === where.id) ?? null },
    spoilerDigest: {
      findFirst: async ({ where }: any) => (seed.digests ?? []).find((d) => d.articleId === where.articleId) ?? null,
      findUnique: async ({ where }: any) => (seed.digests ?? []).find((d) => d.id === where.id) ?? null,
    },
    hostedEvent: { findUnique: async ({ where }: any) => (seed.events ?? []).find((e) => e.id === where.id) ?? null },
  };
  return { prisma, keys };
}

const article = { id: "a1", slug: "nova-colecao", title: "Nova coleção GD07", excerpt: "Tudo sobre a coleção.", coverImage: "/uploads/capa.webp", status: "PUBLISHED" };

describe("announceOnce", () => {
  it("posta uma vez por chave; a segunda vez é ignorada", async () => {
    const { prisma, keys } = fakePrisma();
    const { guild, post } = fakeGuild();
    expect(await announceOnce(prisma, "post:a1", "announcements", { embeds: [] }, { guild, enabled: true })).toBe("sent");
    expect(await announceOnce(prisma, "post:a1", "announcements", { embeds: [] }, { guild, enabled: true })).toBe("duplicate");
    expect(post).toHaveBeenCalledTimes(1);
    expect(keys.get("post:a1")).toMatchObject({ channelId: "c1", messageId: "m1" });
  });

  it("Discord falhou ou canal não existe: a chave sai para tentar de novo depois", async () => {
    const { prisma, keys } = fakePrisma();
    const failing = { post: vi.fn(async () => Promise.reject(new Error("503"))) } as unknown as DiscordGuild;
    await expect(announceOnce(prisma, "post:a1", "announcements", { embeds: [] }, { guild: failing, enabled: true })).rejects.toThrow("503");
    expect(keys.has("post:a1")).toBe(false);
    const { guild } = fakeGuild(null);
    expect(await announceOnce(prisma, "post:a1", "announcements", { embeds: [] }, { guild, enabled: true })).toBe("no-channel");
    expect(keys.has("post:a1")).toBe(false);
  });

  it("sem bot ou com DISCORD_ANNOUNCE_ENABLED=false não toca no banco", async () => {
    const { prisma } = fakePrisma();
    const { guild } = fakeGuild();
    expect(await announceOnce(prisma, "k", "announcements", { embeds: [] }, { guild: null, enabled: true })).toBe("off");
    expect(await announcePublishedArticle(prisma, "a1", { guild, enabled: false })).toBe("off");
    expect(prisma.discordAnnouncement.create).not.toHaveBeenCalled();
  });
});

describe("artigos e spoilers", () => {
  it("artigo comum vai para #anúncios com o link e a capa", async () => {
    const { prisma } = fakePrisma({ posts: [article] });
    const { guild, post } = fakeGuild();
    await announcePublishedArticle(prisma, "a1", { guild, enabled: true });
    const [kind, message] = post.mock.calls[0] as [string, any];
    expect(kind).toBe("announcements");
    expect(message.embeds[0]).toMatchObject({ title: "Nova coleção GD07", url: "https://anaheimhub.com/articles/nova-colecao", image: { url: "https://anaheimhub.com/uploads/capa.webp" } });
  });

  it("rascunho não é anunciado", async () => {
    const { prisma } = fakePrisma({ posts: [{ ...article, status: "DRAFT" }] });
    const { guild, post } = fakeGuild();
    expect(await announcePublishedArticle(prisma, "a1", { guild, enabled: true })).toBe("skip");
    expect(post).not.toHaveBeenCalled();
  });

  it("artigo de spoiler vai para #spoilers com as imagens das cartas em galeria", async () => {
    const captures = [
      { imageUrl: "/uploads/spoilers/1.webp", status: "DIGESTED" },
      { imageUrl: "/uploads/spoilers/2.webp", status: "DIGESTED" },
      { imageUrl: "/uploads/spoilers/x.webp", status: "FAILED" },
    ];
    const { prisma } = fakePrisma({ posts: [article], digests: [{ id: "d1", articleId: "a1", updatesArticleId: null, status: "PUBLISHED", captures }] });
    const { guild, post } = fakeGuild();
    await announceSpoilerDigest(prisma, "d1", { guild, enabled: true });
    const [kind, message] = post.mock.calls[0] as [string, any];
    expect(kind).toBe("spoilers");
    expect(message.content).toContain("Spoiler do dia");
    expect(message.embeds.map((e: any) => e.image?.url)).toEqual(["https://anaheimhub.com/uploads/spoilers/1.webp", "https://anaheimhub.com/uploads/spoilers/2.webp"]);
    expect(message.embeds.every((e: any) => e.url === "https://anaheimhub.com/articles/nova-colecao")).toBe(true);
  });

  it("versão em inglês que atualizou o artigo sai como 'atualizado', com chave própria", async () => {
    const digest = { id: "d2", articleId: "a1", updatesArticleId: "a1", status: "PUBLISHED", captures: [{ imageUrl: "/uploads/spoilers/en.webp", status: "DIGESTED" }] };
    const { prisma, keys } = fakePrisma({ posts: [article], digests: [digest] });
    keys.set("post:a1", {});
    const { guild, post } = fakeGuild();
    expect(await announceSpoilerDigest(prisma, "d2", { guild, enabled: true })).toBe("sent");
    expect((post.mock.calls[0] as [string, any])[1].content).toContain("atualizado");
    expect(keys.has("post:a1:digest:d2")).toBe(true);
  });

  it("galeria limitada a 4 imagens", () => {
    const message = spoilerMessage({ title: "t", url: "https://anaheimhub.com/articles/t", images: ["https://a/1", "https://a/2", "https://a/3", "https://a/4", "https://a/5"] });
    expect(message.embeds).toHaveLength(4);
  });
});

describe("torneios", () => {
  const event = { id: "e1", name: "Liga de Sábado", description: null, venueName: "Loja X", city: "São Paulo", format: "constructed", maxPlayers: 16, isActive: true };

  it("evento marcado no futuro → #torneios com o link do check-in", async () => {
    const { prisma } = fakePrisma({ events: [{ ...event, status: "SCHEDULED", dateStart: new Date(Date.now() + 86_400_000) }] });
    const { guild, post } = fakeGuild();
    await announceHostedEvent(prisma, "e1", async () => [], { guild, enabled: true });
    const [kind, message] = post.mock.calls[0] as [string, any];
    expect(kind).toBe("tournaments");
    expect(message.embeds[0].url).toBe("https://anaheimhub.com/eventos/e1/checkin");
  });

  it("evento encerrado → top 4 com campanha", async () => {
    const { prisma } = fakePrisma({ events: [{ ...event, status: "COMPLETED", dateStart: new Date("2026-11-01") }] });
    const { guild, post } = fakeGuild();
    const standings = async () => [
      { rank: 1, user: { displayName: "Amuro" }, wins: 4, losses: 0, draws: 0 },
      { rank: 2, user: { displayName: "Char" }, wins: 3, losses: 1, draws: 0 },
    ];
    await announceHostedEvent(prisma, "e1", standings, { guild, enabled: true });
    const description = (post.mock.calls[0] as [string, any])[1].embeds[0].description;
    expect(description).toBe("🥇 Amuro · 4-0\n🥈 Char · 3-1");
  });

  it("rascunho ou evento já passado como 'marcado' não é anunciado", async () => {
    const { prisma } = fakePrisma({ events: [{ ...event, status: "SCHEDULED", dateStart: new Date("2020-01-01") }] });
    const { guild, post } = fakeGuild();
    expect(await announceHostedEvent(prisma, "e1", async () => [], { guild, enabled: true })).toBe("skip");
    expect(post).not.toHaveBeenCalled();
  });

  it("mensagens não estouram os limites do Discord", () => {
    const long = "x".repeat(600);
    expect(eventScheduledMessage({ name: long, dateStart: new Date(), description: long, url: "https://a" }).embeds[0].title).toHaveLength(250);
    expect(eventResultsMessage({ name: "n", url: "https://a", top: [] }).embeds[0].description).toBeUndefined();
  });
});
