import { describe, expect, it } from "vitest";
import { createGame, TOKEN_EX_RESOURCE_CODE, EX_RESOURCE_TOKEN } from "./setup";
import type { CardDef, GameState, PlayerId } from "./types";
import { advanceToMainPhase } from "./phases";
import { dispatchTrigger } from "./dispatcher";
import { resolveDamageStep } from "./combat";
import { enumerateLegalActions } from "./legalActions";
import { attackTargetError } from "./combat";
import { applyPlayerAction, type PlayerAction } from "./actions";
import { effectiveAp } from "./types";
import { findCard } from "./events";
import { placeCard } from "./__testkit__/cardHarness";
import { buildSt07DeckList, PTOLEMAIOS } from "../fixtures/st07Deck";
import { buildSt08DeckList } from "../fixtures/st08Deck";
import { ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver } from "../content";
import { GD02_CARD_DEFS as G2 } from "../content/gd02";
import { GD04_CARD_DEFS } from "../content/gd04";
import { GD03_CARD_DEFS } from "../content/gd03";
import { getCardDefByCode } from "../content/allCardDefs";

/** W5 — GD04-C. W5a: camada de dano (C2) — redução, imunidade, "próximo dano", redirecionar (engine/damageLayer.ts). */

const G = GD04_CARD_DEFS;
const OPTS = { predicateResolver: defaultPredicateResolver, targetFilterResolver: defaultTargetFilterResolver };

const UNIT = (extra: Partial<CardDef> = {}): CardDef => ({
  code: "TEST-UNIT",
  nameEn: "Test Unit",
  cardType: "UNIT",
  color: "white",
  level: 3,
  cost: 2,
  ap: 3,
  hp: 3,
  traits: [],
  ...extra,
});
const PILOT = (extra: Partial<CardDef> = {}): CardDef => ({
  code: "TEST-PILOT",
  nameEn: "Test Pilot",
  cardType: "PILOT",
  color: "white",
  level: 1,
  cost: 1,
  ap: 0,
  hp: 0,
  traits: [],
  ...extra,
});
const CARD_BASE = (): CardDef => ({ code: "TEST-BASE", nameEn: "Test Base", cardType: "BASE", color: "white", level: 1, cost: 1, ap: 0, hp: 5 });
const COMMAND: CardDef = { code: "TEST-COMMAND", nameEn: "Test Command", cardType: "COMMAND", color: "white", level: 1, cost: 1, ap: 0, hp: 0 };

function game(): GameState {
  const state = advanceToMainPhase(createGame(buildSt07DeckList(), buildSt08DeckList(), { seed: 88, firstPlayer: "A" }));
  for (const p of ["A", "B"] as const) {
    state.players[p].battleArea = [];
    state.players[p].baseSection = [];
    state.players[p].trash = [];
  }
  return state;
}
function pair(state: GameState, unitId: string, pilotId: string): void {
  findCard(state, unitId).pairedPilotId = pilotId;
  findCard(state, pilotId).pairedUnitId = unitId;
}
/** Unit cujo link é o Piloto dado (pra testar 【During Link】 de Piloto) */
const linkedTo = (pilot: CardDef, extra: Partial<CardDef> = {}): CardDef => UNIT({ hp: 9, link: { kind: "pilotName", values: [pilot.nameEn] }, ...extra });
function runSpec(state: GameState, id: string, sourceId: string, targets: Record<string, string[]> = {}): GameState {
  const s = ALL_EFFECT_SPECS.find((x) => x.id === id);
  if (!s) throw new Error(`spec ${id} ausente`);
  return dispatchTrigger(state, sourceId, s.trigger, [s], { targets, allSpecs: ALL_EFFECT_SPECS, ...OPTS });
}
/** dano de efeito vindo de um Command do `by` (ou de uma Unit em campo, `fromUnit`) */
function effectHit(state: GameState, targetId: string, amount: number, by: PlayerId, fromUnit = false): GameState {
  const src = fromUnit ? placeCard(state, by, UNIT(), "battleArea") : placeCard(state, by, COMMAND, "trash");
  return dispatchTrigger(
    state,
    src,
    "Main",
    [{ id: "T-hit", cardCode: findCard(state, src).def.code, trigger: "Main", actions: [{ op: "damageUnit", target: { kind: "instance", instanceId: targetId }, amount }], sourceText: "t" }],
    { allSpecs: ALL_EFFECT_SPECS, ...OPTS },
  );
}
/** combate pronto pro Damage Step (`blockerId` = Unit que bloqueou e é o alvo atual) */
function damageStep(state: GameState, attackerId: string, target: string | "player", blockerId?: string): GameState {
  const attacker = findCard(state, attackerId);
  const tgt = target === "player" ? ("player" as const) : { unitId: target };
  return resolveDamageStep({
    ...state,
    combat: {
      step: "damage",
      attackerId,
      attackingPlayer: attacker.owner,
      defendingPlayer: attacker.owner === "A" ? "B" : "A",
      originalTarget: blockerId ? "player" : tgt,
      currentTarget: tgt,
      blockerUsedBy: blockerId,
      actionPasses: { A: false, B: false },
      actionPriority: "B",
    },
  });
}
const dmg = (state: GameState, id: string) => findCard(state, id).damage;
const RESOURCE: CardDef = { code: "TEST-RES", nameEn: "Resource", cardType: "RESOURCE", color: "white", level: 0, cost: 0, ap: 0, hp: 0 };
/** `n` Recursos normais + `ex` EX Resources na Resource Area */
function resources(state: GameState, player: PlayerId, n: number, ex = 0): string[] {
  state.players[player].resourceArea = [];
  for (let i = 0; i < n; i++) placeCard(state, player, RESOURCE, "resourceArea");
  return Array.from({ length: ex }, () => placeCard(state, player, EX_RESOURCE_TOKEN, "resourceArea"));
}
const exCount = (state: GameState, player: PlayerId) =>
  state.players[player].resourceArea.filter((r) => r.def.code === TOKEN_EX_RESOURCE_CODE).length;
function act(state: GameState, player: PlayerId, action: PlayerAction): GameState {
  return applyPlayerAction(state, player, action, ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver);
}
/** joga um Command pagando com os Recursos (o EX entra no pagamento quando `withEx`) */
function playCmd(state: GameState, def: CardDef, opts: { withEx: boolean; targets?: Record<string, string[]>; trigger?: "Main" | "Action" }): GameState {
  const cost = def.cost ?? 0;
  const ex = resources(state, "A", Math.max(def.level ?? 0, cost), 1);
  const normal = state.players.A.resourceArea.filter((r) => r.def.code !== TOKEN_EX_RESOURCE_CODE).map((r) => r.instanceId);
  const pay = opts.withEx ? [...ex, ...normal.slice(0, cost - 1)] : normal.slice(0, cost);
  const card = placeCard(state, "A", def, "hand");
  return act(state, "A", { kind: "playCommand", cardInstanceId: card, trigger: opts.trigger ?? "Main", resourceInstanceIds: pay, targets: opts.targets });
}
const DAWN_CMD = (extra: Partial<CardDef> = {}): CardDef => ({
  ...COMMAND,
  code: "TEST-DAWN",
  cost: 1,
  level: 1,
  traits: ["Dawn of Fold", "Academy"],
  triggerKeywords: ["Main"],
  ...extra,
});
const inPlay = (state: GameState, id: string) =>
  state.players.A.battleArea.concat(state.players.B.battleArea).some((c) => c.instanceId === id);

