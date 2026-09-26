import { describe, expect, it } from "vitest";
import { createGame } from "./setup";
import type { CardDef, GameState, PlayerId } from "./types";
import { advanceToMainPhase, runStartPhase } from "./phases";
import { applyPlayerAction, type PlayerAction } from "./actions";
import { dispatchTrigger } from "./dispatcher";
import { attackTargetError } from "./combat";
import { findCard } from "./events";
import { placeCard } from "./__testkit__/cardHarness";
import { buildSt07DeckList } from "../fixtures/st07Deck";
import { buildSt08DeckList } from "../fixtures/st08Deck";
import { ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver } from "../content";
import { GD03_CARD_DEFS } from "../content/gd03";
import { GD03_EFFECT_SPECS } from "../content/gd03/effects";

/**
 * W2b — regras de ataque (C4), camada de dano (C2) e reações de combate, com o fluxo real de
 * combate (declarar → bloqueio → Action Step → dano → reações → Battle End).
 */

const G = GD03_CARD_DEFS;
const PILOT = (traits: string[], extra: Partial<CardDef> = {}): CardDef => ({
  code: "TEST-PILOT",
  nameEn: "Test Pilot",
  cardType: "PILOT",
  color: "white",
  level: 1,
  cost: 1,
  ap: 0,
  hp: 0,
  traits,
  ...extra,
});

function game(): GameState {
  const state = advanceToMainPhase(createGame(buildSt07DeckList(), buildSt08DeckList(), { seed: 88, firstPlayer: "A" }));
  state.players.A.battleArea = [];
  state.players.B.battleArea = [];
  state.players.A.baseSection = [];
  state.players.B.baseSection = [];
  return state;
}

function pair(state: GameState, unitId: string, pilotId: string): void {
  findCard(state, unitId).pairedPilotId = pilotId;
  findCard(state, pilotId).pairedUnitId = unitId;
}

function act(state: GameState, player: PlayerId, action: PlayerAction): GameState {
  return applyPlayerAction(state, player, action, ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver);
}

/** ataque de A até o fim do Damage Step (ou até a 1ª pausa) */
function attack(state: GameState, attackerId: string, target: "player" | { unitId: string }): GameState {
  let s = act(state, "A", { kind: "declareAttack", attackerId, target });
  if (s.pendingDecision.A || s.pendingDecision.B) return s;
  s = act(s, "B", { kind: "skipBlock" });
  s = act(s, "B", { kind: "passAction" });
  return act(s, "A", { kind: "passAction" });
}

function spec(id: string) {
  const found = GD03_EFFECT_SPECS.find((s) => s.id === id);
  if (!found) throw new Error(`spec ${id} ausente`);
  return found;
}

function runSpec(state: GameState, id: string, sourceId: string, targets: Record<string, string[]> = {}): GameState {
  const s = spec(id);
  return dispatchTrigger(state, sourceId, s.trigger, [s], {
    targets,
    allSpecs: ALL_EFFECT_SPECS,
    predicateResolver: defaultPredicateResolver,
    targetFilterResolver: defaultTargetFilterResolver,
  });
}

