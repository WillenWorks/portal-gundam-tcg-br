import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/* Toda rota que depende de uma conta (`req.user!`, `req.user.userId`) precisa declarar o middleware de autenticação.
 * Sem ele, `req.user` fica indefinido, e no Prisma `where: { userId: undefined }` ignora o filtro. */

const SERVER_DIR = import.meta.dirname;
const ROUTE_START = /^\s*(?:app|router)\.(?:get|post|put|patch|delete)\(\s*(?:["'`]([^"'`]+)["'`])/gm;

function usesAccount(route: string) {
  if (/req\.user!/.test(route)) return true;
  const isGuarded = /req\.user\?\.userId|req\.user\s*&&|if \(req\.user\)|if \(!req\.user\)/.test(route);
  return /req\.user\.userId/.test(route) && !isGuarded;
}

function routesWithoutAuth(source: string) {
  const memberBlock = source.match(/const member = \[[\s\S]*?\];/)?.[0] ?? "";
  const guards = memberBlock.includes("authRequired") ? /\b(?:authRequired|member)\b/ : /\bauthRequired\b/;
  const starts = [...source.matchAll(ROUTE_START)];
  return starts.flatMap((match, i) => {
    const route = source.slice(match.index, starts[i + 1]?.index ?? source.length);
    const declaration = route.split(/(?:async\s*)?\(\s*req\b/)[0];
    return usesAccount(route) && !guards.test(declaration) ? [match[1]] : [];
  });
}

function routeFiles() {
  const routesDir = path.join(SERVER_DIR, "routes");
  const routes = fs
    .readdirSync(routesDir)
    .filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts"))
    .map((file) => path.join(routesDir, file));
  return [path.join(SERVER_DIR, "index.ts"), ...routes];
}

describe("rotas que dependem de conta", () => {
  it("declaram autenticação", () => {
    const missing = routeFiles().flatMap((file) =>
      routesWithoutAuth(fs.readFileSync(file, "utf8")).map((route) => `${path.basename(file)}: ${route}`),
    );
    expect(missing).toEqual([]);
  });

  it("a conferência acha rota sem autenticação", () => {
    const source = `
      app.get("/api/aberta", async (req: RequestWithUser, res) => {
        res.json(await prisma.deck.findMany({ where: { userId: req.user!.userId } }));
      });
      app.get("/api/fechada", authRequired, async (req: RequestWithUser, res) => {
        res.json(await prisma.deck.findMany({ where: { userId: req.user!.userId } }));
      });
      app.get("/api/opcional", authOptional, async (req: RequestWithUser, res) => {
        res.json(req.user?.userId ? await prisma.like.findMany({ where: { userId: req.user.userId } }) : []);
      });
    `;
    expect(routesWithoutAuth(source)).toEqual(["/api/aberta"]);
  });

  it("aceita o atalho `member` só quando ele inclui authRequired", () => {
    const route = `app.get("/api/social", member, async (req: RequestWithUser, res) => res.json(req.user!.userId));`;
    expect(routesWithoutAuth(`const member = [authRequired, limite];\n${route}`)).toEqual([]);
    expect(routesWithoutAuth(`const member = [limite];\n${route}`)).toEqual(["/api/social"]);
  });
});
