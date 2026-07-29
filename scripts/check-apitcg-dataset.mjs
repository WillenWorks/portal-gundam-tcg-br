import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const datasetPath = fileURLToPath(new URL("../data/apitcg-gundam.json", import.meta.url));
const dataset = JSON.parse(await readFile(datasetPath, "utf8"));
const setIds = new Set(dataset.sets.map((set) => set._id));
const externalIds = new Set();
const errors = [];
const gameplayCards = dataset.cards.filter((card) => Boolean(card.attributes?.CardType));
const products = dataset.cards.filter((card) => !card.attributes?.CardType);

for (const item of dataset.cards) {
  if (externalIds.has(item._id)) errors.push(`ID externo duplicado: ${item._id}`);
  externalIds.add(item._id);
  if (!setIds.has(item.set?._id)) errors.push(`Item com set ausente: ${item._id}`);
  const image = item.images?.[0];
  if (!image?.small || !image?.medium || !image?.large) errors.push(`Item sem os três tamanhos: ${item._id}`);
}

for (const card of gameplayCards) {
  if (!card.code && !card.attributes?.Number && !card._id) errors.push(`Carta sem identificador para código técnico: ${card._id}`);
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

const technicalCodes = gameplayCards.filter((card) => !card.code && !card.attributes?.Number).length;
console.log(`Dataset válido: ${dataset.sets.length} sets, ${gameplayCards.length} cartas jogáveis, ${products.length} produtos e três URLs por imagem. ${technicalCodes} cartas usarão código técnico APITCG-<id>.`);
