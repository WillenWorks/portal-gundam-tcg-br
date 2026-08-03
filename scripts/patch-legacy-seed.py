from pathlib import Path

path = Path('/home/user/workspace/portal-gundam-tcg-br-review/prisma/seed.mjs')
text = path.read_text()
text = text.replace('''  for (const card of cards) {
    const setId = card.setCode ? setMap.get(card.setCode) || null : null;
''', '''  for (const card of cards) {
    const setId = card.setCode ? setMap.get(card.setCode) || null : null;
    const externalId = card.externalId || `seed:${card.code}`;
''')
text = text.replace('''      where: { code: card.code },
      update: {
        nameEn:''', '''      where: { externalId },
      update: {
        externalId,
        nameEn:''')
text = text.replace('''      create: {
        code: card.code,
        nameEn:''', '''      create: {
        code: card.code,
        externalId,
        nameEn:''')
text = text.replace('''findUnique({ where: { code: ruling.cardCode } })''', '''findFirst({ where: { code: ruling.cardCode } })''')
text = text.replace('''findUnique({ where: { code: "GD01-001" } })''', '''findFirst({ where: { code: "GD01-001" } })''')
text = text.replace('''findUnique({ where: { code: "GD01-090" } })''', '''findFirst({ where: { code: "GD01-090" } })''')
path.write_text(text)
