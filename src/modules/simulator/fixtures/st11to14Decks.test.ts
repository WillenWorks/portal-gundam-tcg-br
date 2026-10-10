import { describe, expect, it } from "vitest";
import { getCardDefByCode } from "../content/allCardDefs";
import { ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver } from "../content";
import { runSelfPlay } from "../engine/selfPlay";
import { heuristicPolicy } from "../engine/bot/heuristicPolicy";
import { parseDecklistText } from "./metaDecksGd02Era";
import { ST11_TO_14_DECKS } from "./st11to14Decks";
import { EB01_TEST_DECKS } from "./eb01Decks";
import { GD05_DECKS } from "./gd05Decks";

describe("decks oficiais do ST11–ST14", () => {
  const decks = Object.values(ST11_TO_14_DECKS);

  for (const deck of decks) {
    it(`${deck.id}: 50 cartas, no máximo 4 cópias, 2 cores, tudo no catálogo`, () => {
      const cards = parseDecklistText(deck.list);
      expect(cards.reduce((n, c) => n + c.quantity, 0)).toBe(50);
      const colors = new Set<string>();
      for (const c of cards) {
        expect(c.quantity, c.code).toBeLessThanOrEqual(4);
        const def = getCardDefByCode(c.code);
        expect(def, `${c.code} fora do catálogo do simulador`).toBeDefined();
        if (def) colors.add(def.color);
      }
      expect(colors.size).toBeLessThanOrEqual(2);
      const list = deck.build();
      expect(list.main).toHaveLength(50);
      expect(list.resources).toHaveLength(10);
    });
  }

  it("partidas de fumaça com o bot (entre si e × EB01 e GD05): sem crash nem estado ilegal", () => {
    const bot = heuristicPolicy({ level: "normal" });
    const opponents = [...decks, EB01_TEST_DECKS["EB01-VERDE-BRANCO"], GD05_DECKS["GD05-ORB"]];
    let seed = 0;
    for (const a of decks) {
      for (const b of opponents) {
        const result = runSelfPlay({
          deckA: a.build(),
          deckB: b.build(),
          seed: seed++,
          maxTurns: 40,
          policyA: bot,
          policyB: bot,
          specs: ALL_EFFECT_SPECS,
          predicateResolver: defaultPredicateResolver,
          targetFilterResolver: defaultTargetFilterResolver,
        });
        const pair = `${a.id} x ${b.id}`;
        expect(result.crashed, `${pair}: ${result.crashed?.error}`).toBeUndefined();
        expect(result.illegalState, `${pair}: ${result.illegalState}`).toBeUndefined();
      }
    }
  }, 240_000);
});
