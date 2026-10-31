import { describe, expect, it, vi } from "vitest";
import { egmanTier, egmanToEvents, parseRecord } from "../scripts/meta-sources/egman.mjs";
import { duplicateRulingIds, parseOfficialDate, planModelFaq } from "./import-card-faq.mjs";
import { normalizeRarity, planSeedFix } from "./fix-seed-prints.mjs";
import { seasonRows, snapshotItems } from "./import-tournaments.mjs";

describe("impressões seed sem imagem", () => {
  const sets = new Map([
    [1765, "GD01"],
    [318202, null],
    [2049, "GD01"],
    [1774, "GD01"],
    [2283, "GD01_b"],
  ]);
  const print = (id, externalId, rarity, extra = {}) => ({ id, externalId, rarity, isPrimaryPrint: false, imageUrl: `img-${id}`, ...extra });

  it("escolhe a gêmea do set de origem e de mesma raridade (GD01-090)", () => {
    const prints = [
      print("seed", "seed:GD01-090", "R", { isPrimaryPrint: true, imageUrl: null }),
      print("a", "apitcg:318202", "Rare"),
      print("b", "apitcg:2049", "Rare"),
      print("c", "apitcg:1765", "Rare"),
      print("d", "apitcg:1852", "R+"),
    ];
    expect(planSeedFix(prints, sets, "GD01")?.twin.id).toBe("c");
  });

  it("nunca usa a Edition Beta quando há a impressão do set (GD01-099)", () => {
    const prints = [print("seed", "seed:GD01-099", "R", { isPrimaryPrint: true, imageUrl: null }), print("beta", "apitcg:2283", "Rare"), print("base", "apitcg:1774", "Rare")];
    expect(planSeedFix(prints, sets, "GD01")?.twin.id).toBe("base");
  });

  it("não mexe quando a principal já tem imagem ou não há gêmea", () => {
    expect(planSeedFix([print("seed", "seed:X", "R", { isPrimaryPrint: true })], sets, "GD01")).toBeNull();
    expect(planSeedFix([print("seed", "seed:X", "R", { isPrimaryPrint: true, imageUrl: null }), print("p", "apitcg:1765", "R+")], sets, "GD01")).toBeNull();
  });

  it("raridades por extenso e abreviadas batem", () => {
    expect(normalizeRarity("Legend Rare")).toBe("LR");
    expect(normalizeRarity("LR")).toBe("LR");
    expect(normalizeRarity("RESOURCE")).toBe(normalizeRarity("Common"));
  });
});

describe("FAQ por carta", () => {
  it("não repete pergunta já gravada (pelo link ou pelo texto)", () => {
    const entries = [
      { id: "Q1", date: "September 11, 2026", question: "Does it work?", answer: "Yes." },
      { id: "Q2", date: "", question: "Already  here?", answer: "No." },
      { id: "Q3", date: "", question: "New one?", answer: "Sure." },
    ];
    const existing = [{ originalUrl: "https://www.gundam-gcg.com/en/cards/detail.php?detailSearch=ST12-001#Q1" }, { questionEn: "already here?" }];
    expect(planModelFaq("ST12-001", entries, existing).map((p) => p.id)).toEqual(["Q3"]);
  });

  it("desativa a cópia mais nova da mesma pergunta no mesmo modelo", () => {
    const rulings = [
      { id: "new", cardModelId: "m", questionEn: "Does Gundam gain Repair 1?", createdAt: "2026-10-02T19:07:16Z" },
      { id: "old", cardModelId: "m", questionEn: "Does Gundam gain  Repair 1?", createdAt: "2026-10-02T19:07:15Z" },
      { id: "other", cardModelId: "n", questionEn: "Does Gundam gain Repair 1?", createdAt: "2026-10-02T19:07:17Z" },
    ];
    expect(duplicateRulingIds(rulings)).toEqual(["new"]);
  });

  it("lê a data do site oficial", () => {
    expect(parseOfficialDate("September 11, 2026")?.toISOString().slice(0, 10)).toBe("2026-09-11");
    expect(parseOfficialDate("")).toBeNull();
  });
});

