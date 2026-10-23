import { Prisma, PrismaClient, SocialPostStatus, SocialPostType } from "@prisma/client";
import { GoogleGenAI } from "@google/genai";
import fs from "node:fs";
import path from "node:path";
import { getCardDefByCode, ALL_CARD_DEFS } from "../../src/modules/simulator/content/allCardDefs";
import { formatSlot } from "./socialSchedule";
import { countHashtags, INSTAGRAM_CAPTION_MAX, INSTAGRAM_HASHTAG_MAX, normalizeInstagramCaption, publishInstagramImage, readInstagramConfig } from "./instagramPublisher";

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
};

/** Paleta de cores oficial de Gundam Card Game */
const COLOR_HEX: Record<string, string> = {
  blue: "#38bdf8",
  red: "#f87171",
  green: "#4ade80",
  yellow: "#facc15",
  black: "#94a3b8",
  white: "#f8fafc",
  purple: "#c084fc",
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

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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
    // o texto explicativo vai em português quando existe (o post é para o público brasileiro)
    text: row.effectPt || row.effectEn || "",
    imageUrl: row.imageUrl || undefined,
  };
}

/** Seleciona a carta do post: a pedida, ou uma sorteada entre as impressões principais com imagem que não saíram nos últimos posts. */
export async function pickCardForPost(prisma: PrismaClient, preferredCode?: string, random: () => number = Math.random): Promise<SocialCard> {
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
  const total = await prisma.card.count({ where }).catch(() => 0);
  if (total > 0) {
    const candidate = (await prisma.card
      .findFirst({ where, orderBy: { id: "asc" }, skip: Math.floor(random() * total) })
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

/** Gera a legenda com o Gemini; sem chave ou com falha, usa um modelo fixo só com os dados da carta. */
export async function generateSocialContentWithGemini(card: SocialCard, customTopic?: string, apiKey?: string): Promise<GeneratedPostContent> {
  const resolvedKey = apiKey !== undefined ? apiKey : process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
  if (!resolvedKey || !resolvedKey.trim()) return templateContent(card);

  const ai = new GoogleGenAI({ apiKey: resolvedKey });
  const prompt = `Você escreve os posts do Instagram do Anaheim Hub (anaheimhub.com), um portal brasileiro feito por fãs do Gundam Card Game (Bandai). O portal não é oficial nem ligado à Bandai.
Escreva um post sobre esta carta, usando SOMENTE os dados abaixo:

Nome oficial (não traduza): ${card.name}
Código: ${card.code}
Tipo: ${card.type}
Cor: ${card.color}
Custo: ${card.cost ?? "—"}${card.level !== undefined ? ` · Nível: ${card.level}` : ""}
AP / HP: ${card.ap ?? "—"} / ${card.hp ?? "—"}
Texto da carta: "${card.text || "sem efeito"}"
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

  try {
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_SOCIAL_MODEL || "gemini-3.8-flash",
      contents: prompt,
      config: { responseMimeType: "application/json" },
    });
    const parsed = JSON.parse(response.text?.trim() || "{}") as Partial<GeneratedPostContent>;
    if (typeof parsed.fullCaption === "string" && parsed.fullCaption.trim()) {
      return {
        title: String(parsed.title || `Carta do Dia: ${card.name} (${card.code})`).slice(0, 140),
        hook: String(parsed.hook || ""),
        strategy: String(parsed.strategy || ""),
        cta: String(parsed.cta || ""),
        hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags.map(String).slice(0, INSTAGRAM_HASHTAG_MAX) : [],
        fullCaption: normalizeInstagramCaption(parsed.fullCaption),
      };
    }
  } catch (err) {
    console.warn("[socialPublisher] Gemini falhou na geração do texto, usando o modelo fixo:", err instanceof Error ? err.message : err);
  }
  return templateContent(card);
}

/** HTML da arte 1080x1350 (4:5, formato retrato aceito pelo Instagram). Todo dado é escapado. */
export function buildSocialCardHtml(card: SocialCard): string {
  const accentColor = COLOR_HEX[card.color.toLowerCase()] || "#38bdf8";
  const imageUrl = card.imageUrl && /^https:\/\//i.test(card.imageUrl) ? card.imageUrl : "";
  const typeLabel = CARD_TYPE_PT[card.type] || card.type;
  const effect = card.text?.trim() || "Sem efeito.";
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
  body { width: 1080px; height: 1350px; background: radial-gradient(circle at 50% 20%, #0f172a 0%, #020617 100%); color: #f8fafc; overflow: hidden; display: flex; flex-direction: column; justify-content: space-between; padding: 60px; position: relative; }
  body::before { content: ""; position: absolute; inset: 0; background-image: linear-gradient(rgba(56, 189, 248, 0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(56, 189, 248, 0.04) 1px, transparent 1px); background-size: 40px 40px; pointer-events: none; }
  .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid rgba(255, 255, 255, 0.1); padding-bottom: 24px; z-index: 10; }
  .brand { font-size: 32px; font-weight: 900; letter-spacing: 0.15em; text-transform: uppercase; color: #38bdf8; }
  .badge { background: rgba(56, 189, 248, 0.15); border: 1px solid ${accentColor}; color: ${accentColor}; padding: 8px 18px; font-size: 16px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; border-radius: 4px; }
  .content { display: flex; gap: 40px; align-items: center; margin: 40px 0; z-index: 10; flex: 1; }
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
  .effect-label { font-size: 12px; font-weight: 800; text-transform: uppercase; color: ${accentColor}; margin-bottom: 6px; }
  .footer { border-top: 2px solid rgba(255, 255, 255, 0.1); padding-top: 24px; display: flex; justify-content: space-between; align-items: center; gap: 24px; z-index: 10; }
  .cta-text { font-size: 20px; font-weight: 700; color: #cbd5e1; }
  .fan-note { font-size: 13px; color: #64748b; margin-top: 6px; }
  .url-badge { background: #38bdf8; color: #020617; font-size: 18px; font-weight: 800; padding: 10px 22px; border-radius: 6px; letter-spacing: 0.05em; white-space: nowrap; }
</style>
</head>
<body>
  <div class="header">
    <div class="brand">ANAHEIM HUB</div>
    <div class="badge">CARTA DO DIA • GCG</div>
  </div>
  <div class="content">
    <div class="card-frame">
      ${imageUrl ? `<img class="card-img" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(card.name)}" />` : `<div style="text-align:center;padding:20px;"><div style="font-size:24px;font-weight:800;color:#38bdf8;">${escapeHtml(card.code)}</div><div style="font-size:16px;color:#94a3b8;margin-top:8px;">${escapeHtml(card.name)}</div></div>`}
    </div>
    <div class="info-pane">
      <div>
        <div class="card-code">${escapeHtml(card.code)} • ${escapeHtml(typeLabel.toUpperCase())}</div>
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
  </div>
  <div class="footer">
    <div>
      <div class="cta-text">Monte seu deck e jogue online no simulador</div>
      <div class="fan-note">Projeto de fãs, sem vínculo com a Bandai. Gundam Card Game © Bandai / Sotsu · Sunrise.</div>
    </div>
    <div class="url-badge">anaheimhub.com</div>
  </div>
</body>
</html>`;
}

/** Renderiza a arte 1080x1350 em JPEG (o único formato de imagem que a API do Instagram aceita). */
export async function renderSocialCardImage(card: SocialCard, outputPath: string): Promise<string> {
  const html = buildSocialCardHtml(card);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  // carregado só aqui: o navegador pesa e só é usado ao gerar um post
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({
    headless: true,
    // SOCIAL_CHROMIUM_PATH: usa um Chromium já instalado no servidor em vez do baixado pelo Playwright
    executablePath: process.env.SOCIAL_CHROMIUM_PATH || undefined,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1080, height: 1350 } });
    await page.setContent(html, { waitUntil: "load", timeout: 20000 });
    await page.screenshot({ path: outputPath, type: "jpeg", quality: 90 });
    return outputPath;
  } finally {
    await browser.close();
  }
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

/** Caminho do arquivo de um post a partir do imageUrl salvo, sem sair da pasta social. */
export function socialImageFilePath(imageUrl: string | null | undefined): string | null {
  const match = /^\/uploads\/social\/([A-Za-z0-9-]+\.(?:jpg|png))$/.exec(imageUrl || "");
  if (!match) return null;
  return path.join(socialUploadDir(), match[1]);
}

/** Notifica o canal do Discord com a prévia e o link para revisar. */
export async function sendDiscordSocialNotification(
  post: { id: string; title: string | null; caption: string; imageUrl: string | null; type: string; scheduledFor?: Date | null },
  publicUrl: string,
  kind: "draft" | "published" | "failed" = "draft",
  extra?: string,
): Promise<string | null> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl || !/^https:\/\/(?:discord\.com|discordapp\.com)\/api\/webhooks\//.test(webhookUrl)) return null;

  const adminLink = `${publicUrl}/admin#social`;
  const absoluteImageUrl = post.imageUrl ? `${publicUrl}${post.imageUrl}` : undefined;
  const header =
    kind === "published" ? "✅ **Post publicado no Instagram**" : kind === "failed" ? "⚠️ **Falha ao publicar no Instagram**" : "📢 **Novo rascunho para o Instagram**\nRevise a arte e a legenda e aprove pelo painel:";
  const status =
    kind === "published" ? "🟢 Publicado" : kind === "failed" ? "🔴 Falhou" : post.scheduledFor ? `🟡 Aguardando aprovação · sai ${formatSlot(post.scheduledFor)} (Brasília)` : "🟡 Aguardando aprovação";

  const payload = {
    content: header,
    embeds: [
      {
        title: post.title || "Post — Anaheim Hub",
        description: (extra ? `${extra}\n\n` : "") + post.caption.slice(0, 1500) + (post.caption.length > 1500 ? "..." : ""),
        color: kind === "failed" ? 15680580 : 3718648,
        image: absoluteImageUrl ? { url: absoluteImageUrl } : undefined,
        fields: [
          { name: "Status", value: status, inline: false },
          { name: "Painel", value: `[Abrir no painel do admin](${adminLink})`, inline: false },
        ],
        footer: { text: "Anaheim Hub • posts com aprovação humana" },
        timestamp: new Date().toISOString(),
      },
    ],
  };

  try {
    const res = await fetch(webhookUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), redirect: "error" });
    if (res.ok) return "sent";
    console.warn("[socialPublisher] Discord respondeu", res.status);
  } catch (err) {
    console.error("[socialPublisher] Falha ao enviar notificação ao Discord:", err instanceof Error ? err.message : err);
  }
  return null;
}

