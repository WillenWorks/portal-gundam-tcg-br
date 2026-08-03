from pathlib import Path
import re
path = Path('/home/user/workspace/portal-gundam-tcg-br-review/scripts/catalog-import.mjs')
text = path.read_text()
replacement = '''async function importCards(items, setMap) {
  for (const card of items) {
    const traits = Array.isArray(card.traits) && card.traits.length ? card.traits.filter(Boolean) : [card.trait].filter(Boolean);
    const { effectPt, effectEn } = buildEffectText(card);
    const setId = card.setCode ? setMap.get(card.setCode) || null : null;
    const externalId = card.externalId || `catalog:${card.setCode || "no-set"}:${card.code}:${card.nameEn}`;
    const small = normalizeAssetUrl(card.imageSmallUrl || card.thumbUrl, "images/cards/thumbs");
    const medium = normalizeAssetUrl(card.imageMediumUrl || card.imageUrl, "images/cards");
    const large = normalizeAssetUrl(card.imageLargeUrl || card.imageUrl, "images/cards");
    const data = {
      code: card.code,
      externalId,
      nameEn: card.nameEn,
      namePt: card.namePt || null,
      cardType: normalizeCardType(card.cardType),
      cardSubtypes: Array.isArray(card.cardSubtypes) ? card.cardSubtypes.filter(Boolean) : [],
      color: card.color || null,
      level: card.level ?? null,
      cost: card.cost ?? null,
      ap: card.ap ?? null,
      hp: card.hp ?? null,
      rarity: card.rarity || null,
      trait: card.trait || traits.join(" | ") || null,
      traits,
      series: card.series || null,
      sourceTitle: card.sourceTitle || card.series || null,
      zone: card.zone || null,
      linkText: card.linkText || null,
      pilotName: card.pilotName || null,
      effectEn,
      effectPt,
      triggerKeywords: Array.isArray(card.triggerKeywords) ? card.triggerKeywords.filter(Boolean) : [],
      keywordTags: Array.isArray(card.keywordTags) ? card.keywordTags.filter(Boolean) : [],
      effectKeywords: Array.isArray(card.effectKeywords) ? card.effectKeywords.filter(Boolean) : [],
      textSectionsJson: card.textSectionsJson || null,
      hasBurst: Boolean(card.hasBurst),
      hasMain: Boolean(card.hasMain),
      hasAction: Boolean(card.hasAction),
      oncePerTurn: Boolean(card.oncePerTurn),
      imageUrl: medium,
      thumbUrl: small,
      imageSmallUrl: small,
      imageMediumUrl: medium,
      imageLargeUrl: large,
      imageSourceUrl: card.imageSourceUrl || null,
      officialUrl: card.officialUrl || null,
      legalityStatus: card.legalityStatus || "legal",
      setId,
    };
    await prisma.card.upsert({ where: { externalId }, update: data, create: data });
  }
}
'''
text, count = re.subn(r'async function importCards\(items, setMap\) \{.*?\n\}\n\nasync function importRulings', replacement + '\nasync function importRulings', text, count=1, flags=re.S)
if count != 1: raise SystemExit(f'importCards blocks replaced: {count}')
text = text.replace('''findUnique({ where: { code: ruling.cardCode } })''', '''findFirst({ where: { code: ruling.cardCode } })''')
old = '''      await prisma.card.update({
        where: { code: item.code },
        data: {
          imageUrl: normalizeAssetUrl(item.imageUrl, "images/cards"),
          thumbUrl: normalizeAssetUrl(item.thumbUrl, "images/cards/thumbs"),
          imageSourceUrl: item.imageSourceUrl || null,
        },
      });'''
new = '''      const card = item.externalId
        ? await prisma.card.findUnique({ where: { externalId: item.externalId } })
        : await prisma.card.findFirst({ where: { code: item.code, setId: item.setId || undefined } });
      if (!card) continue;
      const small = normalizeAssetUrl(item.imageSmallUrl || item.thumbUrl, "images/cards/thumbs");
      const medium = normalizeAssetUrl(item.imageMediumUrl || item.imageUrl, "images/cards");
      const large = normalizeAssetUrl(item.imageLargeUrl || item.imageUrl, "images/cards");
      await prisma.card.update({
        where: { id: card.id },
        data: { imageUrl: medium, thumbUrl: small, imageSmallUrl: small, imageMediumUrl: medium, imageLargeUrl: large, imageSourceUrl: item.imageSourceUrl || null },
      });'''
if old not in text: raise SystemExit('image manifest card block not found')
text = text.replace(old, new)
path.write_text(text)
