import "dotenv/config";

import bcrypt from "bcryptjs";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import jwt from "jsonwebtoken";
import multer from "multer";
import { PrismaClient, UserRole, Prisma, CardLanguage, CardType, SetKind, TaxonomyKind, CardRelationType, HostedEventStatus, HostedEventRoundStatus, HostedEventMatchResult } from "@prisma/client";
import { OAuth2Client } from "google-auth-library";
import { parseCardEffects } from "../src/lib/gundam-card-effects.ts";
import { DECK_MAIN_SIZE, DECK_RESOURCE_SIZE, DECK_MAX_COLORS, DECK_MAX_COPIES_DEFAULT, NON_STATS_SECTIONS, NON_STATS_CARD_TYPES, computeDeckLegality, type DeckLegalityData } from "../src/lib/deck-legality.ts";
import { buildSt01DeckList } from "../src/modules/simulator/fixtures/st01Deck.ts";
import { buildSt02DeckList } from "../src/modules/simulator/fixtures/st02Deck.ts";
import type { DeckList } from "../src/modules/simulator/engine/setup.ts";
import type { PlayerAction } from "../src/modules/simulator/engine/actions.ts";
import type { PlayerId } from "../src/modules/simulator/engine/types.ts";
import {
  applyAction,
  claimAbandonWin,
  createMatch,
  getMatch,
  joinMatch,
  joinQueue,
  leaveQueue,
  listMatches,
  matchViewFor,
  MatchError,
  queueStatusFor,
  reportSituation,
  resignMatch,
  seatFor,
  setAutoPass,
  subscribe,
  touchPresence,
} from "../src/modules/simulator/server/matchStore.ts";

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

// Sem ALLOWED_ORIGINS configurado (ambiente local), fica aberto — igual sempre foi.
// Em produção, define a lista (separada por vírgula) com o domínio real do front-end,
// senão o navegador bloqueia as chamadas antes mesmo de chegar aqui.
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "").split(",").map((origin) => origin.trim()).filter(Boolean);
app.use(cors(allowedOrigins.length ? { origin: allowedOrigins } : undefined));
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
  isHoster: boolean;
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
  seasonId?: string | null;
};

type SeasonInput = {
  code: string;
  name: string;
  startDate?: string | Date | null;
  endDate?: string | Date | null;
  notes?: string | null;
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

/** Como authRequired, mas não bloqueia se não tiver token — só preenche req.user
 *  quando o token existe e é válido. Usado em rotas públicas onde o dono logado
 *  deve enxergar mais do que um visitante anônimo (ex: pasta privada só pro dono). */
function authOptional(req: RequestWithUser, _res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    try { req.user = jwt.verify(auth.slice(7), JWT_SECRET) as AuthPayload; } catch { /* token invalido, segue como anonimo */ }
  }
  next();
}

/**
 * Como authRequired, mas aceita o token via query string (`?token=`) além do
 * header `Authorization`. Só existe pro endpoint de SSE do simulador
 * (`/api/simulator/matches/:id/stream`, docs/18 passo 4) — a API nativa
 * `EventSource` do navegador não deixa mandar headers customizados, então
 * não tem como usar `Authorization: Bearer` nela. Todas as outras rotas
 * continuam exigindo o header normal; isso é uma exceção pontual, não uma
 * segunda forma "oficial" de autenticar.
 */
function authFromQueryOrHeader(req: RequestWithUser, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const queryToken = typeof req.query.token === "string" ? req.query.token : undefined;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : queryToken;
  if (!token) return res.status(401).json({ error: "Token ausente." });
  try {
    req.user = jwt.verify(token, JWT_SECRET) as AuthPayload;
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

/** Libera pra quem tem a flag isHoster (concedida pelo admin) ou é ADMIN direto --
 *  diferente de roleRequired porque isHoster não é um degrau de UserRole, é uma
 *  capacidade extra concedida por fora (um EDITOR ou USER comum pode virar Hoster
 *  sem mudar de role). Ownership de um evento específico (só o próprio hoster ou um
 *  ADMIN pode editar/apagar) é checado à parte, dentro de cada rota. */
function hosterRequired(req: RequestWithUser, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: "Não autenticado." });
  if (!req.user.isHoster && req.user.role !== UserRole.ADMIN) return res.status(403).json({ error: "Sem permissão de organizador." });
  next();
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

function buildStorageObjectKey(file: Express.Multer.File, input?: { entity?: "cards" | "collections" | "media" | "decks" | "avatars"; cardCode?: string; artId?: string; label?: string }) {
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

async function saveUploadedCardImage(file: Express.Multer.File, input?: { entity?: "cards" | "collections" | "media" | "decks" | "avatars"; cardCode?: string; artId?: string; label?: string }) {
  if (!file.buffer?.length) throw new Error("Arquivo de imagem vazio.");
  const objectKey = buildStorageObjectKey(file, input);
  if (STORAGE_DRIVER === "supabase") return saveImageToSupabase(file, objectKey);
  if (STORAGE_DRIVER !== "local") throw new Error(`STORAGE_DRIVER inválido: ${STORAGE_DRIVER}. Use local ou supabase.`);
  return saveImageLocally(file, objectKey);
}

function normalizeQueryValue(input: unknown) {
  return String(input ?? "").trim();
}

// Pra filtro que aceita mais de 1 valor combinado (ex: cor Azul + Roxa, ou trait OZ +
// G Team) -- aceita separado por virgula na querystring (?color=Blue,Purple) ou
// repetido (?color=Blue&color=Purple, que o Express ja entrega como array e
// normalizeQueryValue junta com virgula via String() de array).
function normalizeMultiQueryValue(input: unknown): string[] {
  const raw = normalizeQueryValue(input);
  if (!raw) return [];
  return raw.split(",").map((v) => v.trim()).filter(Boolean);
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
        seasonId: set.seasonId || null,
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
        seasonId: set.seasonId || null,
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

function serializeUser(user: any, stats?: { deckCount: number; publicDeckCount: number; binderCount?: number }) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    username: user.username,
    role: user.role,
    bio: user.bio,
    avatarUrl: user.avatarUrl,
    isActive: user.isActive,
    isHoster: user.isHoster,
    preferredCardLanguage: user.preferredCardLanguage,
    preferredTheme: user.preferredTheme,
    hasPassword: Boolean(user.passwordHash),
    stats,
  };
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
  // Bootstrap de conveniência: só cria a conta admin padrão se o banco ainda não tiver
  // NENHUM admin (instalação nova). Uma vez que existe um admin real, esta função não
  // mexe mais em nada — nem cria, nem atualiza senha de ninguém. Isso evita duas falhas
  // que já aconteceram em produção: (1) colisão de unique constraint em `username` contra
  // uma conta admin real já existente (derrubava a API inteira, já que o `app.listen()`
  // só roda depois desta função resolver), e (2) reset silencioso da senha do admin real
  // pra "admin123" (ou o valor de SEED_ADMIN_PASSWORD) a cada reinício do processo.
  const existingAdminCount = await prisma.user.count({ where: { role: UserRole.ADMIN } });
  if (existingAdminCount > 0) return;

  const email = process.env.SEED_ADMIN_EMAIL ?? "admin@gundambr.local";
  const password = process.env.SEED_ADMIN_PASSWORD ?? "admin123";
  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: {
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
}

/** Proxy de imagem — só existe pra dar suporte a exportações client-side que usam
 *  canvas (ex: imagem PNG da decklist), já que canvas.toBlob() exige que a imagem
 *  seja "same-origin" ou tenha CORS liberado, e o CDN de onde vêm as imagens de carta
 *  (tcgplayer-cdn.tcgplayer.com) não libera isso pra uso via canvas em outro domínio.
 *  Lista de permissão restrita de propósito — não é um proxy aberto pra qualquer URL. */
const IMAGE_PROXY_ALLOWED_HOSTS = ["tcgplayer-cdn.tcgplayer.com"];
if (process.env.SUPABASE_URL) {
  try { IMAGE_PROXY_ALLOWED_HOSTS.push(new URL(process.env.SUPABASE_URL).host); } catch { /* URL inválida no .env, ignora */ }
}

app.get("/api/image-proxy", async (req, res) => {
  const rawUrl = String(req.query.url || "");
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return res.status(400).json({ error: "URL inválida." });
  }
  if (parsed.protocol !== "https:" || !IMAGE_PROXY_ALLOWED_HOSTS.includes(parsed.host)) {
    return res.status(403).json({ error: "Domínio não permitido no proxy de imagem." });
  }
  try {
    const upstream = await fetch(parsed.toString());
    if (!upstream.ok || !upstream.body) return res.status(upstream.status).json({ error: "Não consegui buscar a imagem de origem." });
    res.setHeader("Content-Type", upstream.headers.get("content-type") || "image/jpeg");
    setPublicCache(res, 3600, 86400); // imagem de carta é estável, cacheia agressivo
    const reader = upstream.body.getReader();
    const pump = async (): Promise<void> => {
      const { done, value } = await reader.read();
      if (done) { res.end(); return; }
      res.write(value);
      return pump();
    };
    await pump();
  } catch {
    res.status(502).json({ error: "Erro ao buscar a imagem de origem." });
  }
});

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
  const token = signToken({ userId: user.id, role: user.role, email: user.email, username: user.username, isHoster: user.isHoster });
  res.status(201).json({ token, user: serializeUser(user) });
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const normalizedPassword = String(password || "");
  if (!normalizedEmail || !normalizedPassword) return res.status(400).json({ error: "Email e senha são obrigatórios." });
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!user || !user.isActive) return res.status(401).json({ error: "Credenciais inválidas ou usuário inativo." });
  if (!user.passwordHash) return res.status(401).json({ error: "Essa conta usa login com Google — entre pelo botão \"Continuar com Google\"." });
  if (!(await bcrypt.compare(normalizedPassword, user.passwordHash))) return res.status(401).json({ error: "Credenciais inválidas ou usuário inativo." });
  const token = signToken({ userId: user.id, role: user.role, email: user.email, username: user.username, isHoster: user.isHoster });
  res.json({ token, user: serializeUser(user) });
});

/** Login/cadastro com Google — verifica o ID token emitido pelo Google Identity
 *  Services no front-end (não confia em nada que o cliente mande além do token
 *  assinado). Se já existe conta com esse e-mail (cadastrada por senha), vincula o
 *  googleId a ela em vez de criar duplicata — assim o jogador pode entrar pelos dois
 *  caminhos na mesma conta depois. Login com senha continua existindo exatamente
 *  igual, isso aqui é só um caminho adicional. */
app.post("/api/auth/google", async (req, res) => {
  const { credential } = req.body as { credential?: string };
  if (!credential) return res.status(400).json({ error: "Token do Google ausente." });
  if (!process.env.GOOGLE_CLIENT_ID) return res.status(503).json({ error: "Login com Google não configurado neste ambiente." });

  let payload: { sub: string; email?: string; email_verified?: boolean; name?: string; picture?: string } | undefined;
  try {
    const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: process.env.GOOGLE_CLIENT_ID });
    payload = ticket.getPayload() as typeof payload;
  } catch {
    return res.status(401).json({ error: "Token do Google inválido ou expirado." });
  }
  if (!payload || !payload.email || !payload.email_verified) return res.status(401).json({ error: "Não foi possível confirmar o e-mail do Google." });

  const normalizedEmail = payload.email.trim().toLowerCase();
  let user = await prisma.user.findUnique({ where: { googleId: payload.sub } });

  if (!user) {
    const existingByEmail = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existingByEmail) {
      // Já tinha conta por senha com esse e-mail — vincula o Google a ela em vez de duplicar.
      user = await prisma.user.update({ where: { id: existingByEmail.id }, data: { googleId: payload.sub, avatarUrl: existingByEmail.avatarUrl || payload.picture || null } });
    } else {
      const displayName = payload.name || normalizedEmail.split("@")[0];
      const usernameBase = slugify(displayName);
      let username = usernameBase;
      let suffix = 1;
      while (await prisma.user.findUnique({ where: { username } })) username = `${usernameBase}-${suffix++}`;
      user = await prisma.user.create({
        data: {
          email: normalizedEmail,
          displayName,
          username,
          googleId: payload.sub,
          avatarUrl: payload.picture || null,
          role: UserRole.USER,
          isActive: true,
          preferredCardLanguage: CardLanguage.PT_BR,
          preferredTheme: "dark",
        },
      });
    }
  }

  if (!user.isActive) return res.status(401).json({ error: "Usuário inativo." });
  const token = signToken({ userId: user.id, role: user.role, email: user.email, username: user.username, isHoster: user.isHoster });
  res.json({ token, user: serializeUser(user) });
});

