import { Prisma, PrismaClient, SocialPostStatus, SocialPostType, type SocialMediaPost } from "@prisma/client";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { GoogleGenAI } from "@google/genai";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { getCardDefByCode, ALL_CARD_DEFS } from "../../src/modules/simulator/content/allCardDefs";
import { formatSlot, previousWeekRange } from "./socialSchedule";
import {
  articlePlainText,
  buildCardHashtags,
  buildWeeklyReport,
  dayMonth,
  FEATURED_DECK_NO_REPEAT_DAYS,
  formatStoreWithInstagram,
  pickFeaturedDeck,
  PRIMARY_RARITY_VALUES,
  rankTournamentCards,
  rarityAttemptOrder,
  rarityTier,
  reportTournamentCount,
  type FeaturedDeck,
  type RarityTier,
  type TournamentCardUsage,
  type WeeklyReport,
  type WeeklyTournament,
} from "./socialContent";
import {
  accentFor,
  altArtSlideHtml,
  articleCoverHtml,
  buildCardRevealReelHtml,
  buildCardStoryHtml,
  deckCoverHtml,
  deckKeyCardsHtml,
  deckListHtml,
  escapeHtml,
  renderArticleStory,
  renderCardRevealReel,
  renderCardStory,
  renderSlides,
  safeImageUrl,
  slideDocument,
  tournamentClosingHtml,
  tournamentCoverHtml,
  tournamentSlideHtml,
  type AltArt,
  type ArticleStoryInput,
  type ReelCardInput,
} from "./socialSlides";
import type { VedaIndex } from "../vedaCore";
import { postBotMessage, readDiscordBotConfig, socialButtons, type DiscordBotConfig } from "./discordBot";
import {
  countHashtags,
  INSTAGRAM_CAPTION_MAX,
  INSTAGRAM_CAROUSEL_MAX,
  INSTAGRAM_HASHTAG_MAX,
  normalizeInstagramAltText,
  normalizeInstagramCaption,
  publishInstagramCarousel,
  publishInstagramImage,
  publishInstagramReel,
  publishInstagramStory,
  readInstagramConfig,
} from "./instagramPublisher";

export { escapeHtml, buildCardRevealReelHtml, buildCardStoryHtml };

export interface GeneratePostInput {
  cardCode?: string;
  type?: SocialPostType;
  /** gera um Reel animado (MP4 9:16) revelando a carta com direcionamento para o post do feed */
  reel?: boolean;
  /** modo Spoiler da Semana (para cartas recém-reveladas de próximas coleções, mesmo com imagem menor) */
  spoiler?: boolean;
  /** se false, não gera o vídeo de Story companheiro junto do post de carta */
  story?: boolean;
  /** artigo do site (tipo ARTICLE); sem ele, usa o último publicado */
  articleId?: string;
  customTopic?: string;
  apiKeyGemini?: string;
  publicAppUrl?: string;
  /** horário em que o post deve ir ao ar (agenda seg/qua/sex) */
  scheduledFor?: Date;
  /** dia da agenda que gerou o rascunho (impede dois rascunhos no mesmo dia) */
  slotKey?: string;
}

export interface GeneratedPostContent {
  title: string;
  hook: string;
  strategy: string;
  cta: string;
  hashtags: string[];
  fullCaption: string;
}

export type SocialCard = {
  code: string;
  name: string;
  color: string;
  type: string;
  ap?: number;
  hp?: number;
  cost?: number;
  level?: number;
  text?: string;
  imageUrl?: string;
  rarity?: string;
  cardModelId?: string;
  /** quantas artes alternativas vão no carrossel (a legenda menciona) */
  altArtCount?: number;
  /** modo Spoiler da Semana (carta nova revelada) */
  isSpoiler?: boolean;
  /** endereço direto da carta no database (ex.: anaheimhub.com/cards/GD01-010) */
  cardUrl?: string;
  /** desempenho real da carta nas listas dos últimos torneios */
  tournamentUsage?: TournamentCardUsage | null;
};

const CARD_TYPE_PT: Record<string, string> = {
  UNIT: "Unidade",
  PILOT: "Piloto",
  COMMAND: "Comando",
  COMMAND_PILOT: "Comando / Piloto",
  BASE: "Base",
  RESOURCE: "Recurso",
  EX_BASE: "Base EX",
  EX_RESOURCE: "Recurso EX",
  UNIT_TOKEN: "Ficha de Unidade",
};

const COLOR_PT: Record<string, string> = { blue: "Azul", green: "Verde", red: "Vermelho", white: "Branco", purple: "Roxo", yellow: "Amarelo", black: "Preto" };
/** cor da carta em português para os prompts ("blue" → "Azul"); combinações ("Blue/White") viram "Azul e Branco" */
const colorPt = (color: string | null | undefined) =>
  String(color || "—")
    .split(/[/,|]/)
    .map((c) => COLOR_PT[c.trim().toLowerCase()] ?? c.trim())
    .join(" e ");

/** Abertura comum dos prompts de legenda (quem escreve e para quem). */
const SOCIAL_INTRO = `Você escreve os posts do Instagram do Anaheim Hub (anaheimhub.com), um portal brasileiro feito por fãs do Gundam Card Game (Bandai). O portal não é oficial nem ligado à Bandai.`;

/** A legenda é cortada no feed depois de ~125 caracteres ("… mais"): o gancho precisa caber ali. */
const HOOK_RULE = "A primeira linha da legenda é o gancho e cabe em até 125 caracteres (é o que aparece antes do \"mais\" no feed).";

/** Formato da resposta pedido a todas as IAs. */
const JSON_ANSWER = `Responda APENAS com JSON válido:
{"title": "...", "hook": "...", "strategy": "...", "cta": "...", "hashtags": ["..."], "fullCaption": "..."}`;

/** Código de carta aceito (ex.: GD01-001, ST03-012, GD02-001_p1). */
export const CARD_CODE_PATTERN = /^[A-Z]{1,4}\d{0,3}-\d{1,4}(?:_[A-Z0-9]{1,6})?$/i;

/** Só letras, números e hífen no nome do arquivo (o código vem do formulário do admin). */
export function safeFileStem(code: string): string {
  return code.replace(/[^A-Za-z0-9-]/g, "").slice(0, 24) || "carta";
}

const RECENT_POSTS_WINDOW = 60;

type CardRow = {
  code: string;
  nameEn: string;
  namePt?: string | null;
  color: string | null;
  cardType: string;
  ap: number | null;
  hp: number | null;
  cost: number | null;
  level?: number | null;
  effectEn: string | null;
  effectPt: string | null;
  imageUrl: string | null;
  imageLargeUrl?: string | null;
  rarity?: string | null;
  cardModelId?: string | null;
};

function fromCardRow(row: CardRow): SocialCard {
  return {
    code: row.code,
    // nomes de carta não são traduzidos (regra do portal): nome oficial em inglês
    name: row.nameEn,
    color: (row.color || "blue").toLowerCase(),
    type: row.cardType,
    ap: row.ap ?? undefined,
    hp: row.hp ?? undefined,
    cost: row.cost ?? undefined,
    level: row.level ?? undefined,
    // o texto explicativo vai em português quando existe (o post é para o público brasileiro). O banco guarda as
    // quebras como <br>, que saíam cruas na legenda; as palavras-chave entre < > (ex.: <Blocker>) ficam.
    text: (row.effectPt || row.effectEn || "").replace(/<br\s*\/?>/gi, "\n"),
    // a de 1000px quando existe: a de 400px fica borrada no slide de 1080
    imageUrl: row.imageLargeUrl || row.imageUrl || undefined,
    rarity: row.rarity || undefined,
    cardModelId: row.cardModelId || undefined,
  };
}

/** Raridade do último post de carta (não descartado), para o rodízio LR → R → U → C. */
export async function lastSpotlightTier(prisma: PrismaClient): Promise<RarityTier | null> {
  const last = await prisma.socialMediaPost
    .findFirst({
      where: { type: SocialPostType.CARD_SPOTLIGHT, cardCode: { not: null }, status: { not: SocialPostStatus.REJECTED } },
      orderBy: { createdAt: "desc" },
      select: { cardCode: true, metadata: true },
    })
    .catch(() => null);
  if (!last) return null;
  try {
    const tier = rarityTier((JSON.parse(last.metadata || "{}") as { rarityTier?: string }).rarityTier);
    if (tier) return tier;
  } catch {
    /* metadata antiga ou inválida: olha a carta */
  }
  const card = await prisma.card
    .findFirst({ where: { code: last.cardCode ?? "", deletedAt: null }, orderBy: { isPrimaryPrint: "desc" }, select: { rarity: true } })
    .catch(() => null);
  return rarityTier(card?.rarity);
}

/** Outras impressões da mesma carta com imagem própria (artes alternativas), até completar o carrossel. */
export async function findAltArts(prisma: PrismaClient, card: SocialCard): Promise<AltArt[]> {
  if (!card.cardModelId) return [];
  const prints = await prisma.card
    .findMany({
      where: { cardModelId: card.cardModelId, isPrimaryPrint: false, isActive: true, deletedAt: null, imageUrl: { not: null } },
      orderBy: { createdAt: "asc" },
      select: { code: true, nameEn: true, rarity: true, imageUrl: true, imageLargeUrl: true, set: { select: { code: true } } },
    })
    .catch(() => []);
  const seen = new Set([card.imageUrl]);
  const arts: AltArt[] = [];
  for (const p of prints) {
    const imageUrl = safeImageUrl(p.imageLargeUrl || p.imageUrl);
    if (!imageUrl || seen.has(imageUrl)) continue;
    seen.add(imageUrl);
    // a fonte põe a raridade no nome da impressão alternativa ("... (LR+)"); ela já aparece à parte no slide
    arts.push({ code: p.code, name: p.nameEn.replace(/\s*\((?:LR|SR|R|U|C|P)\+*\)\s*$/i, ""), rarity: p.rarity, setCode: p.set?.code ?? null, imageUrl });
  }
  return arts.slice(0, INSTAGRAM_CAROUSEL_MAX - 1);
}

/**
 * Seleciona a carta do post: a pedida, ou uma das cartas mais usadas nos últimos torneios filtrada pela raridade da
 * vez no rodízio (LR → R → U → C), sem repetir os últimos posts. Quando `opts.spoiler` é verdadeiro e não há código
 * explícito, seleciona a carta mais recentemente adicionada ao banco (mesmo com imagem menor). Sem torneios na base,
 * cai no sorteio por raridade no catálogo.
 */