describe("W2b — regras de ataque (C4)", () => {
  it("019 【During Pair】: descansada e pareada, obriga o ataque inimigo a mirar nela; sem Piloto, não", () => {
    const state = game();
    const attacker = placeCard(state, "A", G["GD03-018"], "battleArea");
    const age2 = placeCard(state, "B", G["GD03-019"], "battleArea", { rested: true });
    expect(() => act(state, "A", { kind: "declareAttack", attackerId: attacker, target: "player" })).not.toThrow();
    pair(state, age2, placeCard(state, "B", PILOT(["Earth Federation"]), "battleArea"));
    expect(() => act(state, "A", { kind: "declareAttack", attackerId: attacker, target: "player" })).toThrow(/obriga/);
    expect(() => act(state, "A", { kind: "declareAttack", attackerId: attacker, target: { unitId: age2 } })).not.toThrow();
  });

  it("025: qualquer Unit (Maganac Corps) descansada do dono provoca; 074 só com outra (Superpower Bloc)", () => {
    const state = game();
    const attacker = placeCard(state, "A", G["GD03-018"], "battleArea");
    placeCard(state, "B", G["GD03-025"], "battleArea");
    const maganac = placeCard(state, "B", G["GD03-028"], "battleArea", { rested: true });
    const other = placeCard(state, "B", G["GD03-058"], "battleArea", { rested: true });
    expect(() => act(state, "A", { kind: "declareAttack", attackerId: attacker, target: { unitId: other } })).toThrow(/obriga/);
    expect(() => act(state, "A", { kind: "declareAttack", attackerId: attacker, target: { unitId: maganac } })).not.toThrow();

    const s2 = game();
    const atk2 = placeCard(s2, "A", G["GD03-018"], "battleArea");
    const tieren = placeCard(s2, "B", G["GD03-074"], "battleArea", { rested: true });
    pair(s2, tieren, placeCard(s2, "B", PILOT(["Super Soldier"]), "battleArea"));
    expect(() => act(s2, "A", { kind: "declareAttack", attackerId: atk2, target: "player" })).not.toThrow();
    placeCard(s2, "B", G["GD03-082"], "battleArea"); // outra (Superpower Bloc)
    expect(() => act(s2, "A", { kind: "declareAttack", attackerId: atk2, target: "player" })).toThrow(/obriga/);
  });

  it("042 mira Unit ativa Lv.5 ou menos só com 5+ AP; 035/105 liberam alvo ativo por AP e por \"sem Piloto\"", () => {
    const state = game();
    const duel = placeCard(state, "A", G["GD03-042"], "battleArea"); // AP3
    const activeEnemy = placeCard(state, "B", G["GD03-058"], "battleArea"); // Lv2, ativa
    expect(() => act(state, "A", { kind: "declareAttack", attackerId: duel, target: { unitId: activeEnemy } })).toThrow();
    findCard(state, duel).statModifiers.push({ stat: "ap", amount: 2, duration: "endOfTurn", appliedOnTurn: state.turnNumber, appliedBy: "A" });
    expect(() => act(state, "A", { kind: "declareAttack", attackerId: duel, target: { unitId: activeEnemy } })).not.toThrow();

    let s2 = game();
    const gfred = placeCard(s2, "A", G["GD03-035"], "battleArea"); // AP4
    const weak = placeCard(s2, "B", G["GD03-058"], "battleArea"); // AP2 ativa
    const strong = placeCard(s2, "B", G["GD03-018"], "battleArea"); // AP5 ativa
    s2 = runSpec(s2, "GD03-035-WhenLinked", gfred);
    expect(() => act(s2, "A", { kind: "declareAttack", attackerId: gfred, target: { unitId: weak } })).not.toThrow();
    expect(() => act(s2, "A", { kind: "declareAttack", attackerId: gfred, target: { unitId: strong } })).toThrow();

    let s3 = game();
    const cmd = placeCard(s3, "A", G["GD03-105"], "hand");
    const unit = placeCard(s3, "A", G["GD03-018"], "battleArea");
    const lone = placeCard(s3, "B", G["GD03-058"], "battleArea");
    const piloted = placeCard(s3, "B", G["GD03-001"], "battleArea");
    pair(s3, piloted, placeCard(s3, "B", PILOT(["Earth Federation"]), "battleArea"));
    s3 = runSpec(s3, "GD03-105-Main", cmd, { target: [unit] });
    expect(() => act(s3, "A", { kind: "declareAttack", attackerId: unit, target: { unitId: lone } })).not.toThrow();
    expect(() => act(s3, "A", { kind: "declareAttack", attackerId: unit, target: { unitId: piloted } })).toThrow();
  });

  it("081 só ataca no turno em que uma Unit (Superpower Bloc)/(UN) sua entrou em jogo", () => {
    const state = game();
    const enact = placeCard(state, "A", G["GD03-081"], "battleArea");
    expect(() => act(state, "A", { kind: "declareAttack", attackerId: enact, target: "player" })).toThrow(/só pode atacar/);
    placeCard(state, "A", G["GD03-082"], "battleArea", { enteredZoneOnTurn: state.turnNumber });
    expect(() => act(state, "A", { kind: "declareAttack", attackerId: enact, target: "player" })).not.toThrow();
  });
});

