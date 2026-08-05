import "dotenv/config";

import bcrypt from "bcryptjs";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import jwt from "jsonwebtoken";
import multer from "multer";
import { PrismaClient, UserRole, Prisma, BinderKind, CardLanguage, CardType, SetKind, TaxonomyKind, CardRelationType } from "@prisma/client";
import { parseCardEffects } from "../src/lib/gundam-card-effects.ts";

const prisma = new PrismaClient();
const app = express();
const PORT = Number(process.env.API_PORT ?? 8787);
const JWT_SECRET = process.env.JWT_SECRET || "change-this-secret";
const uploadRootDir = path.resolve(process.cwd(), process.env.LOCAL_UPLOAD_DIR || "public/uploads");
const cardUploadDir = path.join(uploadRootDir, "cards");
fs.mkdirSync(cardUploadDir, { recursive: true });

const STORAGE_DRIVER = (process.env.STORAGE_DRIVER || "local").toLowerCase();
const PUBLIC_APP_URL = (process.env.PUBLIC_APP_URL || process.env.VITE_PUBLIC_APP_URL || "").replace(/\/$/, "");
const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const SUPABASE_STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "card-images";
const SUPABASE_STORAGE_PUBLIC_BASE_URL = (process.env.SUPABASE_STORAGE_PUBLIC_BASE_URL || "").replace(/\/$/, "");
const MAX_IMAGE_UPLOAD_MB = Number(process.env.MAX_IMAGE_UPLOAD_MB || 8);

app.use(cors());
app.use(express.json({ limit: "4mb" }));
app.use("/uploads", express.static(uploadRootDir, {
  maxAge: STORAGE_DRIVER === "local" ? "1d" : 0,
  immutable: false,
}));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_UPLOAD_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype?.startsWith("image/")) return cb(new Error("Apenas imagens são aceitas."));
    cb(null, true);
  },
});

type AuthPayload = {
  userId: string;
  role: UserRole;
  email: string;
  username: string;
};

type RequestWithUser = Request & { user?: AuthPayload };

type CardInput = {
  code: string;
  externalId?: string | null;
  recordId?: string;
  nameEn: string;
  namePt?: string;
  metadataJson?: unknown;
  cardType: string;
  cardSubtypes?: string[];
  color?: string;
  cost?: number;
  level?: number;
  ap?: number;
  hp?: number;
  rarity?: string;
  trait?: string;
  traits?: string[];
  series?: string;
  sourceTitle?: string;
  zone?: string | null;
  linkText?: string | null;
  pilotName?: string | null;
  effectEn?: string;
  effectPt?: string;
  burstEffectPt?: string;
  burstEffectEn?: string;
  triggerKeywords?: string[];
  keywordTags?: string[];
  effectKeywords?: string[];
  textSectionsJson?: unknown;
  hasBurst?: boolean;
  hasMain?: boolean;
  hasAction?: boolean;
  oncePerTurn?: boolean;
  imageUrl?: string | null;
  thumbUrl?: string | null;
  imageSmallUrl?: string | null;
  imageMediumUrl?: string | null;
  imageLargeUrl?: string | null;
  imageSourceUrl?: string | null;
  officialUrl?: string | null;
  setId?: string | null;
  setCode?: string;
  legalityStatus?: string;
};

type SetInput = {
  code: string;
  nameEn: string;
  namePt?: string;
  officialUrl?: string | null;
  releaseDate?: string | Date | null;
  coverImage?: string | null;
  shortDescription?: string | null;
  setType?: string;
  productCodeAlt?: string | null;
  msrpUsd?: number | null;
  contentSummaryEn?: string | null;
  contentSummaryPt?: string | null;
  raritySummary?: string | null;
  productNotes?: string | null;
  sourceTitles?: string[];
  starterDeckVariantOf?: string | null;
  metadataJson?: unknown;
};

type RulingImportInput = {
  cardCode?: string;
  sourceType: Prisma.RulingCreateInput["sourceType"];
  title: string;
  questionEn?: string | null;
  answerEn?: string | null;
  questionPt?: string | null;
  answerPt?: string | null;
  examplePlayPt?: string | null;
  originalUrl?: string | null;
  relatedKeyword?: string | null;
  relatedPhase?: string | null;
  officialUpdatedAt?: string | Date | null;
  translationStatus?: string | null;
};

type TournamentImportInput = {
  name: string;
  organizer?: string | null;
  country?: string | null;
  city?: string | null;
  format?: string | null;
  season?: string | null;
  sourceUrl?: string | null;
  participantCount?: number | null;
  roundCount?: number | null;
  topCutSize?: number | null;
  dateStart?: string | Date | null;
  dateEnd?: string | Date | null;
};

type ImageManifestInput =
  | { entity: "card"; code: string; imageUrl?: string | null; thumbUrl?: string | null; imageSourceUrl?: string | null }
  | { entity: "set"; code: string; coverImage?: string | null; imageUrl?: string | null };

function signToken(payload: AuthPayload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

function authRequired(req: RequestWithUser, res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return res.status(401).json({ error: "Token ausente." });
  try {
    req.user = jwt.verify(auth.slice(7), JWT_SECRET) as AuthPayload;
    next();
  } catch {
    return res.status(401).json({ error: "Token inválido." });
  }
}

function roleRequired(roles: UserRole[]) {
  return (req: RequestWithUser, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: "Não autenticado." });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: "Sem permissão." });
    next();
  };
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
}

function getImageExtension(file: Express.Multer.File) {
  const fromOriginal = path.extname(file.originalname || "").toLowerCase().replace(/[^.a-z0-9]/g, "");
  if ([".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"].includes(fromOriginal)) return fromOriginal === ".jpeg" ? ".jpg" : fromOriginal;
  if (file.mimetype === "image/png") return ".png";
  if (file.mimetype === "image/webp") return ".webp";
  if (file.mimetype === "image/gif") return ".gif";
  if (file.mimetype === "image/avif") return ".avif";
  return ".jpg";
}

function buildStorageObjectKey(file: Express.Multer.File, input?: { entity?: "cards" | "collections" | "media" | "decks"; cardCode?: string; artId?: string; label?: string }) {
  const now = new Date();
  const yyyy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const card = slugify(input?.cardCode || "uncataloged") || "uncataloged";
  const art = slugify(input?.artId || input?.label || "art") || "art";
  const suffix = crypto.randomUUID().slice(0, 8);
  const entity = input?.entity || "cards";
  return `${entity}/${yyyy}/${mm}/${card}/${art}-${suffix}${getImageExtension(file)}`;
}

function toAbsolutePublicUrl(relativeUrl: string) {
  if (relativeUrl.startsWith("http://") || relativeUrl.startsWith("https://")) return relativeUrl;
  return PUBLIC_APP_URL ? `${PUBLIC_APP_URL}${relativeUrl.startsWith("/") ? "" : "/"}${relativeUrl}` : relativeUrl;
}

async function saveImageLocally(file: Express.Multer.File, objectKey: string) {
  const absolutePath = path.join(uploadRootDir, objectKey);
  await fs.promises.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.promises.writeFile(absolutePath, file.buffer);
  const relativeUrl = `/uploads/${objectKey}`;
  return {
    imageUrl: relativeUrl,
    publicUrl: toAbsolutePublicUrl(relativeUrl),
    storageDriver: "local",
    storageBucket: "local",
    storageKey: objectKey,
  };
}

async function saveImageToSupabase(file: Express.Multer.File, objectKey: string) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Storage Supabase não configurado. Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY ou use STORAGE_DRIVER=local.");
  }

  const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${encodeURIComponent(SUPABASE_STORAGE_BUCKET)}/${objectKey}`;
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      "Content-Type": file.mimetype || "application/octet-stream",
      "Cache-Control": "public, max-age=31536000, immutable",
      "x-upsert": "true",
    },
    body: file.buffer,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Falha no upload para Supabase Storage: ${response.status} ${text}`.trim());
  }

  const publicUrl = SUPABASE_STORAGE_PUBLIC_BASE_URL
    ? `${SUPABASE_STORAGE_PUBLIC_BASE_URL}/${objectKey}`
    : `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_STORAGE_BUCKET}/${objectKey}`;

  return {
    imageUrl: publicUrl,
    publicUrl,
    storageDriver: "supabase",
    storageBucket: SUPABASE_STORAGE_BUCKET,
    storageKey: objectKey,
  };
}

async function saveUploadedCardImage(file: Express.Multer.File, input?: { entity?: "cards" | "collections" | "media" | "decks"; cardCode?: string; artId?: string; label?: string }) {
  if (!file.buffer?.length) throw new Error("Arquivo de imagem vazio.");
  const objectKey = buildStorageObjectKey(file, input);
  if (STORAGE_DRIVER === "supabase") return saveImageToSupabase(file, objectKey);
  if (STORAGE_DRIVER !== "local") throw new Error(`STORAGE_DRIVER inválido: ${STORAGE_DRIVER}. Use local ou supabase.`);
  return saveImageLocally(file, objectKey);
}

function normalizeQueryValue(input: unknown) {
  return String(input ?? "").trim();
}

function parsePositiveInt(input: unknown, fallback: number, max = 100) {
  const value = Number.parseInt(String(input ?? ""), 10);
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.min(value, max);
}

function parseIntegerFilter(input: unknown) {
  const raw = normalizeQueryValue(input);
  if (!raw) return undefined;
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) ? value : undefined;
}

function normalizeAssetUrl(input: unknown, folder: string) {
  const value = String(input ?? "").trim().replace(/\\/g, "/");
  if (!value) return null;
  if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("/")) return value;
  return `/${folder}/${value.replace(/^\/+/, "")}`;
}