app.get("/api/auth/me", authRequired, async (req: RequestWithUser, res) => {
  const user = await requireActiveUser(req, res);
  if (!user) return;
  const [deckCount, publicDeckCount, binderCount] = await Promise.all([
    prisma.deck.count({ where: { userId: user.id } }),
    prisma.deck.count({ where: { userId: user.id, visibility: "PUBLIC" } }),
    prisma.cardBinder.count({ where: { userId: user.id } }),
  ]);
  res.json(serializeUser(user, { deckCount, publicDeckCount, binderCount }));
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
  if (!newPassword || newPassword.length < 8) return res.status(400).json({ error: "A nova senha precisa ter pelo menos 8 caracteres." });
  if (current.passwordHash) {
    // Conta com senha de verdade -- exige confirmar a atual antes de trocar.
    if (!currentPassword) return res.status(400).json({ error: "Informe a senha atual." });
    if (!(await bcrypt.compare(currentPassword, current.passwordHash))) return res.status(401).json({ error: "Senha atual inválida." });
  }
  // Conta so-com-Google (passwordHash nulo) -- nao tem senha atual pra conferir, deixa
  // definir uma agora (isso NAO desativa o login por Google, so adiciona um segundo
  // caminho de acesso pra essa conta).
  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: current.id }, data: { passwordHash } });
  res.json({ ok: true });
});

// Upload de avatar -- aberto a qualquer usuario autenticado (diferente do upload
// generico de imagem de carta, que exige ADMIN/EDITOR). Ja atualiza avatarUrl direto
// no registro do usuario, nao precisa de um PUT separado depois.
app.post("/api/auth/me/avatar", authRequired, upload.single("image"), async (req: RequestWithUser, res) => {
  const current = await requireActiveUser(req, res);
  if (!current) return;
  try {
    if (!req.file) return res.status(400).json({ error: "Arquivo não enviado." });
    const saved = await saveUploadedCardImage(req.file, { entity: "avatars", label: current.id });
    const user = await prisma.user.update({ where: { id: current.id }, data: { avatarUrl: saved.publicUrl } });
    res.status(201).json(serializeUser(user));
  } catch (err: any) {
    res.status(400).json({ error: err?.message || "Erro ao enviar avatar." });
  }
});

app.get("/api/users/admin", authRequired, roleRequired([UserRole.ADMIN]), async (_req, res) => {
  setPrivateCache(res, 5, 20);
  const users = await prisma.user.findMany({ orderBy: [{ createdAt: "desc" }], include: { _count: { select: { decks: true, binders: true } } } });
  res.json(users);
});

app.put("/api/users/admin/:id", authRequired, roleRequired([UserRole.ADMIN]), async (req, res) => {
  const id = String(req.params.id);
  const payload = req.body as { displayName?: string; role?: UserRole; isActive?: boolean; bio?: string; isHoster?: boolean };
  const user = await prisma.user.update({
    where: { id },
    data: {
      displayName: payload.displayName,
      role: payload.role,
      isActive: payload.isActive,
      bio: payload.bio,
      isHoster: payload.isHoster,
    },
  });
  res.json(serializeUser(user));
});

// Fase B: busca mínima de usuários pra o Hoster adicionar participantes num evento --
// antes só existia o perfil público por username exato (/api/users/:username), sem
// forma de listar/procurar contas. Restrito a Hoster/ADMIN (mesmo público que já
// enxerga userId em formulários de vínculo), retorna só os campos essenciais.
app.get("/api/users/search", authRequired, hosterRequired, async (req: RequestWithUser, res) => {
  const q = String(req.query.q || "").trim();
  if (q.length < 2) return res.json([]);
  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      OR: [
        { username: { contains: q, mode: "insensitive" } },
        { displayName: { contains: q, mode: "insensitive" } },
      ],
    },
    select: { id: true, username: true, displayName: true, avatarUrl: true },
    orderBy: [{ username: "asc" }],
    take: 10,
  });
  res.json(users);
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
      orderBy: [{ createdAt: "asc" }],
    }),
  ]);
  res.json({ id: user.id, username: user.username, displayName: user.displayName, bio: user.bio, avatarUrl: user.avatarUrl, decks, binders });
});

app.get("/api/binders/me", authRequired, async (req: RequestWithUser, res) => {
  const current = await requireActiveUser(req, res);
  if (!current) return;
  const binders = await prisma.cardBinder.findMany({
    where: { userId: current.id },
    include: { items: { include: { card: { include: { set: true } } }, orderBy: { position: "asc" } }, _count: { select: { items: true } } },
    orderBy: [{ createdAt: "asc" }],
  });
  res.json(binders);
});

app.get("/api/binders/me/:id", authRequired, async (req: RequestWithUser, res) => {
  const current = await requireActiveUser(req, res);
  if (!current) return;
  const binder = await prisma.cardBinder.findFirst({
    where: { id: String(req.params.id), userId: current.id },
    include: { items: { include: { card: { include: { set: true } } }, orderBy: { position: "asc" } } },
  });
  if (!binder) return res.status(404).json({ error: "Binder não encontrado." });
  res.json(binder);
});

app.post("/api/binders/me", authRequired, async (req: RequestWithUser, res) => {
  const current = await requireActiveUser(req, res);
  if (!current) return;
  const payload = req.body as { name?: string; description?: string; isPublic?: boolean };
  const binder = await prisma.cardBinder.create({
    data: {
      userId: current.id,
      name: payload.name?.trim() || "Novo binder",
      description: payload.description,
      isPublic: payload.isPublic ?? true,
    },
    include: { items: true },
  });
  res.status(201).json(binder);
});

app.put("/api/binders/me/:id", authRequired, async (req: RequestWithUser, res) => {
  const current = await requireActiveUser(req, res);
  if (!current) return;
  const binderId = String(req.params.id);
  const existing = await prisma.cardBinder.findFirst({ where: { id: binderId, userId: current.id } });
  if (!existing) return res.status(404).json({ error: "Binder não encontrado." });

  const payload = req.body as { name?: string; description?: string; isPublic?: boolean; items?: Array<{ cardId: string; quantity: number; note?: string | null; position?: number }> };
  await prisma.cardBinder.update({
    where: { id: binderId },
    data: { name: payload.name, description: payload.description, isPublic: payload.isPublic },
  });
  if (payload.items) {
    await prisma.cardBinderItem.deleteMany({ where: { binderId } });
    if (payload.items.length) {
      await prisma.cardBinderItem.createMany({
        data: payload.items.map((item, index) => ({ binderId, cardId: item.cardId, quantity: item.quantity, note: item.note || null, position: item.position ?? index })),
      });
    }
  }
  const full = await prisma.cardBinder.findUnique({ where: { id: binderId }, include: { items: { include: { card: { include: { set: true } } }, orderBy: { position: "asc" } } } });
  res.json(full);
});

app.delete("/api/binders/me/:id", authRequired, async (req: RequestWithUser, res) => {
  const current = await requireActiveUser(req, res);
  if (!current) return;
  const binderId = String(req.params.id);
  const existing = await prisma.cardBinder.findFirst({ where: { id: binderId, userId: current.id } });
  if (!existing) return res.status(404).json({ error: "Binder não encontrado." });
  await prisma.cardBinder.delete({ where: { id: binderId } });
  res.status(204).send();
});

app.get("/api/binders/share/:shareId", authOptional, async (req: RequestWithUser, res) => {
  const binder = await prisma.cardBinder.findUnique({
    where: { shareId: String(req.params.shareId) },
    include: { user: true, items: { include: { card: { include: { set: true } } }, orderBy: { position: "asc" } } },
  });
  const isOwner = Boolean(req.user && binder && req.user.userId === binder.userId);
  if (!binder || !binder.user.isActive || (!binder.isPublic && !isOwner)) return res.status(404).json({ error: "Pasta não encontrada." });
  if (!isOwner) setPublicCache(res, 20, 60); // dono pode ver versão privada sempre fresca, sem cache
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

// Listagem de gestão do admin -- ao contrário de GET /api/sets (só ativos, uso público),
// essa traz TUDO (incluindo ocultados), pra permitir localizar e reativar uma coleção
// que foi ocultada por engano. Precisa vir antes de /api/sets/:code, senão "admin" seria
// interpretado como um código de coleção.
app.get("/api/sets/admin", authRequired, roleRequired([UserRole.ADMIN, UserRole.EDITOR]), async (_req, res) => {
  setPrivateCache(res, 5, 20);
  const sets = await prisma.cardSet.findMany({ include: { _count: { select: { cards: true } } }, orderBy: [{ isActive: "desc" }, { code: "asc" }] });
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
  // Faz merge com o registro existente campo a campo (em vez de só espalhar req.body por
  // cima) -- upsertSets escreve TODOS os campos incondicionalmente, então um PUT parcial
  // (ex: só { isActive: true } pra reativar uma coleção ocultada) sem esse merge apagaria
  // o resto dos dados. Sempre reativa (isActive: true já é fixo dentro de upsertSets),
  // então isso também serve como o botão "Reativar" do admin.
  const body = req.body as Partial<SetInput>;
  const payload: SetInput = {
    code: body.code || existing.code,
    nameEn: body.nameEn ?? existing.nameEn,
    namePt: body.namePt ?? existing.namePt ?? undefined,
    officialUrl: body.officialUrl ?? existing.officialUrl,
    releaseDate: body.releaseDate ?? existing.releaseDate,
    coverImage: body.coverImage ?? existing.coverImage,
    shortDescription: body.shortDescription ?? existing.shortDescription,
    setType: body.setType ?? existing.setType,
    productCodeAlt: body.productCodeAlt ?? existing.productCodeAlt,
    msrpUsd: body.msrpUsd ?? existing.msrpUsd,
    contentSummaryEn: body.contentSummaryEn ?? existing.contentSummaryEn,
    contentSummaryPt: body.contentSummaryPt ?? existing.contentSummaryPt,
    raritySummary: body.raritySummary ?? existing.raritySummary,
    productNotes: body.productNotes ?? existing.productNotes,
    sourceTitles: body.sourceTitles ?? existing.sourceTitles,
    starterDeckVariantOf: body.starterDeckVariantOf ?? existing.starterDeckVariantOf,
    metadataJson: body.metadataJson ?? existing.metadataJson,
    seasonId: body.seasonId === undefined ? existing.seasonId : body.seasonId,
  };
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

/* ---------------------------------------------------------------------------
 * Season -- temporada de metagame de verdade (código/nome/datas + flag "atual"),
 * relacionada a CardSet (uma season pode juntar mais de um lançamento, ex: GD05 +
 * starters de setembro) e a Tournament/HostedEvent. Só uma Season deve ter
 * isCurrent=true por vez -- garantido aqui em transação, não em constraint SQL.
 * Tudo que não pertence à season atual é tratado como "legado" nas leituras de
 * metagame (GET /api/stats/metagame), sem precisar mover ou apagar nada.
 * ------------------------------------------------------------------------- */

app.get("/api/seasons", async (_req, res) => {
  setPublicCache(res, 60, 300);
  const seasons = await prisma.season.findMany({ orderBy: [{ isCurrent: "desc" }, { startDate: "desc" }] });
  res.json(seasons);
});

app.post("/api/seasons", authRequired, roleRequired([UserRole.ADMIN, UserRole.EDITOR]), async (req, res) => {
  const body = req.body as SeasonInput;
  if (!body.code?.trim() || !body.name?.trim()) return res.status(400).json({ error: "Código e nome são obrigatórios." });
  const season = await prisma.season.create({
    data: {
      code: body.code.trim(),
      name: body.name.trim(),
      startDate: toDateOrNull(body.startDate),
      endDate: toDateOrNull(body.endDate),
      notes: body.notes || null,
    },
  });
  res.status(201).json(season);
});

app.put("/api/seasons/:id", authRequired, roleRequired([UserRole.ADMIN, UserRole.EDITOR]), async (req, res) => {
  const id = String(req.params.id);
  const existing = await prisma.season.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "Temporada não encontrada." });
  const body = req.body as Partial<SeasonInput>;
  const season = await prisma.season.update({
    where: { id },
    data: {
      code: body.code?.trim() || existing.code,
      name: body.name?.trim() || existing.name,
      startDate: body.startDate === undefined ? existing.startDate : toDateOrNull(body.startDate),
      endDate: body.endDate === undefined ? existing.endDate : toDateOrNull(body.endDate),
      notes: body.notes === undefined ? existing.notes : (body.notes || null),
    },
  });
  res.json(season);
});

// Marca essa Season como a atual e desmarca qualquer outra -- ação explícita do
// admin (ex: "saiu a GD06, agora é a season atual"). A partir daqui, tudo que
// ficou associado a seasons anteriores passa a contar como legado nas leituras de
// metagame, sem precisar mexer em nenhum registro histórico.
app.put("/api/seasons/:id/set-current", authRequired, roleRequired([UserRole.ADMIN]), async (req, res) => {
  const id = String(req.params.id);
  const existing = await prisma.season.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "Temporada não encontrada." });
  const [, season] = await prisma.$transaction([
    prisma.season.updateMany({ where: { isCurrent: true, id: { not: id } }, data: { isCurrent: false } }),
    prisma.season.update({ where: { id }, data: { isCurrent: true } }),
  ]);
  res.json(season);
});