/** Cria um rascunho completo: carta + legenda + arte JPEG + aviso no Discord. */
export async function createSocialPostDraft(prisma: PrismaClient, input: GeneratePostInput = {}) {
  const publicAppUrl = input.publicAppUrl || process.env.PUBLIC_APP_URL || "https://anaheimhub.com";
  const card = await pickCardForPost(prisma, input.cardCode);
  const content = await generateSocialContentWithGemini(card, input.customTopic, input.apiKeyGemini);

  const fileName = `social-${safeFileStem(card.code)}-${Date.now()}.jpg`;
  const absolutePath = path.join(socialUploadDir(), fileName);

  // sem navegador no servidor (ou falha ao desenhar) o post fica sem imagem, em vez de apontar para um arquivo que não existe
  let imageUrl: string | null = `/uploads/social/${fileName}`;
  try {
    await renderSocialCardImage(card, absolutePath);
  } catch (err) {
    imageUrl = null;
    console.warn("[socialPublisher] Aviso ao renderizar imagem Playwright:", err instanceof Error ? err.message : err);
  }

  const post = await prisma.socialMediaPost.create({
    data: {
      type: input.type || SocialPostType.CARD_SPOTLIGHT,
      status: SocialPostStatus.PENDING_APPROVAL,
      title: content.title,
      caption: normalizeInstagramCaption(content.fullCaption),
      cardCode: card.code,
      imageUrl,
      scheduledFor: input.scheduledFor ?? null,
      slotKey: input.slotKey ?? null,
      metadata: JSON.stringify({ hashtags: content.hashtags, hook: content.hook, strategy: content.strategy, cta: content.cta }),
    },
  });

  await sendDiscordSocialNotification(post, publicAppUrl, "draft");
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
export async function publishApprovedPost(prisma: PrismaClient, postId: string, deps: { publish?: typeof publishInstagramImage; publicAppUrl?: string } = {}) {
  const publicAppUrl = (deps.publicAppUrl || process.env.PUBLIC_APP_URL || "https://anaheimhub.com").replace(/\/+$/, "");
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
    const result = await (deps.publish ?? publishInstagramImage)(prisma, { imageUrl: `${publicAppUrl}${post.imageUrl}`, caption: post.caption });
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

/** Situação das integrações para o painel (só sim/não; nenhum segredo). */
export async function socialIntegrationStatus() {
  return {
    gemini: Boolean((process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY || "").trim()),
    discord: /^https:\/\/(?:discord\.com|discordapp\.com)\/api\/webhooks\//.test(process.env.DISCORD_WEBHOOK_URL || ""),
    instagram: Boolean(readInstagramConfig()),
    renderer: await isSocialRendererAvailable(),
    scheduler: process.env.SOCIAL_SCHEDULER_ENABLED === "true",
  };
}
