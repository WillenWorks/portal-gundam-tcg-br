from pathlib import Path

path = Path('/home/user/workspace/portal-gundam-tcg-br-review/server/index.ts')
text = path.read_text()
text = text.replace('''type CardInput = {
  code: string;
  nameEn: string;
''', '''type CardInput = {
  code: string;
  externalId?: string | null;
  nameEn: string;
''')
text = text.replace('''  imageUrl?: string | null;
  imageSourceUrl?: string | null;
  thumbUrl?: string | null;
''', '''  imageUrl?: string | null;
  thumbUrl?: string | null;
  imageSmallUrl?: string | null;
  imageMediumUrl?: string | null;
  imageLargeUrl?: string | null;
  imageSourceUrl?: string | null;
''')
text = text.replace('''        url: normalizeAssetUrl(item?.url || item?.imageUrl, "images/cards"),
        thumbUrl: normalizeAssetUrl(item?.thumbUrl, "images/cards/thumbs"),
        sourceUrl: String(item?.sourceUrl || item?.imageSourceUrl || "").trim() || null,
''', '''        smallUrl: normalizeAssetUrl(item?.smallUrl || item?.thumbUrl, "images/cards/thumbs"),
        mediumUrl: normalizeAssetUrl(item?.mediumUrl || item?.url || item?.imageUrl, "images/cards"),
        largeUrl: normalizeAssetUrl(item?.largeUrl, "images/cards"),
        url: normalizeAssetUrl(item?.mediumUrl || item?.url || item?.imageUrl, "images/cards"),
        thumbUrl: normalizeAssetUrl(item?.smallUrl || item?.thumbUrl, "images/cards/thumbs"),
        sourceUrl: String(item?.sourceUrl || item?.imageSourceUrl || "").trim() || null,
''')
text = text.replace('''        url: card.imageUrl,
        thumbUrl: card.thumbUrl,
        sourceUrl: card.imageSourceUrl,
''', '''        smallUrl: card.imageSmallUrl || card.thumbUrl,
        mediumUrl: card.imageMediumUrl || card.imageUrl,
        largeUrl: card.imageLargeUrl || card.imageUrl,
        url: card.imageMediumUrl || card.imageUrl,
        thumbUrl: card.imageSmallUrl || card.thumbUrl,
        sourceUrl: card.imageSourceUrl,
''')
text = text.replace('''    const primaryImageUrl = artState.primary?.url || normalizeAssetUrl(card.imageUrl, "images/cards");
    const primaryThumbUrl = artState.primary?.thumbUrl || normalizeAssetUrl(card.thumbUrl, "images/cards/thumbs");
    const primarySourceUrl = artState.primary?.sourceUrl || card.imageSourceUrl || null;
    const finalMetadataJson = Object.keys(metadata).length ? (metadata as Prisma.InputJsonValue) : Prisma.JsonNull;
    await prisma.card.upsert({
      where: { code: card.code },
      update: {''', '''    const primaryImageUrl = artState.primary?.mediumUrl || artState.primary?.url || normalizeAssetUrl(card.imageMediumUrl || card.imageUrl, "images/cards");
    const primaryThumbUrl = artState.primary?.smallUrl || artState.primary?.thumbUrl || normalizeAssetUrl(card.imageSmallUrl || card.thumbUrl, "images/cards/thumbs");
    const primaryLargeUrl = artState.primary?.largeUrl || normalizeAssetUrl(card.imageLargeUrl || card.imageUrl, "images/cards");
    const primarySourceUrl = artState.primary?.sourceUrl || card.imageSourceUrl || null;
    const finalMetadataJson = Object.keys(metadata).length ? (metadata as Prisma.InputJsonValue) : Prisma.JsonNull;
    const data = {
        code: card.code,
        externalId: card.externalId || null,
        nameEn: card.nameEn,
        namePt: card.namePt || null,
        cardType: normalizeCardType(card.cardType),
        cardSubtypes: Array.isArray(card.cardSubtypes) ? card.cardSubtypes.filter(Boolean) : [],
        color: card.color || null,
        cost: card.cost ?? null,
        level: card.level ?? null,
        ap: card.ap ?? null,
        hp: card.hp ?? null,
        rarity: card.rarity || null,
        trait: card.trait || traits.join(" | ") || null,
        traits,
        series: card.series || null,
        sourceTitle: card.sourceTitle || card.series || null,
        zone: card.zone || null,
        linkText: card.linkText || inferredLinkText || null,
        pilotName: card.pilotName || null,
        effectEn,
        effectPt,
        triggerKeywords: normalizedEffects.triggerKeywords,
        keywordTags: normalizedEffects.keywordTags,
        effectKeywords: normalizedEffects.effectKeywords,
        textSectionsJson: normalizedEffects.textSectionsJson,
        hasBurst: normalizedEffects.hasBurst,
        hasMain: normalizedEffects.hasMain,
        hasAction: normalizedEffects.hasAction,
        oncePerTurn: normalizedEffects.oncePerTurn,
        imageUrl: primaryImageUrl,
        imageSourceUrl: primarySourceUrl,
        thumbUrl: primaryThumbUrl,
        imageSmallUrl: primaryThumbUrl,
        imageMediumUrl: primaryImageUrl,
        imageLargeUrl: primaryLargeUrl,
        officialUrl: card.officialUrl || null,
        metadataJson: finalMetadataJson,
        legalityStatus: card.legalityStatus || "legal",
        isActive: true,
        deletedAt: null,
        setId,
    };
    if (card.externalId) {
      await prisma.card.upsert({ where: { externalId: card.externalId }, update: data, create: data });
    } else {
      const existing = await prisma.card.findFirst({ where: { code: card.code, setId } });
      if (existing) await prisma.card.update({ where: { id: existing.id }, data });
      else await prisma.card.create({ data });
    }
    /* legacy upsert retained below only as a migration anchor. */
    /*
      update: {''')
needle = '''      },
    });
  }
}

async function upsertRulings'''
replacement = '''      },
    });
    */
  }
}

async function upsertRulings'''
if needle not in text:
    raise SystemExit('Could not locate upsert end')
text = text.replace(needle, replacement, 1)
path.write_text(text)
