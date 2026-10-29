import type { PrismaClient, PostType } from "@prisma/client";
import { GoogleGenAI } from "@google/genai";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";

export const ARTICLE_AI_SYSTEM_PROMPT = `Você é o Principal Jornalista e Analista Estratégico de Esports e Card Games do portal brasileiro "Anaheim Hub" (Gundam Card Game Brasil).
Sua formação e estilo editorial combinam a profundidade analítica dos melhores articulistas de TCGs competitivos (como ChannelFireball, TCGPlayer Infinite e MTGGoldfish) com a paixão, fluidez e apuro jornalístico de publicações especializadas em games e cultura pop tecnológica (como Polygon, IGN e The Verge).
Você tem conhecimento enciclopédico de Mobile Suit Gundam (Universal Century, Cosmic Era, Anno Domini, etc.) e domina plenamente as regras, mecânicas, termos e o metagame do Gundam Card Game oficial da Bandai.

DIRETRIZES FUNDAMENTAIS DE ESCRITA:
1. IDIOMA E TOM:
   - Escreva em português do Brasil impecável, envolvente, maduro e estratégico.
   - Use terminologia de card game natural e profissional (tempo, card advantage, board presence, curva de custo, mulligan, burst, matchup, side deck, win condition, etc.).
2. REFERÊNCIA A CARTAS (CRÍTICO):
   - SEMPRE que citar o nome ou código de uma carta, utilize a sintaxe de colchetes duplos: [[CODIGO_DA_CARTA]] ou [[Nome da Carta]].
   - Exemplos: [[GD01-010]], [[ST01-001]], [[Strike Freedom Gundam]], [[Amuro Ray]].
   - O portal do Anaheim Hub possui um componente interativo que renderiza automaticamente hovercards e popups com a arte e o texto da carta ao usar essa sintaxe.
3. ESTRUTURA EDITORIAL RICA (MARKDOWN):
   - Não escreva apenas texto corrido. Use formatação Markdown rica com:
     - Título principal atraente e profissional.
     - Subtítulos de nível 2 (##) e nível 3 (###) claros e temáticos.
     - Bloco de citação (>) para destacar insights táticos, falas icônicas ou conclusões de impacto.
     - Listas com marcadores (bullet points) para prós/contras, pontos fortes e fracos, ou passos táticos.
     - Tabelas de matchups ou curvas quando aplicável.
     - Destaque em negrito para conceitos táticos essenciais.
4. PROFUNDIDADE E CONTEÚDO ANALÍTICO:
   - Se for um Guia (GUIDE): detalhe estratégia passo a passo, plano de jogo no início/meio/fim de partida, sinergias e como pilotar.
   - Se for uma Análise (REVIEW): avalie custo-benefício, impacto no metagame, comparações com alternativas e veredito competitivo.
   - Se for Notícia/Metagame (NEWS): contextualize o acontecimento, reações da comunidade, implicações para os torneios locais e globais.
   - Se for Antevisão/Spoiler (PREVIEW): analise novas cartas reveladas, potenciais arquétipos beneficiados e expectativas de lançamento.
5. ENCERRAMENTO E ENGAJAMENTO:
   - Conclua com uma chamada para a comunidade de pilotos testar a lista no Simulador do Anaheim Hub, comentar no artigo ou discutir no Discord.
   - Inclua uma linha final com hashtags relevantes (ex.: #GundamCardGame #GundamTCG #AnaheimHub #TCG).`;

export const ArticleOutputSchema = z.object({
  title: z.string().describe("Título impactante em tom jornalístico"),
  slug: z.string().describe("Slug SEO amigável em kebab-case"),
  excerpt: z.string().describe("Lead jornalístico de 2 a 3 frases sintetizando o tema central"),
  postType: z.enum(["NEWS", "GUIDE", "REVIEW", "PREVIEW"]).describe("Categoria do artigo"),
  coverCardCode: z.string().nullable().optional().describe("Código da carta oficial sugerida para a capa"),
  contentMd: z.string().describe("Corpo completo em Markdown formatado"),
  tags: z.array(z.string()).optional().describe("Tags do artigo"),
});

