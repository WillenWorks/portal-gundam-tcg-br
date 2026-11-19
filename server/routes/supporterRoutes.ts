import type { Express, Request, RequestHandler, Response } from "express";
import type { PrismaClient } from "@prisma/client";
import { UserRole } from "@prisma/client";
import { isSupporterTier, normalizeUserTags, supporterTierRank } from "../../src/lib/supporters.ts";

/**
 * Apoiadores e tags de usuário.
 * - Mural público (/api/support/supporters): contas marcadas como apoiadoras + nomes cadastrados à mão para quem
 *   apoia pelo Apoia.se sem conta no site. Patente mais alta primeiro.
 * - "Já apoiei" (/api/support/confirm): vira PEDIDO (supporterClaimedAt); o selo só aparece quando o admin aprova.
 *   Antes o próprio pedido dava o selo, e o selo é recompensa paga da campanha.
 * - Admin (/api/admin/supporters…): aprovar/recusar pedidos, definir patente e tags de qualquer conta, mural sem conta.
 */

type Deps = {
  prisma: PrismaClient;
  authRequired: RequestHandler;
  roleRequired: (roles: UserRole[]) => RequestHandler;
  /** sessão em cache da pessoa: mudança vale na próxima requisição */
  invalidateSession: (userId: string) => void;
  /** conta da requisição (o authRequired já validou o token) */
  currentUserId: (req: Request) => string | undefined;
};

const MONTH = new Intl.DateTimeFormat("pt-BR", { month: "short", year: "numeric" });
const text = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");

export type PublicSupporter = {
  name: string;
  username?: string;
  tier: string | null;
  sinceMonth?: string;
  message?: string;
};

/** Mural: contas apoiadoras + nomes sem conta; patente mais alta primeiro, depois quem apoia há mais tempo. */
export async function listPublicSupporters(prisma: PrismaClient): Promise<PublicSupporter[]> {
  const [users, wall] = await Promise.all([
    prisma.user.findMany({
      where: { isSupporter: true, isActive: true },
      select: { displayName: true, username: true, supporterSince: true, supporterMessage: true, supporterTier: true },
    }),
    prisma.supporterWallEntry.findMany({ where: { isActive: true }, select: { displayName: true, since: true, message: true, tier: true } }),
  ]);
  const rows = [
    ...users.map((u) => ({ name: u.displayName || u.username, username: u.username, tier: u.supporterTier, since: u.supporterSince, message: u.supporterMessage })),
    ...wall.map((w) => ({ name: w.displayName, username: undefined, tier: w.tier, since: w.since, message: w.message })),
  ];
  rows.sort((a, b) => supporterTierRank(b.tier) - supporterTierRank(a.tier) || (a.since?.getTime() ?? Infinity) - (b.since?.getTime() ?? Infinity));
  return rows.map((r) => ({
    name: r.name,
    ...(r.username ? { username: r.username } : {}),
    tier: isSupporterTier(r.tier) ? r.tier : null,
    ...(r.since ? { sinceMonth: MONTH.format(r.since) } : {}),
    ...(r.message ? { message: r.message } : {}),
  }));
}

const ADMIN_USER_SELECT = {
  id: true,
  username: true,
  displayName: true,
  email: true,
  avatarUrl: true,
  isSupporter: true,
  supporterTier: true,
  supporterSince: true,
  supporterMessage: true,
  supporterClaimedAt: true,
  discordUsername: true,
  tags: { select: { tag: true } },
} as const;

type AdminUserRow = {
  id: string;
  username: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
  isSupporter: boolean;
  supporterTier: string | null;
  supporterSince: Date | null;
  supporterMessage: string | null;
  supporterClaimedAt: Date | null;
  discordUsername?: string | null;
  tags: Array<{ tag: string }>;
};

