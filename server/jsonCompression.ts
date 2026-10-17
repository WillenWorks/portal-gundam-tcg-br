import zlib from "node:zlib";
import type { RequestHandler } from "express";

/**
 * Comprime em gzip as respostas JSON da API quando o cliente aceita (`Accept-Encoding: gzip`).
 *
 * Por quê: o nginx da VPS só comprime HTML, e `/api/cards` sem paginação devolve o catálogo
 * inteiro (~7 MB de JSON) a cada chamada. Comprimir aqui vale para toda rota que usa `res.json`,
 * sem depender da configuração do nginx (que não está no repositório). A compressão roda no
 * threadpool do libuv (`zlib.gzip` assíncrono), então não segura o event loop.
 */
export function gzipJson(minBytes = 1024): RequestHandler {
  return (req, res, next) => {
    const accept = String(req.headers["accept-encoding"] ?? "");
    if (!/\bgzip\b/i.test(accept)) return next();
    const originalJson = res.json.bind(res);
    res.json = ((body: unknown) => {
      const text = JSON.stringify(body);
      if (text === undefined || res.headersSent || Buffer.byteLength(text) < minBytes) return originalJson(body);
      res.vary("Accept-Encoding");
      zlib.gzip(text, { level: 6 }, (err, compressed) => {
        if (res.headersSent) return;
        res.type("application/json");
        if (err) {
          res.send(text);
          return;
        }
        res.setHeader("Content-Encoding", "gzip");
        res.send(compressed);
      });
      return res;
    }) as typeof res.json;
    next();
  };
}
