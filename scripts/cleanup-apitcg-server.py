from pathlib import Path
import re
path = Path('/home/user/workspace/portal-gundam-tcg-br-review/server/index.ts')
text = path.read_text()
text, count = re.subn(r'\n    /\*\n      update: \{.*?\n    \*/', '', text, count=1, flags=re.S)
if count != 1:
    raise SystemExit(f'Expected one legacy block, found {count}')
text = text.replace('''  const card = ruling.cardCode ? await prisma.card.findUnique({ where: { code: ruling.cardCode } }) : null;''', '''  const card = ruling.cardCode ? await prisma.card.findFirst({ where: { code: ruling.cardCode } }) : null;''')
path.write_text(text)
