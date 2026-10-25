import { describe, expect, it } from "vitest";
import { createGame } from "./setup";
import type { CardDef, GameState, PlayerId } from "./types";
import { advanceToMainPhase } from "./phases";
import { applyPlayerAction, type PlayerAction } from "./actions";
import { actionOwner, enumerateLegalActions } from "./legalActions";
import { checkLegalMenu, legalMenuFor } from "./legalMenu";
import { isHiddenCard, viewStateFor } from "./viewState";
import { createRng } from "./rng";
import { placeCard } from "./__testkit__/cardHarness";
import { DECK_BUILDERS, GOLDEN_PAIRS } from "./__golden__/harness";
import { buildSt07DeckList } from "../fixtures/st07Deck";
import { buildSt08DeckList } from "../fixtures/st08Deck";
import { ST06_CARD_DEFS } from "../fixtures/st06Deck";
import { ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver } from "../content";
import { ST13_CARD_DEFS } from "../content/st13/index";
import { GD01_CARD_DEFS } from "../content/gd01/index";
import { findCard } from "./events";

const opts = { predicateResolver: defaultPredicateResolver, targetFilterResolver: defaultTargetFilterResolver };
const apply = (s: GameState, p: PlayerId, a: PlayerAction) =>
  applyPlayerAction(s, p, a, ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver);

/** estados de partidas aleatórias (fora de decisão pendente), do jeito que a tela os recebe */
function* sampledStates(pairs: typeof GOLDEN_PAIRS, maxSteps: number): Generator<{ key: string; step: number; state: GameState; seat: PlayerId }> {
  for (const pair of pairs) {
    let state = createGame(DECK_BUILDERS[pair.a](), DECK_BUILDERS[pair.b](), { seed: pair.seed, firstPlayer: "A", interactiveMulligan: true });
    const rng = createRng(pair.seed * 7919);
    for (let step = 0; step < maxSteps && !state.gameOver; step++) {
      const seat = actionOwner(state);
      if (!seat) break;
      const legal = enumerateLegalActions(state, seat, ALL_EFFECT_SPECS, opts);
      if (legal.length === 0) break;
      if (!state.pendingDecision[seat]) yield { key: pair.key, step, state, seat };
      state = apply(state, seat, legal[Math.floor(rng() * legal.length)]);
    }
  }
}

describe("legalMenuFor — diferencial com enumerateLegalActions", () => {
  it("toda jogada legal está no menu, e toda jogada montável pelo menu o motor aceita (todos os pares do golden)", () => {
    const divergences: string[] = [];
    let states = 0;
    for (const { key, step, state, seat } of sampledStates(GOLDEN_PAIRS, 160)) {
      states++;
      const problem = checkLegalMenu(state, seat, ALL_EFFECT_SPECS, opts);
      if (problem) divergences.push(`${key}#${step} ${problem}`);
    }
    expect(states).toBeGreaterThan(3000);
    expect(divergences.slice(0, 10)).toEqual([]);
  }, 120_000);
});

describe("legalMenuFor — informação oculta", () => {
  it("todo id do menu é de carta que o jogador vê (nada de mão/deck/escudo escondido)", () => {
    const leaks: string[] = [];
    for (const { key, step, state, seat } of sampledStates(GOLDEN_PAIRS.slice(0, 12), 120)) {
      const menu = legalMenuFor(state, seat, ALL_EFFECT_SPECS, opts);
      const view = viewStateFor(state, seat);
      const visible = new Set(
        Object.values(view.players).flatMap((p) =>
          (["hand", "battleArea", "baseSection", "resourceArea", "trash", "exile"] as const).flatMap((z) => p[z].filter((c) => !isHiddenCard(c)).map((c) => c.instanceId)),
        ),
      );
      const ids = menu.entries.flatMap((e) => {
        switch (e.kind) {
          case "deployCard":
            return [e.cardInstanceId, ...e.pairWithUnitIds];
          case "playCommand":
            return [e.cardInstanceId, ...e.slots.flatMap((sl) => sl.legalTargets), ...(e.altCostDiscardId ? [e.altCostDiscardId] : [])];
          case "activateAbility":
            return [e.sourceInstanceId, ...e.slots.flatMap((sl) => sl.legalTargets)];
          case "declareAttack":
            return [e.attackerId, ...e.targets.flatMap((t) => (t === "player" ? [] : [t.unitId]))];
          case "activateBlocker":
            return [e.blockerId];
        }
      });
      for (const id of ids) if (!visible.has(id)) leaks.push(`${key}#${step} ${id}`);
    }
    expect(leaks.slice(0, 10)).toEqual([]);
  }, 120_000);
});

