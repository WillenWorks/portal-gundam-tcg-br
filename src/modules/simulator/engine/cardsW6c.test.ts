import { describe, expect, it } from "vitest";
import { createGame, EX_RESOURCE_TOKEN, TOKEN_EX_RESOURCE_CODE } from "./setup";
import type { CardDef, GameState, PlayerId } from "./types";
import { advanceToMainPhase } from "./phases";
import { applyPlayerAction, type PlayerAction } from "./actions";
import { enumerateLegalActions, type LegalAction } from "./legalActions";
import { effectiveAp, hasKeyword } from "./types";
import { findCard } from "./events";
import { dispatchTrigger } from "./dispatcher";
import { placeCard } from "./__testkit__/cardHarness";
import { buildSt07DeckList } from "../fixtures/st07Deck";
import { buildSt08DeckList } from "../fixtures/st08Deck";
import { ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver } from "../content";
import { GD05_CARD_DEFS } from "../content/gd05";

/**
 * W6 — GD05 lote C (Commands e Base): fluxo real via `applyPlayerAction`.
 * Command/【Burst】/【Activate】 com alvo no tabuleiro resolvem com o alvo já escolhido na própria
 * ação (o cliente mostra os legais de `enumerateLegalActions`); só escolha fora do tabuleiro
 * (descarte, trash) pausa numa `abilityResolution`.
 */

const G = GD05_CARD_DEFS;
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
const RESOURCE: CardDef = { code: "TEST-RES", nameEn: "Resource", cardType: "RESOURCE", color: "white", level: 0, cost: 0, ap: 0, hp: 0 };
const COMMAND: CardDef = { code: "TEST-COMMAND", nameEn: "Test Command", cardType: "COMMAND", color: "white", level: 1, cost: 1, ap: 0, hp: 0 };

function game(): GameState {
  const state = advanceToMainPhase(createGame(buildSt07DeckList(), buildSt08DeckList(), { seed: 96, firstPlayer: "A" }));
  for (const p of ["A", "B"] as const) {
    state.players[p].battleArea = [];
    state.players[p].baseSection = [];
    state.players[p].trash = [];
  }
  return state;
}
/** `n` Recursos normais + `ex` EX Resources na Resource Area */
function resources(state: GameState, player: PlayerId, n: number, ex = 0): string[] {
  state.players[player].resourceArea = [];
  for (let i = 0; i < n; i++) placeCard(state, player, RESOURCE, "resourceArea");
  return Array.from({ length: ex }, () => placeCard(state, player, EX_RESOURCE_TOKEN, "resourceArea"));
}
function act(state: GameState, player: PlayerId, action: PlayerAction): GameState {
  return applyPlayerAction(state, player, action, ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver);
}
const legal = (state: GameState, player: PlayerId): LegalAction[] => enumerateLegalActions(state, player, ALL_EFFECT_SPECS, OPTS);
const dmg = (state: GameState, id: string) => findCard(state, id).damage;
const zoneOf = (state: GameState, id: string) => findCard(state, id).zone;
const exCount = (state: GameState, player: PlayerId) =>
  state.players[player].resourceArea.filter((r) => r.def.code === TOKEN_EX_RESOURCE_CODE).length;
const entry = (state: GameState, player: PlayerId, specId: string) => {
  const d = state.pendingDecision[player];
  return d?.kind === "abilityResolution" ? d.queue.find((q) => q.specId === specId) : undefined;
};
/** alvos oferecidos pelo motor pra jogar o Command `card` (uma jogada por combinação) */
const cmdOffers = (state: GameState, card: string) =>
  legal(state, "A").flatMap((a) => (a.kind === "playCommand" && a.cardInstanceId === card ? [a.targets ?? {}] : []));

/** Command na mão do A, Recursos suficientes, Main Phase do A */
function inHand(state: GameState, def: CardDef, opts: { withEx?: boolean } = {}): { card: string; pay?: string[] } {
  const cost = def.cost ?? 0;
  const ex = resources(state, "A", Math.max(def.level ?? 0, cost), opts.withEx ? 1 : 0);
  const normal = state.players.A.resourceArea.filter((r) => r.def.code !== TOKEN_EX_RESOURCE_CODE).map((r) => r.instanceId);
  const card = placeCard(state, "A", def, "hand");
  return { card, pay: opts.withEx ? [...ex, ...normal.slice(0, cost - 1)] : undefined };
}
function play(state: GameState, card: string, targets?: Record<string, string[]>, extra: { trigger?: "Main" | "Action"; pay?: string[] } = {}): GameState {
  return act(state, "A", { kind: "playCommand", cardInstanceId: card, trigger: extra.trigger ?? "Main", targets, resourceInstanceIds: extra.pay });
}

