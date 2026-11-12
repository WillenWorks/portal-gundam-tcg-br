import { describe, expect, it, vi } from "vitest";
import { normalizeSpoilerCard, type SpoilerCardData } from "./spoilerExtract";
import { analyzeSpoiler, traitsMentioned, type CatalogCard, type SpoilerAnalysisContext } from "./spoilerAnalysis";
import {
  buildDigestMarkdown,
  digestTitle,
  publishSpoilerDigestSite,
  readSpoilerConfig,
  setCodeOf,
  sourceUrlOf,
  spoilerDigestIdOf,
  spoilerImagesOf,
  type DiscordMessage,
} from "./spoilerService";
import { spoilerCoverHtml, spoilerHashtags } from "./spoilerSocial";
import { extraStoryVideoUrlsOf } from "./socialPublisherService";
import { markdownToHtml } from "../htmlContent";

const card = (over: Partial<CatalogCard>): CatalogCard => ({
  id: over.code ?? "x", code: "GD01-001", name: "Card", cardType: "UNIT", color: "Blue", level: 3, cost: 2, ap: 3, hp: 3,
  traits: [], linkText: null, pilotName: null, effectEn: null, ...over,
});

const spoiler: SpoilerCardData = {
  code: "GD07-010", nameEn: "Gundam Aerial", cardType: "UNIT", color: "Blue", level: 4, cost: 3, ap: 4, hp: 4, rarity: "LR",
  traits: ["Academy"], linkText: "[Suletta Mercury]", effectEn: "【Deploy】 Choose 1 of your (Academy) Units. It gets AP+2 during this turn.",
  effectPt: "【Deploy】 Escolha 1 das suas Unidades (Academy). Ela recebe AP+2 neste turno.", translated: false,
};

describe("normalizeSpoilerCard", () => {
  it("aceita a leitura válida e limpa os campos", () => {
    const out = normalizeSpoilerCard({ isCard: true, code: " gd07-010 ", nameEn: "Gundam Aerial", cardType: "unit", color: "blue", level: 4, cost: 3, ap: 4.2, hp: 4, rarity: "lr", traits: ["(Academy)", "Academy", ""], linkText: "[Suletta Mercury]", effectEn: "x", effectPt: "y", printedLanguage: "ja" });
    expect(out).toMatchObject({ code: "GD07-010", cardType: "UNIT", color: "Blue", ap: 4, rarity: "LR", traits: ["Academy"], translated: true });
  });
  it("recusa o que não é carta ou falta nome/tipo", () => {
    expect(normalizeSpoilerCard({ isCard: false, nameEn: "x", cardType: "UNIT" })).toBeNull();
    expect(normalizeSpoilerCard({ isCard: true, nameEn: "x", cardType: "TOKEN" })).toBeNull();
    expect(normalizeSpoilerCard({ isCard: true, cardType: "UNIT" })).toBeNull();
    expect(normalizeSpoilerCard("lixo")).toBeNull();
  });
  it("descarta número fora da faixa e código fora do padrão; AP/HP só em Unidade/Base", () => {
    const out = normalizeSpoilerCard({ isCard: true, nameEn: "Cmd", cardType: "COMMAND", code: "GD07 010 extra", cost: 99, ap: 3, hp: 3 });
    expect(out).toMatchObject({ code: null, cost: null, ap: null, hp: null });
  });
});