describe("torneios (Veda)", () => {
  it("agrupa as listas da Egman por evento e ignora o que não é evento", () => {
    const raw = {
      lists: [
        { format: "GD05", event: "Regionals SP", eventType: "Large Official Event", date: "2026-09-20", placing: 1, record: "6-1", label: "Wing", player: "Ana", main: { "ST12-001": 4 } },
        { format: "GD05", event: "Regionals SP", eventType: "Large Official Event", date: "2026-09-20", placing: 2, record: null, label: "Unicorn", player: "Bia", main: { "ST13-001": 4 } },
        { format: "GD05", event: "Total", eventType: "Total Color Breakdown", date: "2026-09-20", placing: 1, label: "x", player: "x", main: { "A": 1 } },
      ],
    };
    const { events } = egmanToEvents(raw);
    expect(events).toHaveLength(1);
    expect(events[0].tier).toBe("LARGE_OFFICIAL");
    expect(events[0].entries.map((e) => [e.player, e.placement, e.wins, e.losses])).toEqual([
      ["Ana", 1, 6, 1],
      ["Bia", 2, null, null],
    ]);
  });

  it("classifica o tipo de evento e o placar", () => {
    expect(egmanTier("Small Official")).toBe("SMALL_OFFICIAL");
    expect(egmanTier("Official Event")).toBe("SMALL_OFFICIAL");
    expect(egmanTier("Unofficial Event")).toBe("UNOFFICIAL");
    expect(egmanTier(null)).toBe("UNOFFICIAL");
    expect(parseRecord("3-1-1")).toEqual({ wins: 3, losses: 1, draws: 1 });
  });

  it("temporadas encadeadas, só a última é a atual", () => {
    const rows = seasonRows();
    expect(rows.map((r) => r.code)).toEqual(["GD01", "GD02", "GD03", "GD04", "GD05", "GD06"]);
    expect(rows[0].endDate?.toISOString().slice(0, 10)).toBe("2025-10-23");
    // abrir o GD06 fecha o GD05 na véspera do lançamento
    expect(rows.find((r) => r.code === "GD05").endDate?.toISOString().slice(0, 10)).toBe("2026-10-29");
    expect(rows.filter((r) => r.isCurrent).map((r) => r.code)).toEqual(["GD06"]);
  });

  it("lista vira itens com a impressão principal e aponta códigos fora do catálogo", () => {
    const { items, missing } = snapshotItems({ "GD01-001": 4, "XX-999": 1 }, new Map([["GD01-001", "print-1"]]));
    expect(items).toEqual([{ cardId: "print-1", quantity: 4, section: "main" }]);
    expect(missing).toEqual(["XX-999"]);
  });
});

