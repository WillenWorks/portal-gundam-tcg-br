/* Seed API TCG — importa o recorte fornecido de sets e impressões Gundam sem descartar reprints. */
import { PrismaClient } from "@prisma/client";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const prisma = new PrismaClient();
const datasetPath = fileURLToPath(new URL("../data/apitcg-gundam.json", import.meta.url));

const missingSetCodes = {
  "gundam-deck-build-box-freedom-ascension": "DBB-FA",
  "gundam-eternal-nexus": "EB01",
  "gundam-freedom-ascension": "GD05",
  "gundam-starter-deck-10-generation-pulse": "ST10",
};

function setCode(set) {
  return set.code || missingSetCodes[set._id] || set.slug.toUpperCase();
}

function setType(name = "", code = "") {
  const normalized = name.toLowerCase();
  const normalizedCode = String(code).toUpperCase();
  if (normalized.includes("starter deck") || /^ST\d+/.test(normalizedCode)) return "STARTER_DECK";
  if (normalized.includes("premium bandai")) return "PREMIUM_BANDAI";
  if (normalized.includes("accessor")) return "ACCESSORIES";
  if (normalized.includes("boost") || /^(GD|EB)\d+/.test(normalizedCode)) return "BOOSTER_PACK";
  return "OTHER";
}

function numberOrNull(value) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function cardType(value) {
  const normalized = String(value || "UNIT").trim().toUpperCase().replace(/[^A-Z]+/g, "_");
  return ["UNIT", "PILOT", "COMMAND", "COMMAND_PILOT", "BASE", "RESOURCE", "EX_BASE", "EX_RESOURCE", "UNIT_TOKEN"].includes(normalized) ? normalized : "UNIT";
}

function traitsFrom(value) {
  const raw = String(value || "").trim();
  const parenthesized = Array.from(raw.matchAll(/\(([^)]+)\)/g), (match) => match[1].trim()).filter(Boolean);
  return parenthesized.length ? parenthesized : raw ? [raw] : [];
}

function cardCode(card) {
  const sourceCode = String(card.code || card.attributes?.Number || "").trim();
  return sourceCode || `APITCG-${card._id}`;
}

function cardImages(card) {
  const image = Array.isArray(card.images) ? card.images[0] : null;
  return {
    small: image?.small || null,
    medium: image?.medium || null,
    large: image?.large || null,
    imageId: image?._id || null,
  };
}

