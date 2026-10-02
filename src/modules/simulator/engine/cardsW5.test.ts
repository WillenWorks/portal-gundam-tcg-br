import { describe, expect, it } from "vitest";
import { createGame } from "./setup";
import type { CardDef, GameState, PlayerId } from "./types";
import { advanceToMainPhase } from "./phases";
import { dispatchTrigger } from "./dispatcher";
import { resolveDamageStep } from "./combat";
import { findCard } from "./events";
import { placeCard } from "./__testkit__/cardHarness";
import { buildSt07DeckList, PTOLEMAIOS } from "../fixtures/st07Deck";
import { buildSt08DeckList } from "../fixtures/st08Deck";
import { ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver } from "../content";
import { GD02_CARD_DEFS as G2 } from "../content/gd02";
import { GD04_CARD_DEFS } from "../content/gd04";

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