describe("mensagens do Discord", () => {
  const msg: DiscordMessage = {
    id: "123456789", channel_id: "999999", timestamp: "2026-11-13T08:30:00Z",
    attachments: [
      { id: "1", url: "https://cdn.discordapp.com/attachments/a/b/c.png?ex=1", content_type: "image/png", size: 1000 },
      { id: "2", url: "https://cdn.discordapp.com/attachments/a/b/c.png?ex=2", content_type: "image/png", size: 1000 },
      { id: "3", url: "https://cdn.discordapp.com/x.txt", content_type: "text/plain" },
      { id: "4", url: "https://evil.example.com/a.png", content_type: "image/png" },
    ],
    embeds: [{ image: { url: "https://cdn.discordapp.com/embed.png" } }],
    message_reference: { guild_id: "111111", channel_id: "222222", message_id: "333333" },
  };
  it("pega só imagens do CDN do Discord, sem repetir, e ignora embeds quando há anexo", () => {
    expect(spoilerImagesOf(msg).map((i) => i.sourceKey)).toEqual(["123456789:a1"]);
  });
  it("usa a cópia do embed no CDN quando não há anexo; link externo fica de fora", () => {
    const refs = spoilerImagesOf({ ...msg, attachments: [], embeds: [{ image: { url: "https://x.com/a.png", proxy_url: "https://media.discordapp.net/external/a.png" } }, { image: { url: "http://169.254.169.254/" } }] });
    expect(refs).toEqual([{ sourceKey: "123456789:e0", url: "https://media.discordapp.net/external/a.png" }]);
  });
  it("monta o link da mensagem original", () => {
    expect(sourceUrlOf(msg)).toBe("https://discord.com/channels/111111/222222/333333");
    expect(sourceUrlOf({ ...msg, message_reference: undefined })).toBeNull();
  });
  it("código da coleção", () => {
    expect(setCodeOf("GD07-012")).toBe("GD07");
    expect(setCodeOf("ST10-003_p1")).toBe("ST10");
    expect(setCodeOf(null)).toBeNull();
  });
  it("configuração exige a chave, o token e o canal", () => {
    expect(readSpoilerConfig({ DISCORD_BOT_TOKEN: "t", SPOILER_DISCORD_CHANNEL_ID: "123456" })).toBeNull();
    expect(readSpoilerConfig({ SPOILER_CAPTURE_ENABLED: "true", DISCORD_BOT_TOKEN: "t", SPOILER_DISCORD_CHANNEL_ID: "abc" })).toBeNull();
    expect(readSpoilerConfig({ SPOILER_CAPTURE_ENABLED: "true", DISCORD_BOT_TOKEN: "t", SPOILER_DISCORD_CHANNEL_ID: "123456", SPOILER_QUIET_MINUTES: "5" })).toMatchObject({ quietMinutes: 5, backfillHours: 12 });
  });
});

describe("analyzeSpoiler", () => {
  const catalog = [
    card({ id: "a", code: "GD03-001", name: "Darilbalde", traits: ["Academy"], cost: 3, level: 4, ap: 4, hp: 3 }),
    card({ id: "b", code: "GD03-050", name: "Suletta Mercury", cardType: "PILOT", traits: ["Academy"], pilotName: "Suletta Mercury" }),
    card({ id: "c", code: "GD02-010", name: "Pharact", traits: ["Shin Sei"], effectEn: "While you have an (Academy) Unit, this gets AP+1." }),
    card({ id: "d", code: "GD01-020", name: "Zaku II", color: "Green", traits: ["Zeon"], cost: 3, level: 4 }),
    card({ id: "e", code: "GD01-021", name: "Blue Same Cost", traits: ["Earth Federation"], cost: 3, level: 4, ap: 5, hp: 4 }),
  ];
  const ctx: SpoilerAnalysisContext = {
    catalog,
    usage: new Map([["GD03-001", { code: "GD03-001", decks: 12, totalDecks: 40, tournaments: 5, wins: 1, topDecks: 3, avgCopies: 3, archetypes: [] }]]),
    archetypes: [
      { name: "Azul Academy", slug: "azul-academy", colors: ["Blue"], share: 0.2, lists: 8, coreCodes: ["GD03-001", "GD03-050"] },
      { name: "Verde Zeon", slug: "verde-zeon", colors: ["Green"], share: 0.3, lists: 12, coreCodes: ["GD01-020"] },
    ],
    windowLabel: "últimos 90 dias",
  };
  const a = analyzeSpoiler(spoiler, ctx);
  it("cartas com os mesmos traits, mais usadas primeiro", () => {
    expect(a.sameTraits.map((r) => r.card.code)).toEqual(["GD03-001", "GD03-050"]);
    expect(a.sameTraits[0].decks).toBe(12);
  });
  it("sinergias: piloto do Link, efeito que cita o trait dela, efeito dela que cita trait", () => {
    const reasons = Object.fromEntries(a.synergies.map((r) => [r.card.code, r.reason]));
    expect(reasons["GD03-050"]).toMatch(/Link/);
    expect(reasons["GD02-010"]).toMatch(/cita Academy/);
    expect(reasons["GD03-001"]).toMatch(/efeito da carta nova cita/);
    expect(reasons["GD01-020"]).toBeUndefined();
  });
  it("arquétipos: cor e núcleo com trait em comum; o verde sem trait em comum fica de fora", () => {
    expect(a.archetypes.map((f) => f.archetype.slug)).toEqual(["azul-academy"]);
    expect(a.archetypes[0].reason).toMatch(/mesma cor/);
  });
  it("parecidas: mesmo tipo, cor e custo, com a diferença dos números", () => {
    expect(a.similar.map((s) => s.card.code)).toEqual(["GD03-001", "GD01-021"]);
    expect(a.similar[0].diff).toMatch(/HP 3 \(a nova: 4\)/);
  });
  it("traits citados só valem se existem no catálogo", () => {
    expect(traitsMentioned("Choose 1 (Academy) Unit (it can't be blocked).", new Set(["academy"]))).toEqual(["academy"]);
  });
  it("sem catálogo nem torneio, nada é inventado", () => {
    expect(analyzeSpoiler(spoiler, { catalog: [], usage: new Map(), archetypes: [], windowLabel: "" })).toEqual({ sameTraits: [], synergies: [], archetypes: [], similar: [] });
  });
});