describe("W5a — camada de dano (C2)", () => {
  it("029 【Once per Turn】: com Piloto (CB) em jogo, o 1º dano inimigo do turno é reduzido em 1", () => {
    const state = game();
    const self = placeCard(state, "A", { ...G["GD04-029"], hp: 9 }, "battleArea");
    expect(dmg(effectHit(state, self, 2, "B"), self)).toBe(2);
    const holder = placeCard(state, "A", UNIT({ hp: 9 }), "battleArea");
    pair(state, holder, placeCard(state, "A", PILOT({ traits: ["CB"] }), "battleArea"));
    const once = effectHit(state, self, 2, "B");
    expect(dmg(once, self)).toBe(1);
    expect(dmg(effectHit(once, self, 1, "B"), self)).toBe(2);
    expect(dmg(effectHit(state, self, 2, "A"), self)).toBe(2);
  });

  it("053 【During Link】【Once per Turn】: reduz em 1 também o dano de batalha", () => {
    const state = game();
    const self = placeCard(state, "B", { ...G["GD04-053"], hp: 9 }, "battleArea", { rested: true });
    const link = G["GD04-053"].link;
    const pilot = link?.kind === "pilotName" ? PILOT({ nameEn: link.values[0] }) : PILOT({ traits: link?.values ?? [] });
    const attacker = placeCard(state, "A", UNIT({ ap: 2, hp: 9 }), "battleArea");
    expect(dmg(damageStep(state, attacker, self), self)).toBe(2);
    pair(state, self, placeCard(state, "B", pilot, "battleArea"));
    expect(dmg(damageStep(state, attacker, self), self)).toBe(1);
  });

  it("068: dano de EFEITO inimigo reduzido em 3; dano de batalha não", () => {
    const state = game();
    const self = placeCard(state, "B", { ...G["GD04-068"], hp: 9 }, "battleArea", { rested: true });
    expect(dmg(effectHit(state, self, 4, "A"), self)).toBe(1);
    const attacker = placeCard(state, "A", UNIT({ ap: 2, hp: 9 }), "battleArea");
    expect(dmg(damageStep(state, attacker, self), self)).toBe(2);
  });

  it("098 (Piloto) 【During Link】: a Unit pareada reduz dano de efeito inimigo em 2", () => {
    const state = game();
    const unit = placeCard(state, "A", linkedTo(G["GD04-098"]), "battleArea");
    pair(state, unit, placeCard(state, "A", G["GD04-098"], "battleArea"));
    expect(dmg(effectHit(state, unit, 3, "B"), unit)).toBe(1);
    const unlinked = placeCard(state, "A", UNIT({ hp: 9 }), "battleArea");
    pair(state, unlinked, placeCard(state, "A", G["GD04-098"], "battleArea"));
    expect(dmg(effectHit(state, unlinked, 3, "B"), unlinked)).toBe(3);
  });

  it("093 【When Linked】: o PRÓXIMO dano da Link Unit (ZAFT) escolhida é reduzido em 2 (só o próximo)", () => {
    const state = game();
    const unit = placeCard(state, "A", linkedTo(G["GD04-093"], { traits: ["ZAFT"] }), "battleArea");
    const pilot = placeCard(state, "A", G["GD04-093"], "battleArea");
    pair(state, unit, pilot);
    const s = runSpec(state, "GD04-093-WhenLinked", pilot, { target: [unit] });
    const first = effectHit(s, unit, 3, "A"); // "the next damage it receives": qualquer origem
    expect(dmg(first, unit)).toBe(1);
    expect(dmg(effectHit(first, unit, 3, "B"), unit)).toBe(4);
  });

  it("113 【Action】: nesta batalha, dano de batalha na Unit escolhida -3", () => {
    const state = game();
    const self = placeCard(state, "B", UNIT({ hp: 9 }), "battleArea", { rested: true });
    const attacker = placeCard(state, "A", UNIT({ ap: 4, hp: 9 }), "battleArea");
    const src = placeCard(state, "B", G["GD04-113"], "trash");
    const s = runSpec(state, "GD04-113-Action", src, { target: [self] });
    expect(dmg(damageStep(s, attacker, self), self)).toBe(1);
  });

  it("119 【Main】: Unit pareada com Piloto (Newtype) não recebe dano de efeito de Units inimigas neste turno", () => {
    const state = game();
    const unit = placeCard(state, "A", UNIT({ hp: 9 }), "battleArea");
    pair(state, unit, placeCard(state, "A", PILOT({ traits: ["Newtype"] }), "battleArea"));
    const src = placeCard(state, "A", G["GD04-119"], "trash");
    const s = runSpec(state, "GD04-119-Main", src, { target: [unit] });
    expect(dmg(effectHit(s, unit, 3, "B", true), unit)).toBe(0);
    expect(dmg(effectHit(s, unit, 3, "B"), unit)).toBe(3); // Command não é "enemy Unit"
    expect(dmg(effectHit(s, unit, 3, "A", true), unit)).toBe(3);
  });

  it("087 (Piloto) 【During Link】【Attack】: o dano de batalha desta Unit vai pra Unit (Academy) escolhida", () => {
    const state = game();
    const self = placeCard(state, "A", linkedTo(G["GD04-087"], { ap: 1, hp: 2 }), "battleArea");
    const pilot = placeCard(state, "A", G["GD04-087"], "battleArea");
    pair(state, self, pilot);
    const academy = placeCard(state, "A", UNIT({ hp: 9, traits: ["Academy"] }), "battleArea");
    const enemy = placeCard(state, "B", UNIT({ ap: 3, hp: 9 }), "battleArea", { rested: true });
    const s = runSpec(state, "GD04-087-Attack", pilot, { target: [academy] });
    const after = damageStep(s, self, enemy);
    expect(dmg(after, self)).toBe(0);
    expect(dmg(after, academy)).toBe(3);
    expect(inPlay(after, self)).toBe(true);
    expect(dmg(after, enemy)).toBeGreaterThan(0);
  });

  it("095 (Piloto) 【When Linked】: neste turno, dano de batalha da Unit (Minerva Squad) escolhida vai pra Unit pareada", () => {
    const state = game();
    const linked = placeCard(state, "B", linkedTo(G["GD04-095"]), "battleArea");
    const pilot = placeCard(state, "B", G["GD04-095"], "battleArea");
    pair(state, linked, pilot);
    const minerva = placeCard(state, "B", UNIT({ hp: 1, traits: ["Minerva Squad"] }), "battleArea", { rested: true });
    const s = runSpec(state, "GD04-095-WhenLinked", pilot, { target: [minerva] });
    const attacker = placeCard(s, "A", UNIT({ ap: 3, hp: 9 }), "battleArea");
    const after = damageStep(s, attacker, minerva);
    expect(inPlay(after, minerva)).toBe(true);
    expect(dmg(after, linked)).toBe(3);
  });

  it("088 (Piloto): bloqueada por Unit Lv.4-, não recebe dano de batalha; Lv.5 ou sem bloqueio recebe", () => {
    const state = game();
    const self = placeCard(state, "A", UNIT({ ap: 1, hp: 9 }), "battleArea");
    pair(state, self, placeCard(state, "A", G["GD04-088"], "battleArea"));
    const low = placeCard(state, "B", UNIT({ ap: 3, hp: 9, level: 4 }), "battleArea");
    const high = placeCard(state, "B", UNIT({ ap: 3, hp: 9, level: 5 }), "battleArea");
    expect(dmg(damageStep(state, self, low, low), self)).toBe(0);
    expect(dmg(damageStep(state, self, high, high), self)).toBe(3);
    findCard(state, low).rested = true;
    expect(dmg(damageStep(state, self, low), self)).toBe(3);
  });

  it("123 (Base): com Unit (Zeon) sua descansada, não recebe dano de batalha de Lv.4-", () => {
    const state = game();
    const base = placeCard(state, "B", G["GD04-123"], "baseSection");
    const attacker = placeCard(state, "A", UNIT({ ap: 2, level: 4 }), "battleArea");
    expect(dmg(damageStep(state, attacker, "player"), base)).toBe(2);
    placeCard(state, "B", UNIT({ traits: ["Zeon"] }), "battleArea", { rested: true });
    expect(dmg(damageStep(state, attacker, "player"), base)).toBe(0);
    const big = placeCard(state, "A", UNIT({ ap: 2, level: 5 }), "battleArea");
    expect(dmg(damageStep(state, big, "player"), base)).toBe(2);
  });

  it("GD02-129 (Base): não recebe dano de efeito inimigo", () => {
    const state = game();
    const base = placeCard(state, "B", G2["GD02-129"], "baseSection");
    expect(dmg(effectHit(state, base, 2, "A"), base)).toBe(0);
  });

  it("ST07-015 (Base): com Unit (CB) descansada, Units inimigas Lv.3- (não token) não causam dano", () => {
    const state = game();
    const base = placeCard(state, "B", PTOLEMAIOS, "baseSection");
    const low = placeCard(state, "A", UNIT({ ap: 2, level: 3 }), "battleArea");
    expect(dmg(damageStep(state, low, "player"), base)).toBe(2);
    placeCard(state, "B", UNIT({ traits: ["CB"] }), "battleArea", { rested: true });
    const token = placeCard(state, "A", UNIT({ ap: 2, level: 1, isToken: true }), "battleArea");
    expect(dmg(damageStep(state, low, "player"), base)).toBe(0);
    expect(dmg(damageStep(state, token, "player"), base)).toBe(2);
  });
});

