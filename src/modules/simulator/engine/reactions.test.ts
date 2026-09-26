import { describe, expect, it } from "vitest";
import { createGame } from "./setup";
import type { DeckList } from "./setup";
import type { CardDef, GameState, PlayerId } from "./types";
import { effectiveAp } from "./types";
import { advanceToMainPhase } from "./phases";
import { applyPlayerAction, type PlayerAction } from "./actions";
import { dispatchTrigger } from "./dispatcher";
import type { PrimitiveCall } from "./effectSpec";
import { findCard } from "./events";
import { placeCard } from "./__testkit__/cardHarness";
import { buildSt07DeckList } from "../fixtures/st07Deck";
import { buildSt08DeckList } from "../fixtures/st08Deck";
import { ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver } from "../content";
import { GD03_CARD_DEFS } from "../content/gd03";

/**
 * W2a (C1) — barramento de gatilhos reativos com fluxo real do motor: o evento acontece por
 * efeito (`dispatchTrigger`), ataque, pareamento por jogada ou fim de turno, e a reação passa
 * pelo mesmo caminho de pausa/escolha dos outros gatilhos.
 */

const G = GD03_CARD_DEFS;
const RESOURCE: CardDef = { code: "RES", nameEn: "Resource", cardType: "RESOURCE", color: "colorless" };

function game(): GameState {
  const decks: [DeckList, DeckList] = [buildSt07DeckList(), buildSt08DeckList()];
  const state = advanceToMainPhase(createGame(decks[0], decks[1], { seed: 77, firstPlayer: "A" }));
  state.players.A.battleArea = [];
  state.players.B.battleArea = [];
  state.players.B.baseSection = [];
  return state;
}

function pair(state: GameState, unitId: string, pilotId: string): void {
  findCard(state, unitId).pairedPilotId = pilotId;
  findCard(state, pilotId).pairedUnitId = unitId;
}

/** um efeito qualquer da carta `sourceId` (controller = dono dela), passando pelo `dispatchTrigger` real */
function fire(state: GameState, sourceId: string, actions: PrimitiveCall[], targets: Record<string, string[]> = {}): GameState {
  const src = findCard(state, sourceId);
  const spec = { id: "TEST-fire", cardCode: src.def.code, trigger: "TestFire", actions, sourceText: "" };
  return dispatchTrigger(state, sourceId, "TestFire", [spec], {
    targets,
    allSpecs: ALL_EFFECT_SPECS,
    predicateResolver: defaultPredicateResolver,
    targetFilterResolver: defaultTargetFilterResolver,
  });
}

function act(state: GameState, player: PlayerId, action: PlayerAction): GameState {
  return applyPlayerAction(state, player, action, ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver);
}

function resolve(state: GameState, player: PlayerId, specId: string, targetIds: string[] = [], activate = true): GameState {
  return act(state, player, { kind: "resolveAbility", resolutions: [{ specId, activate, targetIds }] });
}

const damage = (n: number): PrimitiveCall => ({ op: "damageUnit", amount: n, target: { kind: "named", name: "target" } });
const rest: PrimitiveCall = { op: "rest", target: { kind: "named", name: "target" } };
const setActive: PrimitiveCall = { op: "setActive", target: { kind: "named", name: "target" } };

