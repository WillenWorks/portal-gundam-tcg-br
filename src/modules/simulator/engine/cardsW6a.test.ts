import { describe, expect, it } from "vitest";
import { createGame, TOKEN_EX_RESOURCE_CODE } from "./setup";
import type { CardDef, GameState, PlayerId } from "./types";
import { advanceToMainPhase } from "./phases";
import { attackTargetError } from "./combat";
import { applyPlayerAction, type PlayerAction } from "./actions";
import { effectiveAp, hasKeyword, keywordValue } from "./types";
import { findCard } from "./events";
import { placeCard } from "./__testkit__/cardHarness";
import { buildSt07DeckList } from "../fixtures/st07Deck";
import { buildSt08DeckList } from "../fixtures/st08Deck";
import { ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver } from "../content";
import { GD05_CARD_DEFS } from "../content/gd05";

/**
 * W6 — GD05 lote A (Units 003–060), fluxo real: só ações de jogador (`deployCard`, `declareAttack`,
 * `skipBlock`, `passAction`, `resolveAbility`). O motor tem que PEDIR a escolha com os alvos legais certos,
 * aplicar o efeito depois de resolver e recusar o caso negativo.
 */

const G = GD05_CARD_DEFS;

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
const COMMAND = (extra: Partial<CardDef> = {}): CardDef => ({
  code: "TEST-COMMAND",
  nameEn: "Test Command",
  cardType: "COMMAND",
  color: "white",
  level: 1,
  cost: 1,
  ap: 0,
  hp: 0,
  ...extra,
});
const RESOURCE: CardDef = { code: "TEST-RES", nameEn: "Resource", cardType: "RESOURCE", color: "white", level: 0, cost: 0, ap: 0, hp: 0 };
/** carta de shield sem 【Burst】 (o deck de teste tem Bursts que pausariam o Damage Step) */
const SHIELD = UNIT({ code: "TEST-SHIELD", nameEn: "Plain Shield" });

function game(): GameState {
  const state = advanceToMainPhase(createGame(buildSt07DeckList(), buildSt08DeckList(), { seed: 88, firstPlayer: "A" }));
  for (const p of ["A", "B"] as const) {
    state.players[p].battleArea = [];
    state.players[p].baseSection = [];
    state.players[p].trash = [];
    state.players[p].shields = [];
    for (let i = 0; i < 3; i++) placeCard(state, p, SHIELD, "shields");
  }
  resources(state, "A", 8);
  return state;
}
function pair(state: GameState, unitId: string, pilotId: string): void {
  findCard(state, unitId).pairedPilotId = pilotId;
  findCard(state, pilotId).pairedUnitId = unitId;
}
function resources(state: GameState, player: PlayerId, n: number): void {
  state.players[player].resourceArea = [];
  for (let i = 0; i < n; i++) placeCard(state, player, RESOURCE, "resourceArea");
}
const exCount = (state: GameState, player: PlayerId) =>
  state.players[player].resourceArea.filter((r) => r.def.code === TOKEN_EX_RESOURCE_CODE).length;
function act(state: GameState, player: PlayerId, action: PlayerAction): GameState {
  return applyPlayerAction(state, player, action, ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver);
}
const pending = (state: GameState, player: PlayerId) => {
  const d = state.pendingDecision[player];
  return d?.kind === "abilityResolution" ? d : null;
};
const entry = (state: GameState, player: PlayerId, specId: string) => pending(state, player)?.queue.find((q) => q.specId === specId);
const resolve = (
  state: GameState,
  player: PlayerId,
  specId: string,
  targetIds: string[],
  extra: { activate?: boolean; secondaryTargetIds?: string[] } = {},
) => act(state, player, { kind: "resolveAbility", resolutions: [{ specId, activate: extra.activate ?? true, targetIds, secondaryTargetIds: extra.secondaryTargetIds }] });
/** joga da mão do jogador ativo `A` (Recursos de `game()` bastam pra custo e nível) */
function deployFromHand(state: GameState, def: CardDef, opts: { pairWithUnitId?: string } = {}): { state: GameState; id: string } {
  const id = placeCard(state, "A", def, "hand");
  return { state: act(state, "A", { kind: "deployCard", cardInstanceId: id, pairWithUnitId: opts.pairWithUnitId }), id };
}
/** avança o combate (o defensor não bloqueia, os dois passam o Action Step) até o fim ou até alguém ter decisão pendente */
function runCombat(state: GameState): GameState {
  let s = state;
  for (let guard = 0; guard < 10 && s.combat && !s.pendingDecision.A && !s.pendingDecision.B && !s.gameOver; guard++) {
    if (s.combat.step === "block") s = act(s, s.combat.defendingPlayer, { kind: "skipBlock" });
    else if (s.combat.step === "action") s = act(s, s.combat.actionPriority, { kind: "passAction" });
    else break;
  }
  return s;
}
/** A ataca a Unit `victim` (descansada) do B com uma Unit forte nova */
function attackUnit(state: GameState, victim: string, ap = 9): GameState {
  const attacker = placeCard(state, "A", UNIT({ ap, hp: 9 }), "battleArea");
  return runCombat(act(state, "A", { kind: "declareAttack", attackerId: attacker, target: { unitId: victim } }));
}
const inZone = (state: GameState, player: PlayerId, zone: "battleArea" | "hand" | "trash" | "deck", id: string) =>
  state.players[player][zone].some((c) => c.instanceId === id);