describe("W2b — camada de dano (C2)", () => {
  it("020: com um Ad Balloon em jogo não recebe dano de batalha; o token não fica ativo nem pode ser pareado", () => {
    let state = game();
    const zaku = placeCard(state, "B", G["GD03-020"], "battleArea", { rested: true });
    const attacker = placeCard(state, "A", G["GD03-018"], "battleArea"); // AP5
    for (let i = 0; i < 4; i++) placeCard(state, "B", G["GD03-017"], "trash"); // (Cyclops Team)
    state = dispatchTrigger(state, zaku, "When Paired", [spec("GD03-020-WhenPaired")], {
      allSpecs: ALL_EFFECT_SPECS,
      predicateResolver: defaultPredicateResolver,
      targetFilterResolver: defaultTargetFilterResolver,
    });
    const balloons = state.players.B.battleArea.filter((c) => c.def.code === "T-014");
    expect(balloons).toHaveLength(2);
    state = attack(state, attacker, { unitId: zaku });
    expect(findCard(state, zaku).damage).toBe(0);
    expect(findCard(state, zaku).zone).toBe("battleArea");

    // Start Phase do dono: o Ad Balloon continua descansado
    state.activePlayer = "B";
    state = runStartPhase(state);
    expect(findCard(state, balloons[0].instanceId).rested).toBe(true);
  });

  it("070 descansada protege os Shields do dono do dano de batalha", () => {
    let state = game();
    placeCard(state, "B", G["GD03-070"], "battleArea", { rested: true });
    const attacker = placeCard(state, "A", G["GD03-018"], "battleArea");
    const shields = state.players.B.shields.length;
    state = attack(state, attacker, "player");
    expect(state.players.B.shields.length).toBe(shields);
  });

  it("041 dá 3 de dano em todas as Bases (dos 2 lados)", () => {
    let state = game();
    const mine = placeCard(state, "A", G["GD03-125"], "baseSection");
    const theirs = placeCard(state, "B", G["GD03-125"], "baseSection");
    const patulia = placeCard(state, "A", G["GD03-041"], "battleArea");
    state = runSpec(state, "GD03-041-Deploy", patulia);
    expect([findCard(state, mine).damage, findCard(state, theirs).damage]).toEqual([3, 3]);
  });

  it("115: sem Lv.7 protege de atacante com AP<=2; com Lv.7, de AP<=5", () => {
    let state = game();
    const cmd = placeCard(state, "B", G["GD03-115"], "hand");
    const defender = placeCard(state, "B", G["GD03-058"], "battleArea", { rested: true });
    pair(state, defender, placeCard(state, "B", G["GD03-094"], "battleArea")); // (X-Rounder)
    const attacker = placeCard(state, "A", G["GD03-035"], "battleArea"); // AP4
    let s = act(state, "A", { kind: "declareAttack", attackerId: attacker, target: { unitId: defender } });
    s = act(s, "B", { kind: "skipBlock" });
    const s1 = runSpec(s, "GD03-115-Action", cmd, { target: [defender] });
    expect(s1.combat?.unitDamageProtection?.maxAttackerAp).toBe(2);
    for (let i = 0; i < 7; i++) placeCard(s, "B", { code: "RES", nameEn: "Resource", cardType: "RESOURCE", color: "colorless" }, "resourceArea");
    const s2 = runSpec(s, "GD03-115-Action", cmd, { target: [defender] });
    expect(s2.combat?.unitDamageProtection?.maxAttackerAp).toBe(5);
  });
});