describe("artigo e post do resumo", () => {
  const ctx: SpoilerAnalysisContext = { catalog: [card({ code: "GD03-001", name: "Darilbalde", traits: ["Academy"] })], usage: new Map(), archetypes: [], windowLabel: "últimos 90 dias" };
  const md = buildDigestMarkdown({
    cards: [{ data: { ...spoiler, translated: true }, imageUrl: "/uploads/spoilers/a.png", inCatalog: true, analysis: analyzeSpoiler(spoiler, ctx), take: "Boa abertura de curva." }],
    setCode: "GD07", windowLabel: "últimos 90 dias", sourceUrls: ["https://discord.com/channels/1/2/3"],
  });
  it("traz dados, efeito nos dois idiomas, aviso de tradução, análise e crédito", () => {
    expect(md).toContain("## Gundam Aerial (GD07-010)");
    expect(md).toContain("**Traits:** Academy");
    expect(md).toContain("> 【Deploy】 Choose 1");
    expect(md).toContain("traduzido do japonês");
    expect(md).toContain("### Primeira leitura");
    expect(md).toContain("[[GD03-001]] Darilbalde");
    expect(md).toContain("**prévia**");
    expect(md).toContain("([fonte](https://discord.com/channels/1/2/3))");
  });
  it("o HTML do servidor mostra o texto das referências [[código]]", () => {
    expect(markdownToHtml("- [[GD03-001]] Darilbalde")).toContain("<li>GD03-001 Darilbalde</li>");
  });
  it("título, hashtags e capa", () => {
    expect(digestTitle("GD07", 3, "13/11")).toBe("Spoilers de GD07: 3 cartas reveladas em 13/11");
    expect(digestTitle(null, 1, "13/11")).toBe("Spoilers: 1 carta revelada em 13/11");
    expect(spoilerHashtags("GD07")).toEqual(["GundamSpoiler", "GD07", "GundamCardGame", "GundamCardGameBR", "AnaheimHub"]);
    const cover = spoilerCoverHtml({ setCode: "GD07", dayLabel: "13/11", cards: [{ ...spoiler, nameEn: "<b>x</b>" }], extra: 2 });
    expect(cover).toContain("3 cartas novas");
    expect(cover).toContain("&lt;b&gt;x&lt;/b&gt;");
  });
  it("stories extras: só vídeos da pasta social", () => {
    expect(extraStoryVideoUrlsOf({ metadata: JSON.stringify({ extraStoryVideoUrls: ["/uploads/social/social-a-1.mp4", "https://x/y.mp4", "/uploads/social/../x.mp4"] }) })).toEqual(["/uploads/social/social-a-1.mp4"]);
    expect(extraStoryVideoUrlsOf({ metadata: "{" })).toEqual([]);
  });
});