export async function pickCardForPost(
  prisma: PrismaClient,
  preferredCode?: string,
  random: () => number = Math.random,
  opts: { tiers?: RarityTier[]; spoiler?: boolean; tournamentRank?: TournamentCardUsage[] } = {},
): Promise<SocialCard> {
  const attachMeta = (card: SocialCard): SocialCard => {
    const baseCode = card.code.replace(/_[A-Za-z0-9]+$/, "").toUpperCase();
    const usage = opts.tournamentRank?.find((u) => u.code.toUpperCase() === baseCode) ?? null;
    return {
      ...card,
      ...(opts.spoiler ? { isSpoiler: true } : {}),
      ...(usage ? { tournamentUsage: usage } : {}),
    };
  };

  if (preferredCode) {
    const code = preferredCode.trim().toUpperCase();
    if (!CARD_CODE_PATTERN.test(code)) throw new Error("Código de carta inválido.");
    const dbCard = (await prisma.card.findFirst({ where: { code, deletedAt: null }, orderBy: { isPrimaryPrint: "desc" } }).catch(() => null)) as CardRow | null;
    if (dbCard) return attachMeta(fromCardRow(dbCard));
    const def = getCardDefByCode(code);
    if (!def) throw new Error(`Carta ${code} não encontrada.`);
    return attachMeta({ code, name: def.nameEn || code, color: (def.color || "blue").toLowerCase(), type: def.cardType || "UNIT", ap: def.ap, hp: def.hp, cost: def.cost, text: "" });
  }

  const recentPosts = await prisma.socialMediaPost
    .findMany({ where: { cardCode: { not: null } }, select: { cardCode: true }, orderBy: { createdAt: "desc" }, take: RECENT_POSTS_WINDOW })
    .catch(() => [] as { cardCode: string | null }[]);
  const recentCodes = recentPosts.map((p) => p.cardCode).filter((c): c is string => Boolean(c));
  const recentSet = new Set(recentCodes.map((c) => c.toUpperCase()));

  if (opts.spoiler) {
    const spoilerCandidate = (await prisma.card
      .findFirst({
        where: {
          isActive: true,
          deletedAt: null,
          imageUrl: { not: null },
          NOT: [{ imageUrl: "" }],
          cardType: { in: ["UNIT", "PILOT", "COMMAND", "COMMAND_PILOT", "BASE"] },
          ...(recentCodes.length ? { code: { notIn: recentCodes } } : {}),
        },
        orderBy: [{ isPrimaryPrint: "desc" }, { createdAt: "desc" }],
      })
      .catch(() => null)) as CardRow | null;
    if (spoilerCandidate) return attachMeta(fromCardRow(spoilerCandidate));
  }

  const where: Prisma.CardWhereInput = {
    isActive: true,
    deletedAt: null,
    isPrimaryPrint: true,
    imageUrl: { not: null },
    NOT: [{ imageUrl: "" }],
    cardType: { in: ["UNIT", "PILOT", "COMMAND", "COMMAND_PILOT", "BASE"] },
    ...(recentCodes.length ? { code: { notIn: recentCodes } } : {}),
  };

  // Prioridade: cartas que mais apareceram nos últimos torneios dentro da raridade da vez (sem repetir posts recentes)
  const rankedPool = (opts.tournamentRank ?? []).filter((u) => !recentSet.has(u.code.toUpperCase()));
  if (rankedPool.length > 0 && typeof prisma.card?.findMany === "function") {
    const rankedCodes = rankedPool.map((u) => u.code);
    const rankOrder = new Map(rankedPool.map((u, idx) => [u.code.toUpperCase(), idx]));
    const tierAttempts: Prisma.CardWhereInput[] = opts.tiers?.length
      ? opts.tiers.map((tier) => ({ ...where, rarity: { in: PRIMARY_RARITY_VALUES[tier] }, code: { in: rankedCodes } }))
      : [{ ...where, code: { in: rankedCodes } }];

    for (const attempt of tierAttempts) {
      const matches = (await prisma.card.findMany({ where: attempt }).catch(() => [])) as CardRow[];
      if (!matches.length) continue;
      matches.sort((a, b) => (rankOrder.get(a.code.toUpperCase()) ?? 9999) - (rankOrder.get(b.code.toUpperCase()) ?? 9999));
      const topWindow = matches.slice(0, Math.min(3, matches.length));
      const chosen = topWindow[Math.floor(random() * topWindow.length)] ?? matches[0];
      return attachMeta(fromCardRow(chosen));
    }
  }

  const attempts: Prisma.CardWhereInput[] = opts.tiers?.length ? opts.tiers.map((tier) => ({ ...where, rarity: { in: PRIMARY_RARITY_VALUES[tier] } })) : [where];
  for (const attempt of attempts) {
    const total = await prisma.card.count({ where: attempt }).catch(() => 0);
    if (total <= 0) continue;
    const candidate = (await prisma.card
      .findFirst({ where: attempt, orderBy: { id: "asc" }, skip: Math.floor(random() * total) })
      .catch(() => null)) as CardRow | null;
    if (candidate) return attachMeta(fromCardRow(candidate));
  }

  // sem banco (ambiente local vazio): usa as definições do simulador
  const allCodes = Object.keys(ALL_CARD_DEFS);
  const eligible = allCodes.filter((c) => !recentSet.has(c.toUpperCase()));
  const chosenCode = eligible.length ? eligible[Math.floor(random() * eligible.length)] : allCodes[0] || "ST01-001";
  const def = ALL_CARD_DEFS[chosenCode];
  return attachMeta({ code: chosenCode, name: def?.nameEn || chosenCode, color: (def?.color || "blue").toLowerCase(), type: def?.cardType || "UNIT", ap: def?.ap, hp: def?.hp, cost: def?.cost, text: "" });
}

const DEFAULT_HASHTAGS = ["GundamCardGame", "GundamTCG", "GundamBrasil", "TCGBrasil", "CardGame", "AnaheimHub"];

/** Endereço direto exato da carta no database do portal (ex.: anaheimhub.com/cards/GD01-010). */
export const cardDatabaseUrl = (code: string, base = "https://anaheimhub.com") =>
  `${base.replace(/^https?:\/\//, "").replace(/\/+$/, "")}/cards/${encodeURIComponent(code.trim().toUpperCase())}`;

function buildCardUsageAnalysisLine(card: SocialCard): string {
  const u = card.tournamentUsage;
  if (card.isSpoiler) {
    return `\n🔍 Análise de Spoiler:\nCarta revelada para a nova coleção! Pelo custo ${card.cost ?? "—"}${card.level !== undefined ? ` (nível ${card.level})` : ""} na cor ${card.color}, vale avaliar como esse efeito encaixa na curva e quais sinergias abre no formato.\n`;
  }
  if (u && u.decks > 0) {
    const archText = u.archetypes.length ? ` principalmente em ${u.archetypes.join(", ")}` : "";
    const titlesText =
      u.wins > 0
        ? `, incluindo ${u.wins} ${u.wins === 1 ? "lista campeã" : "listas campeãs"}`
        : u.topDecks > 0
          ? `, com ${u.topDecks} ${u.topDecks === 1 ? "presença" : "presenças"} no top 25%`
          : "";
    return `\n🎯 Como vem sendo usada nos torneios:\nDestaque competitivo recente com presença em ${u.decks} ${u.decks === 1 ? "lista" : "listas"} (${u.tournaments} ${u.tournaments === 1 ? "torneio" : "torneios"}${titlesText}), usando em média ${u.avgCopies}x por deck${archText}.\n`;
  }
  return `\n🎯 Como é usada na partida:\nOpção de custo ${card.cost ?? "—"}${card.level !== undefined ? ` / nível ${card.level}` : ""} na cor ${card.color} para estabilizar a curva do deck e extrair valor do seu efeito no turno certo.\n`;
}

function templateContent(card: SocialCard): GeneratedPostContent {
  const isSpoiler = Boolean(card.isSpoiler);
  const headerLabel = isSpoiler ? "🚨 SPOILER DA SEMANA" : "💥 CARTA DA SEMANA";
  const titlePrefix = isSpoiler ? "Spoiler da Semana" : "Carta da Semana";
  const link = card.cardUrl || cardDatabaseUrl(card.code);
  const hashtags = buildCardHashtags(card, DEFAULT_HASHTAGS);
  const caption =
    `${headerLabel}: ${card.name} (${card.code})\n\n` +
    `📊 ${CARD_TYPE_PT[card.type] || card.type} · cor ${card.color}\n` +
    `• Custo: ${card.cost ?? "—"}${card.level !== undefined ? ` · Nível: ${card.level}` : ""}\n` +
    (card.ap !== undefined || card.hp !== undefined ? `• ${card.ap ?? "—"} AP / ${card.hp ?? "—"} HP\n` : "") +
    (card.text ? `\n📝 Efeito:\n${card.text}\n` : "") +
    buildCardUsageAnalysisLine(card) +
    (card.altArtCount ? `\n🎨 Arraste para o lado: ${card.altArtCount === 1 ? "tem 1 arte alternativa" : `são ${card.altArtCount} artes alternativas`} no carrossel.\n` : "") +
    `\n⚔️ ${isSpoiler ? "O que achou desse spoiler? Vai testar quando lançar?" : "Em que deck você colocaria essa carta?"} Conta aqui nos comentários!\n\n` +
    `🔗 Veja a carta no database: ${link} (link na bio)\n\n` +
    hashtags.map((h) => `#${h}`).join(" ");
  return {
    title: `${titlePrefix}: ${card.name} (${card.code})`,
    hook: isSpoiler ? `Novo spoiler revelado: ${card.name} (${card.code})!` : `Conheça ${card.name} (${card.code})!`,
    strategy: "",
    cta: `Veja a carta em ${link} (link na bio).`,
    hashtags,
    fullCaption: caption,
  };
}

// sobrecarga (503) e cota (429) do Gemini são por modelo e passageiras: antes de desistir, tenta os próximos da
// lista. GEMINI_SOCIAL_MODEL, se definido, vai na frente. (gemini-2.5-* não abre mais para contas novas: 404.)
export const GEMINI_SOCIAL_MODELS = ["gemini-3.8-flash", "gemini-flash-latest", "gemini-3.6-flash", "gemini-3.5-flash-lite"];

// último recurso antes do texto fixo, quando nenhum Gemini responde — só com ANTHROPIC_API_KEY na VPS
export const CLAUDE_SOCIAL_MODEL = "claude-opus-5-5";

const PostContentSchema = z.object({
  title: z.string(),
  hook: z.string(),
  strategy: z.string(),
  cta: z.string(),
  hashtags: z.array(z.string()),
  fullCaption: z.string(),
});

function geminiSocialModels(): string[] {
  const custom = process.env.GEMINI_SOCIAL_MODEL?.trim();
  return custom ? [custom, ...GEMINI_SOCIAL_MODELS.filter((model) => model !== custom)] : GEMINI_SOCIAL_MODELS;
}

function buildSocialPrompt(card: SocialCard, customTopic?: string): string {
  const link = card.cardUrl || cardDatabaseUrl(card.code);
  const u = card.tournamentUsage;
  const usageLine =
    u && u.decks > 0
      ? `Uso nos últimos torneios: presente em ${u.decks} listas de ${u.tournaments} torneios (média de ${u.avgCopies} cópias por deck)${u.wins ? `, com ${u.wins} título(s)` : ""}${u.topDecks ? ` e ${u.topDecks} presença(s) no top 25%` : ""}${u.archetypes.length ? `. Arquétipos onde mais joga: ${u.archetypes.join(", ")}` : ""}.`
      : null;
  const cardTags = buildCardHashtags(card, DEFAULT_HASHTAGS).slice(0, 12).map((h) => `#${h}`).join(" ");
  return `${SOCIAL_INTRO}
Escreva o post de "${card.isSpoiler ? "Spoiler da Semana" : "Carta da Semana"}" sobre esta carta, usando SOMENTE os dados abaixo:

Formato: ${card.isSpoiler ? "SPOILER DA SEMANA (carta nova revelada)" : "CARTA DA SEMANA (destaque competitivo)"}
Nome oficial (não traduza): ${card.name}
Código: ${card.code}
Tipo: ${CARD_TYPE_PT[card.type] || card.type}
Cor: ${colorPt(card.color)}
Custo: ${card.cost ?? "—"}${card.level !== undefined ? ` · Nível: ${card.level}` : ""}
AP / HP: ${card.ap ?? "—"} / ${card.hp ?? "—"}
Texto da carta: "${card.text || "sem efeito"}"
${card.rarity ? `Raridade: ${card.rarity}` : ""}
${usageLine ? `${usageLine}\n` : ""}${card.altArtCount ? `O post é um carrossel: depois da carta vêm ${card.altArtCount} arte(s) alternativa(s) dela. Convide a arrastar para ver e pergunte qual arte a pessoa prefere.\n` : ""}Link direto da carta no database: ${link}
Hashtags obrigatórias da carta e comunidade: ${cardTags}
${customTopic ? `Pedido do editor: "${customTopic.slice(0, 300)}"` : ""}

Regras:
1. Português do Brasil, tom de jogador experiente falando com outros jogadores.
2. Não traduza nomes de cartas, personagens nem palavras-chave do jogo (ex.: Blocker, Breach, Repair, First Strike).
3. Não invente números, porcentagens, resultados de torneio nem afirmações sobre o "meta". Se houver dados de uso nos torneios acima, cite-os na análise; se não estiver nos dados acima, não afirme.
4. Não diga que o post é oficial nem fale em nome da Bandai.
5. Estrutura: gancho de 1–2 linhas com nome e código (${card.code}); texto explicativo dos dados e efeito da carta; pequena análise de como ela é usada${card.isSpoiler ? " (potencial quando lançar)" : " nos decks/torneios"}; pergunta para os comentários; link direto da carta no database (${link}) e convite para testar no simulador do Anaheim Hub (link na bio); de 8 a 14 hashtags no final incluindo as de código e nome (${cardTags}).
6. Legenda completa com no máximo 1.800 caracteres.
7. ${HOOK_RULE}

${JSON_ANSWER}`;
}

function toPostContent(defaultTitle: string, parsed: Partial<GeneratedPostContent> | null | undefined): GeneratedPostContent | null {
  if (!parsed || typeof parsed.fullCaption !== "string" || !parsed.fullCaption.trim()) return null;
  return {
    title: String(parsed.title || defaultTitle).slice(0, 140),
    hook: String(parsed.hook || ""),
    strategy: String(parsed.strategy || ""),
    cta: String(parsed.cta || ""),
    hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags.map(String).slice(0, INSTAGRAM_HASHTAG_MAX) : [],
    fullCaption: normalizeInstagramCaption(parsed.fullCaption),
  };
}

// Sem limite, o SDK refaz cada chamada até 5 vezes com espera crescente (até 60 s) quando o modelo responde 503; com 4
// modelos na lista, a legenda chegava a levar minutos. Uma tentativa por modelo e 25 s de teto: a lista já é a reserva.
export const GEMINI_HTTP_OPTIONS = { timeout: 25_000, retryOptions: { attempts: 1 } };

async function generateWithGemini(defaultTitle: string, prompt: string, apiKey: string): Promise<{ content: GeneratedPostContent; model: string } | null> {
  const ai = new GoogleGenAI({ apiKey, httpOptions: GEMINI_HTTP_OPTIONS });
  for (const model of geminiSocialModels()) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: { responseMimeType: "application/json" },
      });
      const content = toPostContent(defaultTitle, JSON.parse(response.text?.trim() || "{}") as Partial<GeneratedPostContent>);
      if (content) return { content, model };
      console.warn(`[socialPublisher] Gemini (${model}) respondeu sem legenda, tentando o próximo modelo`);
    } catch (err) {
      console.warn(`[socialPublisher] Gemini (${model}) falhou na geração do texto:`, err instanceof Error ? err.message : err);
    }
  }
  return null;
}

