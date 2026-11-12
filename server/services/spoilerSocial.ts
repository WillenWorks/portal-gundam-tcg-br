/* Post do Instagram do resumo de spoilers: capa + uma arte por carta (carrossel), um story por carta e a legenda
 * apontando para o artigo do dia. Chamado por createSocialPostDraft (tipo SPOILER_DIGEST). */
import { SocialPostType, type PrismaClient } from "@prisma/client";
import { escapeHtml, slideDocument, type ReelCardInput } from "./socialSlides.ts";
import { normalizeSpoilerCard, type SpoilerCardData } from "./spoilerExtract.ts";
import { DIGEST_MAX_SLIDE_CARDS, DIGEST_MAX_STORIES, setCodeOf } from "./spoilerService.ts";
import {
  buildSocialCardHtml,
  cardDatabaseUrl,
  ensureArticleLink,
  generateCaptionWithMeta,
  SocialActionError,
  socialPublicAppUrl,
  withHashtags,
  type DraftContent,
  type GeneratedPostContent,
  type GeneratePostInput,
} from "./socialPublisherService.ts";

const CARD_TYPE_PT: Record<string, string> = { UNIT: "Unidade", PILOT: "Piloto", COMMAND: "Comando", BASE: "Base", RESOURCE: "Recurso" };

export function spoilerHashtags(setCode: string | null): string[] {
  return ["GundamSpoiler", ...(setCode ? [setCode] : ["GundamTCG"]), "GundamCardGame", "GundamCardGameBR", "AnaheimHub"];
}

