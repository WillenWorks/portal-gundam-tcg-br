import { describe, expect, it, vi } from "vitest";
import { VedaIndex } from "../vedaCore";

const genai = vi.hoisted(() => ({ generateContent: vi.fn() }));
vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = { generateContent: genai.generateContent };
  },
}));

const claude = vi.hoisted(() => ({ parse: vi.fn() }));
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    beta = { messages: { parse: claude.parse } };
  },
}));
import {
  buildSocialCardHtml,
  captionProblems,
  generateSocialContentWithGemini,
  missingAdDisclosure,
  pickCardForPost,
  publishApprovedPost,
  safeFileStem,
  sendDiscordSocialNotification,
  approveSocialPost,
  rejectSocialPost,
  buildDiscordSocialPayload,
  findAltArts,
  lastSpotlightTier,
  draftTournamentReport,
} from "./socialPublisherService";

const cardRow = {
  code: "ST01-001",
  nameEn: "Gundam",
  namePt: null,
  color: "Blue",
  cardType: "UNIT",
  ap: 3,
  hp: 4,
  cost: 3,
  level: 4,
  effectEn: "<Repair 2> (At the end of your turn...)",
  effectPt: "<Repair 2> (No final do seu turno...)",
  imageUrl: "https://example.com/st01-001.png",
};