describe("legalMenuFor — casos que já quebraram na tela", () => {
  const UNIT = (extra: Partial<CardDef> = {}): CardDef => ({
    code: "TEST-UNIT",
    nameEn: "Test Unit",
    cardType: "UNIT",
    color: "white",
    level: 3,
    cost: 2,
    ap: 3,
    hp: 5,
    traits: [],
    ...extra,
  });
  const RESOURCE: CardDef = { code: "TEST-RES", nameEn: "Resource", cardType: "RESOURCE", color: "white", level: 0, cost: 0, ap: 0, hp: 0 };
  function game(): GameState {
    const s = advanceToMainPhase(createGame(buildSt07DeckList(), buildSt08DeckList(), { seed: 5, firstPlayer: "A" }));
    for (const p of ["A", "B"] as const) {
      s.players[p].battleArea = [];
      s.players[p].baseSection = [];
      s.players[p].hand = [];
      s.players[p].resourceArea = [];
      for (let i = 0; i < 8; i++) placeCard(s, p, RESOURCE, "resourceArea");
    }
    return s;
  }

  it("decisão pendente: menu inativo (as opções vêm na própria decisão)", () => {
    const s = game();
    s.pendingDecision.A = { kind: "mulligan" } as GameState["pendingDecision"]["A"];
    expect(legalMenuFor(s, "A", ALL_EFFECT_SPECS, opts)).toEqual({ active: false, entries: [], passes: [] });
  });

  it("vez do oponente: menu inativo", () => {
    const s = game();
    expect(legalMenuFor(s, "B", ALL_EFFECT_SPECS, opts).active).toBe(false);
  });

  it("ST06-014 Clan Battle na Main Phase: entrada de 【Activate·Main】; \"Rest this Base：\" se paga antes do alvo", () => {
    const s = game();
    const base = placeCard(s, "A", ST06_CARD_DEFS["ST06-014"], "baseSection");
    const unit = placeCard(s, "A", UNIT(), "battleArea");
    const entry = legalMenuFor(s, "A", ALL_EFFECT_SPECS, opts).entries.find((e) => e.kind === "activateAbility" && e.sourceInstanceId === base);
    // o alvo não é pré-escolhido: ativar descansa a Base (custo) e só então pede o alvo
    expect(entry).toMatchObject({ trigger: "Activate·Main", slots: [] });
    // sem (Clan) Link Unit a condição falha: o custo foi pago (Base descansada) e o efeito não faz nada
    const activated = apply(s, "A", { kind: "activateAbility", sourceInstanceId: base });
    expect(findCard(activated, base).rested).toBe(true);
    expect(activated.pendingDecision.A).toBeNull();
    expect(findCard(activated, unit).statModifiers).toEqual([]);
  });

  it("GD01-002 Unicorn (Destroy Mode): sacrificar a Link Unit (Unicorn Mode) Lv.5 aparece no menu mesmo sem recurso", () => {
    const s = game();
    for (const r of s.players.A.resourceArea) r.rested = true;
    const destroy = placeCard(s, "A", GD01_CARD_DEFS["GD01-002"], "hand");
    const unicorn = placeCard(s, "A", UNIT({ code: "TEST-UNICORN", nameEn: "Unicorn Gundam (Unicorn Mode)", level: 5, link: { kind: "pilotName", values: ["Banagher"] } }), "battleArea");
    const banagher = placeCard(s, "A", { ...UNIT({ code: "TEST-BANAGHER", nameEn: "Banagher Links" }), cardType: "PILOT" }, "battleArea");
    findCard(s, unicorn).pairedPilotId = banagher;
    findCard(s, banagher).pairedUnitId = unicorn;
    placeCard(s, "A", UNIT({ code: "TEST-OTHER", nameEn: "Unicorn Gundam (Unicorn Mode)", level: 5 }), "battleArea"); // sem Link: não serve
    const entry = legalMenuFor(s, "A", ALL_EFFECT_SPECS, opts).entries.find((e) => e.kind === "deployCard" && e.cardInstanceId === destroy);
    expect(entry).toMatchObject({ standalone: false, pairWithUnitIds: [], sacrificeIds: [unicorn] });
    const after = apply(s, "A", { kind: "deployCard", cardInstanceId: destroy, sacrificeInstanceId: unicorn });
    expect(after.players.A.battleArea.some((c) => c.instanceId === destroy)).toBe(true);
    expect(after.players.A.battleArea.some((c) => c.instanceId === unicorn)).toBe(false);
  });

  it("ST13-006 Aerial: 【Activate･Action】 aparece no Action Step, não na Main Phase", () => {
    let s = game();
    const aerial = placeCard(s, "A", ST13_CARD_DEFS["ST13-006"], "battleArea");
    placeCard(s, "A", UNIT({ code: "TEST-COST" }), "battleArea");
    const enemy = placeCard(s, "B", UNIT({ code: "TEST-ENEMY", level: 3 }), "battleArea", { rested: true });
    const atMain = legalMenuFor(s, "A", ALL_EFFECT_SPECS, opts).entries.filter((e) => e.kind === "activateAbility" && e.sourceInstanceId === aerial);
    expect(atMain).toEqual([]);
    s = apply(s, "A", { kind: "declareAttack", attackerId: aerial, target: { unitId: enemy } });
    while (s.combat && s.combat.step !== "action") s = apply(s, actionOwner(s)!, { kind: "skipBlock" });
    const owner = actionOwner(s)!;
    if (owner !== "A") s = apply(s, owner, { kind: "passAction" });
    const atAction = legalMenuFor(s, "A", ALL_EFFECT_SPECS, opts).entries.find((e) => e.kind === "activateAbility" && e.sourceInstanceId === aerial);
    expect(atAction).toMatchObject({ trigger: "Activate·Action" });
  });
});
