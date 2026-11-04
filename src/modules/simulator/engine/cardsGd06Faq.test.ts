import { describe, expect, it } from "vitest";
import { createGame, EX_RESOURCE_TOKEN } from "./setup";
import type { CardDef, GameState, PlayerId } from "./types";
import { effectiveAp, hasKeyword } from "./types";
import { advanceToMainPhase } from "./phases";
import { applyPlayerAction, type PlayerAction } from "./actions";
import { findCard } from "./events";
import { enumerateLegalActions } from "./legalActions";
import { placeCard } from "./__testkit__/cardHarness";
import { buildSt07DeckList } from "../fixtures/st07Deck";
import { buildSt08DeckList } from "../fixtures/st08Deck";
import { ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver } from "../content";
import { getCardDefByCode } from "../content/allCardDefs";

/** Q&As oficiais do GD06 sem caso próprio nos testes W13a/W13b. Cada `it` cita os ids; `scripts/gundam-faq-trace.mjs` confere. */

const card = (code: string): CardDef => {
  const def = getCardDefByCode(code);
  if (!def) throw new Error(code);
  return def;
};
const UNIT = (extra: Partial<CardDef> = {}): CardDef => ({
  code: "TEST-UNIT", nameEn: "Test Unit", cardType: "UNIT", color: "white", level: 3, cost: 2, ap: 3, hp: 3, traits: [], ...extra,
});
const PILOT = (extra: Partial<CardDef> = {}): CardDef => ({
  code: "TEST-PILOT", nameEn: "Test Pilot", cardType: "PILOT", color: "white", level: 1, cost: 1, ap: 0, hp: 0, traits: [], ...extra,
});
const BASE = (extra: Partial<CardDef> = {}): CardDef => ({ code: "TEST-BASE", nameEn: "Test Base", cardType: "BASE", color: "white", level: 1, cost: 1, ap: 0, hp: 5, traits: [], ...extra });
const RESOURCE: CardDef = { code: "TEST-RES", nameEn: "Resource", cardType: "RESOURCE", color: "white", level: 0, cost: 0, ap: 0, hp: 0 };
const SHIELD = UNIT({ code: "TEST-SHIELD", nameEn: "Plain Shield" });

function game(): GameState {
  const state = advanceToMainPhase(createGame(buildSt07DeckList(), buildSt08DeckList(), { seed: 100, firstPlayer: "A" }));
  for (const p of ["A", "B"] as const) {
    state.players[p].battleArea = [];
    state.players[p].baseSection = [];
    state.players[p].trash = [];
    state.players[p].shields = [];
    state.players[p].hand = [];
    for (let i = 0; i < 3; i++) placeCard(state, p, SHIELD, "shields");
    state.players[p].resourceArea = [];
    for (let i = 0; i < 8; i++) placeCard(state, p, RESOURCE, "resourceArea");
  }
  return state;
}
function act(state: GameState, player: PlayerId, action: PlayerAction): GameState {
  return applyPlayerAction(state, player, action, ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver);
}
const pending = (state: GameState, player: PlayerId) => {
  const d = state.pendingDecision[player];
  return d?.kind === "abilityResolution" ? d : null;
};
const entry = (state: GameState, player: PlayerId, specId: string) => pending(state, player)?.queue.find((q) => q.specId === specId);
type Resolution = Extract<PlayerAction, { kind: "resolveAbility" }>["resolutions"][number];
const resolveWith = (state: GameState, player: PlayerId, r: Partial<Resolution> & { specId: string }) =>
  act(state, player, { kind: "resolveAbility", resolutions: [{ activate: true, targetIds: [], ...r }] });
const inZone = (s: GameState, p: PlayerId, zone: "hand" | "trash" | "exile" | "battleArea" | "deck" | "baseSection", id: string) =>
  s.players[p][zone].some((c) => c.instanceId === id);
const hand = (s: GameState, code: string) => placeCard(s, "A", card(code), "hand");
const deploy = (s: GameState, code: string) => act(s, "A", { kind: "deployCard", cardInstanceId: hand(s, code) });
const deployPilot = (s: GameState, def: CardDef, unitId: string) =>
  act(s, "A", { kind: "deployCard", cardInstanceId: placeCard(s, "A", def, "hand"), pairWithUnitId: unitId });
const play = (s: GameState, code: string, trigger: "Main" | "Action", targets?: Record<string, string[]>) =>
  act(s, "A", { kind: "playCommand", cardInstanceId: hand(s, code), trigger, ...(targets ? { targets } : {}) });
