import express from "express";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { gzipJson } from "./jsonCompression";

let server: Server;
let base = "";
const big = Array.from({ length: 400 }, (_, i) => ({ id: i, code: `GD05-${String(i).padStart(3, "0")}`, effect: "Choose 1 enemy Unit. It gets AP-2 during this turn." }));

beforeAll(async () => {
  const app = express();
  app.use(gzipJson(1024));
  app.get("/big", (_req, res) => res.status(201).json(big));
  app.get("/small", (_req, res) => res.json({ ok: true }));
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

describe("gzipJson", () => {
  it("comprime JSON grande quando o cliente aceita gzip, mantendo status e conteúdo", async () => {
    const res = await fetch(`${base}/big`, { headers: { "accept-encoding": "gzip" } });
    expect(res.status).toBe(201);
    expect(res.headers.get("content-encoding")).toBe("gzip");
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
    expect(res.headers.get("vary")).toMatch(/Accept-Encoding/i);
    expect(await res.json()).toEqual(big);
  });

  it("não comprime quando o cliente não aceita gzip", async () => {
    const res = await fetch(`${base}/big`, { headers: { "accept-encoding": "identity" } });
    expect(res.headers.get("content-encoding")).toBeNull();
    expect(await res.json()).toEqual(big);
  });

  it("não comprime resposta pequena", async () => {
    const res = await fetch(`${base}/small`, { headers: { "accept-encoding": "gzip" } });
    expect(res.headers.get("content-encoding")).toBeNull();
    expect(await res.json()).toEqual({ ok: true });
  });
});
