import "dotenv/config";

import bcrypt from "bcryptjs";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import fs from "node:fs";
import path from "node:path";
import jwt from "jsonwebtoken";
import multer from "multer";
import { PrismaClient, UserRole, Prisma } from "@prisma/client";

const prisma = new PrismaClient();
const app = express();
const PORT = Number(process.env.API_PORT ?? 8787);
const JWT_SECRET = process.env.JWT_SECRET || "change-this-secret";
const uploadDir = path.resolve(process.cwd(), "public/uploads/cards");
fs.mkdirSync(uploadDir, { recursive: true });

app.use(cors());
app.use(express.json({ limit: "4mb" }));
app.use("/uploads", express.static(path.resolve(process.cwd(), "public/uploads")));

const upload = multer({ dest: uploadDir });

type AuthPayload = {
  userId: string;
  role: UserRole;
  email: string;
  username: string;
};

type RequestWithUser = Request & { user?: AuthPayload };

type CardInput = {
  code: string;
  nameEn: string;
  namePt?: string;
  cardType: string;
  color?: string;
  cost?: number;
  level?: number;
  ap?: number;
  hp?: number;
  rarity?: string;
  trait?: string;
  series?: string;
  effectEn?: string;
  effectPt?: string;
  keywordTags?: string[];
  imageUrl?: string | null;
  imageSourceUrl?: string | null;
  thumbUrl?: string | null;
  officialUrl?: string | null;
  setId?: string | null;
};

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

function normalizeQueryValue(input: unknown) {
  return String(input ?? "").trim();
}

function parsePositiveInt(input: unknown, fallback: number, max = 100) {
  const value = Number.parseInt(String(input ?? ""), 10);
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.min(value, max);
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

async function ensureAdminSeed() {
  const email = process.env.SEED_ADMIN_EMAIL ?? "admin@gundambr.local";
  const password = process.env.SEED_ADMIN_PASSWORD ?? "admin123";
  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.upsert({
    where: { email },
    update: { passwordHash },
    create: {
      email,
      username: "admin-portal",
      displayName: "Administrador Portal BR",
      passwordHash,
      role: UserRole.ADMIN,
      bio: "Conta seed administrativa do portal.",
    },
  });
}

app.get("/api/health", async (_req, res) => {
  setPublicCache(res, 15, 60);
  const [userCount, cardCount, deckCount] = await Promise.all([
    prisma.user.count(),
    prisma.card.count(),
    prisma.deck.count(),
  ]);
  res.json({ ok: true, runtime: "prisma", userCount, cardCount, deckCount });
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
    data: { email, displayName, username, passwordHash, role: UserRole.USER },
  });
  const token = signToken({ userId: user.id, role: user.role, email: user.email, username: user.username });
  res.status(201).json({ token, user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role, username: user.username, bio: user.bio, avatarUrl: user.avatarUrl } });
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) return res.status(400).json({ error: "Email e senha são obrigatórios." });
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) return res.status(401).json({ error: "Credenciais inválidas." });
  const token = signToken({ userId: user.id, role: user.role, email: user.email, username: user.username });
  res.json({ token, user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role, username: user.username, bio: user.bio, avatarUrl: user.avatarUrl } });
});

app.get("/api/auth/me", authRequired, async (req: RequestWithUser, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  if (!user) return res.status(404).json({ error: "Usuário não encontrado." });
  const [deckCount, publicDeckCount] = await Promise.all([
    prisma.deck.count({ where: { userId: user.id } }),
    prisma.deck.count({ where: { userId: user.id, visibility: "PUBLIC" } }),
  ]);
  res.json({ id: user.id, email: user.email, displayName: user.displayName, username: user.username, role: user.role, bio: user.bio, avatarUrl: user.avatarUrl, stats: { deckCount, publicDeckCount } });
});

app.put("/api/auth/me", authRequired, async (req: RequestWithUser, res) => {
  const { displayName, bio, avatarUrl } = req.body as { displayName?: string; bio?: string; avatarUrl?: string };
  const user = await prisma.user.update({ where: { id: req.user!.userId }, data: { displayName, bio, avatarUrl } });
  res.json({ id: user.id, email: user.email, displayName: user.displayName, username: user.username, role: user.role, bio: user.bio, avatarUrl: user.avatarUrl });
});

