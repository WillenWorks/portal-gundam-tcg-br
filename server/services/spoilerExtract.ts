/* Leitura de uma imagem de spoiler pela IA: nome, código, tipo, cor, nível, custo, AP/HP, traits e efeito.
 *
 * Gemini (os mesmos modelos das legendas) → Claude (com ANTHROPIC_API_KEY) → nada. Sem leitura, o spoiler fica
 * FAILED e aparece no aviso do Discord para conferir à mão; nunca entra carta inventada no catálogo.
 * A resposta da IA passa por normalizeSpoilerCard (pura, testada): campo fora do formato vira null em vez de ir
 * para o banco. */
import { GoogleGenAI } from "@google/genai";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { CARD_CODE_PATTERN, CLAUDE_SOCIAL_MODEL, GEMINI_HTTP_OPTIONS, GEMINI_SOCIAL_MODELS } from "./socialPublisherService.ts";

export const SPOILER_CARD_TYPES = ["UNIT", "PILOT", "COMMAND", "BASE", "RESOURCE"] as const;
export type SpoilerCardType = (typeof SPOILER_CARD_TYPES)[number];
export const SPOILER_COLORS = ["Blue", "Green", "Red", "White", "Purple", "Yellow"] as const;

export type SpoilerCardData = {
  code: string | null;
  nameEn: string;
  cardType: SpoilerCardType;
  color: string | null;
  level: number | null;
  cost: number | null;
  ap: number | null;
  hp: number | null;
  rarity: string | null;
  traits: string[];
  /** condição de Link, como impressa (ex.: "[Amuro Ray]" ou "(Earth Federation) Trait") */
  linkText: string | null;
  /** texto do efeito em inglês, com as palavras-chave como no jogo: <Blocker>, 【Deploy】 */
  effectEn: string | null;
  /** o mesmo efeito em português, palavras-chave em inglês */
  effectPt: string | null;
  /** o texto impresso não estava em inglês e effectEn é tradução da IA */
  translated: boolean;
};

/** Formato pedido à IA (a mesma estrutura para Gemini e Claude). */
const RawSchema = z.object({
  isCard: z.boolean(),
  code: z.string().nullable(),
  nameEn: z.string().nullable(),
  cardType: z.string().nullable(),
  color: z.string().nullable(),
  level: z.number().nullable(),
  cost: z.number().nullable(),
  ap: z.number().nullable(),
  hp: z.number().nullable(),
  rarity: z.string().nullable(),
  traits: z.array(z.string()),
  linkText: z.string().nullable(),
  effectEn: z.string().nullable(),
  effectPt: z.string().nullable(),
  printedLanguage: z.string().nullable(),
});
type RawCard = z.infer<typeof RawSchema>;

export const SPOILER_EXTRACT_PROMPT = `Você lê imagens de spoilers do Gundam Card Game (Bandai) para um portal brasileiro de fãs.
A imagem pode ser uma carta, várias cartas ou outra coisa (banner, produto, texto). Leia SÓ o que está impresso.

Se a imagem não mostrar UMA carta legível em destaque, responda {"isCard": false} com os demais campos null/[].
Se mostrar, preencha:
- code: código impresso (ex.: GD07-012, ST10-003). null se não aparecer.
- nameEn: nome da carta como impresso. Não traduza.
- cardType: UNIT, PILOT, COMMAND, BASE ou RESOURCE.
- color: Blue, Green, Red, White, Purple ou Yellow (em inglês).
- level, cost, ap, hp: números impressos (null se a carta não tiver).
- rarity: C, U, R, LR, P ou o que estiver impresso (null se não aparecer).
- traits: os traits entre parênteses, sem os parênteses (ex.: ["Earth Federation", "White Base Team"]).
- linkText: a condição de Link como impressa (ex.: "[Amuro Ray]" ou "(Zeon) Trait"); null se não houver.
- effectEn: o texto do efeito em inglês, mantendo as palavras-chave como no jogo: <Blocker>, <Repair 2>, <Breach 3>, 【Deploy】, 【Attack】, 【When Paired】, 【Burst】, 【Activate･Main】. Quebra de linha entre parágrafos. Se a carta estiver em japonês, traduza para o inglês usando a redação oficial das cartas em inglês.
- effectPt: o mesmo efeito em português do Brasil, mantendo em inglês os nomes de cartas, personagens e palavras-chave.
- printedLanguage: "en", "ja" ou outro código do idioma impresso.
Nunca invente número ou texto que não dá para ler: use null.
Responda APENAS com JSON válido nesse formato.`;

const clampInt = (value: unknown, min: number, max: number): number | null => {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const n = Math.round(value);
  return n >= min && n <= max ? n : null;
};

const cleanText = (value: unknown, max: number): string | null => {
  if (typeof value !== "string") return null;
  const text = value.replace(/\r/g, "").replace(/[ \t]+\n/g, "\n").trim();
  return text ? text.slice(0, max) : null;
};

