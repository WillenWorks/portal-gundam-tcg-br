import { describe, expect, it } from "vitest";

import { ActionDeduper, ChallengeRegistry, normalizeChallengeCode } from "./socketBridge";

describe("ChallengeRegistry — convite direto por link (docs/39 §4)", () => {
  it("cria um código no formato GC-#### e empareija host + convidado", () => {
    const reg = new ChallengeRegistry();
    const entry = reg.create({ hostUserId: "u1", hostDisplayName: "Willen", hostDeckKey: "ST01" });
    expect(entry.code).toMatch(/^GC-\d{4}$/);

    const pairing = reg.accept({ code: entry.code, guestUserId: "u2", guestDisplayName: "Amiga", guestDeckKey: "ST02" });
    expect(pairing).toMatchObject({
      hostUserId: "u1",
      hostDeckKey: "ST01",
      guestUserId: "u2",
      guestDeckKey: "ST02",
    });
  });

  it("aceita o código sem diferenciar caixa/espaço", () => {
    const reg = new ChallengeRegistry();
    const { code } = reg.create({ hostUserId: "u1", hostDisplayName: "W", hostDeckKey: "ST01" });
    expect(() => reg.accept({ code: `  ${code.toLowerCase()} `, guestUserId: "u2", guestDisplayName: "A", guestDeckKey: "ST01" })).not.toThrow();
  });

  it("consome o código: aceitar duas vezes falha na segunda", () => {
    const reg = new ChallengeRegistry();
    const { code } = reg.create({ hostUserId: "u1", hostDisplayName: "W", hostDeckKey: "ST01" });
    reg.accept({ code, guestUserId: "u2", guestDisplayName: "A", guestDeckKey: "ST02" });
    expect(() => reg.accept({ code, guestUserId: "u3", guestDisplayName: "B", guestDeckKey: "ST02" })).toThrow(/inválido ou expirado/);
  });

  it("o host não pode aceitar o próprio convite", () => {
    const reg = new ChallengeRegistry();
    const { code } = reg.create({ hostUserId: "u1", hostDisplayName: "W", hostDeckKey: "ST01" });
    expect(() => reg.accept({ code, guestUserId: "u1", guestDisplayName: "W", guestDeckKey: "ST01" })).toThrow(/duas contas diferentes/);
  });

  it("criar de novo pelo mesmo host invalida o convite anterior", () => {
    const reg = new ChallengeRegistry();
    const first = reg.create({ hostUserId: "u1", hostDisplayName: "W", hostDeckKey: "ST01" });
    const second = reg.create({ hostUserId: "u1", hostDisplayName: "W", hostDeckKey: "ST02" });
    expect(first.code).not.toBe(second.code);
    expect(reg.peek(first.code)).toBeUndefined();
    expect(reg.peek(second.code)?.hostDeckKey).toBe("ST02");
  });

  it("expira o convite depois do TTL (relógio injetado)", () => {
    let now = 0;
    const reg = new ChallengeRegistry(() => now);
    const { code } = reg.create({ hostUserId: "u1", hostDisplayName: "W", hostDeckKey: "ST01" });
    now += 10 * 60_000 + 1;
    expect(() => reg.accept({ code, guestUserId: "u2", guestDisplayName: "A", guestDeckKey: "ST02" })).toThrow(/expirado/);
  });
});

describe("ActionDeduper — idempotência de ações por actionSeq (docs/39 §3.2)", () => {
  it("aplica seq crescente e ignora reenvio (seq igual ou menor)", () => {
    const d = new ActionDeduper();
    expect(d.shouldApply("m1", "A", 1)).toBe(true);
    d.markApplied("m1", "A", 1);
    expect(d.shouldApply("m1", "A", 1)).toBe(false); // reenvio da mesma ação
    expect(d.shouldApply("m1", "A", 0)).toBe(false);
    expect(d.shouldApply("m1", "A", 2)).toBe(true); // ação nova
  });

  it("dedupe é por (matchId, seat) — assentos e partidas não se contaminam", () => {
    const d = new ActionDeduper();
    d.markApplied("m1", "A", 5);
    expect(d.shouldApply("m1", "B", 1)).toBe(true);
    expect(d.shouldApply("m2", "A", 1)).toBe(true);
    expect(d.lastApplied("m1", "A")).toBe(5);
    expect(d.lastApplied("m1", "B")).toBe(0);
  });

  it("seq ausente/NaN (cliente legado) sempre aplica", () => {
    const d = new ActionDeduper();
    expect(d.shouldApply("m1", "A", Number.NaN)).toBe(true);
    d.markApplied("m1", "A", Number.NaN);
    expect(d.lastApplied("m1", "A")).toBe(0);
  });

  it("forget limpa o rastro de uma partida encerrada", () => {
    const d = new ActionDeduper();
    d.markApplied("m1", "A", 3);
    d.forget("m1");
    expect(d.shouldApply("m1", "A", 1)).toBe(true);
  });
});

describe("normalizeChallengeCode", () => {
  it("tira espaço e sobe pra maiúsculas", () => {
    expect(normalizeChallengeCode("  gc-1234 ")).toBe("GC-1234");
  });
});