/** põe as cartas no TOPO do deck de `player`, na ordem dada (a 1ª fica no topo) */
function stackTop(state: GameState, player: PlayerId, defs: CardDef[]): string[] {
  const ids = defs.map((d) => placeCard(state, player, d, "deck"));
  const deck = state.players[player].deck;
  const placed = deck.splice(deck.length - ids.length, ids.length);
  deck.unshift(...placed);
  return ids;
}

describe("GD05-003 Waldfeld's Murasame 【Destroyed】", () => {
  function setup(pilotTrait: string) {
    const state = game();
    const murasame = placeCard(state, "B", G["GD05-003"], "battleArea", { rested: true });
    const holder = placeCard(state, "B", UNIT(), "battleArea");
    pair(state, holder, placeCard(state, "B", PILOT({ traits: [pilotTrait] }), "battleArea"));
    return { state, murasame };
  }

  it("destruída em batalha com Piloto (Orb) do dono em jogo → compra 1", () => {
    const { state, murasame } = setup("Orb");
    const hand0 = state.players.B.hand.length;
    const after = attackUnit(state, murasame);
    expect(inZone(after, "B", "trash", murasame)).toBe(true);
    expect(after.players.B.hand.length).toBe(hand0 + 1);
  });

  it("sem Piloto (Orb) em jogo não compra", () => {
    const { state, murasame } = setup("Zeon");
    const hand0 = state.players.B.hand.length;
    const after = attackUnit(state, murasame);
    expect(inZone(after, "B", "trash", murasame)).toBe(true);
    expect(after.players.B.hand.length).toBe(hand0);
  });
});

describe("GD05-007 Asshimar 【During Link】", () => {
  it("pareada com Piloto (Titans) (pareamento real): AP+2 e <Repair 1>; sem Link, nada", () => {
    let state = game();
    const asshimar = placeCard(state, "A", G["GD05-007"], "battleArea");
    expect(effectiveAp(findCard(state, asshimar), state)).toBe(1);
    expect(keywordValue(findCard(state, asshimar), "Repair", state)).toBeNull();
    ({ state } = deployFromHand(state, PILOT({ traits: ["Titans"] }), { pairWithUnitId: asshimar }));
    expect(effectiveAp(findCard(state, asshimar), state)).toBe(3);
    expect(keywordValue(findCard(state, asshimar), "Repair", state)).toBe(1);
  });

  it("pareada com Piloto que não é (Titans): sem Link, sem bônus", () => {
    let state = game();
    const asshimar = placeCard(state, "A", G["GD05-007"], "battleArea");
    ({ state } = deployFromHand(state, PILOT({ traits: ["Zeon"] }), { pairWithUnitId: asshimar }));
    expect(effectiveAp(findCard(state, asshimar), state)).toBe(1);
    expect(hasKeyword(findCard(state, asshimar), "Repair", state)).toBe(false);
  });
});

