/**
 * Busca do assistente de regras: BM25 em memória sobre os documentos (~650, montagem em poucos ms), com sinais do
 * jogo por cima — código ou nome de carta na pergunta traz o FAQ dessa carta; keyword reconhecida traz o verbete e os
 * rulings dela. Sem banco e sem embeddings: testável e trocável por FTS/pgvector se o corpus crescer muito.
 */
import type { RuleDoc } from "./corpus.ts";
import { normalizeText, tokenize } from "./normalize.ts";

const K1 = 1.2;
const B = 0.75;
/** código de carta: GD01-001, ST01-010, EB01-005, EXB-001, R-001 */
const CARD_CODE_RE = /\b([a-z]{1,4}\d{0,2}-\d{3})\b/gi;

export type ScoredDoc = { doc: RuleDoc; score: number; reasons: string[] };
export type SearchResult = { results: ScoredDoc[]; cardCodes: string[]; keywords: string[] };

type Indexed = { doc: RuleDoc; tf: Map<string, number>; length: number };

function weightedTokens(doc: RuleDoc): string[] {
  // a pergunta pesa mais que a resposta: é onde está o assunto do ruling
  const q = tokenize(doc.questionPt);
  return [...tokenize(doc.title), ...q, ...q, ...tokenize(doc.answerPt), ...tokenize(doc.questionEn ?? ""), ...(doc.keyword ? [doc.keyword, doc.keyword] : [])];
}

export function cardCodesIn(text: string): string[] {
  return [...new Set([...text.matchAll(CARD_CODE_RE)].map((m) => m[1].toUpperCase()))];
}

export class RulesIndex {
  private readonly items: Indexed[];
  private readonly df = new Map<string, number>();
  private readonly avgLength: number;
  private readonly keywordTerms: Set<string>;
  /** nome normalizado da carta → códigos (só nomes com 4+ letras, para não casar palavra comum) */
  private readonly cardNames = new Map<string, Set<string>>();

  constructor(readonly docs: RuleDoc[]) {
    this.items = docs.map((doc) => {
      const tokens = weightedTokens(doc);
      const tf = new Map<string, number>();
      for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
      for (const t of tf.keys()) this.df.set(t, (this.df.get(t) ?? 0) + 1);
      return { doc, tf, length: tokens.length };
    });
    this.avgLength = this.items.reduce((sum, it) => sum + it.length, 0) / Math.max(1, this.items.length);
    this.keywordTerms = new Set(docs.map((d) => d.keyword).filter((k): k is string => Boolean(k)));
    for (const d of docs) {
      if (!d.cardName || !d.cardCode) continue;
      const name = normalizeText(d.cardName);
      if (name.replace(/\s/g, "").length < 4) continue;
      if (!this.cardNames.has(name)) this.cardNames.set(name, new Set());
      this.cardNames.get(name)!.add(d.cardCode);
    }
  }

  get size(): number {
    return this.items.length;
  }

  private idf(term: string): number {
    const n = this.df.get(term) ?? 0;
    return Math.log(1 + (this.items.length - n + 0.5) / (n + 0.5));
  }

  /** códigos citados ou cartas reconhecidas pelo nome */
  detectCards(question: string, extraCodes: string[] = []): string[] {
    const codes = new Set([...cardCodesIn(question), ...extraCodes.map((c) => c.toUpperCase())]);
    const q = ` ${normalizeText(question)} `;
    for (const [name, nameCodes] of this.cardNames) {
      if (q.includes(` ${name} `)) for (const c of nameCodes) codes.add(c);
    }
    return [...codes];
  }

  search(question: string, { limit = 8, cardCodes: extraCodes = [] }: { limit?: number; cardCodes?: string[] } = {}): SearchResult {
    const terms = [...new Set(tokenize(question))];
    const cardCodes = this.detectCards(question, extraCodes);
    const codeSet = new Set(cardCodes);
    const keywords = terms.filter((t) => this.keywordTerms.has(t));
    const kwSet = new Set(keywords);

    const scored: ScoredDoc[] = [];
    for (const it of this.items) {
      let score = 0;
      for (const term of terms) {
        const f = it.tf.get(term);
        if (!f) continue;
        score += (this.idf(term) * f * (K1 + 1)) / (f + K1 * (1 - B + (B * it.length) / this.avgLength));
      }
      const reasons: string[] = [];
      if (it.doc.cardCode && codeSet.has(it.doc.cardCode)) {
        score += 6;
        reasons.push("carta");
      }
      if (it.doc.keyword && kwSet.has(it.doc.keyword)) {
        score += it.doc.kind === "keyword" ? 4 : 2;
        reasons.push("keyword");
      }
      if (score > 0) scored.push({ doc: it.doc, score, reasons });
    }
    scored.sort((a, b) => b.score - a.score || a.doc.id.localeCompare(b.doc.id));
    return { results: scored.slice(0, limit), cardCodes, keywords };
  }
}
