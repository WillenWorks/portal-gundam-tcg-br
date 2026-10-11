import { describe, expect, it } from "vitest";
import {
  archetypeColors,
  archetypeDetail,
  archetypeRows,
  cardUsage,
  decklist,
  exportLists,
  filters,
  filterTournaments,
  paginate,
  placementLabel,
  player,
  slugify,
  sourceOf,
  summary,
  tournamentCard,
  tournamentDetail,
  VedaIndex,
  type RawCard,
  type RawEntry,
  type RawTournament,
  type VedaData,
} from "./vedaCore.ts";

const card = (id: string, code: string, cardType: string, color: string, cost: number, level = cost): [string, RawCard] => [
  id,
  { cardModelId: `m-${code}`, code, nameEn: code, namePt: null, cardType, color, level, cost, imageUrl: null },
];

const t = (id: string, extra: Partial<RawTournament> = {}): RawTournament => ({
  id,
  name: `Torneio ${id}`,
  organizer: null,
  country: null,
  city: null,
  uf: null,
  season: "GD05",
  tier: "SMALL_OFFICIAL",
  sourceUrl: null,
  participantCount: null,
  roundCount: null,
  date: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-10-10T00:00:00.000Z",
  ...extra,
});

const e = (id: string, tournamentId: string, playerName: string, placement: number | null, archetype: string | null, deckSnapshotId: string | null, wins: number | null = null, losses: number | null = null): RawEntry => ({
  id, tournamentId, playerName, placement, wins, losses, draws: null, archetype, deckSnapshotId,
});

function fixture(): VedaIndex {
  const data: VedaData = {
    seasons: [{ code: "GD05", name: "GD05 — Freedom Ascension", isCurrent: true }],
    tournaments: [
      t("sp", { name: "Locals @ Tamer Shop — 2026-10-09", organizer: "Tamer Shop", country: "Brasil", city: "São Paulo", uf: "SP", date: "2026-10-09T00:00:00.000Z", sourceUrl: "https://gundam.digilab.cards/tournament/10555", participantCount: 12 }),
      t("us", { name: "Milwaukee Regional", tier: "LARGE_OFFICIAL", sourceUrl: "https://deckbuilder.egmanevents.com/gundam/tournaments#x", date: "2026-10-04T00:00:00.000Z" }),
      t("old", { season: "GD04", date: "2026-05-01T00:00:00.000Z" }),
    ],
    entries: [
      e("e1", "sp", "Hidantony", 1, "Purple / Red Banshee", "s1", 3, 0),
      e("e2", "sp", "Dantte", 2, "Blue / Purple Strike Freedom", null, 2, 1),
      e("e3", "sp", "Mechanick", 12, "Red / White MF", null, 0, 3),
      e("e4", "us", "Ana Souza", 1, "Banshee", "s2"),
      e("e5", "us", "Hidantony", 4, "Purple / Red Banshee", "s3"),
      e("e6", "old", "Zé", 1, "Zeon Aggro", "s4"),
    ],
    snapshots: new Map([
      ["s1", [{ cardId: "c1", quantity: 4 }, { cardId: "c2", quantity: 4 }, { cardId: "c3", quantity: 2 }]],
      ["s2", [{ cardId: "c1", quantity: 3 }, { cardId: "c2", quantity: 4 }]],
      ["s3", [{ cardId: "c1b", quantity: 4 }, { cardId: "c3", quantity: 1 }]],
      ["s4", [{ cardId: "c4", quantity: 4 }]],
    ]),
    cards: new Map([
      card("c1", "ST12-006", "UNIT", "Purple", 4),
      card("c1b", "ST12-006", "UNIT", "Purple", 4), // outra impressão da mesma carta
      card("c2", "ST12-012", "PILOT", "Red", 1),
      card("c3", "GD05-110", "COMMAND", "Red", 2),
      card("c4", "GD01-008", "UNIT", "Green", 3),
    ]),
  };
  return new VedaIndex(data);
}

describe("vedaCore — utilitários", () => {
  it("slug sem acento e fonte pelo link", () => {
    expect(slugify("São Paulo / Zé Aggro")).toBe("sao-paulo-ze-aggro");
    expect(sourceOf("https://gundam.digilab.cards/tournament/1").id).toBe("digilab");
    expect(sourceOf("https://deckbuilder.egmanevents.com/gundam/tournaments#a").id).toBe("egman");
    expect(sourceOf(null).id).toBe("manual");
    expect(placementLabel(1)).toBe("1º");
    expect(placementLabel(null)).toBe("—");
  });

  it("cores do arquétipo pelo rótulo ou pela lista", () => {
    expect(archetypeColors("Purple / Red Banshee", null)).toEqual(["Purple", "Red"]);
    expect(archetypeColors("Banshee", [{ card: card("x", "A", "UNIT", "Purple", 1)[1], quantity: 8 }, { card: card("y", "B", "UNIT", "Red", 1)[1], quantity: 4 }, { card: card("z", "C", "UNIT", "Blue", 1)[1], quantity: 1 }])).toEqual(["Purple", "Red"]);
  });

  it("paginação limita e informa se há mais", () => {
    const p = paginate([1, 2, 3, 4, 5], 2, 2);
    expect(p).toEqual({ items: [3, 4], total: 5, offset: 2, limit: 2, hasMore: true });
    expect(paginate([1], 0, 1000).limit).toBe(100);
  });
});