function toDateOrNull(input: unknown) {
  if (!input) return null;
  const date = input instanceof Date ? input : new Date(String(input));
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseOptionalFloat(input: unknown) {
  if (input === null || input === undefined) return null;
  const raw = String(input).trim();
  if (!raw) return null;
  const normalized = raw.replace(/\$/g, "").replace(/\s+/g, "").replace(/\.(?=\d{3}(?:\D|$))/g, "").replace(/,/g, ".");
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

function normalizeSetType(value: unknown): SetKind {
  const raw = String(value || "BOOSTER_PACK").trim().toUpperCase();
  if (raw === "STARTER_DECK") return SetKind.STARTER_DECK;
  if (raw === "ACCESSORIES") return SetKind.ACCESSORIES;
  if (raw === "PREMIUM_BANDAI") return SetKind.PREMIUM_BANDAI;
  if (raw === "OTHER") return SetKind.OTHER;
  return SetKind.BOOSTER_PACK;
}

function normalizeCardType(value: unknown): CardType {
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

function normalizeTaxonomyKind(value: unknown): TaxonomyKind {
  const raw = String(value || "TRAIT").trim().toUpperCase();
  return raw === "SOURCE_TITLE" ? TaxonomyKind.SOURCE_TITLE : TaxonomyKind.TRAIT;
}

function normalizeArtVariants(card: CardInput) {
  const incomingMetadata = card.metadataJson && typeof card.metadataJson === "object" && !Array.isArray(card.metadataJson)
    ? (card.metadataJson as Record<string, unknown>)
    : {};
  const rawVariants = Array.isArray(incomingMetadata.artVariants) ? incomingMetadata.artVariants as Array<any> : [];
  const fallbackVariant = card.imageUrl || card.thumbUrl || card.imageSourceUrl
    ? [{
        id: "art-1",
        label: "Arte 1",
        smallUrl: card.imageSmallUrl || card.thumbUrl,
        mediumUrl: card.imageMediumUrl || card.imageUrl,
        largeUrl: card.imageLargeUrl || card.imageUrl,
        url: card.imageMediumUrl || card.imageUrl,
        thumbUrl: card.imageSmallUrl || card.thumbUrl,
        sourceUrl: card.imageSourceUrl,
        rarity: card.rarity || null,
        isPrimary: true,
        position: 0,
      }]
    : [];

  const seeded = (rawVariants.length ? rawVariants : fallbackVariant)
    .map((item: any, index: number) => ({
      id: String(item?.id || `art-${index + 1}`),
      label: String(item?.label || `Arte ${index + 1}`),
      smallUrl: normalizeAssetUrl(item?.smallUrl || item?.thumbUrl, "images/cards/thumbs"),
      mediumUrl: normalizeAssetUrl(item?.mediumUrl || item?.url || item?.imageUrl, "images/cards"),
      largeUrl: normalizeAssetUrl(item?.largeUrl, "images/cards"),
      url: normalizeAssetUrl(item?.mediumUrl || item?.url || item?.imageUrl, "images/cards"),
      thumbUrl: normalizeAssetUrl(item?.smallUrl || item?.thumbUrl, "images/cards/thumbs"),
      sourceUrl: String(item?.sourceUrl || item?.imageSourceUrl || "").trim() || null,
      rarity: String(item?.rarity || card.rarity || "").trim() || null,
      isPrimary: Boolean(item?.isPrimary),
      position: Number.isFinite(Number(item?.position)) ? Number(item.position) : index,
    }))
    .filter((item) => item.url || item.thumbUrl || item.sourceUrl || item.label || item.isPrimary);

  if (!seeded.length) return { artVariants: [], primary: null as null | { url: string | null; thumbUrl: string | null; sourceUrl: string | null } };

  let primaryIndex = seeded.findIndex((item) => item.isPrimary);
  if (primaryIndex < 0) primaryIndex = seeded.findIndex((item) => Boolean(item.url));
  if (primaryIndex < 0) primaryIndex = 0;

  const artVariants = seeded.map((item, index) => ({ ...item, isPrimary: index === primaryIndex, position: index }));
  const primary = artVariants[primaryIndex] || null;
  return { artVariants, primary };
}

function buildEffectText(card: CardInput) {
  const sections = Array.isArray(card.textSectionsJson) ? card.textSectionsJson as Array<any> : [];
  if (!sections.length) return { effectPt: card.effectPt || null, effectEn: card.effectEn || null };
  const pt = sections.map((section) => (section?.textPt ? `[${section.label || section.kind || "effect"}] ${section.textPt}` : null)).filter(Boolean).join("\n");
  const en = sections.map((section) => (section?.textEn ? `[${section.label || section.kind || "effect"}] ${section.textEn}` : null)).filter(Boolean).join("\n");
  return { effectPt: pt || card.effectPt || null, effectEn: en || card.effectEn || null };
}

function normalizeCardEffectPayload(card: CardInput) {
  const parsed = parseCardEffects(card.effectPt || "", card.burstEffectPt || "");
  const mergedSections = Array.isArray(card.textSectionsJson) && card.textSectionsJson.length
    ? card.textSectionsJson
    : parsed.sections;

  const incomingMetadata = card.metadataJson && typeof card.metadataJson === "object" && !Array.isArray(card.metadataJson)
    ? (card.metadataJson as Record<string, unknown>)
    : {};

  const metadataJson = {
    ...incomingMetadata,
    nativeKeywordTags: parsed.nativeKeywordTags,
    conditionalKeywordTags: parsed.conditionalKeywordTags,
    keywordMeta: parsed.keywordMeta,
    sectionMeta: parsed.sectionMeta,
    linkRequirements: parsed.linkRequirements,
  };

  return {
    triggerKeywords: Array.from(new Set([...(Array.isArray(card.triggerKeywords) ? card.triggerKeywords : []), ...parsed.triggerKeywords])),
    effectKeywords: Array.from(new Set([...(Array.isArray(card.effectKeywords) ? card.effectKeywords : []), ...parsed.effectKeywords])),
    keywordTags: Array.from(new Set([...(Array.isArray(card.keywordTags) ? card.keywordTags : []), ...parsed.keywordTags])),
    textSectionsJson: (mergedSections as Prisma.InputJsonValue) ?? Prisma.JsonNull,
    metadataJson: (metadataJson as Prisma.InputJsonValue) ?? Prisma.JsonNull,
    hasBurst: Boolean(card.hasBurst || parsed.hasBurst),
    hasMain: Boolean(card.hasMain || parsed.hasMain),
    hasAction: Boolean(card.hasAction || parsed.hasAction),
    oncePerTurn: Boolean(card.oncePerTurn || parsed.oncePerTurn),
  };
}

async function upsertSets(items: SetInput[]) {
  const setMap = new Map<string, string>();
  for (const set of items) {
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
        msrpUsd: parseOptionalFloat(set.msrpUsd),
        contentSummaryEn: set.contentSummaryEn || null,
        contentSummaryPt: set.contentSummaryPt || null,
        raritySummary: set.raritySummary || null,
        productNotes: set.productNotes || null,
        sourceTitles: Array.isArray(set.sourceTitles) ? set.sourceTitles.filter(Boolean) : [],
        starterDeckVariantOf: set.starterDeckVariantOf || null,
        metadataJson: (set.metadataJson as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        isActive: true,
        deletedAt: null,
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
        msrpUsd: parseOptionalFloat(set.msrpUsd),
        contentSummaryEn: set.contentSummaryEn || null,
        contentSummaryPt: set.contentSummaryPt || null,
        raritySummary: set.raritySummary || null,
        productNotes: set.productNotes || null,
        sourceTitles: Array.isArray(set.sourceTitles) ? set.sourceTitles.filter(Boolean) : [],
        starterDeckVariantOf: set.starterDeckVariantOf || null,
        metadataJson: (set.metadataJson as Prisma.InputJsonValue) ?? Prisma.JsonNull,
      },
    });
    setMap.set(set.code, saved.id);
  }
  return setMap;
}

async function upsertCards(items: CardInput[], setMap = new Map<string, string>(), fallbackSetId?: string) {
  for (const card of items) {
    const setId = card.setId ?? (card.setCode ? setMap.get(card.setCode) || null : fallbackSetId || null);
    const traits = Array.isArray(card.traits) && card.traits.length ? card.traits.filter(Boolean) : [card.trait].filter(Boolean);
    const normalizedEffects = normalizeCardEffectPayload(card);
    const { effectPt, effectEn } = buildEffectText({ ...card, textSectionsJson: normalizedEffects.textSectionsJson });
    const metadata = normalizedEffects.metadataJson && typeof normalizedEffects.metadataJson === "object" && !Array.isArray(normalizedEffects.metadataJson)
      ? { ...(normalizedEffects.metadataJson as Record<string, unknown>) }
      : {};
    const artState = normalizeArtVariants(card);
    if (artState.artVariants.length) metadata.artVariants = artState.artVariants as unknown as Prisma.InputJsonValue;
    else delete metadata.artVariants;
    const inferredLinkText = Array.isArray(metadata.linkRequirements)
      ? metadata.linkRequirements.map((item: any) => item.qualifier).filter(Boolean).join(" | ")
      : null;
    const primaryImageUrl = artState.primary?.mediumUrl || artState.primary?.url || normalizeAssetUrl(card.imageMediumUrl || card.imageUrl, "images/cards");
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
    if (card.recordId) {
      await prisma.card.update({ where: { id: card.recordId }, data });
    } else if (card.externalId) {
      await prisma.card.upsert({ where: { externalId: card.externalId }, update: data, create: data });
    } else {
      const existing = await prisma.card.findFirst({ where: { code: card.code, setId } });
      if (existing) await prisma.card.update({ where: { id: existing.id }, data });
      else await prisma.card.create({ data });
    }
    await syncCardModelForCode(card.code);
  }
}

const MODEL_FIELDS_FROM_CARD = [
  "nameEn", "namePt", "cardType", "cardSubtypes", "color", "level", "cost", "ap", "hp",
  "trait", "traits", "series", "sourceTitle", "zone", "linkText", "pilotName",
  "effectEn", "effectPt", "triggerKeywords", "keywordTags", "effectKeywords",
  "textSectionsJson", "hasBurst", "hasMain", "hasAction", "oncePerTurn", "legalityStatus",
] as const;
const ALT_ART_RARITY_PATTERN = /\+|Promo|Winner|Judge|SP/i;

/** Mantém CardModel em dia depois que upsertCards mexe num code — cria o modelo se não
 *  existir ainda, escolhe a impressão "regular" (raridade sem +/++/especial, senão a mais
 *  antiga) como fonte dos campos de identidade, e reaponta cardModelId em toda impressão
 *  do code. Mesma heurística usada em prisma/migrate-card-model-data.mjs e
 *  CardDetailPage.tsx — enquanto o admin ainda edita por impressão (fase 2 completa do
 *  redesenho de cadastro fica pra depois), isso evita que uma carta cadastrada/editada
 *  pelo admin suma das páginas públicas, que agora consultam CardModel. */
/** Mesma heurística de prisma/migrate-card-model-data.mjs: nome bruto sem parênteses é o
 *  sinal mais confiável de impressão regular — variantes (alt-art, promo, evento) sempre
 *  carregam sufixo entre parênteses no nome, mesmo quando a raridade em si não muda. */
function pickRepresentativePrint(prints: any[]) {
  const semParenteses = prints.filter((p) => !p.nameEn.includes("("));
  if (semParenteses.length === 1) return semParenteses[0];
  if (semParenteses.length > 1) {
    const regulares = semParenteses.filter((p) => !ALT_ART_RARITY_PATTERN.test(p.rarity || ""));
    const candidatas = regulares.length ? regulares : semParenteses;
    return candidatas.slice().sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];
  }
  const regular = prints.find((p) => !ALT_ART_RARITY_PATTERN.test(p.rarity || ""));
  if (regular) return regular;
  return [...prints].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];
}