const adminUser = (u: AdminUserRow) => ({
  id: u.id,
  username: u.username,
  displayName: u.displayName,
  email: u.email,
  avatarUrl: u.avatarUrl,
  isSupporter: u.isSupporter,
  supporterTier: u.supporterTier,
  supporterSince: u.supporterSince?.toISOString() ?? null,
  supporterMessage: u.supporterMessage,
  supporterClaimedAt: u.supporterClaimedAt?.toISOString() ?? null,
  tags: normalizeUserTags(u.tags.map((t) => t.tag)),
  discordUsername: u.discordUsername ?? null,
});

export function registerSupporterRoutes(app: Express, deps: Deps) {
  const { prisma, authRequired, roleRequired, invalidateSession, currentUserId } = deps;
  const adminOnly = roleRequired([UserRole.ADMIN]);

  app.get("/api/support/supporters", async (_req, res) => {
    res.setHeader("Cache-Control", "public, max-age=30, stale-while-revalidate=120");
    try {
      res.json(await listPublicSupporters(prisma));
    } catch {
      res.json([]);
    }
  });

  // "Já apoiei": registra o pedido; o admin confere no Apoia.se/Pix e aprova
  app.post("/api/support/confirm", authRequired, async (req: Request, res: Response) => {
    const userId = currentUserId(req);
    if (!userId) return res.status(401).json({ error: "Faça login para confirmar o apoio." });
    const message = text(req.body?.message, 200) || null;
    const current = await prisma.user.findUnique({ where: { id: userId }, select: { isSupporter: true, supporterClaimedAt: true, supporterMessage: true } });
    if (!current) return res.status(404).json({ error: "Conta não encontrada." });
    await prisma.user.update({
      where: { id: userId },
      data: {
        supporterMessage: message ?? current.supporterMessage,
        // quem já é apoiador só atualiza o recado; o pedido fica com a data do primeiro clique
        ...(current.isSupporter ? {} : { supporterClaimedAt: current.supporterClaimedAt ?? new Date() }),
      },
    });
    invalidateSession(userId);
    res.json({
      ok: true,
      status: current.isSupporter ? "supporter" : "pending",
      message: current.isSupporter
        ? "Recado atualizado no mural."
        : "Pedido recebido! Assim que o apoio for conferido, o selo de Apoiador aparece no seu perfil e seu nome entra no mural.",
    });
  });

  app.get("/api/admin/supporters", authRequired, adminOnly, async (_req, res) => {
    res.setHeader("Cache-Control", "private, no-store");
    const [claims, supporters, tagged, wall] = await Promise.all([
      prisma.user.findMany({ where: { supporterClaimedAt: { not: null }, isSupporter: false }, select: ADMIN_USER_SELECT, orderBy: { supporterClaimedAt: "asc" } }),
      prisma.user.findMany({ where: { isSupporter: true }, select: ADMIN_USER_SELECT, orderBy: { supporterSince: "asc" } }),
      prisma.user.findMany({ where: { tags: { some: {} }, isSupporter: false }, select: ADMIN_USER_SELECT, orderBy: { username: "asc" } }),
      prisma.supporterWallEntry.findMany({ orderBy: { since: "asc" } }),
    ]);
    res.json({ claims: claims.map(adminUser), supporters: supporters.map(adminUser), tagged: tagged.map(adminUser), wall });
  });

  app.get("/api/admin/supporters/search", authRequired, adminOnly, async (req, res) => {
    const q = text(req.query.q, 60);
    if (q.length < 2) return res.json([]);
    const users = await prisma.user.findMany({
      where: { OR: [{ username: { contains: q, mode: "insensitive" } }, { displayName: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] },
      select: ADMIN_USER_SELECT,
      orderBy: { username: "asc" },
      take: 10,
    });
    res.json(users.map(adminUser));
  });

  /**
   * Apoiador, patente e tags de uma conta. Campos ausentes não mudam.
   * isSupporter=true aprova (inclusive um pedido); false revoga e apaga patente/data; claim="reject" descarta o pedido.
   */
  app.put("/api/admin/supporters/users/:id", authRequired, adminOnly, async (req, res) => {
    const id = String(req.params.id);
    const body = (req.body ?? {}) as { isSupporter?: unknown; tier?: unknown; tags?: unknown; claim?: unknown };
    if (body.tier !== undefined && body.tier !== null && !isSupporterTier(body.tier)) return res.status(400).json({ error: "Patente inválida." });
    const current = await prisma.user.findUnique({ where: { id }, select: { id: true, isSupporter: true, supporterSince: true } });
    if (!current) return res.status(404).json({ error: "Conta não encontrada." });

    const data: Record<string, unknown> = {};
    if (body.isSupporter === true) {
      data.isSupporter = true;
      data.supporterSince = current.supporterSince ?? new Date();
      data.supporterClaimedAt = null;
    } else if (body.isSupporter === false) {
      Object.assign(data, { isSupporter: false, supporterTier: null, supporterSince: null, supporterClaimedAt: null });
    }
    if (body.claim === "reject") data.supporterClaimedAt = null;
    if (body.tier !== undefined && body.isSupporter !== false) data.supporterTier = body.tier;

    await prisma.$transaction(async (tx) => {
      if (Object.keys(data).length) await tx.user.update({ where: { id }, data });
      if (body.tags !== undefined) {
        const tags = normalizeUserTags(body.tags);
        await tx.userTag.deleteMany({ where: { userId: id, tag: { notIn: tags } } });
        for (const tag of tags) await tx.userTag.upsert({ where: { userId_tag: { userId: id, tag } }, create: { userId: id, tag }, update: {} });
      }
    });
    invalidateSession(id);
    // patente/tags novas viram cargo no Discord de quem conectou a conta (server/services/discordRoles.ts)
    void import("../services/discordRoles.ts").then(({ queueUserDiscordRoleSync }) => queueUserDiscordRoleSync(prisma, id));
    const updated = await prisma.user.findUniqueOrThrow({ where: { id }, select: ADMIN_USER_SELECT });
    res.json(adminUser(updated));
  });

  // Mural sem conta (apoio pelo Apoia.se de quem não tem login no site)
  const wallData = (body: Record<string, unknown>, partial: boolean) => {
    const out: Record<string, unknown> = {};
    if (!partial || body.displayName !== undefined) {
      const name = text(body.displayName, 60);
      if (!name) return { error: "Informe o nome que vai aparecer no mural." };
      out.displayName = name;
    }
    if (body.tier !== undefined) {
      if (body.tier !== null && !isSupporterTier(body.tier)) return { error: "Patente inválida." };
      out.tier = body.tier;
    }
    if (body.message !== undefined) out.message = text(body.message, 200) || null;
    if (body.isActive !== undefined) out.isActive = Boolean(body.isActive);
    if (body.since !== undefined) {
      const since = new Date(String(body.since));
      if (Number.isNaN(since.getTime())) return { error: "Data inválida." };
      out.since = since;
    }
    return { data: out };
  };

  app.post("/api/admin/supporters/wall", authRequired, adminOnly, async (req, res) => {
    const parsed = wallData((req.body ?? {}) as Record<string, unknown>, false);
    if ("error" in parsed) return res.status(400).json({ error: parsed.error });
    res.status(201).json(await prisma.supporterWallEntry.create({ data: parsed.data as { displayName: string } }));
  });

  app.put("/api/admin/supporters/wall/:id", authRequired, adminOnly, async (req, res) => {
    const parsed = wallData((req.body ?? {}) as Record<string, unknown>, true);
    if ("error" in parsed) return res.status(400).json({ error: parsed.error });
    const id = String(req.params.id);
    if (!(await prisma.supporterWallEntry.findUnique({ where: { id }, select: { id: true } }))) return res.status(404).json({ error: "Nome não encontrado." });
    res.json(await prisma.supporterWallEntry.update({ where: { id }, data: parsed.data }));
  });

  app.delete("/api/admin/supporters/wall/:id", authRequired, adminOnly, async (req, res) => {
    await prisma.supporterWallEntry.deleteMany({ where: { id: String(req.params.id) } });
    res.status(204).end();
  });
}
