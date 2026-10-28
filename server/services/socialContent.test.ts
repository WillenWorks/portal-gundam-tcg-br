import { describe, expect, it } from "vitest";
import { VedaIndex, type RawCard, type RawEntry, type RawTournament } from "../vedaCore";
import {
  articlePlainText,
  buildWeeklyReport,
  dayMonth,
  eventLabel,
  formatStoreWithInstagram,
  pickFeaturedDeck,
  rarityAttemptOrder,
  rarityTier,
  reportTournamentCount,
  storeInstagramHandle,
} from "./socialContent";

describe("texto do artigo para a legenda", () => {
  it("tira a marcação do markdown e fica só o texto", () => {
    const md = [
      "# Guia do ST01",
      "",
      "O **Gundam** de [[ST01-001]] é _forte_. Veja [o site](https://x.com/a).",
      "",
      "![capa](https://x/img.png)",
      "",
      "- item um",
      "- item dois",
      "",
      "> citação",
      "",
      "```",
      "const x = 1;",
      "```",
      "",
      "<div>html</div>",
    ].join("\n");
    const text = articlePlainText(md);
    expect(text).toContain("Guia do ST01");
    expect(text).toContain("O Gundam de ST01-001 é forte. Veja o site.");
    expect(text).toContain("item um");
    expect(text).toContain("citação");
    expect(text).not.toMatch(/[#*_[\]!>`<]/);
    expect(text).not.toContain("https://");
    expect(text).not.toContain("const x");
  });

  it("corta no limite sem partir palavra", () => {
    const text = articlePlainText("palavra ".repeat(100), 50);
    expect(text.length).toBeLessThanOrEqual(51);
    expect(text).toMatch(/ palavra…$/);
  });
});

describe("menção de @arroba de lojas parceiras do Brasil", () => {
  it("resolve o @arroba de lojas conhecidas e permite sobrescrever via SOCIAL_STORE_HANDLES", () => {
    expect(storeInstagramHandle("Taverna Game House", {})).toBe("@tavernagamehouse");
    expect(formatStoreWithInstagram("Taverna Game House", {})).toBe("Taverna Game House (@tavernagamehouse)");
    expect(formatStoreWithInstagram("Loja Sem Arroba", {})).toBe("Loja Sem Arroba");
    const customEnv = { SOCIAL_STORE_HANDLES: "Loja X=lojinhax, Outra Loja=@outraloja_tcg" } as NodeJS.ProcessEnv;
    expect(storeInstagramHandle("Loja X", customEnv)).toBe("@lojinhax");
    expect(formatStoreWithInstagram("Outra Loja", customEnv)).toBe("Outra Loja (@outraloja_tcg)");
  });
});

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

describe("sexta: deck em destaque", () => {
  const now = new Date("2026-10-30T12:00:00Z");
  const card = (code: string, cardType = "UNIT", level = 3): RawCard => ({ cardModelId: `m-${code}`, code, nameEn: `Carta ${code}`, namePt: null, cardType, color: "Blue", level, cost: 2, imageUrl: `https://cdn/${code}.jpg` });
  const cards = new Map(["A", "B", "C", "D"].map((c) => [c, card(c, c === "D" ? "COMMAND" : "UNIT", c === "A" ? 5 : 2)]));

  /** cria `n` listas do arquétipo, cada uma num torneio de `players` jogadores, com a colocação dada */
  function build(spec: Array<{ arch: string; n: number; placement: number; players?: number; date?: string; withList?: boolean; uf?: string | null }>) {
    const tournaments: RawTournament[] = [];
    const entries: RawEntry[] = [];
    const snapshots = new Map<string, Array<{ cardId: string; quantity: number }>>();
    let k = 0;
    for (const s of spec) {
      for (let i = 0; i < s.n; i += 1) {
        k += 1;
        const t = tournament({ date: `${s.date ?? "2026-10-20"}T00:00:00.000Z`, participantCount: s.players ?? 16, uf: s.uf === undefined ? null : s.uf, country: s.uf ? "Brasil" : "USA" });
        tournaments.push(t);
        const snap = s.withList === false ? null : `snap${k}`;
        if (snap) snapshots.set(snap, [{ cardId: "A", quantity: 4 }, { cardId: "B", quantity: 4 }, { cardId: k % 2 ? "C" : "D", quantity: 2 }]);
        entries.push({ id: `x${k}`, tournamentId: t.id, playerName: `P${k}`, placement: s.placement, wins: 3, losses: 1, draws: 0, archetype: s.arch, deckSnapshotId: snap });
      }
    }
    return new VedaIndex({ tournaments, entries, snapshots, cards, seasons: [] });
  }

  it("escolhe o arquétipo com maior taxa de top 25% entre os que têm listas suficientes", () => {
    const ix = build([
      { arch: "Blue / White Blockers", n: 15, placement: 9 },
      { arch: "Blue / White Blockers", n: 5, placement: 1 },
      { arch: "Red / White MF", n: 16, placement: 2 },
      { arch: "Purple Banshee", n: 5, placement: 1 }, // 100%, mas poucas listas
    ]);
    const deck = pickFeaturedDeck(ix, now);
    expect(deck?.archetype.name).toBe("Red / White MF");
    expect(deck?.topRate).toBe(1);
    expect(deck?.lists).toBe(16);
  });

  it("local pequeno não infla: 5º de 6 jogadores não é top 25%", () => {
    const ix = build([
      { arch: "Small Locals", n: 16, placement: 5, players: 6 },
      { arch: "Big Events", n: 16, placement: 8, players: 32 },
    ]);
    expect(pickFeaturedDeck(ix, now)?.archetype.name).toBe("Big Events");
  });

  it("não repete o arquétipo destacado nas últimas semanas e exige decklist", () => {
    const ix = build([
      { arch: "Red / White MF", n: 16, placement: 1 },
      { arch: "Sem Lista", n: 16, placement: 1, withList: false },
      { arch: "Blue / White Blockers", n: 16, placement: 4 },
    ]);
    const first = pickFeaturedDeck(ix, now);
    expect(first?.archetype.name).toBe("Red / White MF");
    expect(pickFeaturedDeck(ix, now, [first!.archetype.slug])?.archetype.name).toBe("Blue / White Blockers");
  });

  it("sem arquétipo com 15 listas, baixa para 8; sem nenhum, devolve null", () => {
    expect(pickFeaturedDeck(build([{ arch: "Red / White MF", n: 9, placement: 1 }]), now)?.archetype.name).toBe("Red / White MF");
    expect(pickFeaturedDeck(build([{ arch: "Red / White MF", n: 5, placement: 1 }]), now)).toBeNull();
  });

  it("janela de 30 dias: lista antiga não conta", () => {
    const ix = build([{ arch: "Velho", n: 16, placement: 1, date: "2026-09-01" }, { arch: "Novo", n: 16, placement: 3 }]);
    expect(pickFeaturedDeck(ix, now)?.archetype.name).toBe("Novo");
  });

  it("lista mostrada: a campeã mais recente; cartas agrupadas por tipo e nível; cartas-chave com inclusão ≥ 80%", () => {
    const ix = build([
      { arch: "Red / White MF", n: 10, placement: 2, date: "2026-10-28", uf: "PR" },
      { arch: "Red / White MF", n: 1, placement: 1, date: "2026-10-10" },
      { arch: "Red / White MF", n: 1, placement: 1, date: "2026-10-22" },
    ]);
    const deck = pickFeaturedDeck(ix, now)!;
    expect(deck.entry).toMatchObject({ placement: 1, date: "2026-10-22" });
    expect(deck.brLists).toBe(10);
    expect(deck.cards.map((c) => c.code)).toEqual(["B", "A", deck.cards[2].code]);
    expect(deck.keyCards.map((c) => [c.code, c.inclusion, c.copies])).toEqual([
      ["A", 1, 4],
      ["B", 1, 4],
    ]);
  });
});
