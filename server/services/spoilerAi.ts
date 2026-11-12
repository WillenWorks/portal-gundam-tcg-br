/* Texto livre em JSON para o resumo de spoilers: Gemini (modelos das legendas) → Claude → null. */
import { GoogleGenAI } from "@google/genai";
import Anthropic from "@anthropic-ai/sdk";
import { CLAUDE_SOCIAL_MODEL, GEMINI_HTTP_OPTIONS, GEMINI_SOCIAL_MODELS } from "./socialPublisherService.ts";

export async function generateJsonWithAi(prompt: string): Promise<unknown | null> {
  const geminiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY || "").trim();
  const claudeKey = (process.env.ANTHROPIC_API_KEY || "").trim();
  if (geminiKey) {
    const ai = new GoogleGenAI({ apiKey: geminiKey, httpOptions: { ...GEMINI_HTTP_OPTIONS, timeout: 60_000 } });
    const custom = process.env.GEMINI_SOCIAL_MODEL?.trim();
    for (const model of custom ? [custom, ...GEMINI_SOCIAL_MODELS.filter((m) => m !== custom)] : GEMINI_SOCIAL_MODELS) {
      try {
        const response = await ai.models.generateContent({ model, contents: prompt, config: { responseMimeType: "application/json" } });
        return JSON.parse(response.text?.trim() || "null") as unknown;
      } catch (err) {
        console.warn(`[spoilers] Gemini (${model}) falhou:`, err instanceof Error ? err.message : err);
      }
    }
  }
  if (claudeKey) {
    try {
      const client = new Anthropic({ apiKey: claudeKey, timeout: 120_000, maxRetries: 1 });
      const response = await client.messages.create({ model: CLAUDE_SOCIAL_MODEL, max_tokens: 6000, messages: [{ role: "user", content: prompt }] });
      const text = response.content.map((b) => (b.type === "text" ? b.text : "")).join("");
      const json = /\{[\s\S]*\}/.exec(text)?.[0];
      return json ? (JSON.parse(json) as unknown) : null;
    } catch (err) {
      console.warn("[spoilers] Claude falhou:", err instanceof Error ? err.message : err);
    }
  }
  return null;
}
