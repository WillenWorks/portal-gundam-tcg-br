import { afterEach, describe, expect, it, vi } from "vitest";
import express from "express";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { PrismaClient } from "@prisma/client";
import { registerArticleSocialRoutes } from "./articleSocialRoutes.ts";

const POST = { id: "post-1", slug: "artigo", title: "Artigo", authorId: "autor", likeCount: 0 };
const AUTHOR = { id: "leitor", displayName: "Leitor", username: "leitor", avatarUrl: null, role: "MEMBER", isSupporter: false };

function fakePrisma() {
  const comments: any[] = [];
  const notifications: any[] = [];
  const prisma = {
    post: { findFirst: vi.fn(async () => POST) },
    postComment: {
      count: vi.fn(async () => comments.length),
      findFirst: vi.fn(async ({ where }: any) => comments.find((c) => c.id === where.id && c.postId === where.postId) ?? null),
      findMany: vi.fn(async () =>
        comments.filter((c) => !c.parentId).map((c) => ({
          ...c,
          author: AUTHOR,
          likes: [],
          _count: { likes: 0, replies: 0 },
          replies: comments.filter((r) => r.parentId === c.id).map((r) => ({ ...r, author: AUTHOR, likes: [], _count: { likes: 0 } })),
        })),
      ),
      create: vi.fn(async ({ data }: any) => {
        const comment = { id: `c${comments.length + 1}`, isDeleted: false, createdAt: new Date(), updatedAt: new Date(), ...data };
        comments.push(comment);
        return { ...comment, author: AUTHOR };
      }),
    },
    notification: {
      create: vi.fn(async ({ data }: any) => {
        notifications.push(data);
        return { id: "n1", ...data };
      }),
    },
  };
  return { prisma: prisma as unknown as PrismaClient, notifications };
}

const readJson = async (response: Response | Promise<Response>): Promise<any> => (await response).json();

describe("comentários de artigo", () => {
  let server: Server | null = null;
  afterEach(() => {
    server?.close();
    server = null;
  });

  async function start(prisma: PrismaClient, user: Record<string, unknown> | null) {
    const app = express();
    app.use(express.json());
    const authRequired = (req: any, res: any, next: any) => {
      if (!user) return res.status(401).json({ error: "Token ausente." });
      req.user = user;
      next();
    };
    const authOptional = (req: any, _res: any, next: any) => {
      if (user) req.user = user;
      next();
    };
    registerArticleSocialRoutes(app, prisma, authRequired, authOptional);
    server = createServer(app);
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
    return `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/posts/artigo/comments`;
  }

  const send = (url: string, body: unknown) =>
    fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

  it("publica o comentário, ele aparece na lista e o autor do artigo é avisado", async () => {
    const { prisma, notifications } = fakePrisma();
    const url = await start(prisma, { userId: "leitor", username: "leitor" });

    const created = await send(url, { content: "  Boa análise  " });
    expect(created.status).toBe(201);
    expect((await readJson(created)).content).toBe("Boa análise");

    const list = await readJson(fetch(url));
    expect(list.totalCount).toBe(1);
    expect(list.comments[0]).toMatchObject({ content: "Boa análise", author: { username: "leitor" }, replies: [] });
    expect(notifications[0]).toMatchObject({ recipientId: "autor", entityId: "post-1" });
  });

  it("resposta a uma resposta entra no fio do comentário raiz", async () => {
    const { prisma } = fakePrisma();
    const url = await start(prisma, { userId: "leitor", username: "leitor" });

    const root = await readJson(send(url, { content: "raiz" }));
    const reply = await readJson(send(url, { content: "resposta", parentId: root.id }));
    const nested = await readJson(send(url, { content: "outra", parentId: reply.id }));

    expect(nested.parentId).toBe(root.id);
    const list = await readJson(fetch(url));
    expect(list.comments[0].replies.map((r: any) => r.content)).toEqual(["resposta", "outra"]);
  });

  it("recusa visitante sem login, convidado e comentário vazio", async () => {
    const { prisma } = fakePrisma();
    expect((await send(await start(prisma, null), { content: "oi" })).status).toBe(401);
    server?.close();

    expect((await send(await start(prisma, { userId: "g", guest: true }), { content: "oi" })).status).toBe(403);
    server?.close();

    expect((await send(await start(prisma, { userId: "leitor" }), { content: "   " })).status).toBe(400);
  });
});
