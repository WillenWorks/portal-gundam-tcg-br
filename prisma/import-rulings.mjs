/*
 * Importa Rulings a partir de lotes JSON (data/rulings-batch-*.json). Cada lote e um
 * array de objetos batendo com os campos do model Ruling. Conteudo e redacao
 * ORIGINAL em EN+PT, baseada nos fatos das FAQs oficiais (gundam-gcg.com/en/rules/
 * faqs) mas reescrita do zero -- nao e traducao literal, o site oficial diz
 * explicitamente que o conteudo dele "nao pode ser copiado sem permissao".
 *
 * Idempotente: usa questionEn como chave de identificacao (nao existe constraint
 * unica formal no schema pra isso, entao o script checa antes de criar). Rodar de
 * novo com o mesmo lote nao duplica, só teria efeito se o TEXTO de questionEn
 * mudasse entre uma rodada e outra (nesse caso cria uma entrada nova -- rever
 * manualmente se isso acontecer sem intencao).
 *
 * Modos:
 *   node prisma/import-rulings.mjs           -> dry-run (padrao)
 *   node prisma/import-rulings.mjs --apply   -> aplica de verdade
 */
import { PrismaClient } from "@prisma/client";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

const APPLY = process.argv.includes("--apply");
const dataDir = fileURLToPath(new URL("../data", import.meta.url));

async function loadBatches() {
  const files = (await readdir(dataDir)).filter((f) => f.startsWith("rulings-batch-") && f.endsWith(".json")).sort();
  const all = [];
  for (const file of files) {
    const content = JSON.parse(await readFile(`${dataDir}/${file}`, "utf8"));
    for (const entry of content) all.push({ ...entry, _sourceFile: file });
  }
  return all;
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const entries = await loadBatches();
    console.log(`Lotes carregados: ${entries.length} rulings no total.`);

    const existing = await prisma.ruling.findMany({ where: { questionEn: { in: entries.map((e) => e.questionEn).filter(Boolean) } }, select: { questionEn: true } });
    const existingQuestions = new Set(existing.map((r) => r.questionEn));
    const newEntries = entries.filter((e) => !existingQuestions.has(e.questionEn));

    console.log(`Já existentes (pulados): ${entries.length - newEntries.length}`);
    console.log(`Novos a criar: ${newEntries.length}`);
    for (const e of newEntries.slice(0, 10)) console.log(`  [${e.title}] ${e.questionEn?.slice(0, 70)}...`);
    if (newEntries.length > 10) console.log(`  ... e mais ${newEntries.length - 10}`);

    if (APPLY) {
      for (const e of newEntries) {
        await prisma.ruling.create({
          data: {
            sourceType: e.sourceType,
            title: e.title,
            questionEn: e.questionEn || null,
            answerEn: e.answerEn || null,
            questionPt: e.questionPt || null,
            answerPt: e.answerPt || null,
            examplePlayPt: e.examplePlayPt || null,
            originalUrl: e.originalUrl || null,
            relatedKeyword: e.relatedKeyword || null,
            relatedPhase: e.relatedPhase || null,
            officialUpdatedAt: e.officialUpdatedAt ? new Date(e.officialUpdatedAt) : null,
            translationStatus: e.questionPt && e.answerPt ? "complete" : "pending",
          },
        });
      }
      console.log(`Aplicado: ${newEntries.length} Ruling(s) criado(s).`);
    } else {
      console.log("\nDry-run (padrão) -- nada foi gravado. Rode com --apply pra aplicar de verdade.");
    }
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => { console.error(err); process.exit(1); });
}
