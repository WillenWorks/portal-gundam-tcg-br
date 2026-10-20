import { describe, expect, it, vi } from "vitest";
import jwt from "jsonwebtoken";
import type { NextFunction, Response } from "express";
import { createAuth, type AuthPayload, type RequestWithUser } from "./auth.ts";
import type { SessionState } from "./sessionState.ts";

const SECRET = "segredo-de-teste";
const BASE: AuthPayload = { userId: "u1", role: "USER", email: "a@b.com", username: "piloto", isHoster: false };
const ACTIVE: SessionState = { isActive: true, role: "USER", isHoster: false, tokenVersion: 0 };

function fakeRes() {
  const res = { statusCode: 200, body: undefined as unknown } as { statusCode: number; body: unknown; status: (c: number) => typeof res; json: (b: unknown) => typeof res };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; return res; };
  return res;
}

async function run(mw: (req: RequestWithUser, res: Response, next: NextFunction) => unknown, authorization?: string) {
  const req = { headers: authorization ? { authorization } : {} } as RequestWithUser;
  const res = fakeRes();
  const next = vi.fn();
  await mw(req, res as unknown as Response, next);
  return { req, res, next };
}

describe("createAuth", () => {
  it("authRequired: sem token, token inválido e token bom", async () => {
    const auth = createAuth({ jwtSecret: SECRET, loadSessionState: async () => ACTIVE });
    expect((await run(auth.authRequired)).res.statusCode).toBe(401);
    expect((await run(auth.authRequired, "Bearer lixo")).res.statusCode).toBe(401);
    expect((await run(auth.authRequired, `Bearer ${jwt.sign(BASE, "outro-segredo")}`)).res.statusCode).toBe(401);

    const ok = await run(auth.authRequired, `Bearer ${auth.signToken(BASE)}`);
    expect(ok.next).toHaveBeenCalledOnce();
    expect(ok.req.user?.userId).toBe("u1");
  });

  it("papel e organizador vêm do banco, não do token", async () => {
    const auth = createAuth({ jwtSecret: SECRET, loadSessionState: async () => ({ ...ACTIVE, role: "ADMIN", isHoster: true }) });
    const { req } = await run(auth.authRequired, `Bearer ${auth.signToken(BASE)}`);
    expect(req.user?.role).toBe("ADMIN");
    expect(req.user?.isHoster).toBe(true);
  });

  it("conta desativada e senha trocada derrubam o token", async () => {
    const inactive = createAuth({ jwtSecret: SECRET, loadSessionState: async () => ({ ...ACTIVE, isActive: false }) });
    const r1 = await run(inactive.authRequired, `Bearer ${inactive.signToken(BASE)}`);
    expect(r1.res.statusCode).toBe(401);
    expect(r1.next).not.toHaveBeenCalled();

    const revoked = createAuth({ jwtSecret: SECRET, loadSessionState: async () => ({ ...ACTIVE, tokenVersion: 2 }) });
    const r2 = await run(revoked.authRequired, `Bearer ${revoked.signToken({ ...BASE, tv: 1 })}`);
    expect(r2.res.statusCode).toBe(401);
    expect(r2.res.body).toEqual({ error: "Sessão encerrada. Entre de novo." });
  });

  it("banco fora do ar: segue com o que o token diz", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const auth = createAuth({ jwtSecret: SECRET, loadSessionState: async () => { throw new Error("sem banco"); } });
    const { next, req } = await run(auth.authRequired, `Bearer ${auth.signToken(BASE)}`);
    expect(next).toHaveBeenCalledOnce();
    expect(req.user?.role).toBe("USER");
    warn.mockRestore();
  });

  it("authOptional nunca bloqueia e só preenche o usuário com token válido", async () => {
    const auth = createAuth({ jwtSecret: SECRET, loadSessionState: async () => ACTIVE });
    const anon = await run(auth.authOptional);
    expect(anon.next).toHaveBeenCalledOnce();
    expect(anon.req.user).toBeUndefined();
    const bad = await run(auth.authOptional, "Bearer lixo");
    expect(bad.next).toHaveBeenCalledOnce();
    expect(bad.req.user).toBeUndefined();
    const ok = await run(auth.authOptional, `Bearer ${auth.signToken(BASE)}`);
    expect(ok.req.user?.userId).toBe("u1");
  });

  it("roleRequired e hosterRequired", async () => {
    const auth = createAuth({ jwtSecret: SECRET, loadSessionState: async () => ACTIVE });
    const asUser = (user?: Partial<AuthPayload>) => {
      const req = { headers: {}, user: user ? { ...BASE, ...user } : undefined } as RequestWithUser;
      const res = fakeRes();
      const next = vi.fn();
      return { req, res, next, call: (mw: (req: RequestWithUser, res: Response, next: NextFunction) => unknown) => (mw(req, res as unknown as Response, next), { res, next }) };
    };
    expect(asUser().call(auth.roleRequired(["ADMIN"])).res.statusCode).toBe(401);
    expect(asUser({ role: "USER" }).call(auth.roleRequired(["ADMIN"])).res.statusCode).toBe(403);
    expect(asUser({ role: "ADMIN" }).call(auth.roleRequired(["ADMIN"])).next).toHaveBeenCalledOnce();

    expect(asUser({ role: "USER" }).call(auth.hosterRequired).res.statusCode).toBe(403);
    expect(asUser({ role: "USER", isHoster: true }).call(auth.hosterRequired).next).toHaveBeenCalledOnce();
    expect(asUser({ role: "ADMIN" }).call(auth.hosterRequired).next).toHaveBeenCalledOnce();
  });

  it("estado da sessão fica em cache e invalidate força nova leitura", async () => {
    const load = vi.fn(async () => ACTIVE);
    const auth = createAuth({ jwtSecret: SECRET, loadSessionState: load });
    const token = `Bearer ${auth.signToken(BASE)}`;
    await run(auth.authRequired, token);
    await run(auth.authRequired, token);
    expect(load).toHaveBeenCalledTimes(1);
    auth.sessions.invalidate("u1");
    await run(auth.authRequired, token);
    expect(load).toHaveBeenCalledTimes(2);
  });
});
