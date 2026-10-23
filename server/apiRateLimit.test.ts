import express from "express";
import { rateLimit } from "express-rate-limit";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { apiRateLimitOptions } from "./apiRateLimit";

let server: Server;
let base = "";

beforeAll(async () => {
  const app = express();
  app.set("trust proxy", "loopback");
  app.use(rateLimit(apiRateLimitOptions({ limit: 3, windowMs: 60_000 })));
  app.get("/api/ping", (_req, res) => res.json({ ok: true }));
  app.get("/api/outro", (_req, res) => res.json({ ok: true }));
  app.get("/pagina", (_req, res) => res.send("ok"));
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

describe("apiRateLimitOptions", () => {
  it("limita as rotas /api por IP e responde 429 em JSON depois do teto", async () => {
    for (let i = 0; i < 3; i++) expect((await fetch(`${base}/api/ping`)).status).toBe(200);
    const blocked = await fetch(`${base}/api/outro`);
    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toEqual({ error: expect.stringMatching(/Muitas requisições/) });
    expect(blocked.headers.get("retry-after")).not.toBeNull();
  });

  it("o IP do visitante vem do X-Forwarded-For do nginx — cada visitante tem o próprio balde", async () => {
    const res = await fetch(`${base}/api/ping`, { headers: { "x-forwarded-for": "203.0.113.7" } });
    expect(res.status).toBe(200);
  });

  it("não conta nem bloqueia o que não é /api (páginas, uploads)", async () => {
    for (let i = 0; i < 5; i++) expect((await fetch(`${base}/pagina`)).status).toBe(200);
  });
});