/** Action Step de uma batalha (B ataca o A) com a prioridade no A; o Command fica na mão do A */
function actionStep(state: GameState, def: CardDef): { state: GameState; card: string } {
  resources(state, "A", Math.max(def.level ?? 0, def.cost ?? 0));
  const attacker = placeCard(state, "B", UNIT({ hp: 9 }), "battleArea");
  const card = placeCard(state, "A", def, "hand");
  const inCombat: GameState = {
    ...state,
    activePlayer: "B",
    combat: {
      step: "action",
      attackerId: attacker,
      attackingPlayer: "B",
      defendingPlayer: "A",
      originalTarget: "player",
      currentTarget: "player",
      actionPasses: { A: false, B: false },
      actionPriority: "A",
    },
  };
  return { state: inCombat, card };
}

/** A ataca o B (sem bloqueio) com `shieldDef` no topo dos Shields do B; devolve o estado com a decisão de 【Burst】 pendente */
function burstPending(state: GameState, shieldDef: CardDef): { state: GameState; shield: string } {
  state.players.B.shields = [];
  const shield = placeCard(state, "B", shieldDef, "shields");
  for (let i = 0; i < 3; i++) placeCard(state, "B", UNIT({ code: "TEST-SHIELD" }), "shields");
  const attacker = placeCard(state, "A", UNIT({ ap: 2, hp: 9 }), "battleArea");
  let s = act(state, "A", { kind: "declareAttack", attackerId: attacker, target: "player" });
  s = act(s, "B", { kind: "skipBlock" });
  s = act(s, "B", { kind: "passAction" });
  s = act(s, "A", { kind: "passAction" });
  expect(s.pendingDecision.B).toMatchObject({ kind: "burst", cardInstanceId: shield });
  return { state: s, shield };
}
const burstOffers = (state: GameState) =>
  legal(state, "B").flatMap((a) => (a.kind === "resolveBurstDecision" && a.activate ? [a.targets?.target ?? []] : []));

/** dano de efeito de um Command inimigo (B) — só pra medir a redução da GD05-125 */
function enemyEffectHit(state: GameState, targetId: string, amount: number): GameState {
  const src = placeCard(state, "B", COMMAND, "trash");
  return dispatchTrigger(
    state,
    src,
    "Main",
    [{ id: "T-hit", cardCode: COMMAND.code, trigger: "Main", actions: [{ op: "damageUnit", target: { kind: "instance", instanceId: targetId }, amount }], sourceText: "t" }],
    { allSpecs: ALL_EFFECT_SPECS, ...OPTS },
  );
}

