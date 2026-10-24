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
  buildWeeklyReport,
  dayMonth,
  PRIMARY_RARITY_VALUES,
  rarityAttemptOrder,
  rarityTier,
  reportTournamentCount,
  type RarityTier,
  type WeeklyReport,
  type WeeklyTournament,
} from "./socialContent";
import {
  accentFor,
  altArtSlideHtml,
  escapeHtml,
  renderSlides,
  safeImageUrl,
  slideDocument,
  tournamentClosingHtml,
  tournamentCoverHtml,
  tournamentSlideHtml,
  type AltArt,
} from "./socialSlides";
import type { VedaIndex } from "../vedaCore";
import { postBotMessage, readDiscordBotConfig, socialButtons, type DiscordBotConfig } from "./discordBot";
import {
  countHashtags,
  INSTAGRAM_CAPTION_MAX,
  INSTAGRAM_CAROUSEL_MAX,
  INSTAGRAM_HASHTAG_MAX,
  normalizeInstagramCaption,
  publishInstagramCarousel,
  publishInstagramImage,
  readInstagramConfig,
} from "./instagramPublisher";

export { escapeHtml };

export interface GeneratePostInput {
  cardCode?: string;
  type?: SocialPostType;
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
 * Seleciona a carta do post: a pedida, ou uma sorteada entre as impressões principais com imagem que não saíram nos
 * últimos posts. Com `tiers`, sorteia na primeira raridade da lista que tiver candidata (rodízio da carta do dia).
 */
export async function pickCardForPost(
  prisma: PrismaClient,
  preferredCode?: string,
  random: () => number = Math.random,
  opts: { tiers?: RarityTier[] } = {},
): Promise<SocialCard> {
  if (preferredCode) {
    const code = preferredCode.trim().toUpperCase();
    if (!CARD_CODE_PATTERN.test(code)) throw new Error("Código de carta inválido.");
    const dbCard = (await prisma.card.findFirst({ where: { code, deletedAt: null }, orderBy: { isPrimaryPrint: "desc" } }).catch(() => null)) as CardRow | null;
    if (dbCard) return fromCardRow(dbCard);
    const def = getCardDefByCode(code);
    if (!def) throw new Error(`Carta ${code} não encontrada.`);
    return { code, name: def.nameEn || code, color: (def.color || "blue").toLowerCase(), type: def.cardType || "UNIT", ap: def.ap, hp: def.hp, cost: def.cost, text: "" };
  }

  const recentPosts = await prisma.socialMediaPost
    .findMany({ where: { cardCode: { not: null } }, select: { cardCode: true }, orderBy: { createdAt: "desc" }, take: RECENT_POSTS_WINDOW })
    .catch(() => [] as { cardCode: string | null }[]);
  const recentCodes = recentPosts.map((p) => p.cardCode).filter((c): c is string => Boolean(c));

  const where: Prisma.CardWhereInput = {
    isActive: true,
    deletedAt: null,
    isPrimaryPrint: true,
    imageUrl: { not: null },
    NOT: [{ imageUrl: "" }],
    cardType: { in: ["UNIT", "PILOT", "COMMAND", "COMMAND_PILOT", "BASE"] },
    ...(recentCodes.length ? { code: { notIn: recentCodes } } : {}),
  };
  const attempts: Prisma.CardWhereInput[] = opts.tiers?.length ? opts.tiers.map((tier) => ({ ...where, rarity: { in: PRIMARY_RARITY_VALUES[tier] } })) : [where];
  for (const attempt of attempts) {
    const total = await prisma.card.count({ where: attempt }).catch(() => 0);
    if (total <= 0) continue;
    const candidate = (await prisma.card
      .findFirst({ where: attempt, orderBy: { id: "asc" }, skip: Math.floor(random() * total) })
      .catch(() => null)) as CardRow | null;
    if (candidate) return fromCardRow(candidate);
  }

  // sem banco (ambiente local vazio): usa as definições do simulador
  const recent = new Set(recentCodes);
  const allCodes = Object.keys(ALL_CARD_DEFS);
  const eligible = allCodes.filter((c) => !recent.has(c));
  const chosenCode = eligible.length ? eligible[Math.floor(random() * eligible.length)] : allCodes[0] || "ST01-001";
  const def = ALL_CARD_DEFS[chosenCode];
  return { code: chosenCode, name: def?.nameEn || chosenCode, color: (def?.color || "blue").toLowerCase(), type: def?.cardType || "UNIT", ap: def?.ap, hp: def?.hp, cost: def?.cost, text: "" };
}

const DEFAULT_HASHTAGS = ["GundamCardGame", "GundamTCG", "GundamBrasil", "TCGBrasil", "CardGame", "AnaheimHub"];

function templateContent(card: SocialCard): GeneratedPostContent {
  const caption =
    `💥 CARTA DO DIA: ${card.name} (${card.code})\n\n` +
    `📊 ${CARD_TYPE_PT[card.type] || card.type} · cor ${card.color}\n` +
    `• Custo: ${card.cost ?? "—"}${card.level !== undefined ? ` · Nível: ${card.level}` : ""}\n` +
    (card.ap !== undefined || card.hp !== undefined ? `• ${card.ap ?? "—"} AP / ${card.hp ?? "—"} HP\n` : "") +
    (card.text ? `\n📝 Efeito:\n${card.text}\n` : "") +
    (card.altArtCount ? `\n🎨 Arraste para o lado: ${card.altArtCount === 1 ? "tem 1 arte alternativa" : `são ${card.altArtCount} artes alternativas`} no carrossel.\n` : "") +
    `\n⚔️ Em que deck você colocaria essa carta? Conta aqui nos comentários!\n\n` +
    `🔗 Monte seu deck e teste no simulador do Anaheim Hub (link na bio)\n\n` +
    DEFAULT_HASHTAGS.map((h) => `#${h}`).join(" ");
  return {
    title: `Carta do Dia: ${card.name} (${card.code})`,
    hook: `Conheça ${card.name}!`,
    strategy: "",
    cta: "Monte seu deck no Anaheim Hub (link na bio).",
    hashtags: DEFAULT_HASHTAGS,
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
  return `Você escreve os posts do Instagram do Anaheim Hub (anaheimhub.com), um portal brasileiro feito por fãs do Gundam Card Game (Bandai). O portal não é oficial nem ligado à Bandai.
Escreva um post sobre esta carta, usando SOMENTE os dados abaixo:

Nome oficial (não traduza): ${card.name}
Código: ${card.code}
Tipo: ${card.type}
Cor: ${card.color}
Custo: ${card.cost ?? "—"}${card.level !== undefined ? ` · Nível: ${card.level}` : ""}
AP / HP: ${card.ap ?? "—"} / ${card.hp ?? "—"}
Texto da carta: "${card.text || "sem efeito"}"
${card.rarity ? `Raridade: ${card.rarity}` : ""}
${card.altArtCount ? `O post é um carrossel: depois da carta vêm ${card.altArtCount} arte(s) alternativa(s) dela. Convide a arrastar para ver e pergunte qual arte a pessoa prefere.` : ""}
${customTopic ? `Pedido do editor: "${customTopic.slice(0, 300)}"` : ""}

Regras:
1. Português do Brasil, tom de jogador experiente falando com outros jogadores.
2. Não traduza nomes de cartas, personagens nem palavras-chave do jogo (ex.: Blocker, Breach, Repair, First Strike).
3. Não invente números, porcentagens, resultados de torneio nem afirmações sobre o "meta". Se não estiver nos dados acima, não afirme.
4. Não diga que o post é oficial nem fale em nome da Bandai.
5. Estrutura: gancho de 1–2 linhas; o que a carta faz e quando jogá-la; uma pergunta para os comentários; convite para montar o deck e testar no simulador do Anaheim Hub (link na bio); de 8 a 12 hashtags no final.
6. Legenda completa com no máximo 1.800 caracteres.

Responda APENAS com JSON válido:
{"title": "...", "hook": "...", "strategy": "...", "cta": "...", "hashtags": ["..."], "fullCaption": "..."}`;
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

async function generateWithGemini(defaultTitle: string, prompt: string, apiKey: string): Promise<GeneratedPostContent | null> {
  const ai = new GoogleGenAI({ apiKey });
  for (const model of geminiSocialModels()) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: { responseMimeType: "application/json" },
      });
      const content = toPostContent(defaultTitle, JSON.parse(response.text?.trim() || "{}") as Partial<GeneratedPostContent>);
      if (content) return content;
      console.warn(`[socialPublisher] Gemini (${model}) respondeu sem legenda, tentando o próximo modelo`);
    } catch (err) {
      console.warn(`[socialPublisher] Gemini (${model}) falhou na geração do texto:`, err instanceof Error ? err.message : err);
    }
  }
  return null;
}

