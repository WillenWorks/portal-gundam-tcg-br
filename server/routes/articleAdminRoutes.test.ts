import { describe, expect, it, vi, afterEach } from "vitest";
import express from "express";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { PrismaClient, PostStatus } from "@prisma/client";
import { registerArticleAdminRoutes } from "./articleAdminRoutes.ts";
import { buildArticleStoryHtml } from "../services/socialSlides.ts";

describe("articleAdminRoutes", () => {
  let server: Server | null = null;

  afterEach(() => {
    if (server) {
      server.close();
      server = null;
    }
  });

  it("buildArticleStoryHtml constrói HTML válido para Story 9:16 de artigo", () => {
    const html = buildArticleStoryHtml({
      title: "Análise GD06: O Impacto no Metagame",
      kind: "ANÁLISE",
      coverUrl: "https://anaheimhub.com/cover.jpg",
      articleUrl: "https://anaheimhub.com/articles/analise-gd06",
    });

    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("ANAHEIM HUB");
    expect(html).toContain("NOVO ANÁLISE NO SITE");
    expect(html).toContain("Análise GD06: O Impacto no Metagame");
    expect(html).toContain("https://anaheimhub.com/articles/analise-gd06");
    expect(html).toContain("reel-canvas");
  });

  it("POST /api/admin/articles/generate rejeita requisição sem topic", async () => {
    const app = express();
    app.use(express.json());
    const mockPrisma = {} as unknown as PrismaClient;
    const passMiddleware = (_req: any, _res: any, next: any) => next();

    registerArticleAdminRoutes(app, mockPrisma, passMiddleware, passMiddleware);

    server = createServer(app);
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
    const port = (server.address() as AddressInfo).port;

    const res = await fetch(`http://127.0.0.1:${port}/api/admin/articles/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("obrigatório");
  });

  it("POST /api/admin/articles/:id/approve atualiza status para PUBLISHED", async () => {
    const app = express();
    app.use(express.json());

    const mockPost = {
      id: "art-1",
      title: "Guia Verde Ramp",
      slug: "guia-verde-ramp",
      status: PostStatus.REVIEW,
      publishedAt: null,
      author: { id: "u-1", name: "Editor" },
    };

    const mockPrisma = {
      post: {
        findUnique: vi.fn().mockResolvedValue(mockPost),
        update: vi.fn().mockImplementation(({ data }) => ({
          ...mockPost,
          status: data.status,
          publishedAt: data.publishedAt,
        })),
      },
      socialMediaPost: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: "smp-1" }),
      },
    } as unknown as PrismaClient;

    const passMiddleware = (_req: any, _res: any, next: any) => next();

    registerArticleAdminRoutes(app, mockPrisma, passMiddleware, passMiddleware);

    server = createServer(app);
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
    const port = (server.address() as AddressInfo).port;

    const res = await fetch(`http://127.0.0.1:${port}/api/admin/articles/art-1/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; post: { status: string; publishedAt: string } };
    expect(body.ok).toBe(true);
    expect(body.post.status).toBe(PostStatus.PUBLISHED);
    expect(body.post.publishedAt).toBeTruthy();
  });
});
