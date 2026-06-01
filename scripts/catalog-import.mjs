#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { PrismaClient, CardType, SetKind } from "@prisma/client";

const prisma = new PrismaClient();

function normalizeAssetUrl(input, folder) {
  if (!input) return null;
  const value = String(input).trim().replace(/\\/g, "/");
  if (!value) return null;
  if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("/")) return value;
  return `/${folder}/${value.replace(/^\/+/, "")}`;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function toDateOrNull(input) {
  if (!input) return null;
  const date = input instanceof Date ? input : new Date(String(input));
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeSetType(value) {
  const raw = String(value || "BOOSTER_PACK").trim().toUpperCase();
  if (raw === "STARTER_DECK") return SetKind.STARTER_DECK;
  if (raw === "ACCESSORIES") return SetKind.ACCESSORIES;
  if (raw === "PREMIUM_BANDAI") return SetKind.PREMIUM_BANDAI;
  if (raw === "OTHER") return SetKind.OTHER;
  return SetKind.BOOSTER_PACK;
}

function normalizeCardType(value) {
  const raw = String(value || "UNIT").trim().toUpperCase().replace(/[^A-Z]+/g, "_");
  if (raw === "PILOT") return CardType.PILOT;
  if (raw === "COMMAND") return CardType.COMMAND;
  if (raw === "BASE") return CardType.BASE;
  if (raw === "RESOURCE") return CardType.RESOURCE;
  if (raw === "EX_BASE") return CardType.EX_BASE;
  if (raw === "EX_RESOURCE") return CardType.EX_RESOURCE;
  if (raw === "UNIT_TOKEN") return CardType.UNIT_TOKEN;
  return CardType.UNIT;
}

function buildEffectText(card) {
  const sections = Array.isArray(card.textSectionsJson) ? card.textSectionsJson : [];
  if (!sections.length) return { effectPt: card.effectPt || null, effectEn: card.effectEn || null };
  const pt = sections.map((section) => (section?.textPt ? `[${section.label || section.kind || "effect"}] ${section.textPt}` : null)).filter(Boolean).join("\n");
  const en = sections.map((section) => (section?.textEn ? `[${section.label || section.kind || "effect"}] ${section.textEn}` : null)).filter(Boolean).join("\n");
  return { effectPt: pt || card.effectPt || null, effectEn: en || card.effectEn || null };
}

async function importSets(items) {
  const setMap = new Map();
  for (const set of items) {
    const saved = await prisma.cardSet.upsert({
      where: { code: set.code },
      update: {
        nameEn: set.nameEn,
        namePt: set.namePt || null,
        officialUrl: set.officialUrl || null,
        releaseDate: toDateOrNull(set.releaseDate),
        coverImage: normalizeAssetUrl(set.coverImage, "images/sets"),
        shortDescription: set.shortDescription || null,
        setType: normalizeSetType(set.setType),
        productCodeAlt: set.productCodeAlt || null,
        msrpUsd: set.msrpUsd ?? null,
        contentSummaryEn: set.contentSummaryEn || null,
        contentSummaryPt: set.contentSummaryPt || null,
        raritySummary: set.raritySummary || null,
        productNotes: set.productNotes || null,
        sourceTitles: Array.isArray(set.sourceTitles) ? set.sourceTitles.filter(Boolean) : [],
        starterDeckVariantOf: set.starterDeckVariantOf || null,
        metadataJson: set.metadataJson || null,
      },
      create: {
        code: set.code,
        nameEn: set.nameEn,
        namePt: set.namePt || null,
        officialUrl: set.officialUrl || null,
        releaseDate: toDateOrNull(set.releaseDate),
        coverImage: normalizeAssetUrl(set.coverImage, "images/sets"),
        shortDescription: set.shortDescription || null,
        setType: normalizeSetType(set.setType),
        productCodeAlt: set.productCodeAlt || null,
        msrpUsd: set.msrpUsd ?? null,
        contentSummaryEn: set.contentSummaryEn || null,
        contentSummaryPt: set.contentSummaryPt || null,
        raritySummary: set.raritySummary || null,
        productNotes: set.productNotes || null,
        sourceTitles: Array.isArray(set.sourceTitles) ? set.sourceTitles.filter(Boolean) : [],
        starterDeckVariantOf: set.starterDeckVariantOf || null,
        metadataJson: set.metadataJson || null,
      },
    });
    setMap.set(set.code, saved.id);
  }
  return setMap;
}

async function importCards(items, setMap) {
  for (const card of items) {
    const traits = Array.isArray(card.traits) && card.traits.length ? card.traits.filter(Boolean) : [card.trait].filter(Boolean);
    const { effectPt, effectEn } = buildEffectText(card);
    await prisma.card.upsert({
      where: { code: card.code },
      update: {
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
        imageUrl: normalizeAssetUrl(card.imageUrl, "images/cards"),
        thumbUrl: normalizeAssetUrl(card.thumbUrl, "images/cards/thumbs"),
        imageSourceUrl: card.imageSourceUrl || null,
        officialUrl: card.officialUrl || null,
        legalityStatus: card.legalityStatus || "legal",
        setId: card.setCode ? setMap.get(card.setCode) || null : null,
      },
      create: {
        code: card.code,
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
        imageUrl: normalizeAssetUrl(card.imageUrl, "images/cards"),
        thumbUrl: normalizeAssetUrl(card.thumbUrl, "images/cards/thumbs"),
        imageSourceUrl: card.imageSourceUrl || null,
        officialUrl: card.officialUrl || null,
        legalityStatus: card.legalityStatus || "legal",
        setId: card.setCode ? setMap.get(card.setCode) || null : null,
      },
    });
  }
}

async function importRulings(items) {
  for (const ruling of items) {
    const card = ruling.cardCode ? await prisma.card.findUnique({ where: { code: ruling.cardCode } }) : null;
    const existing = await prisma.ruling.findFirst({
      where: {
        sourceType: ruling.sourceType,
        title: ruling.title,
        originalUrl: ruling.originalUrl || null,
        cardId: card?.id || null,
      },
    });

    const data = {
      sourceType: ruling.sourceType,
      title: ruling.title,
      questionEn: ruling.questionEn || null,
      answerEn: ruling.answerEn || null,
      questionPt: ruling.questionPt || null,
      answerPt: ruling.answerPt || null,
      examplePlayPt: ruling.examplePlayPt || null,
      originalUrl: ruling.originalUrl || null,
      relatedKeyword: ruling.relatedKeyword || null,
      relatedPhase: ruling.relatedPhase || null,
      officialUpdatedAt: toDateOrNull(ruling.officialUpdatedAt),
      translationStatus: ruling.translationStatus || "reviewed",
      cardId: card?.id || null,
    };

    if (existing) await prisma.ruling.update({ where: { id: existing.id }, data });
    else await prisma.ruling.create({ data });
  }
}

async function importImages(items) {
  for (const item of items) {
    if (item.entity === "card") {
      await prisma.card.update({
        where: { code: item.code },
        data: {
          imageUrl: normalizeAssetUrl(item.imageUrl, "images/cards"),
          thumbUrl: normalizeAssetUrl(item.thumbUrl, "images/cards/thumbs"),
          imageSourceUrl: item.imageSourceUrl || null,
        },
      });
    }
    if (item.entity === "set") {
      await prisma.cardSet.update({
        where: { code: item.code },
        data: {
          coverImage: normalizeAssetUrl(item.coverImage || item.imageUrl, "images/sets"),
        },
      });
    }
  }
}

async function main() {
  const sourceDir = process.argv[2] ? path.resolve(process.cwd(), process.argv[2]) : path.resolve(process.cwd(), "data/catalog");
  if (!fs.existsSync(sourceDir)) throw new Error(`Diretório não encontrado: ${sourceDir}`);

  const setMap = fs.existsSync(path.join(sourceDir, "sets.json")) ? await importSets(readJson(path.join(sourceDir, "sets.json"))) : new Map();
  if (fs.existsSync(path.join(sourceDir, "cards.json"))) await importCards(readJson(path.join(sourceDir, "cards.json")), setMap);
  if (fs.existsSync(path.join(sourceDir, "rulings.json"))) await importRulings(readJson(path.join(sourceDir, "rulings.json")));
  if (fs.existsSync(path.join(sourceDir, "images-manifest.json"))) await importImages(readJson(path.join(sourceDir, "images-manifest.json")));

  console.log(`Importação concluída a partir de ${sourceDir}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
