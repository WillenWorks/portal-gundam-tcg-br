import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { HTML_PAGE_ROUTE, createIndexHtmlReader, registerHtmlPages } from "./htmlPages.ts";
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
