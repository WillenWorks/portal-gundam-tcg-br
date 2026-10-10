import { describe, expect, it } from "vitest";
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
    expect(rows.map((r) => r.code)).toEqual(["GD01", "GD02", "GD03", "GD04", "GD05"]);
    expect(rows[0].endDate?.toISOString().slice(0, 10)).toBe("2025-10-23");
    expect(rows.filter((r) => r.isCurrent).map((r) => r.code)).toEqual(["GD05"]);
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
