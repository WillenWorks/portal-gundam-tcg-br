/*
 * Validação de integridade depois de rodar prisma/migrate-card-model-data.mjs --apply.
 * Não altera nada — só confere e relata. Ver docs/13-migracao-cardmodel.md.
 *
 * Uso: node prisma/validate-card-model-migration.mjs
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
let failures = 0;

function check(label, ok, detail) {
  console.log(`${ok ? "OK  " : "FALHA"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures += 1;
}

async function main() {
  const [activeCardCount, cardsWithoutModel, distinctCodesResult, modelCount, primaryPrintCounts, cardsWithMultiplePrimary, relationCount] = await Promise.all([
    prisma.card.count({ where: { isActive: true } }),
    prisma.card.count({ where: { isActive: true, cardModelId: null } }),
    prisma.card.groupBy({ by: ["code"], where: { isActive: true } }),
    prisma.cardModel.count(),
    prisma.card.groupBy({ by: ["code"], where: { isActive: true, isPrimaryPrint: true }, _count: { id: true } }),
    prisma.card.groupBy({ by: ["code"], where: { isActive: true, isPrimaryPrint: true }, _count: { id: true }, having: { id: { _count: { gt: 1 } } } }),
    prisma.cardRelation.count(),
  ]);

  const distinctCodeCount = distinctCodesResult.length;

  check("Toda impressão ativa tem cardModelId", cardsWithoutModel === 0, `${cardsWithoutModel} sem cardModelId (de ${activeCardCount})`);
  check("Quantidade de CardModel bate com codes distintos", modelCount === distinctCodeCount, `${modelCount} CardModel vs ${distinctCodeCount} codes distintos`);
  check("Nenhum code com mais de uma impressão marcada como primária", cardsWithMultiplePrimary.length === 0, `${cardsWithMultiplePrimary.length} codes com duplicidade`);
  const codesWithoutPrimary = distinctCodeCount - primaryPrintCounts.length;
  check("Todo code tem exatamente 1 impressão primária", codesWithoutPrimary === 0, `${codesWithoutPrimary} codes sem impressão primária marcada`);

  console.log(`\nCardRelation atual: ${relationCount} linhas (esperado 0 até a fase 2 rodar a curadoria de novo).`);

  // Spot-check: pega 3 CardModel e confirma que os prints batem
  const sample = await prisma.cardModel.findMany({ take: 3, include: { prints: { select: { id: true, code: true, rarity: true, isPrimaryPrint: true } } } });
  console.log("\nAmostra de CardModel com suas impressões:");
  for (const model of sample) {
    console.log(`   ${model.code} "${model.nameEn}" — ${model.prints.length} impressão(ões): ${model.prints.map((p) => `${p.rarity || "?"}${p.isPrimaryPrint ? " [primária]" : ""}`).join(", ")}`);
  }

  console.log(`\n${failures === 0 ? "Tudo certo." : `${failures} checagem(ns) falharam — revisar antes de seguir pra fase 2.`}`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
