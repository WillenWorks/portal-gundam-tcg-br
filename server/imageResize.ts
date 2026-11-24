/**
 * Imagens enviadas em tamanho de tela: `/uploads/...jpg?w=640` devolve um WebP de no máximo 640 px de largura,
 * gerado na primeira vez e guardado em `<uploads>/.resized/` (pasta com ponto: o express.static não a serve).
 * Sem `?w`, o arquivo original segue pelo express.static como antes.
 *
 * Por quê: os spoilers chegam do Discord em PNG de até 1,2 MB e iam inteiros para um quadro de ~360 px no
 * celular; o destaque da home levava 10 s para aparecer (LCP) numa conexão móvel.
 */
import fs from "node:fs";
import path from "node:path";
import type { NextFunction, Request, Response } from "express";
import sharp from "sharp";

/** larguras aceitas (qualquer outra é arredondada para a próxima da lista: o cache não explode) */
export const RESIZE_WIDTHS = [320, 480, 640, 960, 1280] as const;
const RESIZABLE = /\.(jpe?g|png|webp)$/i;
const CACHE_DIR = ".resized";
const WEBP_QUALITY = 78;

export function pickWidth(requested: number): number | null {
  if (!Number.isFinite(requested) || requested <= 0) return null;
  return RESIZE_WIDTHS.find((w) => w >= requested) ?? RESIZE_WIDTHS[RESIZE_WIDTHS.length - 1];
}

/** caminho do arquivo dentro da pasta de uploads, ou null se sair dela / não for imagem */
export function safeUploadPath(root: string, urlPath: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  if (!RESIZABLE.test(decoded) || decoded.includes("\0")) return null;
  const rel = decoded.replace(/^\/+/, "");
  if (rel.split(/[\\/]/).some((part) => part === ".." || part.startsWith("."))) return null;
  const abs = path.resolve(root, rel);
  const rootAbs = path.resolve(root);
  return abs.startsWith(rootAbs + path.sep) ? abs : null;
}

const inflight = new Map<string, Promise<void>>();

async function ensureResized(source: string, target: string, width: number): Promise<void> {
  const [src, dst] = await Promise.all([fs.promises.stat(source), fs.promises.stat(target).catch(() => null)]);
  if (dst && dst.mtimeMs >= src.mtimeMs) return;
  let job = inflight.get(target);
  if (!job) {
    job = (async () => {
      await fs.promises.mkdir(path.dirname(target), { recursive: true });
      const tmp = `${target}.${process.pid}.tmp`;
      await sharp(source, { limitInputPixels: 50_000_000 })
        .rotate()
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: WEBP_QUALITY })
        .toFile(tmp);
      await fs.promises.rename(tmp, target);
    })().finally(() => inflight.delete(target));
    inflight.set(target, job);
  }
  await job;
}

/** middleware montado em `/uploads` ANTES do express.static */
export function resizedUploads(root: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if ((req.method !== "GET" && req.method !== "HEAD") || req.query.w === undefined) return next();
    const width = pickWidth(Number(req.query.w));
    const source = width ? safeUploadPath(root, req.path) : null;
    if (!width || !source) return next();
    const target = path.join(path.resolve(root), CACHE_DIR, String(width), `${path.relative(path.resolve(root), source)}.webp`);
    try {
      await ensureResized(source, target, width);
    } catch (err) {
      if ((err as NodeJS.ErrnoException)?.code === "ENOENT") return next();
      console.warn("[imageResize] falhou, servindo o original:", (err as Error)?.message ?? err);
      return next();
    }
    // `.resized` começa com ponto: o send recusa por padrão (é o que esconde a pasta do express.static)
    res.sendFile(
      target,
      {
        dotfiles: "allow",
        // o nome do arquivo muda quando a imagem muda (sufixo aleatório/id): pode ficar em cache por uma semana
        headers: { "Content-Type": "image/webp", "Cache-Control": "public, max-age=604800" },
      },
      (err) => {
        if (err && !res.headersSent) next();
      },
    );
  };
}