async function generateWithClaude(defaultTitle: string, prompt: string, apiKey: string): Promise<{ content: GeneratedPostContent; model: string } | null> {
  try {
    const client = new Anthropic({ apiKey, timeout: 90_000, maxRetries: 1 });
    const response = await client.beta.messages.parse({
      model: CLAUDE_SOCIAL_MODEL,
      max_tokens: 8000,
      // recusa por engano do classificador de segurança: a API refaz no modelo indicado pela própria Anthropic
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      // legenda curta a partir de dados prontos: pouco raciocínio basta
      output_config: { effort: "low", format: betaZodOutputFormat(PostContentSchema) },
      messages: [{ role: "user", content: prompt }],
    });
    if (response.stop_reason === "refusal") {
      console.warn("[socialPublisher] Claude recusou a legenda:", response.stop_details?.category ?? "sem categoria");
      return null;
    }
    const content = toPostContent(defaultTitle, response.parsed_output);
    return content ? { content, model: CLAUDE_SOCIAL_MODEL } : null;
  } catch (err) {
    console.warn("[socialPublisher] Claude falhou na geração do texto:", err instanceof Error ? err.message : err);
    return null;
  }
}

export type CaptionGenerationMeta = {
  provider: "gemini" | "claude" | "fallback";
  model: string | null;
  prompt: string;
  customTopic?: string;
};

/**
 * Gera a legenda com auditoria: Gemini (vários modelos) → Claude (se houver ANTHROPIC_API_KEY) → modelo fixo.
 * Retorna também o provedor, modelo usado e o prompt para salvar no banco (metadata).
 */
export async function generateCaptionWithMeta(
  prompt: string,
  fallback: GeneratedPostContent,
  apiKey?: string,
  claudeApiKey?: string,
  customTopic?: string,
): Promise<{ content: GeneratedPostContent; meta: CaptionGenerationMeta }> {
  const geminiKey = (apiKey !== undefined ? apiKey : process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY || "").trim();
  const claudeKey = (claudeApiKey !== undefined ? claudeApiKey : process.env.ANTHROPIC_API_KEY || "").trim();

  if (geminiKey) {
    const fromGemini = await generateWithGemini(fallback.title, prompt, geminiKey);
    if (fromGemini) {
      return {
        content: fromGemini.content,
        meta: { provider: "gemini", model: fromGemini.model, prompt, customTopic: customTopic || undefined },
      };
    }
  }

  if (claudeKey) {
    if (geminiKey) console.warn("[socialPublisher] nenhum modelo do Gemini respondeu, tentando o Claude");
    const fromClaude = await generateWithClaude(fallback.title, prompt, claudeKey);
    if (fromClaude) {
      return {
        content: fromClaude.content,
        meta: { provider: "claude", model: fromClaude.model, prompt, customTopic: customTopic || undefined },
      };
    }
  }

  if (geminiKey || claudeKey) console.warn("[socialPublisher] nenhuma IA respondeu, usando o modelo fixo");
  return {
    content: fallback,
    meta: { provider: "fallback", model: null, prompt, customTopic: customTopic || undefined },
  };
}

/**
 * Gera a legenda: Gemini (vários modelos) → Claude (se houver ANTHROPIC_API_KEY) → texto fixo montado só com os
 * dados do post. As chaves podem vir por parâmetro (painel admin, testes); `undefined` lê do ambiente, "" desliga.
 */
export async function generateCaption(prompt: string, fallback: GeneratedPostContent, apiKey?: string, claudeApiKey?: string): Promise<GeneratedPostContent> {
  const result = await generateCaptionWithMeta(prompt, fallback, apiKey, claudeApiKey);
  return result.content;
}

/** Legenda da carta do dia (mesma cadeia de IAs de generateCaption). */
export async function generateSocialContentWithGemini(card: SocialCard, customTopic?: string, apiKey?: string, claudeApiKey?: string): Promise<GeneratedPostContent> {
  return generateCaption(buildSocialPrompt(card, customTopic), templateContent(card), apiKey, claudeApiKey);
}

/** HTML da arte 1080x1350 (4:5, formato retrato aceito pelo Instagram). Todo dado é escapado. */
export function buildSocialCardHtml(card: SocialCard, pager?: string): string {
  const accentColor = accentFor(card.color);
  const imageUrl = safeImageUrl(card.imageUrl);
  const typeLabel = CARD_TYPE_PT[card.type] || card.type;
  const effect = card.text?.trim() || "Sem efeito.";
  const tier = rarityTier(card.rarity);
  const badgePrefix = card.isSpoiler ? "SPOILER DA SEMANA" : "CARTA DA SEMANA";
  return slideDocument({
    badge: `${badgePrefix}${tier ? ` • ${tier}` : " • GCG"}`,
    accent: accentColor,
    pager,
    cta: card.altArtCount
      ? `Arraste para ver ${card.altArtCount === 1 ? "a arte alternativa" : `as ${card.altArtCount} artes alternativas`} →`
      : card.cardUrl
        ? `Veja a carta em ${card.cardUrl}`
        : undefined,
    css: `
  .content { display: flex; gap: 40px; align-items: center; flex: 1; }
  .card-frame { flex: 0 0 480px; height: 672px; background: rgba(255, 255, 255, 0.03); border: 2px solid rgba(255, 255, 255, 0.15); border-radius: 16px; display: flex; align-items: center; justify-content: center; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 30px rgba(56, 189, 248, 0.15); }
  .card-img { width: 100%; height: 100%; object-fit: contain; }
  .info-pane { flex: 1; display: flex; flex-direction: column; gap: 20px; min-width: 0; }
  .card-code { font-size: 20px; font-weight: 800; color: #94a3b8; letter-spacing: 0.1em; font-family: monospace; }
  .card-name { font-size: 42px; font-weight: 900; line-height: 1.1; color: #ffffff; text-transform: uppercase; overflow-wrap: anywhere; }
  .stats-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; margin: 10px 0; }
  .stat-box { background: rgba(15, 23, 42, 0.8); border: 1px solid rgba(255, 255, 255, 0.1); padding: 14px 18px; border-radius: 8px; }
  .stat-label { font-size: 13px; color: #94a3b8; text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em; }
  .stat-value { font-size: 26px; font-weight: 900; color: #ffffff; margin-top: 4px; }
  .stat-unit { font-size: 16px; color: #64748b; }
  .effect-box { background: rgba(15, 23, 42, 0.9); border-left: 4px solid ${accentColor}; border-radius: 4px; padding: 20px; font-size: 18px; line-height: 1.6; color: #cbd5e1; max-height: 300px; overflow: hidden; }
  .effect-text { white-space: pre-line; }
  .effect-label { font-size: 12px; font-weight: 800; text-transform: uppercase; color: ${accentColor}; margin-bottom: 6px; }`,
    body: `
  <div class="content">
    <div class="card-frame">
      ${imageUrl ? `<img class="card-img" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(card.name)}" />` : `<div style="text-align:center;padding:20px;"><div style="font-size:24px;font-weight:800;color:#38bdf8;">${escapeHtml(card.code)}</div><div style="font-size:16px;color:#94a3b8;margin-top:8px;">${escapeHtml(card.name)}</div></div>`}
    </div>
    <div class="info-pane">
      <div>
        <div class="card-code">${escapeHtml(card.code)} • ${escapeHtml(typeLabel.toUpperCase())}${card.rarity ? ` • ${escapeHtml(card.rarity.toUpperCase())}` : ""}</div>
        <h1 class="card-name">${escapeHtml(card.name)}</h1>
      </div>
      <div class="stats-grid">
        <div class="stat-box">
          <div class="stat-label">Custo${card.level !== undefined ? " / Nível" : ""}</div>
          <div class="stat-value">${escapeHtml(card.cost ?? "—")}${card.level !== undefined ? ` <span class="stat-unit">/</span> ${escapeHtml(card.level)}` : ""}</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">AP / HP</div>
          <div class="stat-value">${escapeHtml(card.ap ?? "—")} <span class="stat-unit">/</span> ${escapeHtml(card.hp ?? "—")}</div>
        </div>
      </div>
      <div class="effect-box">
        <div class="effect-label">Texto da carta</div>
        <div class="effect-text">${escapeHtml(effect)}</div>
      </div>
    </div>
  </div>`,
  });
}

/** Renderiza a arte 1080x1350 em JPEG (o único formato de imagem que a API do Instagram aceita). */
export async function renderSocialCardImage(card: SocialCard, outputPath: string): Promise<string> {
  const [ok] = await renderSlides([buildSocialCardHtml(card)], [outputPath]);
  if (!ok) throw new Error("A arte não renderizou.");
  return outputPath;
}

/** O navegador do Playwright está instalado neste servidor? */
export async function isSocialRendererAvailable(): Promise<boolean> {
  try {
    if (process.env.SOCIAL_CHROMIUM_PATH) return fs.existsSync(process.env.SOCIAL_CHROMIUM_PATH);
    const { chromium } = await import("playwright");
    return fs.existsSync(chromium.executablePath());
  } catch {
    return false;
  }
}

function socialUploadDir(): string {
  return path.join(path.resolve(process.cwd(), process.env.LOCAL_UPLOAD_DIR || "public/uploads"), "social");
}

export type PostStoryMeta = {
  storyVideoUrl: string | null;
  storyEnabled: boolean;
  storyTitle: string;
  storyPostId: string | null;
  storyError: string | null;
  isSpoiler: boolean;
  storyCard: ReelCardInput | null;
  storyArticle?: ArticleStoryInput | null;
};

/** Lê os metadados do Story companheiro atrelado a um post de carta ou artigo. */
export function readPostStoryMeta(post: { cardCode?: string | null; metadata?: string | null }): PostStoryMeta {
  try {
    const parsed = JSON.parse(post.metadata || "{}") as Record<string, unknown>;
    const isSpoiler = parsed.isSpoiler === true;
    const isArticle = Boolean(parsed.storyArticle || parsed.articleId);
    const defaultTitle = isArticle
      ? "NOVO ARTIGO NO SITE"
      : isSpoiler
        ? "SPOILER DA SEMANA"
        : "CARTA DA SEMANA";
    const storyVideoUrl = typeof parsed.storyVideoUrl === "string" && /\.mp4$/i.test(parsed.storyVideoUrl) ? parsed.storyVideoUrl : null;
    const storyEnabled = typeof parsed.storyEnabled === "boolean" ? parsed.storyEnabled : Boolean(storyVideoUrl);
    const storyTitle = typeof parsed.storyTitle === "string" && parsed.storyTitle.trim() ? parsed.storyTitle.trim() : defaultTitle;
    const storyPostId = typeof parsed.storyPostId === "string" && parsed.storyPostId ? parsed.storyPostId : null;
    const storyError = typeof parsed.storyError === "string" && parsed.storyError ? parsed.storyError : null;
    const storyCard = parsed.storyCard && typeof parsed.storyCard === "object" ? (parsed.storyCard as ReelCardInput) : null;
    const storyArticle = parsed.storyArticle && typeof parsed.storyArticle === "object" ? (parsed.storyArticle as ArticleStoryInput) : null;
    return { storyVideoUrl, storyEnabled, storyTitle, storyPostId, storyError, isSpoiler, storyCard, storyArticle };
  } catch {
    return { storyVideoUrl: null, storyEnabled: false, storyTitle: "CARTA DA SEMANA", storyPostId: null, storyError: null, isSpoiler: false, storyCard: null, storyArticle: null };
  }
}

/** Devolve a URL do vídeo MP4 do Story companheiro de um post, se houver. */
export function storyVideoUrlOf(post: { metadata?: string | null }): string | null {
  return readPostStoryMeta(post).storyVideoUrl;
}

/** Apaga imagens e vídeos de posts que não existem mais (excluídos no painel) com mais de 1 dia. */
export async function cleanupOrphanSocialImages(prisma: PrismaClient, now = new Date()): Promise<number> {
  const dir = socialUploadDir();
  let names: string[];
  try {
    names = await fs.promises.readdir(dir);
  } catch {
    return 0;
  }
  const candidates = names.filter((n) => /^social-[A-Za-z0-9-]+\.(?:jpg|png|mp4)$/.test(n));
  if (!candidates.length) return 0;
  const used = new Set(
    (await prisma.socialMediaPost.findMany({ select: { imageUrl: true, mediaUrls: true, metadata: true } })).flatMap((p) => [
      p.imageUrl,
      ...(p.mediaUrls ?? []),
      storyVideoUrlOf(p),
    ]),
  );
  let removed = 0;
  for (const name of candidates) {
    if (used.has(`/uploads/social/${name}`)) continue;
    const file = path.join(dir, name);
    const stat = await fs.promises.stat(file).catch(() => null);
    if (!stat || now.getTime() - stat.mtimeMs < 24 * 3600_000) continue;
    await fs.promises.unlink(file).catch(() => {});
    removed += 1;
  }
  return removed;
}

/** Identifica se um post na fila é um Reel (vídeo MP4 em mediaUrls). */
export function reelVideoUrlOf(post: { mediaUrls?: string[] | null; metadata?: string | null }): string | null {
  const fromUrls = (post.mediaUrls ?? []).find((u) => /\.mp4$/i.test(u));
  if (fromUrls) return fromUrls;
  try {
    const parsed = JSON.parse(post.metadata || "{}") as { videoUrl?: unknown };
    if (typeof parsed.videoUrl === "string" && /\.mp4$/i.test(parsed.videoUrl)) return parsed.videoUrl;
  } catch {
    /* metadata vazia ou inválida */
  }
  return null;
}

export type DiscordNoticeKind = "draft" | "approved" | "rejected" | "published" | "failed";
type DiscordNoticePost = { id: string; title: string | null; caption: string; imageUrl: string | null; type: string; scheduledFor?: Date | null; mediaUrls?: string[]; metadata?: string | null };

const DISCORD_HEADERS: Record<DiscordNoticeKind, string> = {
  draft: "📢 **Novo rascunho para o Instagram**\nRevise a arte e a legenda e aprove:",
  approved: "👍 **Post aprovado**",
  rejected: "🗑️ **Rascunho descartado**",
  published: "✅ **Post publicado no Instagram**",
  failed: "⚠️ **Falha ao publicar no Instagram**",
};

/** Mensagem do Discord (cabeçalho + embed com a arte, a legenda e o status) para cada etapa do post. */
export function buildDiscordSocialPayload(post: DiscordNoticePost, publicUrl: string, kind: DiscordNoticeKind = "draft", extra?: string) {
  const adminLink = `${publicUrl}/admin#social`;
  const absoluteImageUrl = post.imageUrl ? `${publicUrl}${post.imageUrl}` : undefined;
  const slot = post.scheduledFor ? ` · sai ${formatSlot(post.scheduledFor)} (Brasília)` : "";
  const status: Record<DiscordNoticeKind, string> = {
    draft: `🟡 Aguardando aprovação${slot}`,
    approved: `🟢 Aprovado${slot}`,
    rejected: "⚫ Descartado",
    published: "🟢 Publicado",
    failed: "🔴 Falhou",
  };
  const reelVideo = reelVideoUrlOf(post);
  const storyMeta = readPostStoryMeta(post);
  const slides = reelVideo ? 0 : (post.mediaUrls?.length ?? 0);
  // embeds com a mesma url viram galeria no Discord (até 4 imagens)
  const gallery = slides > 1 ? (post.mediaUrls ?? []).slice(1, 4).map((url) => ({ url: adminLink, image: { url: `${publicUrl}${url}` } })) : [];
  return {
    content: DISCORD_HEADERS[kind],
    embeds: [
      {
        title: post.title || "Post — Anaheim Hub",
        url: adminLink,
        description: (extra ? `${extra}\n\n` : "") + post.caption.slice(0, 1500) + (post.caption.length > 1500 ? "..." : ""),
        color: kind === "failed" ? 15680580 : kind === "rejected" ? 7041664 : 3718648,
        image: absoluteImageUrl ? { url: absoluteImageUrl } : undefined,
        fields: [
          { name: "Status", value: status[kind], inline: false },
          ...(reelVideo ? [{ name: "Formato", value: `🎬 Reel (vídeo MP4) · [Assistir prévia](${publicUrl}${reelVideo})`, inline: false }] : []),
          ...(slides > 1 ? [{ name: "Formato", value: `🖼️ Carrossel com ${slides} imagens`, inline: false }] : []),
          ...(!reelVideo && storyMeta.storyEnabled && storyMeta.storyVideoUrl
            ? [{ name: "Story companheiro", value: `📱 Story 9:16 sai junto ao aprovar · [Assistir prévia](${publicUrl}${storyMeta.storyVideoUrl})`, inline: false }]
            : []),
          { name: "Painel", value: `[Abrir no painel do admin](${adminLink})`, inline: false },
        ],
        footer: { text: "Anaheim Hub • posts com aprovação humana" },
        timestamp: new Date().toISOString(),
      },
      ...gallery,
    ],
  };
}

/**
 * Avisa o canal do Discord. Rascunho com bot configurado vai pelo bot, com os botões Aprovar/Descartar; o resto (e o
 * rascunho, se o bot falhar) vai pelo webhook. Sem webhook, o bot manda sem botões.
 */
export async function sendDiscordSocialNotification(
  post: DiscordNoticePost,
  publicUrl: string,
  kind: DiscordNoticeKind = "draft",
  extra?: string,
  deps: { bot?: DiscordBotConfig | null; fetchFn?: typeof fetch } = {},
): Promise<string | null> {
  const bot = deps.bot !== undefined ? deps.bot : readDiscordBotConfig();
  const fetchFn = deps.fetchFn ?? fetch;
  const payload = buildDiscordSocialPayload(post, publicUrl, kind, extra);

  if (bot && kind === "draft" && (await postBotMessage(bot, { ...payload, components: socialButtons(post.id) }, fetchFn))) return "sent";

  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (webhookUrl && /^https:\/\/(?:discord\.com|discordapp\.com)\/api\/webhooks\//.test(webhookUrl)) {
    try {
      const res = await fetchFn(webhookUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), redirect: "error" });
      if (res.ok) return "sent";
      console.warn("[socialPublisher] Discord respondeu", res.status);
    } catch (err) {
      console.error("[socialPublisher] Falha ao enviar notificação ao Discord:", err instanceof Error ? err.message : err);
    }
    return null;
  }
  if (bot && kind !== "draft" && (await postBotMessage(bot, payload, fetchFn))) return "sent";
  return null;
}