describe("W5b — EX Resource e origem do pagamento (C6)", () => {
  it("018 【Once per Turn】: no seu turno, outra Unit (Academy) sua recebe dano inimigo → 1 EX Resource", () => {
    const state = game();
    resources(state, "A", 3);
    placeCard(state, "A", G["GD04-018"], "battleArea");
    const academy = placeCard(state, "A", UNIT({ hp: 9, traits: ["Academy"] }), "battleArea");
    const once = effectHit(state, academy, 1, "B");
    expect(exCount(once, "A")).toBe(1);
    expect(exCount(effectHit(once, academy, 1, "B"), "A")).toBe(1);
    expect(exCount(effectHit({ ...state, activePlayer: "B" }, academy, 1, "B"), "A")).toBe(0);
  });

  it("018: dano de BATALHA também conta (a Unit Academy que ataca leva o contra-dano)", () => {
    const state = game();
    resources(state, "A", 3);
    placeCard(state, "A", G["GD04-018"], "battleArea");
    const academy = placeCard(state, "A", UNIT({ hp: 9, ap: 1, traits: ["Academy"] }), "battleArea");
    const enemy = placeCard(state, "B", UNIT({ hp: 9, ap: 2 }), "battleArea", { rested: true });
    const s = act({ ...state, combat: { step: "action", attackerId: academy, attackingPlayer: "A", defendingPlayer: "B", originalTarget: { unitId: enemy }, currentTarget: { unitId: enemy }, actionPasses: { A: true, B: false }, actionPriority: "B" } }, "B", { kind: "passAction" });
    expect(dmg(s, academy)).toBe(2);
    expect(exCount(s, "A")).toBe(1);
  });

  it("020 【Once per Turn】: jogar Command (Dawn of Fold) pagando com EX compra 1; sem EX não", () => {
    const state = game();
    placeCard(state, "A", G["GD04-020"], "battleArea");
    const hand0 = state.players.A.hand.length;
    expect(playCmd(state, DAWN_CMD(), { withEx: true }).players.A.hand.length).toBe(hand0 + 1);
    const state2 = game();
    placeCard(state2, "A", G["GD04-020"], "battleArea");
    const hand2 = state2.players.A.hand.length;
    expect(playCmd(state2, DAWN_CMD(), { withEx: false }).players.A.hand.length).toBe(hand2);
  });

  it("085 (Piloto) 【During Link】: Command (Academy) pago com EX e sem EX restante → 1 EX Resource descansado", () => {
    const state = game();
    const unit = placeCard(state, "A", linkedTo(G["GD04-085"]), "battleArea");
    pair(state, unit, placeCard(state, "A", G["GD04-085"], "battleArea"));
    const after = playCmd(state, DAWN_CMD(), { withEx: true });
    const ex = after.players.A.resourceArea.filter((r) => r.def.code === TOKEN_EX_RESOURCE_CODE);
    expect(ex.length).toBe(1);
    expect(ex[0].rested).toBe(true);
  });

  it("106 【Main】: 1 Unit (Academy) pode atacar Unit ativa com AP<=5; pago com EX, até 2 (sem EX só vale o 1º)", () => {
    const state = game();
    const u1 = placeCard(state, "A", UNIT({ traits: ["Academy"] }), "battleArea");
    const u2 = placeCard(state, "A", UNIT({ traits: ["Academy"] }), "battleArea");
    const withEx = playCmd(state, G["GD04-106"], { withEx: true, targets: { target: [u1, u2] } });
    expect(findCard(withEx, u1).attackTargetRelaxUntilTurn?.maxAp).toBe(5);
    expect(findCard(withEx, u2).attackTargetRelaxUntilTurn?.maxAp).toBe(5);
    const state2 = game();
    const v1 = placeCard(state2, "A", UNIT({ traits: ["Academy"] }), "battleArea");
    const v2 = placeCard(state2, "A", UNIT({ traits: ["Academy"] }), "battleArea");
    const plain = playCmd(state2, G["GD04-106"], { withEx: false, targets: { target: [v1, v2] } });
    expect(findCard(plain, v1).attackTargetRelaxUntilTurn?.maxAp).toBe(5);
    expect(findCard(plain, v2).attackTargetRelaxUntilTurn).toBeUndefined(); // sem EX, só o 1º
  });

  it("108 【Main】: próximo dano da Unit (Academy) -2; pago com EX, -4", () => {
    const state = game();
    const unit = placeCard(state, "A", UNIT({ hp: 9, traits: ["Academy"] }), "battleArea");
    const plain = playCmd(state, G["GD04-108"], { withEx: false, targets: { target: [unit] } });
    expect(dmg(effectHit(plain, unit, 5, "B"), unit)).toBe(3);
    const state2 = game();
    const unit2 = placeCard(state2, "A", UNIT({ hp: 9, traits: ["Academy"] }), "battleArea");
    const ex = playCmd(state2, G["GD04-108"], { withEx: true, targets: { target: [unit2] } });
    expect(dmg(effectHit(ex, unit2, 5, "B"), unit2)).toBe(1);
  });

  it("110 【Main】: coloca 1 EX Base (a Base atual vai pro trash, sem 【Destroyed】)", () => {
    const state = game();
    const old = placeCard(state, "A", CARD_BASE(), "baseSection");
    const after = playCmd(state, G["GD04-110"], { withEx: false });
    expect(after.players.A.baseSection.length).toBe(1);
    expect(after.players.A.baseSection[0].def.code).toBe("TOKEN-EX-BASE");
    expect(after.players.A.trash.some((c) => c.instanceId === old)).toBe(true);
  });

  it("124 (Base): ao colocar EX Resource, 1 Unit (Academy) sua ganha AP+2 neste turno", () => {
    const state = game();
    placeCard(state, "A", G["GD04-124"], "baseSection");
    const academy = placeCard(state, "A", UNIT({ traits: ["Academy"] }), "battleArea");
    const src = placeCard(state, "A", COMMAND, "trash");
    let s = dispatchTrigger(
      state,
      src,
      "Main",
      [{ id: "T-ex", cardCode: "TEST-COMMAND", trigger: "Main", actions: [{ op: "spawnToken", def: EX_RESOURCE_TOKEN, player: "controller", zone: "resourceArea" }], sourceText: "t" }],
      { allSpecs: ALL_EFFECT_SPECS, ...OPTS },
    );
    expect(s.pendingDecision.A?.kind).toBe("abilityResolution");
    s = act(s, "A", { kind: "resolveAbility", resolutions: [{ specId: "GD04-124-ExPlaced", activate: true, targetIds: [academy] }] });
    expect(effectiveAp(findCard(s, academy), s)).toBe(5);
  });

  it("100 (Piloto) 【Once per Turn】: pagar ① num efeito de Unit sua → pode somar o custo pago ao AP", () => {
    const state = game();
    resources(state, "A", 3);
    const unit = placeCard(state, "A", UNIT(), "battleArea");
    pair(state, unit, placeCard(state, "A", G["GD04-100"], "battleArea"));
    const payer = placeCard(state, "A", UNIT({ code: "TEST-PAYER" }), "battleArea");
    let s = dispatchTrigger(
      state,
      payer,
      "Activate·Main",
      [{ id: "T-pay", cardCode: "TEST-PAYER", trigger: "Activate·Main", cost: [{ op: "payResourceCost", player: "controller", n: 2 }], actions: [], sourceText: "t" }],
      { allSpecs: ALL_EFFECT_SPECS, ...OPTS },
    );
    const before = effectiveAp(findCard(s, unit), s);
    s = act(s, "A", { kind: "resolveAbility", resolutions: [{ specId: "GD04-100-PaidForUnitEffect", activate: true, targetIds: [] }] });
    expect(effectiveAp(findCard(s, unit), s)).toBe(before + 2);
  });

  it("129 (Base) 【Once per Turn】: no seu turno, pagar ① num efeito de Unit sua → a Base recupera 2 HP", () => {
    const state = game();
    resources(state, "A", 3);
    const base = placeCard(state, "A", G["GD04-129"], "baseSection", { damage: 3 });
    const payer = placeCard(state, "A", UNIT({ code: "TEST-PAYER" }), "battleArea");
    const s = dispatchTrigger(
      state,
      payer,
      "Activate·Main",
      [{ id: "T-pay", cardCode: "TEST-PAYER", trigger: "Activate·Main", cost: [{ op: "payResourceCost", player: "controller", n: 1 }], actions: [], sourceText: "t" }],
      { allSpecs: ALL_EFFECT_SPECS, ...OPTS },
    );
    expect(dmg(s, base)).toBe(1);
  });
});