function pair(s: GameState, unitId: string, pilotId: string) {
  findCard(s, unitId).pairedPilotId = pilotId;
  findCard(s, pilotId).pairedUnitId = unitId;
}
function onTop(s: GameState, p: PlayerId, def: CardDef): string {
  const id = placeCard(s, p, def, "deck");
  const deck = s.players[p].deck;
  deck.unshift(deck.splice(deck.findIndex((c) => c.instanceId === id), 1)[0]);
  return id;
}
function runCombat(state: GameState): GameState {
  let s = state;
  for (let i = 0; i < 10 && s.combat && !s.pendingDecision.A && !s.pendingDecision.B; i++) {
    if (s.combat.step === "block") s = act(s, s.combat.defendingPlayer, { kind: "skipBlock" });
    else if (s.combat.step === "action") s = act(s, s.combat.actionPriority, { kind: "passAction" });
    else break;
  }
  return s;
}
function toActionStep(state: GameState, attacker: string, target: { unitId: string } | "player"): GameState {
  let s = act(state, "A", { kind: "declareAttack", attackerId: attacker, target });
  if (s.combat?.step === "block") s = act(s, "B", { kind: "skipBlock" });
  if (s.combat?.actionPriority === "B") s = act(s, "B", { kind: "passAction" });
  return s;
}
/** A Unit de A ataca uma inimiga enorme e é destruída */
function dieInBattle(s: GameState, unitId: string): GameState {
  const wall = placeCard(s, "B", UNIT({ code: "TEST-WALL", ap: 99, hp: 99 }), "battleArea", { rested: true });
  return runCombat(act(s, "A", { kind: "declareAttack", attackerId: unitId, target: { unitId: wall } }));
}
const specOf = (id: string) => {
  const spec = ALL_EFFECT_SPECS.find((candidate) => candidate.id === id);
  if (!spec) throw new Error(id);
  return spec;
};
const restedResources = (s: GameState) => s.players.A.resourceArea.filter((r) => r.rested).length;
const untapAll = (s: GameState) => {
  for (const r of s.players.A.resourceArea) r.rested = false;
};
const removeFromBattle = (player: PlayerId, id: string) => (s: GameState) => {
  s.players[player].battleArea = s.players[player].battleArea.filter((c) => c.instanceId !== id);
};

describe("GD06 FAQ — <Blocker> perdido depois do bloqueio", () => {
  type Setup = (s: GameState, blocker: string) => (s: GameState) => void;
  const cases: Array<[string, string, Setup]> = [
    ["Q490", "GD06-014", (s) => {
      const extra = [0, 1].map((i) => placeCard(s, "B", UNIT({ code: `TEST-E${i}` }), "battleArea"));
      return removeFromBattle("B", extra[0]);
    }],
    ["Q491", "GD06-015", (s, blocker) => {
      const pilot = placeCard(s, "A", PILOT({ traits: ["Orb"] }), "battleArea");
      pair(s, blocker, pilot);
      return (next) => {
        findCard(next, blocker).pairedPilotId = undefined;
        findCard(next, pilot).pairedUnitId = undefined;
      };
    }],
    ["Q492", "GD06-017", (s) => removeFromBattle("A", placeCard(s, "A", UNIT({ code: "TEST-AL", traits: ["Alphacide"] }), "battleArea"))],
    ["Q523", "GD06-057", (s) => removeFromBattle("A", placeCard(s, "A", UNIT({ code: "TEST-DF", traits: ["Delaz Fleet"] }), "battleArea"))],
  ];

  it.each(cases)("%s %s: o bloqueio já feito continua valendo", (_q, code, setup) => {
    let s = game();
    s.activePlayer = "B";
    const blocker = placeCard(s, "A", { ...card(code), hp: 9 }, "battleArea");
    const loseCondition = setup(s, blocker);
    const attacker = placeCard(s, "B", UNIT({ code: "TEST-ATK", ap: 1, hp: 9 }), "battleArea");
    expect(hasKeyword(findCard(s, blocker), "Blocker", s)).toBe(true);
    const shields = s.players.A.shields.length;
    s = act(s, "B", { kind: "declareAttack", attackerId: attacker, target: "player" });
    s = act(s, "A", { kind: "activateBlocker", blockerId: blocker });
    loseCondition(s);
    expect(hasKeyword(findCard(s, blocker), "Blocker", s)).toBe(false);
    s = runCombat(s);
    expect(s.players.A.shields).toHaveLength(shields);
    expect(findCard(s, blocker).damage).toBe(1);
    expect(findCard(s, attacker).damage).toBeGreaterThan(0);
  });
});

