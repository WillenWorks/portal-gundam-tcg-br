import { PrismaClient, SocialPostStatus, SocialPostType } from "@prisma/client";
import { GoogleGenAI } from "@google/genai";
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { getCardDefByCode, ALL_CARD_DEFS } from "../../src/modules/simulator/content/allCardDefs";

export interface GeneratePostInput {
  cardCode?: string;
  type?: SocialPostType;
  customTopic?: string;
  apiKeyGemini?: string;
  publicAppUrl?: string;
}

export interface GeneratedPostContent {
  title: string;
  hook: string;
  strategy: string;
  cta: string;
  hashtags: string[];
  fullCaption: string;
}

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

/** Seleciona uma carta para o post (ou aleatória se não informada, evitando cartas já postadas recentemente) */
export async function pickCardForPost(prisma: PrismaClient, preferredCode?: string): Promise<{ code: string; name: string; color: string; type: string; ap?: number; hp?: number; cost?: number; text?: string; imageUrl?: string }> {
  if (preferredCode) {
    const cardDef = getCardDefByCode(preferredCode);
    const dbCard = await prisma.card.findFirst({ where: { code: preferredCode } }).catch(() => null);
    return {
      code: preferredCode,
      name: dbCard?.nameEn || cardDef?.nameEn || preferredCode,
      color: (dbCard?.color || cardDef?.color || "blue").toLowerCase(),
      type: dbCard?.cardType || cardDef?.cardType || "UNIT",
      ap: dbCard?.ap ?? cardDef?.ap,
      hp: dbCard?.hp ?? cardDef?.hp,
      cost: dbCard?.cost ?? cardDef?.cost,
      text: dbCard?.effectEn || dbCard?.effectPt || cardDef?.triggerKeywords?.join(", ") || "",
      imageUrl: dbCard?.imageUrl || undefined,
    };
  }

  // Busca as últimas 20 cartas já postadas para não repetir
  const recentPosts = await prisma.socialMediaPost.findMany({
    where: { cardCode: { not: null } },
    select: { cardCode: true },
    orderBy: { createdAt: "desc" },
    take: 20,
  }).catch(() => []);
  const recentCodes = new Set(recentPosts.map((p) => p.cardCode).filter(Boolean));

  // Tenta puxar do banco
  const candidate = await prisma.card.findFirst({
    where: {
      code: { notIn: Array.from(recentCodes) as string[] },
      imageUrl: { not: "" },
    },
    orderBy: { code: "asc" },
  }).catch(() => null);

  if (candidate) {
    return {
      code: candidate.code,
      name: candidate.nameEn,
      color: (candidate.color || "blue").toLowerCase(),
      type: candidate.cardType,
      ap: candidate.ap ?? undefined,
      hp: candidate.hp ?? undefined,
      cost: candidate.cost ?? undefined,
      text: candidate.effectEn || candidate.effectPt || "",
      imageUrl: candidate.imageUrl || undefined,
    };
  }

  // Fallback nos dados em memória (ALL_CARD_DEFS)
  const allCodes = Object.keys(ALL_CARD_DEFS);
  const eligibleCodes = allCodes.filter((c) => !recentCodes.has(c));
  const chosenCode = eligibleCodes.length ? eligibleCodes[Math.floor(Math.random() * eligibleCodes.length)] : allCodes[0] || "ST01-001";
  const def = ALL_CARD_DEFS[chosenCode];

  return {
    code: chosenCode,
    name: def?.nameEn || chosenCode,
    color: (def?.color || "blue").toLowerCase(),
    type: def?.cardType || "UNIT",
    ap: def?.ap,
    hp: def?.hp,
    cost: def?.cost,
    text: def?.triggerKeywords?.join(", ") || "",
  };
}