app.get("/api/users/:username", async (req, res) => {
  setPublicCache(res, 20, 60);
  const username = String(req.params.username);
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) return res.status(404).json({ error: "Perfil não encontrado." });
  const decks = await prisma.deck.findMany({
    where: { userId: user.id, visibility: "PUBLIC" },
    include: { items: true },
    orderBy: { updatedAt: "desc" },
  });
  res.json({ id: user.id, username: user.username, displayName: user.displayName, bio: user.bio, avatarUrl: user.avatarUrl, decks });
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
  const sets = await prisma.cardSet.findMany({ include: { _count: { select: { cards: true } } }, orderBy: { code: "asc" } });
  res.json(sets);
});

app.get("/api/sets/:code", async (req, res) => {
  setPublicCache(res, 30, 120);
  const code = String(req.params.code);
  const set = await prisma.cardSet.findUnique({
    where: { code },
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
  const set = await prisma.cardSet.create({ data: req.body });
  res.status(201).json(set);
});

app.get("/api/cards", async (req, res) => {
  setPublicCache(res, 20, 90);
  const q = normalizeQueryValue(req.query.q ?? req.query.search);
  const color = normalizeQueryValue(req.query.color);
  const cardType = normalizeQueryValue(req.query.cardType);
  const series = normalizeQueryValue(req.query.series);
  const trait = normalizeQueryValue(req.query.trait);
  const keyword = normalizeQueryValue(req.query.keyword);
  const setCode = normalizeQueryValue(req.query.setCode);
  const sort = normalizeQueryValue(req.query.sort) || "code_asc";
  const pagination = getPagination(req.query, { pageSize: 24, maxPageSize: 80 });

  const where: Prisma.CardWhereInput = {
    AND: [
      q
        ? {
            OR: [
              { code: { contains: q, mode: "insensitive" } },
              { nameEn: { contains: q, mode: "insensitive" } },
              { namePt: { contains: q, mode: "insensitive" } },
              { series: { contains: q, mode: "insensitive" } },
              { trait: { contains: q, mode: "insensitive" } },
              { effectEn: { contains: q, mode: "insensitive" } },
              { effectPt: { contains: q, mode: "insensitive" } },
              { keywordTags: { has: q } },
            ],
          }
        : {},
      color ? { color: { equals: color, mode: "insensitive" } } : {},
      cardType ? { cardType: { equals: cardType, mode: "insensitive" } } : {},
      series ? { series: { contains: series, mode: "insensitive" } } : {},
      trait ? { trait: { contains: trait, mode: "insensitive" } } : {},
      keyword ? { keywordTags: { has: keyword } } : {},
      setCode ? { set: { is: { code: { equals: setCode, mode: "insensitive" } } } } : {},
    ],
  };

  const orderBy: Prisma.CardOrderByWithRelationInput[] =
    sort === "cost_asc"
      ? [{ cost: "asc" }, { code: "asc" }]
      : sort === "cost_desc"
        ? [{ cost: "desc" }, { code: "asc" }]
        : sort === "name_asc"
          ? [{ namePt: "asc" }, { nameEn: "asc" }]
          : sort === "updated_desc"
            ? [{ updatedAt: "desc" }]
            : [{ code: "asc" }];

  if (pagination.enabled) {
    const [items, total] = await Promise.all([
      prisma.card.findMany({
        where,
        include: { set: true, rulings: true },
        orderBy,
        skip: pagination.skip,
        take: pagination.take,
      }),
      prisma.card.count({ where }),
    ]);
    return res.json({ items, page: pagination.page, pageSize: pagination.pageSize, total, totalPages: Math.max(1, Math.ceil(total / pagination.pageSize)) });
  }

  const cards = await prisma.card.findMany({
    where,
    include: { set: true, rulings: true },
    orderBy,
  });
  res.json(cards);
});

app.get("/api/cards/filters", async (_req, res) => {
  setPublicCache(res, 300, 900);
  const [colorsRaw, typesRaw, seriesRaw, traitsRaw, sets] = await Promise.all([
    prisma.card.findMany({ select: { color: true }, distinct: ["color"], orderBy: { color: "asc" } }),
    prisma.card.findMany({ select: { cardType: true }, distinct: ["cardType"], orderBy: { cardType: "asc" } }),
    prisma.card.findMany({ select: { series: true }, distinct: ["series"], where: { series: { not: null } }, orderBy: { series: "asc" } }),
    prisma.card.findMany({ select: { trait: true }, distinct: ["trait"], where: { trait: { not: null } }, orderBy: { trait: "asc" } }),
    prisma.cardSet.findMany({ select: { code: true, namePt: true, nameEn: true, releaseDate: true }, orderBy: { code: "asc" } }),
  ]);

  const colors = colorsRaw.map((item) => item.color).filter(Boolean);
  const cardTypes = typesRaw.map((item) => item.cardType).filter(Boolean);
  const series = seriesRaw.map((item) => item.series).filter(Boolean);
  const traits = traitsRaw.map((item) => item.trait).filter(Boolean);
  const keywordSet = new Set<string>();
  const keywordRows = await prisma.card.findMany({ select: { keywordTags: true } });
  keywordRows.forEach((row) => row.keywordTags.forEach((tag) => keywordSet.add(tag)));

  res.json({ colors, cardTypes, series, traits, keywords: Array.from(keywordSet).sort(), sets });
});

app.get("/api/cards/:id", async (req, res) => {
  setPublicCache(res, 30, 120);
  const id = String(req.params.id);
  const card = await prisma.card.findUnique({ where: { id }, include: { set: true, rulings: true } });
  if (!card) return res.status(404).json({ error: "Carta não encontrada." });
  res.json(card);
});

app.post("/api/cards", authRequired, roleRequired([UserRole.ADMIN, UserRole.EDITOR]), async (req, res) => {
  const card = await prisma.card.create({ data: req.body as CardInput });
  res.status(201).json(card);
});

app.put("/api/cards/:id", authRequired, roleRequired([UserRole.ADMIN, UserRole.EDITOR]), async (req, res) => {
  const id = String(req.params.id);
  const card = await prisma.card.update({ where: { id }, data: req.body as CardInput });
  res.json(card);
});

app.delete("/api/cards/:id", authRequired, roleRequired([UserRole.ADMIN]), async (req, res) => {
  const id = String(req.params.id);
  await prisma.card.delete({ where: { id } });
  res.status(204).send();
});

app.post("/api/cards/upload-image", authRequired, roleRequired([UserRole.ADMIN, UserRole.EDITOR]), upload.single("image"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Arquivo não enviado." });
  res.status(201).json({ imageUrl: `/uploads/cards/${req.file.filename}`, imageSourceUrl: "manual_upload" });
});

app.post("/api/import/cards", authRequired, roleRequired([UserRole.ADMIN]), async (req, res) => {
  const payload = req.body as { cards?: CardInput[]; set?: { code: string; nameEn: string; namePt?: string; officialUrl?: string } };
  if (!payload.cards?.length) return res.status(400).json({ error: "Nenhuma carta enviada para importar." });

  let setId: string | undefined;
  if (payload.set) {
    const set = await prisma.cardSet.upsert({
      where: { code: payload.set.code },
      update: payload.set,
      create: payload.set,
    });
    setId = set.id;
  }

  for (const card of payload.cards) {
    await prisma.card.upsert({
      where: { code: card.code },
      update: { ...card, setId },
      create: { ...card, setId },
    });
  }

  res.json({ imported: payload.cards.length, setId: setId ?? null });
});

app.post("/api/import/rulings", authRequired, roleRequired([UserRole.ADMIN]), async (req, res) => {
  const payload = req.body as { rulings?: Array<Record<string, unknown>> };
  if (!payload.rulings?.length) return res.status(400).json({ error: "Nenhuma ruling enviada para importar." });

  for (const ruling of payload.rulings) {
    await prisma.ruling.create({ data: ruling as any });
  }
  res.json({ imported: payload.rulings.length });
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
  await prisma.ruling.delete({ where: { id } });
  res.status(204).send();
});

app.get("/api/tournaments", async (_req, res) => {
  setPublicCache(res, 20, 90);
  const events = await prisma.tournament.findMany({ include: { entries: true }, orderBy: [{ dateStart: "desc" }] });
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
  await prisma.tournament.delete({ where: { id } });
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
  const { name, format, visibility, notes, isPrimary, items } = req.body as {
    name: string;
    format: string;
    visibility: "PRIVATE" | "UNLISTED" | "PUBLIC";
    notes?: string;
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
      isPrimary: Boolean(isPrimary),
      items: { create: items.map((item) => ({ cardId: item.cardId, quantity: item.quantity, section: item.section ?? "main" })) },
    },
    include: { items: true },
  });
  res.status(201).json(deck);
});

app.put("/api/decks/me/:id", authRequired, async (req: RequestWithUser, res) => {
  const deckId = String(req.params.id);
  const { name, format, visibility, notes, isPrimary, items } = req.body as {
    name: string;
    format: string;
    visibility: "PRIVATE" | "UNLISTED" | "PUBLIC";
    notes?: string;
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
