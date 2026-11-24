/**
 * Documentos do assistente de regras: rulings gerais, FAQ oficial por carta, verbetes do glossário de keywords e
 * (sob demanda) o texto da carta citada. Em produção vêm do banco; nos testes e na avaliação, de `data/`.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { ALL_KEYWORDS } from "../../src/i18n/keywords.ts";
import { canonicalTerm } from "./normalize.ts";

export type RuleDocKind = "ruling" | "card_faq" | "keyword" | "card_text";

export type RuleDoc = {
  id: string;
  kind: RuleDocKind;
  title: string;
  questionPt: string;
  answerPt: string;
  questionEn?: string;
  answerEn?: string;
  /** termo canônico da keyword ligada (`canonicalTerm`) */
  keyword?: string;
  phase?: string;
  cardCode?: string;
  cardName?: string;
  /** link interno do portal */
  href: string;
  officialUrl?: string;
  /** pt gerado por tradução automática (FAQ de carta) */
  autoTranslated?: boolean;
};

/** linha do `Ruling` com o modelo da carta (select da rota) */
export type RulingRow = {
  id: string;
  sourceType: string;
  title: string;
  questionPt: string | null;
  answerPt: string | null;
  questionEn: string | null;
  answerEn: string | null;
  relatedKeyword: string | null;
  relatedPhase: string | null;
  originalUrl: string | null;
  cardModel?: { code: string; nameEn: string; namePt: string | null } | null;
};

export function docFromRulingRow(row: RulingRow): RuleDoc | null {
  const questionPt = row.questionPt?.trim() || row.questionEn?.trim() || "";
  const answerPt = row.answerPt?.trim() || row.answerEn?.trim() || "";
  if (!questionPt || !answerPt) return null;
  const card = row.cardModel ?? null;
  return {
    id: row.id,
    kind: card ? "card_faq" : "ruling",
    title: card ? `${card.code} ${card.namePt || card.nameEn}` : row.title,
    questionPt,
    answerPt,
    questionEn: row.questionEn ?? undefined,
    answerEn: row.answerEn ?? undefined,
    keyword: row.relatedKeyword ? canonicalTerm(row.relatedKeyword) ?? undefined : undefined,
    phase: row.relatedPhase ?? undefined,
    cardCode: card?.code,
    cardName: card ? card.namePt || card.nameEn : undefined,
    href: `/rules/${row.id}`,
    officialUrl: row.originalUrl ?? undefined,
    autoTranslated: card ? true : undefined,
  };
}

export function keywordDocs(): RuleDoc[] {
  return ALL_KEYWORDS.map((k) => ({
    id: `kw:${k.id}`,
    kind: "keyword" as const,
    title: k.raw,
    questionPt: `O que faz ${k.name}?`,
    answerPt: [k.descriptionPt, k.examplePt].filter(Boolean).join(" "),
    questionEn: k.name,
    answerEn: k.descriptionEn,
    keyword: canonicalTerm(k.name) ?? undefined,
    href: "/rules",
  }));
}

export function cardTextDoc(card: { code: string; nameEn: string; namePt: string | null; effectPt: string | null; effectEn: string | null }): RuleDoc | null {
  const effect = card.effectPt?.trim() || card.effectEn?.trim();
  if (!effect) return null;
  const name = card.namePt || card.nameEn;
  return {
    id: `card:${card.code}`,
    kind: "card_text",
    title: `${card.code} ${name}`,
    questionPt: `Texto da carta ${card.code} ${name}`,
    answerPt: effect,
    cardCode: card.code,
    cardName: name,
    href: `/cards/${card.code}`,
  };
}

type FileRuling = {
  sourceType: string;
  title: string;
  relatedKeyword?: string | null;
  relatedPhase?: string | null;
  originalUrl?: string | null;
  questionEn?: string;
  answerEn?: string;
  questionPt?: string;
  answerPt?: string;
};
type FileCardFaq = { id: string; question: string; answer: string; questionPt?: string; answerPt?: string };

/** corpus a partir de `data/` (testes e avaliação; não depende do banco) */
export function loadFileCorpus(root: string): RuleDoc[] {
  const docs: RuleDoc[] = [];
  for (let i = 1; i <= 9; i++) {
    let batch: FileRuling[];
    try {
      batch = JSON.parse(readFileSync(path.join(root, `data/rulings-batch-0${i}.json`), "utf8"));
    } catch {
      continue;
    }
    batch.forEach((r, j) => {
      const doc = docFromRulingRow({
        id: `file:${i}:${j}`,
        sourceType: r.sourceType,
        title: r.title,
        questionPt: r.questionPt ?? null,
        answerPt: r.answerPt ?? null,
        questionEn: r.questionEn ?? null,
        answerEn: r.answerEn ?? null,
        relatedKeyword: r.relatedKeyword ?? null,
        relatedPhase: r.relatedPhase ?? null,
        originalUrl: r.originalUrl ?? null,
      });
      if (doc) docs.push(doc);
    });
  }
  const faq = JSON.parse(readFileSync(path.join(root, "data/gcg-official-faq.json"), "utf8")) as Record<string, FileCardFaq[]>;
  for (const [code, entries] of Object.entries(faq)) {
    for (const e of entries) {
      const doc = docFromRulingRow({
        id: `file:${code}:${e.id}`,
        sourceType: "OFFICIAL_FAQ",
        title: code,
        questionPt: e.questionPt ?? null,
        answerPt: e.answerPt ?? null,
        questionEn: e.question,
        answerEn: e.answer,
        relatedKeyword: null,
        relatedPhase: null,
        originalUrl: null,
        cardModel: { code, nameEn: code, namePt: null },
      });
      if (doc) docs.push({ ...doc, title: code, cardName: undefined });
    }
  }
  return [...docs, ...keywordDocs()];
}