describe("W2a — gatilhos reativos", () => {
  it("060: dano de efeito no seu turno cria o token; 【Once per Turn】; no turno do oponente não", () => {
    let state = game();
    const worker = placeCard(state, "A", G["GD03-060"], "battleArea");
    const src = placeCard(state, "A", G["GD03-067"], "battleArea");
    state = fire(state, src, [damage(1)], { target: [worker] });
    expect(state.players.A.battleArea.filter((c) => c.def.code === "T-015" && c.rested)).toHaveLength(1);
    state = fire(state, src, [damage(1)], { target: [worker] });
    expect(state.players.A.battleArea.filter((c) => c.def.code === "T-015")).toHaveLength(1);

    let opp = game();
    const w2 = placeCard(opp, "A", G["GD03-060"], "battleArea");
    const enemySrc = placeCard(opp, "B", G["GD03-034"], "battleArea");
    opp.activePlayer = "B";
    opp = fire(opp, enemySrc, [damage(1)], { target: [w2] });
    expect(opp.players.A.battleArea.some((c) => c.def.code === "T-015")).toBe(false);
  });

  it("095 (Piloto): a Unit pareada leva dano de efeito do oponente → o dono escolhe 1 inimiga pra AP-1", () => {
    let state = game();
    const unit = placeCard(state, "A", G["GD03-058"], "battleArea");
    const azee = placeCard(state, "A", G["GD03-095"], "battleArea");
    pair(state, unit, azee);
    const enemySrc = placeCard(state, "B", G["GD03-034"], "battleArea");
    const enemy = placeCard(state, "B", G["GD03-001"], "battleArea");
    state = fire(state, enemySrc, [damage(1)], { target: [unit] });
    const decision = state.pendingDecision.A;
    expect(decision?.kind === "abilityResolution" && decision.trigger).toBe("Reaction:effectDamage");
    const ap = effectiveAp(findCard(state, enemy), state);
    state = resolve(state, "A", "GD03-095-EffectDamage", [enemy]);
    expect(effectiveAp(findCard(state, enemy), state)).toBe(ap - 1);
  });

  it("053: só reage a Unit (Tekkadan)/(Teiwaz), com Piloto pareado, no seu turno", () => {
    let state = game();
    const gusion = placeCard(state, "A", G["GD03-053"], "battleArea");
    pair(state, gusion, placeCard(state, "A", G["GD03-096"], "battleArea"));
    const tekkadan = placeCard(state, "A", G["GD03-056"], "battleArea");
    const other = placeCard(state, "A", G["GD03-058"], "battleArea");
    const src = placeCard(state, "A", G["GD03-067"], "battleArea");
    const enemy = placeCard(state, "B", G["GD03-058"], "battleArea"); // Lv2
    state = fire(state, src, [damage(1)], { target: [other] });
    expect(state.pendingDecision.A).toBeNull();
    state = fire(state, src, [damage(1)], { target: [tekkadan] });
    state = resolve(state, "A", "GD03-053-AllyEffectDamage", [enemy]);
    expect(findCard(state, enemy).rested).toBe(true);
  });

  it("128 (Base): só no turno do oponente e só por efeito do oponente", () => {
    let state = game();
    placeCard(state, "A", G["GD03-128"], "baseSection");
    const mine = placeCard(state, "A", G["GD03-058"], "battleArea");
    const enemySrc = placeCard(state, "B", G["GD03-034"], "battleArea");
    const enemy = placeCard(state, "B", G["GD03-001"], "battleArea");
    state = fire(state, enemySrc, [rest], { target: [mine] }); // turno de A
    expect(state.pendingDecision.A).toBeNull();
    findCard(state, mine).rested = false;
    state.activePlayer = "B";
    state = fire(state, enemySrc, [rest], { target: [mine] });
    state = resolve(state, "A", "GD03-128-RestedByEnemyEffect", [enemy]);
    expect(findCard(state, enemy).damage).toBe(1);
  });

  it("038: descansada por efeito no seu turno → uma Unit (ZAFT) ganha AP+2", () => {
    let state = game();
    const guaiz = placeCard(state, "A", G["GD03-038"], "battleArea");
    const src = placeCard(state, "A", G["GD03-067"], "battleArea");
    const ap = effectiveAp(findCard(state, guaiz), state);
    state = fire(state, src, [rest], { target: [guaiz] });
    state = resolve(state, "A", "GD03-038-RestedByEffect", [guaiz]);
    expect(effectiveAp(findCard(state, guaiz), state)).toBe(ap + 2);
  });

  it("124 (Base): parear Piloto Lv.3 ou menor pela jogada normal → descansa inimiga com HP<=3; Lv.4 não", () => {
    let state = game();
    for (let i = 0; i < 5; i++) placeCard(state, "A", RESOURCE, "resourceArea");
    placeCard(state, "A", G["GD03-124"], "baseSection");
    const unit = placeCard(state, "A", G["GD03-058"], "battleArea");
    const unit2 = placeCard(state, "A", G["GD03-058"], "battleArea");
    const enemy = placeCard(state, "B", G["GD03-058"], "battleArea"); // HP2
    const lvl4 = placeCard(state, "A", G["GD03-086"], "hand");
    state = act(state, "A", { kind: "deployCard", cardInstanceId: lvl4, pairWithUnitId: unit2 });
    expect(state.pendingDecision.A).toBeNull();
    const lvl3 = placeCard(state, "A", G["GD03-085"], "hand");
    state = act(state, "A", { kind: "deployCard", cardInstanceId: lvl3, pairWithUnitId: unit });
    state = resolve(state, "A", "GD03-124-PilotPaired", [enemy]);
    expect(findCard(state, enemy).rested).toBe(true);
  });

  it("002: outra Unit sua com <Repair> ataca → escolhe inimiga de Lv. <= a atacante; depois o combate segue", () => {
    let state = game();
    const theO = placeCard(state, "A", G["GD03-002"], "battleArea");
    pair(state, theO, placeCard(state, "A", G["GD03-084"], "battleArea"));
    const attacker = placeCard(state, "A", G["GD03-012"], "battleArea"); // <Repair>, Lv3
    const low = placeCard(state, "B", G["GD03-058"], "battleArea"); // Lv2
    const high = placeCard(state, "B", G["GD03-001"], "battleArea"); // Lv5
    state = act(state, "A", { kind: "declareAttack", attackerId: attacker, target: "player" });
    const decision = state.pendingDecision.A;
    expect(decision?.kind === "abilityResolution" && decision.queue[0].legalTargets).toEqual([low]);
    expect(high).toBeTruthy();
    state = resolve(state, "A", "GD03-002-AllyAttack", [low]);
    expect(findCard(state, low).rested).toBe(true);
    expect(state.combat?.step).not.toBe("attack");
  });

  it("069 + 098: no fim do turno em que pareou, a 069 fica ativa; isso dispara a 098, e o turno troca depois da escolha", () => {
    let state = game();
    const flag = placeCard(state, "A", G["GD03-069"], "battleArea", { rested: true });
    const graham = placeCard(state, "A", G["GD03-098"], "battleArea", { enteredZoneOnTurn: state.turnNumber });
    pair(state, flag, graham);
    const enemy = placeCard(state, "B", G["GD03-058"], "battleArea"); // HP2
    state = act(state, "A", { kind: "finishTurn" });
    state = act(state, "B", { kind: "passEndPhaseAction" });
    state = act(state, "A", { kind: "passEndPhaseAction" });
    expect(findCard(state, flag).rested).toBe(false);
    const decision = state.pendingDecision.A;
    expect(decision?.kind === "abilityResolution" && decision.trigger).toBe("Reaction:setActiveByEffect");
    state = resolve(state, "A", "GD03-098-SetActiveByEffect", [enemy]);
    expect(findCard(state, enemy).zone).toBe("hand");
    expect(state.activePlayer).toBe("B");
    expect(state.phase).toBe("main");
  });

  it("098: ativar por efeito uma Unit JÁ ativa não conta", () => {
    let state = game();
    const flag = placeCard(state, "A", G["GD03-069"], "battleArea");
    const graham = placeCard(state, "A", G["GD03-098"], "battleArea");
    pair(state, flag, graham);
    const src = placeCard(state, "A", G["GD03-067"], "battleArea");
    state = fire(state, src, [setActive], { target: [flag] });
    expect(state.pendingDecision.A).toBeNull();
  });

  it("129 (Base): pode descansar a Base pra moer 1 (se ativa); recusando, nada acontece", () => {
    let state = game();
    const base = placeCard(state, "A", G["GD03-129"], "baseSection");
    const tekkadan = placeCard(state, "A", G["GD03-056"], "battleArea");
    const src = placeCard(state, "A", G["GD03-067"], "battleArea");
    const trash = state.players.A.trash.length;
    state = fire(state, src, [damage(1)], { target: [tekkadan] });
    state = resolve(state, "A", "GD03-129-AllyEffectDamage", [], false);
    expect(findCard(state, base).rested).toBe(false);
    state = fire(state, src, [damage(1)], { target: [tekkadan] });
    state = resolve(state, "A", "GD03-129-AllyEffectDamage");
    expect(findCard(state, base).rested).toBe(true);
    expect(state.players.A.trash.length).toBe(trash + 1);
  });
});