// O Instagram baixa a arte por esse endereço e o Discord linka o painel: um PUBLIC_APP_URL local (a VPS estava com
// "http://localhost:8787") não serve a ninguém de fora — vale o domínio público, como nos links de e-mail.
export function socialPublicAppUrl(): string {
  const env = (process.env.PUBLIC_APP_URL || "").trim();
  return env && !/localhost|127\.0\.0\.1/.test(env) ? env : "https://anaheimhub.com";
}

/** Conteúdo de um rascunho antes de gravar: legenda, slides (o primeiro é a capa) e dados para o painel. */
type DraftContent = {
  type: SocialPostType;
  content: GeneratedPostContent;
  cardCode?: string;
  /** prefixo do nome dos arquivos (só letras, números e hífen) */
  fileStem: string;
  slides: string[];
  /** textos alternativos (alt_text) de cada slide para SEO e acessibilidade no Instagram */
  altTexts?: string[];
  /** dados de renderização de Reel quando o rascunho é uma animação em vídeo MP4 */
  reelCard?: ReelCardInput;
  /** dados de renderização do Story companheiro (9:16 MP4) que sai junto com o post de carta */
  storyCard?: ReelCardInput;
  /** dados de renderização do Story companheiro (9:16 MP4) que sai junto com o post de artigo */
  storyArticle?: ArticleStoryInput;
  metadata?: Record<string, unknown>;
  /** motivo para o aviso no Discord (ex.: semana sem torneio virou carta da semana) */
  notice?: string;
};

/**
 * Desenha os slides em JPEG. Sem navegador no servidor (ou falha ao desenhar a capa) o post fica sem imagem, em vez de
 * apontar para um arquivo que não existe; slide do meio que falhar só sai do carrossel.
 */
async function renderDraftSlides(fileStem: string, slides: string[]): Promise<string[]> {
  const stamp = Date.now();
  const names = slides.map((_, i) => `social-${safeFileStem(fileStem)}-${stamp}${i ? `-${i + 1}` : ""}.jpg`);
  let done: boolean[];
  try {
    done = await renderSlides(slides, names.map((name) => path.join(socialUploadDir(), name)));
  } catch (err) {
    console.warn("[socialPublisher] Aviso ao renderizar imagem Playwright:", err instanceof Error ? err.message : err);
    return [];
  }
  if (!done[0]) return [];
  return names.filter((_, i) => done[i]).map((name) => `/uploads/social/${name}`);
}

/** Renderiza o vídeo MP4 (9:16) e o JPEG de capa para um rascunho de Reel. */
async function renderDraftReel(fileStem: string, card: ReelCardInput): Promise<{ coverUrl: string | null; videoUrl: string | null }> {
  const stamp = Date.now();
  const stem = safeFileStem(fileStem);
  const coverName = `social-${stem}-${stamp}-reel-cover.jpg`;
  const videoName = `social-${stem}-${stamp}-reel.mp4`;
  try {
    const { videoOk, coverOk } = await renderCardRevealReel(card, path.join(socialUploadDir(), videoName), path.join(socialUploadDir(), coverName));
    return {
      coverUrl: coverOk ? `/uploads/social/${coverName}` : null,
      videoUrl: videoOk ? `/uploads/social/${videoName}` : null,
    };
  } catch (err) {
    console.warn("[socialPublisher] Aviso ao renderizar Reel Playwright:", err instanceof Error ? err.message : err);
    return { coverUrl: null, videoUrl: null };
  }
}

/** Renderiza o vídeo MP4 (9:16, 5s) do Story companheiro da carta. */
async function renderDraftStory(fileStem: string, card: ReelCardInput): Promise<string | null> {
  const stamp = Date.now();
  const stem = safeFileStem(fileStem);
  const videoName = `social-${stem}-${stamp}.mp4`;
  try {
    const { videoOk } = await renderCardStory(card, path.join(socialUploadDir(), videoName));
    return videoOk ? `/uploads/social/${videoName}` : null;
  } catch (err) {
    console.warn("[socialPublisher] Aviso ao renderizar Story Playwright:", err instanceof Error ? err.message : err);
    return null;
  }
}

