#!/usr/bin/env node
/**
 * Avaliação do assistente de regras com o modelo de verdade (gasta API: ~50 perguntas no Haiku ≈ US$ 0,03).
 * Corpus de `data/` (o mesmo dos testes), perguntas de `server/rulesAssistant/golden.json`.
 *
 *   pnpm rules:eval                       # Claude (ANTHROPIC_API_KEY)
 *   pnpm rules:eval -- --model=gemini     # Gemini Flash (GEMINI_API_KEY)
 *   pnpm rules:eval -- --limit=10 --out=docs/rules-eval/teste.json
 *
 * Mede: perguntas respondíveis com resposta citando a fonte esperada, sem-resposta que viraram "não encontrei",
 * e grava todas as respostas no --out para a revisão humana (meta da spec: 17 de 20 corretas e úteis).
 */
import { register } from "tsx/esm/api";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

register();
const ROOT = path.resolve(import.meta.dirname, "..");
const mod = (p) => import(pathToFileURL(path.join(ROOT, p)).href);
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, "").split("="); return [k, v ?? "true"]; }));

const { loadFileCorpus } = await mod("server/rulesAssistant/corpus.ts");
const { RulesIndex } = await mod("server/rulesAssistant/rulesIndex.ts");
const { answerQuestion, claudeRulesLlm, geminiRulesLlm } = await mod("server/rulesAssistant/ask.ts");

const useGemini = args.model === "gemini";
const key = useGemini ? process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY : process.env.ANTHROPIC_API_KEY;
if (!key) {
  console.error(`[rules-eval] falta ${useGemini ? "GEMINI_API_KEY" : "ANTHROPIC_API_KEY"} no ambiente`);
  process.exit(2);
}
const llm = useGemini ? geminiRulesLlm(key) : claudeRulesLlm(key);
const index = new RulesIndex(loadFileCorpus(ROOT));
const golden = JSON.parse(fs.readFileSync(path.join(ROOT, "server/rulesAssistant/golden.json"), "utf8")).questions;
const questions = golden.slice(0, Number(args.limit ?? golden.length));

const rows = [];
let answeredOk = 0, answerable = 0, refusedOk = 0, unanswerable = 0, tokensIn = 0, tokensOut = 0;
for (const g of questions) {
  const docs = index.search(g.q, { limit: 8 }).results.map((r) => r.doc);
  const t0 = Date.now();
  const out = await answerQuestion(g.q, docs, [llm]);
  tokensIn += out.inputTokens ?? 0;
  tokensOut += out.outputTokens ?? 0;
  const cited = out.citations.map((n) => out.sources[n - 1]);
  let ok;
  if (g.expect.length) {
    answerable++;
    ok = !out.notFound && cited.some((d) => g.expect.some((e) => d.questionPt.includes(e)));
    if (ok) answeredOk++;
  } else {
    unanswerable++;
    ok = out.notFound;
    if (ok) refusedOk++;
  }
  rows.push({ q: g.q, ok, notFound: out.notFound, answer: out.answer, cited: cited.map((d) => d.questionPt), model: out.model, ms: Date.now() - t0 });
  console.log(`${ok ? "ok " : "XX "} ${g.q.slice(0, 60).padEnd(60)} ${out.notFound ? "(não encontrei)" : out.answer.slice(0, 80)}`);
}
console.log(`\n[rules-eval] respondíveis com a fonte certa: ${answeredOk}/${answerable}`);
console.log(`[rules-eval] sem resposta reconhecidas: ${refusedOk}/${unanswerable} (meta ≥ 8/10)`);
console.log(`[rules-eval] tokens: ${tokensIn} entrada, ${tokensOut} saída`);
// docs/ fica só local (repositório público)
const outPath = path.resolve(ROOT, String(args.out ?? `docs/rules-eval/${new Date().toISOString().slice(0, 10)}-${useGemini ? "gemini" : "claude"}.json`));
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify({ date: new Date().toISOString(), model: useGemini ? "gemini" : "claude", answeredOk, answerable, refusedOk, unanswerable, tokensIn, tokensOut, rows }, null, 2)}\n`);
console.log(`[rules-eval] respostas: ${path.relative(ROOT, outPath)}`);