async function generateWithClaude(defaultTitle: string, prompt: string, apiKey: string): Promise<GeneratedPostContent | null> {
  try {
    const client = new Anthropic({ apiKey });
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
    return toPostContent(defaultTitle, response.parsed_output);
  } catch (err) {
    console.warn("[socialPublisher] Claude falhou na geração do texto:", err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Gera a legenda: Gemini (vários modelos) → Claude (se houver ANTHROPIC_API_KEY) → texto fixo montado só com os
 * dados do post. As chaves podem vir por parâmetro (painel admin, testes); `undefined` lê do ambiente, "" desliga.
 */
export async function generateCaption(prompt: string, fallback: GeneratedPostContent, apiKey?: string, claudeApiKey?: string): Promise<GeneratedPostContent> {
  const geminiKey = (apiKey !== undefined ? apiKey : process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY || "").trim();
  const claudeKey = (claudeApiKey !== undefined ? claudeApiKey : process.env.ANTHROPIC_API_KEY || "").trim();

  const fromGemini = geminiKey ? await generateWithGemini(fallback.title, prompt, geminiKey) : null;
  if (fromGemini) return fromGemini;
  if (claudeKey) {
    if (geminiKey) console.warn("[socialPublisher] nenhum modelo do Gemini respondeu, tentando o Claude");
    const fromClaude = await generateWithClaude(fallback.title, prompt, claudeKey);
    if (fromClaude) return fromClaude;
  }
  if (geminiKey || claudeKey) console.warn("[socialPublisher] nenhuma IA respondeu, usando o modelo fixo");
  return fallback;
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
  return slideDocument({
    badge: `CARTA DO DIA${tier ? ` • ${tier}` : " • GCG"}`,
    accent: accentColor,
    pager,
    cta: card.altArtCount ? `Arraste para ver ${card.altArtCount === 1 ? "a arte alternativa" : `as ${card.altArtCount} artes alternativas`} →` : undefined,
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

/** Apaga imagens de posts que não existem mais (excluídos no painel) com mais de 1 dia. */
export async function cleanupOrphanSocialImages(prisma: PrismaClient, now = new Date()): Promise<number> {
  const dir = socialUploadDir();
  let names: string[];
  try {
    names = await fs.promises.readdir(dir);
  } catch {
    return 0;
  }
  const candidates = names.filter((n) => /^social-[A-Za-z0-9-]+\.(?:jpg|png)$/.test(n));
  if (!candidates.length) return 0;
  const used = new Set(
    (await prisma.socialMediaPost.findMany({ select: { imageUrl: true, mediaUrls: true } })).flatMap((p) => [p.imageUrl, ...(p.mediaUrls ?? [])]),
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

export type DiscordNoticeKind = "draft" | "approved" | "rejected" | "published" | "failed";
type DiscordNoticePost = { id: string; title: string | null; caption: string; imageUrl: string | null; type: string; scheduledFor?: Date | null; mediaUrls?: string[] };

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
  const slides = post.mediaUrls?.length ?? 0;
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
          ...(slides > 1 ? [{ name: "Formato", value: `🖼️ Carrossel com ${slides} imagens`, inline: false }] : []),
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
  metadata?: Record<string, unknown>;
  /** motivo para o aviso no Discord (ex.: semana sem torneio virou carta do dia) */
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

/** Carta do dia: a pedida, ou a próxima raridade do rodízio LR → R → U → C; artes alternativas viram carrossel. */
export async function draftCardSpotlight(prisma: PrismaClient, input: GeneratePostInput = {}): Promise<DraftContent> {
  const tiers = input.cardCode ? undefined : rarityAttemptOrder(await lastSpotlightTier(prisma));
  const picked = await pickCardForPost(prisma, input.cardCode, Math.random, { tiers });
  const altArts = await findAltArts(prisma, picked);
  const card: SocialCard = { ...picked, altArtCount: altArts.length };
  const total = altArts.length + 1;
  const pager = (i: number) => (total > 1 ? `${i}/${total}` : undefined);
  const accent = accentFor(card.color);
  return {
    type: SocialPostType.CARD_SPOTLIGHT,
    content: await generateSocialContentWithGemini(card, input.customTopic, input.apiKeyGemini),
    cardCode: card.code,
    fileStem: card.code,
    slides: [buildSocialCardHtml(card, pager(1)), ...altArts.map((art, i) => altArtSlideHtml(art, accent, pager(i + 2)))],
    metadata: { rarityTier: rarityTier(card.rarity), altArts: altArts.map((a) => ({ code: a.code, rarity: a.rarity, setCode: a.setCode })) },
  };
}

const TOURNAMENT_HASHTAGS = ["GundamCardGame", "GundamTCG", "GundamBrasil", "TCGBrasil", "TorneioGundam", "AnaheimHub"];

/** Regras comuns a todos os prompts de legenda. */
const CAPTION_RULES = `Regras:
1. Português do Brasil, tom de jogador experiente falando com outros jogadores.
2. Não traduza nomes de cartas, arquétipos, personagens nem palavras-chave do jogo.
3. Use SOMENTE os dados acima. Não invente números, resultados, jogadores, lojas nem afirmações sobre o "meta".
4. Nomes de jogadores e lojas exatamente como estão nos dados.
5. Não diga que o post é oficial nem fale em nome da Bandai.
6. Legenda completa com no máximo 1.800 caracteres, de 8 a 12 hashtags no final.

Responda APENAS com JSON válido:
{"title": "...", "hook": "...", "strategy": "...", "cta": "...", "hashtags": ["..."], "fullCaption": "..."}`;

const placeOf = (t: WeeklyTournament) => [t.city ? `${t.city}${t.uf ? `-${t.uf}` : ""}` : null, dayMonth(t.date)].filter(Boolean).join(", ");
const championOf = (t: WeeklyTournament) => t.top.find((p) => p.placement === 1) ?? null;

function tournamentTemplate(report: WeeklyReport): GeneratedPostContent {
  const count = reportTournamentCount(report);
  const lines = report.featured.map((t) => {
    const champ = championOf(t);
    return `• ${t.store ?? t.event} (${placeOf(t)}): ${champ ? `${champ.player}${champ.archetype ? ` com ${champ.archetype.name}` : ""}` : "campeão não informado"}`;
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
      loja: t.store,
      local: placeOf(t),
      jogadores: t.players,
      top: t.top.map((p) => ({ colocacao: p.placement, jogador: p.player, arquetipo: p.archetype?.name ?? null, campanha: p.record })),
    })),
    arquetiposCampeoes: report.champions.map((c) => ({ arquetipo: c.archetype.name, vitorias: c.wins })),
  };
  return `Você escreve os posts do Instagram do Anaheim Hub (anaheimhub.com), um portal brasileiro feito por fãs do Gundam Card Game (Bandai). O portal não é oficial nem ligado à Bandai.
Escreva o post de segunda-feira com os torneios do Brasil da semana passada. O post é um carrossel: capa, um slide por torneio com o top 4 e um resumo. Dados (JSON):

${JSON.stringify(data, null, 1)}
${customTopic ? `Pedido do editor: "${customTopic.slice(0, 300)}"` : ""}

Estrutura: gancho de 1–2 linhas com o tamanho da semana; os campeões (jogador, loja/cidade e arquétipo), um por linha; o arquétipo que mais venceu, se algum venceu mais de uma vez; uma pergunta para os comentários; convite para ver os resultados completos no Anaheim Hub (link na bio).
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
  return {
    type: SocialPostType.TOURNAMENT_REPORT,
    content: await generateCaption(tournamentPrompt(report, input.customTopic), tournamentTemplate(report), input.apiKeyGemini),
    fileStem: `torneios-${range.from}`,
    slides: [tournamentCoverHtml(report, pager(1)), ...report.featured.map((t, i) => tournamentSlideHtml(t, pager(i + 2))), tournamentClosingHtml(report, pager(total))],
    metadata: { weekStart: range.from, weekEnd: range.to, tournamentIds: [...report.featured, ...report.others].map((t) => t.id) },
  };
}

async function buildDraft(prisma: PrismaClient, input: GeneratePostInput): Promise<DraftContent> {
  if (input.type === SocialPostType.TOURNAMENT_REPORT) return draftTournamentReport(prisma, input);
  // deck em destaque (sexta) ainda não tem formato próprio: sai como carta do dia
  return draftCardSpotlight(prisma, input);
}

/** Cria um rascunho completo no formato do tipo pedido: legenda + slides JPEG + aviso no Discord. */
export async function createSocialPostDraft(prisma: PrismaClient, input: GeneratePostInput = {}) {
  const publicAppUrl = input.publicAppUrl || socialPublicAppUrl();
  const draft = await buildDraft(prisma, input);
  const mediaUrls = await renderDraftSlides(draft.fileStem, draft.slides);
  const { content } = draft;

  const post = await prisma.socialMediaPost.create({
    data: {
      type: draft.type,
      status: SocialPostStatus.PENDING_APPROVAL,
      title: content.title,
      caption: normalizeInstagramCaption(content.fullCaption),
      cardCode: draft.cardCode ?? null,
      imageUrl: mediaUrls[0] ?? null,
      mediaUrls: mediaUrls.length > 1 ? mediaUrls : [],
      scheduledFor: input.scheduledFor ?? null,
      slotKey: input.slotKey ?? null,
      metadata: JSON.stringify({ hashtags: content.hashtags, hook: content.hook, strategy: content.strategy, cta: content.cta, ...draft.metadata }),
    },
  });

  await sendDiscordSocialNotification(post, publicAppUrl, "draft", draft.notice);
  return post;
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

/**
 * Publica um post aprovado no Instagram. Pega o post de forma atômica (APPROVED/FAILED → PUBLISHING) para que
 * duas chamadas ao mesmo tempo não publiquem duas vezes.
 */
export async function publishApprovedPost(
  prisma: PrismaClient,
  postId: string,
  deps: { publish?: typeof publishInstagramImage; publishCarousel?: typeof publishInstagramCarousel; publicAppUrl?: string } = {},
) {
  const publicAppUrl = (deps.publicAppUrl || socialPublicAppUrl()).replace(/\/+$/, "");
  const claimed = await prisma.socialMediaPost.updateMany({
    where: { id: postId, status: { in: [SocialPostStatus.APPROVED, SocialPostStatus.FAILED] } },
    data: { status: SocialPostStatus.PUBLISHING, publishError: null },
  });
  if (claimed.count !== 1) throw new Error("O post não está aprovado (ou já está sendo publicado).");
  const post = await prisma.socialMediaPost.findUniqueOrThrow({ where: { id: postId } });

  try {
    if (!post.imageUrl || !/\.jpe?g$/i.test(post.imageUrl)) throw new Error("O post não tem imagem JPEG; gere de novo para ter a arte.");
    const problems = captionProblems(post.caption);
    if (problems.length) throw new Error(problems.join(" "));
    if (missingAdDisclosure(post.type, post.caption)) throw new Error("Post de afiliado precisa estar identificado como publicidade (ex.: #publi).");
    const result =
      (post.mediaUrls ?? []).length > 1
        ? await (deps.publishCarousel ?? publishInstagramCarousel)(prisma, { imageUrls: post.mediaUrls.map((url) => `${publicAppUrl}${url}`), caption: post.caption })
        : await (deps.publish ?? publishInstagramImage)(prisma, { imageUrl: `${publicAppUrl}${post.imageUrl}`, caption: post.caption });
    const updated = await prisma.socialMediaPost.update({
      where: { id: postId },
      data: { status: SocialPostStatus.PUBLISHED, instagramPostId: result.mediaId, instagramPermalink: result.permalink, publishedAt: new Date(), publishError: null },
    });
    await sendDiscordSocialNotification(updated, publicAppUrl, "published", result.permalink ? `🔗 ${result.permalink}` : undefined);
    return updated;
  } catch (err) {
    const message = (err instanceof Error ? err.message : String(err)).slice(0, 500);
    const failed = await prisma.socialMediaPost.update({ where: { id: postId }, data: { status: SocialPostStatus.FAILED, publishError: message } });
    await sendDiscordSocialNotification(failed, publicAppUrl, "failed", message);
    return failed;
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
  edits: { title?: string; caption?: string } = {},
  deps: { instagramReady?: boolean; publishNow?: (id: string) => Promise<SocialMediaPost> } = {},
) {
  const existing = await prisma.socialMediaPost.findUnique({ where: { id } });
  if (!existing) throw new SocialActionError("Post não encontrado.", 404);
  if (!SOCIAL_EDITABLE.has(existing.status)) throw new SocialActionError("Este post já foi publicado.", 409);
  const caption = edits.caption ?? existing.caption;
  const problems = captionProblems(caption);
  if (problems.length) throw new SocialActionError(problems.join(" "), 400);
  if (missingAdDisclosure(existing.type, caption)) throw new SocialActionError("Post de afiliado precisa estar identificado como publicidade (ex.: #publi) — regra do CONAR.", 400);

  const approved = await prisma.socialMediaPost.update({
    where: { id },
    data: { title: edits.title, caption, status: SocialPostStatus.APPROVED, approvedAt: new Date(), publishError: null, rejectedReason: null },
  });
  const due = !approved.scheduledFor || approved.scheduledFor.getTime() <= Date.now();
  const instagramReady = deps.instagramReady ?? Boolean(readInstagramConfig());
  if (due && instagramReady) {
    const post = await (deps.publishNow ?? ((postId: string) => publishApprovedPost(prisma, postId)))(id);
    return { ok: post.status === SocialPostStatus.PUBLISHED, post };
  }
  return { ok: true, post: approved };
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
