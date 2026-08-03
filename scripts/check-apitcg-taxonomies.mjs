import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { CURATED_SOURCE_TITLES, inspectApiTcgTaxonomies } from "../prisma/apitcg-taxonomies.mjs";

const datasetPath = fileURLToPath(new URL("../data/apitcg-gundam.json", import.meta.url));
const dataset = JSON.parse(await readFile(datasetPath, "utf8"));
const summary = inspectApiTcgTaxonomies(dataset);
const expectedMedia = 17;
const expectedTraits = 77;

if (CURATED_SOURCE_TITLES.length !== expectedMedia) {
  throw new Error(`Lista de mídias inválida: esperado ${expectedMedia}, recebido ${CURATED_SOURCE_TITLES.length}.`);
}
if (summary.traits !== expectedTraits) {
  throw new Error(`Extração de traits inválida: esperado ${expectedTraits}, recebido ${summary.traits}.`);
}

console.log(`Taxonomias válidas: ${summary.traits} traits, ${summary.sourceTitles} mídias curadas e ${summary.aliases} alias(es) de trait.`);