export type GeneratedArticle = {
  title: string;
  slug: string;
  excerpt: string;
  contentMd: string;
  postType: PostType;
  coverImage: string | null;
  suggestedCards: Array<{
    code: string;
    name: string;
    imageUrl: string | null;
    color?: string | null;
    rarity?: string | null;
  }>;
};

export type GenerateArticleInput = {
  topic: string;
  context?: string;
  rules?: string;
  postType?: PostType;
  category?: PostType;
  cardCodes?: string[];
  cardReferences?: string[];
  coverImageUrl?: string;
  customImageUrl?: string;
  imageSourceMode?: "catalog" | "custom" | "ai_prompt";
  imageMode?: "CARD_ART" | "CUSTOM_URL" | "AI_PROMPT";
  modelPreference?: "gemini" | "claude";
  apiKeyGemini?: string;
  apiKeyClaude?: string;
};

export type ArticleAiGenerateInput = GenerateArticleInput;

const POST_TYPE_LABEL_PT: Record<PostType, string> = {
  NEWS: "Notícia",
  GUIDE: "Guia Estratégico",
  REVIEW: "Análise Competitiva",
  PREVIEW: "Antevisão / Spoiler",
};

export function slugifyArticle(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

export function geminiArticleModels(): string[] {
  const envModel = (process.env.GEMINI_MODEL || "").trim();
  const models = [
    envModel,
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-2.5-pro",
  ].filter(Boolean);
  return Array.from(new Set(models));
}

export async function findRelevantCardsForArticle(
  prisma: PrismaClient,
  input: GenerateArticleInput,
) {
  const rawCodes = input.cardCodes || input.cardReferences || [];
  const codes = rawCodes
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean);

  let foundByCode: any[] = [];
  if (codes.length) {
    try {
      foundByCode = await prisma.card.findMany({
        where: { code: { in: codes } },
      });
    } catch {
      foundByCode = [];
    }
  }

  // Extrai palavras-chave do tema e contexto para buscar cartas temáticas
  const rawText = `${input.topic || ""} ${input.context || ""}`;
  const terms = rawText
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(
      (t) =>
        t.length >= 3 &&
        !/^(para|como|sobre|onde|quando|qual|mais|muito|cada|esse|essa|este|esta|pelo|pela|com|sem|dos|das|aos|nas|nos|uma|uns|umas|pelo|pela)$/i.test(
          t,
        ),
    )
    .slice(0, 6);

  let foundByTerms: any[] = [];
  if (terms.length) {
    try {
      foundByTerms = await prisma.card.findMany({
        where: {
          OR: [
            ...terms.map((term) => ({ namePt: { contains: term, mode: "insensitive" as const } })),
            ...terms.map((term) => ({ nameEn: { contains: term, mode: "insensitive" as const } })),
            ...terms.map((term) => ({ code: { contains: term, mode: "insensitive" as const } })),
          ],
        },
        take: 10,
      });
    } catch {
      foundByTerms = [];
    }
  }

  const map = new Map<string, any>();
  for (const c of [...foundByCode, ...foundByTerms]) {
    map.set(c.code, c);
  }
  return Array.from(map.values());
}