describe("DigiLab Brasil (páginas públicas)", async () => {
  const { digilabTier, parseDecklist, parseStore, parseTournament, sitemapStores } = await import("../scripts/meta-sources/digilab-br.mjs");
  const ld = (o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`;
  const row = (place, cls, player, deck, record, decklist) =>
    `<tr><td class="col-place"><span class="${cls}"> ${place} </span></td><td><a href="/player/x" class="player-chip-name" title="${player}">${player}</a></td>` +
    `<td><a href="/deck/x" class="deck-link"><span class="deck-dots"><span class="deck-dot">●</span></span> ${deck} </a></td><td class="mono-cell">${record}</td>` +
    `<td>${decklist ? `<a href="/decklist/${decklist}" class="decklist-chip">` : ""}</td></tr>`;

  it("lojas do sitemap e endereço da loja", () => {
    expect(sitemapStores("<loc>https://gundam.digilab.cards/store/loja-a</loc><loc>https://gundam.digilab.cards/player/p</loc>")).toEqual(["loja-a"]);
    const html = ld({ "@type": "LocalBusiness", name: "Loja A", address: { addressLocality: "Curitiba", addressRegion: "Paraná", addressCountry: "Brazil" } }) + '<a href="/tournament/7"></a><a href="/tournament/7"></a><a href="/tournament/9"></a>';
    expect(parseStore(html)).toEqual({ name: "Loja A", country: "Brazil", city: "Curitiba", region: "Paraná", tournamentIds: [7, 9] });
  });

  it("torneio: cabeçalho, classificação (com e sem selo) e decklist", () => {
    const html =
      ld({ "@type": "SportsEvent", name: "Regionals @ Hakka", description: "Regionals @ Hakka — 202 players, GD05, Sep 20, 2026.", startDate: "2026-09-20", numberOfAthletes: 202, location: { name: "Hakka Eventos", address: "São Paulo, São Paulo, Brazil" } }) +
      "<table><caption>Tournament standings</caption><tbody>" +
      row("1st", "placement-badge place-1st", "Ana &amp; Bia", "Purple / Red Banshee", "6-1", 55) +
      row("12", "placement-num", "Caio", "Red / White MF", "2-3-1", null) +
      "</tbody></table>";
    const ev = parseTournament(html, 42);
    expect(ev).toMatchObject({ key: "digilab:42", format: "GD05", date: "2026-09-20", tier: "LARGE_OFFICIAL", organizer: "Hakka Eventos", country: "Brasil", city: "São Paulo", participantCount: 202 });
    expect(ev.entries).toEqual([
      { player: "Ana & Bia", placement: 1, wins: 6, losses: 1, draws: null, archetype: "Purple / Red Banshee", decklistId: 55 },
      { player: "Caio", placement: 12, wins: 2, losses: 3, draws: 1, archetype: "Red / White MF", decklistId: null },
    ]);
    expect(parseDecklist('<a href="https://x/?decklist=ST13-006:3,GD01-044:4,">')).toEqual({ "ST13-006": 3, "GD01-044": 4 });
  });

  it("tipo de evento → categoria", () => {
    expect(digilabTier("Locals")).toBe("SMALL_OFFICIAL");
    expect(digilabTier("Store Championship")).toBe("SMALL_OFFICIAL");
    expect(digilabTier("Area Finals")).toBe("LARGE_OFFICIAL");
    expect(digilabTier("Online")).toBe("UNOFFICIAL");
  });
});

describe("coleta incremental e duplicidade entre fontes", async () => {
  const { planTournamentFetch } = await import("../scripts/meta-sources/digilab-br.mjs");
  const { crossSourceDuplicate, deckSimilarity, keepsExisting } = await import("./import-tournaments.mjs");

  it("relê só os torneios novos ou importados há menos de 21 dias", () => {
    const known = new Map([
      [1, "2026-08-01T00:00:00.000Z"], // antigo: pula
      [2, "2026-10-01T00:00:00.000Z"], // recente: relê (decklists chegam depois)
      [3, null],
    ]);
    expect(planTournamentFetch([1, 2, 3, 4], known, "2026-10-10T12:00:00.000Z")).toEqual([2, 3, 4]);
  });

  const EGMAN = "https://deckbuilder.egmanevents.com/gundam/tournaments#x";
  const DIGILAB = "https://gundam.digilab.cards/tournament/9";
  const people = (...names) => names.map((player, i) => ({ player, placement: i + 1 }));

  it("o mesmo evento de outra fonte é reconhecido pelo campeão, data, temporada e jogadores em comum", () => {
    const ev = { sourceUrl: DIGILAB, format: "GD05", date: "2026-09-20", entries: people("José Silva", "Ana", "Bia", "Caio", "Davi") };
    const egman = { id: "t1", sourceUrl: EGMAN, season: "GD05", date: "2026-09-21T00:00:00.000Z", champion: "Jose silva", players: ["Jose silva", "ana", "Caio"], lists: 3 };
    expect(crossSourceDuplicate(ev, [egman])?.id).toBe("t1");
    expect(crossSourceDuplicate(ev, [{ ...egman, champion: "Outro" }])).toBeNull();
    expect(crossSourceDuplicate(ev, [{ ...egman, date: "2026-09-25T00:00:00.000Z" }])).toBeNull();
    expect(crossSourceDuplicate(ev, [{ ...egman, season: "GD04" }])).toBeNull();
    expect(crossSourceDuplicate(ev, [{ ...egman, sourceUrl: "https://gundam.digilab.cards/tournament/7" }])).toBeNull(); // mesma fonte: são eventos diferentes
  });

  it("campeão e data iguais, mas só o campeão em comum, são eventos diferentes (apelido curto, loja com 2 eventos no dia)", () => {
    // Newtype Challenge de 04/08: "JP" venceu um na Egman e dois na DigiLab, com 1 jogador em comum cada
    const ev = { sourceUrl: DIGILAB, format: "GD05", date: "2026-08-04", entries: people("JP", "Rui", "Leo", "Max") };
    const egman = { id: "t1", sourceUrl: EGMAN, season: "GD05", date: "2026-08-04T00:00:00.000Z", champion: "JP", players: ["JP", "Kai", "Noa", "Ivo"], lists: 4 };
    expect(crossSourceDuplicate(ev, [egman])).toBeNull();
  });

  it("entre dois candidatos fica o com mais jogadores em comum", () => {
    const ev = { sourceUrl: EGMAN, format: "GD03", date: "2026-02-06", entries: people("CyberJX7", "A1", "A2", "A3", "A4") };
    const small = { id: "pequeno", sourceUrl: DIGILAB, season: "GD03", date: "2026-02-06T00:00:00.000Z", champion: "CyberJX7", players: ["CyberJX7", "A1", "Z1", "Z2"], lists: 0 };
    const big = { ...small, id: "grande", players: ["CyberJX7", "A1", "A2", "A3", "Z3"] };
    expect(crossSourceDuplicate(ev, [small, big])?.id).toBe("grande");
  });

  it("evento só com o campeão: confirma pela lista dele quando as duas fontes a têm", () => {
    const deck = { "GD05-001": 4, "GD05-002": 4, "GD05-003": 4, "ST11-001": 4, "GD05-010": 2 };
    const ev = { sourceUrl: EGMAN, format: "GD05", date: "2026-10-12", entries: [{ player: "Citizen001", placement: 1, main: deck }] };
    const dl = { id: "d1", sourceUrl: DIGILAB, season: "GD05", date: "2026-10-12T00:00:00.000Z", champion: "citizen001", players: ["citizen001", "x", "y"], championDeck: deck, lists: 1 };
    expect(crossSourceDuplicate(ev, [dl])?.id).toBe("d1");
    expect(crossSourceDuplicate(ev, [{ ...dl, championDeck: { "GD01-001": 4, "GD01-002": 4, "GD05-001": 4 } }])).toBeNull();
    expect(crossSourceDuplicate(ev, [{ ...dl, championDeck: null }])?.id).toBe("d1"); // sem lista para comparar: campeão + data bastam
    expect(deckSimilarity(deck, deck)).toBe(1);
    expect(deckSimilarity(deck, null)).toBeNull();
  });

  it("fica a coleta com mais listas; no empate, a com mais jogadores", () => {
    const withList = { items: [{}] };
    const noList = { items: [] };
    expect(keepsExisting([withList, withList], { lists: 16, entries: 16 })).toBe(true); // DigiLab menor: mantém a Egman
    expect(keepsExisting(Array(20).fill(withList), { lists: 16, entries: 16 })).toBe(false); // DigiLab com 20 listas: substitui
    expect(keepsExisting([withList, noList, noList], { lists: 1, entries: 1 })).toBe(false); // empate em listas, mais jogadores
    expect(keepsExisting([withList], { lists: 1, entries: 1 })).toBe(true);
  });
});

describe("auditoria de duplicados entre fontes", async () => {
  const { findDuplicatePairs } = await import("./audit-tournament-duplicates.mjs");
  const t = (id, sourceUrl, date, players) => ({
    id, name: id, sourceUrl, season: "GD05", dateStart: new Date(`${date}T00:00:00Z`),
    entries: players.map((playerName, i) => ({ playerName, placement: i + 1 })),
  });

  it("acha o mesmo evento em duas fontes e ignora eventos diferentes no mesmo dia", () => {
    const rows = [
      t("egman", "https://deckbuilder.egmanevents.com/gundam/tournaments#a", "2026-10-05", ["Taidana", "B", "C", "D"]),
      t("digilab", "https://gundam.digilab.cards/tournament/10731", "2026-10-05", ["Taidana", "B", "C", "X", "Y"]),
      t("outro", "https://gundam.digilab.cards/tournament/10732", "2026-10-06", ["Taidana", "Q", "R"]),
    ];
    expect(findDuplicatePairs(rows).map(([a, b]) => [a.id, b.id])).toEqual([["egman", "digilab"]]);
  });
});

describe("DigiLab (API oficial)", async () => {
  const { DigilabClient, baseCode, cacheFresh, entryKey, eventTypeLabel, flattenDecklist, planTournaments, seasonFor, toEvent } = await import(
    "../scripts/meta-sources/digilab.mjs"
  );
  const card = (card_id, count) => ({ card_id, count });
  const detail = (over = {}) => ({
    tournament: {
      id: 10869,
      date: "2026-10-15",
      event_type: "store_championship",
      format: "GD05",
      player_count: 12,
      event_name: null,
      store: { name: "Forja Hobby Store", city: "Mirassol", state: "São Paulo", country: "Brazil" },
      venue: null,
      scene: { country: "Brazil" },
      ...over,
    },
    standings: [
      { placement: 1, player: { name: "Ronaldo", slug: "ronaldo" }, record: { wins: 4, losses: 0, ties: 0 }, deck: { name: "Blue / Purple Char / Marine" }, has_decklist: true },
      { placement: 2, player: { name: "Anonymous", slug: null }, record: { wins: 3, losses: 1, ties: 1 }, deck: { name: "Red / White Justice" }, has_decklist: false },
    ],
    dnfs: [{ player: { name: "Caio", slug: "caio" }, deck: { name: "Green / White Wing Zero" } }],
  });

  it("temporada: o formato quando é temporada, senão a vigente na data (EB01 cai no GD04)", () => {
    expect(seasonFor("GD05", "2026-10-15")).toBe("GD05");
    expect(seasonFor("EB01", "2026-06-26")).toBe("GD04");
    expect(seasonFor("EB01", "2026-07-30")).toBe("GD05");
    expect(seasonFor("XX", "2025-01-01")).toBeNull();
  });

  it("decklist: lê os grupos de Gundam sem somar os baldes repetidos do Digimon", () => {
    const groups = { groups: [{ key: "unit", cards: [card("GD01-086", 3), card("GD01-086_p1", 1)] }, { key: "command", cards: [card("gd01-118", 4)] }], digimon: [card("GD01-086", 3), card("GD01-118", 4)] };
    expect(flattenDecklist(groups)).toEqual({ "GD01-086": 4, "GD01-118": 4 });
    expect(flattenDecklist({ eggs: [], digimon: [card("ST01-001", 4)], tamers: [], options: [card("ST01-010", 2)] })).toEqual({ "ST01-001": 4, "ST01-010": 2 });
    expect(flattenDecklist(null)).toBeNull();
    expect(flattenDecklist({ groups: [] })).toBeNull();
    expect(baseCode(" gd05-002_p2 ")).toBe("GD05-002");
    expect(eventTypeLabel("store_championship")).toBe("Store Championship");
  });

  it("torneio → evento do importador, com decklist casada pelo jogador e anônimo pela colocação", () => {
    const decklists = new Map([[entryKey(10869, "ronaldo", 1), { "ST11-001": 4 }], [entryKey(10869, null, 2), { "GD01-001": 4 }]]);
    const ev = toEvent(detail(), decklists);
    expect(ev).toMatchObject({
      key: "digilab:10869",
      name: "Store Championship @ Forja Hobby Store — 2026-10-15",
      format: "GD05",
      tier: "SMALL_OFFICIAL",
      sourceUrl: "https://gundam.digilab.cards/tournament/10869",
      country: "Brasil",
      city: "Mirassol",
      participantCount: 12,
    });
    expect(ev.entries).toEqual([
      { player: "Ronaldo", placement: 1, wins: 4, losses: 0, draws: 0, archetype: "Blue / Purple Char / Marine", main: { "ST11-001": 4 } },
      { player: "Anonymous", placement: 2, wins: 3, losses: 1, draws: 1, archetype: "Red / White Justice", main: { "GD01-001": 4 } },
      { player: "Caio", placement: null, wins: null, losses: null, draws: null, archetype: "Green / White Wing Zero", main: null },
    ]);
  });

  it("formato fora de temporada leva a marca no nome; Edition Beta e regionais", () => {
    expect(toEvent(detail({ format: "EB01", date: "2026-07-01" }))).toMatchObject({ format: "GD04", name: "Store Championship @ Forja Hobby Store [EB01] — 2026-07-01" });
    expect(toEvent(detail({ format: "GD01_b", date: "2025-04-10" }))).toBeNull();
    expect(toEvent(detail({ event_type: "regionals", store: { name: "X", country: "United States" }, scene: null }))).toMatchObject({ tier: "LARGE_OFFICIAL", country: "United States" });
    expect(toEvent(null)).toBeNull();
  });

  it("incremental: monta só os novos e os recentes; cache vale para evento assentado ou lido há < 1 dia", () => {
    const list = [
      { tournament_id: 1, event_date: "2026-08-01", format: "GD05" },
      { tournament_id: 2, event_date: "2026-10-01", format: "GD05" },
      { tournament_id: 3, event_date: "2026-08-01", format: "GD05" },
      { tournament_id: 4, event_date: "2025-04-10", format: "GD01_b" },
    ];
    const known = new Map([[1, "2026-08-01T00:00:00.000Z"], [2, "2026-10-01T00:00:00.000Z"]]);
    expect(planTournaments(list, known, "2026-10-10T12:00:00.000Z").map((t) => t.tournament_id)).toEqual([2, 3]);
    const now = Date.parse("2026-10-10T12:00:00Z");
    expect(cacheFresh(null, "2026-08-01", now)).toBe(false);
    expect(cacheFresh({ fetchedAt: "2026-09-01T00:00:00Z" }, "2026-08-01", now)).toBe(true);
    expect(cacheFresh({ fetchedAt: "2026-10-08T00:00:00Z" }, "2026-10-05", now)).toBe(false);
    expect(cacheFresh({ fetchedAt: "2026-10-10T06:00:00Z" }, "2026-10-05", now)).toBe(true);
  });

  it("cliente: repete em queda de rede e 429 (Retry-After), 404 vira null, chave recusada para", async () => {
    const replies = [
      () => Promise.reject(Object.assign(new TypeError("fetch failed"), { cause: { code: "ECONNRESET" } })),
      () => Promise.resolve(new Response("{}", { status: 429, headers: { "retry-after": "7" } })),
      () => Promise.resolve(Response.json({ data: [1] })),
      () => Promise.resolve(new Response("{}", { status: 404 })),
      () => Promise.resolve(new Response("{}", { status: 403 })),
    ];
    const seen = [];
    const slept = [];
    const api = new DigilabClient({
      key: "k",
      cacheDir: ".",
      fetchImpl: (url, init) => {
        seen.push([url, init.headers["X-API-Key"]]);
        return replies.shift()();
      },
      sleep: async (ms) => slept.push(ms),
    });
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    expect(await api.get("/tournaments?page=1")).toEqual({ data: [1] });
    expect(await api.get("/tournament/9")).toBeNull();
    await expect(api.get("/tournament/9")).rejects.toThrow(/chave recusada/);
    log.mockRestore();
    expect(seen[0]).toEqual(["https://gundam.digilab.cards/api/tournaments?page=1", "k"]);
    expect(slept).toContain(7_000);
    expect(api.requests).toBe(5);
  });
});

describe("Zero System: diff dos núcleos de arquétipo", async () => {
  const { diffMetaCores, parseFixture } = await import("../scripts/meta-cores-diff.mjs");
  const file = (formats, generatedAt = "2026-10-10") => `export const META_CORES: MetaCoreFile = ${JSON.stringify({ generatedAt, source: "x", formats })};\n`;

  it("ignora a data de geração e aponta a temporada que mudou", () => {
    const a = parseFixture(file({ GD05: { lists: 10, events: 2, archetypes: [{}] } }));
    expect(diffMetaCores(a, parseFixture(file({ GD05: { lists: 10, events: 2, archetypes: [{}] } }, "2026-10-16"))).changed).toBe(false);
    const d = diffMetaCores(a, parseFixture(file({ GD05: { lists: 40, events: 9, archetypes: [{}, {}] } })));
    expect(d.changed).toBe(true);
    expect(d.rows[0]).toBe("| GD05 | 10 → 40 | 2 → 9 | 1 → 2 | **mudou** |");
    expect(parseFixture("sem fixture")).toBeNull();
  });
});