describe("vedaCore — respostas", () => {
  const ix = fixture();

  it("lista filtra por temporada, UF, fonte e busca; mais recente primeiro", () => {
    expect(filterTournaments(ix, { season: "GD05" }).map((x) => x.id)).toEqual(["sp", "us"]);
    expect(filterTournaments(ix, { uf: "sp" }).map((x) => x.id)).toEqual(["sp"]);
    expect(filterTournaments(ix, { source: "egman" }).map((x) => x.id)).toEqual(["us"]);
    expect(filterTournaments(ix, { q: "tamer" }).map((x) => x.id)).toEqual(["sp"]);
    const c = tournamentCard(ix, ix.byId.get("sp")!);
    expect(c.winner?.player).toEqual({ name: "Hidantony", slug: "hidantony" });
    expect(c.winner?.archetype).toEqual({ name: "Purple / Red Banshee", slug: "purple-red-banshee", colors: ["Purple", "Red"] });
    expect(c).toMatchObject({ entriesCount: 3, decklistsCount: 1, source: { id: "digilab" }, place: { city: "São Paulo", uf: "SP", store: "Tamer Shop" } });
  });

  it("report do torneio: classificação com placar e quebra do meta", () => {
    const d = tournamentDetail(ix, "sp")!;
    expect(d.standings.map((s) => [s.placementLabel, s.player.name, s.record, s.hasDecklist])).toEqual([
      ["1º", "Hidantony", "3-0", true],
      ["2º", "Dantte", "2-1", false],
      ["12º", "Mechanick", "0-3", false],
    ]);
    expect(d.meta).toHaveLength(3);
    expect(d.meta[0].share).toBeCloseTo(1 / 3);
    expect(tournamentDetail(ix, "nao-existe")).toBeNull();
  });

  it("decklist agrupada por tipo, com curva e código para o deckbuilder", () => {
    const l = decklist(ix, "e1")!;
    expect(l.groups.map((g) => [g.cardType, g.count])).toEqual([["UNIT", 4], ["PILOT", 4], ["COMMAND", 2]]);
    expect(l.curve).toEqual({ "4": 4, "1": 4, "2": 2 });
    expect(l.deckCode).toBe("ST12-006:4,ST12-012:4,GD05-110:2");
    expect(l.groups[0].cards[0].cardModelId).toBe("m-ST12-006");
    expect(decklist(ix, "e2")).toBeNull(); // sem lista informada
  });

  it("jogador reúne os torneios pelo slug do nome", () => {
    const p = player(ix, "hidantony")!;
    expect(p).toMatchObject({ tournaments: 2, wins: 1, top8: 2 });
    expect(p.results.map((r) => r.tournamentId)).toEqual(["sp", "us"]);
    expect(p.archetypes[0]).toMatchObject({ count: 2, archetype: { slug: "purple-red-banshee" } });
    expect(player(ix, "ninguem")).toBeNull();
  });

  it("arquétipos: presença, top 8 e títulos; detalhe com cartas núcleo", () => {
    const rows = archetypeRows(ix, { season: "GD05" });
    const banshee = rows.find((r) => r.archetype.slug === "purple-red-banshee")!;
    expect(banshee).toMatchObject({ lists: 3, wins: 2, bestPlacement: 1 }); // "Banshee" (Egman) cai no mesmo slug pelas cores da lista
    expect(banshee.top8Share).toBe(1);
    const d = archetypeDetail(ix, "purple-red-banshee", { season: "GD05" })!;
    const st12006 = d.cards.find((c) => c.card.code === "ST12-006")!;
    expect(st12006).toMatchObject({ inclusion: 1, tier: "core" });
    expect(d.sample).toMatchObject({ lists: 3, tournaments: 2, small: true });
    expect(d.sampleDecklists[0]).toMatchObject({ entryId: "e1", tournamentId: "sp" });
  });

  it("uso da carta em torneios junta impressões diferentes do mesmo código", () => {
    const u = cardUsage(ix, "m-ST12-006", { season: "GD05" })!;
    expect(u).toMatchObject({ lists: 3, inclusion: 1 });
    expect(u.avgCopies).toBeCloseTo(11 / 3);
    expect(u.archetypes[0]).toMatchObject({ lists: 3, inclusion: 1 });
  });

  it("resumo, filtros e exportação para o bot", () => {
    const s = summary(ix);
    expect(s.sample).toMatchObject({ tournaments: 3, lists: 4 });
    expect(s.players).toBe(5);
    expect(s.sources.map((x) => x.id).sort()).toEqual(["digilab", "egman", "manual"]);
    expect(filters(ix).ufs).toEqual([{ uf: "SP", cities: ["São Paulo"] }]);
    const lists = exportLists(ix, { season: "GD05" });
    expect(lists).toHaveLength(3);
    expect(lists.find((l) => l.player === "Ana Souza")).toMatchObject({ format: "GD05", eventType: "Large Official Event", placing: 1, main: { "ST12-006": 3, "ST12-012": 4 }, source: "egman" });
  });
});
