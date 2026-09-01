import { describe, expect, it } from "vitest";
import { createGame } from "./setup";
import { buildVanillaDeckList } from "../fixtures/vanillaDeck";
import { ST01_CARD_DEFS } from "../fixtures/st01Deck";
import { ST02_CARD_DEFS } from "../fixtures/st02Deck";
import type { CardDef, CardInstance, GameState, PlayerId, Zone } from "./types";
import { effectiveAp, effectiveHp } from "./types";
import { declareAttack, passAction, proceedToBlockStep, resolveDamageStep, skipBlock } from "./combat";
import { findCard } from "./events";

/**
 * Testes focados nas 8 lacunas de DSL fechadas na wave de Agente 1
 * (docs/19) que não passam por `resolveEffectSpec` — modelo estático de
 * `CardDef` (`staticAbilities`/`combatTriggers`/`attackTargetRules`),
 * avaliado direto pelo motor em `types.ts`/`combat.ts`. As lacunas que
 * viram primitiva de EffectSpec (`payResourceCost`, `spawnToken`,
 * `moveWithinDeck`, `preventShieldDamage`, alvo em grupo) são testadas em
 * `content/st01.test.ts` / `content/st02.test.ts`.
 */

let seq = 0;
function place(state: GameState, player: PlayerId, def: CardDef, zone: Zone, opts: Partial<CardInstance> = {}): string {
  const instanceId = `${player}-a1fx-${seq++}`;
  const card: CardInstance = {
    instanceId,
    def,
    owner: player,
    zone,
    rested: false,
    damage: 0,
    statModifiers: [],
    keywordGrants: [],
    usedKeywordsThisTurn: [],
    enteredZoneOnTurn: state.turnNumber - 1,
    ...opts,
  };
  state.players[player][zone].push(card);
  return instanceId;
}

function stripBase(state: GameState, player: PlayerId): GameState {
  return { ...state, players: { ...state.players, [player]: { ...state.players[player], baseSection: [] } } };
}

function freshGame(): GameState {
  const state = createGame(buildVanillaDeckList(), buildVanillaDeckList(), { seed: 9, firstPlayer: "A" });
  return { ...state, phase: "main" };
}

function pair(state: GameState, unitId: string, pilotId: string): void {
  findCard(state, unitId).pairedPilotId = pilotId;
  findCard(state, pilotId).pairedUnitId = unitId;
}

describe("modificadores estáticos contínuos (Comprehensive Rules 10-2, docs/18 lacuna #2)", () => {
  it("ST01-001 Gundam 【During Pair】: +1 AP a TODA Unit amiga durante o turno do controlador", () => {
    const state = freshGame();
    const gundamId = place(state, "A", ST01_CARD_DEFS.GUNDAM, "battleArea", { pairedPilotId: "pilot-fake" });
    const otherAllyId = place(state, "A", ST01_CARD_DEFS.GM, "battleArea");
    const enemyId = place(state, "B", ST01_CARD_DEFS.GM, "battleArea");

    expect(effectiveAp(findCard(state, gundamId), state)).toBe((ST01_CARD_DEFS.GUNDAM.ap ?? 0) + 1);
    expect(effectiveAp(findCard(state, otherAllyId), state)).toBe((ST01_CARD_DEFS.GM.ap ?? 0) + 1);
    expect(effectiveAp(findCard(state, enemyId), state)).toBe(ST01_CARD_DEFS.GM.ap ?? 0);
  });

  it("ST01-001 Gundam 【During Pair】: sem Pilot pareado, ou fora do turno do controlador, o bônus some sozinho", () => {
    const unpaired = freshGame();
    const gundamUnpairedId = place(unpaired, "A", ST01_CARD_DEFS.GUNDAM, "battleArea");
    expect(effectiveAp(findCard(unpaired, gundamUnpairedId), unpaired)).toBe(ST01_CARD_DEFS.GUNDAM.ap ?? 0);

    const enemyTurn: GameState = { ...freshGame(), activePlayer: "B" };
    const gundamId = place(enemyTurn, "A", ST01_CARD_DEFS.GUNDAM, "battleArea", { pairedPilotId: "pilot-fake" });
    expect(effectiveAp(findCard(enemyTurn, gundamId), enemyTurn)).toBe(ST01_CARD_DEFS.GUNDAM.ap ?? 0);
  });

  it("ST02-010 Heero Yuy 【During Link】: +1 AP / +1 HP na Unit pareada, só enquanto a Link Condition for satisfeita", () => {
    const state = freshGame();
    const wingId = place(state, "A", ST02_CARD_DEFS.WING_GUNDAM, "battleArea");
    const heeroId = place(state, "A", ST02_CARD_DEFS.HEERO_YUY, "battleArea");
    pair(state, wingId, heeroId);

    expect(effectiveAp(findCard(state, wingId), state)).toBe((ST02_CARD_DEFS.WING_GUNDAM.ap ?? 0) + 1);
    expect(effectiveHp(findCard(state, wingId), state)).toBe((ST02_CARD_DEFS.WING_GUNDAM.hp ?? 0) + 1);

    // Pilot que NÃO satisfaz a link condition da Wing Gundam (link = [Heero Yuy]) -> sem bônus
    const other = freshGame();
    const wing2Id = place(other, "A", ST02_CARD_DEFS.WING_GUNDAM, "battleArea");
    const zechsId = place(other, "A", ST02_CARD_DEFS.ZECHS_MERQUISE, "battleArea");
    pair(other, wing2Id, zechsId);
    expect(effectiveAp(findCard(other, wing2Id), other)).toBe(ST02_CARD_DEFS.WING_GUNDAM.ap ?? 0);
  });
});

