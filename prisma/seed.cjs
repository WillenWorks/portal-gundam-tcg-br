import { PrismaClient, UserRole, CardLanguage, BinderKind, SetKind, CardType } from "@prisma/client";
import bcrypt from "bcryptjs";
import fs from "node:fs";
import path from "node:path";

const prisma = new PrismaClient();

function readJsonIfExists(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function normalizeAssetUrl(input, folder) {
  if (!input) return null;
  const value = String(input).trim().replace(/\\/g, "/");
  if (!value) return null;
  if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("/")) return value;
  return `/${folder}/${value.replace(/^\/+/, "")}`;
}

function toDateOrNull(input) {
  if (!input) return null;
  const date = input instanceof Date ? input : new Date(String(input));
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeCardType(value) {
  const raw = String(value || "UNIT").trim().toUpperCase().replace(/[^A-Z]+/g, "_");
  if (raw === "PILOT") return CardType.PILOT;
  if (raw === "COMMAND") return CardType.COMMAND;
  if (raw === "COMMAND_PILOT") return CardType.COMMAND_PILOT;
  if (raw === "BASE") return CardType.BASE;
  if (raw === "RESOURCE") return CardType.RESOURCE;
  if (raw === "EX_BASE") return CardType.EX_BASE;
  if (raw === "EX_RESOURCE") return CardType.EX_RESOURCE;
  if (raw === "UNIT_TOKEN") return CardType.UNIT_TOKEN;
  return CardType.UNIT;
}

function normalizeSetType(value) {
  const raw = String(value || "BOOSTER_PACK").trim().toUpperCase();
  if (raw === "STARTER_DECK") return SetKind.STARTER_DECK;
  if (raw === "ACCESSORIES") return SetKind.ACCESSORIES;
  if (raw === "PREMIUM_BANDAI") return SetKind.PREMIUM_BANDAI;
  if (raw === "OTHER") return SetKind.OTHER;
  return SetKind.BOOSTER_PACK;
}

function buildFlattenedText(card) {
  const parts = [];
  if (Array.isArray(card.textSectionsJson)) {
    for (const section of card.textSectionsJson) {
      if (!section?.textPt && !section?.textEn) continue;
      const label = section.label || section.kind || "effect";
      parts.push(`[${label}] ${section.textPt || section.textEn}`);
    }
  }
  if (parts.length) return parts.join("\n");
  return card.effectPt || card.effectEn || null;
}

async function seedUser({ email, displayName, username, password, role, bio, preferredTheme = "dark" }) {
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash,
      displayName,
      username,
      role,
      bio,
      isActive: true,
      preferredCardLanguage: CardLanguage.PT_BR,
      preferredTheme,
    },
    create: {
      email,
      displayName,
      username,
      passwordHash,
      role,
      bio,
      isActive: true,
      preferredCardLanguage: CardLanguage.PT_BR,
      preferredTheme,
    },
  });

  await prisma.cardBinder.upsert({
    where: { userId_kind: { userId: user.id, kind: BinderKind.WISHLIST } },
    update: { name: "Lista de Desejos", isPublic: true },
    create: { userId: user.id, kind: BinderKind.WISHLIST, name: "Lista de Desejos", description: "Cartas que quero adquirir.", isPublic: true },
  });

  await prisma.cardBinder.upsert({
    where: { userId_kind: { userId: user.id, kind: BinderKind.OWNED } },
    update: { name: "Cartas Possuídas", isPublic: true },
    create: { userId: user.id, kind: BinderKind.OWNED, name: "Cartas Possuídas", description: "Cartas que já tenho.", isPublic: true },
  });

  return user;
}