describe("W5c — custo de descansar Unit e gatilhos atrasados", () => {
  /** batalha A ataca `defender` (descansada) e passa os 2 Action Steps até o fim do combate */
  function fight(state: GameState, attackerId: string, defenderId: string): GameState {
    const s: GameState = {
      ...state,
      combat: {
        step: "action",
        attackerId,
        attackingPlayer: "A",
        defendingPlayer: "B",
        originalTarget: { unitId: defenderId },
        currentTarget: { unitId: defenderId },
        actionPasses: { A: true, B: false },
        actionPriority: "B",
      },
    };
    return act(s, "B", { kind: "passAction" });
  }
  const pending = (state: GameState, player: PlayerId) => {
    const d = state.pendingDecision[player];
    return d?.kind === "abilityResolution" ? d : null;
  };

  it("006 【Activate·Main】【Once per Turn】: descansar outra Unit (League Militaire) ativa → descansa inimiga HP<=4", () => {
    let state = game();
    const self = placeCard(state, "A", G["GD04-006"], "battleArea");
    const lm = placeCard(state, "A", UNIT({ traits: ["League Militaire"] }), "battleArea");
    const enemy = placeCard(state, "B", UNIT({ hp: 4 }), "battleArea");
    placeCard(state, "B", UNIT({ hp: 5 }), "battleArea");
    state = act(state, "A", { kind: "activateAbility", sourceInstanceId: self });
    const d = pending(state, "A");
    expect(d?.queue[0].legalTargets).toEqual([enemy]);
    expect(d?.queue[0].secondaryTarget?.legalTargets).toEqual([lm]);
    state = act(state, "A", { kind: "resolveAbility", resolutions: [{ specId: "GD04-006-ActivateMain", activate: true, targetIds: [enemy], secondaryTargetIds: [lm] }] });
    expect(findCard(state, lm).rested).toBe(true);
    expect(findCard(state, enemy).rested).toBe(true);
    expect(findCard(state, self).rested).toBe(false);
  });

  it("006: sem outra Unit (League Militaire) ativa, a habilidade não é ofertada", () => {
    const state = game();
    const self = placeCard(state, "A", G["GD04-006"], "battleArea");
    placeCard(state, "A", UNIT({ traits: ["League Militaire"] }), "battleArea", { rested: true });
    placeCard(state, "B", UNIT({ hp: 4 }), "battleArea");
    const offers = enumerateLegalActions(state, "A", ALL_EFFECT_SPECS, OPTS).filter((a) => a.kind === "activateAbility" && a.sourceInstanceId === self);
    expect(offers).toEqual([]);
  });

  it("125 (Base) 【Activate·Main】: ① + descansar 1 Unit (CB) → 1 de dano em inimiga Lv.5-", () => {
    let state = game();
    resources(state, "A", 2);
    const base = placeCard(state, "A", G["GD04-125"], "baseSection");
    const cb = placeCard(state, "A", UNIT({ traits: ["CB"] }), "battleArea");
    const enemy = placeCard(state, "B", UNIT({ hp: 3, level: 5 }), "battleArea");
    state = act(state, "A", { kind: "activateAbility", sourceInstanceId: base });
    state = act(state, "A", { kind: "resolveAbility", resolutions: [{ specId: "GD04-125-ActivateMain", activate: true, targetIds: [enemy], secondaryTargetIds: [cb] }] });
    expect(dmg(state, enemy)).toBe(1);
    expect(findCard(state, cb).rested).toBe(true);
    expect(state.players.A.resourceArea.filter((r) => r.rested).length).toBe(1);
  });

  it("036 【Deploy】: descansa 1–2 outras Units (CB) ativas → dano = nº descansadas em todas as inimigas Lv.6-", () => {
    const state = game();
    const self = placeCard(state, "A", G["GD04-036"], "battleArea");
    const c1 = placeCard(state, "A", UNIT({ traits: ["CB"] }), "battleArea");
    const c2 = placeCard(state, "A", UNIT({ traits: ["CB"] }), "battleArea");
    const low = placeCard(state, "B", UNIT({ hp: 9, level: 6 }), "battleArea");
    const high = placeCard(state, "B", UNIT({ hp: 9, level: 7 }), "battleArea");
    const s = runSpec(state, "GD04-036-Deploy", self, { target: [c1, c2] });
    expect(findCard(s, c1).rested && findCard(s, c2).rested).toBe(true);
    expect(dmg(s, low)).toBe(2);
    expect(dmg(s, high)).toBe(0);
  });

  it("002 【Deploy】: neste turno, Unit (EF) sua destrói inimiga em batalha → descansa inimiga HP<=5", () => {
    let state = game();
    const self = placeCard(state, "A", G["GD04-002"], "battleArea");
    state = runSpec(state, "GD04-002-Deploy", self);
    const ef = placeCard(state, "A", UNIT({ ap: 5, hp: 9, traits: ["Earth Federation"] }), "battleArea");
    const victim = placeCard(state, "B", UNIT({ hp: 2 }), "battleArea", { rested: true });
    const other = placeCard(state, "B", UNIT({ hp: 5 }), "battleArea");
    state = fight(state, ef, victim);
    expect(pending(state, "A")?.queue[0].legalTargets).toEqual([other]);
    state = act(state, "A", { kind: "resolveAbility", resolutions: [{ specId: "GD04-002-Delayed", activate: true, targetIds: [other] }] });
    expect(findCard(state, other).rested).toBe(true);
  });

  it("002: no turno seguinte o gatilho não existe mais", () => {
    let state = game();
    const self = placeCard(state, "A", G["GD04-002"], "battleArea");
    state = runSpec(state, "GD04-002-Deploy", self);
    state = { ...state, turnNumber: state.turnNumber + 1 };
    const ef = placeCard(state, "A", UNIT({ ap: 5, hp: 9, traits: ["Earth Federation"] }), "battleArea");
    const victim = placeCard(state, "B", UNIT({ hp: 2 }), "battleArea", { rested: true });
    placeCard(state, "B", UNIT({ hp: 5 }), "battleArea");
    state = fight(state, ef, victim);
    expect(pending(state, "A")).toBeNull();
  });

  it("035 【Deploy】: a Unit (Mafty) escolhida destrói inimiga em batalha com mão <= 3 → compra 1", () => {
    let state = game();
    const self = placeCard(state, "A", G["GD04-035"], "battleArea");
    const mafty = placeCard(state, "A", UNIT({ ap: 5, hp: 9, traits: ["Mafty"] }), "battleArea");
    const other = placeCard(state, "A", UNIT({ ap: 5, hp: 9, traits: ["Mafty"] }), "battleArea");
    state.players.A.hand = state.players.A.hand.slice(0, 2);
    state = runSpec(state, "GD04-035-Deploy", self, { target: [mafty] });
    const v1 = placeCard(state, "B", UNIT({ hp: 2 }), "battleArea", { rested: true });
    const afterOther = fight(state, other, v1);
    expect(afterOther.players.A.hand.length).toBe(2);
    const v2 = placeCard(state, "B", UNIT({ hp: 2 }), "battleArea", { rested: true });
    expect(fight(state, mafty, v2).players.A.hand.length).toBe(3);
  });

  it("115 【Main】: a Unit escolhida causa dano de batalha em inimiga Lv.5- → destrói a inimiga", () => {
    let state = game();
    const unit = placeCard(state, "A", UNIT({ ap: 1, hp: 9 }), "battleArea");
    const src = placeCard(state, "A", G["GD04-115"], "trash");
    state = runSpec(state, "GD04-115-Main", src, { target: [unit] });
    const low = placeCard(state, "B", UNIT({ hp: 9, level: 5 }), "battleArea", { rested: true });
    const high = placeCard(state, "B", UNIT({ hp: 9, level: 6 }), "battleArea", { rested: true });
    expect(inPlay(fight(state, unit, low), low)).toBe(false);
    expect(inPlay(fight(state, unit, high), high)).toBe(true);
  });
});

