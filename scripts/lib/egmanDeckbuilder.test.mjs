import { describe, expect, it } from "vitest";
import { canonicalList, parseDeckParam, parseDeckbuilderRow, ROW_HEADERS } from "./egmanDeckbuilder.mjs";

const HEADERS = ["PLACE", "PLAYER", "DECK", "EVENT", "EVENT TYPE", "DATE", "RECORD", "DECK LIST"];
const MAIN = "GD01-008:4,ST01-001:4,ST01-010:4,GD01-100:2,GD05-027:4,ST03-008:4,GD05-085:4,GD05-029:4,GD01-030:4,GD05-019:4,GD05-020:4,GD05-017:4,GD03-001:2,GD05-125:2";
const row = (deck, cells = {}) => ({
  headers: HEADERS,
  cells: [cells.place ?? "1", cells.player ?? "Fulano", cells.deck ?? "GD05\nNu Gundam", cells.event ?? "Gen Con Regionals", cells.type ?? "Large Official Event", cells.date ?? "Jul 31, 2026", cells.record ?? "—", "View Deck"],
  href: `https://deckbuilder.egmanevents.com/?deck=${encodeURIComponent(deck)}&type=gundam`,
});

describe("parseDeckParam", () => {
  it("lê CÓDIGO:qtd e soma códigos repetidos", () => {
    expect(parseDeckParam("GD01-001:2,GD01-002:4,GD01-001:1")).toEqual({ main: { "GD01-001": 3, "GD01-002": 4 }, side: null });
  });

  it("separa o side de melhor de 3 depois do `|`", () => {
    expect(parseDeckParam("GD01-001:4|GD02-002:2,GD03-003:1")).toEqual({ main: { "GD01-001": 4 }, side: { "GD02-002": 2, "GD03-003": 1 } });
  });

  it("recusa entrada malformada", () => {
    expect(() => parseDeckParam("GD01-001")).toThrow(/malformad/);
    expect(() => parseDeckParam("GD01-001:x")).toThrow(/malformad/);
  });
});

describe("parseDeckbuilderRow", () => {
  it("normaliza uma linha da tabela de torneios", () => {
    const list = parseDeckbuilderRow(row(MAIN, { deck: "GD05\nStrike Freedom Gundam\n(Victory Gundam)" }), "GD05");
    expect(list).toMatchObject({
      format: "GD05",
      event: "Gen Con Regionals",
      eventType: "Large Official Event",
      date: "2026-07-31",
      placing: 1,
      leaderSet: "GD05",
      label: "Strike Freedom Gundam",
      secondLabel: "Victory Gundam",
      player: "Fulano",
      side: null,
    });
    expect(Object.values(list.main).reduce((a, b) => a + b, 0)).toBe(50);
  });

  it("formatos antigos: a célula de deck é só o nome livre do arquétipo", () => {
    const list = parseDeckbuilderRow(row(MAIN, { deck: "Zeon Aggro" }), "GD01");
    expect(list).toMatchObject({ leaderSet: null, label: "Zeon Aggro", secondLabel: null });
  });

  it("colocação sem número vira null (bloco/pod) e '—' vira null", () => {
    const list = parseDeckbuilderRow(row(MAIN, { place: "Block A", record: "—", type: "—" }), "GD05");
    expect(list.placing).toBeNull();
    expect(list.record).toBeNull();
    expect(list.eventType).toBeNull();
  });

  it("linha sem link de deck devolve null", () => {
    expect(parseDeckbuilderRow({ ...row(MAIN), href: "https://deckbuilder.egmanevents.com/gundam" }, "GD05")).toBeNull();
  });

  it("falha alto se as colunas esperadas sumirem (o site mudou)", () => {
    expect(() => parseDeckbuilderRow({ ...row(MAIN), headers: ["A", "B"] }, "GD05")).toThrow(/colunas/);
    expect(ROW_HEADERS).toContain("DECK");
  });
});

describe("canonicalList", () => {
  it("é estável independente da ordem", () => {
    expect(canonicalList({ "B-1": 2, "A-1": 4 })).toBe(canonicalList({ "A-1": 4, "B-1": 2 }));
  });
});