describe("attackTargetRules — legalidade da declaração de ataque (docs/18 lacuna #6)", () => {
  it("ST01-009 Zowort não pode escolher o jogador inimigo como alvo de ataque", () => {
    let state = stripBase(freshGame(), "B");
    const zowortId = place(state, "A", ST01_CARD_DEFS.ZOWORT, "battleArea");

    expect(() => declareAttack(state, zowortId, "player")).toThrow(/não pode escolher o jogador inimigo/);

    // ...mas contra Unit inimiga rested continua legal
    const enemyId = place(state, "B", ST01_CARD_DEFS.GM, "battleArea", { rested: true });
    state = declareAttack(state, zowortId, { unitId: enemyId });
    expect(state.combat?.attackerId).toBe(zowortId);
  });

  it("ST02-001 Wing Gundam pode atacar Unit inimiga ACTIVE de Lv.4 ou menos, mas não de Lv.5+", () => {
    const lowLv = stripBase(freshGame(), "B");
    const wingId = place(lowLv, "A", ST02_CARD_DEFS.WING_GUNDAM, "battleArea");
    const activeLeoId = place(lowLv, "B", ST02_CARD_DEFS.LEO, "battleArea"); // Lv.2, active
    const afterLow = declareAttack(lowLv, wingId, { unitId: activeLeoId });
    expect(afterLow.combat?.currentTarget).toEqual({ unitId: activeLeoId });

    const highLv = stripBase(freshGame(), "B");
    const wing2Id = place(highLv, "A", ST02_CARD_DEFS.WING_GUNDAM, "battleArea");
    const activeTallgeeseId = place(highLv, "B", ST02_CARD_DEFS.TALLGEESE, "battleArea"); // Lv.5, active
    expect(() => declareAttack(highLv, wing2Id, { unitId: activeTallgeeseId })).toThrow(/rested/);
  });
});

describe("combatTriggers — reação a 'destruiu inimigo em batalha' (docs/18 lacunas #2/#5)", () => {
  function runBattle(state: GameState, attackerId: string, defenderId: string): GameState {
    let next = declareAttack(state, attackerId, { unitId: defenderId });
    next = proceedToBlockStep(next);
    next = skipBlock(next);
    next = passAction(next, next.combat!.defendingPlayer);
    next = passAction(next, next.combat!.attackingPlayer);
    return resolveDamageStep(next);
  }

  it("ST02-011 Zechs Merquise 【During Link】: compra 1 quando a Unit pareada destrói inimigo em batalha", () => {
    let state = stripBase(freshGame(), "B");
    const tallgeeseId = place(state, "A", ST02_CARD_DEFS.TALLGEESE, "battleArea"); // AP4/HP4
    const zechsId = place(state, "A", ST02_CARD_DEFS.ZECHS_MERQUISE, "battleArea");
    pair(state, tallgeeseId, zechsId);
    const defenderId = place(state, "B", ST02_CARD_DEFS.TRAGOS, "battleArea", { rested: true }); // AP1/HP1

    const handBefore = state.players.A.hand.length;
    state = runBattle(state, tallgeeseId, defenderId);

    expect(state.players.B.trash.some((c) => c.instanceId === defenderId)).toBe(true);
    expect(findCard(state, tallgeeseId).zone).toBe("battleArea"); // sobreviveu
    expect(state.players.A.hand.length).toBe(handBefore + 1); // draw 1
  });

  it("ST02-011: sem Link satisfeita (Pilot errado pareado), não compra nada", () => {
    let state = stripBase(freshGame(), "B");
    const tallgeeseId = place(state, "A", ST02_CARD_DEFS.TALLGEESE, "battleArea");
    const heeroId = place(state, "A", ST02_CARD_DEFS.HEERO_YUY, "battleArea"); // não satisfaz link de Tallgeese
    pair(state, tallgeeseId, heeroId);
    const defenderId = place(state, "B", ST02_CARD_DEFS.TRAGOS, "battleArea", { rested: true });

    const handBefore = state.players.A.hand.length;
    state = runBattle(state, tallgeeseId, defenderId);

    expect(state.players.A.hand.length).toBe(handBefore);
  });

  it("ST02-003 Gundam Heavyarms 【During Pair】: ao destruir inimigo em batalha, 1 dano em toda Unit inimiga de Lv.3 ou menos", () => {
    let state = stripBase(freshGame(), "B");
    const heavyarmsId = place(state, "A", ST02_CARD_DEFS.GUNDAM_HEAVYARMS, "battleArea"); // AP3/HP4
    const anyPilotId = place(state, "A", ST02_CARD_DEFS.HEERO_YUY, "battleArea");
    pair(state, heavyarmsId, anyPilotId); // During Pair = qualquer Pilot pareado
    const defenderId = place(state, "B", ST02_CARD_DEFS.TRAGOS, "battleArea", { rested: true }); // Lv.1
    const bystanderLowId = place(state, "B", ST02_CARD_DEFS.LEO, "battleArea"); // Lv.2, HP2
    const bystanderHighId = place(state, "B", ST02_CARD_DEFS.TALLGEESE, "battleArea"); // Lv.5

    state = runBattle(state, heavyarmsId, defenderId);

    expect(state.players.B.trash.some((c) => c.instanceId === defenderId)).toBe(true);
    expect(findCard(state, bystanderLowId).damage).toBe(1); // Lv.2 <= 3 -> recebe 1
    expect(findCard(state, bystanderHighId).damage).toBe(0); // Lv.5 -> intocada
  });
});