async function syncCardModelForCode(code: string) {
  const prints = await prisma.card.findMany({ where: { code, isActive: true } });
  if (!prints.length) return;
  const representative = pickRepresentativePrint(prints);
  const modelData = Object.fromEntries(MODEL_FIELDS_FROM_CARD.map((field) => [field, (representative as any)[field]]));
  const model = await prisma.cardModel.upsert({ where: { code }, update: modelData, create: { code, ...modelData } as any });
  await prisma.card.updateMany({ where: { code }, data: { cardModelId: model.id, isPrimaryPrint: false } });
  await prisma.card.update({ where: { id: representative.id }, data: { isPrimaryPrint: true } });
}

async function upsertRulings(items: RulingImportInput[]) {
  for (const ruling of items) {
    const card = ruling.cardCode ? await prisma.card.findFirst({ where: { code: ruling.cardCode } }) : null;
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

async function upsertTournaments(items: TournamentImportInput[]) {
  for (const tournament of items) {
    const existing = await prisma.tournament.findFirst({
      where: {
        name: tournament.name,
        dateStart: toDateOrNull(tournament.dateStart),
      },
    });

    const data = {
      name: tournament.name,
      organizer: tournament.organizer || null,
      country: tournament.country || null,
      city: tournament.city || null,
      format: tournament.format || "constructed",
      season: tournament.season || null,
      sourceUrl: tournament.sourceUrl || null,
      participantCount: tournament.participantCount ?? null,
      roundCount: tournament.roundCount ?? null,
      topCutSize: tournament.topCutSize ?? null,
      dateStart: toDateOrNull(tournament.dateStart),
      dateEnd: toDateOrNull(tournament.dateEnd),
    };

    if (existing) await prisma.tournament.update({ where: { id: existing.id }, data });
    else await prisma.tournament.create({ data });
  }
}

async function applyImageManifest(items: ImageManifestInput[]) {
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
      continue;
    }

    await prisma.cardSet.update({
      where: { code: item.code },
      data: {
        coverImage: normalizeAssetUrl(item.coverImage || item.imageUrl, "images/sets"),
      },
    });
  }
}

function getPagination(query: Request["query"], defaults: { pageSize?: number; maxPageSize?: number } = {}) {
  const page = parsePositiveInt(query.page, 1, 10_000);
  const pageSize = parsePositiveInt(query.pageSize, defaults.pageSize ?? 24, defaults.maxPageSize ?? 100);
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize, enabled: Boolean(query.page || query.pageSize) };
}

function setPublicCache(res: Response, maxAgeSeconds = 30, staleSeconds = 120) {
  res.setHeader("Cache-Control", `public, max-age=${maxAgeSeconds}, stale-while-revalidate=${staleSeconds}`);
}

function setPrivateCache(res: Response, maxAgeSeconds = 10, staleSeconds = 30) {
  res.setHeader("Cache-Control", `private, max-age=${maxAgeSeconds}, stale-while-revalidate=${staleSeconds}`);
}

function serializeUser(user: any, stats?: { deckCount: number; publicDeckCount: number; wishlistCount?: number; ownedCount?: number }) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    username: user.username,
    role: user.role,
    bio: user.bio,
    avatarUrl: user.avatarUrl,
    isActive: user.isActive,
    preferredCardLanguage: user.preferredCardLanguage,
    preferredTheme: user.preferredTheme,
    stats,
  };
}

async function ensureUserBinders(userId: string) {
  await Promise.all([
    prisma.cardBinder.upsert({
      where: { userId_kind: { userId, kind: BinderKind.WISHLIST } },
      update: {},
      create: { userId, kind: BinderKind.WISHLIST, name: "Lista de Desejos", description: "Cartas que quero adquirir." },
    }),
    prisma.cardBinder.upsert({
      where: { userId_kind: { userId, kind: BinderKind.OWNED } },
      update: {},
      create: { userId, kind: BinderKind.OWNED, name: "Cartas Possuídas", description: "Cartas que já tenho." },
    }),
  ]);
}

async function requireActiveUser(req: RequestWithUser, res: Response) {
  const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  if (!user || !user.isActive) {
    res.status(403).json({ error: "Usuário sem acesso ativo." });
    return null;
  }
  return user;
}

async function ensureAdminSeed() {
  const email = process.env.SEED_ADMIN_EMAIL ?? "admin@gundambr.local";
  const password = process.env.SEED_ADMIN_PASSWORD ?? "admin123";
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, isActive: true, preferredCardLanguage: CardLanguage.PT_BR, preferredTheme: "dark" },
    create: {
      email,
      username: "admin-portal",
      displayName: "Administrador Portal BR",
      passwordHash,
      role: UserRole.ADMIN,
      bio: "Conta seed administrativa do portal.",
      isActive: true,
      preferredCardLanguage: CardLanguage.PT_BR,
      preferredTheme: "dark",
    },
  });
  await ensureUserBinders(user.id);
}

app.get("/api/health", async (_req, res) => {
  setPublicCache(res, 15, 60);
  const [userCount, cardCount, deckCount, binderCount] = await Promise.all([
    prisma.user.count({ where: { isActive: true } }),
    prisma.card.count(),
    prisma.deck.count(),
    prisma.cardBinder.count(),
  ]);
  res.json({ ok: true, runtime: "prisma", userCount, cardCount, deckCount, binderCount });
});

app.post("/api/auth/register", async (req, res) => {
  const { email, password, displayName } = req.body as {
    email?: string;
    password?: string;
    displayName?: string;
  };
  if (!email || !password || !displayName) return res.status(400).json({ error: "Email, senha e nome são obrigatórios." });

  const usernameBase = slugify(displayName || email.split("@")[0] || "user");
  let username = usernameBase;
  let suffix = 1;
  while (await prisma.user.findUnique({ where: { username } })) {
    username = `${usernameBase}-${suffix++}`;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      email,
      displayName,
      username,
      passwordHash,
      role: UserRole.USER,
      isActive: true,
      preferredCardLanguage: CardLanguage.PT_BR,
      preferredTheme: "dark",
    },
  });
  await ensureUserBinders(user.id);
  const token = signToken({ userId: user.id, role: user.role, email: user.email, username: user.username });
  res.status(201).json({ token, user: serializeUser(user) });
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const normalizedPassword = String(password || "");
  if (!normalizedEmail || !normalizedPassword) return res.status(400).json({ error: "Email e senha são obrigatórios." });
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!user || !user.isActive || !(await bcrypt.compare(normalizedPassword, user.passwordHash))) return res.status(401).json({ error: "Credenciais inválidas ou usuário inativo." });
  await ensureUserBinders(user.id);
  const token = signToken({ userId: user.id, role: user.role, email: user.email, username: user.username });
  res.json({ token, user: serializeUser(user) });
});

app.get("/api/auth/me", authRequired, async (req: RequestWithUser, res) => {
  const user = await requireActiveUser(req, res);
  if (!user) return;
  await ensureUserBinders(user.id);
  const [deckCount, publicDeckCount, wishlistCount, ownedCount] = await Promise.all([
    prisma.deck.count({ where: { userId: user.id } }),
    prisma.deck.count({ where: { userId: user.id, visibility: "PUBLIC" } }),
    prisma.cardBinderItem.count({ where: { binder: { userId: user.id, kind: BinderKind.WISHLIST } } }),
    prisma.cardBinderItem.count({ where: { binder: { userId: user.id, kind: BinderKind.OWNED } } }),
  ]);
  res.json(serializeUser(user, { deckCount, publicDeckCount, wishlistCount, ownedCount }));
});

app.put("/api/auth/me", authRequired, async (req: RequestWithUser, res) => {
  const current = await requireActiveUser(req, res);
  if (!current) return;
  const { displayName, bio, avatarUrl, preferredCardLanguage, preferredTheme } = req.body as { displayName?: string; bio?: string; avatarUrl?: string; preferredCardLanguage?: CardLanguage; preferredTheme?: string };
  const user = await prisma.user.update({
    where: { id: req.user!.userId },
    data: {
      displayName: displayName ?? current.displayName,
      bio: bio ?? current.bio,
      avatarUrl: avatarUrl ?? current.avatarUrl,
      preferredCardLanguage: preferredCardLanguage ?? current.preferredCardLanguage,
      preferredTheme: preferredTheme ?? current.preferredTheme,
    },
  });
  res.json(serializeUser(user));
});

app.put("/api/auth/password", authRequired, async (req: RequestWithUser, res) => {
  const current = await requireActiveUser(req, res);
  if (!current) return;
  const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword?: string };
  if (!currentPassword || !newPassword) return res.status(400).json({ error: "Senha atual e nova senha são obrigatórias." });
  if (!(await bcrypt.compare(currentPassword, current.passwordHash))) return res.status(401).json({ error: "Senha atual inválida." });
  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: current.id }, data: { passwordHash } });
  res.json({ ok: true });
});

app.get("/api/users/admin", authRequired, roleRequired([UserRole.ADMIN]), async (_req, res) => {
  setPrivateCache(res, 5, 20);
  const users = await prisma.user.findMany({ orderBy: [{ createdAt: "desc" }], include: { _count: { select: { decks: true, binders: true } } } });
  res.json(users);
});

