import { describe, expect, it } from "vitest";
import { getCardDefByCode } from "../content/allCardDefs";
import { ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver } from "../content";
import { runSelfPlay } from "../engine/selfPlay";
import { heuristicPolicy } from "../engine/bot/heuristicPolicy";
import { META_DECKS_GD02_ERA, parseDecklistText } from "./metaDecksGd02Era";

describe("parseDecklistText", () => {
  it("aceita 'Nx CÓDIGO Nome', 'N CÓDIGO' e ignora linhas vazias/comentários", () => {
    expect(parseDecklistText("4x GD02-001 Psycho Gundam\n\n# comentário\n3 st06-002\n")).toEqual([
      { code: "GD02-001", quantity: 4 },
      { code: "ST06-002", quantity: 3 },
    ]);
  });

  it("soma linhas repetidas do mesmo código", () => {
    expect(parseDecklistText("2x GD01-035\n2x GD01-035")).toEqual([{ code: "GD01-035", quantity: 4 }]);
  });

  it("linha que não é decklist lança com o número da linha", () => {
    expect(() => parseDecklistText("4x GD02-001\nisso não é carta")).toThrow(/linha 2/);
  });
});

describe("decks meta da época GD02 + ST06 (receitas oficiais, out/2025)", () => {
  const decks = Object.values(META_DECKS_GD02_ERA);

  it("tem as 6 receitas oficiais do período", () => {
    expect(decks.map((d) => d.id).sort()).toEqual([
      "META-GD02-AEUG-EA",
      "META-GD02-AGE-WING",
      "META-GD02-QUBELEY",
      "META-GD02-TEKKADAN-VAGAN",
      "META-GD02-TITANS",
      "META-ST06-GQUUUUUUX",
    ]);
  });

  for (const deck of decks) {
    it(`${deck.id}: 50 cartas no deck principal, 10 recursos, no máximo 4 cópias, tudo no catálogo`, () => {
      const cards = parseDecklistText(deck.list);
      expect(cards.reduce((n, c) => n + c.quantity, 0)).toBe(50);
      for (const c of cards) {
        expect(c.quantity, c.code).toBeLessThanOrEqual(4);
        expect(getCardDefByCode(c.code), `${c.code} fora do catálogo do simulador`).toBeDefined();
      }
      const list = deck.build();
      expect(list.main).toHaveLength(50);
      expect(list.resources).toHaveLength(10);
      expect(deck.source).toMatch(/^https:\/\//);
    });
  }

  it("partida de fumaça: cada deck joga contra o seguinte sem crash nem estado ilegal", () => {
    const bot = heuristicPolicy({ level: "normal" });
    for (let i = 0; i < decks.length; i++) {
      const a = decks[i];
      const b = decks[(i + 1) % decks.length];
      const result = runSelfPlay({
        deckA: a.build(),
        deckB: b.build(),
        seed: 77 + i,
        maxTurns: 40,
        policyA: bot,
        policyB: bot,
        specs: ALL_EFFECT_SPECS,
        predicateResolver: defaultPredicateResolver,
        targetFilterResolver: defaultTargetFilterResolver,
      });
      expect(result.crashed, `${a.id} x ${b.id}: ${result.crashed?.error}`).toBeUndefined();
      expect(result.illegalState, `${a.id} x ${b.id}: ${result.illegalState}`).toBeUndefined();
    }
  }, 120_000);
});