async function upsertSets(setSeeds) {
  const setMap = new Map();
  for (const set of setSeeds) {
    const saved = await prisma.cardSet.upsert({
      where: { code: set.code },
      update: {
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

async function upsertCards(cards, setMap) {
  for (const card of cards) {
    const setId = card.setCode ? setMap.get(card.setCode) || null : null;
    const traits = Array.isArray(card.traits) && card.traits.length ? card.traits.filter(Boolean) : [card.trait].filter(Boolean);
    const textSectionsJson = Array.isArray(card.textSectionsJson) ? card.textSectionsJson : null;
    const effectPt = buildFlattenedText({ ...card, textSectionsJson });
    const effectEn = card.effectEn || effectPt;

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
        textSectionsJson,
        hasBurst: Boolean(card.hasBurst),
        hasMain: Boolean(card.hasMain),
        hasAction: Boolean(card.hasAction),
        oncePerTurn: Boolean(card.oncePerTurn),
        imageUrl: normalizeAssetUrl(card.imageUrl, "images/cards"),
        thumbUrl: normalizeAssetUrl(card.thumbUrl, "images/cards/thumbs"),
        imageSourceUrl: card.imageSourceUrl || null,
        officialUrl: card.officialUrl || null,
        legalityStatus: card.legalityStatus || "legal",
        setId,
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
        textSectionsJson,
        hasBurst: Boolean(card.hasBurst),
        hasMain: Boolean(card.hasMain),
        hasAction: Boolean(card.hasAction),
        oncePerTurn: Boolean(card.oncePerTurn),
        imageUrl: normalizeAssetUrl(card.imageUrl, "images/cards"),
        thumbUrl: normalizeAssetUrl(card.thumbUrl, "images/cards/thumbs"),
        imageSourceUrl: card.imageSourceUrl || null,
        officialUrl: card.officialUrl || null,
        legalityStatus: card.legalityStatus || "legal",
        setId,
      },
    });
  }
}

async function upsertRulings(rulings) {
  for (const ruling of rulings) {
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

async function seedSampleDecks(admin, user) {
  const starterCard = await prisma.card.findUnique({ where: { code: "GD01-001" } });
  const starterCard2 = await prisma.card.findUnique({ where: { code: "GD01-090" } });

  if (starterCard) {
    const adminDeck = await prisma.deck.findFirst({ where: { userId: admin.id, name: "Aile Strike Midrange" } });
    if (!adminDeck) {
      await prisma.deck.create({
        data: {
          userId: admin.id,
          name: "Aile Strike Midrange",
          format: "constructed",
          visibility: "PRIVATE",
          isPrimary: true,
          notes: "Deck seed administrativo.",
          items: { create: [{ cardId: starterCard.id, quantity: 4, section: "main" }] },
        },
      });
    }

    const publicDeck = await prisma.deck.findFirst({ where: { userId: user.id, name: "Public Seed Deck" } });
    if (!publicDeck) {
      await prisma.deck.create({
        data: {
          userId: user.id,
          name: "Public Seed Deck",
          format: "constructed",
          visibility: "PUBLIC",
          isPrimary: true,
          notes: "Deck seed público para validar share link e área pública.",
          items: {
            create: [
              { cardId: starterCard.id, quantity: 4, section: "main" },
              ...(starterCard2 ? [{ cardId: starterCard2.id, quantity: 2, section: "main" }] : []),
            ],
          },
        },
      });
    }
  }
}

async function main() {
  const catalogDir = process.env.SEED_SOURCE_DIR
    ? path.resolve(process.cwd(), process.env.SEED_SOURCE_DIR)
    : path.resolve(process.cwd(), "data/catalog");

  const defaultSets = [
    {
      code: "GD01",
      nameEn: "Newtype Rising",
      namePt: "Newtype Rising",
      officialUrl: "https://www.gundam-gcg.com/en/products/gd01.html",
      releaseDate: "2025-07-25T00:00:00.000Z",
      shortDescription: "Primeiro booster pack base do jogo, usado como catálogo inicial do portal.",
      setType: "BOOSTER_PACK",
      msrpUsd: 4.99,
      contentSummaryEn: "1 pack includes 12+1 cards.",
      contentSummaryPt: "1 booster contém 12+1 cartas.",
      raritySummary: "130+6 card types: 50 Common, 36 Uncommon, 32 Rare, 12 Legend Rare, 6 Token/Resource.",
      productNotes: "Official product details and artwork may change.",
      sourceTitles: ["Mobile Suit Gundam", "Mobile Suit Gundam Wing", "Mobile Suit Gundam SEED", "Mobile Suit Gundam Unicorn", "Mobile Suit Gundam: The Witch from Mercury"],
      metadataJson: { officialCategory: "Booster Pack" },
    },
    {
      code: "ST01",
      nameEn: "Heroic Beginnings",
      namePt: "Heroic Beginnings",
      officialUrl: "https://www.gundam-gcg.com/en/products/st01.html",
      releaseDate: "2025-07-11T00:00:00.000Z",
      shortDescription: "Starter deck focado em Mobile Suit Gundam.",
      setType: "STARTER_DECK",
      productCodeAlt: "ST01A",
      msrpUsd: 11.99,
      contentSummaryEn: "50-card pre-constructed deck, 10 resource cards, 8 token cards, paper damage counter, rules/playsheet, bonus pack.",
      contentSummaryPt: "Deck pré-construído de 50 cartas, 10 resources, 8 tokens, marcador de dano, rules/playsheet e bonus pack.",
      raritySummary: "2 Legend Rare and 14 Common in starter composition.",
      productNotes: "ST01A includes GUNDAM ASSEMBLE miniatures and second playsheet.",
      sourceTitles: ["Mobile Suit Gundam"],
      starterDeckVariantOf: "ST01A",
      metadataJson: { msrpVariantUsd: 34.99, variantCode: "ST01A" },
    },
    {
      code: "ST02",
      nameEn: "Wings of Advance",
      namePt: "Wings of Advance",
      officialUrl: "https://www.gundam-gcg.com/en/products/st02.html",
      releaseDate: "2025-07-11T00:00:00.000Z",
      shortDescription: "Starter deck focado em Mobile Suit Gundam Wing.",
      setType: "STARTER_DECK",
      productCodeAlt: "ST02A",
      msrpUsd: 11.99,
      contentSummaryEn: "50-card pre-constructed deck, 10 resource cards, 8 token cards, paper damage counter, rules/playsheet, bonus pack.",
      contentSummaryPt: "Deck pré-construído de 50 cartas, 10 resources, 8 tokens, marcador de dano, rules/playsheet e bonus pack.",
      raritySummary: "Starter composition with duplicated cards due to product type.",
      productNotes: "ST02A includes GUNDAM ASSEMBLE miniatures and second playsheet.",
      sourceTitles: ["Mobile Suit Gundam Wing"],
      starterDeckVariantOf: "ST02A",
      metadataJson: { msrpVariantUsd: 34.99, variantCode: "ST02A" },
    },
    {
      code: "ST03",
      nameEn: "Zeon's Rush",
      namePt: "Zeon's Rush",
      officialUrl: "https://www.gundam-gcg.com/en/products/st03.html",
      releaseDate: "2025-07-11T00:00:00.000Z",
      shortDescription: "Starter deck focado em Zeon / Mobile Suit Gundam.",
      setType: "STARTER_DECK",
      productCodeAlt: "ST03A",
      msrpUsd: 11.99,
      contentSummaryEn: "50-card pre-constructed deck, 10 resource cards, 8 token cards, paper damage counter, rules/playsheet, bonus pack.",
      contentSummaryPt: "Deck pré-construído de 50 cartas, 10 resources, 8 tokens, marcador de dano, rules/playsheet e bonus pack.",
      raritySummary: "2 Legend Rare and 14 Common in starter composition.",
      productNotes: "ST03A includes GUNDAM ASSEMBLE miniatures and second playsheet.",
      sourceTitles: ["Mobile Suit Gundam"],
      starterDeckVariantOf: "ST03A",
      metadataJson: { msrpVariantUsd: 34.99, variantCode: "ST03A" },
    },
    {
      code: "ST04",
      nameEn: "SEED Strike",
      namePt: "SEED Strike",
      officialUrl: "https://www.gundam-gcg.com/en/products/st04.html",
      releaseDate: "2025-07-11T00:00:00.000Z",
      shortDescription: "Starter deck focado em Mobile Suit Gundam SEED.",
      setType: "STARTER_DECK",
      productCodeAlt: "ST04A",
      msrpUsd: 11.99,
      contentSummaryEn: "50-card pre-constructed deck, 10 resource cards, 8 token cards, paper damage counter, rules/playsheet, bonus pack.",
      contentSummaryPt: "Deck pré-construído de 50 cartas, 10 resources, 8 tokens, marcador de dano, rules/playsheet e bonus pack.",
      raritySummary: "2 Legend Rare and 14 Common in starter composition.",
      productNotes: "ST04A includes GUNDAM ASSEMBLE miniatures and second playsheet.",
      sourceTitles: ["Mobile Suit Gundam SEED"],
      starterDeckVariantOf: "ST04A",
      metadataJson: { msrpVariantUsd: 34.99, variantCode: "ST04A" },
    },
  ];

  const defaultCards = [
    {
      code: "GD01-001",
      setCode: "GD01",
      nameEn: "Gundam",
      namePt: "Gundam",
      cardType: "UNIT",
      cardSubtypes: [],
      color: "Blue",
      level: 4,
      cost: 3,
      ap: 3,
      hp: 3,
      rarity: "LR",
      trait: "Earth Federation | White Base Team",
      traits: ["Earth Federation", "White Base Team"],
      series: "Mobile Suit Gundam",
      sourceTitle: "Mobile Suit Gundam",
      zone: "Space Earth",
      linkText: "[Amuro Ray]",
      pilotName: "Amuro Ray",
      triggerKeywords: ["When Paired"],
      keywordTags: ["Repair"],
      effectKeywords: ["Repair"],
      hasBurst: false,
      hasMain: false,
      hasAction: false,
      oncePerTurn: false,
      textSectionsJson: [
        { kind: "static", label: "Continuous", textPt: "Todas as suas Units (White Base Team) ganham <Repair 1>.", textEn: "All your (White Base Team) Units gain <Repair 1>." },
        { kind: "trigger", label: "When Paired", textPt: "Se você tiver 2 ou mais outras Units em jogo, compre 1 carta.", textEn: "If you have 2 or more other Units in play, draw 1 card." },
      ],
      officialUrl: "https://www.gundam-gcg.com/en/cards/?package=616101",
    },
    {
      code: "GD01-090",
      setCode: "GD01",
      nameEn: "Duo Maxwell",
      namePt: "Duo Maxwell",
      cardType: "PILOT",
      cardSubtypes: ["Character"],
      color: "Green",
      level: 4,
      cost: 1,
      ap: 1,
      hp: 2,
      rarity: "R",
      trait: "Operation Meteor",
      traits: ["Operation Meteor"],
      series: "Mobile Suit Gundam Wing",
      sourceTitle: "Mobile Suit Gundam Wing",
      zone: null,
      linkText: "-",
      pilotName: "Duo Maxwell",
      triggerKeywords: ["During Link"],
      keywordTags: [],
      effectKeywords: [],
      hasBurst: true,
      hasMain: false,
      hasAction: false,
      oncePerTurn: false,
      textSectionsJson: [
        { kind: "burst", label: "Burst", textPt: "Adicione esta carta à sua mão.", textEn: "Add this card to your hand." },
        { kind: "trigger", label: "During Link", textPt: "A AP desta Unit não pode ser reduzida por efeitos do inimigo.", textEn: "This Unit's AP can't be reduced by enemy effects." },
      ],
      officialUrl: "https://www.gundam-gcg.com/en/cards/?package=616101",
    },
    {
      code: "GD01-099",
      setCode: "GD01",
      nameEn: "Intercept Orders",
      namePt: "Intercept Orders",
      cardType: "COMMAND",
      cardSubtypes: ["Tactic"],
      color: "Blue",
      level: 4,
      cost: 2,
      ap: null,
      hp: null,
      rarity: "R",
      trait: null,
      traits: [],
      series: "Mobile Suit Gundam",
      sourceTitle: "Mobile Suit Gundam",
      zone: null,
      linkText: "-",
      pilotName: null,
      triggerKeywords: ["Burst", "Main", "Action"],
      keywordTags: [],
      effectKeywords: [],
      hasBurst: true,
      hasMain: true,
      hasAction: true,
      oncePerTurn: false,
      textSectionsJson: [
        { kind: "burst", label: "Burst", textPt: "Escolha 1 Unit inimiga com 5 ou menos HP. Descanse-a.", textEn: "Choose 1 enemy Unit with 5 or less HP. Rest it." },
        { kind: "main", label: "Main / Action", textPt: "Escolha 1 a 2 Units inimigas com 3 ou menos HP. Descanse-as.", textEn: "Choose 1 to 2 enemy Units with 3 or less HP. Rest them." },
      ],
      officialUrl: "https://www.gundam-gcg.com/en/cards/?package=616101",
    },
    {
      code: "GD01-129",
      setCode: "GD01",
      nameEn: "Kusanagi",
      namePt: "Kusanagi",
      cardType: "BASE",
      cardSubtypes: ["Warship"],
      color: "White",
      level: 4,
      cost: 2,
      ap: 0,
      hp: 4,
      rarity: "U",
      trait: "Triple Ship Alliance | Warship",
      traits: ["Triple Ship Alliance", "Warship"],
      series: "Mobile Suit Gundam SEED",
      sourceTitle: "Mobile Suit Gundam SEED",
      zone: "Space",
      linkText: "-",
      pilotName: null,
      triggerKeywords: ["Burst", "Deploy"],
      keywordTags: [],
      effectKeywords: [],
      hasBurst: true,
      hasMain: false,
      hasAction: false,
      oncePerTurn: false,
      textSectionsJson: [
        { kind: "burst", label: "Burst", textPt: "Faça deploy desta carta.", textEn: "Deploy this card." },
        { kind: "deploy", label: "Deploy", textPt: "Adicione 1 dos seus Shields à sua mão. Depois, escolha 1 Unit inimiga com 3 ou menos HP e devolva-a para a mão do dono.", textEn: "Add 1 of your Shields to your hand. Then, choose 1 enemy Unit with 3 or less HP and return it to its owner's hand." },
      ],
      officialUrl: "https://www.gundam-gcg.com/en/cards/?package=616101",
    },
    {
      code: "T-011",
      setCode: "GD01",
      nameEn: "Fatum-00",
      namePt: "Fatum-00",
      cardType: "UNIT_TOKEN",
      cardSubtypes: ["Token"],
      color: null,
      level: null,
      cost: null,
      ap: 2,
      hp: 2,
      rarity: "TOKEN",
      trait: "Triple Ship Alliance",
      traits: ["Triple Ship Alliance"],
      series: "Mobile Suit Gundam SEED",
      sourceTitle: "Mobile Suit Gundam SEED",
      zone: null,
      linkText: "-",
      pilotName: null,
      triggerKeywords: [],
      keywordTags: ["Blocker"],
      effectKeywords: ["Blocker"],
      hasBurst: false,
      hasMain: false,
      hasAction: false,
      oncePerTurn: false,
      textSectionsJson: [
        { kind: "static", label: "Blocker", textPt: "Descanse esta Unit para mudar o alvo do ataque para ela.", textEn: "Rest this Unit to change the attack target to it." },
      ],
      officialUrl: "https://www.gundam-gcg.com/en/cards/?package=616101",
    },
    {
      code: "R-002",
      setCode: "GD01",
      nameEn: "Resource",
      namePt: "Resource",
      cardType: "RESOURCE",
      cardSubtypes: ["Basic"],
      color: null,
      level: null,
      cost: null,
      ap: null,
      hp: null,
      rarity: "RESOURCE",
      trait: null,
      traits: [],
      series: "Mobile Suit Gundam",
      sourceTitle: "Mobile Suit Gundam",
      zone: null,
      linkText: "-",
      pilotName: null,
      triggerKeywords: [],
      keywordTags: [],
      effectKeywords: [],
      hasBurst: false,
      hasMain: false,
      hasAction: false,
      oncePerTurn: false,
      textSectionsJson: [
        { kind: "rule", label: "Rule", textPt: "Descanse um Resource ao pagar um custo.", textEn: "Rest a Resource when paying a cost." },
      ],
      officialUrl: "https://www.gundam-gcg.com/en/cards/?package=616101",
    },
  ];

  const defaultRulings = [
    {
      cardCode: "GD01-001",
      sourceType: "OFFICIAL_FAQ",
      title: "Repair 1 no Gundam",
      questionPt: "O Gundam também ganha Repair 1 com o próprio efeito contínuo?",
      answerPt: "Sim. O texto contínuo afeta suas Units do White Base Team, incluindo esta carta quando aplicável.",
      questionEn: "Does Gundam also gain Repair 1 from its own continuous effect?",
      answerEn: "Yes. The continuous text affects your White Base Team Units, including this card when applicable.",
      originalUrl: "https://www.gundam-gcg.com/en/rules/faqs/list.php?series=GD01",
      relatedKeyword: "Repair",
      translationStatus: "reviewed",
    },
    {
      cardCode: "GD01-099",
      sourceType: "OFFICIAL_RULES",
      title: "Main e Action em command",
      questionPt: "Uma Command pode ter janela de Main e Action no mesmo texto?",
      answerPt: "Sim. Cada bloco deve ser respeitado conforme a janela do jogo e o texto da carta.",
      questionEn: "Can a Command have both Main and Action timing in the same text?",
      answerEn: "Yes. Each text block follows its own timing window and resolution.",
      originalUrl: "https://www.gundam-gcg.com/en/pdf/comprehensiverules_en.pdf?260515",
      relatedKeyword: "Action",
      translationStatus: "reviewed",
    },
  ];

  const sets = readJsonIfExists(path.join(catalogDir, "sets.json"), defaultSets);
  const cards = readJsonIfExists(path.join(catalogDir, "cards.json"), defaultCards);
  const rulings = readJsonIfExists(path.join(catalogDir, "rulings.json"), defaultRulings);

  const admin = await seedUser({
    email: process.env.SEED_ADMIN_EMAIL || "admin@gundambr.local",
    password: process.env.SEED_ADMIN_PASSWORD || "admin123",
    displayName: "Administrador Portal BR",
    username: "admin-portal",
    role: UserRole.ADMIN,
    bio: "Conta seed administrativa do portal.",
  });

  const user = await seedUser({
    email: process.env.SEED_USER_EMAIL || "pilot@gundambr.local",
    password: process.env.SEED_USER_PASSWORD || "pilot123",
    displayName: "Usuário Exemplo",
    username: "pilot-example",
    role: UserRole.USER,
    bio: "Perfil seed para testar área do usuário, decks e binders compartilháveis.",
  });

  const setMap = await upsertSets(sets);
  await upsertCards(cards, setMap);
  await upsertRulings(rulings);
  await seedSampleDecks(admin, user);

  console.log(`Seed concluído. Sets: ${sets.length}, Cards: ${cards.length}, Rulings: ${rulings.length}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
