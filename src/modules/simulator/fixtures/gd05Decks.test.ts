import { describe, expect, it } from "vitest";
import { getCardDefByCode } from "../content/allCardDefs";
import { ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver } from "../content";
import { runSelfPlay } from "../engine/selfPlay";
import { heuristicPolicy } from "../engine/bot/heuristicPolicy";
import { parseDecklistText } from "./metaDecksGd02Era";
import { GD05_DECKS } from "./gd05Decks";

describe("decks oficiais do GD05", () => {
  const decks = Object.values(GD05_DECKS);

  for (const deck of decks) {
    it(`${deck.id}: 50 cartas, 10 recursos, no máximo 4 cópias, 2 cores, tudo no catálogo`, () => {
      const cards = parseDecklistText(deck.list);
      expect(cards.reduce((n, c) => n + c.quantity, 0)).toBe(50);
      const colors = new Set<string>();
      for (const c of cards) {
        expect(c.quantity, c.code).toBeLessThanOrEqual(4);
        const def = getCardDefByCode(c.code);
        expect(def, `${c.code} fora do catálogo do simulador`).toBeDefined();
        if (def) colors.add(def.color);
      }
      expect(colors.size).toBe(2);
      const list = deck.build();
      expect(list.main).toHaveLength(50);
      expect(list.resources).toHaveLength(10);
    });
  }

  it("partidas de fumaça com o bot heurístico (todos os pares): sem crash nem estado ilegal", () => {
    const bot = heuristicPolicy({ level: "normal" });
    for (let i = 0; i < decks.length; i++) {
      for (let j = i + 1; j < decks.length; j++) {
        const result = runSelfPlay({
          deckA: decks[i].build(),
          deckB: decks[j].build(),
          seed: i * 10 + j,
          maxTurns: 40,
          policyA: bot,
          policyB: bot,
          specs: ALL_EFFECT_SPECS,
          predicateResolver: defaultPredicateResolver,
          targetFilterResolver: defaultTargetFilterResolver,
        });
        const pair = `${decks[i].id} x ${decks[j].id}`;
        expect(result.crashed, `${pair}: ${result.crashed?.error}`).toBeUndefined();
        expect(result.illegalState, `${pair}: ${result.illegalState}`).toBeUndefined();
      }
    }
  }, 240_000);
});