describe("W6c — GD05 Commands (Main/Action)", () => {
  it("103 【Main】: oferece só Unit sua; recupera 1 HP e ganha AP+2 neste turno", () => {
    const state = game();
    const mine = placeCard(state, "A", UNIT({ hp: 5 }), "battleArea", { damage: 2 });
    placeCard(state, "B", UNIT(), "battleArea");
    const { card } = inHand(state, G["GD05-103"]);
    expect(cmdOffers(state, card)).toEqual([{ target: [mine] }]);
    const s = play(state, card, { target: [mine] });
    expect(dmg(s, mine)).toBe(1);
    expect(effectiveAp(findCard(s, mine), s)).toBe(5);
    expect(zoneOf(s, card)).toBe("trash");
  });

  it("103 【Action】 (Action Step): a Unit inimiga (o atacante) não é alvo", () => {
    const base = game();
    const mine = placeCard(base, "A", UNIT(), "battleArea");
    const { state, card } = actionStep(base, G["GD05-103"]);
    expect(cmdOffers(state, card)).toEqual([{ target: [mine] }]);
    const attacker = state.combat?.attackerId ?? "";
    expect(() => play(state, card, { target: [attacker] }, { trigger: "Action" })).toThrow(/Alvo inválido/);
    const s = play(state, card, { target: [mine] }, { trigger: "Action" });
    expect(effectiveAp(findCard(s, mine), s)).toBe(5);
  });

  it("105 【Main】: devolve à mão do dono Unit inimiga Lv.3-; Lv.4 não é alvo", () => {
    const state = game();
    const low = placeCard(state, "B", UNIT({ level: 3 }), "battleArea");
    const high = placeCard(state, "B", UNIT({ level: 4 }), "battleArea");
    const { card } = inHand(state, G["GD05-105"]);
    expect(cmdOffers(state, card)).toEqual([{ target: [low] }]);
    expect(() => play(state, card, { target: [high] })).toThrow(/Alvo inválido/);
    const s = play(state, card, { target: [low] });
    expect(s.players.B.hand.some((c) => c.instanceId === low)).toBe(true);
  });

  it("105 【Burst】 ativa o 【Main】 (Shield destruído no ataque real)", () => {
    const state = game();
    const low = placeCard(state, "A", UNIT({ level: 2 }), "battleArea");
    const high = placeCard(state, "A", UNIT({ level: 5 }), "battleArea");
    let { state: s } = burstPending(state, G["GD05-105"]);
    const offers = burstOffers(s).flat();
    expect(offers).toContain(low); // o atacante (Lv.3) também é Lv.3- e entra; a Lv.5 não
    expect(offers).not.toContain(high);
    expect(() => act(s, "B", { kind: "resolveBurstDecision", activate: true, targets: { target: [high] } })).toThrow(/Alvo inválido/);
    s = act(s, "B", { kind: "resolveBurstDecision", activate: true, targets: { target: [low] } });
    expect(s.players.A.hand.some((c) => c.instanceId === low)).toBe(true);
  });

  it("107 【Burst】: coloca 1 EX Resource (só o Burst; o 【Main】 fica de fora)", () => {
    const state = game();
    state.players.B.resourceArea = [];
    let { state: s } = burstPending(state, G["GD05-107"]);
    s = act(s, "B", { kind: "resolveBurstDecision", activate: true });
    expect(exCount(s, "B")).toBe(1);
  });

  it("107: recusar o 【Burst】 não coloca EX Resource", () => {
    const state = game();
    state.players.B.resourceArea = [];
    let { state: s } = burstPending(state, G["GD05-107"]);
    s = act(s, "B", { kind: "resolveBurstDecision", activate: false });
    expect(exCount(s, "B")).toBe(0);
  });

  it("111 【Main】: pausa pra escolher o descarte; descarta 1 e compra 2", () => {
    const state = game();
    state.players.A.hand = [];
    const junk = placeCard(state, "A", UNIT(), "hand");
    const { card } = inHand(state, G["GD05-111"]);
    const deck0 = state.players.A.deck.length;
    let s = play(state, card);
    expect(entry(s, "A", "GD05-111-Main")?.handDiscard?.legalHandIds).toContain(junk);
    s = act(s, "A", { kind: "resolveAbility", resolutions: [{ specId: "GD05-111-Main", activate: true, targetIds: [junk] }] });
    expect(zoneOf(s, junk)).toBe("trash");
    expect(zoneOf(s, card)).toBe("trash");
    expect(s.players.A.hand.length).toBe(2);
    expect(s.players.A.deck.length).toBe(deck0 - 2);
  });

  // Achado na W6c: enquanto o Command pausa na decisão ele continua na mão, e o motor o oferecia
  // como carta a descartar (com a mão vazia, 111 "descartava a si mesma" e comprava 2).
  it("111: a própria Command não é candidata ao descarte", () => {
    const state = game();
    state.players.A.hand = [];
    placeCard(state, "A", UNIT(), "hand");
    const { card } = inHand(state, G["GD05-111"]);
    const s = play(state, card);
    expect(entry(s, "A", "GD05-111-Main")?.handDiscard?.legalHandIds).not.toContain(card);
  });

  it("111: com a mão vazia (fora a própria Command), não descarta e não compra", () => {
    const state = game();
    state.players.A.hand = [];
    const { card } = inHand(state, G["GD05-111"]);
    const deck0 = state.players.A.deck.length;
    let s = play(state, card);
    if (entry(s, "A", "GD05-111-Main")) {
      s = act(s, "A", { kind: "resolveAbility", resolutions: [{ specId: "GD05-111-Main", activate: true, targetIds: [] }] });
    }
    expect(s.players.A.hand.length).toBe(0);
    expect(s.players.A.deck.length).toBe(deck0);
  });

  it("114 【Main】: destrói todas as Units Lv.4- dos 2 lados; Lv.5 fica", () => {
    const state = game();
    const mine = placeCard(state, "A", UNIT({ level: 4 }), "battleArea");
    const theirs = placeCard(state, "B", UNIT({ level: 1 }), "battleArea");
    const big = placeCard(state, "B", UNIT({ level: 5 }), "battleArea");
    const { card } = inHand(state, G["GD05-114"]);
    expect(cmdOffers(state, card)).toEqual([{}]); // sem escolha
    const s = play(state, card);
    expect(zoneOf(s, mine)).toBe("trash");
    expect(zoneOf(s, theirs)).toBe("trash");
    expect(zoneOf(s, big)).toBe("battleArea");
  });

  it("115 【Main】: busca no trash só Piloto (Neo Zeon) e põe na mão", () => {
    const state = game();
    const nz = placeCard(state, "A", PILOT({ traits: ["Neo Zeon"] }), "trash");
    placeCard(state, "A", PILOT({ traits: ["Zeon"] }), "trash");
    placeCard(state, "A", UNIT({ traits: ["Neo Zeon"] }), "trash");
    const { card } = inHand(state, G["GD05-115"]);
    let s = play(state, card);
    expect(entry(s, "A", "GD05-115-Main")?.trashSearch?.legalTrashIds).toEqual([nz]);
    s = act(s, "A", { kind: "resolveAbility", resolutions: [{ specId: "GD05-115-Main", activate: true, targetIds: [nz] }] });
    expect(zoneOf(s, nz)).toBe("hand");
  });

  it("115 【Burst】: compra 1; recusado, não compra", () => {
    const state = game();
    const hand0 = state.players.B.hand.length;
    const { state: pend } = burstPending(state, G["GD05-115"]);
    expect(act(pend, "B", { kind: "resolveBurstDecision", activate: true }).players.B.hand.length).toBe(hand0 + 1);
    expect(act(pend, "B", { kind: "resolveBurstDecision", activate: false }).players.B.hand.length).toBe(hand0);
  });

  it("116 【Main】: destrói Unit inimiga Lv.2-; Lv.3 não é alvo", () => {
    const state = game();
    const low = placeCard(state, "B", UNIT({ level: 2 }), "battleArea");
    const high = placeCard(state, "B", UNIT({ level: 3 }), "battleArea");
    const { card } = inHand(state, G["GD05-116"]);
    expect(cmdOffers(state, card)).toEqual([{ target: [low] }]);
    expect(() => play(state, card, { target: [high] })).toThrow(/Alvo inválido/);
    const s = play(state, card, { target: [low] });
    expect(zoneOf(s, low)).toBe("trash");
  });

  it("116 【Action】: no Action Step, só a inimiga Lv.2- é oferecida (o atacante Lv.3 não)", () => {
    const base = game();
    const low = placeCard(base, "B", UNIT({ level: 1 }), "battleArea");
    const { state, card } = actionStep(base, G["GD05-116"]);
    expect(cmdOffers(state, card)).toEqual([{ target: [low] }]);
    const s = play(state, card, { target: [low] }, { trigger: "Action" });
    expect(zoneOf(s, low)).toBe("trash");
  });

  it("117 【Main】: 1 de dano numa Unit sua E numa inimiga", () => {
    const state = game();
    const mine = placeCard(state, "A", UNIT({ hp: 4 }), "battleArea");
    const enemy = placeCard(state, "B", UNIT({ hp: 4 }), "battleArea");
    const { card } = inHand(state, G["GD05-117"]);
    expect(cmdOffers(state, card)).toEqual([{ target: [mine], enemyTarget: [enemy] }]);
    expect(() => play(state, card, { target: [enemy], enemyTarget: [enemy] })).toThrow(/Alvo inválido/);
    const s = play(state, card, { target: [mine], enemyTarget: [enemy] });
    expect(dmg(s, mine)).toBe(1);
    expect(dmg(s, enemy)).toBe(1);
  });

  it("117: sem Unit inimiga, a Unit sua não leva dano (os 2 alvos são exigidos juntos)", () => {
    const state = game();
    const mine = placeCard(state, "A", UNIT({ hp: 4 }), "battleArea");
    const { card } = inHand(state, G["GD05-117"]);
    const offers = cmdOffers(state, card);
    let s = state;
    for (const targets of offers) {
      try {
        s = play(state, card, targets);
      } catch {
        s = state; // jogada recusada pelo motor também é aceitável: o efeito não acontece
      }
    }
    expect(dmg(s, mine)).toBe(0);
  });

  it("118 【Main】 sem EX: só AP-2 (não descansa)", () => {
    const state = game();
    const enemy = placeCard(state, "B", UNIT({ ap: 4 }), "battleArea");
    placeCard(state, "A", UNIT(), "battleArea");
    const { card } = inHand(state, G["GD05-118"]);
    expect(cmdOffers(state, card)).toEqual([{ target: [enemy] }]);
    const s = play(state, card, { target: [enemy] });
    expect(effectiveAp(findCard(s, enemy), s)).toBe(2);
    expect(findCard(s, enemy).rested).toBe(false);
  });

  it("118 【Main】 pago com EX Resource: AP-2 e descansa", () => {
    const state = game();
    const enemy = placeCard(state, "B", UNIT({ ap: 4 }), "battleArea");
    const { card, pay } = inHand(state, G["GD05-118"], { withEx: true });
    const s = play(state, card, { target: [enemy] }, { pay });
    expect(exCount(s, "A")).toBe(0);
    expect(effectiveAp(findCard(s, enemy), s)).toBe(2);
    expect(findCard(s, enemy).rested).toBe(true);
  });

  it("120 【Main】: descansa inimiga HP<=4 e, se quiser, dá <First Strike> à sua \"Shining Gundam\"", () => {
    const state = game();
    const enemy = placeCard(state, "B", UNIT({ hp: 4 }), "battleArea");
    const big = placeCard(state, "B", UNIT({ hp: 5 }), "battleArea");
    const shining = placeCard(state, "A", UNIT({ nameEn: "Shining Gundam (Super Mode)" }), "battleArea");
    const god = placeCard(state, "A", UNIT({ nameEn: "God Gundam" }), "battleArea");
    const { card } = inHand(state, G["GD05-120"]);
    expect(cmdOffers(state, card)).toEqual([{ target: [enemy], shining: [shining] }]);
    expect(() => play(state, card, { target: [big] })).toThrow(/Alvo inválido/);
    const s = play(state, card, { target: [enemy], shining: [shining] });
    expect(findCard(s, enemy).rested).toBe(true);
    expect(hasKeyword(findCard(s, shining), "First Strike", s)).toBe(true);
    expect(hasKeyword(findCard(s, god), "First Strike", s)).toBe(false);
  });

  it("120: recusar a 2ª escolha (\"you may\") ainda descansa a inimiga, sem <First Strike>", () => {
    const state = game();
    const enemy = placeCard(state, "B", UNIT({ hp: 3 }), "battleArea");
    const shining = placeCard(state, "A", UNIT({ nameEn: "Shining Gundam" }), "battleArea");
    const { card } = inHand(state, G["GD05-120"]);
    const s = play(state, card, { target: [enemy] });
    expect(findCard(s, enemy).rested).toBe(true);
    expect(hasKeyword(findCard(s, shining), "First Strike", s)).toBe(false);
  });
});

