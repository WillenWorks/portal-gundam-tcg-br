import "dotenv/config";

import bcrypt from "bcryptjs";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import jwt from "jsonwebtoken";
import { PrismaClient, UserRole } from "@prisma/client";

const prisma = new PrismaClient();
const app = express();
const PORT = Number(process.env.API_PORT ?? 8787);
const JWT_SECRET = process.env.JWT_SECRET || "change-this-secret";

app.use(cors());
app.use(express.json({ limit: "1mb" }));

type AuthPayload = {
  userId: string;
  role: UserRole;
  email: string;
};

type RequestWithUser = Request & { user?: AuthPayload };

function signToken(payload: AuthPayload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

function authRequired(req: RequestWithUser, res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token ausente." });
  }

  const token = auth.slice(7);

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

async function ensureAdminSeed() {
  const email = process.env.SEED_ADMIN_EMAIL ?? "admin@gundambr.local";
  const password = process.env.SEED_ADMIN_PASSWORD ?? "admin123";
  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      displayName: "Administrador Portal BR",
      passwordHash,
      role: UserRole.ADMIN,
    },
  });
}

app.get("/api/health", async (_req, res) => {
  const userCount = await prisma.user.count();
  res.json({ ok: true, userCount, runtime: "prisma" });
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) return res.status(400).json({ error: "Email e senha são obrigatórios." });

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(401).json({ error: "Credenciais inválidas." });

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(401).json({ error: "Credenciais inválidas." });

  const token = signToken({ userId: user.id, role: user.role, email: user.email });
  res.json({
    token,
    user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role },
  });
});

app.get("/api/auth/me", authRequired, async (req: RequestWithUser, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  if (!user) return res.status(404).json({ error: "Usuário não encontrado." });
  res.json({ id: user.id, email: user.email, displayName: user.displayName, role: user.role });
});

app.get("/api/cards", async (_req, res) => {
  const cards = await prisma.card.findMany({ orderBy: [{ code: "asc" }] });
  res.json(cards);
});

app.post("/api/cards", authRequired, roleRequired([UserRole.ADMIN, UserRole.EDITOR]), async (req, res) => {
  const card = await prisma.card.create({ data: req.body });
  res.status(201).json(card);
});

app.put("/api/cards/:id", authRequired, roleRequired([UserRole.ADMIN, UserRole.EDITOR]), async (req, res) => {
  const id = String(req.params.id);
  const card = await prisma.card.update({ where: { id }, data: req.body });
  res.json(card);
});

app.delete("/api/cards/:id", authRequired, roleRequired([UserRole.ADMIN]), async (req, res) => {
  const id = String(req.params.id);
  await prisma.card.delete({ where: { id } });
  res.status(204).send();
});

app.get("/api/rulings", async (_req, res) => {
  const rulings = await prisma.ruling.findMany({ orderBy: [{ createdAt: "desc" }] });
  res.json(rulings);
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
  const events = await prisma.tournament.findMany({ orderBy: [{ dateStart: "desc" }] });
  res.json(events);
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

app.get("/api/decks/me", authRequired, async (req: RequestWithUser, res) => {
  const decks = await prisma.deck.findMany({
    where: { userId: req.user!.userId },
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

  if (isPrimary) {
    await prisma.deck.updateMany({ where: { userId: req.user!.userId }, data: { isPrimary: false } });
  }

  const deck = await prisma.deck.create({
    data: {
      userId: req.user!.userId,
      name,
      format,
      visibility,
      notes,
      isPrimary: Boolean(isPrimary),
      items: {
        create: items.map((item) => ({
          cardId: item.cardId,
          quantity: item.quantity,
          section: item.section ?? "main",
        })),
      },
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

  if (isPrimary) {
    await prisma.deck.updateMany({ where: { userId: req.user!.userId }, data: { isPrimary: false } });
  }

  await prisma.deckItem.deleteMany({ where: { deckId } });

  const deck = await prisma.deck.update({
    where: { id: deckId },
    data: {
      name,
      format,
      visibility,
      notes,
      isPrimary: Boolean(isPrimary),
      items: {
        create: items.map((item) => ({
          cardId: item.cardId,
          quantity: item.quantity,
          section: item.section ?? "main",
        })),
      },
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

async function start() {
  await ensureAdminSeed();
  app.listen(PORT, () => {
    console.log(`API online na porta ${PORT}`);
  });
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
