import { describe, expect, it } from "vitest";
import { runSelfPlay } from "./selfPlay";
import { buildSt08DeckList } from "../fixtures/st08Deck";
import { buildGd01DeckList } from "../fixtures/gd01Deck";
import { ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver } from "../content";

/**
 * Regressão — `enforceZoneLimits` abria `zoneOverflow` pro jogador da vez mesmo quando o
 * OPONENTE já tinha uma decisão pendente, deixando `pendingDecision.A` e `.B` preenchidos ao
 * mesmo tempo. `applyPlayerActionInner` barra qualquer ação de quem age enquanto o outro lado
 * tem decisão pendente, então os dois ficavam sem ação legal (partida travada).
 *
 * Caso original (achado pelo fuzz do CI): ST08 x GD01, seed 5, turno 15 — A faz deploy da
 * ST08-002 com 6 Units já em campo (7 no total), o 【Deploy】 destrói a GD01-080 do B, e o
 * 【Destroyed】 dela abre uma decisão pendente pro B no mesmo instante em que o excesso de
 * Units do A abria um `zoneOverflow`.
 */
describe("zoneOverflow x decisão pendente do oponente", () => {
  const seeds = Array.from({ length: 20 }, (_, i) => i + 1); // inclui o seed 5 do achado original

  it.each(seeds)("ST08 x GD01 seed %i: nunca há decisão pendente nos dois lados nem partida travada", (seed) => {
    const r = runSelfPlay({
      deckA: buildSt08DeckList(),
      deckB: buildGd01DeckList(),
      seed,
      specs: ALL_EFFECT_SPECS,
      predicateResolver: defaultPredicateResolver,
      targetFilterResolver: defaultTargetFilterResolver,
    });
    expect(r.crashed).toBeUndefined();
    expect(r.illegalState).toBeUndefined();
    expect(r.winner === "A" || r.winner === "B").toBe(true);
  }, 30_000);
});
