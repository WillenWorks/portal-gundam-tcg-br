/* eslint-disable @typescript-eslint/no-explicit-any -- banco em memória: linhas soltas, como o Prisma devolve */
import express, { type NextFunction, type Request, type Response } from "express";
import type { AddressInfo } from "node:net";
import { describe, expect, it, vi } from "vitest";
import { registerSupporterRoutes } from "./supporterRoutes.ts";

/* Banco em memória com só o que as rotas de apoiadores usam. */
type Row = Record<string, any>;
type Where = Record<string, any>;

function matches(row: Row, where: Where = {}, db?: Db): boolean {
  return Object.entries(where).every(([key, cond]) => {
    if (key === "OR") return (cond as Where[]).some((w) => matches(row, w, db));
    if (key === "tags" && db) return db.userTag.filter((t) => t.userId === row.id).length > 0;
    const value = row[key];
    if (cond && typeof cond === "object" && !(cond instanceof Date)) {
      if ("not" in cond) return cond.not === null ? value != null : value !== cond.not;
      if ("notIn" in cond) return !cond.notIn.includes(value);
      if ("contains" in cond) return String(value ?? "").toLowerCase().includes(String(cond.contains).toLowerCase());
    }
    return value === cond;
  });
}

type Db = { user: Row[]; userTag: Row[]; wall: Row[] };

function fakePrisma(db: Db) {
  let seq = 0;
  const withTags = (u: Row) => ({ ...u, tags: db.userTag.filter((t) => t.userId === u.id).map((t) => ({ tag: t.tag })) });
  const prisma: any = {
    user: {
      findMany: async ({ where }: { where?: Where } = {}) => db.user.filter((u) => matches(u, where, db)).map(withTags),
      findUnique: async ({ where }: { where: Where }) => {
        const u = db.user.find((r) => matches(r, where));
        return u ? withTags(u) : null;
      },
      findUniqueOrThrow: async (args: { where: Where }) => {
        const u = await prisma.user.findUnique(args);
        if (!u) throw new Error("not found");
        return u;
      },
      update: async ({ where, data }: { where: Where; data: Row }) => {
        const u = db.user.find((r) => matches(r, where))!;
        Object.assign(u, data);
        return u;
      },
    },
    userTag: {
      deleteMany: async ({ where }: { where: Where }) => {
        db.userTag = db.userTag.filter((t) => !matches(t, where));
      },
      upsert: async ({ create }: { create: Row }) => {
        if (!db.userTag.some((t) => t.userId === create.userId && t.tag === create.tag)) db.userTag.push({ id: `t${++seq}`, ...create });
      },
    },
    supporterWallEntry: {
      findMany: async ({ where }: { where?: Where } = {}) => db.wall.filter((w) => matches(w, where)),
      findUnique: async ({ where }: { where: Where }) => db.wall.find((w) => matches(w, where)) ?? null,
      create: async ({ data }: { data: Row }) => {
        const row = { id: `w${++seq}`, isActive: true, since: new Date("2026-11-17T12:00:00Z"), tier: null, message: null, ...data };
        db.wall.push(row);
        return row;
      },
      update: async ({ where, data }: { where: Where; data: Row }) => Object.assign(db.wall.find((w) => matches(w, where))!, data),
      deleteMany: async ({ where }: { where: Where }) => {
        db.wall = db.wall.filter((w) => !matches(w, where));
      },
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma),
  };
  return prisma;
}

const user = (over: Row): Row => ({
  id: "u1", username: "amuro", displayName: "Amuro", email: "a@x.com", avatarUrl: null, isActive: true,
  isSupporter: false, supporterTier: null, supporterSince: null, supporterMessage: null, supporterClaimedAt: null, ...over,
});

function setup(db: Db) {
  const invalidateSession = vi.fn();
  const app = express();
  app.use(express.json());
  // token de mentira: header x-user = id da conta; x-admin = é admin
  const authRequired = (req: Request, res: Response, next: NextFunction) => (req.header("x-user") ? next() : res.status(401).end());
  const roleRequired = () => (req: Request, res: Response, next: NextFunction) => (req.header("x-admin") ? next() : res.status(403).end());
  registerSupporterRoutes(app, { prisma: fakePrisma(db), authRequired, roleRequired, invalidateSession, currentUserId: (req) => req.header("x-user") });
  return { app, invalidateSession };
}

