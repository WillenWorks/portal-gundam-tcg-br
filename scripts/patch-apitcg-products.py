from pathlib import Path
path = Path('/home/user/workspace/portal-gundam-tcg-br-review/prisma/seed-apitcg.mjs')
text = path.read_text()
text = text.replace('''function setType(name = "") {
  const normalized = name.toLowerCase();
  if (normalized.includes("starter deck")) return "STARTER_DECK";
  if (normalized.includes("premium bandai")) return "PREMIUM_BANDAI";
  if (normalized.includes("accessor")) return "ACCESSORIES";
  if (normalized.includes("boost") || /^gd\\d+/i.test(name)) return "BOOSTER_PACK";
  return "OTHER";
}''', '''function setType(name = "", code = "") {
  const normalized = name.toLowerCase();
  const normalizedCode = String(code).toUpperCase();
  if (normalized.includes("starter deck") || /^ST\\d+/.test(normalizedCode)) return "STARTER_DECK";
  if (normalized.includes("premium bandai")) return "PREMIUM_BANDAI";
  if (normalized.includes("accessor")) return "ACCESSORIES";
  if (normalized.includes("boost") || /^(GD|EB)\\d+/.test(normalizedCode)) return "BOOSTER_PACK";
  return "OTHER";
}''')
text = text.replace('''  const dataset = JSON.parse(await readFile(datasetPath, "utf8"));
  const setIdByExternalId = new Map();

  for (const sourceSet of dataset.sets) {
    const code = setCode(sourceSet);''', '''  const dataset = JSON.parse(await readFile(datasetPath, "utf8"));
  const gameplayCards = dataset.cards.filter((card) => Boolean(card.attributes?.CardType));
  const productsBySetId = new Map();
  for (const product of dataset.cards.filter((card) => !card.attributes?.CardType)) {
    const setExternalId = product.set?._id;
    if (!setExternalId) continue;
    const products = productsBySetId.get(setExternalId) || [];
    const images = cardImages(product);
    products.push({
      externalId: product._id,
      name: product.name,
      sourceCode: product.code || product.attributes?.Number || null,
      images: { small: images.small, medium: images.medium, large: images.large },
      tcgplayer: product.markets?.tcgplayer || null,
    });
    productsBySetId.set(setExternalId, products);
  }
  const setIdByExternalId = new Map();

  for (const sourceSet of dataset.sets) {
    const code = setCode(sourceSet);
    const apiProducts = productsBySetId.get(sourceSet._id) || [];''')
text = text.replace('''        setType: setType(sourceSet.name),
        productCodeAlt:''', '''        setType: setType(sourceSet.name, code),
        productCodeAlt:''')
text = text.replace('''          originalCode: sourceSet.code || null,
        },''', '''          originalCode: sourceSet.code || null,
          apiProducts,
        },''')
# Ensures all set type replacement occurs - already only same strings both update/create?
text = text.replace('''        setType: setType(sourceSet.name),''', '''        setType: setType(sourceSet.name, code),''')
text = text.replace('''  for (const sourceCard of dataset.cards) {''', '''  for (const sourceCard of gameplayCards) {''')
text = text.replace('''  console.log(`API TCG seed concluído: ${dataset.sets.length} sets e ${dataset.cards.length} impressões.`);''', '''  console.log(`API TCG seed concluído: ${dataset.sets.length} sets, ${gameplayCards.length} cartas jogáveis e ${dataset.cards.length - gameplayCards.length} produtos vinculados aos sets.`);''')
path.write_text(text)

path = Path('/home/user/workspace/portal-gundam-tcg-br-review/scripts/check-apitcg-dataset.mjs')
text = path.read_text()
text = text.replace('''const externalIds = new Set();
const errors = [];''', '''const externalIds = new Set();
const errors = [];
const gameplayCards = dataset.cards.filter((card) => Boolean(card.attributes?.CardType));
const products = dataset.cards.filter((card) => !card.attributes?.CardType);''')
text = text.replace('''for (const card of dataset.cards) {''', '''for (const card of gameplayCards) {''')
text = text.replace('''const technicalCodes = dataset.cards.filter((card) => !card.code && !card.attributes?.Number).length;
console.log(`Dataset válido: ${dataset.sets.length} sets, ${dataset.cards.length} impressões e três URLs por imagem. ${technicalCodes} cartas usarão código técnico APITCG-<id>.`);''', '''const technicalCodes = gameplayCards.filter((card) => !card.code && !card.attributes?.Number).length;
console.log(`Dataset válido: ${dataset.sets.length} sets, ${gameplayCards.length} cartas jogáveis, ${products.length} produtos e três URLs por imagem. ${technicalCodes} cartas usarão código técnico APITCG-<id>.`);''')
path.write_text(text)