export function buildArticleAiPrompt(input: GenerateArticleInput, cards: any[]): string {
  const cardsSummary = cards.length
    ? cards
        .map(
          (c) =>
            `- [[${c.code}]] ${c.namePt || c.nameEn} (${c.color || "Sem cor"} | ${c.cardType} | Custo ${c.cost ?? "-"} | AP ${c.ap ?? "-"} / HP ${c.hp ?? "-"}): ${(c.effectText || "Sem texto de efeito").slice(0, 220)}`,
        )
        .join("\n")
    : "Nenhuma carta específica informada. Use cartas canônicas de Gundam TCG se citar efeitos.";

  return `${ARTICLE_AI_SYSTEM_PROMPT}

TEMA DO ARTIGO: "${input.topic}"
${input.context ? `CONTEXTO / DIRECIONAMENTO EDITORIAL: ${input.context}\n` : ""}
${input.rules ? `REGRAS OU RESTRIÇÕES ESPECÍFICAS: ${input.rules}\n` : ""}
${input.postType ? `FORMATO DESEJADO: ${input.postType} (${POST_TYPE_LABEL_PT[input.postType] || input.postType})\n` : ""}

CARTAS DO CATÁLOGO OFICIAL DISPONÍVEIS:
${cardsSummary}

INSTRUÇÕES DE SAÍDA:
Gere a resposta EXCLUSIVAMENTE em formato JSON válido contendo exatamente as chaves:
{
  "title": "Título atraente, profissional e jornalístico (até 100 caracteres)",
  "slug": "slug-em-kebab-case-sem-acentos",
  "excerpt": "Lead jornalístico de 2 a 3 frases sintetizando o tema central (até 300 caracteres)",
  "postType": "${input.postType || "GUIDE"}",
  "coverCardCode": "${cards[0]?.code || "GD01-001"}",
  "contentMd": "Corpo completo em Markdown formatado com introdução, subtítulos ## e ###, citações >, listas táticas e menções às cartas na sintaxe [[CODIGO]]. Mínimo de 500 palavras com análise aprofundada.",
  "tags": ["GundamCardGame", "Metagame", "Guia"]
}`;
}

export function buildFallbackArticle(input: GenerateArticleInput, cards: any[]): GeneratedArticle {
  const topic = input.topic.trim();
  const title = topic.startsWith("Guia") || topic.startsWith("Análise") ? topic : `Análise Estratégica: ${topic}`;
  const slug = slugifyArticle(title);
  const type = input.postType || "GUIDE";
  const primaryCard = cards[0];

  const citations = cards.length
    ? cards.slice(0, 3).map((c) => `- [[${c.code}]] **${c.namePt || c.nameEn}**: Peça fundamental para garantir tempo e presença de mesa nos turnos iniciais e intermediários.`).join("\n")
    : "- [[GD01-010]] **Gundam Exia**: Excelente velocidade e pressão na linha de frente.\n- [[ST01-001]] **Gundam**: Solidez defensiva e curva confiável.";

  const contentMd = `## Visão Geral do Metagame

O cenário competitivo de **Gundam Card Game** exige constante adaptação dos pilotos. Compreender o equilíbrio entre agressão inicial e sustentabilidade no final de jogo é o divisor de águas entre vitórias consistentes e eliminações precoces nos torneios.

> *"A vitória em Gundam TCG não pertence àquele que possui o Mobile Suit mais imponente, mas ao piloto que dita o tempo de cada rodada."*

## Análise Tática e Peças-Chave

Neste contexto, a estrutura tática destacada apoia-se em decisões precisas de curva de custo e recursos:

${citations}

### Pontos Fortes e Fraquezas Competitivas

- **Vantagens**:
  - Alta sinergia entre cartas de comando e pilotos de suporte.
  - Eficiência na troca de recursos frente a ameaças com Burst ativo.
  - Flexibilidade para alternar entre postura agressiva e controle de mesa.
- **Atenção Redobrada**:
  - Cuidado com decks rápidos capazes de punir começos lentos sem defensores.
  - Gestão rigorosa da pilha de recursos para não estagnar na transição do turno 3 para o 4.

## Dicas Práticas para os Torneios

1. **Ajuste de Mulligan**: Priorize mãos iniciais com unidades de custo 1 a 2 que acelerem a compra ou garantam defesa imediata.
2. **Previsão de Burst**: Calcule o dano no escudo adversário antecipando possíveis gatilhos de Burst que virariam o combate.
3. **Composição de Side Deck**: Reserve cartas de remoção direcionada e anulação de efeitos para confrontos contra arquétipos de controle.

## Veredito e Próximos Passos

Este arquétipo consolida-se como uma das opções mais dinâmicas e recompensadoras para pilotos dedicados a dominar as nuances do metagame brasileiro.

Copie a lista no **Anaheim Hub**, faça simulações na nossa ferramenta de partidas e compartilhe seus resultados com a comunidade!

#GundamCardGame #GundamTCG #AnaheimHub #Metagame`;

  const coverImage =
    input.coverImageUrl ||
    primaryCard?.imageLargeUrl ||
    primaryCard?.imageUrl ||
    primaryCard?.arts?.[0]?.url ||
    null;

  return {
    title,
    slug,
    excerpt: `Confira nossa análise detalhada sobre ${topic}, destacando peças-chave, táticas de combate e dicas fundamentais para dominar o metagame de Gundam Card Game.`,
    contentMd,
    postType: type,
    coverImage,
    suggestedCards: cards.map((c) => ({
      code: c.code,
      name: c.namePt || c.nameEn,
      imageUrl: c.imageLargeUrl || c.imageUrl || c.arts?.[0]?.url || null,
      color: c.color,
      rarity: c.rarity,
    })),
  };
}