/** Valida e arruma a resposta da IA. `null` = não é carta ou faltou o essencial (nome e tipo). */
export function normalizeSpoilerCard(raw: unknown): SpoilerCardData | null {
  const parsed = RawSchema.partial().safeParse(raw);
  if (!parsed.success) return null;
  const r = parsed.data as Partial<RawCard>;
  if (r.isCard === false) return null;
  const nameEn = cleanText(r.nameEn, 120);
  const cardType = String(r.cardType || "").trim().toUpperCase() as SpoilerCardType;
  if (!nameEn || !SPOILER_CARD_TYPES.includes(cardType)) return null;
  const code = cleanText(r.code, 24)?.toUpperCase().replace(/\s+/g, "") ?? null;
  const color = SPOILER_COLORS.find((c) => c.toLowerCase() === String(r.color || "").trim().toLowerCase()) ?? null;
  const traits = [...new Set((r.traits ?? []).map((t) => String(t).replace(/^[(\s]+|[)\s]+$/g, "").trim()).filter((t) => t && t.length <= 60))].slice(0, 6);
  const isUnit = cardType === "UNIT";
  return {
    code: code && CARD_CODE_PATTERN.test(code) ? code : null,
    nameEn,
    cardType,
    color,
    level: clampInt(r.level, 0, 12),
    cost: clampInt(r.cost, 0, 15),
    ap: isUnit || cardType === "BASE" ? clampInt(r.ap, 0, 30) : null,
    hp: isUnit || cardType === "BASE" ? clampInt(r.hp, 0, 30) : null,
    rarity: cleanText(r.rarity, 8)?.toUpperCase() ?? null,
    traits,
    linkText: isUnit ? cleanText(r.linkText, 120) : null,
    effectEn: cleanText(r.effectEn, 2000),
    effectPt: cleanText(r.effectPt, 2400),
    translated: Boolean(r.printedLanguage && !/^en/i.test(r.printedLanguage)),
  };
}

export type SpoilerExtraction = { card: SpoilerCardData | null; provider: "gemini" | "claude" | null; model: string | null; error?: string };

type ImageInput = { data: Buffer; mimeType: string };

async function extractWithGemini(image: ImageInput, hint: string, apiKey: string): Promise<SpoilerExtraction | null> {
  const ai = new GoogleGenAI({ apiKey, httpOptions: { ...GEMINI_HTTP_OPTIONS, timeout: 60_000 } });
  const custom = process.env.GEMINI_SOCIAL_MODEL?.trim();
  const models = custom ? [custom, ...GEMINI_SOCIAL_MODELS.filter((m) => m !== custom)] : GEMINI_SOCIAL_MODELS;
  for (const model of models) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: [
          {
            role: "user",
            parts: [{ text: `${SPOILER_EXTRACT_PROMPT}${hint}` }, { inlineData: { mimeType: image.mimeType, data: image.data.toString("base64") } }],
          },
        ],
        config: { responseMimeType: "application/json" },
      });
      const json = JSON.parse(response.text?.trim() || "{}") as unknown;
      return { card: normalizeSpoilerCard(json), provider: "gemini", model };
    } catch (err) {
      console.warn(`[spoilers] Gemini (${model}) não leu a imagem:`, err instanceof Error ? err.message : err);
    }
  }
  return null;
}

async function extractWithClaude(image: ImageInput, hint: string, apiKey: string): Promise<SpoilerExtraction | null> {
  const mediaType = image.mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp";
  if (!["image/jpeg", "image/png", "image/gif", "image/webp"].includes(mediaType)) return null;
  try {
    const client = new Anthropic({ apiKey, timeout: 120_000, maxRetries: 1 });
    const response = await client.messages.create({
      model: CLAUDE_SOCIAL_MODEL,
      max_tokens: 4000,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: image.data.toString("base64") } },
            { type: "text", text: `${SPOILER_EXTRACT_PROMPT}${hint}` },
          ],
        },
      ],
    });
    const text = response.content.map((block) => (block.type === "text" ? block.text : "")).join("");
    const json = /\{[\s\S]*\}/.exec(text)?.[0];
    return { card: json ? normalizeSpoilerCard(JSON.parse(json)) : null, provider: "claude", model: CLAUDE_SOCIAL_MODEL };
  } catch (err) {
    console.warn("[spoilers] Claude não leu a imagem:", err instanceof Error ? err.message : err);
    return null;
  }
}

/** Lê a carta da imagem. `messageText` (o texto da mensagem do Discord) entra como pista, não como verdade. */
export async function extractSpoilerCard(image: ImageInput, messageText?: string | null): Promise<SpoilerExtraction> {
  const hint = messageText?.trim() ? `\n\nTexto que acompanhava a imagem (pode ajudar a confirmar nome e código; a imagem manda):\n"""${messageText.trim().slice(0, 800)}"""` : "";
  const geminiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY || "").trim();
  const claudeKey = (process.env.ANTHROPIC_API_KEY || "").trim();
  if (!geminiKey && !claudeKey) return { card: null, provider: null, model: null, error: "Sem GEMINI_API_KEY nem ANTHROPIC_API_KEY para ler a imagem." };
  const fromGemini = geminiKey ? await extractWithGemini(image, hint, geminiKey) : null;
  if (fromGemini?.card) return fromGemini;
  const fromClaude = claudeKey ? await extractWithClaude(image, hint, claudeKey) : null;
  if (fromClaude?.card) return fromClaude;
  const answered = fromGemini ?? fromClaude;
  return answered
    ? { ...answered, error: "A imagem não parece ser uma carta legível." }
    : { card: null, provider: null, model: null, error: "Nenhuma IA respondeu." };
}