const absolute = (url: string, base: string) => (/^https?:\/\//.test(url) ? url : `${base.replace(/\/+$/, "")}${url.startsWith("/") ? "" : "/"}${url}`);

/** Capa do carrossel: título do dia e a lista das cartas. */
export function spoilerCoverHtml(opts: { setCode: string | null; dayLabel: string; cards: SpoilerCardData[]; extra: number }): string {
  const rows = opts.cards
    .map((c) => `<li><span class="code">${escapeHtml(c.code || "—")}</span><span class="name">${escapeHtml(c.nameEn)}</span><span class="type">${escapeHtml(CARD_TYPE_PT[c.cardType] ?? c.cardType)}</span></li>`)
    .join("");
  return slideDocument({
    badge: `SPOILERS${opts.setCode ? ` • ${opts.setCode}` : ""}`,
    accent: "#f59e0b",
    cta: "Arraste para ver as cartas →",
    css: `
  h1 { font-size: 72px; font-weight: 900; line-height: 1.02; text-transform: uppercase; }
  .sub { font-size: 26px; color: #94a3b8; margin: 18px 0 30px; }
  ul { list-style: none; display: flex; flex-direction: column; gap: 12px; }
  li { display: flex; gap: 18px; align-items: baseline; background: rgba(15,23,42,.8); border-left: 4px solid #f59e0b; padding: 14px 18px; border-radius: 4px; }
  .code { font-family: monospace; font-size: 20px; color: #f59e0b; font-weight: 800; min-width: 130px; }
  .name { font-size: 26px; font-weight: 800; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .type { font-size: 16px; color: #94a3b8; text-transform: uppercase; }`,
    body: `<h1>${opts.cards.length + opts.extra} ${opts.cards.length + opts.extra === 1 ? "carta nova" : "cartas novas"}</h1>
  <p class="sub">Reveladas em ${escapeHtml(opts.dayLabel)} · análise completa no site</p>
  <ul>${rows}</ul>${opts.extra ? `<p class="sub">+ ${opts.extra} no artigo</p>` : ""}`,
  });
}

function captionTemplate(cards: SpoilerCardData[], setCode: string | null, link: string, tags: string[]): GeneratedPostContent {
  const hook = `🚨 Spoilers${setCode ? ` de ${setCode}` : ""}: ${cards.length} ${cards.length === 1 ? "carta nova revelada" : "cartas novas reveladas"}!`;
  const list = cards.map((c) => `• ${c.nameEn}${c.code ? ` (${c.code})` : ""} — ${CARD_TYPE_PT[c.cardType] ?? c.cardType}`).join("\n");
  return {
    title: hook.replace(/^🚨\s*/, "").slice(0, 140),
    hook,
    strategy: list,
    cta: "Análise de cada carta no site (link na bio).",
    hashtags: tags,
    fullCaption: `${hook}\n\n${list}\n\nNo artigo: texto em português, cartas com os mesmos traits, sinergias e arquétipos em que cada uma pode entrar.\n📖 ${link} (link na bio)\n\nQual delas você mais quer jogar?\n\n${tags.map((t) => `#${t}`).join(" ")}`,
  };
}

/** Rascunho do post do resumo (o artigo já existe, em revisão; sai junto com o ✅). */
export async function draftSpoilerDigest(prisma: PrismaClient, input: GeneratePostInput): Promise<DraftContent> {
  if (!input.spoilerDigestId) throw new SocialActionError("Resumo de spoilers não informado.", 400);
  const digest = await prisma.spoilerDigest.findUnique({ where: { id: input.spoilerDigestId }, include: { captures: { where: { status: "DIGESTED" }, orderBy: { postedAt: "asc" } } } });
  if (!digest?.articleId) throw new SocialActionError("Resumo de spoilers sem artigo.", 404);
  const draftArticle = await prisma.post.findUnique({ where: { id: digest.articleId }, select: { slug: true, title: true } });
  if (!draftArticle) throw new SocialActionError("Artigo do resumo não encontrado.", 404);
  // versão nova de carta já publicada: o post aponta para o artigo que já existe (ele é atualizado ao aprovar)
  const updated = digest.updatesArticleId ? await prisma.post.findUnique({ where: { id: digest.updatesArticleId }, select: { slug: true, title: true } }) : null;
  const article = updated ?? draftArticle;

  const base = input.publicAppUrl || socialPublicAppUrl();
  const host = base.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  const link = `${host}/articles/${article.slug}`;
  const seen = new Set<string>();
  const cards = digest.captures
    .map((c) => ({ data: normalizeSpoilerCard({ isCard: true, ...(c.extracted as Record<string, unknown>) }), imageUrl: c.imageUrl, inCatalog: Boolean(c.cardModelId) }))
    .filter((c): c is { data: SpoilerCardData; imageUrl: string; inCatalog: boolean } => {
      if (!c.data) return false;
      const key = c.data.code || c.data.nameEn.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  if (!cards.length) throw new SocialActionError("Resumo de spoilers sem cartas.", 404);

  const setCode = digest.setCode ?? setCodeOf(cards[0].data.code);
  const tags = spoilerHashtags(setCode);
  const dayLabel = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" }).format(digest.captures[digest.captures.length - 1]?.postedAt ?? new Date());
  const slideCards = cards.slice(0, DIGEST_MAX_SLIDE_CARDS);
  const total = slideCards.length + 1;
  const cardUrl = (c: (typeof cards)[number]) => (c.inCatalog && c.data.code ? cardDatabaseUrl(c.data.code, base) : link);

  const slides = [
    spoilerCoverHtml({ setCode, dayLabel, cards: slideCards.map((c) => c.data), extra: cards.length - slideCards.length }),
    ...slideCards.map((c, i) =>
      buildSocialCardHtml(
        {
          code: c.data.code || "PRÉVIA",
          name: c.data.nameEn,
          color: (c.data.color || "blue").toLowerCase(),
          type: c.data.cardType,
          ap: c.data.ap ?? undefined,
          hp: c.data.hp ?? undefined,
          cost: c.data.cost ?? undefined,
          level: c.data.level ?? undefined,
          text: c.data.effectPt || c.data.effectEn || "",
          imageUrl: c.imageUrl ? absolute(c.imageUrl, base) : undefined,
          rarity: c.data.rarity ?? undefined,
          isSpoiler: true,
          cardUrl: cardUrl(c),
        },
        `${i + 2}/${total}`,
      ),
    ),
  ];
  const altTexts = [
    `Spoilers${setCode ? ` de ${setCode}` : ""} do Gundam Card Game revelados em ${dayLabel}: ${slideCards.map((c) => c.data.nameEn).join(", ")} — Anaheim Hub`,
    ...slideCards.map((c) => `Spoiler de Gundam Card Game: ${c.data.nameEn}${c.data.code ? ` (${c.data.code})` : ""}, ${CARD_TYPE_PT[c.data.cardType] ?? c.data.cardType} — texto em português no Anaheim Hub`),
  ];
  const storyCards: ReelCardInput[] = cards.slice(0, DIGEST_MAX_STORIES).map((c) => ({
    code: c.data.code || "PRÉVIA",
    name: c.data.nameEn,
    color: (c.data.color || "blue").toLowerCase(),
    typeLabel: CARD_TYPE_PT[c.data.cardType] ?? c.data.cardType,
    rarity: c.data.rarity || "GCG",
    cost: c.data.cost,
    level: c.data.level,
    ap: c.data.ap,
    hp: c.data.hp,
    imageUrl: c.imageUrl ? absolute(c.imageUrl, base) : null,
    isSpoiler: true,
    cardUrl: cardUrl(c),
    storyTitle: setCode ? `SPOILER ${setCode}` : "SPOILER",
  }));

  const translatedCards = cards.filter((c) => c.data.translated);
  const facts = cards.map((c) => ({ nome: c.data.nameEn, codigo: c.data.code, tipo: CARD_TYPE_PT[c.data.cardType], cor: c.data.color, nivel: c.data.level, custo: c.data.cost, ap: c.data.ap, hp: c.data.hp, traits: c.data.traits, efeito: c.data.effectPt || c.data.effectEn }));
  const prompt = `Você escreve os posts do Instagram do Anaheim Hub (anaheimhub.com), portal brasileiro feito por fãs do Gundam Card Game (Bandai). O portal não é oficial nem ligado à Bandai.
Saíram spoilers oficiais${setCode ? ` de ${setCode}` : ""} (${dayLabel}). O post é um carrossel com uma capa e uma arte por carta; o artigo do site tem a análise completa.${translatedCards.length ? "\nA carta foi revelada em japonês: os textos abaixo são tradução não oficial. Diga isso numa frase curta e que a versão em inglês pode mudar a redação." : ""}${updated ? "\nÉ a versão em inglês de carta que já postamos em japonês: diga que saiu o texto oficial em inglês." : ""}
Cartas: ${JSON.stringify(facts)}
Estrutura: gancho de 1 linha; uma linha por carta com nome, código e o que ela faz em poucas palavras; convite para ler a análise no artigo ${link} (link na bio); pergunta para os comentários; no final, exatamente estas 5 hashtags: ${tags.map((t) => `#${t}`).join(" ")}.
Regras: português do Brasil; não traduza nomes de cartas, personagens nem palavras-chave do jogo; use SOMENTE os dados acima, sem inventar números nem previsão de metagame; não fale em nome da Bandai; no máximo 1.800 caracteres; a primeira linha cabe em 125 caracteres.
Responda APENAS com JSON válido:
{"title": "...", "hook": "...", "strategy": "...", "cta": "...", "hashtags": ["..."], "fullCaption": "..."}`;
  const { content, meta } = await generateCaptionWithMeta(prompt, captionTemplate(cards.map((c) => c.data), setCode, link, tags), input.apiKeyGemini);

  const failed = await prisma.spoilerCapture.findMany({ where: { status: "FAILED", createdAt: { gte: new Date(Date.now() - 24 * 3600_000) } }, select: { imageUrl: true, error: true } });
  const notice = [
    translatedCards.length
      ? `🇯🇵 ${translatedCards.length === cards.length ? "Imagem em japonês" : `${translatedCards.length} carta(s) em japonês`}: nome, efeito, traits e Link em inglês e português são tradução da IA. Se preferir, descarte e espere a versão em inglês — ela gera uma proposta nova.`
      : null,
    updated
      ? `♻️ Versão nova de carta já publicada: aprovar atualiza o artigo "${updated.title}" (mesmo link) e os dados da carta no catálogo.`
      : `📰 Artigo "${draftArticle.title}" sai junto ao aprovar · ${base.replace(/\/+$/, "")}/admin#articles`,
    `🃏 ${cards.filter((c) => c.inCatalog).length} carta(s) entram no catálogo como prévia · 📱 ${storyCards.length} story(s)`,
    failed.length ? `⚠️ ${failed.length} imagem(ns) não lida(s) nas últimas 24 h: ${failed.slice(0, 3).map((f) => (f.imageUrl ? absolute(f.imageUrl, base) : f.error)).join(" · ")}` : null,
  ].filter(Boolean).join("\n");

  return {
    type: SocialPostType.SPOILER_DIGEST,
    content: { ...content, hashtags: tags, fullCaption: ensureArticleLink(withHashtags(content.fullCaption, tags), link) },
    cardCode: slideCards[0].data.code ?? undefined,
    fileStem: `spoilers-${(setCode || "gcg").toLowerCase()}`,
    slides,
    altTexts,
    storyCards,
    metadata: { spoilerDigestId: digest.id, digestArticleId: digest.articleId, digestArticleSlug: article.slug, digestLanguage: digest.language, isSpoiler: true, altTexts, ...meta },
    notice,
  };
}