describe("aprovação do resumo", () => {
  it("ativa só as cartas prévia, publica o artigo e marca o resumo", async () => {
    const calls: Record<string, unknown[]> = {};
    const log = (name: string) => (args: unknown) => {
      (calls[name] ??= []).push(args);
      return Promise.resolve({ count: 1 });
    };
    const prisma = {
      spoilerDigest: {
        findUnique: vi.fn().mockResolvedValue({ id: "d1", status: "PENDING_APPROVAL", articleId: "p1", captures: [{ cardModelId: "m1" }, { cardModelId: "m2" }, { cardModelId: null }] }),
        update: log("digest"),
      },
      cardModel: { findMany: vi.fn().mockResolvedValue([{ id: "m1" }]), updateMany: log("models") },
      card: { updateMany: log("cards"), findMany: vi.fn().mockResolvedValue([{ setId: "s1" }]) },
      post: { updateMany: log("post") },
      cardSet: { findUnique: vi.fn().mockResolvedValue({ isActive: false, metadataJson: { autoCreatedBy: "spoilers" } }), update: log("set") },
      $transaction: (ops: Array<Promise<unknown>>) => Promise.all(ops),
    };
    await publishSpoilerDigestSite(prisma as never, { id: "s", metadata: JSON.stringify({ spoilerDigestId: "d1" }) });
    expect(calls.models[0]).toMatchObject({ where: { id: { in: ["m1"] } }, data: { isActive: true } });
    expect(calls.post[0]).toMatchObject({ where: { id: "p1" }, data: { status: "PUBLISHED" } });
    expect(calls.digest[0]).toMatchObject({ data: { status: "PUBLISHED" } });
    expect(calls.set[0]).toMatchObject({ where: { id: "s1" }, data: { isActive: true } });
  });
  it("resumo já publicado ou post sem resumo não faz nada", async () => {
    const prisma = { spoilerDigest: { findUnique: vi.fn().mockResolvedValue({ id: "d1", status: "PUBLISHED", captures: [] }) } };
    await publishSpoilerDigestSite(prisma as never, { id: "s", metadata: JSON.stringify({ spoilerDigestId: "d1" }) });
    await publishSpoilerDigestSite(prisma as never, { id: "s", metadata: "{}" });
    expect(spoilerDigestIdOf({ metadata: "{}" })).toBeNull();
  });
});