async function call(app: express.Express, method: string, url: string, { body, as, admin }: { body?: unknown; as?: string; admin?: boolean } = {}) {
  const server = app.listen(0);
  try {
    const { port } = server.address() as AddressInfo;
    const res = await fetch(`http://127.0.0.1:${port}${url}`, {
      method,
      headers: { "content-type": "application/json", ...(as ? { "x-user": as } : {}), ...(admin ? { "x-admin": "1" } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const textBody = await res.text();
    return { status: res.status, json: textBody ? JSON.parse(textBody) : null };
  } finally {
    server.close();
  }
}

describe("mural de apoiadores", () => {
  it("junta contas e nomes sem conta, patente mais alta primeiro, sem dados privados", async () => {
    const db: Db = {
      user: [
        user({ id: "u1", username: "amuro", displayName: "Amuro", isSupporter: true, supporterTier: "RECRUTA", supporterSince: new Date("2026-10-01T12:00:00Z") }),
        user({ id: "u2", username: "char", displayName: "Char", isSupporter: true, supporterTier: "COMANDANTE", supporterSince: new Date("2026-11-01T12:00:00Z"), supporterMessage: "Sieg!" }),
        user({ id: "u3", username: "bloqueado", isSupporter: true, isActive: false }),
        user({ id: "u4", username: "pediu", supporterClaimedAt: new Date() }),
      ],
      userTag: [],
      wall: [
        { id: "w1", displayName: "Fã do Apoia.se", tier: "PILOTO", message: null, since: new Date("2026-11-10T12:00:00Z"), isActive: true },
        { id: "w2", displayName: "Inativo", tier: "AS", message: null, since: new Date(), isActive: false },
      ],
    };
    const { app } = setup(db);
    const { json } = await call(app, "GET", "/api/support/supporters");
    expect(json.map((s: Row) => s.name)).toEqual(["Char", "Fã do Apoia.se", "Amuro"]);
    expect(json[0]).toMatchObject({ username: "char", tier: "COMANDANTE", message: "Sieg!" });
    expect(json[1].username).toBeUndefined();
    expect(JSON.stringify(json)).not.toContain("@x.com");
  });
});

describe("\"já apoiei\" vira pedido", () => {
  it("não dá o selo: registra o pedido para o admin conferir", async () => {
    const db: Db = { user: [user({})], userTag: [], wall: [] };
    const { app, invalidateSession } = setup(db);
    const { status, json } = await call(app, "POST", "/api/support/confirm", { as: "u1", body: { message: "Valeu pelo site!" } });
    expect(status).toBe(200);
    expect(json.status).toBe("pending");
    expect(db.user[0]).toMatchObject({ isSupporter: false, supporterMessage: "Valeu pelo site!" });
    expect(db.user[0].supporterClaimedAt).toBeInstanceOf(Date);
    expect(invalidateSession).toHaveBeenCalledWith("u1");
    expect((await call(app, "GET", "/api/support/supporters")).json).toEqual([]);
  });

  it("sem login não registra", async () => {
    const { app } = setup({ user: [user({})], userTag: [], wall: [] });
    expect((await call(app, "POST", "/api/support/confirm", { body: {} })).status).toBe(401);
  });

  it("quem já é apoiador só atualiza o recado", async () => {
    const db: Db = { user: [user({ isSupporter: true, supporterTier: "PILOTO" })], userTag: [], wall: [] };
    const { app } = setup(db);
    const { json } = await call(app, "POST", "/api/support/confirm", { as: "u1", body: { message: "novo recado" } });
    expect(json.status).toBe("supporter");
    expect(db.user[0]).toMatchObject({ supporterMessage: "novo recado", supporterClaimedAt: null });
  });
});

describe("admin: apoiadores e tags", () => {
  it("só admin acessa", async () => {
    const { app } = setup({ user: [user({})], userTag: [], wall: [] });
    expect((await call(app, "GET", "/api/admin/supporters", { as: "u1" })).status).toBe(403);
  });

  it("aprova pedido com patente; lista sai de pedidos e entra em apoiadores", async () => {
    const db: Db = { user: [user({ supporterClaimedAt: new Date() })], userTag: [], wall: [] };
    const { app, invalidateSession } = setup(db);
    expect((await call(app, "GET", "/api/admin/supporters", { as: "adm", admin: true })).json.claims).toHaveLength(1);
    const { json } = await call(app, "PUT", "/api/admin/supporters/users/u1", { as: "adm", admin: true, body: { isSupporter: true, tier: "AS" } });
    expect(json).toMatchObject({ isSupporter: true, supporterTier: "AS", supporterClaimedAt: null });
    expect(json.supporterSince).toBeTruthy();
    expect(invalidateSession).toHaveBeenCalledWith("u1");
    const list = (await call(app, "GET", "/api/admin/supporters", { as: "adm", admin: true })).json;
    expect(list.claims).toHaveLength(0);
    expect(list.supporters.map((u: Row) => u.id)).toEqual(["u1"]);
  });

  it("recusa pedido sem dar selo; revogar limpa patente e data", async () => {
    const db: Db = { user: [user({ supporterClaimedAt: new Date() }), user({ id: "u2", username: "kai", isSupporter: true, supporterTier: "PILOTO", supporterSince: new Date() })], userTag: [], wall: [] };
    const { app } = setup(db);
    await call(app, "PUT", "/api/admin/supporters/users/u1", { as: "adm", admin: true, body: { claim: "reject" } });
    expect(db.user[0]).toMatchObject({ isSupporter: false, supporterClaimedAt: null });
    await call(app, "PUT", "/api/admin/supporters/users/u2", { as: "adm", admin: true, body: { isSupporter: false, tier: "AS" } });
    expect(db.user[1]).toMatchObject({ isSupporter: false, supporterTier: null, supporterSince: null });
  });

  it("tags: várias por conta, só do catálogo, sem repetir; trocar a lista remove as que saíram", async () => {
    const db: Db = { user: [user({})], userTag: [], wall: [] };
    const { app } = setup(db);
    const first = await call(app, "PUT", "/api/admin/supporters/users/u1", { as: "adm", admin: true, body: { tags: ["JUIZ", "BETA", "BETA", "INVENTADA"] } });
    expect(first.json.tags).toEqual(["BETA", "JUIZ"]); // ordem do catálogo
    expect(db.userTag).toHaveLength(2);
    const second = await call(app, "PUT", "/api/admin/supporters/users/u1", { as: "adm", admin: true, body: { tags: ["JUIZ", "CAMPEAO"] } });
    expect(second.json.tags).toEqual(["JUIZ", "CAMPEAO"]);
    expect(db.userTag.map((t) => t.tag).sort()).toEqual(["CAMPEAO", "JUIZ"]);
    const tagged = (await call(app, "GET", "/api/admin/supporters", { as: "adm", admin: true })).json.tagged;
    expect(tagged.map((u: Row) => u.id)).toEqual(["u1"]);
  });

  it("patente fora do catálogo é recusada", async () => {
    const { app } = setup({ user: [user({})], userTag: [], wall: [] });
    expect((await call(app, "PUT", "/api/admin/supporters/users/u1", { as: "adm", admin: true, body: { tier: "GENERAL" } })).status).toBe(400);
  });

  it("busca contas por nome, usuário ou e-mail", async () => {
    const { app } = setup({ user: [user({}), user({ id: "u2", username: "char", displayName: "Char Aznable", email: "char@zeon.com" })], userTag: [], wall: [] });
    expect((await call(app, "GET", "/api/admin/supporters/search?q=azn", { as: "adm", admin: true })).json.map((u: Row) => u.id)).toEqual(["u2"]);
    expect((await call(app, "GET", "/api/admin/supporters/search?q=a", { as: "adm", admin: true })).json).toEqual([]);
  });

  it("mural sem conta: cria, edita, oculta e remove", async () => {
    const db: Db = { user: [], userTag: [], wall: [] };
    const { app } = setup(db);
    expect((await call(app, "POST", "/api/admin/supporters/wall", { as: "adm", admin: true, body: { displayName: "  " } })).status).toBe(400);
    const created = await call(app, "POST", "/api/admin/supporters/wall", { as: "adm", admin: true, body: { displayName: "Fã do Apoia.se", tier: "PILOTO" } });
    expect(created.status).toBe(201);
    const id = created.json.id;
    await call(app, "PUT", `/api/admin/supporters/wall/${id}`, { as: "adm", admin: true, body: { message: "Força, Anaheim!" } });
    expect((await call(app, "GET", "/api/support/supporters")).json[0]).toMatchObject({ name: "Fã do Apoia.se", tier: "PILOTO", message: "Força, Anaheim!" });
    await call(app, "PUT", `/api/admin/supporters/wall/${id}`, { as: "adm", admin: true, body: { isActive: false } });
    expect((await call(app, "GET", "/api/support/supporters")).json).toEqual([]);
    expect((await call(app, "DELETE", `/api/admin/supporters/wall/${id}`, { as: "adm", admin: true })).status).toBe(204);
    expect(db.wall).toHaveLength(0);
  });
});