describe("GD05-011 Calamity Gundam & Raider Gundam 【Deploy】", () => {
  function setup() {
    const state = game();
    const ea = placeCard(state, "A", UNIT({ traits: ["Earth Alliance"] }), "battleArea");
    placeCard(state, "A", UNIT({ traits: ["Earth Alliance"] }), "battleArea", { rested: true }); // já descansada
    placeCard(state, "A", UNIT({ traits: ["ZAFT"] }), "battleArea"); // trait errado
    const restedEnemy = placeCard(state, "B", UNIT({ hp: 9 }), "battleArea", { rested: true });
    const activeEnemy = placeCard(state, "B", UNIT({ hp: 9 }), "battleArea");
    return { state, ea, restedEnemy, activeEnemy };
  }

  it("pede outra Unit (Earth Alliance) ativa e uma Unit inimiga descansada; resta a sua e causa 2 de dano", () => {
    const { state: s0, ea, restedEnemy, activeEnemy } = setup();
    let { state } = deployFromHand(s0, G["GD05-011"]);
    const e = entry(state, "A", "GD05-011-Deploy");
    expect(e?.legalTargets).toEqual([ea]);
    expect(e?.secondaryTarget?.legalTargets).toEqual([restedEnemy]);
    state = resolve(state, "A", "GD05-011-Deploy", [ea], { secondaryTargetIds: [restedEnemy] });
    expect(findCard(state, ea).rested).toBe(true);
    expect(findCard(state, restedEnemy).damage).toBe(2);
    expect(findCard(state, activeEnemy).damage).toBe(0);
  });

  it("é opcional: recusando, nada resta e ninguém toma dano", () => {
    const { state: s0, ea, restedEnemy } = setup();
    let { state } = deployFromHand(s0, G["GD05-011"]);
    state = resolve(state, "A", "GD05-011-Deploy", [], { activate: false });
    expect(findCard(state, ea).rested).toBe(false);
    expect(findCard(state, restedEnemy).damage).toBe(0);
  });
});

describe("GD05-012 Forbidden Gundam 【When Linked】", () => {
  it("pareamento real com Piloto (Biological CPU): pede Unit inimiga descansada Lv.3- e devolve à mão do dono", () => {
    let state = game();
    const forbidden = placeCard(state, "A", G["GD05-012"], "battleArea");
    const low = placeCard(state, "B", UNIT({ level: 3 }), "battleArea", { rested: true });
    placeCard(state, "B", UNIT({ level: 3 }), "battleArea"); // ativa
    placeCard(state, "B", UNIT({ level: 4 }), "battleArea", { rested: true }); // Lv.4
    ({ state } = deployFromHand(state, PILOT({ traits: ["Biological CPU"] }), { pairWithUnitId: forbidden }));
    expect(entry(state, "A", "GD05-012-WhenLinked")?.legalTargets).toEqual([low]);
    state = resolve(state, "A", "GD05-012-WhenLinked", [low]);
    expect(inZone(state, "B", "hand", low)).toBe(true);
  });

  it("Piloto que não forma Link não dispara o 【When Linked】", () => {
    let state = game();
    const forbidden = placeCard(state, "A", G["GD05-012"], "battleArea");
    const low = placeCard(state, "B", UNIT({ level: 3 }), "battleArea", { rested: true });
    ({ state } = deployFromHand(state, PILOT({ traits: ["Coordinator"] }), { pairWithUnitId: forbidden }));
    expect(entry(state, "A", "GD05-012-WhenLinked")).toBeUndefined();
    expect(inZone(state, "B", "battleArea", low)).toBe(true);
  });
});

describe("GD05-015 M1 Astray Shrike 【Deploy】", () => {
  it("pede só Unit inimiga descansada e causa 1 de dano", () => {
    let state = game();
    const rested = placeCard(state, "B", UNIT({ hp: 9 }), "battleArea", { rested: true });
    const active = placeCard(state, "B", UNIT({ hp: 9 }), "battleArea");
    ({ state } = deployFromHand(state, G["GD05-015"]));
    const legal = entry(state, "A", "GD05-015-Deploy")?.legalTargets;
    expect(legal).toEqual([rested]);
    expect(legal).not.toContain(active);
    state = resolve(state, "A", "GD05-015-Deploy", [rested]);
    expect(findCard(state, rested).damage).toBe(1);
  });
});

