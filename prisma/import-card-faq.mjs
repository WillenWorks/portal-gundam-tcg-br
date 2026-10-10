/**
 * Importa o Q&A oficial por carta (gundam-gcg.com, página de detalhe de cada carta) como Ruling OFFICIAL_FAQ
 * vinculado ao CardModel e à impressão principal. Lê o JSON gerado por scripts/gundam-fetch-official-set.mjs
 * ({ "ST12-001": [{ id: "Q427", date, question, answer }] }). Idempotente: a chave é o link da pergunta
 * (detail.php?detailSearch=<código>#<id>). Também desativa FAQs repetidas no mesmo modelo (mesma pergunta).
 * A tradução pt-BR fica "pending" — a página mostra o inglês até alguém revisar.
 *
 *   node prisma/import-card-faq.mjs                         # simulação, data/gcg-official-faq.json
 *   node prisma/import-card-faq.mjs --file=faq.json --apply
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const OFFICIAL_DETAIL = "https://www.gundam-gcg.com/en/cards/detail.php?detailSearch=";

export const faqUrl = (code, id) => `${OFFICIAL_DETAIL}${code}#${id}`;
export const questionKey = (text) => String(text ?? "").trim().toLowerCase().replace(/\s+/g, " ");

/** "September 11, 2026" → Date (ou null) */
export function parseOfficialDate(raw) {
  if (!raw) return null;
  const d = new Date(`${raw} UTC`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Linhas a criar para um modelo, ignorando as que já existem (pelo link ou pela pergunta). */
export function planModelFaq(code, entries, existing) {
  const urls = new Set(existing.map((r) => r.originalUrl).filter(Boolean));
  const questions = new Set(existing.map((r) => questionKey(r.questionEn)).filter(Boolean));
  const out = [];
  for (const e of entries) {
    const url = faqUrl(code, e.id);
    const key = questionKey(e.question);
    if (!e.question || !e.answer || urls.has(url) || questions.has(key)) continue;
    urls.add(url);
    questions.add(key);
    out.push({ url, question: e.question.trim(), answer: e.answer.trim(), date: parseOfficialDate(e.date), id: e.id });
  }
  return out;
}

/** Ids das FAQs repetidas num mesmo modelo (fica a mais antiga). */
export function duplicateRulingIds(rulings) {
  const seen = new Set();
  const dup = [];
  for (const r of [...rulings].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))) {
    const key = `${r.cardModelId}|${questionKey(r.questionEn || r.questionPt || r.title)}`;
    if (seen.has(key)) dup.push(r.id);
    else seen.add(key);
  }
  return dup;
}

async function main() {
  const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")).map(([k, v]) => [k, v ?? "true"]));
  const apply = args.apply === "true";
  const file = path.resolve(String(args.file ?? fileURLToPath(new URL("../data/gcg-official-faq.json", import.meta.url))));
  const faq = JSON.parse(await readFile(file, "utf8"));
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  try {
    console.log(`${apply ? "APLICANDO" : "SIMULAÇÃO (nada é gravado)"} — ${Object.keys(faq).length} cartas com Q&A em ${path.basename(file)}`);

    const active = await prisma.ruling.findMany({ where: { isActive: true, cardModelId: { not: null } } });
    const dups = duplicateRulingIds(active);
    console.log(`FAQs repetidas no mesmo modelo: ${dups.length}`);
    if (apply && dups.length) {
      await prisma.ruling.updateMany({ where: { id: { in: dups } }, data: { isActive: false, deletedAt: new Date() } });
    }

    let created = 0;
    let missing = 0;
    for (const [code, entries] of Object.entries(faq)) {
      const model = await prisma.cardModel.findUnique({
        where: { code },
        include: { prints: { where: { isActive: true }, orderBy: [{ isPrimaryPrint: "desc" }, { createdAt: "asc" }], take: 1 } },
      });
      if (!model) {
        missing += 1;
        continue;
      }
      const existing = await prisma.ruling.findMany({ where: { cardModelId: model.id, isActive: true } });
      const plan = planModelFaq(code, entries, existing);
      if (!plan.length) continue;
      created += plan.length;
      if (!apply) continue;
      await prisma.ruling.createMany({
        data: plan.map((p) => ({
          sourceType: "OFFICIAL_FAQ",
          title: p.question,
          questionEn: p.question,
          answerEn: p.answer,
          originalUrl: p.url,
          officialUpdatedAt: p.date,
          translationStatus: "pending",
          cardId: model.prints[0]?.id ?? null,
          cardModelId: model.id,
        })),
      });
    }
    console.log(`Perguntas novas: ${created}${missing ? ` · ${missing} código(s) sem carta no catálogo` : ""}`);
    if (!apply) console.log("Para gravar: node prisma/import-card-faq.mjs --apply");
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