describe("W5d — modificadores de regra (C12) e o resto do GD04", () => {
  const pendingD = (state: GameState, player: PlayerId) => {
    const d = state.pendingDecision[player];
    return d?.kind === "abilityResolution" ? d : null;
  };
  /** joga da mão pagando o custo com Recursos normais */
  function deploy(state: GameState, player: PlayerId, def: CardDef): { state: GameState; id: string } {
    resources(state, player, Math.max(def.level ?? 0, def.cost ?? 0) + 1);
    const id = placeCard(state, player, def, "hand");
    return { state: act({ ...state, activePlayer: player }, player, { kind: "deployCard", cardInstanceId: id }), id };
  }

  it("021: Command (Dawn of Fold) pago com EX → pode parear essa carta do trash com Unit \"Gundam Lfrith\"", () => {
    const state = game();
    placeCard(state, "A", G["GD04-021"], "battleArea");
    const lfrith = placeCard(state, "A", UNIT({ nameEn: "Gundam Lfrith Ur", traits: ["Academy"] }), "battleArea");
    let s = playCmd(state, G["GD04-108"], { withEx: true, targets: { target: [lfrith] } });
    const cmd = s.players.A.trash.find((c) => c.def.code === "GD04-108");
    expect(cmd).toBeDefined();
    expect(pendingD(s, "A")?.queue[0].legalTargets).toContain(lfrith); // a própria 021 também é uma "Gundam Lfrith"
    s = act(s, "A", { kind: "resolveAbility", resolutions: [{ specId: "GD04-021-CommandActivated", activate: true, targetIds: [lfrith] }] });
    expect(findCard(s, lfrith).pairedPilotId).toBe(cmd?.instanceId);
    expect(findCard(s, cmd?.instanceId ?? "").asPilot).toBe(true);
  });

  it("022 【During Link】: Units Lv.3- (não token) entram descansadas — dos dois lados", () => {
    const state = game();
    const u = placeCard(state, "A", G["GD04-022"], "battleArea");
    const link = G["GD04-022"].link;
    pair(state, u, placeCard(state, "A", link?.kind === "pilotName" ? PILOT({ nameEn: link.values[0] }) : PILOT({ traits: link?.values ?? [] }), "battleArea"));
    const low = deploy(state, "B", UNIT({ level: 3 }));
    expect(findCard(low.state, low.id).rested).toBe(true);
    const high = deploy(state, "B", UNIT({ level: 4 }));
    expect(findCard(high.state, high.id).rested).toBe(false);
  });

  it("033: ela ou Unit (Neo Zeon) sua entra em jogo → 3 de dano numa inimiga", () => {
    const state = game();
    placeCard(state, "A", G["GD04-033"], "battleArea");
    const enemy = placeCard(state, "B", UNIT({ hp: 9 }), "battleArea");
    let { state: s } = deploy(state, "A", UNIT({ traits: ["Neo Zeon"] }));
    expect(pendingD(s, "A")?.queue.some((q) => q.specId === "GD04-033-UnitDeployed")).toBe(true);
    s = act(s, "A", { kind: "resolveAbility", resolutions: [{ specId: "GD04-033-UnitDeployed", activate: true, targetIds: [enemy] }] });
    expect(dmg(s, enemy)).toBe(3);
    const other = deploy(state, "A", UNIT({ traits: ["Zeon"] }));
    expect(pendingD(other.state, "A")).toBeNull();
  });

  it("033 【During Link】: suas Units ganham (Neo Zeon) — filtros de trait passam a casar", () => {
    const state = game();
    const self = placeCard(state, "A", G["GD04-033"], "battleArea");
    const plain = placeCard(state, "A", UNIT(), "battleArea");
    const ctx = { state, sourceInstanceId: self, targets: {} };
    expect(defaultTargetFilterResolver("trait:Neo Zeon", findCard(state, plain), ctx)).toBe(false);
    const link = G["GD04-033"].link;
    pair(state, self, placeCard(state, "A", link?.kind === "pilotName" ? PILOT({ nameEn: link.values[0] }) : PILOT({ traits: link?.values ?? [] }), "battleArea"));
    expect(defaultTargetFilterResolver("trait:Neo Zeon", findCard(state, plain), ctx)).toBe(true);
    const enemy = placeCard(state, "B", UNIT(), "battleArea");
    expect(defaultTargetFilterResolver("trait:Neo Zeon", findCard(state, enemy), ctx)).toBe(false);
  });

  it("049 【During Pair】【Attack】: atacando o jogador, exila 7 (Vulture) do trash → destrói Unit/Base inimiga Lv.8-", () => {
    const state = game();
    const self = placeCard(state, "A", G["GD04-049"], "battleArea");
    pair(state, self, placeCard(state, "A", PILOT(), "battleArea"));
    for (let i = 0; i < 7; i++) placeCard(state, "A", UNIT({ traits: ["Vulture"] }), "trash");
    const base = placeCard(state, "B", CARD_BASE(), "baseSection");
    const s = runSpec({ ...state, combat: { step: "attack", attackerId: self, attackingPlayer: "A", defendingPlayer: "B", originalTarget: "player", currentTarget: "player", actionPasses: { A: false, B: false }, actionPriority: "B" } }, "GD04-049-Attack", self, { target: [base] });
    expect(s.players.B.baseSection.length).toBe(0);
    expect(s.players.A.exile.filter((c) => (c.def.traits ?? []).includes("Vulture")).length).toBe(7);
  });

  it("051 【During Pair·(Vulture) Pilot】: com 7+ no trash, pode atacar Unit ativa com keyword", () => {
    const state = game();
    const self = placeCard(state, "A", G["GD04-051"], "battleArea");
    pair(state, self, placeCard(state, "A", PILOT({ traits: ["Vulture"] }), "battleArea"));
    const kw = placeCard(state, "B", UNIT({ effectKeywords: ["Blocker"], keywordTags: ["Blocker"] }), "battleArea");
    const plain = placeCard(state, "B", UNIT(), "battleArea");
    expect(attackTargetError(state, findCard(state, self), { unitId: kw })).not.toBeNull();
    for (let i = 0; i < 7; i++) placeCard(state, "A", UNIT(), "trash");
    expect(attackTargetError(state, findCard(state, self), { unitId: kw })).toBeNull();
    expect(attackTargetError(state, findCard(state, self), { unitId: plain })).not.toBeNull();
  });

  it("065 【During Link】【Activate·Main】: exila 3 azuis do trash → fica ativa e não pode atacar o jogador neste turno", () => {
    const state = game();
    const self = placeCard(state, "A", G["GD04-065"], "battleArea", { rested: true });
    const link = G["GD04-065"].link;
    pair(state, self, placeCard(state, "A", link?.kind === "pilotName" ? PILOT({ nameEn: link.values[0] }) : PILOT({ traits: link?.values ?? [] }), "battleArea"));
    for (let i = 0; i < 3; i++) placeCard(state, "A", UNIT({ color: "blue" }), "trash");
    const s = runSpec(state, "GD04-065-ActivateMain", self);
    expect(findCard(s, self).rested).toBe(false);
    expect(s.players.A.trash.length).toBe(0);
    expect(attackTargetError(s, findCard(s, self), "player")).not.toBeNull();
  });

  it("066: ao ativar o 【Main】 de um Command, 1 Unit inimiga ganha AP-2 neste turno", () => {
    const state = game();
    placeCard(state, "A", G["GD04-066"], "battleArea");
    const enemy = placeCard(state, "B", UNIT({ ap: 4 }), "battleArea");
    let s = playCmd(state, DAWN_CMD({ traits: [] }), { withEx: false });
    s = act(s, "A", { kind: "resolveAbility", resolutions: [{ specId: "GD04-066-CommandActivated", activate: true, targetIds: [enemy] }] });
    expect(effectiveAp(findCard(s, enemy), s)).toBe(2);
  });

  it("107 【Action】: neste turno, Units inimigas precisam atacar a Unit descansada escolhida", () => {
    const state = game();
    const mine = placeCard(state, "B", UNIT(), "battleArea", { rested: true });
    const other = placeCard(state, "B", UNIT(), "battleArea", { rested: true });
    const attacker = placeCard(state, "A", UNIT(), "battleArea");
    const src = placeCard(state, "B", G["GD04-107"], "trash");
    const s = runSpec(state, "GD04-107-Action", src, { target: [mine] });
    expect(attackTargetError(s, findCard(s, attacker), { unitId: other })).not.toBeNull();
    expect(attackTargetError(s, findCard(s, attacker), "player")).not.toBeNull();
    expect(attackTargetError(s, findCard(s, attacker), { unitId: mine })).toBeNull();
  });

  it("126 (Base): recebe dano de batalha de Unit inimiga AP<=3 → 1 de dano nela", () => {
    const state = game();
    const base = placeCard(state, "B", { ...G["GD04-126"], hp: 9 }, "baseSection");
    const weak = placeCard(state, "A", UNIT({ ap: 3, hp: 3 }), "battleArea");
    const s = act({ ...state, combat: { step: "action", attackerId: weak, attackingPlayer: "A", defendingPlayer: "B", originalTarget: "player", currentTarget: "player", actionPasses: { A: true, B: false }, actionPriority: "B" } }, "B", { kind: "passAction" });
    expect(dmg(s, base)).toBe(3);
    expect(dmg(s, weak)).toBe(1);
  });

  it("069 【During Link】 (aproximação): pagou ① por efeito de outra Unit (Militia) → no fim do turno, 1 Unit (Militia) descansada fica ativa", () => {
    let state = game();
    resources(state, "A", 3);
    const self = placeCard(state, "A", G["GD04-069"], "battleArea");
    const link = G["GD04-069"].link;
    pair(state, self, placeCard(state, "A", link?.kind === "pilotName" ? PILOT({ nameEn: link.values[0] }) : PILOT({ traits: link?.values ?? [] }), "battleArea"));
    const militia = placeCard(state, "A", UNIT({ code: "TEST-MILITIA", traits: ["Militia"] }), "battleArea", { rested: true });
    state = dispatchTrigger(
      state,
      militia,
      "Activate·Main",
      [{ id: "T-pay", cardCode: "TEST-MILITIA", trigger: "Activate·Main", cost: [{ op: "payResourceCost", player: "controller", n: 1 }], actions: [], sourceText: "t" }],
      { allSpecs: ALL_EFFECT_SPECS, ...OPTS },
    );
    state = act(state, "A", { kind: "finishTurn" });
    if (state.endPhaseAction) state = act(state, state.endPhaseAction.priority, { kind: "passEndPhaseAction" });
    if (state.endPhaseAction) state = act(state, state.endPhaseAction.priority, { kind: "passEndPhaseAction" });
    expect(findCard(state, militia).rested).toBe(false);
  });
});

