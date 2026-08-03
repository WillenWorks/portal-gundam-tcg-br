/* Executa apenas o seed de traits e mídias, sem alterar cards, sets, decks ou binders. */
import { PrismaClient } from "@prisma/client";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { seedApiTcgTaxonomies } from "./apitcg-taxonomies.mjs";

const prisma = new PrismaClient();
const datasetPath = fileURLToPath(new URL("../data/apitcg-gundam.json", import.meta.url));

async function main() {
  const dataset = JSON.parse(await readFile(datasetPath, "utf8"));
  const summary = await seedApiTcgTaxonomies(prisma, dataset);
  console.log(`Taxonomias API TCG concluídas: ${summary.traits} traits e ${summary.sourceTitles} mídias. Novos registros: ${summary.createdTraits} traits e ${summary.createdSourceTitles} mídias.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => prisma.$disconnect());