app.delete("/api/seasons/:id", authRequired, roleRequired([UserRole.ADMIN]), async (req, res) => {
  const id = String(req.params.id);
  const existing = await prisma.season.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "Temporada não encontrada." });
  // Sem soft-delete aqui (Season não tem isActive/deletedAt, igual TournamentEntry) --
  // CardSet/Tournament/HostedEvent vinculados ficam com seasonId=null (onDelete: SetNull),
  // não perdem nenhum outro dado.
  await prisma.season.delete({ where: { id } });
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

// Listagem de gestão do admin -- mesmo raciocínio de GET /api/sets/admin: traz ocultados
// junto, pra dar pra ver e reativar uma trait/série que foi ocultada por engano (a rota
// pública acima nunca devolve isso, de propósito, pra não vazar taxonomia desativada nos
// filtros/autocomplete do site).
app.get("/api/taxonomies/admin", authRequired, roleRequired([UserRole.ADMIN, UserRole.EDITOR]), async (req, res) => {
  setPrivateCache(res, 5, 20);
  const kind = req.query.kind ? normalizeTaxonomyKind(req.query.kind) : undefined;
  const items = await prisma.taxonomyEntry.findMany({
    where: { ...(kind ? { kind } : {}) },
    orderBy: [{ isActive: "desc" }, { kind: "asc" }, { name: "asc" }],
  });
  res.json(items);
});

app.post("/api/taxonomies", authRequired, roleRequired([UserRole.ADMIN, UserRole.EDITOR]), async (req, res) => {
  const kind = normalizeTaxonomyKind(req.body.kind);
  const name = String(req.body.name || "").trim();
  if (!name) return res.status(400).json({ error: "Nome é obrigatório." });
  const item = await prisma.taxonomyEntry.upsert({
    where: { kind_name: { kind, name } },
    // Reativa sempre (isActive/deletedAt) -- sem isso, recadastrar um nome que já tinha
    // sido ocultado batia no unique constraint e caía no "update" mantendo isActive:false
    // pra sempre, um jeito confuso de um registro nunca mais reaparecer mesmo depois de
    // "recriado".
    update: { description: req.body.description || null, coverImage: req.body.coverImage || null, officialUrl: req.body.officialUrl || null, metadataJson: req.body.metadataJson || Prisma.JsonNull, isActive: true, deletedAt: null },
    create: { kind, name, slug: slugify(name), description: req.body.description || null, coverImage: req.body.coverImage || null, officialUrl: req.body.officialUrl || null, metadataJson: req.body.metadataJson || Prisma.JsonNull },
  });
  res.status(201).json(item);
});

app.put("/api/taxonomies/:id", authRequired, roleRequired([UserRole.ADMIN, UserRole.EDITOR]), async (req, res) => {
  const id = String(req.params.id);
  const existing = await prisma.taxonomyEntry.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "Registro não encontrado." });
  const name = String(req.body.name || existing.name).trim();
  const nextActive = typeof req.body.isActive === "boolean" ? req.body.isActive : existing.isActive;
  const updated = await prisma.taxonomyEntry.update({
    where: { id },
    data: {
      kind: req.body.kind ? normalizeTaxonomyKind(req.body.kind) : existing.kind,
      name,
      slug: slugify(name),
      description: req.body.description ?? existing.description,
      coverImage: req.body.coverImage ?? existing.coverImage,
      officialUrl: req.body.officialUrl ?? existing.officialUrl,
      metadataJson: req.body.metadataJson ?? existing.metadataJson ?? Prisma.JsonNull,
      isActive: nextActive,
      deletedAt: nextActive ? null : (existing.deletedAt ?? new Date()),
    },
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
  const colors = normalizeMultiQueryValue(req.query.color);
  const cardType = normalizeQueryValue(req.query.cardType);
  const media = normalizeQueryValue(req.query.media ?? req.query.series);
  const traits = normalizeMultiQueryValue(req.query.trait);
  const keyword = normalizeQueryValue(req.query.keyword);
  const setCode = normalizeQueryValue(req.query.setCode);
  // Multi-valor igual cor/trait (?rarity=Common,C+,C++) -- o front agrupa variações de
  // foil/parallel (C+, LR++ etc.) sob o rótulo canônico e expande de volta pra essa
  // lista antes de consultar, então aqui é só um IN normal.
  const rarities = normalizeMultiQueryValue(req.query.rarity);
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
    ...(rarities.length ? { rarity: { in: rarities } } : {}),
    ...(setCode ? { set: { is: { code: setCode } } } : {}),
  };
  const hasPrintFilter = Boolean(rarities.length || setCode);

  // Busca por texto em duas camadas — nome bate primeiro, série preenche o resto da
  // página. Trait/efeito/piloto ficam de fora de propósito (só teriam sentido pros
  // filtros dedicados de trait/keyword, que já existem separados) — buscar "Wing" deve
  // trazer as cartas com "Wing" no nome, não qualquer carta cujo efeito cite a palavra.
  const qNameCondition: Prisma.CardModelWhereInput | undefined = q
    ? { OR: [{ code: { contains: q, mode: "insensitive" } }, { nameEn: { contains: q, mode: "insensitive" } }, { namePt: { contains: q, mode: "insensitive" } }] }
    : undefined;
  const qSeriesCondition: Prisma.CardModelWhereInput | undefined = q
    ? { OR: [{ series: { contains: q, mode: "insensitive" } }, { sourceTitle: { contains: q, mode: "insensitive" } }] }
    : undefined;
  const qBroadCondition: Prisma.CardModelWhereInput | undefined = q ? { OR: [qNameCondition!, qSeriesCondition!] } : undefined;

  // Filtros que não dependem de q — reaproveitados nas duas camadas da busca (nome
  // primeiro, série depois) sem repetir a lista inteira duas vezes.
  const restFilters: Prisma.CardModelWhereInput[] = [
    { isActive: true },
    colors.length ? { color: { in: colors } } : {},
    cardType ? (cardType === "COMMAND" || cardType === "COMMAND_PILOT" ? { cardType: { in: [CardType.COMMAND, CardType.COMMAND_PILOT] } } : { cardType: cardType as CardType }) : {},
    media ? { OR: [{ sourceTitle: media }, { series: media }] } : {},
    traits.length ? { OR: traits.flatMap((t) => [{ traits: { has: t } }, { trait: { contains: t, mode: "insensitive" as const } }]) } : {},
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
  ];

  const where: Prisma.CardModelWhereInput = { AND: [...restFilters, qBroadCondition || {}] };
  const whereNameMatch: Prisma.CardModelWhereInput = { AND: [...restFilters, qNameCondition || {}] };

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
    // Com busca textual ativa, nome bate primeiro (over-fetch até skip+take e corta),
    // série preenche o resto da página — sem isso, buscar "Wing" trazia qualquer carta
    // da série Gundam Wing mesmo sem "Wing" no nome, com peso igual a quem batia no nome.
    if (q) {
      const need = pagination.skip + pagination.take;
      const [nameMatches, total] = await Promise.all([
        prisma.cardModel.findMany({ where: whereNameMatch, include: printInclude, orderBy, take: need }),
        prisma.cardModel.count({ where }),
      ]);
      let combined = nameMatches;
      if (nameMatches.length < need) {
        const remaining = need - nameMatches.length;
        const excludeIds = nameMatches.map((m) => m.id);
        const otherMatches = await prisma.cardModel.findMany({
          where: { AND: [where, { id: { notIn: excludeIds } }] },
          include: printInclude,
          orderBy,
          take: remaining,
        });
        combined = [...nameMatches, ...otherMatches];
      }
      const items = combined.slice(pagination.skip, pagination.skip + pagination.take);
      return res.json({ items: items.map(flattenModel), page: pagination.page, pageSize: pagination.pageSize, total, totalPages: Math.max(1, Math.ceil(total / pagination.pageSize)) });
    }

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

  // Presença competitiva: em quantos decks públicos essa carta (qualquer impressão dela)
  // aparece. Não depende de torneio, só do corpus de decks com visibility=PUBLIC.
  const printIds = model.prints.map((print) => print.id);
  const publicDeckCount = printIds.length
    ? await prisma.deck.count({ where: { visibility: "PUBLIC", items: { some: { cardId: { in: printIds }, section: { notIn: NON_STATS_SECTIONS } } } } })
    : 0;

  const selectedPrint = (requestedPrintId && model.prints.find((p) => p.id === requestedPrintId)) || model.prints[0];
  const { prints, ...modelFields } = model;
  res.json({ ...modelFields, ...selectedPrint, id: model.id, printId: selectedPrint?.id ?? null, prints, publicDeckCount });
});

// Estatísticas competitivas por CardModel -- agrega os dois "informes" que o site
// conhece (Tournament/TournamentEntry, retroativo, e HostedEvent/HostedEventParticipant
// já finalizado) através de DeckSnapshotItem, que é o único ponto em comum entre eles
// (ambos travam a decklist real numa DeckSnapshot no momento do resultado). Gated por
// amostra mínima: cartas sem uso real relevante voltam hasEnoughData=false e o
// frontend simplesmente não mostra a seção, pra não passar segurança falsa numa
// amostra de 1 partida (ver pedido do usuário: "validável, confiável e útil").
const CARD_STATS_MIN_MATCHES = 8;
const CARD_STATS_MIN_DECKS = 3;

app.get("/api/cards/:id/stats", async (req, res) => {
  setPublicCache(res, 60, 300);
  const id = String(req.params.id);

  let model = await prisma.cardModel.findUnique({ where: { id }, select: { id: true } });
  if (!model) {
    const print = await prisma.card.findUnique({ where: { id }, select: { cardModelId: true } });
    if (print?.cardModelId) model = await prisma.cardModel.findUnique({ where: { id: print.cardModelId }, select: { id: true } });
  }
  if (!model) return res.status(404).json({ error: "Carta não encontrada." });

  const prints = await prisma.card.findMany({ where: { cardModelId: model.id }, select: { id: true } });
  const printIds = prints.map((print) => print.id);

  const emptyStats = { cardModelId: model.id, hasEnoughData: false, deckAppearances: 0, totalDecks: 0, usageRate: null as number | null, wins: 0, losses: 0, draws: 0, totalMatches: 0, winRate: null as number | null };
  if (!printIds.length) return res.json(emptyStats);

  // Snapshots (de qualquer um dos dois sistemas) que realmente incluem essa carta em
  // alguma cópia jogável -- fora token de referência, mesmo critério do publicDeckCount acima.
  const snapshotsWithCard = await prisma.deckSnapshotItem.findMany({
    where: { cardId: { in: printIds }, section: { notIn: NON_STATS_SECTIONS } },
    select: { deckSnapshotId: true },
    distinct: ["deckSnapshotId"],
  });
  const snapshotIdsWithCard = snapshotsWithCard.map((item) => item.deckSnapshotId);

  let wins = 0, losses = 0, draws = 0, deckAppearances = 0;

  if (snapshotIdsWithCard.length) {
    const reportEntries = await prisma.tournamentEntry.findMany({
      where: { deckSnapshotId: { in: snapshotIdsWithCard } },
      select: { wins: true, losses: true, draws: true },
    });
    for (const entry of reportEntries) {
      deckAppearances += 1;
      wins += entry.wins ?? 0;
      losses += entry.losses ?? 0;
      draws += entry.draws ?? 0;
    }

    // Eventos "ao vivo" só entram na conta quando já finalizados -- mesma regra usada
    // em GET /api/hosted-events/public, pra não misturar resultado parcial/em andamento.
    const hostedParticipants = await prisma.hostedEventParticipant.findMany({
      where: { deckSnapshotId: { in: snapshotIdsWithCard }, event: { status: HostedEventStatus.COMPLETED } },
      select: { matchesAsA: { select: { result: true } }, matchesAsB: { select: { result: true } } },
    });
    for (const participant of hostedParticipants) {
      deckAppearances += 1;
      for (const m of participant.matchesAsA) {
        if (m.result === HostedEventMatchResult.PLAYER_A_WIN || m.result === HostedEventMatchResult.BYE) wins += 1;
        else if (m.result === HostedEventMatchResult.PLAYER_B_WIN) losses += 1;
        else if (m.result === HostedEventMatchResult.DRAW) draws += 1;
      }
      for (const m of participant.matchesAsB) {
        if (m.result === HostedEventMatchResult.PLAYER_B_WIN) wins += 1;
        else if (m.result === HostedEventMatchResult.PLAYER_A_WIN) losses += 1;
        else if (m.result === HostedEventMatchResult.DRAW) draws += 1;
      }
    }
  }

  // Denominador da taxa de uso: todo deck já congelado num resultado real (report OU
  // evento finalizado), tenha ou não essa carta -- não é "todo deck público do site".
  const totalDecks = await prisma.deckSnapshot.count({
    where: { OR: [{ tournamentEntries: { some: {} } }, { hostedEventParticipants: { some: { event: { status: HostedEventStatus.COMPLETED } } } }] },
  });

  const totalMatches = wins + losses + draws;
  const hasEnoughData = totalMatches >= CARD_STATS_MIN_MATCHES || deckAppearances >= CARD_STATS_MIN_DECKS;

  res.json({
    cardModelId: model.id,
    hasEnoughData,
    deckAppearances,
    totalDecks,
    usageRate: totalDecks > 0 ? Number(((deckAppearances / totalDecks) * 100).toFixed(1)) : null,
    wins,
    losses,
    draws,
    totalMatches,
    winRate: totalMatches > 0 ? Number(((wins / totalMatches) * 100).toFixed(1)) : null,
  });
});