async function main() {
  const dataset = JSON.parse(await readFile(datasetPath, "utf8"));
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
    const apiProducts = productsBySetId.get(sourceSet._id) || [];
    const saved = await prisma.cardSet.upsert({
      where: { code },
      update: {
        nameEn: sourceSet.name,
        namePt: null,
        releaseDate: sourceSet.release_date ? new Date(sourceSet.release_date) : null,
        officialUrl: null,
        setType: setType(sourceSet.name, code),
        productCodeAlt: sourceSet.slug || null,
        metadataJson: {
          source: "API TCG",
          externalId: sourceSet._id,
          slug: sourceSet.slug || null,
          markets: sourceSet.markets || {},
          apiCreatedAt: sourceSet.createdAt || null,
          apiUpdatedAt: sourceSet.updatedAt || null,
          originalCode: sourceSet.code || null,
          apiProducts,
        },
        isActive: true,
        deletedAt: null,
      },
      create: {
        code,
        nameEn: sourceSet.name,
        namePt: null,
        releaseDate: sourceSet.release_date ? new Date(sourceSet.release_date) : null,
        officialUrl: null,
        setType: setType(sourceSet.name, code),
        productCodeAlt: sourceSet.slug || null,
        sourceTitles: [],
        metadataJson: {
          source: "API TCG",
          externalId: sourceSet._id,
          slug: sourceSet.slug || null,
          markets: sourceSet.markets || {},
          apiCreatedAt: sourceSet.createdAt || null,
          apiUpdatedAt: sourceSet.updatedAt || null,
          originalCode: sourceSet.code || null,
          apiProducts,
        },
      },
    });
    setIdByExternalId.set(sourceSet._id, saved.id);
  }

  for (const sourceCard of gameplayCards) {
    const attributes = sourceCard.attributes || {};
    const images = cardImages(sourceCard);
    const traits = traitsFrom(attributes.Trait);
    const externalId = `apitcg:${sourceCard._id}`;
    const setId = setIdByExternalId.get(sourceCard.set?._id) || null;
    const officialUrl = sourceCard.markets?.tcgplayer?.url || null;
    const artVariant = {
      id: `apitcg-image:${images.imageId || sourceCard._id}`,
      label: "API TCG",
      smallUrl: images.small,
      mediumUrl: images.medium,
      largeUrl: images.large,
      url: images.medium,
      thumbUrl: images.small,
      sourceUrl: officialUrl,
      rarity: attributes.Rarity || null,
      isPrimary: true,
      position: 0,
    };

    await prisma.card.upsert({
      where: { externalId },
      update: {
        code: cardCode(sourceCard),
        nameEn: sourceCard.name,
        namePt: null,
        cardType: cardType(attributes.CardType),
        cardSubtypes: [],
        color: attributes.Color || null,
        level: numberOrNull(attributes.Level),
        cost: numberOrNull(attributes.Cost),
        ap: numberOrNull(attributes["Attack Points"]),
        hp: numberOrNull(attributes["Hit Points"]),
        rarity: attributes.Rarity || null,
        trait: traits.join(" | ") || null,
        traits,
        series: null,
        sourceTitle: null,
        zone: null,
        linkText: attributes["Link Condition"] || null,
        pilotName: null,
        effectEn: attributes.Description || null,
        effectPt: null,
        triggerKeywords: [],
        keywordTags: [],
        effectKeywords: [],
        textSectionsJson: null,
        hasBurst: false,
        hasMain: false,
        hasAction: false,
        oncePerTurn: false,
        imageUrl: images.medium,
        thumbUrl: images.small,
        imageSmallUrl: images.small,
        imageMediumUrl: images.medium,
        imageLargeUrl: images.large,
        imageSourceUrl: "API TCG / TCGplayer CDN",
        officialUrl,
        metadataJson: {
          source: "API TCG",
          externalId: sourceCard._id,
          imageId: images.imageId,
          setExternalId: sourceCard.set?._id || null,
          tcgplayer: sourceCard.markets?.tcgplayer || null,
          sourceCode: sourceCard.code || attributes.Number || null,
          originalAttributes: attributes,
          artVariants: [artVariant],
        },
        legalityStatus: "legal",
        isActive: true,
        deletedAt: null,
        setId,
      },
      create: {
        externalId,
        code: cardCode(sourceCard),
        nameEn: sourceCard.name,
        namePt: null,
        cardType: cardType(attributes.CardType),
        cardSubtypes: [],
        color: attributes.Color || null,
        level: numberOrNull(attributes.Level),
        cost: numberOrNull(attributes.Cost),
        ap: numberOrNull(attributes["Attack Points"]),
        hp: numberOrNull(attributes["Hit Points"]),
        rarity: attributes.Rarity || null,
        trait: traits.join(" | ") || null,
        traits,
        series: null,
        sourceTitle: null,
        zone: null,
        linkText: attributes["Link Condition"] || null,
        pilotName: null,
        effectEn: attributes.Description || null,
        effectPt: null,
        triggerKeywords: [],
        keywordTags: [],
        effectKeywords: [],
        textSectionsJson: null,
        hasBurst: false,
        hasMain: false,
        hasAction: false,
        oncePerTurn: false,
        imageUrl: images.medium,
        thumbUrl: images.small,
        imageSmallUrl: images.small,
        imageMediumUrl: images.medium,
        imageLargeUrl: images.large,
        imageSourceUrl: "API TCG / TCGplayer CDN",
        officialUrl,
        metadataJson: {
          source: "API TCG",
          externalId: sourceCard._id,
          imageId: images.imageId,
          setExternalId: sourceCard.set?._id || null,
          tcgplayer: sourceCard.markets?.tcgplayer || null,
          sourceCode: sourceCard.code || attributes.Number || null,
          originalAttributes: attributes,
          artVariants: [artVariant],
        },
        legalityStatus: "legal",
        setId,
      },
    });
  }

  console.log(`API TCG seed concluído: ${dataset.sets.length} sets, ${gameplayCards.length} cartas jogáveis e ${dataset.cards.length - gameplayCards.length} produtos vinculados aos sets.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => prisma.$disconnect());
