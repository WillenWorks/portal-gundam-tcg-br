import "dotenv/config";

import bcrypt from "bcryptjs";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import jwt from "jsonwebtoken";
import multer from "multer";
import { PrismaClient, UserRole, Prisma, CardLanguage, CardType, SetKind, TaxonomyKind, CardRelationType } from "@prisma/client";
import { OAuth2Client } from "google-auth-library";
import { parseCardEffects } from "../src/lib/gundam-card-effects.ts";
import { DECK_MAIN_SIZE, DECK_RESOURCE_SIZE, DECK_MAX_COLORS, DECK_MAX_COPIES_DEFAULT, computeDeckLegality, type DeckLegalityData } from "../src/lib/deck-legality.ts";

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
  if (!file.buffer?.l