// Metagame público sourced SOMENTE de decks travados em resultado real (TournamentEntry
// ou HostedEventParticipant já finalizado) via DeckSnapshot -- nunca de Deck/DeckItem
// público, que pode ser editado ou apagado livremente pelo dono a qualquer momento (ver
// pedido do usuário: "decks públicos... não são considerados", metagame vem só das
// versões travadas no momento do registro em evento). seasonId aceita "current"
// (default -- usa a Season com isCurrent=true), "all" (ignora o filtro, mistura tudo
// incluindo legado) ou um id específico (permite consultar uma season legada isolada,
// depois que ela deixar de ser a atual). setId filtra pra só contar snapshots com pelo
// menos 1 carta daquela coleção; dentro desse recorte, topCards e colorDistribution
// focam nas cartas da coleção filtrada (pedido explícito: "cartas mais usadas daquela
// coleção" e "cores mais usadas"). colorCombos sempre reflete a identidade de cor do
// deck inteiro (não só da coleção filtrada), pra continuar fazendo sentido como
// "assinatura de arquétipo".
app.get("/api/stats/metagame", async (req, res) => {
  setPublicCache(res, 60, 300);
  const seasonParam = typeof req.query.seasonId === "string" ? req.query.seasonId : "current";
  const setId = typeof req.query.setId === "string" && req.query.setId ? req.query.setId : undefined;

  let seasonId: string | null = null;
  let season: { id: string; code: string; name: string } | null = null;
  if (seasonParam === "all") {
    seasonId = null;
  } else if (seasonParam === "current") {
    const current = await prisma.season.findFirst({ where: { isCurrent: true } });
    seasonId = current?.id ?? null;
    season = current ? { id: current.id, code: current.code, name: current.name } : null;
  } else {
    const found = await prisma.season.findUnique({ where: { id: seasonParam } });
    if (!found) return res.status(404).json({ error: "Temporada não encontrada." });
    seasonId = found.id;
    season = { id: found.id, code: found.code, name: found.name };
  }

  const [reportSnapshots, hostedSnapshots] = await Promise.all([
    prisma.tournamentEntry.findMany({
      where: { deckSnapshotId: { not: null }, tournament: { isActive: true, ...(seasonId ? { seasonId } : {}) } },
      select: { deckSnapshotId: true },
    }),
    prisma.hostedEventParticipant.findMany({
      where: { deckSnapshotId: { not: null }, event: { status: HostedEventStatus.COMPLETED, isActive: true, ...(seasonId ? { seasonId } : {}) } },
      select: { deckSnapshotId: true },
    }),
  ]);
  const snapshotIds = Array.from(
    new Set([...reportSnapshots, ...hostedSnapshots].map((row) => row.deckSnapshotId).filter((v): v is string => Boolean(v))),
  );

  const empty = { season, setId: setId ?? null, totalDecks: 0, topCards: [] as unknown[], colorDistribution: [] as unknown[], colorCombos: [] as unknown[] };
  if (!snapshotIds.length) return res.json(empty);

  const items = await prisma.deckSnapshotItem.findMany({
    where: { deckSnapshotId: { in: snapshotIds }, section: { notIn: NON_STATS_SECTIONS } },
    select: {
      deckSnapshotId: true,
      card: { select: { id: true, cardModelId: true, nameEn: true, namePt: true, color: true, setId: true, cardType: true } },
    },
  });

  // Agrupa por snapshot pra poder aplicar o filtro de coleção (>=1 carta daquela
  // coleção conta o deck inteiro pro recorte) antes de calcular presença "por deck"
  // (não por cópia) em cada leitura.
  const bySnapshot = new Map<string, typeof items>();
  for (const item of items) {
    const list = bySnapshot.get(item.deckSnapshotId) || [];
    list.push(item);
    bySnapshot.set(item.deckSnapshotId, list);
  }

  const eligibleSnapshotIds = setId
    ? Array.from(bySnapshot.entries()).filter(([, list]) => list.some((entry) => entry.card?.setId === setId)).map(([id]) => id)
    : Array.from(bySnapshot.keys());

  const totalDecks = eligibleSnapshotIds.length;

  const cardCount = new Map<string, { key: string; name: string; color: string | null; decks: number }>();
  const colorCount = new Map<string, number>();
  const comboCount = new Map<string, number>();

  for (const snapshotId of eligibleSnapshotIds) {
    const list = bySnapshot.get(snapshotId) || [];
    const seenScopedCardKeys = new Set<string>();
    const deckColorsScoped = new Set<string>();
    const deckColorsFull = new Set<string>();
    for (const item of list) {
      const card = item.card;
      if (!card) continue;
      if (NON_STATS_CARD_TYPES.includes(card.cardType)) continue;
      if (card.color) deckColorsFull.add(card.color);
      if (setId && card.setId !== setId) continue;
      if (card.color) deckColorsScoped.add(card.color);
      const key = card.cardModelId || card.id;
      if (seenScopedCardKeys.has(key)) continue;
      seenScopedCardKeys.add(key);
      const entry = cardCount.get(key) || { key, name: card.namePt || card.nameEn, color: card.color || null, decks: 0 };
      entry.decks += 1;
      cardCount.set(key, entry);
    }
    const colorsForDistribution = setId ? deckColorsScoped : deckColorsFull;
    colorsForDistribution.forEach((color) => colorCount.set(color, (colorCount.get(color) ?? 0) + 1));
    if (deckColorsFull.size) {
      const combo = Array.from(deckColorsFull).sort().join(" + ");
      comboCount.set(combo, (comboCount.get(combo) ?? 0) + 1);
    }
  }

  const presenceRate = (decks: number) => (totalDecks > 0 ? Number(((decks / totalDecks) * 100).toFixed(1)) : null);

  const topCards = Array.from(cardCount.values())
    .sort((a, b) => b.decks - a.decks)
    .slice(0, 10)
    .map((entry) => ({ cardModelId: entry.key, name: entry.name, color: entry.color, appearances: entry.decks, presenceRate: presenceRate(entry.decks) }));

  const colorDistribution = Array.from(colorCount.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([color, decks]) => ({ color, decks, presenceRate: presenceRate(decks) }));

  const colorCombos = Array.from(comboCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([combo, decks]) => ({ combo, decks, presenceRate: presenceRate(decks) }));

  res.json({ season, setId: setId ?? null, totalDecks, topCards, colorDistribution, colorCombos });
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
    // restrictedCopies/banGroupId são decisão editorial (curadoria de banimento), não campo
    // de identidade de jogo derivado da impressão — fica de fora do MODEL_FIELDS_FROM_CARD
    // de propósito, senão syncCardModelForCode apagaria isso a cada edição de impressão
    // (Card não tem essas colunas, então a sincronização gravaria undefined por cima).
    if ("restrictedCopies" in body) (modelData as any).restrictedCopies = body.restrictedCopies === "" || body.restrictedCopies == null ? null : Number(body.restrictedCopies);
    if ("banGroupId" in body) (modelData as any).banGroupId = body.banGroupId || null;
    const updated = await prisma.cardModel.update({ where: { id }, data: modelData as any });
    // Mantém a impressão primária com os mesmos campos de identidade — evita a impressão
    // "desatualizar" em relação ao modelo até a próxima sincronização.
    const { restrictedCopies: _rc, banGroupId: _bg, ...printSyncData } = modelData as any;
    await prisma.card.updateMany({ where: { cardModelId: id, isPrimaryPrint: true }, data: printSyncData });
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
  const body = req.body as { rarity?: string; printLabel?: string; setId?: string | null; imageUrl?: string; thumbUrl?: string; imageSmallUrl?: string; imageMediumUrl?: string; imageLargeUrl?: string; imageSourceUrl?: string; officialUrl?: string; isPrimaryPrint?: boolean; legalityStatus?: string; quantityInProduct?: number | null };
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
      quantityInProduct: body.quantityInProduct === undefined ? existing.quantityInProduct : body.quantityInProduct,
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
    const entity = ["cards", "collections", "media", "decks"].includes(entityRaw) ? entityRaw as "cards" | "collections" | "media" | "decks" | "avatars" : "cards";
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
  const title = normalizeQueryValue(req.query.title);
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
        title ? { title: { equals: title } } : {},
      ],
    },
    include: { card: true },
    orderBy: sort === "title_asc" ? [{ title: "asc" }] : [{ updatedAt: "desc" }],
  });
  res.json(rulings);
});

