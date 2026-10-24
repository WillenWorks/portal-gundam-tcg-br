import { describe, expect, it } from "vitest";
import { VedaIndex, type RawEntry, type RawTournament } from "../vedaCore";
import { buildWeeklyReport, dayMonth, eventLabel, rarityAttemptOrder, rarityTier, reportTournamentCount } from "./socialContent";

describe("rodízio de raridade da carta do dia", () => {
  it("normaliza os dois formatos do banco e as artes alternativas", () => {
    expect(rarityTier("Legend Rare")).toBe("LR");
    expect(rarityTier("LR++")).toBe("LR");
    expect(rarityTier("Rare")).toBe("R");
    expect(rarityTier("U+")).toBe("U");
    expect(rarityTier("Common")).toBe("C");
    expect(rarityTier("C++")).toBe("C");
    expect(rarityTier("Promo")).toBeNull();
    expect(rarityTier("TOKEN")).toBeNull();
    expect(rarityTier(null)).toBeNull();
  });

  it("segue LR → R → U → C e volta ao LR", () => {
    expect(rarityAttemptOrder(null)[0]).toBe("LR");
    expect(rarityAttemptOrder("LR")[0]).toBe("R");
    expect(rarityAttemptOrder("R")[0]).toBe("U");
    expect(rarityAttemptOrder("U")[0]).toBe("C");
    expect(rarityAttemptOrder("C")[0]).toBe("LR");
  });

  it("se faltar carta na faixa da vez, tenta as seguintes na ordem do rodízio", () => {
    expect(rarityAttemptOrder("R")).toEqual(["U", "C", "LR", "R"]);
  });
});

let seq = 0;
function tournament(over: Partial<RawTournament> & { date: string }): RawTournament {
  seq += 1;
  return {
    id: `t${seq}`,
    name: `Locals @ Loja ${seq} — ${over.date.slice(0, 10)}`,
    organizer: `Loja ${seq}`,
    country: "Brasil",
    city: "Curitiba",
    uf: "PR",
    season: null,
    tier: "SMALL_OFFICIAL",
    sourceUrl: "https://digilab.example/x",
    participantCount: 8,
    roundCount: null,
    updatedAt: over.date,
    ...over,
  };
}
function entry(t: RawTournament, placement: number | null, player: string, archetype: string | null, wins = 3, losses = 0): RawEntry {
  seq += 1;
  return { id: `e${seq}`, tournamentId: t.id, playerName: player, placement, wins, losses, draws: 0, archetype, deckSnapshotId: null };
}
function index(tournaments: RawTournament[], entries: RawEntry[]) {
  return new VedaIndex({ tournaments, entries, snapshots: new Map(), cards: new Map(), seasons: [] });
}
const week = { from: "2026-10-19", to: "2026-10-25" };

describe("segunda: torneios do Brasil da semana", () => {
  it("só entram torneios brasileiros dentro da semana (segunda a domingo)", () => {
    const inWeek = tournament({ date: "2026-10-19T00:00:00.000Z" });
    const sunday = tournament({ date: "2026-10-25T00:00:00.000Z", city: "Florianópolis", uf: "SC" });
    const before = tournament({ date: "2026-10-18T00:00:00.000Z" });
    const after = tournament({ date: "2026-10-26T00:00:00.000Z" });
    const abroad = tournament({ date: "2026-10-20T00:00:00.000Z", country: "USA", uf: null, city: "Dallas" });
    const report = buildWeeklyReport(index([inWeek, sunday, before, after, abroad], []), week);
    expect(report.featured.map((t) => t.id)).toEqual([inWeek.id, sunday.id]);
    expect(report.cities).toEqual(["Curitiba-PR", "Florianópolis-SC"]);
    expect(report.totalPlayers).toBe(16);
  });

  it("top 4 com arquétipo e campanha; campeões da semana contados por arquétipo", () => {
    const a = tournament({ date: "2026-10-21T00:00:00.000Z" });
    const b = tournament({ date: "2026-10-22T00:00:00.000Z" });
    const entries = [
      entry(a, 1, "Johann", "Blue / Green Nu Gundam", 4, 0),
      entry(a, 2, "Passamani", "Red / White MF", 3, 1),
      entry(a, 3, "Adal", null, 3, 1),
      entry(a, 4, "Lukas", "Blue / White Strike Freedom Blockers", 3, 1),
      entry(a, 5, "Furian", "Red / White MF", 3, 1),
      entry(b, 1, "Doug", "Blue / Green Nu Gundam"),
    ];
    const report = buildWeeklyReport(index([a, b], entries), week);
    const first = report.featured[0];
    expect(first.top.map((p) => [p.placement, p.player, p.record])).toEqual([
      [1, "Johann", "4-0"],
      [2, "Passamani", "3-1"],
      [3, "Adal", "3-1"],
      [4, "Lukas", "3-1"],
    ]);
    expect(first.top[2].archetype).toBeNull();
    expect(report.champions).toEqual([{ archetype: expect.objectContaining({ name: "Blue / Green Nu Gundam" }), wins: 2 }]);
    // 5 inscrições com arquétipo: Nu Gundam 2, MF 2, Strike Freedom 1 (a sem arquétipo não conta)
    expect(report.mostPlayed.map((p) => [p.archetype.name, p.lists, p.share])).toEqual([
      ["Blue / Green Nu Gundam", 2, 0.4],
      ["Red / White MF", 2, 0.4],
      ["Blue / White Strike Freedom Blockers", 1, 0.2],
    ]);
  });

  it("torneio só com o campeão: mostra só o campeão, sem top vazio", () => {
    const t = tournament({ date: "2026-10-20T00:00:00.000Z" });
    const report = buildWeeklyReport(index([t], [entry(t, 1, "Ronaldo", "Red / White Academy")]), week);
    expect(report.featured[0].top).toHaveLength(1);
  });

  it("mais de 8 torneios: os 8 com mais jogadores ganham slide (em ordem de data); o resto vai para o resumo", () => {
    const list = Array.from({ length: 10 }, (_, i) => tournament({ date: `2026-10-${String(19 + (i % 7)).padStart(2, "0")}T00:00:00.000Z`, participantCount: 10 + i }));
    const report = buildWeeklyReport(index(list, []), week);
    expect(report.featured).toHaveLength(8);
    expect(report.others.map((t) => t.players).sort()).toEqual([10, 11]);
    expect(report.featured.map((t) => t.date)).toEqual([...report.featured.map((t) => t.date)].sort());
    expect(reportTournamentCount(report)).toBe(10);
  });

  it("semana sem torneio no Brasil devolve relatório vazio", () => {
    expect(reportTournamentCount(buildWeeklyReport(index([], []), week))).toBe(0);
  });

  it("nome do evento sem loja e data; data em dd/mm", () => {
    expect(eventLabel("Locals @ Taverna Game House — 2026-10-21", "Taverna Game House")).toBe("Locals");
    expect(eventLabel("Store Championship @ Forja Hobby Store — 2026-10-15", "Forja Hobby Store")).toBe("Store Championship");
    expect(eventLabel("Regional Sul", "Loja X")).toBe("Regional Sul");
    expect(dayMonth("2026-10-05")).toBe("05/10");
  });
});
