import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { HTML_PAGE_ROUTE, WARM_STATIC_PATHS, createIndexHtmlReader, homeHeroPreload, registerHtmlPages } from "./htmlPages.ts";
import { HOME_HERO_SIZES, articleImageSources } from "../../src/lib/articleImageSources.ts";
import type { DetailLoaders } from "../htmlMeta.ts";

const TEMPLATE = `<!doctype html><html lang="pt-BR"><head><title>Anaheim Hub</title><meta name="description" content="padrão" /></head><body><div id="root"></div></body></html>`;

describe("HTML_PAGE_ROUTE", () => {
  it("pega páginas do site e deixa de fora API, sockets e arquivos", () => {
    for (const p of ["/", "/cards", "/cards/GD01-001", "/deck/abc", "/apiario"]) expect(HTML_PAGE_ROUTE.test(p)).toBe(true);
    for (const p of ["/api", "/api/cards", "/socket.io/", "/social.io/x", "/uploads/a.png", "/assets/index.js"]) expect(HTML_PAGE_ROUTE.test(p)).toBe(false);
  });
});

describe("createIndexHtmlReader", () => {
  let dir: string;
  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), "html-pages-")); });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it("sem build devolve null; relê quando o arquivo muda", () => {
    const read = createIndexHtmlReader(dir);
    expect(read()).toBeNull();
    const file = path.join(dir, "index.html");
    fs.writeFileSync(file, "v1");
    expect(read()).toBe("v1");
    fs.writeFileSync(file, "v2");
    fs.utimesSync(file, new Date(), new Date(Date.now() + 5000));
    expect(read()).toBe("v2");
  });
});

describe("registerHtmlPages", () => {
  let dir: string;
  let server: Server;
  let base: string;

  async function start(loaders: Partial<DetailLoaders>) {
    const app = express();
    registerHtmlPages(app, { distDir: dir, loaders: loaders as DetailLoaders });
    app.use((_req, res) => res.status(418).send("seguiu"));
    server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  }

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "html-pages-"));
    fs.writeFileSync(path.join(dir, "index.html"), TEMPLATE);
  });
  afterEach(async () => {
    await new Promise<void>((resolve) => server?.close(() => resolve()));
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("página de carta com título próprio, 404 para carta que não existe", async () => {
    await start({ card: async (key) => (key === "GD01-001" ? { title: "Gundam (GD01-001)", description: "Carta GD01-001" } : null) });
    const ok = await fetch(`${base}/cards/GD01-001`);
    expect(ok.status).toBe(200);
    expect(ok.headers.get("cache-control")).toBe("no-cache");
    expect(await ok.text()).toContain("Gundam (GD01-001)");
    expect((await fetch(`${base}/cards/XX99-999`)).status).toBe(404);
    expect((await fetch(`${base}/endereco-que-nao-existe`)).status).toBe(404);
  });

  it("banco fora do ar: entrega o index.html do build com 200", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    await start({ card: async () => { throw new Error("sem banco"); } });
    const res = await fetch(`${base}/cards/GD01-002`);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe(TEMPLATE);
    err.mockRestore();
  });

  it("sem index.html (dev sem build) segue para o próximo handler", async () => {
    fs.rmSync(path.join(dir, "index.html"));
    await start({});
    expect((await fetch(`${base}/cards`)).status).toBe(418);
  });
});

// --- cache (Server-Timing) e aquecimento das páginas principais
const nada = async () => null;
const loaders: DetailLoaders = { card: nada, deck: nada, set: nada, series: nada, article: nada, tournament: nada };

function setup(bodyFor = vi.fn(async (_path: string) => null), warmPaths?: () => Promise<string[]>) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "html-"));
  fs.writeFileSync(path.join(dir, "index.html"), "<!doctype html><html><head><title>x</title></head><body><main>genérico</main></body></html>");
  const app = express();
  registerHtmlPages(app, { distDir: dir, loaders, bodyFor, warmPaths });
  return { app, bodyFor };
}

async function get(app: express.Express, url: string) {
  const server = app.listen(0);
  try {
    const { port } = server.address() as AddressInfo;
    return await fetch(`http://127.0.0.1:${port}${url}`);
  } finally {
    server.close();
  }
}

afterEach(() => vi.useRealTimers());

describe("registerHtmlPages: cache e aquecimento", () => {
  it("Server-Timing mostra o tempo do servidor e se veio do cache", async () => {
    const { app, bodyFor } = setup();
    const first = await get(app, "/sobre");
    expect(first.headers.get("server-timing")).toMatch(/^html;dur=[\d.]+;desc="miss"$/);
    const second = await get(app, "/sobre");
    expect(second.headers.get("server-timing")).toMatch(/desc="hit"/);
    expect(bodyFor).toHaveBeenCalledTimes(1);
  });

  it("aquece as páginas principais e as da lista sem esperar visita", async () => {
    vi.useFakeTimers();
    const bodyFor = vi.fn(async (_path: string) => null);
    const { app } = setup(bodyFor, async () => ["/articles/spoiler-gd07-062"]);
    await vi.advanceTimersByTimeAsync(16_000);
    const warmed = bodyFor.mock.calls.map((c) => c[0]);
    expect(warmed).toEqual(expect.arrayContaining([...WARM_STATIC_PATHS.filter((p) => p !== "/" && !p.startsWith("/articles/")), "/articles"]));
    vi.useRealTimers();
    const res = await get(app, "/stats");
    expect(res.headers.get("server-timing")).toMatch(/desc="hit"/);
  });
});

describe("homeHeroPreload", () => {
  it("pede as mesmas URLs que o carrossel da home (ArticleImageFrame)", () => {
    const image = articleImageSources("/uploads/spoilers/a.jpg", HOME_HERO_SIZES)!;
    expect(homeHeroPreload({ homeImage: "/uploads/spoilers/a.jpg", coverImage: "/uploads/b.jpg" })).toEqual([
      { href: image.blur },
      { href: image.src, srcset: image.srcSet, sizes: HOME_HERO_SIZES },
    ]);
    expect(image.blur).toBe("/uploads/spoilers/a.jpg?w=320");
  });

  it("usa a capa sem imagem de home; imagem de fora vira um preload só; sem artigo ou imagem inválida, nada", () => {
    expect(homeHeroPreload({ homeImage: null, coverImage: "https://cdn.exemplo/x.png" })).toEqual([
      { href: "https://cdn.exemplo/x.png", srcset: undefined, sizes: undefined },
    ]);
    expect(homeHeroPreload(null)).toEqual([]);
    expect(homeHeroPreload({ homeImage: "javascript:alert(1)", coverImage: null })).toEqual([]);
  });
});