describe("GD06 FAQ — Units", () => {
  it("Q494 GD06-018: duas Qubeley transferindo uma para a outra — o dano volta para a atacada", () => {
    let s = game();
    s.activePlayer = "B";
    const a = placeCard(s, "A", { ...card("GD06-018"), hp: 9 }, "battleArea", { rested: true });
    const b = placeCard(s, "A", { ...card("GD06-018"), hp: 9 }, "battleArea", { rested: true });
    pair(s, a, placeCard(s, "A", PILOT(), "battleArea"));
    pair(s, b, placeCard(s, "A", PILOT({ code: "TEST-PILOT-2" }), "battleArea"));
    const attacker = placeCard(s, "B", UNIT({ code: "TEST-ATK", ap: 4, hp: 99 }), "battleArea");
    s = act(s, "B", { kind: "declareAttack", attackerId: attacker, target: { unitId: a } });
    s = act(s, "A", { kind: "skipBlock" });
    if (s.combat?.actionPriority === "B") s = act(s, "B", { kind: "passAction" });
    s = act(s, "A", { kind: "activateAbility", sourceInstanceId: a, targets: { target: [b] } });
    if (s.combat?.actionPriority === "B") s = act(s, "B", { kind: "passAction" });
    s = act(s, "A", { kind: "activateAbility", sourceInstanceId: b, targets: { target: [a] } });
    s = runCombat(s);
    expect(findCard(s, a).damage).toBe(4);
    expect(findCard(s, b).damage).toBe(0);
  });

  it("Q495 GD06-019: com vários tokens descansados, o atacante escolhe qual deles mirar", () => {
    const s = game();
    s.activePlayer = "B";
    placeCard(s, "A", card("GD06-019"), "battleArea");
    const tokenDefs = ["T-031", "T-032"].map((code) => ({ ...UNIT({ code, traits: ["Ghingnham Fleet"] }), isToken: true }) as CardDef);
    const tokens = tokenDefs.map((def) => placeCard(s, "A", def, "battleArea", { rested: true }));
    const attacker = placeCard(s, "B", UNIT({ code: "TEST-ATK" }), "battleArea");
    for (const token of tokens) {
      expect(act(s, "B", { kind: "declareAttack", attackerId: attacker, target: { unitId: token } }).combat?.currentTarget).toEqual({ unitId: token });
    }
  });

  const linked022 = (s: GameState, extra: Partial<CardDef> = {}) => ({
    unit: placeCard(s, "A", { ...card("GD06-022"), ...extra }, "battleArea"),
    pilot: PILOT({ code: "TEST-MOON", traits: ["Moonrace"] }),
  });

  it("Q499 GD06-022: batalha só com o passo de dano, sem descansar e voltando à fase principal", () => {
    let s = game();
    const { unit, pilot } = linked022(s);
    const enemy = placeCard(s, "B", UNIT({ code: "TEST-E", ap: 2, hp: 9 }), "battleArea");
    s = deployPilot(s, pilot, unit);
    s = resolveWith(s, "A", { specId: "GD06-022-WhenLinked", targetIds: [enemy] });
    expect(findCard(s, enemy).damage).toBe(effectiveAp(findCard(s, unit), s));
    expect(findCard(s, unit).damage).toBe(2);
    expect(findCard(s, unit).rested).toBe(false);
    expect(s.combat ?? null).toBeNull();
    expect(s.phase).toBe("main");
  });

  it("Q500 GD06-022: efeito de batalha da GD02-073 vale em batalha iniciada por efeito", () => {
    let s = game();
    const { unit, pilot } = linked022(s);
    const carta = placeCard(s, "B", { ...card("GD02-073"), ap: 3, hp: 1 }, "battleArea");
    s = deployPilot(s, pilot, unit);
    s = resolveWith(s, "A", { specId: "GD06-022-WhenLinked", targetIds: [carta] });
    expect(inZone(s, "B", "trash", carta)).toBe(true);
    expect(findCard(s, unit).damage).toBe(0); // <First Strike> concedido: destruiu antes de receber
  });

  it("Q501 GD06-022: destruir em batalha iniciada por efeito conta como destruir com dano de batalha", () => {
    let s = game();
    const { unit, pilot } = linked022(s, { effectKeywords: ["Breach"], keywordTags: ["Breach 1"] } as Partial<CardDef>);
    const enemy = placeCard(s, "B", UNIT({ code: "TEST-E", ap: 1, hp: 1 }), "battleArea");
    const shields = s.players.B.shields.length;
    s = deployPilot(s, pilot, unit);
    s = resolveWith(s, "A", { specId: "GD06-022-WhenLinked", targetIds: [enemy] });
    expect(inZone(s, "B", "trash", enemy)).toBe(true);
    expect(s.players.B.shields.length).toBeLessThan(shields);
  });

  it("Q502 GD06-032: olhar o topo é obrigatório; pegar a carta é escolha", () => {
    expect(specOf("GD06-032-Destroyed").optional).toBeFalsy();
    let s = game();
    const bellona = placeCard(s, "A", card("GD06-032"), "battleArea");
    const eligible = onTop(s, "A", UNIT({ code: "TEST-GF", traits: ["Ghingnham Fleet"] }));
    s = dieInBattle(s, bellona);
    expect(entry(s, "A", "GD06-032-Destroyed")).toBeTruthy();
    s = resolveWith(s, "A", { specId: "GD06-032-Destroyed" });
    expect(inZone(s, "A", "hand", eligible)).toBe(false);
    expect(s.players.A.deck.slice(-2).map((c) => c.instanceId)).toContain(eligible);
  });

  const withGjallarhornTrash = (s: GameState) => {
    for (let i = 0; i < 4; i++) placeCard(s, "A", UNIT({ code: `TEST-GJ${i}`, traits: ["Gjallarhorn"] }), "trash");
  };

  it("Q505/Q506 GD06-034: deploya sem pagar custo, e o 【Deploy】 da Unit ativa", () => {
    let s = game();
    untapAll(s);
    withGjallarhornTrash(s);
    const free = onTop(s, "A", card("GD06-048"));
    placeCard(s, "B", UNIT({ code: "TEST-LOW", level: 2 }), "battleArea");
    s = deploy(s, "GD06-034");
    const paid = restedResources(s);
    expect(paid).toBe(card("GD06-034").cost);
    s = resolveWith(s, "A", { specId: "GD06-034-Deploy", targetIds: [free] });
    expect(inZone(s, "A", "battleArea", free)).toBe(true);
    expect(restedResources(s)).toBe(paid);
    expect(entry(s, "A", "GD06-048-Deploy")).toBeTruthy();
  });

  it("Q507 GD06-034: com 4+ no trash, olhar é obrigatório; deployar é escolha", () => {
    expect(specOf("GD06-034-Deploy").optional).toBeFalsy();
    let s = game();
    withGjallarhornTrash(s);
    const eligible = onTop(s, "A", UNIT({ code: "TEST-GJ", traits: ["Gjallarhorn"] }));
    s = deploy(s, "GD06-034");
    s = resolveWith(s, "A", { specId: "GD06-034-Deploy" });
    expect(inZone(s, "A", "battleArea", eligible)).toBe(false);
    expect(inZone(s, "A", "deck", eligible)).toBe(true);
    expect(s.players.A.deck[0].instanceId).not.toBe(eligible);
  });

  it("Q508 GD06-035: ativa mesmo quando as duas Units são destruídas", () => {
    let s = game();
    const zeta = placeCard(s, "A", { ...card("GD06-035"), ap: 3, hp: 1 }, "battleArea");
    const enemy = placeCard(s, "B", UNIT({ code: "TEST-E", ap: 3, hp: 3 }), "battleArea", { rested: true });
    const victim = placeCard(s, "B", UNIT({ code: "TEST-V", ap: 2, hp: 5 }), "battleArea");
    s = toActionStep(s, zeta, { unitId: enemy });
    s = runCombat(s);
    expect(inZone(s, "A", "trash", zeta)).toBe(true);
    expect(inZone(s, "B", "trash", enemy)).toBe(true);
    s = resolveWith(s, "A", { specId: "GD06-035-DestroyedEnemy", targetIds: [victim] });
    expect(findCard(s, victim).damage).toBe(2);
  });

  it("Q509 GD06-037: a inimiga recupera HP e a Unit perde <First Strike>", () => {
    let s = game();
    const julia = placeCard(s, "A", card("GD06-037"), "battleArea");
    const hurt = placeCard(s, "B", UNIT({ code: "TEST-H", hp: 9 }), "battleArea", { rested: true, damage: 1 });
    s = act(s, "A", { kind: "declareAttack", attackerId: julia, target: { unitId: hurt } });
    expect(hasKeyword(findCard(s, julia), "First Strike", s)).toBe(true);
    findCard(s, hurt).damage = 0;
    expect(hasKeyword(findCard(s, julia), "First Strike", s)).toBe(false);
  });

  it("Q510 GD06-038: empate no maior Lv. — escolhe uma das duas", () => {
    let s = game();
    const unit = placeCard(s, "A", card("GD06-038"), "battleArea");
    const a = placeCard(s, "B", UNIT({ code: "TEST-8A", level: 8, hp: 9 }), "battleArea");
    const b = placeCard(s, "B", UNIT({ code: "TEST-8B", level: 8, hp: 9 }), "battleArea");
    placeCard(s, "B", UNIT({ code: "TEST-5", level: 5, hp: 9 }), "battleArea");
    s = deployPilot(s, PILOT(), unit);
    expect([...(entry(s, "A", "GD06-038-WhenPaired")?.legalTargets ?? [])].sort()).toEqual([a, b].sort());
    s = resolveWith(s, "A", { specId: "GD06-038-WhenPaired", targetIds: [b] });
    expect(findCard(s, b).damage).toBe(3);
  });

  it("Q511/Q512 GD06-039: a Unit entra sem custo e o 【Deploy】 dela ativa", () => {
    let s = game();
    untapAll(s);
    const fighter = placeCard(s, "A", card("GD06-039"), "battleArea");
    const top = placeCard(s, "A", card("GD06-044"), "battleArea");
    const base = placeCard(s, "A", card("GD06-045"), "battleArea");
    const zz = placeCard(s, "A", card("GD06-033"), "hand");
    const enemy = placeCard(s, "B", UNIT({ code: "TEST-E", hp: 9 }), "battleArea");
    s = act(s, "A", { kind: "activateAbility", sourceInstanceId: fighter });
    for (let i = 0; i < 6 && pending(s, "A") && !inZone(s, "A", "battleArea", zz); i++) {
      const q = pending(s, "A")!.queue[0];
      s = resolveWith(s, "A", {
        specId: q.specId,
        targetIds: q.handChoice ? [zz] : [],
        ...(q.secondaryTarget ? { secondaryTargetIds: [top, base] } : {}),
      });
    }
    expect(inZone(s, "A", "battleArea", zz)).toBe(true);
    expect(restedResources(s)).toBe(0);
    expect(findCard(s, enemy).damage).toBe(3); // 【Deploy】 da ZZ, com o +1 dela
  });

  it("Q514 GD06-042: olhar é obrigatório; parear é escolha", () => {
    expect(specOf("GD06-042-Deploy").optional).toBeFalsy();
    let s = game();
    const cpu = onTop(s, "A", PILOT({ code: "TEST-CPU", traits: ["Biological CPU"] }));
    s = deploy(s, "GD06-042");
    s = resolveWith(s, "A", { specId: "GD06-042-Deploy" });
    expect(inZone(s, "A", "deck", cpu)).toBe(true);
    expect(s.players.A.battleArea.find((c) => c.def.code === "GD06-042")?.pairedPilotId ?? null).toBeNull();
  });

  it("Q515 GD06-049: olhar é obrigatório; pegar é escolha, e o resto vai para o trash", () => {
    expect(specOf("GD06-049-Destroyed").optional).toBeFalsy();
    let s = game();
    const unit = placeCard(s, "A", card("GD06-049"), "battleArea");
    const delaz = onTop(s, "A", UNIT({ code: "TEST-DF", traits: ["Delaz Fleet"] }));
    s = dieInBattle(s, unit);
    s = resolveWith(s, "A", { specId: "GD06-049-Destroyed" });
    expect(inZone(s, "A", "hand", delaz)).toBe(false);
    expect(inZone(s, "A", "trash", delaz)).toBe(true);
  });

  it("Q516/Q517 GD06-051: a Unit do trash entra sem pagar o custo dela e o 【Deploy】 ativa", () => {
    let s = game();
    untapAll(s);
    const gfred = placeCard(s, "A", card("GD06-051"), "battleArea");
    const inTrash = placeCard(s, "A", { ...card("GD06-054"), level: 5 }, "trash");
    placeCard(s, "B", UNIT({ code: "TEST-E", hp: 9 }), "battleArea");
    s = act(s, "A", { kind: "activateAbility", sourceInstanceId: gfred });
    s = resolveWith(s, "A", { specId: "GD06-051-ActivateMain", targetIds: [inTrash] });
    expect(inZone(s, "A", "battleArea", inTrash)).toBe(true);
    expect(restedResources(s)).toBe(2);
    expect(entry(s, "A", "GD06-054-Deploy")).toBeTruthy();
  });

  it("Q519 GD06-051: o fim de turno pode escolher um EX Resource", () => {
    let s = game();
    placeCard(s, "A", UNIT({ code: "TEST-ALPHA", traits: ["Alphacide"] }), "battleArea");
    untapAll(s);
    const ex = placeCard(s, "A", EX_RESOURCE_TOKEN, "resourceArea", { rested: true });
    s = deploy(s, "GD06-051");
    s = act(s, "A", { kind: "finishTurn" });
    for (let i = 0; i < 4 && s.endPhaseAction && !pending(s, "A"); i++) s = act(s, s.endPhaseAction.priority, { kind: "passEndPhaseAction" });
    expect(entry(s, "A", "GD06-051-EndOfTurn")?.legalTargets).toContain(ex);
  });

  it("Q520/Q521 GD06-053: 【Destroyed】 pode escolher Resource ativo e EX Resource", () => {
    let s = game();
    untapAll(s);
    const active = s.players.A.resourceArea[0].instanceId;
    const ex = placeCard(s, "A", EX_RESOURCE_TOKEN, "resourceArea");
    const unit = placeCard(s, "A", card("GD06-053"), "battleArea");
    s = dieInBattle(s, unit);
    const legal = entry(s, "A", "GD06-053-Destroyed")?.legalTargets ?? [];
    expect(legal).toContain(active);
    expect(legal).toContain(ex);
  });

  it("Q522 GD06-054: sem Unit inimiga, o 【Deploy】 não ativa", () => {
    let s = game();
    const mine = placeCard(s, "A", UNIT({ code: "TEST-M", hp: 9 }), "battleArea");
    s = deploy(s, "GD06-054");
    expect(entry(s, "A", "GD06-054-Deploy")).toBeFalsy();
    expect(findCard(s, mine).damage).toBe(0);
  });

  it("Q524 GD06-058: com Bridge Crew, a Unit recém-deployada segue só podendo mirar inimiga descansada", () => {
    let s = game();
    untapAll(s);
    const active = placeCard(s, "B", UNIT({ code: "TEST-ACT" }), "battleArea");
    const rested = placeCard(s, "B", UNIT({ code: "TEST-RES" }), "battleArea", { rested: true });
    s = deploy(s, "GD06-058");
    const blast = s.players.A.battleArea.find((c) => c.def.code === "GD06-058")!.instanceId;
    s = play(s, "GD03-105", "Main", { target: [blast] });
    if (pending(s, "A")) s = resolveWith(s, "A", { specId: pending(s, "A")!.queue[0].specId, targetIds: [blast] });
    expect(() => act(s, "A", { kind: "declareAttack", attackerId: blast, target: { unitId: active } })).toThrow();
    expect(act(s, "A", { kind: "declareAttack", attackerId: blast, target: { unitId: rested } }).combat?.currentTarget).toEqual({ unitId: rested });
  });

  it("Q528 GD06-067: a proibição é só da start phase; Midair Modifications ativa a Unit", () => {
    let s = game();
    untapAll(s);
    const unit = placeCard(s, "A", card("GD06-067"), "battleArea");
    const enemy = placeCard(s, "B", UNIT({ code: "TEST-E", hp: 3, effectKeywords: ["Blocker"] }), "battleArea", { rested: true });
    s = deployPilot(s, PILOT({ level: 4 }), unit);
    s = resolveWith(s, "A", { specId: "GD06-067-WhenPaired", targetIds: [enemy] });
    s = play(s, "GD01-121", "Main", { target: [enemy] });
    if (pending(s, "A")) s = resolveWith(s, "A", { specId: pending(s, "A")!.queue[0].specId, targetIds: [enemy] });
    expect(findCard(s, enemy).rested).toBe(false);
  });

  it("Q529 GD06-068: Unit já descansada pode ser escolhida e recebe AP-2", () => {
    let s = game();
    placeCard(s, "A", UNIT({ code: "TEST-GT", traits: ["G Team"] }), "battleArea");
    const enemy = placeCard(s, "B", UNIT({ code: "TEST-E", level: 3, ap: 4 }), "battleArea", { rested: true });
    s = deploy(s, "GD06-068");
    s = resolveWith(s, "A", { specId: "GD06-068-Deploy", targetIds: [enemy] });
    expect(effectiveAp(findCard(s, enemy), s)).toBe(2);
  });

  it("Q530 GD06-071: ativar o 【Main】 de uma Command (Special Move) pareada pela GD05-035 conta", () => {
    let s = game();
    const shining = placeCard(s, "A", card("GD06-071"), "battleArea");
    const dragon = placeCard(s, "A", card("GD05-035"), "battleArea");
    pair(s, dragon, placeCard(s, "A", { ...card("GD05-112"), nameEn: "Sai Saici" }, "battleArea"));
    const enemy = placeCard(s, "B", UNIT({ code: "TEST-E", ap: 5 }), "battleArea");
    const ap = effectiveAp(findCard(s, shining), s);
    s = act(s, "A", { kind: "declareAttack", attackerId: dragon, target: "player" });
    s = resolveWith(s, "A", { specId: "GD05-112-Main", targetIds: [dragon] });
    s = resolveWith(s, "A", { specId: "GD06-071-CommandActivated", targetIds: [enemy] });
    expect(effectiveAp(findCard(s, enemy), s)).toBe(3);
    expect(effectiveAp(findCard(s, shining), s)).toBe(ap + 2);
  });

  it("Q531 GD06-073: ativa destruindo Shield ou Base", () => {
    for (const withBase of [false, true]) {
      let s = game();
      const wing = placeCard(s, "A", { ...card("GD06-073"), ap: 5 }, "battleArea");
      pair(s, wing, placeCard(s, "A", PILOT(), "battleArea"));
      const low = placeCard(s, "B", UNIT({ code: "TEST-LOW", level: 3 }), "battleArea");
      if (withBase) placeCard(s, "B", BASE({ hp: 1 }), "baseSection");
      s = toActionStep(s, wing, "player");
      s = runCombat(s);
      expect(entry(s, "A", "GD06-073-DestroyedShield")?.legalTargets).toContain(low);
    }
  });

  it("Q533 GD06-089: ativa destruindo Shield ou Base", () => {
    for (const withBase of [false, true]) {
      let s = game();
      const bael = placeCard(s, "A", { ...card("GD06-034"), ap: 5 }, "battleArea");
      pair(s, bael, placeCard(s, "A", card("GD06-089"), "battleArea"));
      if (withBase) placeCard(s, "B", BASE({ hp: 1 }), "baseSection");
      s = toActionStep(s, bael, "player");
      s = runCombat(s);
      expect(entry(s, "A", "GD06-089-DestroyedShield")).toBeTruthy();
    }
  });

  it("Q534 GD06-093: reduzir tira do dano recebido (3 reduzido em 2 vira 1)", () => {
    let s = game();
    const unit = placeCard(s, "A", UNIT({ code: "TEST-U", level: 5, hp: 9 }), "battleArea");
    pair(s, unit, placeCard(s, "A", card("GD06-093"), "battleArea"));
    const enemy = placeCard(s, "B", UNIT({ code: "TEST-E", level: 5, ap: 3, hp: 9 }), "battleArea", { rested: true });
    s = toActionStep(s, unit, { unitId: enemy });
    s = runCombat(s);
    expect(findCard(s, unit).damage).toBe(1);
  });

  it("Q535 GD06-094: Unit com AP 0 não causa dano, então não destrói", () => {
    let s = game();
    const zero = placeCard(s, "A", UNIT({ code: "TEST-ZERO", ap: 0, hp: 9 }), "battleArea");
    const host = placeCard(s, "A", UNIT({ code: "TEST-HOST" }), "battleArea");
    const enemy = placeCard(s, "B", UNIT({ code: "TEST-E", level: 2, ap: 1, hp: 9 }), "battleArea", { rested: true });
    s = deployPilot(s, card("GD06-094"), host);
    s = resolveWith(s, "A", { specId: "GD06-094-WhenPaired", targetIds: [zero] });
    s = toActionStep(s, zero, { unitId: enemy });
    s = runCombat(s);
    expect(inZone(s, "B", "battleArea", enemy)).toBe(true);
    expect(findCard(s, enemy).damage).toBe(0);
  });
});

