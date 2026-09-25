import { expect } from "vitest";
import { createGame } from "../setup";
import { advanceToMainPhase } from "../phases";
import { applyPlayerAction } from "../actions";
import type { CardDef, CardInstance, GameState, PlayerId, Zone } from "../types";
import type { EffectSpec } from "../effectSpec";
import { validatedDeckList } from "../../content/index";
import { heuristicPolicy } from "./heuristicPolicy";

/** Cenários de motor real compartilhados pelos testes do lookahead de efeitos (não é arquivo de teste). */

const decks = validatedDeckList();
const deckBuild = (id: string) => decks.find((d) => d.id === id)!.build;
export const settlePolicy = heuristicPolicy({ level: "normal" });

let seq = 0;
export function put(state: GameState, player: PlayerId, zone: Zone, def: CardDef, rested = false): CardInstance {
  const card: CardInstance = {
    instanceId: `${player}-lafx-${seq++}`,
    def,
    owner: player,
    zone,
    rested,
    damage: 0,
    statModifiers: [],
    keywordGrants: [],
    usedKeywordsThisTurn: [],
    enteredZoneOnTurn: state.turnNumber - 1,
  };
  state.players[player][zone].push(card);
  return card;
}

export const RESOURCE: CardDef = { code: "LA-RES", nameEn: "Res", cardType: "RESOURCE", color: "blue" };
export const command = (code: string, cost = 1): CardDef => ({
  code,
  nameEn: code,
  cardType: "COMMAND",
  color: "blue",
  level: 1,
  cost,
  triggerKeywords: ["Main", "Action"],
});
export const spec = (code: string, trigger: string, actions: EffectSpec["actions"], targetScope?: EffectSpec["targetScope"]): EffectSpec => ({
  id: `${code}-${trigger}`,
  cardCode: code,
  trigger,
  actions,
  targetScope,
  sourceText: "",
});
export const UNIT = (code: string, ap: number, hp: number): CardDef => ({ code, nameEn: code, cardType: "UNIT", color: "blue", level: 1, cost: 1, ap, hp });

export const DRAW = command("LA-DRAW");
export const REMOVAL = command("LA-KILL");
export const DEATHRATTLE_UNIT = UNIT("LA-DR", 2, 2);
export const SELF_BURN = command("LA-BURN");
export const BATTLE_PUMP = command("LA-PUMP");
export const SPECS: EffectSpec[] = [
  spec("LA-DRAW", "Main", [{ op: "draw", player: "controller", n: 2 }]),
  spec("LA-KILL", "Main", [{ op: "destroy", target: { kind: "named", name: "target" } }], "enemyUnit"),
  { ...spec("LA-DR", "Destroyed", [{ op: "draw", player: "controller", n: 1 }]), optional: true },
  spec("LA-BURN", "Main", [{ op: "damageShield", player: "controller", count: 1 }]),
  spec("LA-PUMP", "Action", [{ op: "modifyStat", target: { kind: "named", name: "target" }, stat: "ap", amount: 3, duration: "thisBattle" }], "friendlyUnit"),
];

export function mainBoard(): GameState {
  const state = advanceToMainPhase(createGame(deckBuild("ST01")(), deckBuild("ST02")(), { seed: 11, firstPlayer: "A" }));
  for (const id of ["A", "B"] as const) {
    state.players[id].hand = [];
    state.players[id].battleArea = [];
    state.players[id].resourceArea = [];
  }
  put(state, "A", "resourceArea", RESOURCE);
  put(state, "A", "resourceArea", RESOURCE);
  return state;
}


/** A ataca a Unit rested de B; B pula bloqueio e passa → prioridade de A no Action Step */
export function combatWithPriorityA(attackerAp: number): { state: GameState; attacker: CardInstance; pump: CardInstance } {
  const state = mainBoard();
  const attacker = put(state, "A", "battleArea", UNIT("LA-ATK", attackerAp, 3));
  const defender = put(state, "B", "battleArea", UNIT("LA-DEF", 4, 4), true);
  const pump = put(state, "A", "hand", BATTLE_PUMP);
  let s = applyPlayerAction(state, "A", { kind: "declareAttack", attackerId: attacker.instanceId, target: { unitId: defender.instanceId } }, SPECS);
  if (s.combat?.step === "block") s = applyPlayerAction(s, "B", { kind: "skipBlock" }, SPECS);
  if (s.combat?.step === "action" && s.combat.actionPriority === "B") s = applyPlayerAction(s, "B", { kind: "passAction" }, SPECS);
  expect(s.combat?.step).toBe("action");
  expect(s.combat?.actionPriority).toBe("A");
  return { state: s, attacker, pump };
}