describe("GD05-019 Re-GZ 【Destroyed】", () => {
  it("destruída em batalha: olha o topo 3, pode revelar Unit (Londo Bell) e pô-la na mão; o resto vai pro fundo", () => {
    let state = game();
    const regz = placeCard(state, "B", G["GD05-019"], "battleArea", { rested: true });
    const [other, lb, cmd] = stackTop(state, "B", [UNIT({ traits: ["Zeon"] }), UNIT({ traits: ["Londo Bell"] }), COMMAND({ traits: ["Londo Bell"] })]);
    state = attackUnit(state, regz);
    expect(entry(state, "B", "GD05-019-Destroyed")?.deckTopReveal?.revealableIds).toEqual([lb]);
    state = resolve(state, "B", "GD05-019-Destroyed", [lb]);
    expect(inZone(state, "B", "hand", lb)).toBe(true);
    const bottom = state.players.B.deck.slice(-2).map((c) => c.instanceId);
    expect(bottom.sort()).toEqual([other, cmd].sort());
  });

  it("sem Unit (Londo Bell) no topo 3, nada pode ser revelado", () => {
    let state = game();
    const regz = placeCard(state, "B", G["GD05-019"], "battleArea", { rested: true });
    const top = stackTop(state, "B", [UNIT({ traits: ["Zeon"] }), COMMAND({ traits: ["Londo Bell"] }), PILOT({ traits: ["Londo Bell"] })]);
    state = attackUnit(state, regz);
    expect(entry(state, "B", "GD05-019-Destroyed")?.deckTopReveal?.revealableIds).toEqual([]);
    state = resolve(state, "B", "GD05-019-Destroyed", []);
    expect(top.some((id) => inZone(state, "B", "hand", id))).toBe(false);
  });
});

describe("GD05-020 Nu Gundam", () => {
  it("【During Pair】: pareada (pareamento real) ganha <Breach 3>; sem par, não", () => {
    let state = game();
    const nu = placeCard(state, "A", G["GD05-020"], "battleArea");
    expect(keywordValue(findCard(state, nu), "Breach", state)).toBeNull();
    ({ state } = deployFromHand(state, PILOT(), { pairWithUnitId: nu }));
    expect(keywordValue(findCard(state, nu), "Breach", state)).toBe(3);
  });

  it("【Deploy】 com 2 cartas (Londo Bell) no trash → põe 1 EX Resource", () => {
    let state = game();
    placeCard(state, "A", UNIT({ traits: ["Londo Bell"] }), "trash");
    placeCard(state, "A", COMMAND({ traits: ["Londo Bell"] }), "trash");
    const ex0 = exCount(state, "A");
    ({ state } = deployFromHand(state, G["GD05-020"]));
    expect(exCount(state, "A")).toBe(ex0 + 1);
  });

  it("【Deploy】 com só 1 carta (Londo Bell) no trash → nada", () => {
    let state = game();
    placeCard(state, "A", UNIT({ traits: ["Londo Bell"] }), "trash");
    placeCard(state, "A", UNIT({ traits: ["Zeon"] }), "trash");
    const ex0 = exCount(state, "A");
    ({ state } = deployFromHand(state, G["GD05-020"]));
    expect(exCount(state, "A")).toBe(ex0);
  });
});

describe("GD05-023 Re-GZ BWS 【Deploy】", () => {
  it("põe 1 EX Resource do dono (e só do dono)", () => {
    let state = game();
    const exA = exCount(state, "A");
    const exB = exCount(state, "B");
    ({ state } = deployFromHand(state, G["GD05-023"]));
    expect(exCount(state, "A")).toBe(exA + 1);
    expect(exCount(state, "B")).toBe(exB);
  });
});

describe("GD05-025 Demi Barding 【Deploy】", () => {
  it("olha o topo 3; só Command pode ser revelado e ir pra mão; o resto vai pro fundo", () => {
    let state = game();
    const [unit, cmd, pilot] = stackTop(state, "A", [UNIT(), COMMAND(), PILOT()]);
    ({ state } = deployFromHand(state, G["GD05-025"]));
    expect(entry(state, "A", "GD05-025-Deploy")?.deckTopReveal?.revealableIds).toEqual([cmd]);
    state = resolve(state, "A", "GD05-025-Deploy", [cmd]);
    expect(inZone(state, "A", "hand", cmd)).toBe(true);
    expect(inZone(state, "A", "hand", unit)).toBe(false);
    expect(state.players.A.deck.slice(-2).map((c) => c.instanceId).sort()).toEqual([unit, pilot].sort());
  });
});