describe("W5 — fluxo real: efeitos com alvo em campo que não é o `target` da ação pausam pra escolha", () => {
  it("035 【Deploy】 (jogada da mão): pede a Unit (Mafty) e arma o gatilho nela", () => {
    let state = game();
    resources(state, "A", 6);
    const mafty = placeCard(state, "A", UNIT({ traits: ["Mafty"] }), "battleArea");
    const card = placeCard(state, "A", G["GD04-035"], "hand");
    state = act(state, "A", { kind: "deployCard", cardInstanceId: card });
    const d = state.pendingDecision.A;
    expect(d?.kind === "abilityResolution" && d.queue[0].legalTargets).toContain(mafty);
    state = act(state, "A", { kind: "resolveAbility", resolutions: [{ specId: "GD04-035-Deploy", activate: true, targetIds: [mafty] }] });
    expect(state.players.A.delayedReactions?.[0]?.subjectId).toBe(mafty);
  });

  it("095 【When Linked】 (pareamento real): pede a Unit (Minerva Squad)", () => {
    let state = game();
    resources(state, "A", 6);
    const linked = placeCard(state, "A", linkedTo(G["GD04-095"]), "battleArea");
    const minerva = placeCard(state, "A", UNIT({ traits: ["Minerva Squad"] }), "battleArea");
    const pilot = placeCard(state, "A", G["GD04-095"], "hand");
    state = act(state, "A", { kind: "deployCard", cardInstanceId: pilot, pairWithUnitId: linked });
    const d = state.pendingDecision.A;
    expect(d?.kind === "abilityResolution" && d.queue.find((q) => q.specId === "GD04-095-WhenLinked")?.legalTargets).toContain(minerva);
  });
});

describe("auditoria A2 — alvo `pairedPilotOf` pede escolha no fluxo real", () => {
  it("GD04-099 【During Link】【Attack】: atacando, pede a Unit inimiga pareada e devolve o Piloto dela", () => {
    let state = game();
    const self = placeCard(state, "A", linkedTo(G["GD04-099"], { ap: 1 }), "battleArea");
    pair(state, self, placeCard(state, "A", G["GD04-099"], "battleArea"));
    const enemy = placeCard(state, "B", UNIT({ hp: 9 }), "battleArea", { rested: true });
    const enemyPilot = placeCard(state, "B", PILOT(), "battleArea");
    pair(state, enemy, enemyPilot);
    placeCard(state, "B", UNIT(), "battleArea", { rested: true }); // sem Piloto: não é alvo
    state = act(state, "A", { kind: "declareAttack", attackerId: self, target: { unitId: enemy } });
    const d = state.pendingDecision.A;
    expect(d?.kind === "abilityResolution" && d.queue.find((q) => q.specId === "GD04-099-Attack")?.legalTargets).toEqual([enemy]);
    state = act(state, "A", { kind: "resolveAbility", resolutions: [{ specId: "GD04-099-Attack", activate: true, targetIds: [enemy] }] });
    expect(state.players.B.hand.some((c) => c.instanceId === enemyPilot)).toBe(true);
  });

  it("GD03-110 【Main】 (Command jogado): pede a Unit inimiga Lv.5- pareada e destrói o Piloto dela", () => {
    let state = game();
    const def = GD03_CARD_DEFS["GD03-110"];
    resources(state, "A", Math.max(def.level ?? 0, def.cost ?? 0));
    const low = placeCard(state, "B", UNIT({ level: 5 }), "battleArea");
    const lowPilot = placeCard(state, "B", PILOT(), "battleArea");
    pair(state, low, lowPilot);
    const high = placeCard(state, "B", UNIT({ level: 6 }), "battleArea");
    pair(state, high, placeCard(state, "B", PILOT(), "battleArea"));
    const card = placeCard(state, "A", def, "hand");
    const offers = enumerateLegalActions(state, "A", ALL_EFFECT_SPECS, OPTS).filter((a) => a.kind === "playCommand" && a.cardInstanceId === card);
    expect(offers.map((a) => (a.kind === "playCommand" ? a.targets?.target : undefined))).toEqual([[low]]);
    state = act(state, "A", { kind: "playCommand", cardInstanceId: card, trigger: "Main", targets: { target: [low] } });
    expect(state.players.B.trash.some((c) => c.instanceId === lowPilot)).toBe(true);
    expect(findCard(state, low).pairedPilotId).toBeFalsy();
  });
});

