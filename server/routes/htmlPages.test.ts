import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import express from "express";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DetailLoaders } from "../htmlMeta.ts";
import { registerHtmlPages, WARM_STATIC_PATHS } from "./htmlPages.ts";

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

describe("registerHtmlPages", () => {
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