describe("W6c — GD05-125 Ra Cailum (Base)", () => {
  it("【Activate･Main】: descansa a Base; a Unit (Londo Bell) escolhida reduz em 1 todo dano inimigo neste turno", () => {
    let state = game();
    const base = placeCard(state, "A", G["GD05-125"], "baseSection");
    const lb = placeCard(state, "A", UNIT({ hp: 9, traits: ["Londo Bell"] }), "battleArea");
    const other = placeCard(state, "A", UNIT({ hp: 9 }), "battleArea");
    const offers = legal(state, "A").flatMap((a) => (a.kind === "activateAbility" && a.sourceInstanceId === base ? [a.targets ?? {}] : []));
    expect(offers).toEqual([{ target: [lb] }]);
    expect(() => act(state, "A", { kind: "activateAbility", sourceInstanceId: base, targets: { target: [other] } })).toThrow(/Alvo inválido/);
    state = act(state, "A", { kind: "activateAbility", sourceInstanceId: base, targets: { target: [lb] } });
    expect(findCard(state, base).rested).toBe(true);
    // 2 danos inimigos de efeito no mesmo turno: os dois reduzidos; a outra Unit não
    let s = enemyEffectHit(state, lb, 3);
    expect(dmg(s, lb)).toBe(2);
    s = enemyEffectHit(s, lb, 3);
    expect(dmg(s, lb)).toBe(4);
    s = enemyEffectHit(s, other, 3);
    expect(dmg(s, other)).toBe(3);
  });

  it("【Activate･Main】: sem Unit (Londo Bell) ou com a Base descansada, não é ofertada", () => {
    const state = game();
    const base = placeCard(state, "A", G["GD05-125"], "baseSection");
    placeCard(state, "A", UNIT({ traits: ["Earth Federation"] }), "battleArea");
    const offered = (s: GameState, id: string) => legal(s, "A").some((a) => a.kind === "activateAbility" && a.sourceInstanceId === id);
    expect(offered(state, base)).toBe(false);
    const rested = game();
    const restedBase = placeCard(rested, "A", G["GD05-125"], "baseSection", { rested: true });
    placeCard(rested, "A", UNIT({ traits: ["Londo Bell"] }), "battleArea");
    expect(offered(rested, restedBase)).toBe(false);
  });
});

