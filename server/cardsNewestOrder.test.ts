import { describe, expect, it } from "vitest";
import { sortNewestFirstByCode } from "./cardsNewestOrder";

const row = (code: string, createdAt: string) => ({ code, createdAt: new Date(createdAt) });

describe("sortNewestFirstByCode", () => {
  it("dentro da mesma carga, ordena por código crescente mesmo com horários diferentes", () => {
    const rows = [
      row("T-030", "2026-10-31T14:48:10.965Z"),
      row("GD06-002", "2026-10-31T14:48:10.100Z"),
      row("GD06-001", "2026-10-31T14:48:10.500Z"),
    ];
    expect(sortNewestFirstByCode(rows).map((r) => r.code)).toEqual(["GD06-001", "GD06-002", "T-030"]);
  });

  it("o cadastro mais novo vem antes, mesmo com código maior", () => {
    const rows = [row("EB01-001", "2026-10-02T19:07:22.000Z"), row("GD06-130", "2026-10-31T14:48:10.000Z")];
    expect(sortNewestFirstByCode(rows).map((r) => r.code)).toEqual(["GD06-130", "EB01-001"]);
  });

  it("não altera a lista recebida", () => {
    const rows = [row("B", "2026-10-31T00:00:00.000Z"), row("A", "2026-10-31T00:00:00.000Z")];
    sortNewestFirstByCode(rows);
    expect(rows.map((r) => r.code)).toEqual(["B", "A"]);
  });
});
