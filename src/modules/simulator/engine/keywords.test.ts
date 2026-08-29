import { describe, expect, it } from "vitest";
import { createGame } from "./setup";
import { buildVanillaDeckList, VANILLA_CARD_DEFS } from "../fixtures/vanillaDeck";
import type { CardDef, CardInstance, GameState, PlayerId } from "./types";
import { runEndPhase } from "./phases";
import { findCard } from "./events";

let seq = 0;
/** Ver comentário equivalente em combat.test.ts — muta `state` direto por conveniência de fixture. */
function place(state: GameState, player: PlayerId, def: CardDef, opts: Partial<CardInstance> = {}): string {
  const instanceId = `${player}-kw-fixture-${seq++}`;
  const card: CardInstance = {
    instanceId,
    def,
    owner: player,
    zone: "battleArea",
    rested: false,
    damage: 0,
    statModifiers: [],
    keywordGrants: [],
    usedKeywordsThisTurn: [],
    // -1: unit já estabelecida em campo por padrão (ver combat.test.ts).
    enteredZoneOnTurn: state.turnNumber - 1,
    ...opts,
  };
  state.players[player].battleArea.push(card);
  return instanceId;
}

describe("<Repair N> — cura no fim do turno (docs/18)", () => {
  it("cura N de dano no fim do turno de quem controla a carta", () => {
    const state = createGame(buildVanillaDeckList(), buildVanillaDeckList(), { seed: 3, firstPlayer: "A" });
    const repairUnitId = place(state, "A", VANILLA_CARD_DEFS.REPAIR_01, { damage: 3 }); // Repair 1, HP3

    const next = runEndPhase(state);
    expect(findCard(next, repairUnitId).damage).toBe(2);
  });

  it("não cura abaixo de zero", () => {
    const state = createGame(buildVanillaDeckList(), buildVanillaDeckList(), { seed: 3, firstPlayer: "A" });
    const repairUnitId = place(state, "A", VANILLA_CARD_DEFS.REPAIR_01, { damage: 0 });

    const next = runEndPhase(state);
    expect(findCard(next, repairUnitId).damage).toBe(0);
  });

  it("não cura Unit sem <Repair>", () => {
    const state = createGame(buildVanillaDeckList(), buildVanillaDeckList(), { seed: 3, firstPlayer: "A" });
    const unitId = place(state, "A", VANILLA_CARD_DEFS.VANILLA_02, { damage: 1 });

    const next = runEndPhase(state);
    expect(findCard(next, unitId).damage).toBe(1);
  });
});
