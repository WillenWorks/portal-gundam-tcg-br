/**
 * Resposta do assistente de regras: uma chamada de LLM sobre os trechos achados pela busca, com guarda-rail.
 * O modelo só pode afirmar o que os trechos dizem e cita cada um por número; a resposta sem citação válida vira
 * "não encontrei". Claude Haiku 5.5 (barato e obediente ao formato), com o Gemini Flash de reserva.
 */
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import type { RuleDoc } from "./corpus.ts";

export const RULES_CLAUDE_MODEL = "claude-haiku-5-5";
export const RULES_GEMINI_MODEL = "gemini-3.8-flash";
/** trechos mandados ao modelo (os primeiros da busca) */
export const RULES_CONTEXT_DOCS = 6;

export const RulesAnswerSchema = z.object({
  answer: z.string().describe("Resposta em pt-BR, até 120 palavras, com [n] depois de cada afirmação"),
  citations: z.array(z.number().int()).describe("Números dos trechos usados"),
  notFound: z.boolean().describe("true se os trechos não respondem a pergunta"),
});
export type RulesAnswer = z.infer<typeof RulesAnswerSchema>;

export type LlmResult = { output: unknown; model: string; inputTokens?: number; outputTokens?: number };
/** chamada ao modelo (injetável nos testes) */
export type RulesLlm = (system: string, user: string) => Promise<LlmResult | null>;

export const RULES_SYSTEM_PROMPT = `Você é o assistente de regras do Anaheim Hub, portal brasileiro do Gundam Card Game.
Responda à pergunta do jogador usando SOMENTE os trechos numerados enviados (rulings, FAQ oficial, glossário, texto de carta).

Regras:
- Escreva em português do Brasil, direto, em até 120 palavras.
- Depois de cada afirmação, cite o trecho que a sustenta com [n]. Não afirme nada que os trechos não digam.
- Mantenha em inglês os nomes oficiais de keywords e timings (<Blocker>, 【Deploy】, Burst, Link) e os nomes de carta.
- Não copie frases inteiras dos trechos em inglês: explique com suas palavras.
- Se os trechos não respondem à pergunta, ou ela não é sobre as regras do jogo (preço, lista de deck, torneio, anime),
  devolva notFound = true, answer vazio e citations vazio. Não tente adivinhar.
- Se a resposta depende de algo que o jogador não disse, responda os casos possíveis em poucas palavras.`;

function sourceLabel(doc: RuleDoc): string {
  if (doc.kind === "card_faq") return `FAQ oficial da carta ${doc.cardCode}`;
  if (doc.kind === "card_text") return `texto da carta ${doc.cardCode}`;
  if (doc.kind === "keyword") return `glossário ${doc.title}`;
  return `ruling "${doc.title}"`;
}

export function buildUserPrompt(question: string, docs: RuleDoc[]): string {
  const blocks = docs.map((d, i) => `[${i + 1}] (${sourceLabel(d)})\nP: ${d.questionPt}\nR: ${d.answerPt}`);
  return `Trechos:\n\n${blocks.join("\n\n")}\n\nPergunta do jogador: ${question}`;
}

/** validação: citações dentro dos trechos, cada [n] do texto citado; sem citação válida → não encontrado */
export function validateAnswer(raw: unknown, docCount: number): RulesAnswer {
  const parsed = RulesAnswerSchema.safeParse(raw);
  if (!parsed.success) return { answer: "", citations: [], notFound: true };
  const { answer, notFound } = parsed.data;
  const inRange = (n: number) => n >= 1 && n <= docCount;
  const inText = [...answer.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1]));
  if (inText.some((n) => !inRange(n))) return { answer: "", citations: [], notFound: true };
  const citations = [...new Set([...parsed.data.citations.filter(inRange), ...inText])].sort((a, b) => a - b);
  if (notFound || !answer.trim() || citations.length === 0 || inText.length === 0) return { answer: "", citations: [], notFound: true };
  return { answer: answer.trim(), citations, notFound: false };
}

export function claudeRulesLlm(apiKey: string): RulesLlm {
  const client = new Anthropic({ apiKey, timeout: 30_000, maxRetries: 1 });
  return async (system, user) => {
    const response = await client.beta.messages.parse({
      model: RULES_CLAUDE_MODEL,
      max_tokens: 2000,
      // resposta curta e factual: pouco raciocínio basta
      output_config: { effort: "low", format: betaZodOutputFormat(RulesAnswerSchema) },
      system,
      messages: [{ role: "user", content: user }],
    });
    if (response.stop_reason === "refusal") {
      console.warn("[rulesAssistant] Claude recusou:", response.stop_details?.category ?? "sem categoria");
      return null;
    }
    return {
      output: response.parsed_output,
      model: RULES_CLAUDE_MODEL,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    };
  };
}

export function geminiRulesLlm(apiKey: string): RulesLlm {
  const ai = new GoogleGenAI({ apiKey, httpOptions: { timeout: 25_000, retryOptions: { attempts: 1 } } });
  return async (system, user) => {
    const response = await ai.models.generateContent({
      model: RULES_GEMINI_MODEL,
      contents: user,
      config: {
        systemInstruction: `${system}\n\nResponda só com JSON: {"answer": string, "citations": number[], "notFound": boolean}.`,
        responseMimeType: "application/json",
      },
    });
    return {
      output: JSON.parse(response.text?.trim() || "{}"),
      model: RULES_GEMINI_MODEL,
      inputTokens: response.usageMetadata?.promptTokenCount,
      outputTokens: response.usageMetadata?.candidatesTokenCount,
    };
  };
}

/** modelos na ordem de uso, conforme as chaves configuradas (sem chave: lista vazia, a rota responde só com a busca) */
export function rulesLlmsFromEnv(env: NodeJS.ProcessEnv = process.env): RulesLlm[] {
  const llms: RulesLlm[] = [];
  const claudeKey = (env.ANTHROPIC_API_KEY || "").trim();
  const geminiKey = (env.GEMINI_API_KEY || env.GOOGLE_GENAI_API_KEY || "").trim();
  if (claudeKey) llms.push(claudeRulesLlm(claudeKey));
  if (geminiKey) llms.push(geminiRulesLlm(geminiKey));
  return llms;
}

export type AskOutcome = RulesAnswer & { sources: RuleDoc[]; model: string | null; inputTokens?: number; outputTokens?: number };

/** pergunta → resposta validada; tenta cada modelo na ordem e cai em "não encontrado" se nenhum responder */
export async function answerQuestion(question: string, docs: RuleDoc[], llms: RulesLlm[]): Promise<AskOutcome> {
  const context = docs.slice(0, RULES_CONTEXT_DOCS);
  if (context.length === 0 || llms.length === 0) return { answer: "", citations: [], notFound: true, sources: context, model: null };
  const user = buildUserPrompt(question, context);
  for (const llm of llms) {
    try {
      const result = await llm(RULES_SYSTEM_PROMPT, user);
      if (!result) continue;
      const checked = validateAnswer(result.output, context.length);
      return { ...checked, sources: context, model: result.model, inputTokens: result.inputTokens, outputTokens: result.outputTokens };
    } catch (err) {
      console.warn("[rulesAssistant] modelo falhou:", err instanceof Error ? err.message : err);
    }
  }
  return { answer: "", citations: [], notFound: true, sources: context, model: null };
}