/** Renderiza o vídeo MP4 (9:16, 5s) do Story de notificação de um novo artigo publicado no portal. */
async function renderDraftArticleStory(fileStem: string, article: ArticleStoryInput): Promise<string | null> {
  const stamp = Date.now();
  const stem = safeFileStem(fileStem);
  const videoName = `social-${stem}-${stamp}.mp4`;
  try {
    const { videoOk } = await renderArticleStory(article, path.join(socialUploadDir(), videoName));
    return videoOk ? `/uploads/social/${videoName}` : null;
  } catch (err) {
    console.warn("[socialPublisher] Aviso ao renderizar Story de Artigo Playwright:", err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Garante que a legenda da carta contenha o link direto da carta no database (`anaheimhub.com/cards/CODIGO`)
 * e as hashtags de busca pelo código e nome da carta (ex.: `#GD01010`, `#GD01`, `#Gundam`).
 */
export function ensureCardLink(caption: string, card: { code: string; name: string }, link?: string): string {
  const cardUrl = link || cardDatabaseUrl(card.code, socialPublicAppUrl());
  let result = caption.trimEnd();
  if (!result.includes(cardUrl)) {
    const line = `🔗 Página da carta no database: ${cardUrl} (link na bio)`;
    const lines = result.split("\n");
    let tagStart = lines.length;
    while (tagStart > 0 && /^\s*#[\p{L}\p{N}_]+(?:\s+#[\p{L}\p{N}_]+)*\s*$/u.test(lines[tagStart - 1])) tagStart -= 1;
    if (tagStart === lines.length) {
      result = `${result}\n\n${line}`;
    } else {
      const body = lines.slice(0, tagStart).join("\n").trimEnd();
      result = `${body}\n\n${line}\n\n${lines.slice(tagStart).join("\n")}`;
    }
  }
  const codeTags = buildCardHashtags(card, []).slice(0, 3);
  const missingTags = codeTags.filter((tag) => !new RegExp(`#${tag}\\b`, "i").test(result));
  if (missingTags.length) {
    result = `${result.trimEnd()} ${missingTags.map((t) => `#${t}`).join(" ")}`;
  }
  return result;
}

/**
 * Carta da Semana (ou Spoiler da Semana): escolhe entre as cartas mais usadas nos últimos torneios filtradas pelo rodízio
 * de raridade LR → R → U → C (ou da expansão mais recente quando `spoiler: true`); artes alternativas viram carrossel
 * e já prepara o Story companheiro (9:16) para sair simultaneamente.
 */
export async function draftCardSpotlight(
  prisma: PrismaClient,
  input: GeneratePostInput = {},
  deps: { index?: VedaIndex; now?: Date } = {},
): Promise<DraftContent> {
  const now = deps.now ?? input.scheduledFor ?? new Date();
  const base = input.publicAppUrl || socialPublicAppUrl();
  const tiers = input.cardCode ? undefined : rarityAttemptOrder(await lastSpotlightTier(prisma));
  let tournamentRank: TournamentCardUsage[] | undefined;
  if (deps.index || (prisma as unknown as { tournament?: unknown }).tournament) {
    const ix = deps.index ?? (await (await import("../vedaService.ts")).getVedaIndex(prisma).catch(() => null));
    if (ix) tournamentRank = rankTournamentCards(ix, now);
  }
  const picked = await pickCardForPost(prisma, input.cardCode, Math.random, {
    tiers,
    spoiler: input.spoiler,
    tournamentRank,
  });
  const altArts = await findAltArts(prisma, picked);
  const cardUrl = cardDatabaseUrl(picked.code, base);
  const isSpoiler = Boolean(input.spoiler || picked.isSpoiler);
  const card: SocialCard = { ...picked, altArtCount: altArts.length, isSpoiler, cardUrl };
  const total = altArts.length + 1;
  const pager = (i: number) => (total > 1 ? `${i}/${total}` : undefined);
  const accent = accentFor(card.color);
  const typeLabel = CARD_TYPE_PT[card.type] || card.type;
  const mainAlt = `${isSpoiler ? "Spoiler da Semana" : "Carta da Semana"} Gundam Card Game ${card.code} ${card.name} (${typeLabel}, cor ${card.color}, custo ${card.cost ?? "—"}, ${card.ap ?? "—"} AP, ${card.hp ?? "—"} HP) — efeito e análise em português no Anaheim Hub`;
  const altTexts = [
    mainAlt,
    ...altArts.map((art) => `Arte alternativa da carta ${art.name} (${art.code}${art.rarity ? `, raridade ${art.rarity}` : ""}) de Gundam Card Game no Anaheim Hub`),
  ];
  const prompt = buildSocialPrompt(card, input.customTopic);
  const { content: generated, meta } = await generateCaptionWithMeta(prompt, templateContent(card), input.apiKeyGemini, undefined, input.customTopic);
  const storyTitle = isSpoiler ? "SPOILER DA SEMANA" : "CARTA DA SEMANA";
  const storyCard: ReelCardInput | undefined =
    input.story === false
      ? undefined
      : {
          code: card.code,
          name: card.name,
          color: card.color,
          typeLabel,
          rarity: rarityTier(card.rarity) ?? card.rarity ?? "GCG",
          cost: card.cost ?? null,
          level: card.level ?? null,
          ap: card.ap ?? null,
          hp: card.hp ?? null,
          imageUrl: card.imageUrl ?? null,
          altArtCount: card.altArtCount ?? 0,
          isSpoiler,
          cardUrl,
          storyTitle,
        };
  return {
    type: SocialPostType.CARD_SPOTLIGHT,
    content: {
      ...generated,
      hashtags: buildCardHashtags(card, generated.hashtags),
      fullCaption: ensureCardLink(generated.fullCaption, card, cardUrl),
    },
    cardCode: card.code,
    fileStem: isSpoiler ? `${card.code}-spoiler` : card.code,
    slides: [buildSocialCardHtml(card, pager(1)), ...altArts.map((art, i) => altArtSlideHtml(art, accent, pager(i + 2)))],
    altTexts,
    storyCard,
    metadata: {
      rarityTier: rarityTier(card.rarity),
      isSpoiler,
      cardUrl,
      tournamentUsage: card.tournamentUsage ?? null,
      altArts: altArts.map((a) => ({ code: a.code, rarity: a.rarity, setCode: a.setCode })),
      altTexts,
      ...meta,
    },
  };
}

// ---------- Reel da Carta da Semana (animação 9:16 com direcionamento para o post do feed) ----------

const REEL_HASHTAGS = ["GundamCardGame", "GundamTCG", "GundamBrasil", "TCGBrasil", "GundamReels", "CardGame", "AnaheimHub"];

function cardReelTemplate(card: SocialCard): GeneratedPostContent {
  const typeLabel = CARD_TYPE_PT[card.type] || card.type;
  const headerLabel = card.isSpoiler ? "SPOILER DA SEMANA REVELADO" : "CARTA DA SEMANA REVELADA";
  const titlePrefix = card.isSpoiler ? "Reel Spoiler da Semana" : "Reel Carta da Semana";
  const cardUrl = card.cardUrl || cardDatabaseUrl(card.code, socialPublicAppUrl());
  const hashtags = buildCardHashtags(card, REEL_HASHTAGS);
  const caption =
    `🎬 ${headerLabel}: ${card.name} (${card.code})!\n\n` +
    `⚡ ${typeLabel} · cor ${card.color} · Custo ${card.cost ?? "—"}${card.level !== undefined ? ` / Nível ${card.level}` : ""}` +
    (card.ap !== undefined || card.hp !== undefined ? ` · ${card.ap ?? "—"} AP / ${card.hp ?? "—"} HP` : "") +
    `\n\n📖 Quer ler o efeito completo em português, a análise de uso${card.altArtCount ? ` e ver ${card.altArtCount === 1 ? "a arte alternativa" : `as ${card.altArtCount} artes alternativas`}` : ""}?` +
    `\n👉 Confira o post completo que está no perfil @anaheimhub!\n\n` +
    `💬 Essa carta entra no seu deck ou fica no fichário? Conta nos comentários!\n` +
    `🔗 Página da carta no database: ${cardUrl} (link na bio)\n\n` +
    hashtags.map((h) => `#${h}`).join(" ");
  return {
    title: `${titlePrefix}: ${card.name} (${card.code})`,
    hook: `${card.isSpoiler ? "Spoiler da Semana" : "Carta da Semana"} revelada: ${card.name} (${card.code})!`,
    strategy: "Direcionar do Reel para o post completo no feed e para a página da carta no database.",
    cta: `Veja a análise no perfil @anaheimhub e a carta em ${cardUrl}!`,
    hashtags,
    fullCaption: caption,
  };
}

function cardReelPrompt(card: SocialCard, customTopic?: string): string {
  const label = card.isSpoiler ? "Spoiler da Semana" : "Carta da Semana";
  const cardUrl = card.cardUrl || cardDatabaseUrl(card.code, socialPublicAppUrl());
  const codeTags = buildCardHashtags(card, []).slice(0, 3).map((h) => `#${h}`).join(", ");
  return `Você escreve a legenda de um Reel do Instagram do Anaheim Hub (anaheimhub.com), portal brasileiro feito por fãs do Gundam Card Game (Bandai). O portal não é oficial nem ligado à Bandai.
Este Reel é uma animação curta revelando a ${label} (${card.name} — ${card.code}) e tem como objetivo levar quem assistiu a abrir o post completo da carta no feed do perfil (@anaheimhub) e consultar a carta no database.

Dados da carta:
Nome oficial (não traduza): ${card.name}
Código: ${card.code}
Tipo: ${CARD_TYPE_PT[card.type] || card.type}
Cor: ${colorPt(card.color)}
Custo: ${card.cost ?? "—"}${card.level !== undefined ? ` · Nível: ${card.level}` : ""}
AP / HP: ${card.ap ?? "—"} / ${card.hp ?? "—"}
${card.rarity ? `Raridade: ${card.rarity}` : ""}
${card.altArtCount ? `Artes alternativas no post do feed: ${card.altArtCount}` : ""}
Link direto da carta no database: ${cardUrl}
${customTopic ? `Pedido do editor: "${customTopic.slice(0, 300)}"` : ""}

Estrutura obrigatória:
1. Gancho curto de 1–2 linhas anunciando a revelação da ${label} (${card.name} - ${card.code}).
2. Destaque rápido dos atributos (custo/nível e AP/HP), sem entregar toda a análise na legenda.
3. Chamada direta para o post do feed: convide a pessoa a entrar no perfil @anaheimhub e ver o post da ${label} com o efeito completo em português, análise de jogo${card.altArtCount ? ` e as ${card.altArtCount} arte(s) alternativa(s)` : ""}.
4. Link direto da carta no database: ${cardUrl} (link na bio) e uma pergunta rápida para gerar comentários.
5. De 8 a 12 hashtags no final (incluindo obrigatoriamente ${codeTags}), máximo de 1.200 caracteres.
${CAPTION_RULES}`;
}

/**
 * Gera o rascunho do Reel animado (MP4 9:16) da Carta da Semana / Spoiler da Semana.
 * Sem `cardCode` explícito, usa a carta do último post `CARD_SPOTLIGHT` para que o Reel revele exatamente a carta do post!
 */
export async function draftCardRevealReel(prisma: PrismaClient, input: GeneratePostInput = {}): Promise<DraftContent> {
  const base = input.publicAppUrl || socialPublicAppUrl();
  let targetCode = input.cardCode?.trim();
  let inheritedSpoiler = false;
  if (!targetCode) {
    const latestCardPost = await prisma.socialMediaPost
      .findFirst({
        where: { type: SocialPostType.CARD_SPOTLIGHT, cardCode: { not: null }, status: { not: SocialPostStatus.REJECTED } },
        orderBy: { createdAt: "desc" },
        select: { cardCode: true, metadata: true },
      })
      .catch(() => null);
    targetCode = latestCardPost?.cardCode ?? undefined;
    if (latestCardPost?.metadata) {
      try {
        inheritedSpoiler = (JSON.parse(latestCardPost.metadata) as { isSpoiler?: unknown }).isSpoiler === true;
      } catch {
        /* ignora */
      }
    }
  }
  const isSpoiler = input.spoiler !== undefined ? Boolean(input.spoiler) : inheritedSpoiler;
  const picked = await pickCardForPost(prisma, targetCode, Math.random, { spoiler: isSpoiler });
  const altArts = await findAltArts(prisma, picked);
  const cardUrl = cardDatabaseUrl(picked.code, base);
  const card: SocialCard = { ...picked, altArtCount: altArts.length, isSpoiler, cardUrl };
  const typeLabel = CARD_TYPE_PT[card.type] || card.type;
  const reelCard: ReelCardInput = {
    code: card.code,
    name: card.name,
    color: card.color,
    typeLabel,
    rarity: rarityTier(card.rarity) ?? card.rarity ?? "GCG",
    cost: card.cost ?? null,
    level: card.level ?? null,
    ap: card.ap ?? null,
    hp: card.hp ?? null,
    imageUrl: card.imageUrl ?? null,
    altArtCount: card.altArtCount ?? 0,
    isSpoiler,
    cardUrl,
  };
  const prompt = cardReelPrompt(card, input.customTopic);
  const { content: generated, meta } = await generateCaptionWithMeta(prompt, cardReelTemplate(card), input.apiKeyGemini, undefined, input.customTopic);
  return {
    type: SocialPostType.CARD_SPOTLIGHT,
    content: {
      ...generated,
      hashtags: buildCardHashtags(card, generated.hashtags),
      fullCaption: ensureCardLink(generated.fullCaption, card, cardUrl),
    },
    cardCode: card.code,
    fileStem: `${card.code}-reel`,
    slides: [],
    reelCard,
    metadata: {
      mediaKind: "REEL",
      isSpoiler,
      cardUrl,
      rarityTier: rarityTier(card.rarity),
      altArtCount: altArts.length,
      ...meta,
    },
  };
}

const TOURNAMENT_HASHTAGS = ["GundamCardGame", "GundamTCG", "GundamBrasil", "TCGBrasil", "TorneioGundam", "AnaheimHub"];

/** Regras comuns a todos os prompts de legenda. */
const CAPTION_RULES = `Regras:
1. Português do Brasil, tom de jogador experiente falando com outros jogadores.
2. Não traduza nomes de cartas, arquétipos, personagens nem palavras-chave do jogo.
3. Use SOMENTE os dados acima. Não invente números, resultados, jogadores, lojas nem afirmações sobre o "meta".
4. Nomes de jogadores e lojas exatamente como estão nos dados (quando a loja tiver @arroba nos dados, mantenha o @arroba junto do nome da loja para mencioná-la).
5. Não diga que o post é oficial nem fale em nome da Bandai.
6. Legenda completa com no máximo 1.800 caracteres, de 8 a 12 hashtags no final.
7. Não cite números iguais a zero nem copie nomes de campos dos dados (escreva em português corrido).
8. ${HOOK_RULE}

${JSON_ANSWER}`;

const placeOf = (t: WeeklyTournament) => [t.city ? `${t.city}${t.uf ? `-${t.uf}` : ""}` : null, dayMonth(t.date)].filter(Boolean).join(", ");
const championOf = (t: WeeklyTournament) => t.top.find((p) => p.placement === 1) ?? null;

function tournamentTemplate(report: WeeklyReport): GeneratedPostContent {
  const count = reportTournamentCount(report);
  const lines = report.featured.map((t) => {
    const champ = championOf(t);
    const storeDisplay = formatStoreWithInstagram(t.store) || t.event;
    return `• ${storeDisplay} (${placeOf(t)}): ${champ ? `${champ.player}${champ.archetype ? ` com ${champ.archetype.name}` : ""}` : "campeão não informado"}`;
  });
  const top = report.champions[0];
  const caption =
    `🏆 TORNEIOS DO BRASIL · ${dayMonth(report.from)} a ${dayMonth(report.to)}\n\n` +
    `${count} ${count === 1 ? "torneio" : "torneios"}, ${report.totalPlayers} jogadores em ${report.cities.length} ${report.cities.length === 1 ? "cidade" : "cidades"}.\n\n` +
    `Campeões da semana:\n${lines.join("\n")}\n` +
    (report.others.length ? `…e mais ${report.others.length} ${report.others.length === 1 ? "torneio" : "torneios"} no site.\n` : "") +
    (top && top.wins > 1 ? `\nQuem mais venceu: ${top.archetype.name} (${top.wins}x).\n` : "") +
    `\n👇 Jogou algum desses? Conta como foi nos comentários!\n` +
    `🔗 Resultados completos e listas no Anaheim Hub (link na bio)\n\n` +
    TOURNAMENT_HASHTAGS.map((h) => `#${h}`).join(" ");
  return {
    title: `Torneios do Brasil: ${dayMonth(report.from)} a ${dayMonth(report.to)}`,
    hook: `${count} torneios no Brasil nesta semana.`,
    strategy: "",
    cta: "Resultados completos no Anaheim Hub (link na bio).",
    hashtags: TOURNAMENT_HASHTAGS,
    fullCaption: caption,
  };
}

function tournamentPrompt(report: WeeklyReport, customTopic?: string): string {
  const data = {
    semana: `${dayMonth(report.from)} a ${dayMonth(report.to)}`,
    torneios: reportTournamentCount(report),
    jogadores: report.totalPlayers,
    cidades: report.cities,
    resultados: [...report.featured, ...report.others].map((t) => ({
      evento: t.event,
      loja: formatStoreWithInstagram(t.store) || t.store,
      local: placeOf(t),
      jogadores: t.players,
      top: t.top.map((p) => ({ colocacao: p.placement, jogador: p.player, arquetipo: p.archetype?.name ?? null, campanha: p.record })),
    })),
    arquetiposCampeoes: report.champions.map((c) => ({ arquetipo: c.archetype.name, vitorias: c.wins })),
  };
  return `${SOCIAL_INTRO}
Escreva o post de segunda-feira com os torneios do Brasil da semana passada. O post é um carrossel: capa, um slide por torneio com o top 4 e um resumo. Dados (JSON):

${JSON.stringify(data, null, 1)}
${customTopic ? `Pedido do editor: "${customTopic.slice(0, 300)}"` : ""}

Estrutura: gancho de 1–2 linhas com o tamanho da semana; os campeões (jogador, loja com @arroba quando houver/cidade e arquétipo), um por linha; o arquétipo que mais venceu, se algum venceu mais de uma vez; uma pergunta para os comentários; convite para ver os resultados completos no Anaheim Hub (link na bio).
${CAPTION_RULES}`;
}

/** Segunda: carrossel dos torneios do Brasil da semana anterior. Semana vazia vira carta do dia, com aviso. */
export async function draftTournamentReport(prisma: PrismaClient, input: GeneratePostInput = {}, deps: { index?: VedaIndex; now?: Date } = {}): Promise<DraftContent> {
  const range = previousWeekRange(input.scheduledFor ?? deps.now ?? new Date());
  const index = deps.index ?? (await (await import("../vedaService.ts")).getVedaIndex(prisma));
  const report = buildWeeklyReport(index, range);
  if (!reportTournamentCount(report)) {
    const card = await draftCardSpotlight(prisma, { ...input, cardCode: undefined });
    return { ...card, notice: `ℹ️ Nenhum torneio no Brasil entre ${dayMonth(range.from)} e ${dayMonth(range.to)}: o post de hoje virou carta do dia.` };
  }
  const total = report.featured.length + 2;
  const pager = (i: number) => `${i}/${total}`;
  const count = reportTournamentCount(report);
  const altTexts = [
    `Resultados dos torneios de Gundam Card Game no Brasil (${dayMonth(report.from)} a ${dayMonth(report.to)}): ${count} torneios e ${report.totalPlayers} jogadores — Anaheim Hub`,
    ...report.featured.map((t) => {
      const champ = championOf(t);
      return `Top 4 do torneio de Gundam Card Game em ${t.store ?? t.event} (${t.city ?? "Brasil"}) — campeão ${champ?.player ?? "não informado"}${champ?.archetype ? ` com ${champ.archetype.name}` : ""} — Anaheim Hub`;
    }),
    `Resumo semanal do metagame brasileiro de Gundam Card Game (${dayMonth(report.from)} a ${dayMonth(report.to)}): arquétipos campeões e mais jogados — Anaheim Hub`,
  ];
  const prompt = tournamentPrompt(report, input.customTopic);
  const { content, meta } = await generateCaptionWithMeta(prompt, tournamentTemplate(report), input.apiKeyGemini, undefined, input.customTopic);
  return {
    type: SocialPostType.TOURNAMENT_REPORT,
    content,
    fileStem: `torneios-${range.from}`,
    slides: [tournamentCoverHtml(report, pager(1)), ...report.featured.map((t, i) => tournamentSlideHtml(t, pager(i + 2))), tournamentClosingHtml(report, pager(total))],
    altTexts,
    metadata: { weekStart: range.from, weekEnd: range.to, tournamentIds: [...report.featured, ...report.others].map((t) => t.id), altTexts, ...meta },
  };
}

const DECK_HASHTAGS = ["GundamCardGame", "GundamTCG", "GundamBrasil", "TCGBrasil", "Decklist", "AnaheimHub"];
const percent = (v: number) => `${Math.round(v * 100)}%`;
const deckPlacement = (p: number | null) => (p === 1 ? "campeã" : p ? `${p}º lugar` : "lista");

function deckTemplate(deck: FeaturedDeck): GeneratedPostContent {
  const storeOrTournament = formatStoreWithInstagram(deck.entry.store) || deck.entry.tournament;
  const where = [storeOrTournament, deck.entry.city, dayMonth(deck.entry.date)].filter(Boolean).join(", ");
  const key = deck.keyCards.slice(0, 5).map((c) => `• ${c.name} (${c.copies}x)`);
  const caption =
    `🔥 DECK EM DESTAQUE: ${deck.archetype.name}\n\n` +
    `Nos últimos 30 dias: ${deck.lists} listas em ${deck.tournaments} torneios, ${deck.wins} ${deck.wins === 1 ? "título" : "títulos"} e ${percent(deck.topRate)} das colocações no top 25%.\n\n` +
    `📋 A lista do carrossel é de ${deck.entry.player} (${deckPlacement(deck.entry.placement)}${deck.entry.record ? `, ${deck.entry.record}` : ""}) em ${where}.\n` +
    (key.length ? `\n🔑 Cartas-chave:\n${key.join("\n")}\n` : "") +
    `\n💬 Você jogaria com esse deck? Conta nos comentários!\n` +
    `🔗 Lista completa, deckbuilder e simulador no Anaheim Hub (link na bio)\n\n` +
    DECK_HASHTAGS.map((h) => `#${h}`).join(" ");
  return {
    title: `Deck em destaque: ${deck.archetype.name}`,
    hook: `${deck.archetype.name} é o deck de melhor desempenho do mês.`,
    strategy: "",
    cta: "Teste a lista no simulador do Anaheim Hub (link na bio).",
    hashtags: DECK_HASHTAGS,
    fullCaption: caption,
  };
}

function deckPrompt(deck: FeaturedDeck, customTopic?: string): string {
  // texto já pronto para a legenda: com JSON cru a IA copiava nome de campo ("taxaTop25"), data do banco
  // ("2026-10-11") e escrevia "foram 0 listas no Brasil"
  const storeMention = formatStoreWithInstagram(deck.entry.store) || deck.entry.store;
  const where = [deck.entry.tournament, storeMention, deck.entry.city ? `${deck.entry.city}${deck.entry.uf ? `-${deck.entry.uf}` : ""}` : null, deck.entry.date ? dayMonth(deck.entry.date) : null].filter(Boolean).join(", ");
  const lines = [
    `Arquétipo: ${deck.archetype.name}`,
    deck.archetype.colors.length ? `Cores: ${deck.archetype.colors.join(" e ")}` : null,
    `Período: ${dayMonth(deck.window.from)} a ${dayMonth(deck.window.to)}`,
    `Listas registradas: ${deck.lists}, em ${deck.tournaments} ${deck.tournaments === 1 ? "torneio" : "torneios"}`,
    deck.wins ? `Títulos: ${deck.wins}` : null,
    `Colocações no top 25% dos torneios: ${percent(deck.topRate)} das listas`,
    deck.brLists ? `Listas de torneios no Brasil: ${deck.brLists}` : null,
    `Lista mostrada no carrossel: ${deck.entry.player}, ${deckPlacement(deck.entry.placement)}${deck.entry.record ? ` (campanha ${deck.entry.record})` : ""}${where ? `, em ${where}` : ""}`,
    `Cartas-chave (nome, código, em quantas listas aparece, cópias mais comuns):`,
    ...deck.keyCards.map((c) => `- ${c.name} (${c.code}): ${percent(c.inclusion)} das listas, ${c.copies} ${c.copies === 1 ? "cópia" : "cópias"}`),
    `Lista completa:`,
    ...deck.cards.map((c) => `- ${c.quantity}x ${c.name} (${c.code})`),
  ].filter((line): line is string => line !== null);
  return `${SOCIAL_INTRO}
Escreva o post de sexta-feira "Deck em destaque": o arquétipo de melhor desempenho nos torneios dos últimos 30 dias. O post é um carrossel: capa com os números, a lista completa e as cartas-chave. Dados:

${lines.join("\n")}
${customTopic ? `Pedido do editor: "${customTopic.slice(0, 300)}"` : ""}

Estrutura: gancho de 1–2 linhas com o desempenho (use os números exatos); de quem é a lista e onde foi; 3 a 5 cartas-chave e o papel delas, só com base nos nomes e na presença (sem inventar efeitos); uma pergunta para os comentários; convite para abrir a lista e testar no simulador do Anaheim Hub (link na bio).
Escreva as datas como estão (dd/mm). Duas cartas com o mesmo nome são cartas diferentes: diferencie pelo código ou cite só uma.
${CAPTION_RULES}`;
}

/** Arquétipos destacados nas últimas 4 semanas (não repetem na sexta). */
async function recentFeaturedSlugs(prisma: PrismaClient, now: Date): Promise<string[]> {
  const posts = await prisma.socialMediaPost
    .findMany({
      where: { type: SocialPostType.DECK_FEATURE, status: { not: SocialPostStatus.REJECTED }, createdAt: { gte: new Date(now.getTime() - FEATURED_DECK_NO_REPEAT_DAYS * 24 * 3600_000) } },
      select: { metadata: true },
    })
    .catch(() => [] as { metadata: string | null }[]);
  return posts.flatMap((p) => {
    try {
      const slug = (JSON.parse(p.metadata || "{}") as { archetypeSlug?: unknown }).archetypeSlug;
      return typeof slug === "string" ? [slug] : [];
    } catch {
      return [];
    }
  });
}

/** Sexta: carrossel do arquétipo de melhor desempenho do mês, com uma lista real. Sem elegível, vira carta do dia. */
export async function draftDeckFeature(prisma: PrismaClient, input: GeneratePostInput = {}, deps: { index?: VedaIndex; now?: Date } = {}): Promise<DraftContent> {
  const now = deps.now ?? new Date();
  const index = deps.index ?? (await (await import("../vedaService.ts")).getVedaIndex(prisma));
  const deck = pickFeaturedDeck(index, now, await recentFeaturedSlugs(prisma, now));
  if (!deck) {
    const card = await draftCardSpotlight(prisma, { ...input, cardCode: undefined });
    return { ...card, notice: "ℹ️ Nenhum arquétipo com listas suficientes nos últimos 30 dias: o post de hoje virou carta do dia." };
  }
  const altTexts = [
    `Deck em destaque de Gundam Card Game: ${deck.archetype.name} — ${percent(deck.topRate)} no top 25% em ${deck.tournaments} torneios — Anaheim Hub`,
    `Decklist completa de ${deck.archetype.name} pilotada por ${deck.entry.player} no Gundam Card Game — Anaheim Hub`,
    `Cartas-chave do arquétipo ${deck.archetype.name} no metagame competitivo de Gundam Card Game — Anaheim Hub`,
  ];
  const prompt = deckPrompt(deck, input.customTopic);
  const { content, meta } = await generateCaptionWithMeta(prompt, deckTemplate(deck), input.apiKeyGemini, undefined, input.customTopic);
  return {
    type: SocialPostType.DECK_FEATURE,
    content,
    fileStem: `deck-${deck.archetype.slug}`.slice(0, 24),
    slides: [deckCoverHtml(deck, "1/3"), deckListHtml(deck, "2/3"), deckKeyCardsHtml(deck, "3/3")],
    altTexts,
    metadata: { archetypeSlug: deck.archetype.slug, archetype: deck.archetype.name, entryId: deck.entry.id, window: deck.window, altTexts, ...meta },
  };
}

const ARTICLE_HASHTAGS = ["GundamCardGame", "GundamTCG", "GundamBrasil", "TCGBrasil", "CardGame", "AnaheimHub"];
const ARTICLE_KIND_PT: Record<string, string> = { NEWS: "Notícia", PREVIEW: "Preview", REVIEW: "Análise", GUIDE: "Guia" };

type SocialArticle = { id: string; title: string; slug: string; excerpt: string | null; contentMd: string; coverImage: string | null; postType: string; status: string };

/** Capa enviada no painel fica em /uploads (caminho relativo); o navegador do slide precisa do endereço completo. */
function absoluteUrl(url: string | null, base: string): string {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  return url.startsWith("/") ? `${base.replace(/\/+$/, "")}${url}` : "";
}

const articleUrl = (article: SocialArticle, base: string) => `${base.replace(/^https?:\/\//, "").replace(/\/+$/, "")}/articles/${article.slug}`;

/** O endereço do artigo precisa estar na legenda; se a IA esquecer, entra antes do bloco final de hashtags. */
export function ensureArticleLink(caption: string, link: string): string {
  if (caption.includes(link)) return caption;
  const line = `📖 Leia completo em ${link} (link na bio)`;
  const lines = caption.trimEnd().split("\n");
  let tagStart = lines.length;
  while (tagStart > 0 && /^\s*#[\p{L}\p{N}_]+(?:\s+#[\p{L}\p{N}_]+)*\s*$/u.test(lines[tagStart - 1])) tagStart -= 1;
  if (tagStart === lines.length) return `${caption.trimEnd()}\n\n${line}`;
  const body = lines.slice(0, tagStart).join("\n").trimEnd();
  return `${body}\n\n${line}\n\n${lines.slice(tagStart).join("\n")}`;
}

function articleTemplate(article: SocialArticle, link: string): GeneratedPostContent {
  const summary = article.excerpt?.trim() || articlePlainText(article.contentMd, 600);
  const kind = ARTICLE_KIND_PT[article.postType] ?? "Artigo";
  return {
    title: article.title.slice(0, 140),
    hook: article.title,
    strategy: summary,
    cta: "Leia o artigo completo no Anaheim Hub (link na bio).",
    hashtags: ARTICLE_HASHTAGS,
    fullCaption:
      `📰 ${kind.toUpperCase()}: ${article.title}\n\n${summary}\n\n` +
      `📖 Leia completo em ${link} (link na bio)\n\n` +
      ARTICLE_HASHTAGS.map((h) => `#${h}`).join(" "),
  };
}

function articlePrompt(article: SocialArticle, link: string, customTopic?: string): string {
  return `${SOCIAL_INTRO}
Saiu um artigo novo no site. O post é a capa do artigo e a legenda é um resumo dele, para a pessoa querer ler o texto completo.

Título: ${article.title}
Tipo: ${ARTICLE_KIND_PT[article.postType] ?? "Artigo"}
${article.excerpt ? `Resumo escrito pelo autor: ${article.excerpt}\n` : ""}Endereço: ${link}

Texto do artigo:
"""
${articlePlainText(article.contentMd)}
"""
${customTopic ? `Pedido do editor: "${customTopic.slice(0, 300)}"` : ""}

Estrutura: gancho de 1–2 linhas com o assunto do artigo; resumo de 3 a 5 linhas com os pontos principais, sem entregar tudo; convite para ler o artigo completo com o endereço ${link} (link na bio); de 8 a 12 hashtags no final.
Regras:
1. Português do Brasil, tom de jogador experiente falando com outros jogadores.
2. Use SOMENTE o que está no texto do artigo. Não acrescente opiniões, números, cartas nem resultados que não estejam lá.
3. Não traduza nomes de cartas, personagens nem palavras-chave do jogo.
4. Não diga que o post é oficial nem fale em nome da Bandai.
5. Legenda completa com no máximo 1.800 caracteres.
6. ${HOOK_RULE}

${JSON_ANSWER}`;
}

/** Artigo publicado no site: a capa como imagem única e um resumo do texto na legenda. */
export async function draftArticlePost(prisma: PrismaClient, input: GeneratePostInput = {}): Promise<DraftContent> {
  const select = { id: true, title: true, slug: true, excerpt: true, contentMd: true, coverImage: true, postType: true, status: true } as const;
  const article = (input.articleId
    ? await prisma.post.findUnique({ where: { id: input.articleId }, select })
    : await prisma.post.findFirst({ where: { status: "PUBLISHED" }, orderBy: { publishedAt: "desc" }, select })) as SocialArticle | null;
  if (!article || article.status !== "PUBLISHED") throw new SocialActionError("Artigo não encontrado ou ainda não publicado.", 404);
  const base = input.publicAppUrl || socialPublicAppUrl();
  const link = articleUrl(article, base);
  const prompt = articlePrompt(article, link, input.customTopic);
  const { content, meta } = await generateCaptionWithMeta(prompt, articleTemplate(article, link), input.apiKeyGemini, undefined, input.customTopic);
  const kind = ARTICLE_KIND_PT[article.postType] ?? "Artigo";
  const altTexts = [`${kind}: ${article.title} — Portal brasileiro de Gundam Card Game Anaheim Hub`];
  const storyArticle: ArticleStoryInput = {
    title: article.title,
    kind,
    coverUrl: absoluteUrl(article.coverImage, base),
    articleUrl: link,
  };
  return {
    type: SocialPostType.ARTICLE,
    content: { ...content, fullCaption: ensureArticleLink(content.fullCaption, link) },
    fileStem: `artigo-${article.slug}`.slice(0, 24),
    slides: [articleCoverHtml({ title: article.title, kind, coverUrl: absoluteUrl(article.coverImage, base) })],
    altTexts,
    storyArticle,
    metadata: { articleId: article.id, articleSlug: article.slug, altTexts, storyArticle, ...meta },
  };
}

/** Chave do rascunho automático de um artigo (única no banco: publicar de novo não gera outro post). */
export const articleSlotKey = (articleId: string) => `artigo-${articleId}`;

/**
 * Artigo acabou de ser publicado: gera o rascunho do Instagram em segundo plano (vai para aprovação no painel e no
 * Discord). Devolve false se esse artigo já tem rascunho.
 */
export async function queueArticleSocialDraft(prisma: PrismaClient, articleId: string, create: typeof createSocialPostDraft = createSocialPostDraft): Promise<boolean> {
  const slotKey = articleSlotKey(articleId);
  const exists = await prisma.socialMediaPost.findUnique({ where: { slotKey }, select: { id: true } });
  if (exists) return false;
  void create(prisma, { type: SocialPostType.ARTICLE, articleId, slotKey }).catch((err: unknown) => {
    console.error("[socialPublisher] falha ao gerar o post do artigo:", err instanceof Error ? err.message : err);
  });
  return true;
}

async function buildDraft(prisma: PrismaClient, input: GeneratePostInput): Promise<DraftContent> {
  if (input.reel) return draftCardRevealReel(prisma, input);
  if (input.type === SocialPostType.ARTICLE) return draftArticlePost(prisma, input);
  if (input.type === SocialPostType.TOURNAMENT_REPORT) return draftTournamentReport(prisma, input);
  if (input.type === SocialPostType.DECK_FEATURE) return draftDeckFeature(prisma, input);
  return draftCardSpotlight(prisma, input);
}

/** Cria um rascunho completo no formato do tipo pedido: legenda + slides JPEG (ou Reel MP4) + Story companheiro + aviso no Discord. */
export async function createSocialPostDraft(prisma: PrismaClient, input: GeneratePostInput = {}) {
  const publicAppUrl = input.publicAppUrl || socialPublicAppUrl();
  const draft = await buildDraft(prisma, input);
  const { content } = draft;

  let imageUrl: string | null;
  let mediaUrls: string[];
  let extraMeta: Record<string, unknown> = {};

  if (draft.reelCard) {
    const rendered = await renderDraftReel(draft.fileStem, draft.reelCard);
    imageUrl = rendered.coverUrl;
    mediaUrls = rendered.videoUrl ? [rendered.videoUrl] : [];
    extraMeta = { mediaKind: "REEL", videoUrl: rendered.videoUrl };
  } else {
    const renderedSlides = await renderDraftSlides(draft.fileStem, draft.slides);
    imageUrl = renderedSlides[0] ?? null;
    mediaUrls = renderedSlides.length > 1 ? renderedSlides : [];
    if (draft.storyCard) {
      const storyVideoUrl = await renderDraftStory(`${draft.fileStem}-story`, draft.storyCard);
      const storyTitle = draft.storyCard.storyTitle || (draft.storyCard.isSpoiler ? "SPOILER DA SEMANA" : "CARTA DA SEMANA");
      extraMeta = {
        storyVideoUrl,
        storyEnabled: Boolean(storyVideoUrl),
        storyTitle,
        storyCard: draft.storyCard,
      };
    } else if (draft.storyArticle) {
      const storyVideoUrl = await renderDraftArticleStory(`${draft.fileStem}-story`, draft.storyArticle);
      const storyTitle = `NOVO ${draft.storyArticle.kind.toUpperCase()} NO SITE`;
      extraMeta = {
        storyVideoUrl,
        storyEnabled: Boolean(storyVideoUrl),
        storyTitle,
        storyArticle: draft.storyArticle,
      };
    }
  }

  const post = await prisma.socialMediaPost.create({
    data: {
      type: draft.type,
      status: SocialPostStatus.PENDING_APPROVAL,
      title: content.title,
      caption: normalizeInstagramCaption(content.fullCaption),
      cardCode: draft.cardCode ?? null,
      imageUrl,
      mediaUrls,
      scheduledFor: input.scheduledFor ?? null,
      slotKey: input.slotKey ?? null,
      metadata: JSON.stringify({
        hashtags: content.hashtags,
        hook: content.hook,
        strategy: content.strategy,
        cta: content.cta,
        ...draft.metadata,
        ...extraMeta,
      }),
    },
  });

  await sendDiscordSocialNotification(post, publicAppUrl, "draft", draft.notice);
  return post;
}

/**
 * Atualiza as configurações do Story companheiro de um post de carta (ligar/desligar `storyEnabled`, editar `storyTitle`
 * ou regerar o vídeo MP4 do Story com o título atualizado).
 */
export async function updatePostStorySettings(
  prisma: PrismaClient,
  id: string,
  opts: { storyEnabled?: boolean; storyTitle?: string; regenerate?: boolean } = {},
) {
  const existing = await prisma.socialMediaPost.findUnique({ where: { id } });
  if (!existing) throw new SocialActionError("Post não encontrado.", 404);
  if (!SOCIAL_EDITABLE.has(existing.status)) throw new SocialActionError("Post já publicado (ou publicando) não pode ser editado.", 409);

  let rawMeta: Record<string, unknown>;
  try {
    rawMeta = JSON.parse(existing.metadata || "{}") as Record<string, unknown>;
  } catch {
    rawMeta = {};
  }

  const currentStory = readPostStoryMeta(existing);
  const nextTitle =
    opts.storyTitle !== undefined && opts.storyTitle.trim()
      ? opts.storyTitle.trim().slice(0, 60)
      : currentStory.storyTitle;
  const titleChanged = opts.storyTitle !== undefined && nextTitle !== currentStory.storyTitle;
  const shouldRegenerate = Boolean(opts.regenerate || (titleChanged && currentStory.storyVideoUrl));

  let storyVideoUrl = currentStory.storyVideoUrl;
  let storyCard = currentStory.storyCard;
  let storyArticle = currentStory.storyArticle;

  if (shouldRegenerate || (opts.storyEnabled === true && !storyVideoUrl)) {
    const base = socialPublicAppUrl();
    if (rawMeta.storyArticle) {
      storyArticle = {
        ...(rawMeta.storyArticle as ArticleStoryInput),
        kind: (rawMeta.storyArticle as ArticleStoryInput).kind || "ARTIGO",
      };
      const rendered = await renderDraftArticleStory(`artigo-${existing.id}-story`, storyArticle);
      if (rendered) storyVideoUrl = rendered;
    } else {
      const isSpoiler = Boolean(rawMeta.isSpoiler);
      if (!storyCard) {
        const code = existing.cardCode || undefined;
        const picked = await pickCardForPost(prisma, code, Math.random, { spoiler: isSpoiler });
        const altArts = await findAltArts(prisma, picked);
        storyCard = {
          code: picked.code,
          name: picked.name,
          color: picked.color,
          typeLabel: CARD_TYPE_PT[picked.type] || picked.type,
          rarity: rarityTier(picked.rarity) ?? picked.rarity ?? "GCG",
          cost: picked.cost ?? null,
          level: picked.level ?? null,
          ap: picked.ap ?? null,
          hp: picked.hp ?? null,
          imageUrl: picked.imageUrl ?? null,
          altArtCount: altArts.length,
          isSpoiler,
          cardUrl: cardDatabaseUrl(picked.code, base),
          storyTitle: nextTitle,
        };
      } else {
        storyCard = { ...storyCard, storyTitle: nextTitle };
      }
      const rendered = await renderDraftStory(`${existing.cardCode || "carta"}-story`, storyCard);
      if (rendered) storyVideoUrl = rendered;
    }
  }

  const nextEnabled = opts.storyEnabled !== undefined ? opts.storyEnabled : Boolean(storyVideoUrl);
  const nextMeta = {
    ...rawMeta,
    storyTitle: nextTitle,
    storyEnabled: nextEnabled,
    storyVideoUrl,
    storyCard,
    storyArticle,
  };

  return prisma.socialMediaPost.update({
    where: { id },
    data: { metadata: JSON.stringify(nextMeta) },
  });
}

export type SocialGenerationState = {
  running: boolean;
  type: SocialPostType | null;
  startedAt: string | null;
  finishedAt: string | null;
  /** post criado pela última geração (ou null, se falhou) */
  postId: string | null;
  error: string | null;
};

const IDLE_GENERATION: SocialGenerationState = { running: false, type: null, startedAt: null, finishedAt: null, postId: null, error: null };
let generation: SocialGenerationState = { ...IDLE_GENERATION };

export function socialGenerationState(): SocialGenerationState {
  return { ...generation };
}

/**
 * Gera o rascunho em segundo plano, um de cada vez. A geração leva de 20 s a alguns minutos (slides + IA) e passava do
 * tempo do proxy: o navegador desistia, o servidor terminava mesmo assim, e um segundo clique criava um segundo post.
 * Agora a rota responde na hora e o painel acompanha pelo estado; clique repetido enquanto gera é recusado.
 */
export function startSocialPostDraft(prisma: PrismaClient, input: GeneratePostInput = {}, create: typeof createSocialPostDraft = createSocialPostDraft): boolean {
  if (generation.running) return false;
  generation = { ...IDLE_GENERATION, running: true, type: input.type ?? SocialPostType.CARD_SPOTLIGHT, startedAt: new Date().toISOString() };
  void create(prisma, input).then(
    (post) => {
      generation = { ...generation, running: false, finishedAt: new Date().toISOString(), postId: post.id };
    },
    (err: unknown) => {
      const message = (err instanceof Error ? err.message : String(err)).slice(0, 300) || "Falha ao gerar o post.";
      console.error("[socialPublisher] falha ao gerar o rascunho:", message);
      generation = { ...generation, running: false, finishedAt: new Date().toISOString(), error: message };
    },
  );
  return true;
}

/** Só para testes. */
export function resetSocialGenerationState(): void {
  generation = { ...IDLE_GENERATION };
}

/** Problemas que impedem publicar a legenda como está (mostrados no painel antes de aprovar). */
export function captionProblems(caption: string): string[] {
  const problems: string[] = [];
  if (!caption.trim()) problems.push("A legenda está vazia.");
  if (caption.length > INSTAGRAM_CAPTION_MAX) problems.push(`A legenda tem ${caption.length} caracteres (máximo ${INSTAGRAM_CAPTION_MAX}).`);
  const tags = countHashtags(caption);
  if (tags > INSTAGRAM_HASHTAG_MAX) problems.push(`A legenda tem ${tags} hashtags (máximo ${INSTAGRAM_HASHTAG_MAX}).`);
  return problems;
}

/** Post de afiliado precisa vir identificado como publicidade (Guia do CONAR, em vigor desde 1º/6/2026). */
export function missingAdDisclosure(type: SocialPostType | string, caption: string): boolean {
  return type === SocialPostType.PRODUCT_AFFILIATE && !/#(publi|publicidade|ad)\b|link de afiliado|publicidade/i.test(caption);
}

/** Extrai a lista de textos alternativos (alt_text) salvos na metadata do post ou monta um texto padrão para SEO. */
export function extractPostAltTexts(post: { title?: string | null; cardCode?: string | null; type?: string; metadata?: string | null }, slideCount = 1): string[] {
  try {
    const parsed = JSON.parse(post.metadata || "{}") as { altTexts?: unknown };
    if (Array.isArray(parsed.altTexts)) {
      const list = parsed.altTexts.map((a) => normalizeInstagramAltText(String(a ?? ""))).filter(Boolean);
      if (list.length) return list;
    }
  } catch {
    /* metadata antiga ou sem altTexts */
  }
  const base = normalizeInstagramAltText(
    post.title
      ? `${post.title} — Gundam Card Game Brasil no Anaheim Hub`
      : `Post de Gundam Card Game${post.cardCode ? ` (${post.cardCode})` : ""} no Anaheim Hub`,
  );
  return Array.from({ length: Math.max(1, slideCount) }, (_, i) => (slideCount > 1 ? `${base} (slide ${i + 1} de ${slideCount})` : base));
}

/** Trava em memória para evitar que o servidor processe a mesma publicação duas vezes simultaneamente. */
const inProgressPublishingIds = new Set<string>();

/**
 * Publica um post aprovado no Instagram. Pega o post de forma atômica (APPROVED/FAILED → PUBLISHING) para que
 * duas chamadas ao mesmo tempo não publiquem duas vezes.
 * Quando o post possui um Story companheiro habilitado (`storyEnabled` + `storyVideoUrl`), publica o feed e o Story
 * simultaneamente (em paralelo), reduzindo o tempo de espera pela metade e prevenindo timeouts.
 */
export async function publishApprovedPost(
  prisma: PrismaClient,
  postId: string,
  deps: {
    publish?: typeof publishInstagramImage;
    publishCarousel?: typeof publishInstagramCarousel;
    publishReel?: typeof publishInstagramReel;
    publishStory?: typeof publishInstagramStory;
    publicAppUrl?: string;
  } = {},
) {
  if (inProgressPublishingIds.has(postId)) {
    const existing = prisma.socialMediaPost.findUnique
      ? await prisma.socialMediaPost.findUnique({ where: { id: postId } })
      : null;
    if (existing) return existing;
  }

  const publicAppUrl = (deps.publicAppUrl || socialPublicAppUrl()).replace(/\/+$/, "");
  const claimed = await prisma.socialMediaPost.updateMany({
    where: { id: postId, status: { in: [SocialPostStatus.APPROVED, SocialPostStatus.FAILED] } },
    data: { status: SocialPostStatus.PUBLISHING, publishError: null },
  });
  if (claimed.count !== 1) {
    const current = prisma.socialMediaPost.findUnique
      ? await prisma.socialMediaPost.findUnique({ where: { id: postId } })
      : null;
    if (current?.status === SocialPostStatus.PUBLISHING) {
      return current;
    }
    throw new Error("O post não está aprovado (ou já está sendo publicado).");
  }

  inProgressPublishingIds.add(postId);
  const post = await prisma.socialMediaPost.findUniqueOrThrow({ where: { id: postId } });

  try {
    const problems = captionProblems(post.caption);
    if (problems.length) throw new Error(problems.join(" "));
    if (missingAdDisclosure(post.type, post.caption)) throw new Error("Post de afiliado precisa estar identificado como publicidade (ex.: #publi).");

    const reelVideo = reelVideoUrlOf(post);
    let result: { mediaId: string; permalink?: string | null };
    let updatedMetadata = post.metadata;
    if (reelVideo) {
      const coverUrl = post.imageUrl && /\.jpe?g$/i.test(post.imageUrl) ? `${publicAppUrl}${post.imageUrl}` : undefined;
      result = await (deps.publishReel ?? publishInstagramReel)(prisma, {
        videoUrl: `${publicAppUrl}${reelVideo}`,
        coverUrl,
        caption: post.caption,
      });
    } else {
      if (!post.imageUrl || !/\.jpe?g$/i.test(post.imageUrl)) throw new Error("O post não tem imagem JPEG; gere de novo para ter a arte.");
      const isCarousel = (post.mediaUrls ?? []).length > 1;
      const altTexts = extractPostAltTexts(post, isCarousel ? post.mediaUrls.length : 1);

      const storyMeta = readPostStoryMeta(post);
      const shouldPublishStory = Boolean(storyMeta.storyEnabled && storyMeta.storyVideoUrl && !storyMeta.storyPostId);

      const feedTask = isCarousel
        ? (deps.publishCarousel ?? publishInstagramCarousel)(prisma, {
            imageUrls: post.mediaUrls.map((url) => `${publicAppUrl}${url}`),
            caption: post.caption,
            altTexts,
          })
        : (deps.publish ?? publishInstagramImage)(prisma, {
            imageUrl: `${publicAppUrl}${post.imageUrl}`,
            caption: post.caption,
            altText: altTexts[0],
          });

      const storyTask = shouldPublishStory
        ? (deps.publishStory ?? publishInstagramStory)(prisma, {
            videoUrl: `${publicAppUrl}${storyMeta.storyVideoUrl}`,
          })
        : Promise.resolve(null);

      // Publica Feed e Story em paralelo para reduzir pela metade o tempo de espera da API do Instagram
      const [feedSettled, storySettled] = await Promise.allSettled([feedTask, storyTask]);

      if (feedSettled.status === "rejected") {
        throw feedSettled.reason;
      }
      result = feedSettled.value;

      if (shouldPublishStory) {
        let rawMeta: Record<string, unknown>;
        try {
          rawMeta = JSON.parse(post.metadata || "{}") as Record<string, unknown>;
        } catch {
          rawMeta = {};
        }
        if (storySettled.status === "fulfilled" && storySettled.value) {
          updatedMetadata = JSON.stringify({ ...rawMeta, storyPostId: storySettled.value.mediaId, storyError: null });
        } else if (storySettled.status === "rejected") {
          const storyMsg = (storySettled.reason instanceof Error ? storySettled.reason.message : String(storySettled.reason)).slice(0, 300);
          console.warn("[socialPublisher] Post publicado, mas o Story companheiro falhou:", storyMsg);
          updatedMetadata = JSON.stringify({ ...rawMeta, storyError: storyMsg });
        }
      }
    }

    const updated = await prisma.socialMediaPost.update({
      where: { id: postId },
      data: {
        status: SocialPostStatus.PUBLISHED,
        instagramPostId: result.mediaId,
        instagramPermalink: result.permalink,
        publishedAt: new Date(),
        publishError: null,
        ...(updatedMetadata !== post.metadata ? { metadata: updatedMetadata } : {}),
      },
    });
    const storyPublished = readPostStoryMeta(updated).storyPostId;
    const extraLinks = [
      result.permalink ? `🔗 ${result.permalink}` : null,
      storyPublished ? "📱 Story publicado junto!" : null,
    ]
      .filter(Boolean)
      .join(" · ");
    await sendDiscordSocialNotification(updated, publicAppUrl, "published", extraLinks || undefined);
    return updated;
  } catch (err) {
    const message = (err instanceof Error ? err.message : String(err)).slice(0, 500);
    const failed = await prisma.socialMediaPost.update({ where: { id: postId }, data: { status: SocialPostStatus.FAILED, publishError: message } });
    await sendDiscordSocialNotification(failed, publicAppUrl, "failed", message);
    return failed;
  } finally {
    inProgressPublishingIds.delete(postId);
  }
}

/** Erro de uma ação sobre o post, com o status HTTP que o painel devolve (o Discord mostra só a mensagem). */
export class SocialActionError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/** Estados em que o post ainda pode ser editado/aprovado (publicado ou publicando, não). */
export const SOCIAL_EDITABLE = new Set<SocialPostStatus>([SocialPostStatus.DRAFT, SocialPostStatus.PENDING_APPROVAL, SocialPostStatus.APPROVED, SocialPostStatus.FAILED, SocialPostStatus.REJECTED]);

/**
 * Aprova o post (painel e botão do Discord). Se já está no horário — rascunho manual ou horário da agenda passado — e
 * o Instagram está configurado, publica na hora; senão fica APROVADO e a agenda publica no horário.
 */
export async function approveSocialPost(
  prisma: PrismaClient,
  id: string,
  edits: { title?: string; caption?: string; storyEnabled?: boolean; storyTitle?: string } = {},
  deps: { instagramReady?: boolean; publishNow?: (id: string) => Promise<SocialMediaPost> } = {},
) {
  const existing = await prisma.socialMediaPost.findUnique({ where: { id } });
  if (!existing) throw new SocialActionError("Post não encontrado.", 404);
  if (existing.status === SocialPostStatus.PUBLISHING) {
    return { ok: true, post: existing, publishing: true };
  }
  if (!SOCIAL_EDITABLE.has(existing.status)) throw new SocialActionError("Este post já foi publicado.", 409);
  const caption = edits.caption ?? existing.caption;
  const problems = captionProblems(caption);
  if (problems.length) throw new SocialActionError(problems.join(" "), 400);
  if (missingAdDisclosure(existing.type, caption)) throw new SocialActionError("Post de afiliado precisa estar identificado como publicidade (ex.: #publi) — regra do CONAR.", 400);

  // Aplica ajustes de Story companheiro no mesmo passo atômico
  if (typeof edits.storyEnabled === "boolean" || typeof edits.storyTitle === "string") {
    await updatePostStorySettings(prisma, id, {
      storyEnabled: edits.storyEnabled,
      storyTitle: edits.storyTitle,
    });
  }

  const approved = await prisma.socialMediaPost.update({
    where: { id },
    data: { title: edits.title, caption, status: SocialPostStatus.APPROVED, approvedAt: new Date(), publishError: null, rejectedReason: null },
  });
  const due = !approved.scheduledFor || approved.scheduledFor.getTime() <= Date.now();
  const instagramReady = deps.instagramReady ?? Boolean(readInstagramConfig());
  if (due && instagramReady) {
    const post = await (deps.publishNow ?? ((postId: string) => publishApprovedPost(prisma, postId)))(id);
    return { ok: post.status === SocialPostStatus.PUBLISHED, post, publishing: post.status === SocialPostStatus.PUBLISHING };
  }
  return { ok: true, post: approved, publishing: false };
}

/** Descarta o rascunho (painel e botão do Discord). Post publicado ou publicando não é descartado. */
export async function rejectSocialPost(prisma: PrismaClient, id: string, reason: string) {
  const updated = await prisma.socialMediaPost.updateMany({
    where: { id, status: { notIn: [SocialPostStatus.PUBLISHED, SocialPostStatus.PUBLISHING] } },
    data: { status: SocialPostStatus.REJECTED, rejectedReason: reason || "Rejeitado pelo moderador" },
  });
  if (updated.count !== 1) throw new SocialActionError("Post não encontrado ou já publicado.", 409);
  return prisma.socialMediaPost.findUnique({ where: { id } });
}

/** Situação das integrações para o painel (só sim/não; nenhum segredo). */
export async function socialIntegrationStatus() {
  return {
    gemini: Boolean((process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY || "").trim()),
    discord: /^https:\/\/(?:discord\.com|discordapp\.com)\/api\/webhooks\//.test(process.env.DISCORD_WEBHOOK_URL || ""),
    discordButtons: Boolean(readDiscordBotConfig()),
    instagram: Boolean(readInstagramConfig()),
    renderer: await isSocialRendererAvailable(),
    scheduler: process.env.SOCIAL_SCHEDULER_ENABLED === "true",
  };
}