describe("GD06 FAQ — Commands e Bases", () => {
  it("Q538 GD06-101: com Link Unit (Alphacide) e sem inimiga, não pode ser jogado", () => {
    const s = game();
    const unit = placeCard(s, "A", UNIT({ code: "TEST-AL", traits: ["Alphacide"], link: { kind: "pilotName", values: ["Test Pilot"] } }), "battleArea");
    pair(s, unit, placeCard(s, "A", PILOT(), "battleArea"));
    const inHand = hand(s, "GD06-101");
    expect(enumerateLegalActions(s, "A", ALL_EFFECT_SPECS, { predicateResolver: defaultPredicateResolver, targetFilterResolver: defaultTargetFilterResolver }).some((a) => a.kind === "playCommand" && a.cardInstanceId === inHand)).toBe(false);
    expect(() => act(s, "A", { kind: "playCommand", cardInstanceId: inHand, trigger: "Main" })).toThrow();
  });

  it("Q538 GD06-101: com inimiga de HP 5-, devolve e compra", () => {
    let s = game();
    const unit = placeCard(s, "A", UNIT({ code: "TEST-AL", traits: ["Alphacide"], link: { kind: "pilotName", values: ["Test Pilot"] } }), "battleArea");
    pair(s, unit, placeCard(s, "A", PILOT(), "battleArea"));
    const enemy = placeCard(s, "B", UNIT({ code: "TEST-E", hp: 5 }), "battleArea");
    const cards = s.players.A.hand.length;
    s = play(s, "GD06-101", "Main", { target: [enemy] });
    expect(inZone(s, "B", "hand", enemy)).toBe(true);
    expect(s.players.A.hand.length).toBe(cards + 1);
  });

  it("Q540 GD06-114: sem (Alphacide) amiga, o modo 1 não pode ser escolhido", () => {
    let s = game();
    const attacker = placeCard(s, "A", UNIT({ code: "TEST-ATK" }), "battleArea");
    const low = placeCard(s, "B", UNIT({ code: "TEST-LOW", level: 2 }), "battleArea");
    s = toActionStep(s, attacker, "player");
    s = play(s, "GD06-114", "Action");
    expect(() => resolveWith(s, "A", { specId: "GD06-114-Action", targetIds: ["1"] })).toThrow();
    s = resolveWith(s, "A", { specId: "GD06-114-Action", targetIds: ["2"] });
    s = resolveWith(s, "A", { specId: "GD06-114-Mode2", targetIds: [low] });
    expect(inZone(s, "B", "trash", low)).toBe(true);
  });

  it("Q541 GD06-114: sem inimiga Lv.2-, o modo 2 não pode ser escolhido; sem nenhum alvo, não joga", () => {
    let s = game();
    const attacker = placeCard(s, "A", UNIT({ code: "TEST-ATK" }), "battleArea");
    s = toActionStep(s, attacker, "player");
    expect(() => play(s, "GD06-114", "Action")).toThrow();

    let s2 = game();
    const alpha = placeCard(s2, "A", UNIT({ code: "TEST-AL", traits: ["Alphacide"] }), "battleArea");
    s2 = toActionStep(s2, alpha, "player");
    s2 = play(s2, "GD06-114", "Action");
    expect(() => resolveWith(s2, "A", { specId: "GD06-114-Action", targetIds: ["2"] })).toThrow();
  });

  it("Q544 GD06-116: o 【Deploy】 da Unit que volta do trash ativa", () => {
    let s = game();
    const zeon = placeCard(s, "A", { ...card("GD06-054"), level: 5 }, "trash");
    placeCard(s, "B", UNIT({ code: "TEST-E", hp: 9 }), "battleArea");
    s = play(s, "GD06-116", "Main");
    s = resolveWith(s, "A", { specId: "GD06-116-Main", targetIds: [zeon] });
    expect(inZone(s, "A", "battleArea", zeon)).toBe(true);
    expect(entry(s, "A", "GD06-054-Deploy")).toBeTruthy();
  });

  it("Q545 GD06-117: pode escolher a Unit (Delaz Fleet) descansada que já está na batalha", () => {
    let s = game();
    s.activePlayer = "B";
    const delaz = placeCard(s, "A", UNIT({ code: "TEST-DF", traits: ["Delaz Fleet"], hp: 9 }), "battleArea", { rested: true });
    const attacker = placeCard(s, "B", UNIT({ code: "TEST-ATK", ap: 2, hp: 9 }), "battleArea");
    s = act(s, "B", { kind: "declareAttack", attackerId: attacker, target: { unitId: delaz } });
    s = act(s, "A", { kind: "skipBlock" });
    if (s.combat?.actionPriority === "B") s = act(s, "B", { kind: "passAction" });
    s = play(s, "GD06-117", "Action", { target: [delaz] });
    if (pending(s, "A")) s = resolveWith(s, "A", { specId: "GD06-117-Action", targetIds: [delaz] });
    expect(s.combat?.currentTarget).toEqual({ unitId: delaz });
  });

  it("Q547 GD06-125: <Breach> é dano de efeito, então não ativa a Argama", () => {
    let s = game();
    s.activePlayer = "B";
    placeCard(s, "A", card("GD06-125"), "baseSection");
    placeCard(s, "A", UNIT({ code: "TEST-AEUG", traits: ["AEUG"] }), "battleArea", { rested: true });
    const victim = placeCard(s, "A", UNIT({ code: "TEST-V", hp: 1 }), "battleArea", { rested: true });
    const attacker = placeCard(s, "B", { ...UNIT({ code: "TEST-BR", ap: 3, hp: 9 }), effectKeywords: ["Breach"], keywordTags: ["Breach 1"] } as CardDef, "battleArea");
    const base = s.players.A.baseSection[0].instanceId;
    s = act(s, "B", { kind: "declareAttack", attackerId: attacker, target: { unitId: victim } });
    s = act(s, "A", { kind: "skipBlock" });
    s = runCombat(s);
    expect(findCard(s, base).damage).toBe(1);
    expect(entry(s, "A", "GD06-125-DamagedByEnemy")).toBeFalsy();
  });
});
