import { describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createWhereGuard, findUndefinedInWhere, prismaWhereGuardExtension, whereGuardMode } from "./prismaWhereGuard.ts";

describe("extensão no PrismaClient de verdade", () => {
  it("o argumento chega com a chave undefined e é recusado antes de ir ao banco", async () => {
    const client = new PrismaClient({ datasourceUrl: "postgresql://ninguem:x@127.0.0.1:1/nada" }).$extends(
      prismaWhereGuardExtension({ mode: "throw", report: vi.fn() }),
    );
    const userId: string | undefined = undefined;
    await expect(client.deck.findMany({ where: { userId } })).rejects.toThrow(/Deck\.findMany \(where\.userId\)/);
  });
});

describe("findUndefinedInWhere", () => {
  it("acha undefined direto no where", () => {
    expect(findUndefinedInWhere({ where: { userId: undefined } })).toEqual(["where.userId"]);
  });

  it("acha em OR/AND, relação e where aninhado em include", () => {
    const args = {
      where: { OR: [{ id: "a" }, { ownerId: undefined }], user: { is: { id: undefined } } },
      include: { decks: { where: { userId: undefined }, take: 5 } },
    };
    expect(findUndefinedInWhere(args)).toEqual([
      "where.OR[1].ownerId",
      "where.user.is.id",
      "include.decks.where.userId",
    ]);
  });

  it("ignora undefined fora do where (data, select, take)", () => {
    const args = { where: { id: "x" }, data: { name: undefined }, take: undefined, select: { id: true, bio: undefined } };
    expect(findUndefinedInWhere(args)).toEqual([]);
  });

  it("não entra em Date, null e valores escalares", () => {
    expect(findUndefinedInWhere({ where: { createdAt: { gte: new Date() }, deletedAt: null, n: 0 } })).toEqual([]);
    expect(findUndefinedInWhere(undefined)).toEqual([]);
  });
});

describe("createWhereGuard", () => {
  const bad = { where: { userId: undefined } };

  it("report: avisa uma vez por modelo+operação+caminho e não bloqueia", () => {
    const report = vi.fn();
    const check = createWhereGuard({ mode: "report", report });
    check("Deck", "findMany", bad);
    check("Deck", "findMany", bad);
    check("Deck", "count", bad);
    check("Deck", "findMany", { where: { userId: "u1" } });
    expect(report).toHaveBeenCalledTimes(2);
    expect(report.mock.calls[0][0]).toContain("Deck.findMany (where.userId)");
  });

  it("throw: recusa a consulta", () => {
    const check = createWhereGuard({ mode: "throw", report: vi.fn() });
    expect(() => check("Deck", "deleteMany", bad)).toThrow(/Deck\.deleteMany/);
    expect(() => check("Deck", "deleteMany", { where: { userId: "u1" } })).not.toThrow();
  });

  it("off: não faz nada", () => {
    const report = vi.fn();
    createWhereGuard({ mode: "off", report })("Deck", "findMany", bad);
    expect(report).not.toHaveBeenCalled();
  });

  it("modo vem do ambiente, padrão report", () => {
    expect(whereGuardMode({})).toBe("report");
    expect(whereGuardMode({ PRISMA_WHERE_UNDEFINED: "THROW" })).toBe("throw");
    expect(whereGuardMode({ PRISMA_WHERE_UNDEFINED: "off" })).toBe("off");
    expect(whereGuardMode({ PRISMA_WHERE_UNDEFINED: "qualquer" })).toBe("report");
  });
});