export async function generateArticleWithAi(
  prisma: PrismaClient,
  input: GenerateArticleInput,
): Promise<GeneratedArticle> {
  const cards = await findRelevantCardsForArticle(prisma, input);
  const prompt = buildArticleAiPrompt(input, cards);

  const geminiKey = input.apiKeyGemini || process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY || "";
  const claudeKey = input.apiKeyClaude || process.env.ANTHROPIC_API_KEY || "";

  let parsed: any = null;

  // 1. Tenta com Gemini
  if (geminiKey) {
    const ai = new GoogleGenAI({ apiKey: geminiKey, httpOptions: { timeout: 35_000 } });
    for (const model of geminiArticleModels()) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: { responseMimeType: "application/json" },
        });
        const text = response.text?.trim() || "";
        if (text) {
          parsed = JSON.parse(text);
          if (parsed && typeof parsed.title === "string" && typeof parsed.contentMd === "string") {
            break;
          }
        }
      } catch (err) {
        console.warn(`[articleAiService] Gemini (${model}) falhou:`, err instanceof Error ? err.message : err);
      }
    }
  }

  // 2. Fallback para Claude se Gemini não respondeu
  if (!parsed && claudeKey) {
    try {
      const client = new Anthropic({ apiKey: claudeKey, timeout: 60_000, maxRetries: 1 });
      const response = await client.beta.messages.parse({
        model: "claude-3-7-sonnet-20250219",
        max_tokens: 8000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { format: betaZodOutputFormat(ArticleOutputSchema) },
        messages: [{ role: "user", content: prompt }],
      });
      parsed = response.parsed_output;
    } catch (claudeErr) {
      console.warn("[articleAiService] Claude falhou na geração do artigo:", claudeErr instanceof Error ? claudeErr.message : claudeErr);
    }
  }

  // 3. Fallback estruturado se IA indisponível
  if (!parsed || typeof parsed.title !== "string" || typeof parsed.contentMd !== "string") {
    return buildFallbackArticle(input, cards);
  }

  const validTypes = new Set(["NEWS", "GUIDE", "REVIEW", "PREVIEW"]);
  const postType: PostType = validTypes.has(parsed.postType)
    ? (parsed.postType as PostType)
    : input.postType || "GUIDE";

  const title = String(parsed.title || input.topic).trim();
  const slug = slugifyArticle(String(parsed.slug || title));
  const excerpt = String(parsed.excerpt || "").trim();
  const contentMd = String(parsed.contentMd || "").trim();

  // Imagem de capa sugerida
  let coverImage = input.coverImageUrl || null;
  if (!coverImage && parsed.coverCardCode) {
    const matched = cards.find((c) => c.code === parsed.coverCardCode);
    if (matched) {
      coverImage = matched.imageLargeUrl || matched.imageUrl || matched.arts?.[0]?.url || null;
    }
  }
  if (!coverImage && cards[0]) {
    coverImage = cards[0].imageLargeUrl || cards[0].imageUrl || cards[0].arts?.[0]?.url || null;
  }

  return {
    title,
    slug,
    excerpt,
    contentMd,
    postType,
    coverImage,
    suggestedCards: cards.map((c) => ({
      code: c.code,
      name: c.namePt || c.nameEn,
      imageUrl: c.imageLargeUrl || c.imageUrl || c.arts?.[0]?.url || null,
      color: c.color,
      rarity: c.rarity,
    })),
  };
}