app.get("/api/rulings/filters", async (_req, res) => {
  setPublicCache(res, 60, 300);
  const [sourceRows, keywordRows, titleRows, phaseRows] = await Promise.all([
    prisma.ruling.findMany({ select: { sourceType: true }, distinct: ["sourceType"], orderBy: { sourceType: "asc" } }),
    prisma.ruling.findMany({ select: { relatedKeyword: true }, distinct: ["relatedKeyword"], where: { relatedKeyword: { not: null } }, orderBy: { relatedKeyword: "asc" } }),
    prisma.ruling.findMany({ select: { title: true }, distinct: ["title"], where: { isActive: true }, orderBy: { title: "asc" } }),
    prisma.ruling.findMany({ select: { relatedPhase: true }, distinct: ["relatedPhase"], where: { relatedPhase: { not: null } }, orderBy: { relatedPhase: "asc" } }),
  ]);
  res.json({
    sourceTypes: sourceRows.map((item) => item.sourceType),
    relatedKeywords: keywordRows.map((item) => item.relatedKeyword).filter(Boolean),
    titles: titleRows.map((item) => item.title).filter(Boolean),
    relatedPhases: phaseRows.map((item) => item.relatedPhase).filter(Boolean),
  });
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

// Fase B: congela a decklist de um Deck vivo numa DeckSnapshot (cópia imutável) --
// chamado sempre que um deckId é vinculado a um resultado histórico (TournamentEntry)
// ou travado num evento do Hoster (HostedEventParticipant), pra que editar/apagar o
// Deck original depois não afete a lista que já foi exibida como "a decklist usada".
async function createDeckSnapshot(deckId: string) {
  const deck = await prisma.deck.findUnique({ where: { id: deckId }, include: { items: true } });
  if (!deck) return null;
  const snapshot = await prisma.deckSnapshot.create({
    data: {
      sourceDeckId: deck.id,
      sourceUserId: deck.userId,
      name: deck.name,
      format: deck.format,
      items: {
        create: deck.items.map((item) => ({ cardId: item.cardId, quantity: item.quantity, section: item.section })),
      },
    },
  });
  return snapshot.id;
}

// Entry inclui user (conta cadastrada, se vinculada) e deck (só o essencial pra link
// público -- não o decklist inteiro) -- alimenta a fase 1 do hub de eventos: exibir
// quem tem conta no site e qual deck foi usado, sem vazar dado sensível de usuário.
// Fase B: deckSnapshot traz a decklist congelada no momento em que o deckId foi
// vinculado, pra sobreviver a uma edição/exclusão do Deck original.
const tournamentEntryInclude = {
  seasonRef: true,
  entries: {
    include: {
      user: { select: { id: true, username: true, displayName: true } },
      deck: { select: { id: true, name: true, shareId: true } },
      deckSnapshot: { include: { items: { include: { card: true } } } },
    },
  },
} as const;

app.get("/api/tournaments", async (_req, res) => {
  setPublicCache(res, 20, 90);
  const events = await prisma.tournament.findMany({ where: { isActive: true }, include: tournamentEntryInclude, orderBy: [{ dateStart: "desc" }] });
  res.json(events);
});

app.get("/api/tournaments/:id", async (req, res) => {
  setPublicCache(res, 20, 90);
  const id = String(req.params.id);
  const event = await prisma.tournament.findUnique({ where: { id }, include: tournamentEntryInclude });
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

app.post("/api/tournaments/:id/entries", authRequired, roleRequired([UserRole.ADMIN, UserRole.EDITOR]), async (req, res) => {
  const tournamentId = String(req.params.id);
  const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
  if (!tournament) return res.status(404).json({ error: "Evento não encontrado." });
  const body = req.body as { playerName?: string; placement?: number | null; wins?: number | null; losses?: number | null; draws?: number | null; archetype?: string | null; deckId?: string | null; userId?: string | null };
  if (!body.playerName?.trim()) return res.status(400).json({ error: "Nome do jogador é obrigatório." });
  const deckId = body.deckId || null;
  // Fase B: se um deckId foi informado, congela a decklist agora -- garante que o
  // resultado histórico continue mostrando a lista usada mesmo se o deck for
  // editado/apagado depois.
  const deckSnapshotId = deckId ? await createDeckSnapshot(deckId) : null;
  const entry = await prisma.tournamentEntry.create({
    data: {
      tournamentId,
      playerName: body.playerName.trim(),
      placement: body.placement ?? null,
      wins: body.wins ?? null,
      losses: body.losses ?? null,
      draws: body.draws ?? null,
      archetype: body.archetype?.trim() || null,
      deckId,
      userId: body.userId || null,
      deckSnapshotId,
    },
  });
  res.status(201).json(entry);
});

app.put("/api/tournaments/:id/entries/:entryId", authRequired, roleRequired([UserRole.ADMIN, UserRole.EDITOR]), async (req: RequestWithUser, res) => {
  const { id: tournamentId, entryId } = req.params as { id: string; entryId: string };
  const existing = await prisma.tournamentEntry.findFirst({ where: { id: entryId, tournamentId } });
  if (!existing) return res.status(404).json({ error: "Participante não encontrado." });
  const body = req.body as { playerName?: string; placement?: number | null; wins?: number | null; losses?: number | null; draws?: number | null; archetype?: string | null; deckId?: string | null; userId?: string | null };
  const nextDeckId = body.deckId === undefined ? existing.deckId : (body.deckId || null);
  const deckChanged = nextDeckId !== existing.deckId;
  // Fase B: só gera uma nova snapshot quando o deckId muda de fato -- evita recongelar
  // a decklist a cada edição de campo que não mexe no deck vinculado.
  const deckSnapshotId = deckChanged
    ? (nextDeckId ? await createDeckSnapshot(nextDeckId) : null)
    : existing.deckSnapshotId;
  // Fase D (pedido do usuário: "garantir que os decks utilizados em eventos jamais
  // sejam modificados, para manter log"): TournamentEntry não trava de forma rígida
  // como HostedEventParticipant (admin pode corrigir vínculo errado), mas toda troca
  // de deckId fica auditada -- a snapshot antiga nunca é apagada nem sobrescrita, só
  // deixa de ser a "atual" da entry, e o log abaixo preserva pra quem trocou e quando.
  const [entry] = await prisma.$transaction([
    prisma.tournamentEntry.update({
      where: { id: entryId },
      data: {
        playerName: body.playerName?.trim() || existing.playerName,
        placement: body.placement === undefined ? existing.placement : body.placement,
        wins: body.wins === undefined ? existing.wins : body.wins,
        losses: body.losses === undefined ? existing.losses : body.losses,
        draws: body.draws === undefined ? existing.draws : body.draws,
        archetype: body.archetype === undefined ? existing.archetype : (body.archetype?.trim() || null),
        deckId: nextDeckId,
        userId: body.userId === undefined ? existing.userId : (body.userId || null),
        deckSnapshotId,
      },
    }),
    ...(deckChanged
      ? [
          prisma.tournamentEntryDeckChangeLog.create({
            data: {
              tournamentEntryId: entryId,
              previousDeckId: existing.deckId,
              previousDeckSnapshotId: existing.deckSnapshotId,
              nextDeckId,
              nextDeckSnapshotId: deckSnapshotId,
              changedByUserId: req.user!.userId,
            },
          }),
        ]
      : []),
  ]);
  res.json(entry);
});

app.delete("/api/tournaments/:id/entries/:entryId", authRequired, roleRequired([UserRole.ADMIN, UserRole.EDITOR]), async (req, res) => {
  const { id: tournamentId, entryId } = req.params as { id: string; entryId: string };
  const existing = await prisma.tournamentEntry.findFirst({ where: { id: entryId, tournamentId } });
  if (!existing) return res.status(404).json({ error: "Participante não encontrado." });
  // TournamentEntry não tem isActive/deletedAt no schema (ao contrário do resto do
  // projeto) — participante de torneio é registro de resultado histórico, não algo
  // com ciclo de vida próprio, então aqui é exclusão de verdade mesmo, não soft-delete.
  await prisma.tournamentEntry.delete({ where: { id: entryId } });
  res.status(204).send();
});

// Auditoria de troca de deck do TournamentEntry (ver comentário na rota PUT acima) --
// só admin/editor enxerga, não é exposta na leitura pública de torneios.
app.get("/api/tournaments/:id/entries/:entryId/deck-change-log", authRequired, roleRequired([UserRole.ADMIN, UserRole.EDITOR]), async (req, res) => {
  const { id: tournamentId, entryId } = req.params as { id: string; entryId: string };
  const existing = await prisma.tournamentEntry.findFirst({ where: { id: entryId, tournamentId } });
  if (!existing) return res.status(404).json({ error: "Participante não encontrado." });
  const logs = await prisma.tournamentEntryDeckChangeLog.findMany({
    where: { tournamentEntryId: entryId },
    include: { changedByUser: { select: { id: true, username: true, displayName: true } } },
    orderBy: [{ createdAt: "desc" }],
  });
  res.json(logs);
});

/* ---------------------------------------------------------------------------
 * Eventos ao vivo organizados por um Hoster (fase A) — diferente do Tournament
 * acima, que é um report retroativo cadastrado pelo admin. Aqui é o dono do
 * evento (isHoster=true ou ADMIN) quem cria/edita/cancela. Participantes, trava
 * de deck e rodadas/pontuação entram em fases seguintes deste recurso.
 * ------------------------------------------------------------------------- */

// Fase B: participante de um HostedEvent -- sempre um usuário cadastrado no site
// (diferente do TournamentEntry de report, que aceita jogador convidado sem conta).
// A trava de deck é definitiva: uma vez que deckLockedAt é preenchido, o endpoint de
// travar deck passa a recusar (409) qualquer nova tentativa pro mesmo participante --
// "uma vez escolhido o deck, não pode mais ser desfeito", conforme pedido.
const hostedEventParticipantInclude = {
  user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
  deck: { select: { id: true, name: true, shareId: true } },
  deckSnapshot: { include: { items: { include: { card: true } } } },
} as const;

// Fase C: participante enxuto (só id + usuário) pra exibir num confronto -- os dados
// completos (deck/deckSnapshot) já vêm pela lista de participants do próprio evento,
// não precisa duplicar aqui.
const hostedEventMatchInclude = {
  participantA: { select: { id: true, user: { select: { id: true, username: true, displayName: true } } } },
  participantB: { select: { id: true, user: { select: { id: true, username: true, displayName: true } } } },
} as const;

const hostedEventRoundInclude = {
  matches: { include: hostedEventMatchInclude, orderBy: [{ tableNumber: "asc" as const }, { createdAt: "asc" as const }] },
} as const;

const hostedEventOwnerInclude = {
  hoster: { select: { id: true, username: true, displayName: true } },
  seasonRef: true,
  participants: { include: hostedEventParticipantInclude, orderBy: [{ createdAt: "asc" as const }] },
  rounds: { include: hostedEventRoundInclude, orderBy: [{ roundNumber: "asc" as const }] },
} as const;

async function loadOwnedHostedEvent(req: RequestWithUser, res: Response, id: string) {
  const event = await prisma.hostedEvent.findFirst({ where: { id, isActive: true }, include: hostedEventOwnerInclude });
  if (!event) {
    res.status(404).json({ error: "Evento não encontrado." });
    return null;
  }
  if (event.hosterId !== req.user!.userId && req.user!.role !== UserRole.ADMIN) {
    res.status(403).json({ error: "Sem permissão sobre este evento." });
    return null;
  }
  return event;
}

app.get("/api/hosted-events/mine", authRequired, hosterRequired, async (req: RequestWithUser, res) => {
  setPrivateCache(res, 5, 20);
  const events = await prisma.hostedEvent.findMany({
    where: { hosterId: req.user!.userId, isActive: true },
    include: hostedEventOwnerInclude,
    orderBy: [{ dateStart: "desc" }],
  });
  res.json(events);
});

app.get("/api/hosted-events/admin", authRequired, roleRequired([UserRole.ADMIN]), async (_req, res) => {
  setPrivateCache(res, 5, 20);
  const events = await prisma.hostedEvent.findMany({ where: { isActive: true }, include: hostedEventOwnerInclude, orderBy: [{ dateStart: "desc" }] });
  res.json(events);
});

// Pública (sem auth) -- eventos "ao vivo" já finalizados, pra aparecer na tela pública
// de Eventos ao lado dos Tournament/TournamentEntry (report retroativo do admin). Até
// aqui o HostedEvent nunca tinha rota pública nenhuma: um evento rodado pelo Hoster via
// /organizador (participantes, rodadas, bye, status = COMPLETED) ficava invisível pra
// qualquer visitante, mesmo já encerrado -- só aparecia se o admin *também* cadastrasse
// um Tournament report separado pro mesmo evento. Precisa estar declarada ANTES de
// GET /api/hosted-events/:id (Express casa rota literal antes de :id só se vier primeiro
// no arquivo), senão "public" seria interpretado como um :id.
app.get("/api/hosted-events/public", async (_req, res) => {
  setPublicCache(res, 20, 90);
  const events = await prisma.hostedEvent.findMany({
    where: { isActive: true, status: HostedEventStatus.COMPLETED },
    select: {
      id: true, name: true, description: true, format: true, venueName: true, city: true, country: true,
      dateStart: true, dateEnd: true, status: true, seasonId: true,
      hoster: { select: { id: true, username: true, displayName: true } },
      seasonRef: true,
    },
    orderBy: [{ dateStart: "desc" }],
  });
  const withStandings = await Promise.all(
    events.map(async (event) => ({ ...event, standings: await computeHostedEventStandings(event.id) }))
  );
  res.json(withStandings);
});

app.get("/api/hosted-events/:id", authRequired, hosterRequired, async (req: RequestWithUser, res) => {
  const event = await loadOwnedHostedEvent(req, res, String(req.params.id));
  if (!event) return;
  res.json(event);
});

app.post("/api/hosted-events", authRequired, hosterRequired, async (req: RequestWithUser, res) => {
  const body = req.body as {
    name?: string; description?: string | null; format?: string; venueName?: string | null;
    city?: string | null; country?: string | null; dateStart?: string; dateEnd?: string | null;
    maxPlayers?: number | null; status?: HostedEventStatus; seasonId?: string | null;
  };
  if (!body.name?.trim()) return res.status(400).json({ error: "Nome do evento é obrigatório." });
  if (!body.dateStart) return res.status(400).json({ error: "Data/hora de início é obrigatória." });
  const event = await prisma.hostedEvent.create({
    data: {
      hosterId: req.user!.userId,
      name: body.name.trim(),
      description: body.description?.trim() || null,
      format: body.format?.trim() || "constructed",
      venueName: body.venueName?.trim() || null,
      city: body.city?.trim() || null,
      country: body.country?.trim() || null,
      dateStart: new Date(body.dateStart),
      dateEnd: body.dateEnd ? new Date(body.dateEnd) : null,
      maxPlayers: body.maxPlayers ?? null,
      status: body.status ?? HostedEventStatus.DRAFT,
      seasonId: body.seasonId || null,
    },
    include: hostedEventOwnerInclude,
  });
  res.status(201).json(event);
});

app.put("/api/hosted-events/:id", authRequired, hosterRequired, async (req: RequestWithUser, res) => {
  const existing = await loadOwnedHostedEvent(req, res, String(req.params.id));
  if (!existing) return;
  const body = req.body as {
    name?: string; description?: string | null; format?: string; venueName?: string | null;
    city?: string | null; country?: string | null; dateStart?: string; dateEnd?: string | null;
    maxPlayers?: number | null; status?: HostedEventStatus; seasonId?: string | null;
  };
  const event = await prisma.hostedEvent.update({
    where: { id: existing.id },
    data: {
      name: body.name?.trim() || existing.name,
      description: body.description === undefined ? existing.description : (body.description?.trim() || null),
      format: body.format?.trim() || existing.format,
      venueName: body.venueName === undefined ? existing.venueName : (body.venueName?.trim() || null),
      city: body.city === undefined ? existing.city : (body.city?.trim() || null),
      country: body.country === undefined ? existing.country : (body.country?.trim() || null),
      dateStart: body.dateStart ? new Date(body.dateStart) : existing.dateStart,
      dateEnd: body.dateEnd === undefined ? existing.dateEnd : (body.dateEnd ? new Date(body.dateEnd) : null),
      maxPlayers: body.maxPlayers === undefined ? existing.maxPlayers : body.maxPlayers,
      status: body.status ?? existing.status,
      seasonId: body.seasonId === undefined ? existing.seasonId : (body.seasonId || null),
    },
    include: hostedEventOwnerInclude,
  });
  res.json(event);
});

app.delete("/api/hosted-events/:id", authRequired, hosterRequired, async (req: RequestWithUser, res) => {
  const existing = await loadOwnedHostedEvent(req, res, String(req.params.id));
  if (!existing) return;
  await prisma.hostedEvent.update({ where: { id: existing.id }, data: { isActive: false, deletedAt: new Date(), status: HostedEventStatus.CANCELLED } });
  res.status(204).send();
});

/* ---------------------------------------------------------------------------
 * Fase B -- participantes de um HostedEvent e trava de deck. Adicionar/remover
 * participante e travar o deck só o dono do evento (ou ADMIN) pode fazer, via
 * loadOwnedHostedEvent. A trava em si é de mão única (ver comentário acima de
 * hostedEventParticipantInclude).
 * ------------------------------------------------------------------------- */

app.post("/api/hosted-events/:id/participants", authRequired, hosterRequired, async (req: RequestWithUser, res) => {
  const event = await loadOwnedHostedEvent(req, res, String(req.params.id));
  if (!event) return;
  const body = req.body as { userId?: string };
  if (!body.userId) return res.status(400).json({ error: "Usuário é obrigatório." });
  const user = await prisma.user.findUnique({ where: { id: body.userId } });
  if (!user || !user.isActive) return res.status(404).json({ error: "Usuário não encontrado." });
  if (event.maxPlayers) {
    const count = await prisma.hostedEventParticipant.count({ where: { eventId: event.id } });
    if (count >= event.maxPlayers) return res.status(409).json({ error: "Limite de jogadores do evento já foi atingido." });
  }
  try {
    const participant = await prisma.hostedEventParticipant.create({
      data: { eventId: event.id, userId: body.userId },
      include: hostedEventParticipantInclude,
    });
    res.status(201).json(participant);
  } catch (err: any) {
    if (err?.code === "P2002") return res.status(409).json({ error: "Esse jogador já está inscrito neste evento." });
    throw err;
  }
});

app.delete("/api/hosted-events/:id/participants/:participantId", authRequired, hosterRequired, async (req: RequestWithUser, res) => {
  const event = await loadOwnedHostedEvent(req, res, String(req.params.id));
  if (!event) return;
  const participant = await prisma.hostedEventParticipant.findFirst({ where: { id: String(req.params.participantId), eventId: event.id } });
  if (!participant) return res.status(404).json({ error: "Participante não encontrado." });
  // Deck já travado -- o resultado passa a fazer parte do histórico do evento e não
  // pode mais sumir do registro (mesma lógica de "não pode ser desfeito" da trava).
  if (participant.deckLockedAt) return res.status(403).json({ error: "Não é possível remover um participante com deck já travado." });
  // Fase C: idem se o participante já tem confronto registrado (mesmo sem resultado
  // lançado ainda) -- remover ia deixar HostedEventMatch.participantAId/BId órfão de
  // sentido na tabela de rodadas.
  const matchCount = await prisma.hostedEventMatch.count({
    where: { OR: [{ participantAId: participant.id }, { participantBId: participant.id }] },
  });
  if (matchCount > 0) return res.status(403).json({ error: "Não é possível remover um participante que já está em algum confronto." });
  await prisma.hostedEventParticipant.delete({ where: { id: participant.id } });
  res.status(204).send();
});

app.post("/api/hosted-events/:id/participants/:participantId/deck", authRequired, hosterRequired, async (req: RequestWithUser, res) => {
  const event = await loadOwnedHostedEvent(req, res, String(req.params.id));
  if (!event) return;
  const participant = await prisma.hostedEventParticipant.findFirst({ where: { id: String(req.params.participantId), eventId: event.id } });
  if (!participant) return res.status(404).json({ error: "Participante não encontrado." });
  if (participant.deckLockedAt) return res.status(409).json({ error: "O deck deste participante já foi travado e não pode mais ser alterado." });
  const body = req.body as { deckId?: string };
  if (!body.deckId) return res.status(400).json({ error: "Deck é obrigatório." });
  const deck = await prisma.deck.findUnique({ where: { id: body.deckId } });
  // Só decks públicos do próprio participante podem ser travados -- o Hoster não tem
  // acesso a decks privados de terceiros (mesma regra do perfil público /u/:username).
  if (!deck || deck.userId !== participant.userId || deck.visibility !== "PUBLIC") {
    return res.status(404).json({ error: "Deck não encontrado no perfil público deste jogador." });
  }
  const deckSnapshotId = await createDeckSnapshot(deck.id);
  const updated = await prisma.hostedEventParticipant.update({
    where: { id: participant.id },
    data: { deckId: deck.id, deckSnapshotId, deckLockedAt: new Date() },
    include: hostedEventParticipantInclude,
  });
  res.json(updated);
});

/* ---------------------------------------------------------------------------
 * Fase C -- rodadas, confrontos e classificação de um HostedEvent. Pareamento e
 * lançamento de resultado são manuais (o Hoster monta os confrontos e digita quem
 * ganhou); o schema comporta um pareamento automático (Swiss) no futuro sem precisar
 * ser reescrito. participantBId nulo = bye, que já nasce com resultado BYE fixo.
 * ------------------------------------------------------------------------- */

// Pontuação padrão de TCG: vitória=3, empate=1, derrota=0. Bye conta como vitória
// automática (3 pts) sem afetar estatística de mais ninguém, já que não existe um
// adversário de verdade. Fixo pro MVP (não configurável por evento ainda).
const HOSTED_EVENT_POINTS = { win: 3, draw: 1, loss: 0 } as const;

async function computeHostedEventStandings(eventId: string) {
  const participants = await prisma.hostedEventParticipant.findMany({
    where: { eventId },
    select: { id: true, deckSnapshotId: true, user: { select: { id: true, username: true, displayName: true, avatarUrl: true } } },
  });
  type Row = { participantId: string; user: (typeof participants)[number]["user"]; hasDeck: boolean; points: number; wins: number; draws: number; losses: number; byes: number; played: number };
  const stats = new Map<string, Row>();
  for (const p of participants) {
    stats.set(p.id, { participantId: p.id, user: p.user, hasDeck: Boolean(p.deckSnapshotId), points: 0, wins: 0, draws: 0, losses: 0, byes: 0, played: 0 });
  }
  const matches = await prisma.hostedEventMatch.findMany({ where: { round: { eventId } } });
  for (const m of matches) {
    const a = stats.get(m.participantAId);
    const b = m.participantBId ? stats.get(m.participantBId) : null;
    if (!a) continue;
    if (m.result === HostedEventMatchResult.BYE) {
      a.points += HOSTED_EVENT_POINTS.win;
      a.wins += 1;
      a.byes += 1;
      a.played += 1;
    } else if (m.result === HostedEventMatchResult.PLAYER_A_WIN) {
      a.points += HOSTED_EVENT_POINTS.win;
      a.wins += 1;
      a.played += 1;
      if (b) { b.points += HOSTED_EVENT_POINTS.loss; b.losses += 1; b.played += 1; }
    } else if (m.result === HostedEventMatchResult.PLAYER_B_WIN) {
      a.points += HOSTED_EVENT_POINTS.loss;
      a.losses += 1;
      a.played += 1;
      if (b) { b.points += HOSTED_EVENT_POINTS.win; b.wins += 1; b.played += 1; }
    } else if (m.result === HostedEventMatchResult.DRAW) {
      a.points += HOSTED_EVENT_POINTS.draw;
      a.draws += 1;
      a.played += 1;
      if (b) { b.points += HOSTED_EVENT_POINTS.draw; b.draws += 1; b.played += 1; }
    }
    // PENDING: confronto ainda sem resultado lançado, não conta pra classificação.
  }
  return Array.from(stats.values()).sort((x, y) => y.points - x.points || y.wins - x.wins || x.losses - y.losses);
}

app.get("/api/hosted-events/:id/standings", authRequired, hosterRequired, async (req: RequestWithUser, res) => {
  const event = await loadOwnedHostedEvent(req, res, String(req.params.id));
  if (!event) return;
  const standings = await computeHostedEventStandings(event.id);
  res.json(standings);
});

app.post("/api/hosted-events/:id/rounds", authRequired, hosterRequired, async (req: RequestWithUser, res) => {
  const event = await loadOwnedHostedEvent(req, res, String(req.params.id));
  if (!event) return;
  const last = await prisma.hostedEventRound.findFirst({ where: { eventId: event.id }, orderBy: [{ roundNumber: "desc" }] });
  const round = await prisma.hostedEventRound.create({
    data: { eventId: event.id, roundNumber: (last?.roundNumber ?? 0) + 1 },
    include: hostedEventRoundInclude,
  });
  res.status(201).json(round);
});

app.put("/api/hosted-events/:id/rounds/:roundId", authRequired, hosterRequired, async (req: RequestWithUser, res) => {
  const event = await loadOwnedHostedEvent(req, res, String(req.params.id));
  if (!event) return;
  const round = await prisma.hostedEventRound.findFirst({ where: { id: String(req.params.roundId), eventId: event.id } });
  if (!round) return res.status(404).json({ error: "Rodada não encontrada." });
  const body = req.body as { status?: HostedEventRoundStatus };
  if (!body.status) return res.status(400).json({ error: "Status é obrigatório." });
  const updated = await prisma.hostedEventRound.update({ where: { id: round.id }, data: { status: body.status }, include: hostedEventRoundInclude });
  res.json(updated);
});

app.delete("/api/hosted-events/:id/rounds/:roundId", authRequired, hosterRequired, async (req: RequestWithUser, res) => {
  const event = await loadOwnedHostedEvent(req, res, String(req.params.id));
  if (!event) return;
  const round = await prisma.hostedEventRound.findFirst({ where: { id: String(req.params.roundId), eventId: event.id }, include: { matches: true } });
  if (!round) return res.status(404).json({ error: "Rodada não encontrada." });
  // Impede apagar uma rodada com resultado já lançado -- os pontos já contam pra
  // classificação, apagar silenciosamente reescreveria o histórico do evento.
  if (round.matches.some((m) => m.result !== HostedEventMatchResult.PENDING)) {
    return res.status(409).json({ error: "Não é possível remover uma rodada com resultados já lançados." });
  }
  await prisma.hostedEventRound.delete({ where: { id: round.id } });
  res.status(204).send();
});

app.post("/api/hosted-events/:id/rounds/:roundId/matches", authRequired, hosterRequired, async (req: RequestWithUser, res) => {
  const event = await loadOwnedHostedEvent(req, res, String(req.params.id));
  if (!event) return;
  const round = await prisma.hostedEventRound.findFirst({ where: { id: String(req.params.roundId), eventId: event.id } });
  if (!round) return res.status(404).json({ error: "Rodada não encontrada." });
  const body = req.body as { participantAId?: string; participantBId?: string | null; tableNumber?: number | null };
  if (!body.participantAId) return res.status(400).json({ error: "Participante A é obrigatório." });
  if (body.participantBId && body.participantAId === body.participantBId) {
    return res.status(400).json({ error: "Os dois participantes do confronto precisam ser diferentes." });
  }
  const participantIds = [body.participantAId, body.participantBId].filter((v): v is string => !!v);
  const participants = await prisma.hostedEventParticipant.findMany({ where: { id: { in: participantIds }, eventId: event.id } });
  if (participants.length !== participantIds.length) return res.status(404).json({ error: "Participante não encontrado neste evento." });
  // Cada participante só pode aparecer em um confronto por rodada.
  const alreadyPaired = await prisma.hostedEventMatch.findFirst({
    where: { roundId: round.id, OR: [{ participantAId: { in: participantIds } }, { participantBId: { in: participantIds } }] },
  });
  if (alreadyPaired) return res.status(409).json({ error: "Um dos participantes já está em outro confronto nesta rodada." });
  const match = await prisma.hostedEventMatch.create({
    data: {
      roundId: round.id,
      tableNumber: body.tableNumber ?? null,
      participantAId: body.participantAId,
      participantBId: body.participantBId || null,
      // Sem adversário = bye -- já nasce com resultado definido (vitória automática).
      result: body.participantBId ? HostedEventMatchResult.PENDING : HostedEventMatchResult.BYE,
      reportedAt: body.participantBId ? null : new Date(),
    },
    include: hostedEventMatchInclude,
  });
  res.status(201).json(match);
});

app.put("/api/hosted-events/:id/rounds/:roundId/matches/:matchId", authRequired, hosterRequired, async (req: RequestWithUser, res) => {
  const event = await loadOwnedHostedEvent(req, res, String(req.params.id));
  if (!event) return;
  const round = await prisma.hostedEventRound.findFirst({ where: { id: String(req.params.roundId), eventId: event.id } });
  if (!round) return res.status(404).json({ error: "Rodada não encontrada." });
  const match = await prisma.hostedEventMatch.findFirst({ where: { id: String(req.params.matchId), roundId: round.id } });
  if (!match) return res.status(404).json({ error: "Confronto não encontrado." });
  const body = req.body as { tableNumber?: number | null; result?: HostedEventMatchResult };
  const data: Prisma.HostedEventMatchUpdateInput = {};
  if (body.tableNumber !== undefined) data.tableNumber = body.tableNumber;
  if (body.result !== undefined) {
    // Bye (sem participantB) só pode continuar BYE -- não faz sentido lançar
    // vitória/derrota/empate pra um confronto sem adversário de verdade.
    if (!match.participantBId && body.result !== HostedEventMatchResult.BYE) {
      return res.status(400).json({ error: "Confronto sem adversário só pode ter resultado de bye." });
    }
    data.result = body.result;
    data.reportedAt = body.result === HostedEventMatchResult.PENDING ? null : new Date();
  }
  const updated = await prisma.hostedEventMatch.update({ where: { id: match.id }, data, include: hostedEventMatchInclude });
  res.json(updated);
});

app.delete("/api/hosted-events/:id/rounds/:roundId/matches/:matchId", authRequired, hosterRequired, async (req: RequestWithUser, res) => {
  const event = await loadOwnedHostedEvent(req, res, String(req.params.id));
  if (!event) return;
  const round = await prisma.hostedEventRound.findFirst({ where: { id: String(req.params.roundId), eventId: event.id } });
  if (!round) return res.status(404).json({ error: "Rodada não encontrada." });
  const match = await prisma.hostedEventMatch.findFirst({ where: { id: String(req.params.matchId), roundId: round.id } });
  if (!match) return res.status(404).json({ error: "Confronto não encontrado." });
  await prisma.hostedEventMatch.delete({ where: { id: match.id } });
  res.status(204).send();
});

/* ---------------------------------------------------------------------------
 * Motor de regras de deck (Pacote A) — lógica pura em server/deck-legality.ts
 * (testável sem subir o Express). Aqui só a parte que precisa do Prisma.
 * ------------------------------------------------------------------------- */
async function loadDeckLegalityData(): Promise<DeckLegalityData> {
  const [models, groups] = await Promise.all([
    prisma.cardModel.findMany({ where: { isActive: true, OR: [{ legalityStatus: "banned" }, { legalityStatus: "restricted" }] }, select: { id: true, legalityStatus: true, restrictedCopies: true } }),
    prisma.cardBanGroup.findMany({ where: { isActive: true }, include: { members: { where: { isActive: true }, select: { id: true } } } }),
  ]);
  const banned = new Set<string>(models.filter((m: any) => m.legalityStatus === "banned").map((m: any) => m.id as string));
  const restricted = new Map<string, number>(models.filter((m: any) => m.legalityStatus === "restricted").map((m: any) => [m.id as string, (m.restrictedCopies ?? 2) as number]));
  const banGroups = new Map<string, { label: string; maxDistinct: number; memberIds: Set<string> }>(
    groups.map((g: any) => [g.id as string, { label: g.label as string, maxDistinct: g.maxDistinct as number, memberIds: new Set<string>(g.members.map((m: any) => m.id as string)) }]),
  );
  return { banned, restricted, banGroups };
}

app.get("/api/decks/legality", async (_req, res) => {
  setPublicCache(res, 60, 300);
  const legality = await loadDeckLegalityData();
  const [bannedModels, restrictedModels, groups] = await Promise.all([
    prisma.cardModel.findMany({ where: { id: { in: [...legality.banned] } }, select: { id: true, code: true, nameEn: true, namePt: true } }),
    prisma.cardModel.findMany({ where: { id: { in: [...legality.restricted.keys()] } }, select: { id: true, code: true, nameEn: true, namePt: true, restrictedCopies: true } }),
    prisma.cardBanGroup.findMany({ where: { isActive: true }, include: { members: { where: { isActive: true }, select: { id: true, code: true, nameEn: true, namePt: true } } } }),
  ]);
  res.json({
    rules: { mainSize: DECK_MAIN_SIZE, resourceSize: DECK_RESOURCE_SIZE, maxColors: DECK_MAX_COLORS, maxCopiesDefault: DECK_MAX_COPIES_DEFAULT },
    banned: bannedModels,
    restricted: restrictedModels,
    banGroups: groups.map((g) => ({ id: g.id, label: g.label, maxDistinct: g.maxDistinct, note: g.note, members: g.members })),
  });
});

function attachDeckLegality(deck: any, legality: DeckLegalityData) {
  const items = (deck.items || []).map((item: any) => ({
    cardModelId: item.card?.cardModelId ?? null,
    cardType: item.card?.cardType ?? "",
    color: item.card?.color ?? null,
    quantity: item.quantity,
    section: item.section || "main",
  }));
  return { ...deck, legality: computeDeckLegality(items, legality) };
}

/** Resolve featuredCardIds (ids de CardModel, escolhidos como "estilo visual" do deck)
 *  pra imagem+nome de exibição — usado pra montar a capa dividida em duas metades (ver
 *  DeckListPage/DeckbuilderPage). Busca em lote pra não fazer 1 query por deck quando
 *  a rota devolve uma lista inteira. */
async function enrichDecksWithFeaturedCards(decks: any[], legality: DeckLegalityData) {
  const allIds = [...new Set(decks.flatMap((deck) => deck.featuredCardIds || []))];
  const models = allIds.length
    ? await prisma.cardModel.findMany({
        where: { id: { in: allIds } },
        include: { prints: { where: { isActive: true }, orderBy: [{ isPrimaryPrint: "desc" }, { createdAt: "asc" }], take: 1 } },
      })
    : [];
  const byId = new Map(models.map((model: any) => [model.id, { id: model.id, name: model.namePt || model.nameEn, imageUrl: model.prints[0]?.imageMediumUrl || model.prints[0]?.imageUrl || null }]));
  return decks.map((deck) => ({
    ...attachDeckLegality(deck, legality),
    featuredCards: (deck.featuredCardIds || []).map((id: string) => byId.get(id)).filter(Boolean),
  }));
}

app.get("/api/decks/public", async (req, res) => {
  setPublicCache(res, 15, 60);
  const pagination = getPagination(req.query, { pageSize: 12, maxPageSize: 50 });
  const q = normalizeQueryValue(req.query.q);
  const sort = normalizeQueryValue(req.query.sort) || "recent";
  const where: Prisma.DeckWhereInput = {
    visibility: "PUBLIC" as const,
    ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { user: { is: { displayName: { contains: q, mode: "insensitive" } } } }] } : {}),
  };
  const orderBy: Prisma.DeckOrderByWithRelationInput =
    sort === "name_asc" ? { name: "asc" } : sort === "name_desc" ? { name: "desc" } : sort === "oldest" ? { createdAt: "asc" } : { updatedAt: "desc" };
  const legality = await loadDeckLegalityData();

  if (pagination.enabled) {
    const [items, total] = await Promise.all([
      prisma.deck.findMany({
        where,
        include: { user: true, items: { include: { card: true } } },
        orderBy,
        skip: pagination.skip,
        take: pagination.take,
      }),
      prisma.deck.count({ where }),
    ]);
    return res.json({ items: await enrichDecksWithFeaturedCards(items, legality), page: pagination.page, pageSize: pagination.pageSize, total, totalPages: Math.max(1, Math.ceil(total / pagination.pageSize)) });
  }

  const decks = await prisma.deck.findMany({
    where,
    include: { user: true, items: { include: { card: true } } },
    orderBy,
  });
  res.json(await enrichDecksWithFeaturedCards(decks, legality));
});

app.get("/api/decks/share/:shareId", async (req, res) => {
  setPublicCache(res, 20, 90);
  const shareId = String(req.params.shareId);
  const deck = await prisma.deck.findUnique({
    where: { shareId },
    include: { user: true, items: { include: { card: true } } },
  });
  if (!deck || deck.visibility === "PRIVATE") return res.status(404).json({ error: "Deck não encontrado." });
  const legality = await loadDeckLegalityData();
  res.json((await enrichDecksWithFeaturedCards([deck], legality))[0]);
});

app.get("/api/decks/me", authRequired, async (req: RequestWithUser, res) => {
  setPrivateCache(res, 10, 30);
  const pagination = getPagination(req.query, { pageSize: 12, maxPageSize: 50 });
  const where = { userId: req.user!.userId };
  const legality = await loadDeckLegalityData();

  if (pagination.enabled) {
    const [items, total] = await Promise.all([
      prisma.deck.findMany({
        where,
        include: { items: { include: { card: true } } },
        orderBy: [{ updatedAt: "desc" }],
        skip: pagination.skip,
        take: pagination.take,
      }),
      prisma.deck.count({ where }),
    ]);
    return res.json({ items: await enrichDecksWithFeaturedCards(items, legality), page: pagination.page, pageSize: pagination.pageSize, total, totalPages: Math.max(1, Math.ceil(total / pagination.pageSize)) });
  }

  const decks = await prisma.deck.findMany({
    where,
    include: { items: { include: { card: true } } },
    orderBy: [{ updatedAt: "desc" }],
  });
  res.json(await enrichDecksWithFeaturedCards(decks, legality));
});

app.get("/api/decks/me/:id", authRequired, async (req: RequestWithUser, res) => {
  setPrivateCache(res, 10, 30);
  const deck = await prisma.deck.findFirst({
    where: { id: String(req.params.id), userId: req.user!.userId },
    include: { items: { include: { card: true } } },
  });
  if (!deck) return res.status(404).json({ error: "Deck não encontrado." });
  const legality = await loadDeckLegalityData();
  res.json((await enrichDecksWithFeaturedCards([deck], legality))[0]);
});

/** Confere que todo cardId do payload é uma impressão (Card) de verdade antes de
 *  tentar gravar — sem isso, um id inválido (ex: id de CardModel por engano, como
 *  o deckbuilder mandava antes da correção da Fase B1) só aparecia como erro 500
 *  cru de violação de chave estrangeira no Postgres. */
async function findInvalidDeckCardIds(items: Array<{ cardId: string }>): Promise<string[]> {
  const ids = [...new Set(items.map((item) => item.cardId))];
  if (!ids.length) return [];
  const found = await prisma.card.findMany({ where: { id: { in: ids } }, select: { id: true } });
  const foundIds = new Set(found.map((card) => card.id));
  return ids.filter((id) => !foundIds.has(id));
}

/** Garante 10 recursos sempre, no servidor -- rede de seguranca independente do
 * auto-preenchimento do client (DeckbuilderPage.tsx), que so roda dentro do editor.
 * Sem isso, um deck que chegou aqui por outro caminho (corrida entre salvar rapido
 * demais e o efeito do client ainda nao ter rodado, importacao, etc) fica salvo com
 * resource incompleto pra sempre, aparecendo "pendente" na lista sem o usuario saber
 * por que (a contagem de recurso nem aparece mais na tela, so o principal). Mesma
 * logica de completar a diferenca com a arte de menor codigo, ja testada isolada
 * quando construi a versao do client. */
async function topUpDeckResources(items: Array<{ cardId: string; quantity: number; section?: string }>): Promise<Array<{ cardId: string; quantity: number; section?: string }>> {
  const resourceTotal = items.filter((item) => (item.section ?? "main") === "resource").reduce((sum, item) => sum + item.quantity, 0);
  const missing = DECK_RESOURCE_SIZE - resourceTotal;
  if (missing <= 0) return items;
  const defaultResource = await prisma.card.findFirst({ where: { cardType: "RESOURCE", isActive: true }, orderBy: { code: "asc" }, select: { id: true } });
  if (!defaultResource) return items; // catalogo sem resource cadastrado -- nada a fazer, nao trava o salvamento por isso
  const existingIndex = items.findIndex((item) => (item.section ?? "main") === "resource" && item.cardId === defaultResource.id);
  if (existingIndex >= 0) {
    return items.map((item, i) => (i === existingIndex ? { ...item, quantity: item.quantity + missing } : item));
  }
  return [...items, { cardId: defaultResource.id, quantity: missing, section: "resource" }];
}

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
  const invalidIds = await findInvalidDeckCardIds(items || []);
  if (invalidIds.length) return res.status(400).json({ error: `Carta(s) inválida(s) no deck: ${invalidIds.join(", ")}. Recarregue a página e tente de novo.` });
  const completeItems = await topUpDeckResources(items || []);
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
      items: { create: completeItems.map((item) => ({ cardId: item.cardId, quantity: item.quantity, section: item.section ?? "main" })) },
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
  const invalidIds = await findInvalidDeckCardIds(items || []);
  if (invalidIds.length) return res.status(400).json({ error: `Carta(s) inválida(s) no deck: ${invalidIds.join(", ")}. Recarregue a página e tente de novo.` });
  if (isPrimary) await prisma.deck.updateMany({ where: { userId: req.user!.userId }, data: { isPrimary: false } });
  await prisma.deckItem.deleteMany({ where: { deckId } });
  const completeItems = await topUpDeckResources(items || []);
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
      items: { create: completeItems.map((item) => ({ cardId: item.cardId, quantity: item.quantity, section: item.section ?? "main" })) },
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

/* ---------------------------------------------------------------------------
 * Simulador — passo 4 (docs/18-simulador-fase1-motor-e-dsl.md). Wave
 * original (2026-08-29): sandbox restrito a admin/hoster, criação/entrada
 * manual de partida. Wave "Simulador Beta" (2026-08-30, decisão do Willen):
 * aberto a QUALQUER usuário logado, 1 fila de matchmaking automática (cada
 * jogador só escolhe o próprio deck — ST01/ST02, qualquer combinação — e
 * espera; ao ter 2 na fila, a partida é criada e os 2 assentos preenchidos
 * sozinhos), timer de 90s por decisão (o servidor age sozinho se estourar,
 * ver `matchStore.ts`) e W.O. por abandono depois de 3min sem sinal de vida
 * do oponente (nunca automático — só destrava um botão pro outro lado).
 *
 * As rotas de criar/entrar manualmente numa partida específica continuam
 * existindo (usadas internamente pelo pareamento da fila, e como fallback
 * de depuração), mas ficam `hosterRequired` — não fazem mais parte do fluxo
 * normal de um jogador, que agora é só a fila.
 *
 * O motor real (`GameState`) nunca sai daqui — só a visão redigida de cada
 * jogador mais os metadados de partida (timer/presença), via `MatchView`
 * (ver `matchViewFor`, `src/modules/simulator/server/matchStore.ts`).
 * ------------------------------------------------------------------------- */

const SIMULATOR_DECKS: Record<string, () => DeckList> = {
  ST01: buildSt01DeckList,
  ST02: buildSt02DeckList,
};

function resolveDeckKey(raw: unknown): { key: string; build: () => DeckList } | null {
  const key = typeof raw === "string" ? raw.toUpperCase() : "";
  const build = SIMULATOR_DECKS[key];
  return build ? { key, build } : null;
}

function matchSummary(match: ReturnType<typeof getMatch>) {
  if (!match) return null;
  return {
    id: match.id,
    seats: {
      A: match.seats.A ? { userId: match.seats.A.userId, displayName: match.seats.A.displayName } : null,
      B: match.seats.B ? { userId: match.seats.B.userId, displayName: match.seats.B.displayName } : null,
    },
    deckKeys: match.deckKeys,
    turnNumber: match.state.turnNumber,
    activePlayer: match.state.activePlayer,
    phase: match.state.phase,
    gameOver: match.state.gameOver,
    createdAt: match.createdAt,
    updatedAt: match.updatedAt,
    version: match.version,
  };
}

// --- Fila de matchmaking ("Simulador Beta") — qualquer usuário logado. ---

app.post("/api/simulator/queue/join", authRequired, (req: RequestWithUser, res) => {
  const body = req.body as { deck?: string };
  const resolved = resolveDeckKey(body.deck);
  if (!resolved) return res.status(400).json({ error: `Deck inválido — use um de: ${Object.keys(SIMULATOR_DECKS).join(", ")}.` });
  const status = joinQueue({ userId: req.user!.userId, displayName: req.user!.username, deckKey: resolved.key, deckList: resolved.build() });
  res.json(status);
});

app.post("/api/simulator/queue/leave", authRequired, (req: RequestWithUser, res) => {
  leaveQueue(req.user!.userId);
  res.json({ ok: true });
});

app.get("/api/simulator/queue/status", authRequired, (req: RequestWithUser, res) => {
  res.json(queueStatusFor(req.user!.userId));
});

// --- Partida em andamento — qualquer usuário logado que já ocupa um assento nela. ---

app.get("/api/simulator/matches/:id", authRequired, (req: RequestWithUser, res) => {
  const match = getMatch(String(req.params.id));
  if (!match) return res.status(404).json({ error: "Partida não encontrada." });
  const seat = seatFor(match, req.user!.userId);
  if (!seat) return res.json({ seated: false, ...matchSummary(match) });
  res.json({ seated: true, ...matchViewFor(match, seat) });
});

app.post("/api/simulator/matches/:id/actions", authRequired, (req: RequestWithUser, res) => {
  const action = req.body as PlayerAction;
  if (!action || typeof action !== "object" || typeof action.kind !== "string") {
    return res.status(400).json({ error: "Ação inválida." });
  }
  try {
    const match = applyAction(String(req.params.id), req.user!.userId, action);
    const seat = seatFor(match, req.user!.userId)!;
    res.json(matchViewFor(match, seat));
  } catch (err) {
    if (err instanceof MatchError) return res.status(err.status).json({ error: err.message });
    throw err;
  }
});

// Heartbeat de presença — o cliente chama isso periodicamente enquanto a aba está visível
// (ver SimulatorSandboxPage.tsx). Alimenta o W.O. por abandono (matchStore.claimAbandonWin).
app.post("/api/simulator/matches/:id/ping", authRequired, (req: RequestWithUser, res) => {
  try {
    const match = touchPresence(String(req.params.id), req.user!.userId);
    const seat = seatFor(match, req.user!.userId)!;
    res.json(matchViewFor(match, seat));
  } catch (err) {
    if (err instanceof MatchError) return res.status(err.status).json({ error: err.message });
    throw err;
  }
});

// Ferramenta in-game "Reportar Situação de Regra" (docs/19, Sessão 4) — loga o
// GameState real + histórico no console do servidor pra diagnóstico. Não persiste.
app.post("/api/simulator/matches/:id/report", authRequired, (req: RequestWithUser, res) => {
  const note = typeof (req.body as { note?: unknown })?.note === "string" ? (req.body as { note: string }).note.slice(0, 2000) : undefined;
  try {
    res.json(reportSituation(String(req.params.id), req.user!.userId, note));
  } catch (err) {
    if (err instanceof MatchError) return res.status(err.status).json({ error: err.message });
    throw err;
  }
});

// Liga/desliga o auto-pass de Action Step do assento do usuário (docs/19, Sessão 2).
app.post("/api/simulator/matches/:id/auto-pass", authRequired, (req: RequestWithUser, res) => {
  const value = (req.body as { value?: unknown })?.value;
  if (typeof value !== "boolean") return res.status(400).json({ error: "`value` precisa ser booleano." });
  try {
    const match = setAutoPass(String(req.params.id), req.user!.userId, value);
    const seat = seatFor(match, req.user!.userId)!;
    res.json(matchViewFor(match, seat));
  } catch (err) {
    if (err instanceof MatchError) return res.status(err.status).json({ error: err.message });
    throw err;
  }
});

app.post("/api/simulator/matches/:id/claim-abandon-win", authRequired, (req: RequestWithUser, res) => {
  try {
    const match = claimAbandonWin(String(req.params.id), req.user!.userId);
    const seat = seatFor(match, req.user!.userId)!;
    res.json(matchViewFor(match, seat));
  } catch (err) {
    if (err instanceof MatchError) return res.status(err.status).json({ error: err.message });
    throw err;
  }
});

// "Sair da partida" -> desistência imediata (concede a vitória ao oponente). Ver matchStore.resignMatch.
app.post("/api/simulator/matches/:id/resign", authRequired, (req: RequestWithUser, res) => {
  try {
    const match = resignMatch(String(req.params.id), req.user!.userId);
    const seat = seatFor(match, req.user!.userId)!;
    res.json(matchViewFor(match, seat));
  } catch (err) {
    if (err instanceof MatchError) return res.status(err.status).json({ error: err.message });
    throw err;
  }
});

// EventSource não manda header Authorization -> authFromQueryOrHeader (ver definição acima).
app.get("/api/simulator/matches/:id/stream", authFromQueryOrHeader, (req: RequestWithUser, res) => {
  const match = getMatch(String(req.params.id));
  if (!match) return res.status(404).json({ error: "Partida não encontrada." });
  const seat = seatFor(match, req.user!.userId);
  if (!seat) return res.status(403).json({ error: "Entre num assento (join) antes de abrir o stream." });

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  send("state", matchViewFor(match, seat));

  const unsubscribe = subscribe(match.id, (views) => send("state", views[seat]));
  // mantém a conexão viva através de proxies que fecham stream ocioso
  const heartbeat = setInterval(() => res.write(": heartbeat\n\n"), 20000);

  req.on("close", () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
});

// --- Depuração/admin: criar ou entrar numa partida específica manualmente (fora da fila). ---

app.get("/api/simulator/matches", authRequired, hosterRequired, (_req, res) => {
  res.json(listMatches().map((m) => matchSummary(m)));
});

app.post("/api/simulator/matches", authRequired, hosterRequired, (req: RequestWithUser, res) => {
  const body = req.body as { deckA?: string; deckB?: string; firstPlayer?: PlayerId; seed?: number };
  const deckA = resolveDeckKey(body.deckA || "ST01");
  const deckB = resolveDeckKey(body.deckB || "ST02");
  if (!deckA || !deckB) {
    return res.status(400).json({ error: `Deck inválido — use um de: ${Object.keys(SIMULATOR_DECKS).join(", ")}.` });
  }
  const match = createMatch({
    deckA: deckA.build(),
    deckB: deckB.build(),
    firstPlayer: body.firstPlayer === "B" ? "B" : "A",
    seed: typeof body.seed === "number" ? body.seed : undefined,
  });
  match.deckKeys = { A: deckA.key, B: deckB.key };
  res.status(201).json(matchSummary(match));
});

app.post("/api/simulator/matches/:id/join", authRequired, hosterRequired, (req: RequestWithUser, res) => {
  const body = req.body as { seat?: PlayerId };
  if (body.seat !== "A" && body.seat !== "B") return res.status(400).json({ error: "seat precisa ser 'A' ou 'B'." });
  try {
    const match = joinMatch(String(req.params.id), body.seat, { userId: req.user!.userId, displayName: req.user!.username });
    const seat = seatFor(match, req.user!.userId)!;
    res.json({ seated: true, ...matchViewFor(match, seat) });
  } catch (err) {
    if (err instanceof MatchError) return res.status(err.status).json({ error: err.message });
    throw err;
  }
});

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(error);
  res.status(500).json({ error: "Erro interno da API." });
});