describe("W2b — reações de combate", () => {
  it("052: dano de batalha numa inimiga Lv.5 ou menos, com Piloto (CB) em jogo, destrói a inimiga", () => {
    let state = game();
    const virtue = placeCard(state, "A", G["GD03-052"], "battleArea"); // AP3
    pair(state, virtue, placeCard(state, "A", PILOT(["CB"]), "battleArea"));
    const tough = placeCard(state, "B", G["GD03-070"], "battleArea", { rested: true }); // Lv6 HP5
    const mid = placeCard(state, "B", G["GD03-064"], "battleArea", { rested: true }); // Lv5 AP2 HP5 (a Virtue sobrevive)
    let s = attack(state, virtue, { unitId: tough });
    expect(findCard(s, tough).zone).toBe("battleArea"); // Lv6: não
    s = attack(state, virtue, { unitId: mid });
    expect(findCard(s, mid).zone).toBe("trash");
    expect(s.combat).toBeNull();
  });

  it("076: Unit (Triple Ship Alliance) causa dano de batalha → pode devolver a inimiga à mão; o combate fecha depois da escolha", () => {
    let state = game();
    placeCard(state, "A", G["GD03-076"], "battleArea");
    const aile = placeCard(state, "A", G["GD03-072"], "battleArea"); // (Triple Ship Alliance) AP3
    const enemy = placeCard(state, "B", G["GD03-070"], "battleArea", { rested: true }); // HP5, sobrevive
    state = attack(state, aile, { unitId: enemy });
    const decision = state.pendingDecision.A;
    expect(decision?.kind === "abilityResolution" && decision.trigger).toBe("Reaction:battleDamageToEnemyUnit");
    state = act(state, "A", { kind: "resolveAbility", resolutions: [{ specId: "GD03-076-BattleDamage", activate: true, targetIds: [] }] });
    expect(findCard(state, enemy).zone).toBe("hand");
    expect(state.combat).toBeNull();
  });

  it("125 (Base): Unit (G Team) Lv.6+ destrói em batalha → pode recuperar 2 HP", () => {
    let state = game();
    placeCard(state, "A", G["GD03-125"], "baseSection");
    const heavyarms = placeCard(state, "A", G["GD03-029"], "battleArea", { damage: 2 }); // Lv6 AP4 HP5 (sobrevive aos 2 da batalha)
    const weak = placeCard(state, "B", G["GD03-058"], "battleArea", { rested: true }); // AP2 HP2
    state = attack(state, heavyarms, { unitId: weak });
    const decision = state.pendingDecision.A;
    expect(decision?.kind === "abilityResolution" && decision.trigger).toBe("Reaction:destroyedEnemyInBattle");
    state = act(state, "A", { kind: "resolveAbility", resolutions: [{ specId: "GD03-125-DestroyedEnemy", activate: true, targetIds: [] }] });
    expect(findCard(state, heavyarms).damage).toBe(2); // 2 + 2 da batalha − 2 curados
    expect(state.combat).toBeNull();
  });

  it("049: destruir carta da área de escudo com 10+ cartas (CB) no trash → destrói a inimiga de menor HP", () => {
    let state = game();
    const exia = placeCard(state, "A", G["GD03-049"], "battleArea");
    for (let i = 0; i < 10; i++) placeCard(state, "A", G["GD03-052"], "trash");
    const low = placeCard(state, "B", G["GD03-058"], "battleArea"); // HP2
    placeCard(state, "B", G["GD03-070"], "battleArea"); // HP5
    state = attack(state, exia, "player");
    // Shields com 【Burst】: o defensor recusa antes (Burst resolve primeiro, CR 10-1-6-8)
    while (state.pendingDecision.B?.kind === "burst") {
      state = act(state, "B", { kind: "resolveBurstDecision", activate: false });
    }
    const decision = state.pendingDecision.A;
    expect(decision?.kind === "abilityResolution" && decision.queue[0].legalTargets).toEqual([low]);
    state = act(state, "A", { kind: "resolveAbility", resolutions: [{ specId: "GD03-049-DestroyedShield", activate: true, targetIds: [low] }] });
    expect(findCard(state, low).zone).toBe("trash");
    expect(state.combat).toBeNull();
  });

  it("CR 10-1-6-4 no combate: a 052 destruída na troca de dano ainda destrói a inimiga (com outro Piloto (CB) em jogo)", () => {
    let state = game();
    const virtue = placeCard(state, "A", G["GD03-052"], "battleArea"); // AP3 HP3
    pair(state, virtue, placeCard(state, "A", PILOT(["CB"]), "battleArea"));
    const buddy = placeCard(state, "A", G["GD03-058"], "battleArea");
    pair(state, buddy, placeCard(state, "A", PILOT(["CB"]), "battleArea"));
    const enemy = placeCard(state, "B", G["GD03-001"], "battleArea", { rested: true }); // Lv5 AP4 HP4 — mata a Virtue
    state = attack(state, virtue, { unitId: enemy });
    expect(findCard(state, virtue).zone).toBe("trash");
    expect(findCard(state, enemy).zone).toBe("trash");
    expect(state.combat).toBeNull();
  });
});

describe("W2b — attackTargetError (regra única do motor e da UI)", () => {
  it("provocação barra mirar o jogador e outra Unit; 105 libera só inimiga ativa sem Piloto", () => {
    let state = game();
    const attacker = placeCard(state, "A", G["GD03-018"], "battleArea");
    const lone = placeCard(state, "B", G["GD03-058"], "battleArea");
    const piloted = placeCard(state, "B", G["GD03-001"], "battleArea");
    pair(state, piloted, placeCard(state, "B", PILOT(["Earth Federation"]), "battleArea"));
    const unit = findCard(state, attacker);
    expect(attackTargetError(state, unit, "player")).toBeNull();
    expect(attackTargetError(state, unit, { unitId: lone })).not.toBeNull();
    const cmd = placeCard(state, "A", G["GD03-105"], "hand");
    state = runSpec(state, "GD03-105-Main", cmd, { target: [attacker] });
    expect(attackTargetError(state, findCard(state, attacker), { unitId: lone })).toBeNull();
    expect(attackTargetError(state, findCard(state, attacker), { unitId: piloted })).not.toBeNull();

    const age2 = placeCard(state, "B", G["GD03-019"], "battleArea", { rested: true });
    pair(state, age2, placeCard(state, "B", PILOT(["Earth Federation"]), "battleArea"));
    expect(attackTargetError(state, findCard(state, attacker), "player")).toMatch(/obriga/);
    expect(attackTargetError(state, findCard(state, attacker), { unitId: lone })).toMatch(/obriga/);
    expect(attackTargetError(state, findCard(state, attacker), { unitId: age2 })).toBeNull();
  });
});