/** Gera a legenda e o texto com o Gemini */
export async function generateSocialContentWithGemini(
  card: { code: string; name: string; color: string; type: string; ap?: number; hp?: number; cost?: number; text?: string },
  customTopic?: string,
  apiKey?: string
): Promise<GeneratedPostContent> {
  const resolvedKey = apiKey !== undefined ? apiKey : (process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY);
  if (!resolvedKey || !resolvedKey.trim()) {
    // Fallback determinístico caso a chave ainda não tenha sido inserida
    const fallbackCaption = `💥 CARTA DO DIA: ${card.name} (${card.code}) 💥\n\n` +
      `Uma das cartas mais estratégicas para decks da cor ${card.color.toUpperCase()}!\n\n` +
      `📊 Estatísticas:\n` +
      `• Tipo: ${card.type}\n` +
      `• Custo: ${card.cost ?? "—"}\n` +
      `• Combate: ${card.ap ?? "—"} AP / ${card.hp ?? "—"} HP\n\n` +
      `📝 Efeito:\n"${card.text || "Sem efeito adicional."}"\n\n` +
      `⚔️ Qual é o seu combo favorito com essa carta? Comente abaixo!\n\n` +
      `🔗 Monte seu deck e teste no simulador do Anaheim Hub (link na bio!)\n\n` +
      `#GundamCardGame #GundamBrasil #GundamTCG #TCGBrasil #BandaiTCG #MobileSuitGundam #AnaheimHub`;

    return {
      title: `Carta do Dia: ${card.name} (${card.code})`,
      hook: `Conheça os detalhes táticos de ${card.name}!`,
      strategy: `Essencial para arquétipos ${card.color}.`,
      cta: `Acesse anaheimhub.com para calibrar seu deck.`,
      hashtags: ["GundamCardGame", "GundamBrasil", "GundamTCG", "TCGBrasil", "AnaheimHub"],
      fullCaption: fallbackCaption,
    };
  }

  const ai = new GoogleGenAI({ apiKey: resolvedKey });
  const prompt = `Você é o estrategista de mídias sociais e especialista em Gundam Card Game do portal Anaheim Hub (anaheimhub.com), a maior comunidade de Gundam TCG no Brasil.
Crie um post profissional, empolgante e com alta taxa de engajamento para o Instagram sobre a seguinte carta de Gundam TCG:

Nome da Carta: ${card.name}
Código: ${card.code}
Cor: ${card.color}
Tipo: ${card.type}
Custo: ${card.cost ?? "N/A"}
Poder de Combate: ${card.ap ?? "—"} AP / ${card.hp ?? "—"} HP
Efeito oficial traduzido: "${card.text || "Sem efeito (Vanilla)"}"
${customTopic ? `Tópico adicional / Contexto: "${customTopic}"` : ""}

Diretrizes obrigatórias:
1. Idioma: Português do Brasil (pt-BR).
2. O texto deve soar técnico e conhecedor do jogo, como um jogador veterano de TCG falando com outros pilotos.
3. Estrutura do post:
   - Gancho impactante (1-2 linhas que chamam atenção).
   - Destaque do Mobile Suit / Piloto / Comando.
   - Análise tática: quando jogar, sinergias e pontos fortes no meta atual.
   - Pergunta aberta para a comunidade comentar.
   - Chamada para a Ação (CTA): Convidar a usar o Deckbuilder e o Simulador do Anaheim Hub (link na bio).
   - Bloco de 8 a 15 hashtags relevantes.

Responda APENAS em JSON válido no formato exato:
{
  "title": "Título curto do post",
  "hook": "Gancho de abertura",
  "strategy": "Resumo da dica estratégica",
  "cta": "Chamada para ação",
  "hashtags": ["hashtag1", "hashtag2"],
  "fullCaption": "Texto completo pronto para publicação no Instagram, com quebras de linha e emojis"
}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: { responseMimeType: "application/json" },
    });
    const parsed = JSON.parse(response.text?.trim() || "{}") as GeneratedPostContent;
    if (parsed.fullCaption) return parsed;
  } catch (err) {
    console.warn("[socialPublisher] Gemini falhou na geração do texto, usando template:", err);
  }

  return {
    title: `Carta do Dia: ${card.name} (${card.code})`,
    hook: `Conheça os detalhes táticos de ${card.name}!`,
    strategy: `Essencial para arquétipos ${card.color}.`,
    cta: `Acesse anaheimhub.com para calibrar seu deck.`,
    hashtags: ["GundamCardGame", "GundamBrasil", "GundamTCG", "TCGBrasil", "AnaheimHub"],
    fullCaption: `💥 CARTA DO DIA: ${card.name} (${card.code})\n\n${card.text}\n\n#GundamCardGame #AnaheimHub`,
  };
}