async function boot() {
  try {
    await ensureAdminSeed();
  } catch (error: any) {
    // Schema realmente fora de sincronia com o banco é fatal de verdade — servir tráfego
    // nesse estado só geraria erro 500 em cascata em qualquer rota, então aí sim vale
    // derrubar o processo cedo com uma mensagem clara, sem chamar app.listen().
    if (error?.code === "P2022" || error?.code === "P2021") {
      console.error("Falha ao iniciar API: o schema do banco está defasado em relação ao prisma/schema.prisma.");
      console.error("Use `pnpm dev:api` para sincronizar automaticamente ou rode `pnpm prisma:push` antes do modo raw.");
      await prisma.$disconnect();
      process.exit(1);
    }
    // Qualquer outra falha no bootstrap opcional do admin seed (ex.: um erro transitório
    // de conexão) não deve derrubar a API inteira — só loga e segue pro app.listen() abaixo.
    // Antes, qualquer rejeição aqui impedia o app.listen() de rodar, deixando a API inteira
    // fora do ar (nenhum request chegava a receber resposta) sem nenhum sinal claro do motivo.
    console.error("Aviso: ensureAdminSeed falhou, API vai subir mesmo assim.", error);
  }
  app.listen(PORT, () => {
    console.log(`API pronta em http://localhost:${PORT}`);
  });
}

boot();
