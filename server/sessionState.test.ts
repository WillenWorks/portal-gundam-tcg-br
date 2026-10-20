import { describe, expect, it, vi } from "vitest";
import { checkSession, createSessionStateCache, type SessionState } from "./sessionState.ts";

const ativo: SessionState = { isActive: true, role: "USER", isHoster: false, tokenVersion: 0 };

describe("checkSession", () => {
  it("aceita token sem tv enquanto a versão no banco for 0", () => {
    expect(checkSession(undefined, ativo)).toBe("ok");
    expect(checkSession(0, ativo)).toBe("ok");
  });

  it("recusa conta desativada ou inexistente", () => {
    expect(checkSession(0, { ...ativo, isActive: false })).toBe("inactive");
    expect(checkSession(0, null)).toBe("inactive");
  });

  it("recusa token de antes da troca de senha", () => {
    expect(checkSession(undefined, { ...ativo, tokenVersion: 1 })).toBe("revoked");
    expect(checkSession(1, { ...ativo, tokenVersion: 2 })).toBe("revoked");
    expect(checkSession(2, { ...ativo, tokenVersion: 2 })).toBe("ok");
  });
});

describe("createSessionStateCache", () => {
  it("consulta o banco uma vez por usuário dentro do prazo", async () => {
    let t = 0;
    const load = vi.fn(async () => ativo);
    const cache = createSessionStateCache(load, 60_000, () => t);
    await cache.get("u1");
    await cache.get("u1");
    t = 59_000;
    await cache.get("u1");
    expect(load).toHaveBeenCalledTimes(1);
    t = 61_000;
    await cache.get("u1");
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("invalidate força nova consulta", async () => {
    const load = vi.fn(async () => ativo);
    const cache = createSessionStateCache(load);
    await cache.get("u1");
    cache.invalidate("u1");
    await cache.get("u1");
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("erro do banco não fica guardado no cache", async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error("db fora")).mockResolvedValueOnce(ativo);
    const cache = createSessionStateCache(load);
    await expect(cache.get("u1")).rejects.toThrow("db fora");
    await expect(cache.get("u1")).resolves.toEqual(ativo);
  });
});