/** Renderiza a arte 1080x1350 via Playwright */
export async function renderSocialCardImage(card: {
  code: string;
  name: string;
  color: string;
  type: string;
  ap?: number;
  hp?: number;
  cost?: number;
  text?: string;
  imageUrl?: string;
}, outputPath: string): Promise<string> {
  const accentColor = COLOR_HEX[card.color.toLowerCase()] || "#38bdf8";

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
  body {
    width: 1080px;
    height: 1350px;
    background: radial-gradient(circle at 50% 20%, #0f172a 0%, #020617 100%);
    color: #f8fafc;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 60px;
    position: relative;
  }
  /* Grid cyber de fundo */
  body::before {
    content: "";
    position: absolute;
    inset: 0;
    background-image: 
      linear-gradient(rgba(56, 189, 248, 0.04) 1px, transparent 1px),
      linear-gradient(90deg, rgba(56, 189, 248, 0.04) 1px, transparent 1px);
    background-size: 40px 40px;
    pointer-events: none;
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 2px solid rgba(255, 255, 255, 0.1);
    padding-bottom: 24px;
    z-index: 10;
  }
  .brand {
    font-size: 32px;
    font-weight: 900;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: #38bdf8;
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .badge {
    background: rgba(56, 189, 248, 0.15);
    border: 1px solid ${accentColor};
    color: ${accentColor};
    padding: 8px 18px;
    font-size: 16px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    border-radius: 4px;
  }
  .content {
    display: flex;
    gap: 40px;
    align-items: center;
    margin: 40px 0;
    z-index: 10;
    flex: 1;
  }
  .card-frame {
    flex: 0 0 480px;
    height: 672px;
    background: rgba(255, 255, 255, 0.03);
    border: 2px solid rgba(255, 255, 255, 0.15);
    border-radius: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 30px rgba(56, 189, 248, 0.15);
    position: relative;
  }
  .card-img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
  .info-pane {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  .card-code {
    font-size: 20px;
    font-weight: 800;
    color: #94a3b8;
    letter-spacing: 0.1em;
    font-family: monospace;
  }
  .card-name {
    font-size: 42px;
    font-weight: 900;
    line-height: 1.1;
    color: #ffffff;
    text-transform: uppercase;
  }
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 14px;
    margin: 10px 0;
  }
  .stat-box {
    background: rgba(15, 23, 42, 0.8);
    border: 1px solid rgba(255, 255, 255, 0.1);
    padding: 14px 18px;
    border-radius: 8px;
  }
  .stat-label {
    font-size: 13px;
    color: #94a3b8;
    text-transform: uppercase;
    font-weight: 700;
    letter-spacing: 0.05em;
  }
  .stat-value {
    font-size: 26px;
    font-weight: 900;
    color: #ffffff;
    margin-top: 4px;
  }
  .effect-box {
    background: rgba(15, 23, 42, 0.9);
    border-left: 4px solid ${accentColor};
    border-radius: 4px;
    padding: 20px;
    font-size: 18px;
    line-height: 1.6;
    color: #cbd5e1;
    max-height: 260px;
    overflow: hidden;
  }
  .footer {
    border-top: 2px solid rgba(255, 255, 255, 0.1);
    padding-top: 24px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    z-index: 10;
  }
  .cta-text {
    font-size: 20px;
    font-weight: 700;
    color: #cbd5e1;
  }
  .url-badge {
    background: #38bdf8;
    color: #020617;
    font-size: 18px;
    font-weight: 800;
    padding: 10px 22px;
    border-radius: 6px;
    letter-spacing: 0.05em;
  }
</style>
</head>
<body>
  <div class="header">
    <div class="brand">
      <span>ANAHEIM HUB</span>
    </div>
    <div class="badge">CARTA DO DIA • GCG</div>
  </div>

  <div class="content">
    <div class="card-frame">
      ${card.imageUrl ? `<img class="card-img" src="${card.imageUrl}" alt="${card.name}" />` : `
        <div style="text-align: center; padding: 20px;">
          <div style="font-size: 64px; margin-bottom: 10px;">🤖</div>
          <div style="font-size: 24px; font-weight: 800; color: #38bdf8;">${card.code}</div>
          <div style="font-size: 16px; color: #94a3b8; margin-top: 8px;">${card.name}</div>
        </div>
      `}
    </div>

    <div class="info-pane">
      <div>
        <div class="card-code">${card.code} • ${card.type.toUpperCase()}</div>
        <h1 class="card-name">${card.name}</h1>
      </div>

      <div class="stats-grid">
        <div class="stat-box">
          <div class="stat-label">Custo / Nível</div>
          <div class="stat-value">${card.cost ?? "—"} <span style="font-size: 16px; color: #64748b;">COST</span></div>
        </div>
        <div class="stat-box">
          <div class="stat-label">Poder de Combate</div>
          <div class="stat-value">${card.ap ?? "—"} <span style="font-size: 16px; color: #64748b;">AP</span> / ${card.hp ?? "—"} <span style="font-size: 16px; color: #64748b;">HP</span></div>
        </div>
      </div>

      <div class="effect-box">
        <div style="font-size: 12px; font-weight: 800; text-transform: uppercase; color: ${accentColor}; margin-bottom: 6px;">Efeito Oficial (pt-BR)</div>
        ${card.text || "Mobile Suit padrão sem habilidades ativas adicionais (Vanilla Unit)."}
      </div>
    </div>
  </div>

  <div class="footer">
    <div class="cta-text">Monte seu deck e jogue online no simulador</div>
    <div class="url-badge">anaheimhub.com</div>
  </div>
</body>
</html>`;

  // Garante o diretório de destino
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1080, height: 1350 } });
    await page.setContent(html, { waitUntil: "load", timeout: 15000 });
    await page.screenshot({ path: outputPath, type: "png" });
    return outputPath;
  } finally {
    await browser.close();
  }
}

/** Notifica o canal do Discord com Embed rico e botões de ação */
export async function sendDiscordSocialNotification(
  post: { id: string; title: string | null; caption: string; imageUrl: string | null; type: string },
  publicUrl: string
): Promise<string | null> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) return null;

  const adminLink = `${publicUrl}/admin#social`;
  const absoluteImageUrl = post.imageUrl ? `${publicUrl}${post.imageUrl}` : undefined;

  const payload = {
    content: "📢 **Novo Post Gerado para Redes Sociais (Instagram)**\nRevise a arte e a legenda antes da publicação:",
    embeds: [
      {
        title: post.title || "Novo Post — Anaheim Hub",
        description: post.caption.slice(0, 1500) + (post.caption.length > 1500 ? "..." : ""),
        color: 3718648, // Ciano Anaheim (#38bdf8)
        image: absoluteImageUrl ? { url: absoluteImageUrl } : undefined,
        fields: [
          { name: "Tipo", value: post.type, inline: true },
          { name: "Status", value: "🟡 Aguardando Sua Aprovação", inline: true },
          { name: "Ações", value: `[👉 Abrir no Painel Web Admin para Editar ou Aprovar](${adminLink})`, inline: false },
        ],
        footer: { text: "Anaheim Hub • Agente de Automação Social (HITL)" },
        timestamp: new Date().toISOString(),
      },
    ],
  };

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      console.log(`[socialPublisher] Notificação enviada ao Discord para o post ${post.id}`);
      return "sent";
    }
  } catch (err) {
    console.error("[socialPublisher] Falha ao enviar notificação ao Discord:", err);
  }
  return null;
}