describe("auditoria A8 — `commandActivated` não se perde quando a resolução do Command pausa", () => {
  it("Command mata Unit cujo Piloto tem 【Destroyed】 com escolha (oponente decide) → depois o GD04-066 reage", () => {
    let state = game();
    placeCard(state, "A", G["GD04-066"], "battleArea");
    const victim = placeCard(state, "B", UNIT({ hp: 1 }), "battleArea", { rested: true }); // +1 HP do Piloto = 2
    pair(state, victim, placeCard(state, "B", G["GD04-091"], "battleArea"));
    const other = placeCard(state, "A", UNIT({ hp: 9 }), "battleArea"); // alvo do 091 (sem dano)
    const enemy = placeCard(state, "B", UNIT({ ap: 4, hp: 9 }), "battleArea");
    const cmd = getCardDefByCode("GD01-104");
    if (!cmd) throw new Error("GD01-104 fora do catálogo");
    resources(state, "A", Math.max(cmd.level ?? 0, cmd.cost ?? 0));
    const card = placeCard(state, "A", cmd, "hand");
    state = act(state, "A", { kind: "playCommand", cardInstanceId: card, trigger: "Main", targets: { target: [victim] } });
    expect(state.pendingDecision.B?.kind).toBe("abilityResolution"); // 【Destroyed】 do Deux Murasame
    state = act(state, "B", { kind: "resolveAbility", resolutions: [{ specId: "GD04-091-Destroyed", activate: true, targetIds: [other] }] });
    const d = state.pendingDecision.A;
    expect(d?.kind === "abilityResolution" && d.queue.some((q) => q.specId === "GD04-066-CommandActivated")).toBe(true);
    state = act(state, "A", { kind: "resolveAbility", resolutions: [{ specId: "GD04-066-CommandActivated", activate: true, targetIds: [enemy] }] });
    expect(effectiveAp(findCard(state, enemy), state)).toBe(2);
  });
});

describe("auditoria A23 — deferidas do GD03 destravadas pela W5", () => {
  const runFight = (state: GameState, attackerId: string, defenderId: string): GameState =>
    act(
      {
        ...state,
        combat: {
          step: "action",
          attackerId,
          attackingPlayer: "A",
          defendingPlayer: "B",
          originalTarget: { unitId: defenderId },
          currentTarget: { unitId: defenderId },
          actionPasses: { A: true, B: false },
          actionPriority: "B",
        },
      },
      "B",
      { kind: "passAction" },
    );

  it("GD03-104 (Command jogado): 1 alvo; com Link Unit (Jupitris) sua, até 2", () => {
    const def = GD03_CARD_DEFS["GD03-104"];
    const setup = () => {
      const state = game();
      resources(state, "A", Math.max(def.level ?? 0, def.cost ?? 0));
      const e1 = placeCard(state, "B", UNIT({ hp: 3 }), "battleArea");
      const e2 = placeCard(state, "B", UNIT({ hp: 3 }), "battleArea");
      return { state, e1, e2 };
    };
    const plain = setup();
    const card = placeCard(plain.state, "A", def, "hand");
    const s1 = act(plain.state, "A", { kind: "playCommand", cardInstanceId: card, trigger: "Main", targets: { target: [plain.e1, plain.e2] } });
    expect([findCard(s1, plain.e1).rested, findCard(s1, plain.e2).rested]).toEqual([true, false]);
    const linked = setup();
    const u = placeCard(linked.state, "A", UNIT({ traits: ["Jupitris"], link: { kind: "pilotName", values: ["Link Pilot"] } }), "battleArea");
    pair(linked.state, u, placeCard(linked.state, "A", PILOT({ nameEn: "Link Pilot" }), "battleArea"));
    const card2 = placeCard(linked.state, "A", def, "hand");
    const s2 = act(linked.state, "A", { kind: "playCommand", cardInstanceId: card2, trigger: "Main", targets: { target: [linked.e1, linked.e2] } });
    expect([findCard(s2, linked.e1).rested, findCard(s2, linked.e2).rested]).toEqual([true, true]);
  });

  it("GD03-120 【Main】: Unit (UN) sua destrói inimiga em batalha → escolhe Unit (UN/SB) descansada: fica ativa e não ataca", () => {
    const def = GD03_CARD_DEFS["GD03-120"];
    let state = game();
    resources(state, "A", Math.max(def.level ?? 0, def.cost ?? 0));
    const card = placeCard(state, "A", def, "hand");
    state = act(state, "A", { kind: "playCommand", cardInstanceId: card, trigger: "Main" });
    const un = placeCard(state, "A", UNIT({ ap: 5, hp: 9, traits: ["UN"] }), "battleArea");
    const restedSb = placeCard(state, "A", UNIT({ traits: ["Superpower Bloc"] }), "battleArea", { rested: true });
    const victim = placeCard(state, "B", UNIT({ hp: 2 }), "battleArea", { rested: true });
    state = runFight(state, un, victim);
    const d = state.pendingDecision.A;
    expect(d?.kind === "abilityResolution" && d.queue[0].legalTargets).toContain(restedSb);
    state = act(state, "A", { kind: "resolveAbility", resolutions: [{ specId: "GD03-120-Delayed", activate: true, targetIds: [restedSb] }] });
    expect(findCard(state, restedSb).rested).toBe(false);
    expect(findCard(state, restedSb).cannotAttackUntilTurn).toBe(state.turnNumber);
  });
});

describe("auditoria A3 — ST06 (alvo 'targets') pede escolha no fluxo real", () => {
  const def = (code: string) => {
    const d = getCardDefByCode(code);
    if (!d) throw new Error(code);
    return d;
  };

  it("ST06-011 【Main】 (Command jogado): até 2 Units (Clan) ganham AP+2", () => {
    let state = game();
    const cmd = def("ST06-011");
    resources(state, "A", Math.max(cmd.level ?? 0, cmd.cost ?? 0));
    const c1 = placeCard(state, "A", UNIT({ traits: ["Clan"] }), "battleArea");
    const c2 = placeCard(state, "A", UNIT({ traits: ["Clan"] }), "battleArea");
    placeCard(state, "A", UNIT(), "battleArea");
    const card = placeCard(state, "A", cmd, "hand");
    const offer = enumerateLegalActions(state, "A", ALL_EFFECT_SPECS, OPTS).find((a) => a.kind === "playCommand" && a.cardInstanceId === card);
    expect(offer?.kind === "playCommand" && offer.targets?.target).toEqual([c1, c2]);
    state = act(state, "A", { kind: "playCommand", cardInstanceId: card, trigger: "Main", targets: { target: [c1, c2] } });
    expect([effectiveAp(findCard(state, c1), state), effectiveAp(findCard(state, c2), state)]).toEqual([5, 5]);
  });

  it("ST06-005 【Attack】 (ataque declarado): pede 1–2 Units (Clan)", () => {
    let state = game();
    const red = placeCard(state, "A", def("ST06-005"), "battleArea");
    const ally = placeCard(state, "A", UNIT({ traits: ["Clan"] }), "battleArea");
    state = act(state, "A", { kind: "declareAttack", attackerId: red, target: "player" });
    const d = state.pendingDecision.A;
    expect(d?.kind === "abilityResolution" && d.queue[0].legalTargets).toEqual(expect.arrayContaining([red, ally]));
    state = act(state, "A", { kind: "resolveAbility", resolutions: [{ specId: "ST06-005-Attack", activate: true, targetIds: [ally] }] });
    expect(effectiveAp(findCard(state, ally), state)).toBe(5);
  });

  it("ST06-013 【Action】: as 2 Units escolhidas ficam imunes a dano de batalha de Lv.2- o turno todo (atacando ou defendendo)", () => {
    const state = game();
    const c1 = placeCard(state, "A", UNIT({ hp: 9, ap: 1, traits: ["Clan"] }), "battleArea", { rested: true });
    const c2 = placeCard(state, "A", UNIT({ hp: 9, ap: 1, traits: ["Clan"] }), "battleArea");
    const src = placeCard(state, "A", def("ST06-013"), "trash");
    const s = runSpec(state, "ST06-013-Action", src, { target: [c1, c2] });
    const low = placeCard(s, "B", UNIT({ ap: 3, hp: 9, level: 2 }), "battleArea", { rested: true });
    const high = placeCard(s, "B", UNIT({ ap: 3, hp: 9, level: 3 }), "battleArea", { rested: true });
    // c2 ataca a Lv.2 (contra-dano bloqueado) e c1 é atacada pela Lv.2 (dano bloqueado): os 2 protegidos
    expect(dmg(damageStep(s, c2, low), c2)).toBe(0);
    expect(dmg(damageStep({ ...s, activePlayer: "B" }, low, c1), c1)).toBe(0);
    expect(dmg(damageStep(s, c2, high), c2)).toBe(3);
  });
});

