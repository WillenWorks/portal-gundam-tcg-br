import { describe, expect, it } from "vitest";
import { createGame } from "./setup";
import { placeCard } from "./__testkit__/cardHarness";
import { advanceToMainPhase } from "./phases";
import { attackTargetError } from "./combat";
import { applyEvents, findCard } from "./events";
import { resolveEffectSpec } from "./effectSpec";
import type { CardDef, GameState } from "./types";
import { buildSt07DeckList, ST07_CARD_DEFS } from "../fixtures/st07Deck";
import { buildSt08DeckList, ST08_CARD_DEFS } from "../fixtures/st08Deck";
import { ST07_EFFECT_SPECS } from "../content/st07";
import { ST08_EFFECT_SPECS } from "../content/st08";
import { defaultPredicateResolver } from "../content/predicates";

/**
 * "may choose an active enemy Unit … as its attack target" — ST07-011 e ST08-010 foram cadastrados sem o
 * critério do texto (e sem o "If this is a (X) Unit"); a concessão sem critério não liberava nada, e com
 * GD03-021/EB01-080 ("an active enemy Unit", sem critério) passando a liberar, as duas precisam do critério certo.
 */

function game(): GameState {
  const state = advanceToMainPhase(createGame(buildSt07DeckList(), buildSt08DeckList(), { seed: 7, firstPlayer: "A" }));
  state.players.A.battleArea = [];
  state.players.B.battleArea = [];
  return state;
}

const unit = (base: CardDef, level: number, traits: string[]): CardDef => ({ ...base, level, traits });
const UNIT_BASE = ST07_CARD_DEFS["ST07-001"];

function pairPilot(state: GameState, unitId: string, pilotDef: CardDef): string {
  const pilotId = placeCard(state, "A", pilotDef, "battleArea");
  findCard(state, unitId).pairedPilotId = pilotId;
  findCard(state, pilotId).pairedUnitId = unitId;
  return pilotId;
}

function resolve(state: GameState, specId: string, sourceId: string, targets: Record<string, string[]> = {}): GameState {
  const spec = [...ST07_EFFECT_SPECS, ...ST08_EFFECT_SPECS].find((s) => s.id === specId);
  if (!spec) throw new Error(`spec ${specId} não encontrado`);
  const ctx = { state, controller: "A" as const, sourceInstanceId: sourceId, turnNumber: state.turnNumber, targets };
  return applyEvents(state, resolveEffectSpec(spec, ctx, defaultPredicateResolver));
}

describe("ST07-011 Lockon Stratos (Neil) — Unit inimiga ativa com Lv. ≤ ao desta Unit, se for (CB)", () => {
  it("(CB) Lv.4: libera mirar ativa Lv.4, não Lv.5", () => {
    let state = game();
    const cbId = placeCard(state, "A", unit(UNIT_BASE, 4, ["CB"]), "battleArea");
    const lockonId = pairPilot(state, cbId, ST07_CARD_DEFS["ST07-011"]);
    const lv4 = placeCard(state, "B", unit(UNIT_BASE, 4, []), "battleArea");
    const lv5 = placeCard(state, "B", unit(UNIT_BASE, 5, []), "battleArea");
    state = resolve(state, "ST07-011-WhenPaired", lockonId);
    expect(attackTargetError(state, findCard(state, cbId), { unitId: lv4 })).toBeNull();
    expect(attackTargetError(state, findCard(state, cbId), { unitId: lv5 })).not.toBeNull();
  });

  it("Unit que não é (CB): nada é concedido", () => {
    let state = game();
    const otherId = placeCard(state, "A", unit(UNIT_BASE, 4, ["Earth Federation"]), "battleArea");
    const lockonId = pairPilot(state, otherId, ST07_CARD_DEFS["ST07-011"]);
    const lv1 = placeCard(state, "B", unit(UNIT_BASE, 1, []), "battleArea");
    state = resolve(state, "ST07-011-WhenPaired", lockonId);
    expect(findCard(state, otherId).attackTargetRelaxUntilTurn).toBeUndefined();
    expect(attackTargetError(state, findCard(state, otherId), { unitId: lv1 })).not.toBeNull();
  });
});

describe("ST08-010 Hathaway Noa — Unit inimiga ativa com dano, se for (Mafty)", () => {
  it("(Mafty): a Unit escolhida mira ativa com dano, não ativa sem dano", () => {
    let state = game();
    const maftyId = placeCard(state, "A", unit(UNIT_BASE, 4, ["Mafty"]), "battleArea");
    const hathawayId = pairPilot(state, maftyId, ST08_CARD_DEFS["ST08-010"]);
    const damaged = placeCard(state, "B", unit(UNIT_BASE, 6, []), "battleArea", { damage: 1 });
    const intact = placeCard(state, "B", unit(UNIT_BASE, 1, []), "battleArea");
    state = resolve(state, "ST08-010-WhenPaired", hathawayId, { target: [maftyId] });
    expect(attackTargetError(state, findCard(state, maftyId), { unitId: damaged })).toBeNull();
    expect(attackTargetError(state, findCard(state, maftyId), { unitId: intact })).not.toBeNull();
  });

  it("Unit que não é (Mafty): nada é concedido", () => {
    let state = game();
    const otherId = placeCard(state, "A", unit(UNIT_BASE, 4, ["Earth Federation"]), "battleArea");
    const maftyId = placeCard(state, "A", unit(UNIT_BASE, 4, ["Mafty"]), "battleArea");
    const hathawayId = pairPilot(state, otherId, ST08_CARD_DEFS["ST08-010"]);
    state = resolve(state, "ST08-010-WhenPaired", hathawayId, { target: [maftyId] });
    expect(findCard(state, maftyId).attackTargetRelaxUntilTurn).toBeUndefined();
  });
});
