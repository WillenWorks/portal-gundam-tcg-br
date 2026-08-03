from pathlib import Path
path = Path('/home/user/workspace/portal-gundam-tcg-br-review/prisma/seed-apitcg.mjs')
text = path.read_text()
text = text.replace('''function cardImages(card) {
''', '''function cardCode(card) {
  const sourceCode = String(card.code || card.attributes?.Number || "").trim();
  return sourceCode || `APITCG-${card._id}`;
}

function cardImages(card) {
''')
text = text.replace('''        code: sourceCard.code || attributes.Number,''', '''        code: cardCode(sourceCard),''')
text = text.replace('''        code: sourceCard.code || attributes.Number,''', '''        code: cardCode(sourceCard),''')
text = text.replace('''          originalAttributes: attributes,
''', '''          sourceCode: sourceCard.code || attributes.Number || null,
          originalAttributes: attributes,
''')
path.write_text(text)

path = Path('/home/user/workspace/portal-gundam-tcg-br-review/scripts/check-apitcg-dataset.mjs')
text = path.read_text()
text = text.replace('''  if (!card.code && !card.attributes?.Number) errors.push(`Carta sem código: ${card._id}`);''', '''  if (!card.code && !card.attributes?.Number && !card._id) errors.push(`Carta sem identificador para código técnico: ${card._id}`);''')
text = text.replace('''console.log(`Dataset válido: ${dataset.sets.length} sets, ${dataset.cards.length} impressões e três URLs por imagem.`);''', '''const technicalCodes = dataset.cards.filter((card) => !card.code && !card.attributes?.Number).length;
console.log(`Dataset válido: ${dataset.sets.length} sets, ${dataset.cards.length} impressões e três URLs por imagem. ${technicalCodes} cartas usarão código técnico APITCG-<id>.`);''')
path.write_text(text)