describe("socialPublisherService", () => {
  it("pickCardForPost devolve a carta pedida com o texto em português e o nome oficial", async () => {
    const prisma = { card: { findFirst: vi.fn().mockResolvedValue(cardRow) }, socialMediaPost: { findMany: vi.fn() } } as any;
    const card = await pickCardForPost(prisma, "st01-001");
    expect(card).toMatchObject({ code: "ST01-001", name: "Gundam", color: "blue", text: "<Repair 2> (No final do seu turno...)" });
    expect(prisma.card.findFirst.mock.calls[0][0].where.code).toBe("ST01-001");
  });

  it("quebras <br> do texto da carta viram linha nova (saíam cruas na legenda); palavras-chave <...> ficam", async () => {
    const row = { ...cardRow, effectPt: "[Burst] Adicione esta carta à sua mão.<br>[When Paired] <Blocker><BR/>Fim" };
    const prisma = { card: { findFirst: vi.fn().mockResolvedValue(row) }, socialMediaPost: { findMany: vi.fn() } } as any;
    const card = await pickCardForPost(prisma, "ST01-001");
    expect(card.text).toBe("[Burst] Adicione esta carta à sua mão.\n[When Paired] <Blocker>\nFim");
  });

  it("pickCardForPost recusa código com caracteres de caminho", async () => {
    const prisma = { card: { findFirst: vi.fn() } } as any;
    await expect(pickCardForPost(prisma, "../../etc/passwd")).rejects.toThrow(/inválido/);
    expect(prisma.card.findFirst).not.toHaveBeenCalled();
  });

  it("pickCardForPost sorteia entre as cartas elegíveis e evita as dos últimos posts", async () => {
    const prisma = {
      card: { count: vi.fn().mockResolvedValue(10), findFirst: vi.fn().mockResolvedValue(cardRow) },
      socialMediaPost: { findMany: vi.fn().mockResolvedValue([{ cardCode: "GD01-001" }]) },
    } as any;
    await pickCardForPost(prisma, undefined, () => 0.75);
    const args = prisma.card.findFirst.mock.calls[0][0];
    expect(args.skip).toBe(7);
    expect(args.where.code).toEqual({ notIn: ["GD01-001"] });
    expect(args.where.isPrimaryPrint).toBe(true);
  });

  it("modelo fixo (sem chave do Gemini) usa só os dados da carta", async () => {
    const content = await generateSocialContentWithGemini({ code: "ST01-001", name: "Gundam", color: "blue", type: "UNIT", ap: 3, hp: 4, cost: 3, text: "efeito" }, undefined, "", "");
    expect(content.title).toContain("ST01-001");
    expect(content.fullCaption).toContain("CARTA DO DIA");
    expect(content.fullCaption).toContain("#GundamCardGame");
    expect(content.fullCaption).toContain("Unidade");
  });

  it("Gemini sobrecarregado (503) num modelo: tenta o próximo antes de cair no texto fixo", async () => {
    genai.generateContent.mockReset();
    genai.generateContent
      .mockRejectedValueOnce(new Error('{"error":{"code":503,"status":"UNAVAILABLE"}}'))
      .mockResolvedValueOnce({ text: JSON.stringify({ title: "Gundam em foco", fullCaption: "Legenda do Gemini #GundamCardGame" }) });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const content = await generateSocialContentWithGemini({ code: "ST01-001", name: "Gundam", color: "blue", type: "UNIT", text: "efeito" }, undefined, "chave", "");
    warn.mockRestore();
    expect(content.fullCaption).toContain("Legenda do Gemini");
    const models = genai.generateContent.mock.calls.map(([req]) => req.model);
    expect(models).toHaveLength(2);
    expect(models[0]).not.toBe(models[1]);
  });

  it("todos os modelos do Gemini falhando: usa o texto fixo", async () => {
    genai.generateContent.mockReset();
    genai.generateContent.mockRejectedValue(new Error("503"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const content = await generateSocialContentWithGemini({ code: "ST01-001", name: "Gundam", color: "blue", type: "UNIT", text: "efeito" }, undefined, "chave", "");
    warn.mockRestore();
    expect(content.fullCaption).toContain("CARTA DO DIA");
  });

  it("nenhum Gemini respondendo: a legenda vem do Claude (com recusa por engano coberta pelo fallback da API)", async () => {
    genai.generateContent.mockReset();
    genai.generateContent.mockRejectedValue(new Error("503"));
    claude.parse.mockReset();
    claude.parse.mockResolvedValueOnce({
      stop_reason: "end_turn",
      parsed_output: { title: "Gundam", hook: "", strategy: "", cta: "", hashtags: ["#GundamCardGame"], fullCaption: "Legenda do Claude" },
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const content = await generateSocialContentWithGemini({ code: "ST01-001", name: "Gundam", color: "blue", type: "UNIT", text: "efeito" }, undefined, "chave", "chave-claude");
    warn.mockRestore();
    expect(content.fullCaption).toBe("Legenda do Claude");
    const [request] = claude.parse.mock.calls[0];
    expect(request.model).toBe("claude-opus-5-5");
    expect(request.fallbacks).toBe("default");
  });

  it("Claude recusando ou falhando: usa o texto fixo", async () => {
    genai.generateContent.mockReset();
    genai.generateContent.mockRejectedValue(new Error("503"));
    claude.parse.mockReset();
    claude.parse.mockResolvedValueOnce({ stop_reason: "refusal", stop_details: { category: null }, parsed_output: null });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const content = await generateSocialContentWithGemini({ code: "ST01-001", name: "Gundam", color: "blue", type: "UNIT", text: "efeito" }, undefined, "chave", "chave-claude");
    warn.mockRestore();
    expect(content.fullCaption).toContain("CARTA DO DIA");
  });

  it("arte: palavras-chave entre < > aparecem escapadas (antes sumiam como tag HTML)", () => {
    const html = buildSocialCardHtml({ code: "ST01-001", name: 'Gundam "<b>"', color: "blue", type: "UNIT", text: "<Repair 2> teste", imageUrl: "javascript:alert(1)" });
    expect(html).toContain("&lt;Repair 2&gt; teste");
    expect(html).toContain("Gundam &quot;&lt;b&gt;&quot;");
    expect(html).not.toContain("javascript:");
    expect(html).toContain("sem vínculo com a Bandai");
  });

  it("nome do arquivo nunca sai da pasta", () => {
    expect(safeFileStem("../../x/GD01-001")).toBe("xGD01-001");
    expect(safeFileStem("///")).toBe("carta");
  });

  it("valida limites da legenda e a identificação de publicidade", () => {
    expect(captionProblems("ok #a")).toEqual([]);
    expect(captionProblems("x".repeat(2201))[0]).toContain("2201");
    expect(captionProblems(Array.from({ length: 31 }, (_, i) => `#t${i}`).join(" "))[0]).toContain("31 hashtags");
    expect(missingAdDisclosure("PRODUCT_AFFILIATE", "Compre já!")).toBe(true);
    expect(missingAdDisclosure("PRODUCT_AFFILIATE", "Compre já! #publi")).toBe(false);
    expect(missingAdDisclosure("CARD_SPOTLIGHT", "Carta do dia")).toBe(false);
  });

  it("Discord: sem webhook (ou com endereço que não é do Discord) não envia", async () => {
    delete process.env.DISCORD_WEBHOOK_URL;
    const post = { id: "p1", title: "T", caption: "L", imageUrl: null, type: "CARD_SPOTLIGHT" };
    expect(await sendDiscordSocialNotification(post, "https://anaheimhub.com")).toBeNull();
    process.env.DISCORD_WEBHOOK_URL = "https://exemplo.com/webhook";
    expect(await sendDiscordSocialNotification(post, "https://anaheimhub.com")).toBeNull();
    delete process.env.DISCORD_WEBHOOK_URL;
  });

  describe("publishApprovedPost", () => {
    const basePost = { id: "p1", type: "CARD_SPOTLIGHT", status: "PUBLISHING", title: "T", caption: "Legenda #GCG", imageUrl: "/uploads/social/social-GD01-001-1.jpg", scheduledFor: null };
    const makePrisma = (claimCount = 1, post: Record<string, unknown> = basePost) =>
      ({
        socialMediaPost: {
          updateMany: vi.fn().mockResolvedValue({ count: claimCount }),
          findUniqueOrThrow: vi.fn().mockResolvedValue(post),
          update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ ...post, ...data })),
        },
      }) as any;

    it("não publica post que não está aprovado (ou já está publicando)", async () => {
      const publish = vi.fn();
      await expect(publishApprovedPost(makePrisma(0), "p1", { publish })).rejects.toThrow(/não está aprovado/);
      expect(publish).not.toHaveBeenCalled();
    });

    it("publica com a URL pública da imagem e marca PUBLISHED", async () => {
      const prisma = makePrisma();
      const publish = vi.fn().mockResolvedValue({ mediaId: "999", permalink: "https://www.instagram.com/p/x/" });
      const result = await publishApprovedPost(prisma, "p1", { publish, publicAppUrl: "https://anaheimhub.com/" });
      expect(publish.mock.calls[0][1].imageUrl).toBe("https://anaheimhub.com/uploads/social/social-GD01-001-1.jpg");
      expect(result.status).toBe("PUBLISHED");
      expect(result.instagramPostId).toBe("999");
    });

    it("PUBLIC_APP_URL apontando para localhost (como estava na VPS) não vira o link da arte: usa o domínio público", async () => {
      vi.stubEnv("PUBLIC_APP_URL", "http://localhost:8787");
      const prisma = makePrisma();
      const publish = vi.fn().mockResolvedValue({ mediaId: "999", permalink: "https://www.instagram.com/p/x/" });
      await publishApprovedPost(prisma, "p1", { publish });
      vi.unstubAllEnvs();
      expect(publish.mock.calls[0][1].imageUrl).toBe("https://anaheimhub.com/uploads/social/social-GD01-001-1.jpg");
    });

    it("sem imagem JPEG marca FAILED com o motivo", async () => {
      const prisma = makePrisma(1, { ...basePost, imageUrl: "/uploads/social/antigo.png" });
      const publish = vi.fn();
      const result = await publishApprovedPost(prisma, "p1", { publish });
      expect(publish).not.toHaveBeenCalled();
      expect(result.status).toBe("FAILED");
      expect(result.publishError).toContain("JPEG");
    });

    it("post com várias imagens sai como carrossel, na ordem, com a URL pública", async () => {
      const mediaUrls = ["/uploads/social/social-x-1.jpg", "/uploads/social/social-x-1-2.jpg", "/uploads/social/social-x-1-3.jpg"];
      const prisma = makePrisma(1, { ...basePost, imageUrl: mediaUrls[0], mediaUrls });
      const publish = vi.fn();
      const publishCarousel = vi.fn().mockResolvedValue({ mediaId: "777", permalink: null });
      const result = await publishApprovedPost(prisma, "p1", { publish, publishCarousel, publicAppUrl: "https://anaheimhub.com" });
      expect(publish).not.toHaveBeenCalled();
      expect(publishCarousel.mock.calls[0][1].imageUrls).toEqual(mediaUrls.map((u) => `https://anaheimhub.com${u}`));
      expect(result.status).toBe("PUBLISHED");
    });

    it("erro do Instagram marca FAILED e guarda a mensagem", async () => {
      const prisma = makePrisma();
      const publish = vi.fn().mockRejectedValue(new Error("Instagram (publicar): limite atingido"));
      const result = await publishApprovedPost(prisma, "p1", { publish });
      expect(result.status).toBe("FAILED");
      expect(result.publishError).toContain("limite atingido");
    });
  });

  describe("approveSocialPost / rejectSocialPost (painel e botões do Discord)", () => {
    const draft = { id: "p1", type: "CARD_SPOTLIGHT", status: "PENDING_APPROVAL", title: "T", caption: "Legenda #GCG", imageUrl: "/uploads/social/a.jpg", scheduledFor: null };
    const makePrisma = (post: Record<string, unknown> | null, rejectCount = 1) =>
      ({
        socialMediaPost: {
          findUnique: vi.fn().mockResolvedValue(post),
          update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ ...post, ...data })),
          updateMany: vi.fn().mockResolvedValue({ count: rejectCount }),
        },
      }) as any;

    it("rascunho manual aprovado com o Instagram configurado é publicado na hora", async () => {
      const publishNow = vi.fn(async () => ({ ...draft, status: "PUBLISHED" }) as any);
      const result = await approveSocialPost(makePrisma(draft), "p1", {}, { instagramReady: true, publishNow });
      expect(publishNow).toHaveBeenCalledWith("p1");
      expect(result).toMatchObject({ ok: true, post: { status: "PUBLISHED" } });
    });

    it("rascunho da agenda com horário futuro só fica APROVADO (sai no horário)", async () => {
      const scheduled = { ...draft, scheduledFor: new Date(Date.now() + 3600_000) };
      const publishNow = vi.fn();
      const result = await approveSocialPost(makePrisma(scheduled), "p1", {}, { instagramReady: true, publishNow });
      expect(publishNow).not.toHaveBeenCalled();
      expect(result.post.status).toBe("APPROVED");
    });

    it("post inexistente, já publicado ou com legenda inválida não é aprovado", async () => {
      await expect(approveSocialPost(makePrisma(null), "p1")).rejects.toMatchObject({ status: 404 });
      await expect(approveSocialPost(makePrisma({ ...draft, status: "PUBLISHED" }), "p1")).rejects.toMatchObject({ status: 409 });
      await expect(approveSocialPost(makePrisma({ ...draft, caption: " " }), "p1")).rejects.toMatchObject({ status: 400 });
    });

    it("descartar marca REJECTED com o motivo; post já publicado não é descartado", async () => {
      const prisma = makePrisma({ ...draft, status: "REJECTED" });
      const post = await rejectSocialPost(prisma, "p1", "Descartado pelo Discord");
      expect(prisma.socialMediaPost.updateMany.mock.calls[0][0].data).toMatchObject({ status: "REJECTED", rejectedReason: "Descartado pelo Discord" });
      expect(post?.status).toBe("REJECTED");
      await expect(rejectSocialPost(makePrisma(draft, 0), "p1", "x")).rejects.toMatchObject({ status: 409 });
    });
  });

  describe("aviso de rascunho pelo bot do Discord", () => {
    const post = { id: "p1", title: "T", caption: "L", imageUrl: "/uploads/social/a.jpg", type: "CARD_SPOTLIGHT" };
    const bot = { appId: "1563411550826401875", publicKey: "a".repeat(64), botToken: "tok", channelId: "1563339185967075389", approverIds: new Set(["106821025269813248"]) };

    it("com bot configurado, o rascunho vai pelo bot com os botões Aprovar/Descartar", async () => {
      const fetchFn = vi.fn().mockResolvedValue({ ok: true, status: 200 });
      expect(await sendDiscordSocialNotification(post, "https://anaheimhub.com", "draft", undefined, { bot, fetchFn })).toBe("sent");
      const [url, init] = fetchFn.mock.calls[0];
      expect(url).toContain("/channels/1563339185967075389/messages");
      const body = JSON.parse(init.body);
      expect(body.components[0].components.map((b: { custom_id: string }) => b.custom_id)).toEqual(["social:approve:p1", "social:reject:p1"]);
    });

    it("bot recusado (sem acesso ao canal): cai no webhook, sem botões — o aviso nunca se perde", async () => {
      vi.stubEnv("DISCORD_WEBHOOK_URL", "https://discord.com/api/webhooks/1/abc");
      const fetchFn = vi.fn().mockResolvedValueOnce({ ok: false, status: 403 }).mockResolvedValueOnce({ ok: true, status: 204 });
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      expect(await sendDiscordSocialNotification(post, "https://anaheimhub.com", "draft", undefined, { bot, fetchFn })).toBe("sent");
      warn.mockRestore();
      vi.unstubAllEnvs();
      expect(fetchFn.mock.calls[1][0]).toBe("https://discord.com/api/webhooks/1/abc");
      expect(JSON.parse(fetchFn.mock.calls[1][1].body).components).toBeUndefined();
    });
  });

  describe("carta do dia: rodízio de raridade e artes alternativas", () => {
    it("pickCardForPost com rodízio: tenta a raridade da vez e pula a que não tem carta", async () => {
      const count = vi.fn(async ({ where }: { where: { rarity?: { in: string[] } } }) => (where.rarity?.in.includes("Uncommon") ? 0 : 5));
      const prisma = { card: { count, findFirst: vi.fn().mockResolvedValue({ ...cardRow, rarity: "Common" }) }, socialMediaPost: { findMany: vi.fn().mockResolvedValue([]) } } as any;
      const card = await pickCardForPost(prisma, undefined, () => 0, { tiers: ["U", "C", "LR", "R"] });
      expect(count.mock.calls.map(([arg]) => arg.where.rarity?.in)).toEqual([["U", "Uncommon"], ["C", "Common"]]);
      expect(prisma.card.findFirst.mock.calls[0][0].where.rarity).toEqual({ in: ["C", "Common"] });
      expect(card.rarity).toBe("Common");
    });

    it("a imagem de 1000px é a preferida para o slide", async () => {
      const prisma = { card: { findFirst: vi.fn().mockResolvedValue({ ...cardRow, imageLargeUrl: "https://example.com/big.jpg" }) } } as any;
      expect((await pickCardForPost(prisma, "ST01-001")).imageUrl).toBe("https://example.com/big.jpg");
    });

    it("última raridade: vem da metadata do último post; post antigo sem metadata olha a carta", async () => {
      const withMeta = { socialMediaPost: { findFirst: vi.fn().mockResolvedValue({ cardCode: "GD01-001", metadata: '{"rarityTier":"R"}' }) }, card: { findFirst: vi.fn() } } as any;
      expect(await lastSpotlightTier(withMeta)).toBe("R");
      expect(withMeta.socialMediaPost.findFirst.mock.calls[0][0].where.status).toEqual({ not: "REJECTED" });
      const old = { socialMediaPost: { findFirst: vi.fn().mockResolvedValue({ cardCode: "GD02-099", metadata: "{}" }) }, card: { findFirst: vi.fn().mockResolvedValue({ rarity: "Common" }) } } as any;
      expect(await lastSpotlightTier(old)).toBe("C");
      const none = { socialMediaPost: { findFirst: vi.fn().mockResolvedValue(null) } } as any;
      expect(await lastSpotlightTier(none)).toBeNull();
    });

    it("artes alternativas: outras impressões com imagem própria, sem repetir a da carta, no máximo 9", async () => {
      const prints = [
        { code: "EB01-041", nameEn: "Strike Freedom (LR+)", rarity: "LR+", imageUrl: "https://cdn/2_400w.jpg", imageLargeUrl: "https://cdn/2.jpg", set: { code: "EB01" } },
        { code: "EB01-041", nameEn: "Strike Freedom", rarity: "LR", imageUrl: "https://cdn/1.jpg", imageLargeUrl: null, set: { code: "EB01" } },
        { code: "EB01-041", nameEn: "Strike Freedom", rarity: "LR++", imageUrl: "http://inseguro/3.jpg", imageLargeUrl: null, set: null },
        ...Array.from({ length: 12 }, (_, i) => ({ code: "EB01-041", nameEn: "Strike Freedom", rarity: "P", imageUrl: `https://cdn/p${i}.jpg`, imageLargeUrl: null, set: null })),
      ];
      const prisma = { card: { findMany: vi.fn().mockResolvedValue(prints) } } as any;
      const arts = await findAltArts(prisma, { code: "EB01-041", name: "Strike Freedom", color: "blue", type: "UNIT", imageUrl: "https://cdn/1.jpg", cardModelId: "m1" });
      expect(prisma.card.findMany.mock.calls[0][0].where).toMatchObject({ cardModelId: "m1", isPrimaryPrint: false });
      expect(arts[0]).toEqual({ code: "EB01-041", name: "Strike Freedom", rarity: "LR+", setCode: "EB01", imageUrl: "https://cdn/2.jpg" });
      expect(arts.some((a) => a.imageUrl === "https://cdn/1.jpg" || a.imageUrl.startsWith("http:"))).toBe(false);
      expect(arts).toHaveLength(9);
      expect(await findAltArts(prisma, { code: "X", name: "X", color: "blue", type: "UNIT" })).toEqual([]);
    });

    it("arte da carta mostra a raridade no selo e chama para arrastar quando há arte alternativa", () => {
      const html = buildSocialCardHtml({ code: "EB01-041", name: "Strike Freedom", color: "blue", type: "UNIT", rarity: "Legend Rare", altArtCount: 1 }, "1/2");
      expect(html).toContain("CARTA DO DIA • LR");
      expect(html).toContain("Arraste para ver a arte alternativa");
      expect(html).toContain("1/2");
    });

    it("Discord: carrossel avisa a quantidade e mostra as primeiras imagens em galeria", () => {
      const mediaUrls = ["/a.jpg", "/b.jpg", "/c.jpg", "/d.jpg", "/e.jpg"];
      const payload = buildDiscordSocialPayload({ id: "p1", title: "T", caption: "L", imageUrl: "/a.jpg", type: "CARD_SPOTLIGHT", mediaUrls }, "https://anaheimhub.com");
      expect(payload.embeds).toHaveLength(4);
      expect(payload.embeds.every((e) => e.url === "https://anaheimhub.com/admin#social")).toBe(true);
      expect(payload.embeds[1].image?.url).toBe("https://anaheimhub.com/b.jpg");
      expect(JSON.stringify(payload.embeds[0])).toContain("Carrossel com 5 imagens");
    });
  });

  describe("segunda: torneios do Brasil", () => {
    const monday = new Date("2026-10-26T15:00:00Z");
    const t = (id: string, date: string, store: string) => ({
      id,
      name: `Locals @ ${store} — ${date}`,
      organizer: store,
      country: "Brasil",
      city: "Curitiba",
      uf: "PR",
      season: null,
      tier: "SMALL_OFFICIAL" as const,
      sourceUrl: null,
      participantCount: 12,
      roundCount: null,
      date: `${date}T00:00:00.000Z`,
      updatedAt: date,
    });
    const e = (id: string, tournamentId: string, placement: number, player: string, archetype: string) => ({ id, tournamentId, playerName: player, placement, wins: 3, losses: 0, draws: 0, archetype, deckSnapshotId: null });
    const index = (tournaments: ReturnType<typeof t>[], entries: ReturnType<typeof e>[]) =>
      new VedaIndex({ tournaments, entries, snapshots: new Map(), cards: new Map(), seasons: [] });

    it("carrossel com capa, um slide por torneio e fechamento; legenda de reserva com os campeões", async () => {
      const ix = index([t("a", "2026-10-21", "Taverna Game House"), t("b", "2026-10-23", "Meruru")], [e("e1", "a", 1, "Johannjfs", "Blue / Green Nu Gundam"), e("e2", "b", 1, "Eddie", "Red / White MF")]);
      const draft = await draftTournamentReport({} as any, { scheduledFor: monday, apiKeyGemini: "" }, { index: ix });
      expect(draft.type).toBe("TOURNAMENT_REPORT");
      expect(draft.slides).toHaveLength(4);
      expect(draft.slides[0]).toContain("19/10 a 25/10");
      expect(draft.slides[1]).toContain("Taverna Game House");
      expect(draft.slides[1]).toContain("Johannjfs");
      expect(draft.slides[3]).toContain("Quem venceu");
      expect(draft.metadata).toMatchObject({ weekStart: "2026-10-19", weekEnd: "2026-10-25", tournamentIds: ["a", "b"] });
      expect(draft.content.fullCaption).toContain("Johannjfs com Blue / Green Nu Gundam");
      expect(captionProblems(draft.content.fullCaption)).toEqual([]);
    });

    it("dados do torneio vão escapados para o slide", async () => {
      const ix = index([t("a", "2026-10-21", "<script>loja</script>")], [e("e1", "a", 1, "<img src=x>", "Blue")]);
      const draft = await draftTournamentReport({} as any, { scheduledFor: monday, apiKeyGemini: "" }, { index: ix });
      expect(draft.slides.join("")).not.toContain("<script>loja");
      expect(draft.slides.join("")).not.toContain("<img src=x>");
    });

    it("semana sem torneio no Brasil: vira carta do dia e o aviso explica", async () => {
      const prisma = {
        socialMediaPost: { findFirst: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]) },
        card: { count: vi.fn().mockResolvedValue(1), findFirst: vi.fn().mockResolvedValue({ ...cardRow, rarity: "LR" }), findMany: vi.fn().mockResolvedValue([]) },
      } as any;
      const draft = await draftTournamentReport(prisma, { scheduledFor: monday, apiKeyGemini: "" }, { index: index([], []) });
      expect(draft.type).toBe("CARD_SPOTLIGHT");
      expect(draft.notice).toContain("Nenhum torneio no Brasil entre 19/10 e 25/10");
    });
  });
});