describe("auditoria A3 — ST07-013 Armed Intervention muda o alvo do ataque inimigo", () => {
  it("B ataca o jogador A; no Action Step A joga ST07-013 e o ataque passa a mirar a Unit (CB) descansada", () => {
    const cmd = getCardDefByCode("ST07-013");
    if (!cmd) throw new Error("ST07-013");
    let state = game();
    state = { ...state, activePlayer: "B" };
    resources(state, "A", Math.max(cmd.level ?? 0, cmd.cost ?? 0));
    const cb = placeCard(state, "A", UNIT({ hp: 9, traits: ["CB"] }), "battleArea", { rested: true });
    placeCard(state, "A", UNIT({ hp: 9 }), "battleArea", { rested: true }); // sem trait: não é alvo
    const attacker = placeCard(state, "B", UNIT({ ap: 3, hp: 9 }), "battleArea");
    const card = placeCard(state, "A", cmd, "hand");
    state = {
      ...state,
      combat: { step: "action", attackerId: attacker, attackingPlayer: "B", defendingPlayer: "A", originalTarget: "player", currentTarget: "player", actionPasses: { A: false, B: false }, actionPriority: "A" },
    };
    const offer = enumerateLegalActions(state, "A", ALL_EFFECT_SPECS, OPTS).filter((a) => a.kind === "playCommand" && a.cardInstanceId === card);
    expect(offer.map((a) => (a.kind === "playCommand" ? a.targets?.target : undefined))).toEqual([[cb]]);
    state = act(state, "A", { kind: "playCommand", cardInstanceId: card, trigger: "Action", targets: { target: [cb] } });
    expect(state.combat?.currentTarget).toEqual({ unitId: cb });
  });
});

describe("GD04-101 Kindhearted (ruling oficial Q287)", () => {
  it("neste turno, efeito inimigo que DESTRÓI não destrói Unit amiga; dano de efeito ainda destrói; compra 1", () => {
    let state = game();
    const mine = placeCard(state, "A", UNIT({ hp: 2, level: 1 }), "battleArea");
    const src = placeCard(state, "A", G["GD04-101"], "trash");
    const hand0 = state.players.A.hand.length;
    state = runSpec(state, "GD04-101-Main", src);
    expect(state.players.A.hand.length).toBe(hand0 + 1);
    const enemySrc = placeCard(state, "B", G["GD04-063"], "battleArea"); // 【Deploy】 destrói Unit Lv.1-
    const afterDestroy = runSpec(state, "GD04-063-Deploy", enemySrc, { target: [mine] });
    expect(inPlay(afterDestroy, mine)).toBe(true);
    expect(inPlay(effectHit(state, mine, 2, "B"), mine)).toBe(false);
    expect(inPlay(runSpec({ ...state, turnNumber: state.turnNumber + 1 }, "GD04-063-Deploy", enemySrc, { target: [mine] }), mine)).toBe(false);
  });

  it("【Burst】 ativa o 【Main】", () => {
    const state = game();
    const src = placeCard(state, "A", G["GD04-101"], "trash");
    const after = runSpec(state, "GD04-101-Burst", src);
    expect(after.players.A.indestructibleByEnemyEffectsTurn).toBe(after.turnNumber);
  });
});

describe("rulings Q376/Q397 e Q361 (auditoria A5 e A15)", () => {
  it("A5 — GD04-066 reage ao 【Main】 de Command ativado pelo 【Burst】 (Kindhearted quebrada como shield)", () => {
    let state = game();
    placeCard(state, "B", G["GD04-066"], "battleArea");
    state.players.B.shields = [];
    const shield = placeCard(state, "B", G["GD04-101"], "shields");
    const attacker = placeCard(state, "A", UNIT({ ap: 2, hp: 9 }), "battleArea");
    const enemyOfB = placeCard(state, "A", UNIT({ ap: 4, hp: 9 }), "battleArea");
    state = act(state, "A", { kind: "declareAttack", attackerId: attacker, target: "player" });
    state = act(state, "B", { kind: "skipBlock" });
    state = act(state, "B", { kind: "passAction" });
    state = act(state, "A", { kind: "passAction" });
    expect(state.pendingDecision.B).toMatchObject({ kind: "burst", cardInstanceId: shield });
    state = act(state, "B", { kind: "resolveBurstDecision", activate: true });
    const d = state.pendingDecision.B;
    expect(d?.kind === "abilityResolution" && d.queue.some((q) => q.specId === "GD04-066-CommandActivated")).toBe(true);
    state = act(state, "B", { kind: "resolveAbility", resolutions: [{ specId: "GD04-066-CommandActivated", activate: true, targetIds: [enemyOfB] }] });
    expect(effectiveAp(findCard(state, enemyOfB), state)).toBe(2);
  });

  it("A15 — GD04-042: <Breach> de Unit sua pareada com Piloto (Cyber-Newtype) que destrói shield dispara a reação", () => {
    const state = game();
    const psycho = placeCard(state, "A", { ...G["GD04-042"], hp: 9 }, "battleArea");
    pair(state, psycho, placeCard(state, "A", G["GD04-091"], "battleArea")); // link: Deux Murasame
    const breacher = placeCard(state, "A", UNIT({ ap: 5, hp: 9, effectKeywords: ["Breach"], keywordTags: ["Breach 2"] }), "battleArea");
    pair(state, breacher, placeCard(state, "A", PILOT({ traits: ["Cyber-Newtype"] }), "battleArea"));
    const victim = placeCard(state, "B", UNIT({ hp: 2 }), "battleArea", { rested: true });
    const target = placeCard(state, "B", UNIT({ ap: 5, hp: 9 }), "battleArea");
    state.players.B.shields = state.players.B.shields.map((c) => ({ ...c, def: UNIT({ code: "TEST-SHIELD" }) }));
    let s = act(
      {
        ...state,
        combat: { step: "action", attackerId: breacher, attackingPlayer: "A", defendingPlayer: "B", originalTarget: { unitId: victim }, currentTarget: { unitId: victim }, actionPasses: { A: true, B: false }, actionPriority: "B" },
      },
      "B",
      { kind: "passAction" },
    );
    const d = s.pendingDecision.A;
    expect(d?.kind === "abilityResolution" && d.queue.find((q) => q.specId === "GD04-042-DestroyedShield")?.legalTargets).toEqual([target]);
    s = act(s, "A", { kind: "resolveAbility", resolutions: [{ specId: "GD04-042-DestroyedShield", activate: true, targetIds: [target] }] });
    expect(dmg(s, target)).toBe(2);
  });
});