describe("GD05-028 Kayra's Jegan 【Deploy】", () => {
  it("pede Unit (Londo Bell) sua; ela pode atacar inimiga ativa com AP4-", () => {
    let state = game();
    const lb = placeCard(state, "A", UNIT({ traits: ["Londo Bell"] }), "battleArea");
    const zeon = placeCard(state, "A", UNIT({ traits: ["Zeon"] }), "battleArea");
    const weak = placeCard(state, "B", UNIT({ ap: 4 }), "battleArea");
    const strong = placeCard(state, "B", UNIT({ ap: 5 }), "battleArea");
    const deployed = deployFromHand(state, G["GD05-028"]);
    state = deployed.state;
    const jegan = deployed.id;
    const legal = entry(state, "A", "GD05-028-Deploy")?.legalTargets ?? [];
    expect(legal.sort()).toEqual([lb, jegan].sort()); // a própria Jegan é (Londo Bell)
    expect(legal).not.toContain(zeon);
    state = resolve(state, "A", "GD05-028-Deploy", [lb]);
    expect(attackTargetError(state, findCard(state, lb), { unitId: weak })).toBeNull();
    expect(attackTargetError(state, findCard(state, lb), { unitId: strong })).not.toBeNull();
    expect(attackTargetError(state, findCard(state, zeon), { unitId: weak })).not.toBeNull();
  });
});

describe("GD05-029 Kayra's Re-GZ 【Deploy】", () => {
  it("pergunta topo/fundo; 'bottom' manda a carta do topo pro fundo", () => {
    let state = game();
    const [top] = stackTop(state, "A", [UNIT()]);
    ({ state } = deployFromHand(state, G["GD05-029"]));
    const e = entry(state, "A", "GD05-029-Deploy");
    expect(e?.enumChoice?.options.map((o) => o.value).sort()).toEqual(["bottom", "top"]);
    state = resolve(state, "A", "GD05-029-Deploy", ["bottom"]);
    const deck = state.players.A.deck;
    expect(deck[deck.length - 1].instanceId).toBe(top);
  });

  it("'top' deixa a carta no topo", () => {
    let state = game();
    const [top] = stackTop(state, "A", [UNIT()]);
    ({ state } = deployFromHand(state, G["GD05-029"]));
    state = resolve(state, "A", "GD05-029-Deploy", ["top"]);
    expect(state.players.A.deck[0].instanceId).toBe(top);
  });
});

describe("GD05-039 Chaos Gundam 【Attack】", () => {
  it("atacando: pede Link Unit (Phantom Pain) sua e ela ganha <High-Maneuver> neste turno", () => {
    let state = game();
    const chaos = placeCard(state, "A", G["GD05-039"], "battleArea");
    pair(state, chaos, placeCard(state, "A", PILOT({ nameEn: "Sting Oakley" }), "battleArea"));
    const linkedAlly = placeCard(state, "A", UNIT({ traits: ["Phantom Pain"], link: { kind: "trait", values: ["Extended"] } }), "battleArea");
    pair(state, linkedAlly, placeCard(state, "A", PILOT({ traits: ["Extended"] }), "battleArea"));
    const unlinked = placeCard(state, "A", UNIT({ traits: ["Phantom Pain"], link: { kind: "trait", values: ["Extended"] } }), "battleArea");
    pair(state, unlinked, placeCard(state, "A", PILOT({ traits: ["Coordinator"] }), "battleArea"));
    state = act(state, "A", { kind: "declareAttack", attackerId: chaos, target: "player" });
    const legal = entry(state, "A", "GD05-039-Attack")?.legalTargets ?? [];
    expect(legal.sort()).toEqual([chaos, linkedAlly].sort());
    expect(legal).not.toContain(unlinked);
    state = resolve(state, "A", "GD05-039-Attack", [linkedAlly]);
    expect(hasKeyword(findCard(state, linkedAlly), "High-Maneuver", state)).toBe(true);
    expect(hasKeyword(findCard(state, unlinked), "High-Maneuver", state)).toBe(false);
  });
});

