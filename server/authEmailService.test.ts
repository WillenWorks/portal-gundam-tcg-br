import { describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { consumeToken, createMailer, hashToken, issueToken, resetPasswordMessage, verifyEmailMessage } from "./authEmailService.ts";

type Row = { id: string; userId: string; type: string; tokenHash: string; expiresAt: Date; usedAt: Date | null };

/** prisma falso só com o que o serviço usa de authToken */
function fakePrisma() {
  const rows: Row[] = [];
  let seq = 0;
  const matches = (r: Row, where: Record<string, unknown>) => Object.entries(where).every(([k, v]) => (r as Record<string, unknown>)[k] === v);
  const authToken = {
    updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Partial<Row> }) => {
      const hit = rows.filter((r) => matches(r, where));
      for (const r of hit) Object.assign(r, data);
      return { count: hit.length };
    },
    create: async ({ data }: { data: Omit<Row, "id" | "usedAt"> }) => {
      const row = { id: `t${++seq}`, usedAt: null, ...data };
      rows.push(row);
      return row;
    },
    findUnique: async ({ where }: { where: { tokenHash: string } }) => rows.find((r) => r.tokenHash === where.tokenHash) ?? null,
  };
  const prisma = { authToken, $transaction: async (ops: Promise<unknown>[]) => Promise.all(ops) } as unknown as PrismaClient;
  return { prisma, rows };
}

describe("tokens de e-mail", () => {
  it("só o hash fica guardado; o token vale uma vez e só para o seu tipo", async () => {
    const { prisma, rows } = fakePrisma();
    const raw = await issueToken(prisma, "u1", "PASSWORD_RESET", 60_000);
    expect(rows[0].tokenHash).toBe(hashToken(raw));
    expect(rows[0].tokenHash).not.toContain(raw);
    expect(await consumeToken(prisma, raw, "EMAIL_VERIFY")).toEqual({ error: "invalido" });
    expect(await consumeToken(prisma, raw, "PASSWORD_RESET")).toEqual({ userId: "u1" });
    expect(await consumeToken(prisma, raw, "PASSWORD_RESET")).toEqual({ error: "usado" });
    expect(await consumeToken(prisma, "outro", "PASSWORD_RESET")).toEqual({ error: "invalido" });
  });

  it("expira e o pedido novo invalida o anterior", async () => {
    const { prisma } = fakePrisma();
    const t0 = new Date("2026-10-11T12:00:00Z");
    const old = await issueToken(prisma, "u1", "EMAIL_VERIFY", 60_000, t0);
    const fresh = await issueToken(prisma, "u1", "EMAIL_VERIFY", 60_000, t0);
    expect(await consumeToken(prisma, old, "EMAIL_VERIFY", t0)).toEqual({ error: "usado" });
    expect(await consumeToken(prisma, fresh, "EMAIL_VERIFY", new Date(t0.getTime() + 61_000))).toEqual({ error: "expirado" });
  });
});

describe("mensagens", () => {
  it("link nos dois formatos e nome escapado", () => {
    const m = verifyEmailMessage("a@b.com", "<Ana>", "https://anaheimhub.com/confirmar-email?token=x");
    expect(m.subject).toContain("Confirme");
    expect(m.html).toContain("&lt;Ana&gt;");
    expect(m.html).toContain("https://anaheimhub.com/confirmar-email?token=x");
    expect(m.text).toContain("https://anaheimhub.com/confirmar-email?token=x");
    expect(resetPasswordMessage("a@b.com", "Ana", "https://x/redefinir-senha?token=y").text).toContain("1 hora");
  });

  it("sem SMTP configurado não envia e não quebra", async () => {
    const mailer = createMailer({});
    expect(mailer.configured).toBe(false);
    expect(await mailer.send({ to: "a@b.com", subject: "s", html: "h", text: "t" })).toBe(false);
  });
});