describe("captura e resumo (banco em memória)", () => {
  type Row = Record<string, unknown> & { id: string };
  const table = () => {
    const rows: Row[] = [];
    let seq = 0;
    const match = (r: Row, where: Record<string, unknown> = {}) =>
      Object.entries(where).every(([k, v]) => {
        if (v && typeof v === "object" && "in" in (v as object)) return ((v as { in: unknown[] }).in).includes(r[k]);
        return (r[k] ?? null) === v;
      });
    return {
      rows,
      findUnique: async ({ where }: { where: Record<string, unknown> }) => rows.find((r) => match(r, where)) ?? null,
      findFirst: async ({ where }: { where?: Record<string, unknown> } = {}) => rows.find((r) => match(r, where)) ?? null,
      findMany: async ({ where }: { where?: Record<string, unknown> } = {}) => rows.filter((r) => match(r, where)),
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: `id${++seq}`, createdAt: new Date(), ...data } as Row;
        rows.push(row);
        return row;
      },
      update: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => Object.assign(rows.find((r) => match(r, where))!, data),
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        const hit = rows.filter((r) => match(r, where));
        hit.forEach((r) => Object.assign(r, data));
        return { count: hit.length };
      },
    };
  };
  const makeDb = () => {
    const db = {
      spoilerCapture: table(), spoilerDigest: table(), cardModel: table(), card: table(), cardSet: table(), post: table(),
      user: { findFirst: async () => ({ id: "admin" }) },
      $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(db),
    };
    return db;
  };

  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);
  const message = (id: string, minutesAgo: number, now: Date): DiscordMessage => ({
    id, channel_id: "555555", content: "GD07 spoiler", timestamp: new Date(now.getTime() - minutesAgo * 60_000).toISOString(),
    attachments: [{ id: `${id}1`, url: `https://cdn.discordapp.com/attachments/1/2/${id}.png`, content_type: "image/png", size: 40 }],
  });

  it("captura, grava prévia inativa, não repete e monta o resumo depois do silêncio", async () => {
    const { mkdtempSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    process.env.LOCAL_UPLOAD_DIR = mkdtempSync(join(tmpdir(), "spoilers-"));
    const { captureNewSpoilers, buildSpoilerDigest, resetSpoilerCursor } = await import("./spoilerService");
    resetSpoilerCursor();
    const db = makeDb();
    const now = new Date("2026-11-13T08:40:00Z");
    const fetchFn = vi.fn(async (url: string) => {
      if (url.includes("/messages")) return new Response(JSON.stringify([message("100002", 5, now), message("100001", 10, now), message("100000", 60 * 48, now)]));
      return new Response(png);
    }) as unknown as typeof fetch;
    const extract = vi.fn(async () => ({ card: spoiler, provider: "gemini" as const, model: "m" }));
    const config = { botToken: "t", channelId: "555555", quietMinutes: 20, backfillHours: 12 };

    const first = await captureNewSpoilers(db as never, config, { fetchFn, extract, now: () => now });
    expect(first).toEqual({ captured: 2, failed: 0 }); // a de 48 h atrás fica de fora
    expect(db.cardModel.rows).toHaveLength(1);
    expect(db.cardModel.rows[0]).toMatchObject({ code: "GD07-010", isActive: false, legalityStatus: "preview" });
    expect(db.cardSet.rows[0]).toMatchObject({ code: "GD07", isActive: false });
    expect(db.card.rows[0]).toMatchObject({ isActive: false, imageUrl: "/uploads/spoilers/100002-a1000021.png" }); // a imagem mais nova da mesma carta

    // canal ainda "quente": sem resumo
    expect(await buildSpoilerDigest(db as never, 20, { now: () => now, context: { catalog: [], usage: new Map(), archetypes: [], windowLabel: "" }, writeTakes: async () => null, createPost: async () => ({ id: "sp1" }) })).toBeNull();

    const later = new Date(now.getTime() + 30 * 60_000);
    const digest = await buildSpoilerDigest(db as never, 20, { now: () => later, context: { catalog: [], usage: new Map(), archetypes: [], windowLabel: "" }, writeTakes: async () => null, createPost: async () => ({ id: "sp1" }) });
    expect(digest).toMatchObject({ socialPostId: "sp1", setCode: "GD07" });
    expect(db.post.rows).toHaveLength(1);
    expect(db.post.rows[0]).toMatchObject({ status: "REVIEW", postType: "PREVIEW", title: "Spoilers de GD07: 1 carta revelada em 13/11" }); // mesma carta 2x = 1
    expect(db.spoilerCapture.rows.every((r) => r.status === "DIGESTED")).toBe(true);
    expect(await buildSpoilerDigest(db as never, 20, { now: () => later })).toBeNull();
  });

  it("carta já lançada não é tocada; leitura que falha fica registrada", async () => {
    const { upsertPreviewCard } = await import("./spoilerService");
    const db = makeDb();
    db.cardModel.rows.push({ id: "real", code: "GD07-010", isActive: true, legalityStatus: "legal" });
    expect(await upsertPreviewCard(db as never, spoiler, "/x.png")).toEqual({ cardModelId: "real", code: "GD07-010", official: true });
    expect(db.card.rows).toHaveLength(0);
    expect(await upsertPreviewCard(db as never, { ...spoiler, code: null }, "/x.png")).toBeNull();
  });
});