describe("GD05-050 Gundam Exia Repair 【Destroyed】", () => {
  it("destruída em batalha → as 2 cartas do topo do deck do dono vão pro trash", () => {
    let state = game();
    const exia = placeCard(state, "B", G["GD05-050"], "battleArea", { rested: true });
    const top = stackTop(state, "B", [UNIT(), COMMAND()]);
    state = attackUnit(state, exia);
    expect(inZone(state, "B", "trash", exia)).toBe(true);
    expect(top.every((id) => inZone(state, "B", "trash", id))).toBe(true);
  });

  it("atacando e sobrevivendo, nada vai pro trash", () => {
    let state = game();
    const exia = placeCard(state, "A", G["GD05-050"], "battleArea");
    const top = stackTop(state, "A", [UNIT(), COMMAND()]);
    state = runCombat(act(state, "A", { kind: "declareAttack", attackerId: exia, target: "player" }));
    expect(inZone(state, "A", "battleArea", exia)).toBe(true);
    expect(top.every((id) => inZone(state, "A", "deck", id))).toBe(true);
  });
});

describe("GD05-055 Destiny Gundam 【Once per Turn】", () => {
  it("o 1º dano de batalha inimigo do turno é reduzido em 2; o 2º não", () => {
    let state = game();
    const destiny = placeCard(state, "B", G["GD05-055"], "battleArea", { rested: true });
    state = attackUnit(state, destiny, 4);
    expect(findCard(state, destiny).damage).toBe(2);
    state = attackUnit(state, destiny, 3);
    expect(findCard(state, destiny).damage).toBe(5);
  });
});

describe("GD05-060 Gundam Flauros (Ryusei-Go) 【Deploy】/【Attack】", () => {
  it("【Deploy】: pede Unit inimiga Lv.2- e a destrói", () => {
    let state = game();
    const low = placeCard(state, "B", UNIT({ level: 2 }), "battleArea");
    const high = placeCard(state, "B", UNIT({ level: 3 }), "battleArea");
    ({ state } = deployFromHand(state, G["GD05-060"]));
    expect(entry(state, "A", "GD05-060-Deploy")?.legalTargets).toEqual([low]);
    state = resolve(state, "A", "GD05-060-Deploy", [low]);
    expect(inZone(state, "B", "trash", low)).toBe(true);
    expect(inZone(state, "B", "battleArea", high)).toBe(true);
  });

  it("【Attack】: atacando, pede Unit inimiga Lv.2- e a destrói", () => {
    let state = game();
    const flauros = placeCard(state, "A", G["GD05-060"], "battleArea");
    const low = placeCard(state, "B", UNIT({ level: 1 }), "battleArea");
    const high = placeCard(state, "B", UNIT({ level: 5 }), "battleArea");
    state = act(state, "A", { kind: "declareAttack", attackerId: flauros, target: "player" });
    expect(entry(state, "A", "GD05-060-Attack")?.legalTargets).toEqual([low]);
    state = resolve(state, "A", "GD05-060-Attack", [low]);
    expect(inZone(state, "B", "trash", low)).toBe(true);
    expect(inZone(state, "B", "battleArea", high)).toBe(true);
  });
});

describe("GD05-050 — reação ao dano de batalha (integração W6)", () => {
  function fight(victimLevel: number, paired: boolean): { state: GameState; victim: string } {
    let state = game();
    const exia = placeCard(state, "A", G["GD05-050"], "battleArea");
    const victim = placeCard(state, "B", UNIT({ level: victimLevel, hp: 9 }), "battleArea", { rested: true });
    if (paired) pair(state, victim, placeCard(state, "B", PILOT(), "battleArea"));
    state = runCombat(act(state, "A", { kind: "declareAttack", attackerId: exia, target: { unitId: victim } }));
    return { state, victim };
  }
  it("Unit inimiga Lv.4- sem Piloto que sobrevive ao dano é destruída", () => {
    const { state, victim } = fight(4, false);
    expect(inZone(state, "B", "trash", victim)).toBe(true);
  });
  it("com Piloto pareado, ou Lv.5, ela fica", () => {
    for (const [lv, paired] of [
      [4, true],
      [5, false],
    ] as const) {
      const { state, victim } = fight(lv, paired);
      expect(inZone(state, "B", "battleArea", victim)).toBe(true);
    }
  });
});