/** Cria um novo rascunho de postagem completo com IA + Arte 1080x1350 + Notificação no Discord */
export async function createSocialPostDraft(
  prisma: PrismaClient,
  input: GeneratePostInput = {}
) {
  const publicAppUrl = input.publicAppUrl || process.env.PUBLIC_APP_URL || "https://anaheimhub.com";
  
  // 1. Pega os dados da carta
  const card = await pickCardForPost(prisma, input.cardCode);

  // 2. Gera a legenda e metadados com Gemini
  const content = await generateSocialContentWithGemini(card, input.customTopic, input.apiKeyGemini);

  // 3. Define onde salvar a imagem
  const fileName = `social-${card.code}-${Date.now()}.png`;
  const relativeUploadPath = `/uploads/social/${fileName}`;
  const localUploadDir = path.resolve(process.cwd(), process.env.LOCAL_UPLOAD_DIR || "public/uploads");
  const absolutePath = path.join(localUploadDir, "social", fileName);

  // 4. Renderiza o PNG 1080x1350 via Playwright
  // sem navegador na VPS (ou falha ao desenhar) o post fica sem imagem, em vez de apontar para um arquivo que não existe
  let imageUrl: string | null = relativeUploadPath;
  try {
    await renderSocialCardImage(card, absolutePath);
  } catch (err) {
    imageUrl = null;
    console.warn("[socialPublisher] Aviso ao renderizar imagem Playwright:", err instanceof Error ? err.message : err);
  }

  // 5. Salva no Banco de Dados
  const post = await prisma.socialMediaPost.create({
    data: {
      type: input.type || SocialPostType.CARD_SPOTLIGHT,
      status: SocialPostStatus.PENDING_APPROVAL,
      title: content.title,
      caption: content.fullCaption,
      cardCode: card.code,
      imageUrl,
      metadata: JSON.stringify({
        hashtags: content.hashtags,
        hook: content.hook,
        strategy: content.strategy,
        cta: content.cta,
      }),
    },
  });

  // 6. Notifica no Discord se configurado
  await sendDiscordSocialNotification(post, publicAppUrl);

  return post;
}