app.put("/api/users/admin/:id", authRequired, roleRequired([UserRole.ADMIN]), async (req, res) => {
  const id = String(req.params.id);
  const payload = req.body as { displayName?: string; role?: UserRole; isActive?: boolean; bio?: string };
  const user = await prisma.user.update({
    where: { id },
    data: {
      displayName: payload.displayName,
      role: payload.role,
      isActive: payload.isActive,
      bio: payload.bio,
    },
  });
  res.json(serializeUser(user));
});

app.get("/api/users/:username", async (req, res) => {
  setPublicCache(res, 20, 60);
  const username = String(req.params.username);
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !user.isActive) return res.status(404).json({ error: "Perfil não encontrado." });
  const [decks, binders] = await Promise.all([
    prisma.deck.findMany({
      where: { userId: user.id, visibility: "PUBLIC" },
      include: { items: { include: { card: true } } },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.cardBinder.findMany({
      where: { userId: user.id, isPublic: true },
      include: { _count: { select: { items: true } } },
      orderBy: [{ kind: "asc" }],
    }),
  ]);
  res.json({ id: user.id, username: user.username, displayName: user.displayName, bio: user.bio, avatarUrl: user.avatarUrl, decks, binders });
});

app.get("/api/binders/me", authRequired, async (req: RequestWithUser, res) => {
  const current = await requireActiveUser(req, res);
  if (!current) return;
  await ensureUserBinders(current.id);
  const binders = await prisma.cardBinder.findMany({ where: { userId: current.id }, include: { items: { include: { card: { include: { set: true } } } } }, orderBy: [{ kind: "asc" }] });
  res.json(binders);
});

app.put("/api/binders/me/:kind", authRequired, async (req: RequestWithUser, res) => {
  const current = await requireActiveUser(req, res);
  if (!current) return;
  const kind = String(req.params.kind).toUpperCase() as BinderKind;
  const payload = req.body as { name?: string; description?: string; isPublic?: boolean; items?: Array<{ cardId: string; quantity: number; note?: string | null }> };
  const binder = await prisma.cardBinder.upsert({
    where: { userId_kind: { userId: current.id, kind } },
    update: {
      name: payload.name,
      description: payload.description,
      isPublic: payload.isPublic,
    },
    create: {
      userId: current.id,
      kind,
      name: payload.name || (kind === BinderKind.WISHLIST ? "Lista de Desejos" : "Cartas Possuídas"),
      description: payload.description,
      isPublic: payload.isPublic ?? true,
    },
  });
  if (payload.items) {
    await prisma.cardBinderItem.deleteMany({ where: { binderId: binder.id } });
    if (payload.items.length) {
      await prisma.cardBinderItem.createMany({
        data: payload.items.map((item) => ({ binderId: binder.id, cardId: item.cardId, quantity: item.quantity, note: item.note || null })),
      });
    }
  }
  const full = await prisma.cardBinder.findUnique({ where: { id: binder.id }, include: { items: { include: { card: { include: { set: true } } } } } });
  res.json(full);
});

app.get("/api/binders/share/:shareId", async (req, res) => {
  setPublicCache(res, 20, 60);
  const binder = await prisma.cardBinder.findUnique({
    where: { shareId: String(req.params.shareId) },
    include: { user: true, items: { include: { card: { include: { set: true } } } } },
  });
  if (!binder || !binder.isPublic || !binder.user.isActive) return res.status(404).json({ error: "Lista não encontrada." });
  res.json(binder);
});

app.get("/api/posts", async (req, res) => {
  setPublicCache(res, 20, 90);
  const status = normalizeQueryValue(req.query.status);
  const pagination = getPagination(req.query, { pageSize: 12, maxPageSize: 50 });
  const where = status ? { status: status as any } : undefined;

  if (pagination.enabled) {
    const [items, total] = await Promise.all([
      prisma.post.findMany({
        where,
        include: { author: true },
        orderBy: [{ updatedAt: "desc" }],
        skip: pagination.skip,
        take: pagination.take,
      }),
      prisma.post.count({ where }),
    ]);
    return res.json({ items, page: pagination.page, pageSize: pagination.pageSize, total, totalPages: Math.max(1, Math.ceil(total / pagination.pageSize)) });
  }

  const posts = await prisma.post.findMany({
    where,
    include: { author: true },
    orderBy: [{ updatedAt: "desc" }],
  });
  res.json(posts);
});

app.post("/api/posts", authRequired, roleRequired([UserRole.ADMIN, UserRole.EDITOR]), async (req: RequestWithUser, res) => {
  const payload = req.body as Record<string, unknown>;
  const title = String(payload.title ?? "").trim();
  if (!title) return res.status(400).json({ error: "Título é obrigatório." });

  const baseSlug = slugify(String(payload.slug || title));
  let slug = baseSlug;
  let suffix = 1;
  while (await prisma.post.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${suffix++}`;
  }

  const post = await prisma.post.create({
    data: {
      authorId: req.user!.userId,
      title,
      slug,
      excerpt: payload.excerpt ? String(payload.excerpt) : null,
      contentMd: String(payload.contentMd ?? ""),
      coverImage: payload.coverImage ? String(payload.coverImage) : null,
      youtubeUrl: payload.youtubeUrl ? String(payload.youtubeUrl) : null,
      postType: (payload.postType as any) || "NEWS",
      status: (payload.status as any) || "DRAFT",
      publishedAt: payload.status === "PUBLISHED" ? new Date() : null,
    },
    include: { author: true },
  });
  res.status(201).json(post);
});

app.put("/api/posts/:id", authRequired, roleRequired([UserRole.ADMIN, UserRole.EDITOR]), async (req, res) => {
  const id = String(req.params.id);
  const payload = req.body as Record<string, unknown>;
  const title = String(payload.title ?? "").trim();
  if (!title) return res.status(400).json({ error: "Título é obrigatório." });

  const current = await prisma.post.findUnique({ where: { id } });
  if (!current) return res.status(404).json({ error: "Post não encontrado." });

  const desiredSlug = slugify(String(payload.slug || title));
  let slug = desiredSlug;
  let suffix = 1;
  while (true) {
    const found = await prisma.post.findUnique({ where: { slug } });
    if (!found || found.id === id) break;
    slug = `${desiredSlug}-${suffix++}`;
  }

  const post = await prisma.post.update({
    where: { id },
    data: {
      title,
      slug,
      excerpt: payload.excerpt ? String(payload.excerpt) : null,
      contentMd: String(payload.contentMd ?? ""),
      coverImage: payload.coverImage ? String(payload.coverImage) : null,
      youtubeUrl: payload.youtubeUrl ? String(payload.youtubeUrl) : null,
      postType: (payload.postType as any) || current.postType,
      status: (payload.status as any) || current.status,
      publishedAt: payload.status === "PUBLISHED" ? current.publishedAt ?? new Date() : payload.status === "DRAFT" ? null : current.publishedAt,
    },
    include: { author: true },
  });
  res.json(post);
});

app.delete("/api/posts/:id", authRequired, roleRequired([UserRole.ADMIN]), async (req, res) => {
  const id = String(req.params.id);
  await prisma.post.delete({ where: { id } });
  res.status(204).send();
});

app.get("/api/sets", async (_req, res) => {
  setPublicCache(res, 60, 300);
  const sets = await prisma.cardSet.findMany({ where: { isActive: true }, include: { _count: { select: { cards: true } } }, orderBy: { code: "asc" } });
  res.json(sets);
});

app.get("/api/sets/:code", async (req, res) => {
  setPublicCache(res, 30, 120);
  const code = String(req.params.code);
  const set = await prisma.cardSet.findFirst({
    where: { code, isActive: true },
    include: {
      cards: {
        include: { rulings: true },
        orderBy: [{ code: "asc" }],
      },
      _count: { select: { cards: true } },
    },
  });
  if (!set) return res.status(404).json({ error: "Coleção não encontrada." });
  res.json(set);
});

app.post("/api/sets", authRequired, roleRequired([UserRole.ADMIN, UserRole.EDITOR]), async (req, res) => {
  const payload = req.body as SetInput;
  const setMap = await upsertSets([payload]);
  const created = await prisma.cardSet.findUnique({ where: { id: setMap.get(payload.code)! } });
  res.status(201).json(created);
});

app.put("/api/sets/:id", authRequired, roleRequired([UserRole.ADMIN, UserRole.EDITOR]), async (req, res) => {
  const id = String(req.params.id);
  const existing = await prisma.cardSet.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "Coleção não encontrada." });
  const payload = { ...req.body, code: req.body.code || existing.code } as SetInput;
  const setMap = await upsertSets([payload]);
  const updated = await prisma.cardSet.findUnique({ where: { id: setMap.get(payload.code)! } });
  res.json(updated);
});

app.delete("/api/sets/:id", authRequired, roleRequired([UserRole.ADMIN]), async (req, res) => {
  const id = String(req.params.id);
  const existing = await prisma.cardSet.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "Coleção não encontrada." });
  await prisma.cardSet.update({ where: { id }, data: { isActive: false, deletedAt: new Date() } });
  res.status(204).send();
});

app.get("/api/taxonomies", async (req, res) => {
  setPublicCache(res, 60, 300);
  const kind = req.query.kind ? normalizeTaxonomyKind(req.query.kind) : undefined;
  const items = await prisma.taxonomyEntry.findMany({
    where: { isActive: true, ...(kind ? { kind } : {}) },
    orderBy: [{ kind: "asc" }, { name: "asc" }],
  });
  res.json(items);
});

app.post("/api/taxonomies", authRequired, roleRequired([UserRole.ADMIN, UserRole.EDITOR]), async (req, res) => {
  const kind = normalizeTaxonomyKind(req.body.kind);
  const name = String(req.body.name || "").trim();
  if (!name) return res.status(400).json({ error: "Nome é obrigatório." });
  const item = await prisma.taxonomyEntry.upsert({
    where: { kind_name: { kind, name } },
    update: { description: req.body.description || null, metadataJson: req.body.metadataJson || Prisma.JsonNull },
    create: { kind, name, slug: slugify(name), description: req.body.description || null, metadataJson: req.body.metadataJson || Prisma.JsonNull },
  });
  res.status(201).json(item);
});

app.put("/api/taxonomies/:id", authRequired, roleRequired([UserRole.ADMIN, UserRole.EDITOR]), async (req, res) => {
  const id = String(req.params.id);
  const existing = await prisma.taxonomyEntry.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "Registro não encontrado." });
  const name = String(req.body.name || existing.name).trim();
  const updated = await prisma.taxonomyEntry.update({
    where: { id },
    data: { kind: req.body.kind ? normalizeTaxonomyKind(req.body.kind) : existing.kind, name, slug: slugify(name), description: req.body.description ?? existing.description, metadataJson: req.body.metadataJson ?? existing.metadataJson ?? Prisma.JsonNull },
  });
  res.json(updated);
});

app.delete("/api/taxonomies/:id", authRequired, roleRequired([UserRole.ADMIN]), async (req, res) => {
  const id = String(req.params.id);
  await prisma.taxonomyEntry.update({ where: { id }, data: { isActive: false, deletedAt: new Date() } });
  res.status(204).send();
});

app.get("/api/cards/:id/relations", async (req, res) => {
  setPublicCache(res, 30, 120);
  const id = String(req.params.id);
  let cardModelId: string | null = null;
  const model = await prisma.cardModel.findUnique({ where: { id }, select: { id: true } });
  if (model) {
    cardModelId = model.id;
  } else {
    const print = await prisma.card.findUnique({ where: { id }, select: { cardModelId: true } });
    cardModelId = print?.cardModelId ?? null;
  }
  if (!cardModelId) return res.status(404).json({ error: "Carta não encontrada." });

  const primaryPrintInclude = { prints: { where: { isActive: true }, include: { set: true }, orderBy: [{ isPrimaryPrint: "desc" as const }, { createdAt: "asc" as const }], take: 1 } };
  const flattenModel = (relation: any, key: "sourceModel" | "targetModel") => {
    const model = relation[key];
    const print = model?.prints?.[0];
    const { prints: _prints, ...modelFields } = model || {};
    return { ...relation, relatedCard: print ? { ...print, ...modelFields, id: print.id } : null };
  };

  const [outgoingRaw, incomingRaw] = await Promise.all([
    prisma.cardRelation.findMany({ where: { sourceModelId: cardModelId, isActive: true }, include: { targetModel: { include: primaryPrintInclude } }, orderBy: [{ relationType: "asc" }, { createdAt: "desc" }] }),
    prisma.cardRelation.findMany({ where: { targetModelId: cardModelId, isActive: true }, include: { sourceModel: { include: primaryPrintInclude } }, orderBy: [{ relationType: "asc" }, { createdAt: "desc" }] }),
  ]);
  const outgoing = outgoingRaw.map((relation) => flattenModel(relation, "targetModel")).filter((relation) => relation.relatedCard);
  const incoming = incomingRaw.map((relation) => flattenModel(relation, "sourceModel")).filter((relation) => relation.relatedCard);
  res.json({ outgoing, incoming });
});

app.post("/api/cards/:id/relations", authRequired, roleRequired([UserRole.ADMIN, UserRole.EDITOR]), async (req, res) => {
  const sourceCardId = String(req.params.id);
  const { targetCardId, relationType, notePt, sourceUrl } = req.body as { targetCardId?: string; relationType?: string; notePt?: string; sourceUrl?: string };
  if (!targetCardId || !relationType) return res.status(400).json({ error: "Carta de destino e tipo de relação são obrigatórios." });
  if (sourceCardId === targetCardId) return res.status(400).json({ error: "Uma carta não pode se relacionar consigo mesma." });
  if (!Object.values(CardRelationType).includes(relationType as CardRelationType)) return res.status(400).json({ error: "Tipo de relação inválido." });
  const [sourceCard, targetCard] = await Promise.all([prisma.card.findUnique({ where: { id: sourceCardId }, select: { cardModelId: true } }), prisma.card.findUnique({ where: { id: targetCardId }, select: { cardModelId: true } })]);
  if (!sourceCard?.cardModelId || !targetCard?.cardModelId) return res.status(404).json({ error: "Uma das impressões selecionadas não tem carta-modelo associada (rode a migração de dado antes)." });
  if (sourceCard.cardModelId === targetCard.cardModelId) return res.status(400).json({ error: "Essas impressões pertencem à mesma carta — não é possível criar relação consigo mesma." });
  const relation = await prisma.cardRelation.upsert({
    where: { sourceModelId_targetModelId_relationType: { sourceModelId: sourceCard.cardModelId, targetModelId: targetCard.cardModelId, relationType: relationType as CardRelationType } },
    update: { notePt: notePt?.trim() || null, sourceUrl: sourceUrl?.trim() || null, isActive: true, deletedAt: null },
    create: { sourceModelId: sourceCard.cardModelId, targetModelId: targetCard.cardModelId, relationType: relationType as CardRelationType, notePt: notePt?.trim() || null, sourceUrl: sourceUrl?.trim() || null },
  });
  res.status(201).json(relation);
});

app.delete("/api/cards/:id/relations/:relationId", authRequired, roleRequired([UserRole.ADMIN, UserRole.EDITOR]), async (req, res) => {
  const sourceCardId = String(req.params.id);
  const sourceCard = await prisma.card.findUnique({ where: { id: sourceCardId }, select: { cardModelId: true } });
  if (!sourceCard?.cardModelId) return res.status(404).json({ error: "Carta não encontrada." });
  const relation = await prisma.cardRelation.findFirst({ where: { id: String(req.params.relationId), sourceModelId: sourceCard.cardModelId } });
  if (!relation) return res.status(404).json({ error: "Relação não encontrada." });
  await prisma.cardRelation.update({ where: { id: relation.id }, data: { isActive: false, deletedAt: new Date() } });
  res.status(204).send();
});

app.get("/api/cards", async (req, res) => {
  setPublicCache(res, 20, 90);
  const q = normalizeQueryValue(req.query.q ?? req.query.search);
  const color = normalizeQueryValue(req.query.color);
  const cardType = normalizeQueryValue(req.query.cardType);
  const media = normalizeQueryValue(req.query.media ?? req.query.series);
  const trait = normalizeQueryValue(req.query.trait);
  const keyword = normalizeQueryValue(req.query.keyword);
  const setCode = normalizeQueryValue(req.query.setCode);
  const rarity = normalizeQueryValue(req.query.rarity);
  const status = normalizeQueryValue(req.query.status ?? req.query.legalityStatus);
  const link = normalizeQueryValue(req.query.link);
  const relation = normalizeQueryValue(req.query.relation);
  const ap = parseIntegerFilter(req.query.ap);
  const hp = parseIntegerFilter(req.query.hp);
  const cost = parseIntegerFilter(req.query.cost);
  const level = parseIntegerFilter(req.query.level);
  const sort = normalizeQueryValue(req.query.sort) || "code_asc";
  const pagination = getPagination(req.query, { pageSize: 24, maxPageSize: 100 });

  const printWhere: Prisma.CardWhereInput = {
    isActive: true,
    ...(rarity ? { rarity } : {}),
    ...(setCode ? { set: { is: { code: setCode } } } : {}),
  };
  const hasPrintFilter = Boolean(rarity || setCode);

  const where: Prisma.CardModelWhereInput = {
    AND: [
      { isActive: true },
      q
        ? {
            OR: [
              { code: { contains: q, mode: "insensitive" } },
              { nameEn: { contains: q, mode: "insensitive" } },
              { namePt: { contains: q, mode: "insensitive" } },
              { series: { contains: q, mode: "insensitive" } },
              { sourceTitle: { contains: q, mode: "insensitive" } },
              { trait: { contains: q, mode: "insensitive" } },
              { linkText: { contains: q, mode: "insensitive" } },
              { pilotName: { contains: q, mode: "insensitive" } },
              { effectEn: { contains: q, mode: "insensitive" } },
              { effectPt: { contains: q, mode: "insensitive" } },
              { keywordTags: { has: q } },
            ],
          }
        : {},
      color ? { color } : {},
      cardType ? (cardType === "COMMAND" || cardType === "COMMAND_PILOT" ? { cardType: { in: [CardType.COMMAND, CardType.COMMAND_PILOT] } } : { cardType: cardType as CardType }) : {},
      media ? { OR: [{ sourceTitle: media }, { series: media }] } : {},
      trait ? { OR: [{ traits: { has: trait } }, { trait: { contains: trait, mode: "insensitive" } }] } : {},
      keyword ? { keywordTags: { has: keyword } } : {},
      status ? { legalityStatus: status } : {},
      ap !== undefined ? { ap } : {},
      hp !== undefined ? { hp } : {},
      cost !== undefined ? { cost } : {},
      level !== undefined ? { level } : {},
      link === "has" ? { OR: [{ linkText: { not: null } }, { pilotName: { not: null } }] } : {},
      link === "pilot-card" ? { cardType: CardType.PILOT } : {},
      link === "pilot-reference" ? { AND: [{ cardType: { in: [CardType.COMMAND, CardType.COMMAND_PILOT] } }, { OR: [{ effectEn: { contains: "[Pilot]", mode: "insensitive" } }, { effectPt: { contains: "[Pilot]", mode: "insensitive" } }] }] } : {},
      link === "none" ? { linkText: null, pilotName: null } : {},
      relation === "missing" ? { AND: [{ outgoingRelations: { none: { isActive: true } } }, { incomingRelations: { none: { isActive: true } } }] } : {},
      relation === "confirmed" ? { OR: [{ outgoingRelations: { some: { isActive: true } } }, { incomingRelations: { some: { isActive: true } } }] } : {},
      hasPrintFilter ? { prints: { some: printWhere } } : {},
    ],
  };

  const orderByMap: Record<string, Prisma.CardModelOrderByWithRelationInput[]> = {
    code_asc: [{ code: "asc" }, { nameEn: "asc" }],
    code_desc: [{ code: "desc" }, { nameEn: "asc" }],
    name_asc: [{ nameEn: "asc" }, { code: "asc" }],
    name_desc: [{ nameEn: "desc" }, { code: "asc" }],
    ap_asc: [{ ap: "asc" }, { code: "asc" }],
    ap_desc: [{ ap: "desc" }, { code: "asc" }],
    hp_asc: [{ hp: "asc" }, { code: "asc" }],
    hp_desc: [{ hp: "desc" }, { code: "asc" }],
    cost_asc: [{ cost: "asc" }, { code: "asc" }],
    cost_desc: [{ cost: "desc" }, { code: "asc" }],
    level_asc: [{ level: "asc" }, { code: "asc" }],
    level_desc: [{ level: "desc" }, { code: "asc" }],
    updated_desc: [{ updatedAt: "desc" }, { code: "asc" }],
    updated_asc: [{ updatedAt: "asc" }, { code: "asc" }],
    created_desc: [{ createdAt: "desc" }, { code: "asc" }],
    created_asc: [{ createdAt: "asc" }, { code: "asc" }],
    // rarity_* não existe mais em CardModel (raridade é por impressão) — cai no default.
  };
  const orderBy = orderByMap[sort] || orderByMap.code_asc;

  const printInclude = {
    prints: {
      where: hasPrintFilter ? printWhere : { isActive: true },
      include: { set: true },
      orderBy: [{ isPrimaryPrint: "desc" as const }, { createdAt: "asc" as const }],
      take: 1,
    },
    _count: { select: { prints: { where: { isActive: true } } } },
  };

  // "Achata" CardModel + a impressão representativa (a que bate com o filtro de raridade/
  // coleção quando houver, senão a impressão primária) num objeto só, no mesmo formato que
  // o front-end já espera de uma "carta" — evita reescrever CardsPage/CardDetailPage juntos
  // nesta mesma resposta. `id` é sempre o id do CardModel; `printId` é a impressão exibida.
  const flattenModel = (model: any) => {
    const print = model.prints[0];
    const { prints: _prints, _count, ...modelFields } = model;
    return { ...modelFields, ...print, id: model.id, printId: print?.id ?? null, printCount: _count?.prints ?? 0 };
  };

  if (pagination.enabled) {
    const [items, total] = await Promise.all([
      prisma.cardModel.findMany({ where, include: printInclude, orderBy, skip: pagination.skip, take: pagination.take }),
      prisma.cardModel.count({ where }),
    ]);
    return res.json({ items: items.map(flattenModel), page: pagination.page, pageSize: pagination.pageSize, total, totalPages: Math.max(1, Math.ceil(total / pagination.pageSize)) });
  }

  const models = await prisma.cardModel.findMany({ where, include: printInclude, orderBy });
  res.json(models.map(flattenModel));
});

app.get("/api/cards/filters", async (_req, res) => {
  setPublicCache(res, 300, 900);
  const activeCards: Prisma.CardWhereInput = { isActive: true };
  const missingRelationWhere = (cardType: CardType | CardType[]): Prisma.CardModelWhereInput => ({
    isActive: true,
    cardType: Array.isArray(cardType) ? { in: cardType } : cardType,
    AND: [{ outgoingRelations: { none: { isActive: true } } }, { incomingRelations: { none: { isActive: true } } }],
  });
  // CardModel já tem 1 linha por code (por construção, ver docs/13-migracao-cardmodel.md)
  // — não precisa mais de distinct manual pra evitar contar reimpressão como pendência
  // separada, como era necessário antes da migração pra CardModel.
  const countMissingByCode = async (cardType: CardType | CardType[]) => prisma.cardModel.count({ where: missingRelationWhere(cardType) });
  const [colorsRaw, typesRaw, raritiesRaw, statusesRaw, mediaRows, traitRows, traitTaxonomies, mediaTaxonomies, sets, keywordRows, pilotsMissing, unitsMissing, commandsMissing] = await Promise.all([
    prisma.card.findMany({ where: activeCards, select: { color: true }, distinct: ["color"], orderBy: { color: "asc" } }),
    prisma.card.findMany({ where: activeCards, select: { cardType: true }, distinct: ["cardType"], orderBy: { cardType: "asc" } }),
    prisma.card.findMany({ where: { ...activeCards, rarity: { not: null } }, select: { rarity: true }, distinct: ["rarity"], orderBy: { rarity: "asc" } }),
    prisma.card.findMany({ where: { ...activeCards, legalityStatus: { not: null } }, select: { legalityStatus: true }, distinct: ["legalityStatus"], orderBy: { legalityStatus: "asc" } }),
    prisma.card.findMany({ where: activeCards, select: { sourceTitle: true, series: true } }),
    prisma.card.findMany({ where: activeCards, select: { traits: true } }),
    prisma.taxonomyEntry.findMany({ where: { isActive: true, kind: TaxonomyKind.TRAIT }, select: { name: true }, orderBy: { name: "asc" } }),
    prisma.taxonomyEntry.findMany({ where: { isActive: true, kind: TaxonomyKind.SOURCE_TITLE }, select: { name: true }, orderBy: { name: "asc" } }),
    prisma.cardSet.findMany({ where: { isActive: true }, select: { code: true, namePt: true, nameEn: true, releaseDate: true }, orderBy: { code: "asc" } }),
    prisma.card.findMany({ where: activeCards, select: { keywordTags: true } }),
    countMissingByCode(CardType.PILOT),
    countMissingByCode(CardType.UNIT),
    countMissingByCode([CardType.COMMAND, CardType.COMMAND_PILOT]),
  ]);

  const media = Array.from(new Set([...mediaTaxonomies.map((item) => item.name), ...mediaRows.flatMap((item) => [item.sourceTitle, item.series]).filter(Boolean) as string[]])).sort();
  const keywordSet = new Set<string>();
  keywordRows.forEach((row) => row.keywordTags.forEach((tag) => keywordSet.add(tag)));

  res.json({
    colors: colorsRaw.map((item) => item.color).filter(Boolean),
    cardTypes: Array.from(new Set(typesRaw.map((item) => item.cardType === CardType.COMMAND_PILOT ? CardType.COMMAND : item.cardType))).sort(),
    rarities: raritiesRaw.map((item) => item.rarity).filter(Boolean),
    statuses: statusesRaw.map((item) => item.legalityStatus).filter(Boolean),
    media,
    series: media,
    traits: Array.from(new Set([...traitTaxonomies.map((item) => item.name), ...traitRows.flatMap((item) => item.traits)])).sort(),
    keywords: Array.from(keywordSet).sort(),
    sets,
    missingRelationCounts: { PILOT: pilotsMissing, UNIT: unitsMissing, COMMAND: commandsMissing },
  });
});

app.get("/api/cards/:id", async (req, res) => {
  setPublicCache(res, 30, 120);
  const id = String(req.params.id);
  const requestedPrintId = normalizeQueryValue(req.query.print);

  let model = await prisma.cardModel.findUnique({
    where: { id },
    include: { prints: { where: { isActive: true }, include: { set: true }, orderBy: [{ isPrimaryPrint: "desc" }, { createdAt: "asc" }] }, rulings: { where: { isActive: true } } },
  });

  // Compatibilidade: se o :id passado for de uma impressão específica (ex: link salvo de
  // binder/deck, de antes desse redesenho), resolve pro CardModel dela.
  if (!model) {
    const print = await prisma.card.findUnique({ where: { id }, select: { cardModelId: true } });
    if (print?.cardModelId) {
      model = await prisma.cardModel.findUnique({
        where: { id: print.cardModelId },
        include: { prints: { where: { isActive: true }, include: { set: true }, orderBy: [{ isPrimaryPrint: "desc" }, { createdAt: "asc" }] }, rulings: { where: { isActive: true } } },
      });
    }
  }

  if (!model) return res.status(404).json({ error: "Carta não encontrada." });

  const selectedPrint = (requestedPrintId && model.prints.find((p) => p.id === requestedPrintId)) || model.prints[0];
  const { prints, ...modelFields } = model;
  res.json({ ...modelFields, ...selectedPrint, id: model.id, printId: selectedPrint?.id ?? null, prints });
});

app.post("/api/cards", authRequired, roleRequired([UserRole.ADMIN, UserRole.EDITOR]), async (req, res) => {
  const payload = req.body as CardInput;
  await upsertCards([payload], new Map<string, string>(), payload.setId || undefined);
  const card = payload.externalId
    ? await prisma.card.findUnique({ where: { externalId: payload.externalId }, include: { set: true, rulings: true } })
    : await prisma.card.findFirst({ where: { code: payload.code, setId: payload.setId || null }, include: { set: true, rulings: true }, orderBy: { updatedAt: "desc" } });
  res.status(201).json(card);
});

app.put("/api/cards/:id", authRequired, roleRequired([UserRole.ADMIN, UserRole.EDITOR]), async (req, res) => {
  const id = String(req.params.id);
  // :id pode ser um CardModel (edição feita a partir da listagem pública/admin, que lista
  // por carta) ou uma impressão específica (uso interno futuro) — detecta e trata cada uma.
  const model = await prisma.cardModel.findUnique({ where: { id } });
  if (model) {
    const body = req.body as Record<string, unknown>;
    const modelData = Object.fromEntries(MODEL_FIELDS_FROM_CARD.map((field) => [field, body[field] ?? (model as any)[field]]));
    const updated = await prisma.cardModel.update({ where: { id }, data: modelData as any });
    // Mantém a impressão primária com os mesmos campos de identidade — evita a impressão
    // "desatualizar" em relação ao modelo até a próxima sincronização.
    await prisma.card.updateMany({ where: { cardModelId: id, isPrimaryPrint: true }, data: modelData as any });
    return res.json({ ...updated, isModel: true });
  }
  const existing = await prisma.card.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "Carta não encontrada." });
  const payload = { ...req.body, code: req.body.code || existing.code, recordId: id, externalId: req.body.externalId ?? existing.externalId } as CardInput;
  await upsertCards([payload], new Map<string, string>(), payload.setId || undefined);
  const card = await prisma.card.findUnique({ where: { id }, include: { set: true, rulings: true } });
  res.json(card);
});

app.post("/api/cards/:modelId/prints", authRequired, roleRequired([UserRole.ADMIN, UserRole.EDITOR]), async (req, res) => {
  const modelId = String(req.params.modelId);
  const model = await prisma.cardModel.findUnique({ where: { id: modelId } });
  if (!model) return res.status(404).json({ error: "Carta não encontrada." });
  const body = req.body as { rarity?: string; printLabel?: string; setId?: string; imageUrl?: string; thumbUrl?: string; imageSmallUrl?: string; imageMediumUrl?: string; imageLargeUrl?: string; imageSourceUrl?: string; officialUrl?: string; isPrimaryPrint?: boolean; externalId?: string };
  const modelData = Object.fromEntries(MODEL_FIELDS_FROM_CARD.map((field) => [field, (model as any)[field]]));
  if (body.isPrimaryPrint) await prisma.card.updateMany({ where: { cardModelId: modelId }, data: { isPrimaryPrint: false } });
  const print = await prisma.card.create({
    data: {
      ...modelData,
      code: model.code,
      cardModelId: modelId,
      rarity: body.rarity || null,
      printLabel: body.printLabel || null,
      setId: body.setId || null,
      imageUrl: body.imageUrl || null,
      thumbUrl: body.thumbUrl || null,
      imageSmallUrl: body.imageSmallUrl || null,
      imageMediumUrl: body.imageMediumUrl || null,
      imageLargeUrl: body.imageLargeUrl || null,
      imageSourceUrl: body.imageSourceUrl || null,
      officialUrl: body.officialUrl || null,
      externalId: body.externalId || null,
      isPrimaryPrint: Boolean(body.isPrimaryPrint),
    } as any,
    include: { set: true },
  });
  res.status(201).json(print);
});

app.put("/api/cards/prints/:printId", authRequired, roleRequired([UserRole.ADMIN, UserRole.EDITOR]), async (req, res) => {
  const printId = String(req.params.printId);
  const existing = await prisma.card.findUnique({ where: { id: printId } });
  if (!existing) return res.status(404).json({ error: "Impressão não encontrada." });
  const body = req.body as { rarity?: string; printLabel?: string; setId?: string | null; imageUrl?: string; thumbUrl?: string; imageSmallUrl?: string; imageMediumUrl?: string; imageLargeUrl?: string; imageSourceUrl?: string; officialUrl?: string; isPrimaryPrint?: boolean; legalityStatus?: string };
  if (body.isPrimaryPrint && existing.cardModelId) {
    await prisma.card.updateMany({ where: { cardModelId: existing.cardModelId }, data: { isPrimaryPrint: false } });
  }
  const print = await prisma.card.update({
    where: { id: printId },
    data: {
      rarity: body.rarity ?? existing.rarity,
      printLabel: body.printLabel ?? existing.printLabel,
      setId: body.setId === undefined ? existing.setId : body.setId,
      imageUrl: body.imageUrl ?? existing.imageUrl,
      thumbUrl: body.thumbUrl ?? existing.thumbUrl,
      imageSmallUrl: body.imageSmallUrl ?? existing.imageSmallUrl,
      imageMediumUrl: body.imageMediumUrl ?? existing.imageMediumUrl,
      imageLargeUrl: body.imageLargeUrl ?? existing.imageLargeUrl,
      imageSourceUrl: body.imageSourceUrl ?? existing.imageSourceUrl,
      officialUrl: body.officialUrl ?? existing.officialUrl,
      legalityStatus: body.legalityStatus ?? existing.legalityStatus,
      isPrimaryPrint: body.isPrimaryPrint ?? existing.isPrimaryPrint,
    },
    include: { set: true },
  });
  res.json(print);
});

app.delete("/api/cards/prints/:printId", authRequired, roleRequired([UserRole.ADMIN]), async (req, res) => {
  const printId = String(req.params.printId);
  const existing = await prisma.card.findUnique({ where: { id: printId } });
  if (!existing) return res.status(404).json({ error: "Impressão não encontrada." });
  if (existing.cardModelId) {
    const siblingCount = await prisma.card.count({ where: { cardModelId: existing.cardModelId, isActive: true } });
    if (siblingCount <= 1) return res.status(400).json({ error: "Essa é a única impressão desta carta — exclua a carta inteira em vez de só a impressão." });
  }
  await prisma.card.update({ where: { id: printId }, data: { isActive: false, deletedAt: new Date() } });
  if (existing.isPrimaryPrint && existing.cardModelId) {
    // Precisa de uma nova impressão primária — reaproveita a mesma heurística da sincronização.
    const remaining = await prisma.card.findMany({ where: { cardModelId: existing.cardModelId, isActive: true } });
    if (remaining.length) {
      const next = pickRepresentativePrint(remaining);
      await prisma.card.update({ where: { id: next.id }, data: { isPrimaryPrint: true } });
    }
  }
  res.status(204).send();
});

app.delete("/api/cards/:id", authRequired, roleRequired([UserRole.ADMIN]), async (req, res) => {
  const id = String(req.params.id);
  const model = await prisma.cardModel.findUnique({ where: { id } });
  if (model) {
    await prisma.cardModel.update({ where: { id }, data: { isActive: false, deletedAt: new Date() } });
    await prisma.card.updateMany({ where: { cardModelId: id }, data: { isActive: false, deletedAt: new Date() } });
    return res.status(204).send();
  }
  await prisma.card.update({ where: { id }, data: { isActive: false, deletedAt: new Date() } });
  res.status(204).send();
});

app.post("/api/cards/upload-image", authRequired, roleRequired([UserRole.ADMIN, UserRole.EDITOR]), upload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Arquivo não enviado." });
    const saved = await saveUploadedCardImage(req.file, {
      cardCode: req.body?.cardCode ? String(req.body.cardCode) : undefined,
      artId: req.body?.artId ? String(req.body.artId) : undefined,
      label: req.body?.label ? String(req.body.label) : undefined,
    });
    res.status(201).json({
      imageUrl: saved.imageUrl,
      publicUrl: saved.publicUrl,
      imageSourceUrl: saved.storageDriver === "local" ? "local_upload" : "supabase_storage",
      storageDriver: saved.storageDriver,
      storageBucket: saved.storageBucket,
      storageKey: saved.storageKey,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
    });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || "Erro ao armazenar imagem." });
  }
});

app.post("/api/uploads/image", authRequired, roleRequired([UserRole.ADMIN, UserRole.EDITOR]), upload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Arquivo não enviado." });
    const entityRaw = String(req.body?.entity || "cards");
    const entity = ["cards", "collections", "media", "decks"].includes(entityRaw) ? entityRaw as "cards" | "collections" | "media" | "decks" : "cards";
    const saved = await saveUploadedCardImage(req.file, {
      entity,
      cardCode: req.body?.referenceCode ? String(req.body.referenceCode) : undefined,
      artId: req.body?.assetId ? String(req.body.assetId) : undefined,
      label: req.body?.label ? String(req.body.label) : undefined,
    });
    res.status(201).json({ imageUrl: saved.imageUrl, publicUrl: saved.publicUrl, imageSourceUrl: saved.storageDriver === "local" ? "local_upload" : "supabase_storage", storageDriver: saved.storageDriver, storageBucket: saved.storageBucket, storageKey: saved.storageKey, originalName: req.file.originalname, mimeType: req.file.mimetype, size: req.file.size });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || "Erro ao armazenar imagem." });
  }
});

app.post("/api/import/cards", authRequired, roleRequired([UserRole.ADMIN]), async (req, res) => {
  const payload = req.body as { cards?: CardInput[]; set?: SetInput };
  if (!payload.cards?.length) return res.status(400).json({ error: "Nenhuma carta enviada para importar." });

  let setId: string | undefined;
  let setMap = new Map<string, string>();
  if (payload.set) {
    setMap = await upsertSets([payload.set]);
    setId = setMap.get(payload.set.code);
  }

  await upsertCards(payload.cards, setMap, setId);
  res.json({ imported: payload.cards.length, setId: setId ?? null });
});

app.post("/api/import/rulings", authRequired, roleRequired([UserRole.ADMIN]), async (req, res) => {
  const payload = req.body as { rulings?: RulingImportInput[] };
  if (!payload.rulings?.length) return res.status(400).json({ error: "Nenhuma ruling enviada para importar." });
  await upsertRulings(payload.rulings);
  res.json({ imported: payload.rulings.length });
});

app.post("/api/import/catalog", authRequired, roleRequired([UserRole.ADMIN]), async (req, res) => {
  const payload = req.body as {
    clearExisting?: boolean;
    sets?: SetInput[];
    cards?: CardInput[];
    rulings?: RulingImportInput[];
    tournaments?: TournamentImportInput[];
    images?: ImageManifestInput[];
  };

  if (payload.clearExisting) {
    await prisma.$transaction([
      prisma.tournamentEntry.deleteMany(),
      prisma.deckItem.deleteMany(),
      prisma.deck.deleteMany(),
      prisma.cardBinderItem.deleteMany(),
      prisma.cardBinder.deleteMany(),
      prisma.ruling.deleteMany(),
      prisma.card.deleteMany(),
      prisma.cardSet.deleteMany(),
      prisma.tournament.deleteMany(),
    ]);
  }

  const setMap = payload.sets?.length ? await upsertSets(payload.sets) : new Map<string, string>();
  if (payload.cards?.length) await upsertCards(payload.cards, setMap);
  if (payload.rulings?.length) await upsertRulings(payload.rulings);
  if (payload.tournaments?.length) await upsertTournaments(payload.tournaments);
  if (payload.images?.length) await applyImageManifest(payload.images);

  res.json({
    imported: {
      sets: payload.sets?.length ?? 0,
      cards: payload.cards?.length ?? 0,
      rulings: payload.rulings?.length ?? 0,
      tournaments: payload.tournaments?.length ?? 0,
      images: payload.images?.length ?? 0,
    },
    clearedExisting: Boolean(payload.clearExisting),
  });
});

app.post("/api/import/images-manifest", authRequired, roleRequired([UserRole.ADMIN]), async (req, res) => {
  const payload = req.body as { items?: ImageManifestInput[] };
  if (!payload.items?.length) return res.status(400).json({ error: "Nenhuma imagem enviada para aplicar." });
  await applyImageManifest(payload.items);
  res.json({ imported: payload.items.length });
});

app.get("/api/rulings", async (req, res) => {
  setPublicCache(res, 20, 90);
  const q = normalizeQueryValue(req.query.q);
  const sourceType = normalizeQueryValue(req.query.sourceType);
  const relatedKeyword = normalizeQueryValue(req.query.relatedKeyword);
  const sort = normalizeQueryValue(req.query.sort) || "updated_desc";

  const rulings = await prisma.ruling.findMany({
    where: {
      AND: [
        { isActive: true },
        q
          ? {
              OR: [
                { title: { contains: q, mode: "insensitive" } },
                { questionPt: { contains: q, mode: "insensitive" } },
                { answerPt: { contains: q, mode: "insensitive" } },
                { questionEn: { contains: q, mode: "insensitive" } },
                { answerEn: { contains: q, mode: "insensitive" } },
              ],
            }
          : {},
        sourceType ? { sourceType: { equals: sourceType as any } } : {},
        relatedKeyword ? { relatedKeyword: { contains: relatedKeyword, mode: "insensitive" } } : {},
      ],
    },
    include: { card: true },
    orderBy: sort === "title_asc" ? [{ title: "asc" }] : [{ updatedAt: "desc" }],
  });
  res.json(rulings);
});

app.get("/api/rulings/filters", async (_req, res) => {
  setPublicCache(res, 60, 300);
  const [sourceRows, keywordRows] = await Promise.all([
    prisma.ruling.findMany({ select: { sourceType: true }, distinct: ["sourceType"], orderBy: { sourceType: "asc" } }),
    prisma.ruling.findMany({ select: { relatedKeyword: true }, distinct: ["relatedKeyword"], where: { relatedKeyword: { not: null } }, orderBy: { relatedKeyword: "asc" } }),
  ]);
  res.json({ sourceTypes: sourceRows.map((item) => item.sourceType), relatedKeywords: keywordRows.map((item) => item.relatedKeyword).filter(Boolean) });
});

app.get("/api/rulings/:id", async (req, res) => {
  setPublicCache(res, 30, 120);
  const id = String(req.params.id);
  const ruling = await prisma.ruling.findUnique({ where: { id }, include: { card: { include: { set: true } } } });
  if (!ruling) return res.status(404).json({ error: "Ruling não encontrada." });
  res.json(ruling);
});

app.post("/api/rulings", authRequired, roleRequired([UserRole.ADMIN, UserRole.EDITOR]), async (req, res) => {
  const ruling = await prisma.ruling.create({ data: req.body });
  res.status(201).json(ruling);
});

app.put("/api/rulings/:id", authRequired, roleRequired([UserRole.ADMIN, UserRole.EDITOR]), async (req, res) => {
  const id = String(req.params.id);
  const ruling = await prisma.ruling.update({ where: { id }, data: req.body });
  res.json(ruling);
});

app.delete("/api/rulings/:id", authRequired, roleRequired([UserRole.ADMIN]), async (req, res) => {
  const id = String(req.params.id);
  await prisma.ruling.update({ where: { id }, data: { isActive: false, deletedAt: new Date() } });
  res.status(204).send();
});

app.get("/api/tournaments", async (_req, res) => {
  setPublicCache(res, 20, 90);
  const events = await prisma.tournament.findMany({ where: { isActive: true }, include: { entries: true }, orderBy: [{ dateStart: "desc" }] });
  res.json(events);
});

app.get("/api/tournaments/:id", async (req, res) => {
  setPublicCache(res, 20, 90);
  const id = String(req.params.id);
  const event = await prisma.tournament.findUnique({ where: { id }, include: { entries: true } });
  if (!event) return res.status(404).json({ error: "Evento não encontrado." });
  res.json(event);
});

app.post("/api/tournaments", authRequired, roleRequired([UserRole.ADMIN, UserRole.EDITOR]), async (req, res) => {
  const event = await prisma.tournament.create({ data: req.body });
  res.status(201).json(event);
});

app.put("/api/tournaments/:id", authRequired, roleRequired([UserRole.ADMIN, UserRole.EDITOR]), async (req, res) => {
  const id = String(req.params.id);
  const event = await prisma.tournament.update({ where: { id }, data: req.body });
  res.json(event);
});

app.delete("/api/tournaments/:id", authRequired, roleRequired([UserRole.ADMIN]), async (req, res) => {
  const id = String(req.params.id);
  await prisma.tournament.update({ where: { id }, data: { isActive: false, deletedAt: new Date() } });
  res.status(204).send();
});

app.get("/api/decks/public", async (req, res) => {
  setPublicCache(res, 15, 60);
  const pagination = getPagination(req.query, { pageSize: 12, maxPageSize: 50 });
  const where = { visibility: "PUBLIC" as const };

  if (pagination.enabled) {
    const [items, total] = await Promise.all([
      prisma.deck.findMany({
        where,
        include: { user: true, items: { include: { card: true } } },
        orderBy: { updatedAt: "desc" },
        skip: pagination.skip,
        take: pagination.take,
      }),
      prisma.deck.count({ where }),
    ]);
    return res.json({ items, page: pagination.page, pageSize: pagination.pageSize, total, totalPages: Math.max(1, Math.ceil(total / pagination.pageSize)) });
  }

  const decks = await prisma.deck.findMany({
    where,
    include: { user: true, items: { include: { card: true } } },
    orderBy: { updatedAt: "desc" },
  });
  res.json(decks);
});

app.get("/api/decks/share/:shareId", async (req, res) => {
  setPublicCache(res, 20, 90);
  const shareId = String(req.params.shareId);
  const deck = await prisma.deck.findUnique({
    where: { shareId },
    include: { user: true, items: { include: { card: true } } },
  });
  if (!deck || deck.visibility === "PRIVATE") return res.status(404).json({ error: "Deck não encontrado." });
  res.json(deck);
});

app.get("/api/decks/me", authRequired, async (req: RequestWithUser, res) => {
  setPrivateCache(res, 10, 30);
  const pagination = getPagination(req.query, { pageSize: 12, maxPageSize: 50 });
  const where = { userId: req.user!.userId };

  if (pagination.enabled) {
    const [items, total] = await Promise.all([
      prisma.deck.findMany({
        where,
        include: { items: true },
        orderBy: [{ updatedAt: "desc" }],
        skip: pagination.skip,
        take: pagination.take,
      }),
      prisma.deck.count({ where }),
    ]);
    return res.json({ items, page: pagination.page, pageSize: pagination.pageSize, total, totalPages: Math.max(1, Math.ceil(total / pagination.pageSize)) });
  }

  const decks = await prisma.deck.findMany({
    where,
    include: { items: true },
    orderBy: [{ updatedAt: "desc" }],
  });
  res.json(decks);
});

app.post("/api/decks/me", authRequired, async (req: RequestWithUser, res) => {
  const { name, format, visibility, notes, coverImage, featuredCardIds, isPrimary, items } = req.body as {
    name: string;
    format: string;
    visibility: "PRIVATE" | "UNLISTED" | "PUBLIC";
    notes?: string;
    coverImage?: string | null;
    featuredCardIds?: string[];
    isPrimary?: boolean;
    items: Array<{ cardId: string; quantity: number; section?: string }>;
  };

  if (isPrimary) await prisma.deck.updateMany({ where: { userId: req.user!.userId }, data: { isPrimary: false } });
  const deck = await prisma.deck.create({
    data: {
      userId: req.user!.userId,
      name,
      format,
      visibility,
      notes,
      coverImage: coverImage || null,
      featuredCardIds: Array.isArray(featuredCardIds) ? featuredCardIds.filter(Boolean).slice(0, 2) : [],
      isPrimary: Boolean(isPrimary),
      items: { create: items.map((item) => ({ cardId: item.cardId, quantity: item.quantity, section: item.section ?? "main" })) },
    },
    include: { items: true },
  });
  res.status(201).json(deck);
});

app.put("/api/decks/me/:id", authRequired, async (req: RequestWithUser, res) => {
  const deckId = String(req.params.id);
  const { name, format, visibility, notes, coverImage, featuredCardIds, isPrimary, items } = req.body as {
    name: string;
    format: string;
    visibility: "PRIVATE" | "UNLISTED" | "PUBLIC";
    notes?: string;
    coverImage?: string | null;
    featuredCardIds?: string[];
    isPrimary?: boolean;
    items: Array<{ cardId: string; quantity: number; section?: string }>;
  };
  const existing = await prisma.deck.findFirst({ where: { id: deckId, userId: req.user!.userId } });
  if (!existing) return res.status(404).json({ error: "Deck não encontrado." });
  if (isPrimary) await prisma.deck.updateMany({ where: { userId: req.user!.userId }, data: { isPrimary: false } });
  await prisma.deckItem.deleteMany({ where: { deckId } });
  const deck = await prisma.deck.update({
    where: { id: deckId },
    data: {
      name,
      format,
      visibility,
      notes,
      coverImage: coverImage || null,
      featuredCardIds: Array.isArray(featuredCardIds) ? featuredCardIds.filter(Boolean).slice(0, 2) : [],
      isPrimary: Boolean(isPrimary),
      items: { create: items.map((item) => ({ cardId: item.cardId, quantity: item.quantity, section: item.section ?? "main" })) },
    },
    include: { items: true },
  });
  res.json(deck);
});

app.delete("/api/decks/me/:id", authRequired, async (req: RequestWithUser, res) => {
  const deckId = String(req.params.id);
  const existing = await prisma.deck.findFirst({ where: { id: deckId, userId: req.user!.userId } });
  if (!existing) return res.status(404).json({ error: "Deck não encontrado." });
  await prisma.deck.delete({ where: { id: deckId } });
  res.status(204).send();
});

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(error);
  res.status(500).json({ error: "Erro interno da API." });
});

ensureAdminSeed()
  .then(async () => {
    app.listen(PORT, () => {
      console.log(`API pronta em http://localhost:${PORT}`);
    });
  })
  .catch(async (error: any) => {
    if (error?.code === "P2022" || error?.code === "P2021") {
      console.error("Falha ao iniciar API: o schema do banco está defasado em relação ao prisma/schema.prisma.");
      console.error("Use `pnpm dev:api` para sincronizar automaticamente ou rode `pnpm prisma:push` antes do modo raw.");
    }
    console.error("Falha ao iniciar API", error);
    await prisma.$disconnect();
    process.exit(1);
  });
