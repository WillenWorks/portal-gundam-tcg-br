import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import express from "express";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { pickWidth, resizedUploads, resizeRateLimit, safeUploadPath } from "./imageResize.ts";

let root: string;
let server: ReturnType<express.Express["listen"]>;
let base: string;

beforeAll(async () => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "uploads-"));
  fs.mkdirSync(path.join(root, "spoilers"), { recursive: true });
  await sharp({ create: { width: 1600, height: 900, channels: 3, background: { r: 200, g: 30, b: 30 } } }).png().toFile(path.join(root, "spoilers", "grande.png"));
  fs.writeFileSync(path.join(root, "spoilers", "nota.txt"), "x");
  const app = express();
  app.use("/uploads", resizeRateLimit(4), resizedUploads(root), express.static(root));
  server = app.listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/uploads`;
});

afterAll(() => {
  server.close();
  fs.rmSync(root, { recursive: true, force: true });
});

describe("imageResize", () => {
  it("arredonda a largura para a lista", () => {
    expect(pickWidth(400)).toBe(480);
    expect(pickWidth(5000)).toBe(1280);
    expect(pickWidth(0)).toBeNull();
    expect(pickWidth(Number.NaN)).toBeNull();
  });

  it("não sai da pasta de uploads", () => {
    expect(safeUploadPath(root, "/../segredo.png")).toBeNull();
    expect(safeUploadPath(root, "/%2e%2e/segredo.png")).toBeNull();
    expect(safeUploadPath(root, "/.resized/640/x.png")).toBeNull();
    expect(safeUploadPath(root, "/spoilers/nota.txt")).toBeNull();
    expect(safeUploadPath(root, "/spoilers/grande.png")).toBe(path.join(root, "spoilers", "grande.png"));
  });

  it("?w devolve WebP redimensionado e guarda em cache", async () => {
    const res = await fetch(`${base}/spoilers/grande.png?w=600`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/webp");
    const meta = await sharp(Buffer.from(await res.arrayBuffer())).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.width).toBe(640);
    expect(fs.existsSync(path.join(root, ".resized", "640", "spoilers", "grande.png.webp"))).toBe(true);
  });

  it("sem ?w serve o original; a pasta de cache não é pública", async () => {
    const original = await fetch(`${base}/spoilers/grande.png`);
    expect(original.headers.get("content-type")).toBe("image/png");
    expect((await fetch(`${base}/.resized/640/spoilers/grande.png.webp`)).status).toBe(404);
  });

  it("arquivo inexistente segue para o 404", async () => {
    expect((await fetch(`${base}/spoilers/nao-existe.png?w=640`)).status).toBe(404);
  });

  // último teste: os anteriores já gastaram 2 dos 4 pedidos com ?w
  it("limita os pedidos com ?w por IP; sem ?w não conta", async () => {
    expect((await fetch(`${base}/spoilers/grande.png`)).status).toBe(200);
    const statuses: number[] = [];
    for (let i = 0; i < 3; i++) statuses.push((await fetch(`${base}/spoilers/grande.png?w=320`)).status);
    expect(statuses).toEqual([200, 200, 429]);
  });
});
