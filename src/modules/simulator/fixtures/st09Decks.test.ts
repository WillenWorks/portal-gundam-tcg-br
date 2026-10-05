import { describe, expect, it } from "vitest";
import { getCardDefByCode } from "../content/allCardDefs";
import { ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver } from "../content";
import { DEFERRED_CLAUSES } from "../content/deferred";
import { runSelfPlay } from "../engine/selfPlay";
import { heuristicPolicy } from "../engine/bot/heuristicPolicy";
import { parseDecklistText } from "./metaDecksGd02Era";
import { ST09_DECKS } from "./st09Decks";

describe("decks oficiais do ST09", () => {
  const decks = Object.values(ST09_DECKS);
  const deferred = new Set(DEFERRED_CLAUSES.map((d) => d.cardCode));

  for (const deck of decks) {
    it(`${deck.id}: 50 cartas, 10 recursos, no máximo 4 cópias, 2 cores, sem cláusula deferida`, () => {
      const cards = parseDecklistText(deck.list);
      expect(cards.reduce((n, c) => n + c.quantity, 0)).toBe(50);
      const colors = new Set<string>();
      for (const c of cards) {
        expect(c.quantity, c.code).toBeLessThanOrEqual(4);
        expect(deferred.has(c.code), `${c.code} tem cláusula deferida`).toBe(false);
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

  it("juntos, os dois decks usam as 10 cartas do ST09", () => {
    const st09 = new Set(decks.flatMap((d) => parseDecklistText(d.list).map((c) => c.code)).filter((c) => c.startsWith("ST09-")));
    expect([...st09].sort()).toEqual(Array.from({ length: 10 }, (_, i) => `ST09-${String(i + 1).padStart(3, "0")}`));
  });

  it("partida de fumaça com o bot heurístico: sem crash nem estado ilegal", () => {
    const bot = heuristicPolicy({ level: "normal" });
    const [a, b] = decks;
    for (const seed of [1, 2, 3]) {
      const result = runSelfPlay({
        deckA: a.build(),
        deckB: b.build(),
        seed,
        maxTurns: 40,
        policyA: bot,
        policyB: bot,
        specs: ALL_EFFECT_SPECS,
        predicateResolver: defaultPredicateResolver,
        targetFilterResolver: defaultTargetFilterResolver,
      });
      expect(result.crashed, `seed ${seed}: ${result.crashed?.error}`).toBeUndefined();
      expect(result.illegalState, `seed ${seed}: ${result.illegalState}`).toBeUndefined();
    }
  }, 120_000);
});