function pair(state: GameState, unitId: string, pilotId: string): void {
  findCard(state, unitId).pairedPilotId = pilotId;
  findCard(state, pilotId).pairedUnitId = unitId;
}

describe("W6 (integração) — GD05-109 e GD05-110", () => {
  it("109 【Action】: Unit (Academy) recupera 2 HP; pareada com Piloto Lv.3- compra 1, Lv.4 não", () => {
    for (const [pilotLevel, draws] of [
      [3, 1],
      [4, 0],
    ] as const) {
      const base = game();
      const academy = placeCard(base, "A", UNIT({ traits: ["Academy"], hp: 5 }), "battleArea", { damage: 3 });
      pair(base, academy, placeCard(base, "A", PILOT({ level: pilotLevel }), "battleArea"));
      placeCard(base, "A", UNIT({ traits: ["ZAFT"] }), "battleArea", { damage: 1 });
      const { state, card } = actionStep(base, G["GD05-109"]);
      expect(cmdOffers(state, card)).toEqual([{ target: [academy] }]);
      const hand = state.players.A.hand.length;
      const s = play(state, card, { target: [academy] }, { trigger: "Action" });
      expect(findCard(s, academy).damage).toBe(1);
      expect(s.players.A.hand.length).toBe(hand - 1 + draws);
    }
  });

  it("110 【Main】: 2 de dano na Unit inimiga; compra 1 só com Unit \"Master Gundam\" sua em jogo", () => {
    for (const withMaster of [true, false]) {
      const state = game();
      if (withMaster) placeCard(state, "A", UNIT({ nameEn: "Master Gundam" }), "battleArea");
      const enemy = placeCard(state, "B", UNIT({ hp: 5 }), "battleArea");
      placeCard(state, "B", UNIT({ nameEn: "Master Gundam", hp: 5 }), "battleArea"); // do inimigo: não conta
      const { card } = inHand(state, G["GD05-110"]);
      const hand = state.players.A.hand.length;
      const s = play(state, card, { target: [enemy] });
      expect(dmg(s, enemy)).toBe(2);
      expect(s.players.A.hand.length).toBe(hand - 1 + (withMaster ? 1 : 0));
    }
  });

  it("110 【Burst】 ativa o 【Main】 (Shield destruído no ataque real)", () => {
    const state = game();
    let { state: s } = burstPending(state, G["GD05-110"]);
    const attacker = s.combat?.attackerId ?? s.players.A.battleArea[0].instanceId;
    s = act(s, "B", { kind: "resolveBurstDecision", activate: true, targets: { target: [attacker] } });
    expect(dmg(s, attacker)).toBe(2);
  });
});
