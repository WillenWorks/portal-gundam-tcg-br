import { describe, expect, it } from "vitest";
import { createGame } from "./setup";
import { advanceToMainPhase } from "./phases";
import { deployCard } from "./deploy";
import type { CardDef, CardInstance, GameState, PlayerId, Zone } from "./types";
import { hasKeyword } from "./types";
import { findCard } from "./events";
import { buildSt06DeckList, GQUUUUUUX_OMEGA_PSYCOMMU, AMATE_YUZURIHA, GAIAS_RICK_DOM } from "../fixtures/st06Deck";
import { ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver } from "../content";

/**
 * E1 (revisão semântica GD02/GD03) — o 【When Linked】 da UNIT nunca disparava: o `deploy.ts`
 * só despachava "When Linked" com o Pilot como fonte. ST06-001 GQuuuuuuX (starter!) —
 * "【When Linked】If another friendly (Clan) Unit is in play, this gains <First Strike>".
 */

let seq = 0;
function place(state: GameState, player: PlayerId, def: CardDef, zone: Zone, opts: Partial<CardInstance> = {}): string {
  const instanceId = `${player}-wl-${seq++}`;
  state.players[player][zone].push({
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
  });
  return instanceId;
}

describe("【When Linked】 de Unit", () => {
  it("ST06-001: parear o Piloto do link dispara o 【When Linked】 da própria Unit", () => {
    const state = advanceToMainPhase(createGame(buildSt06DeckList(), buildSt06DeckList(), { seed: 3, firstPlayer: "A" }));
    const gqId = place(state, "A", GQUUUUUUX_OMEGA_PSYCOMMU, "battleArea");
    place(state, "A", GAIAS_RICK_DOM, "battleArea"); // "another friendly (Clan) Unit"
    const amateId = place(state, "A", AMATE_YUZURIHA, "hand");
    for (let i = 0; i < 6; i++) place(state, "A", { code: "R", nameEn: "Resource", cardType: "RESOURCE", color: "colorless" }, "resourceArea");

    const next = deployCard(state, "A", amateId, {
      pairWithUnitId: gqId,
      specs: ALL_EFFECT_SPECS,
      predicateResolver: defaultPredicateResolver,
      targetFilterResolver: defaultTargetFilterResolver,
    });

    // o da Unit (automático) resolve na hora; o do Piloto (olhar o topo, escolha) fica na fila — os DOIS disparam
    expect(hasKeyword(findCard(next, gqId), "First Strike", next)).toBe(true);
    const pending = next.pendingDecision.A;
    expect(pending?.kind === "abilityResolution" && pending.queue.map((q) => q.specId)).toEqual(["ST06-009-WhenLinked"]);
  });
});

describe("E7 — collectDestroyed", () => {
  it("Base que sai da Base Section pro trash entra na lista (o 【Destroyed】 dela podia disparar e nunca disparava)", async () => {
    const { collectDestroyed } = await import("./abilityDispatch");
    const before = advanceToMainPhase(createGame(buildSt06DeckList(), buildSt06DeckList(), { seed: 3, firstPlayer: "A" }));
    const baseId = place(before, "A", { code: "GD02-126", nameEn: "Base", cardType: "BASE", color: "red", hp: 4 }, "baseSection");
    const after = structuredClone(before);
    const base = after.players.A.baseSection.splice(0, after.players.A.baseSection.length).find((c) => c.instanceId === baseId);
    if (!base) throw new Error("setup");
    base.zone = "trash";
    after.players.A.trash.push(base);
    expect(collectDestroyed(before, after).map((d) => d.instanceId)).toContain(baseId);
  });

  it("Pilot destruído pareado conta como pareado (wasPaired/wasLinkUnit pelo pairedUnitId)", async () => {
    const { collectDestroyed } = await import("./abilityDispatch");
    const before = advanceToMainPhase(createGame(buildSt06DeckList(), buildSt06DeckList(), { seed: 3, firstPlayer: "A" }));
    const unitId = place(before, "A", GQUUUUUUX_OMEGA_PSYCOMMU, "battleArea");
    const pilotId = place(before, "A", AMATE_YUZURIHA, "battleArea", { pairedUnitId: unitId });
    findCard(before, unitId).pairedPilotId = pilotId;
    const after = structuredClone(before);
    const idx = after.players.A.battleArea.findIndex((c) => c.instanceId === pilotId);
    const [pilot] = after.players.A.battleArea.splice(idx, 1);
    pilot.zone = "trash";
    after.players.A.trash.push(pilot);
    const d = collectDestroyed(before, after).find((x) => x.instanceId === pilotId);
    expect(d?.wasPaired).toBe(true);
    expect(d?.wasLinkUnit).toBe(true);
  });
});

describe("E8 — estático de Base", () => {
  it("staticAbilities de uma Base na Base Section valem (antes só a Battle Area era lida)", async () => {
    const { effectiveAp } = await import("./types");
    const state = advanceToMainPhase(createGame(buildSt06DeckList(), buildSt06DeckList(), { seed: 3, firstPlayer: "A" }));
    const unitId = place(state, "A", GAIAS_RICK_DOM, "battleArea");
    const apBefore = effectiveAp(findCard(state, unitId), state);
    place(state, "A", {
      code: "X-BASE", nameEn: "Base de teste", cardType: "BASE", color: "red", hp: 5,
      staticAbilities: [{ condition: "always", scope: "allFriendlyUnits", stat: "ap", amount: 1 }],
    }, "baseSection");
    expect(effectiveAp(findCard(state, unitId), state)).toBe(apBefore + 1);
  });
});

describe("E9 — 【During Pair】/【During Link】 em gatilho que não é 【Destroyed】", () => {
  it("spec com duringPair não dispara com a Unit sem Piloto, dispara pareada", async () => {
    const { dispatchTrigger } = await import("./dispatcher");
    const state = advanceToMainPhase(createGame(buildSt06DeckList(), buildSt06DeckList(), { seed: 3, firstPlayer: "A" }));
    const unitDef: CardDef = { ...GAIAS_RICK_DOM, code: "X-PAIR" };
    const unitId = place(state, "A", unitDef, "battleArea");
    const spec = { id: "X-PAIR-Attack", cardCode: "X-PAIR", trigger: "Attack", duringPair: true, actions: [{ op: "draw" as const, player: "controller" as const, n: 1 }], sourceText: "【During Pair】【Attack】Draw 1." };
    const hand = state.players.A.hand.length;
    expect(dispatchTrigger(state, unitId, "Attack", [spec]).players.A.hand.length).toBe(hand);
    const pilotId = place(state, "A", AMATE_YUZURIHA, "battleArea", { pairedUnitId: unitId });
    findCard(state, unitId).pairedPilotId = pilotId;
    expect(dispatchTrigger(state, unitId, "Attack", [spec]).players.A.hand.length).toBe(hand + 1);
  });
});

describe("E10 — Command jogada como Pilot conta como '(X) Pilot in play'", () => {
  it("controllerHasPilotWithTrait enxerga a Command com asPilot", async () => {
    const { defaultPredicateResolver: resolve } = await import("../content");
    const state = advanceToMainPhase(createGame(buildSt06DeckList(), buildSt06DeckList(), { seed: 3, firstPlayer: "A" }));
    const ctx = { state, controller: "A" as const, sourceInstanceId: undefined, turnNumber: state.turnNumber, targets: {} };
    expect(resolve("controllerHasPilotWithTrait:CB", ctx as never)).toBe(false);
    place(state, "A", { code: "X-CMD", nameEn: "Cmd", cardType: "COMMAND", color: "green", traits: ["CB"], pilotMode: { pilotName: "X", ap: 1, hp: 0 } }, "battleArea", { asPilot: true });
    expect(resolve("controllerHasPilotWithTrait:CB", ctx as never)).toBe(true);
  });
});

describe("E12 — 'another Unit' com fonte Pilot", () => {
  it("a Unit pareada com o Pilot-fonte não conta como 'outra'", async () => {
    const { isBoardConditionMet } = await import("./types");
    const state = advanceToMainPhase(createGame(buildSt06DeckList(), buildSt06DeckList(), { seed: 3, firstPlayer: "A" }));
    const unitId = place(state, "A", GAIAS_RICK_DOM, "battleArea"); // (Clan)
    const pilotId = place(state, "A", AMATE_YUZURIHA, "battleArea", { pairedUnitId: unitId });
    findCard(state, unitId).pairedPilotId = pilotId;
    const cond = { kind: "friendlyOtherUnitTraitCountAtLeast" as const, trait: "Clan", n: 1 };
    expect(isBoardConditionMet(state, "A", cond, pilotId)).toBe(false);
    place(state, "A", GAIAS_RICK_DOM, "battleArea");
    expect(isBoardConditionMet(state, "A", cond, pilotId)).toBe(true);
  });
});

describe("E5 — descarte depois de compra dentro de condition.then", () => {
  it("as cartas compradas no 'then' entram como candidatas ao descarte", async () => {
    const { discardCandidateHandIds } = await import("./effectSpec");
    const state = advanceToMainPhase(createGame(buildSt06DeckList(), buildSt06DeckList(), { seed: 3, firstPlayer: "A" }));
    const spec = {
      id: "X-DRAW",
      cardCode: "X-DRAW",
      trigger: "Deploy",
      condition: {
        predicate: "always",
        then: [
          { op: "draw" as const, player: "controller" as const, n: 2 },
          { op: "discardNamed" as const, player: "controller" as const, name: "discard", n: 1 },
        ],
      },
      actions: [],
      sourceText: "x",
    };
    const top2 = state.players.A.deck.slice(0, 2).map((c) => c.instanceId);
    // `specActiveCalls` devolve actions + ramo; aqui actions é vazio
    const ids = discardCandidateHandIds(spec, state, "A", undefined, [...spec.actions, ...spec.condition.then]);
    expect(ids).toEqual(expect.arrayContaining(top2));
  });
});

describe("E6 — pareamento feito por efeito dispara 【When Paired】/【When Linked】", () => {
  it("PAIR_CARDS vindo de efeito despacha o 【When Paired】 da Unit", async () => {
    const { dispatchPairingTriggersFromEffect } = await import("./abilityDispatch");
    const before = advanceToMainPhase(createGame(buildSt06DeckList(), buildSt06DeckList(), { seed: 3, firstPlayer: "A" }));
    const unitDef: CardDef = { ...GAIAS_RICK_DOM, code: "X-WP" };
    const unitId = place(before, "A", unitDef, "battleArea");
    const pilotId = place(before, "A", AMATE_YUZURIHA, "battleArea");
    const after = structuredClone(before);
    findCard(after, unitId).pairedPilotId = pilotId;
    findCard(after, pilotId).pairedUnitId = unitId;
    const spec = { id: "X-WP-WhenPaired", cardCode: "X-WP", trigger: "When Paired", actions: [{ op: "draw" as const, player: "controller" as const, n: 1 }], sourceText: "【When Paired】Draw 1." };
    const hand = after.players.A.hand.length;
    const next = dispatchPairingTriggersFromEffect(before, after, [spec]);
    expect(next.players.A.hand.length).toBe(hand + 1);
  });
});

describe("E7 — Base substituída não é 'destruída' (CR 11-5-2-1)", () => {
  it("a Base antiga que sai porque entrou outra no lugar não entra em collectDestroyed", async () => {
    const { collectDestroyed } = await import("./abilityDispatch");
    const before = advanceToMainPhase(createGame(buildSt06DeckList(), buildSt06DeckList(), { seed: 3, firstPlayer: "A" }));
    before.players.A.baseSection.splice(0);
    const oldId = place(before, "A", { code: "X-OLD", nameEn: "Old", cardType: "BASE", color: "red", hp: 4 }, "baseSection");
    const after = structuredClone(before);
    const [old] = after.players.A.baseSection.splice(0, 1);
    old.zone = "trash";
    after.players.A.trash.push(old);
    place(after, "A", { code: "X-NEW", nameEn: "New", cardType: "BASE", color: "red", hp: 4 }, "baseSection");
    expect(collectDestroyed(before, after).map((d) => d.instanceId)).not.toContain(oldId);
  });
});

describe("【When Linked】 não se perde quando o 【When Paired】 do mesmo pareamento pausa", () => {
  it("When Paired opcional do Piloto pausa → ao resolver, o When Linked da Unit dispara", async () => {
    const { applyPlayerAction } = await import("./actions");
    const state = advanceToMainPhase(createGame(buildSt06DeckList(), buildSt06DeckList(), { seed: 3, firstPlayer: "A" }));
    const unitDef: CardDef = { ...GQUUUUUUX_OMEGA_PSYCOMMU, code: "X-U" };
    const pilotDef: CardDef = { ...AMATE_YUZURIHA, code: "X-P" };
    const unitId = place(state, "A", unitDef, "battleArea");
    const pilotId = place(state, "A", pilotDef, "hand");
    for (let i = 0; i < 6; i++) place(state, "A", { code: "R", nameEn: "Resource", cardType: "RESOURCE", color: "colorless" }, "resourceArea");
    const specs = [
      { id: "X-P-WhenPaired", cardCode: "X-P", trigger: "When Paired", optional: true, actions: [{ op: "draw" as const, player: "controller" as const, n: 1 }], sourceText: "【When Paired】You may draw 1." },
      { id: "X-U-WhenLinked", cardCode: "X-U", trigger: "When Linked", actions: [{ op: "draw" as const, player: "controller" as const, n: 2 }], sourceText: "【When Linked】Draw 2." },
    ];
    const paused = deployCard(state, "A", pilotId, { pairWithUnitId: unitId, specs });
    const pending = paused.pendingDecision.A;
    expect(pending?.kind).toBe("abilityResolution");
    const hand = paused.players.A.hand.length;
    const next = applyPlayerAction(paused, "A", { kind: "resolveAbility", resolutions: [{ specId: "X-P-WhenPaired", activate: false, targetIds: [] }] }, specs);
    expect(next.players.A.hand.length).toBe(hand + 2); // o When Linked da Unit disparou depois
  });
});

describe("condições de tabuleiro novas (GD02 lote 2)", () => {
  async function setup() {
    const { isBoardConditionMet } = await import("./types");
    const state = advanceToMainPhase(createGame(buildSt06DeckList(), buildSt06DeckList(), { seed: 3, firstPlayer: "A" }));
    return { isBoardConditionMet, state };
  }

  it("controllerLevelAtLeast = quantidade de Resources", async () => {
    const { isBoardConditionMet, state } = await setup();
    const lv = state.players.A.resourceArea.length;
    expect(isBoardConditionMet(state, "A", { kind: "controllerLevelAtLeast", n: lv })).toBe(true);
    expect(isBoardConditionMet(state, "A", { kind: "controllerLevelAtLeast", n: lv + 1 })).toBe(false);
  });

  it("pairedPilotColorIs olha a cor do Piloto pareado com a fonte", async () => {
    const { isBoardConditionMet, state } = await setup();
    const unitId = place(state, "A", GQUUUUUUX_OMEGA_PSYCOMMU, "battleArea");
    expect(isBoardConditionMet(state, "A", { kind: "pairedPilotColorIs", color: "red" }, unitId)).toBe(false);
    const pilotId = place(state, "A", AMATE_YUZURIHA, "battleArea", { pairedUnitId: unitId }); // vermelho
    findCard(state, unitId).pairedPilotId = pilotId;
    expect(isBoardConditionMet(state, "A", { kind: "pairedPilotColorIs", color: "red" }, unitId)).toBe(true);
  });

  it("friendlyOtherLinkUnitTraitCountAtLeast só conta OUTRA Link Unit com o trait", async () => {
    const { isBoardConditionMet, state } = await setup();
    const cond = { kind: "friendlyOtherLinkUnitTraitCountAtLeast" as const, trait: "Clan", n: 1 };
    const sourceId = place(state, "A", GAIAS_RICK_DOM, "battleArea");
    const gqId = place(state, "A", GQUUUUUUX_OMEGA_PSYCOMMU, "battleArea");
    expect(isBoardConditionMet(state, "A", cond, sourceId)).toBe(false); // GQ não está linkada
    const pilotId = place(state, "A", AMATE_YUZURIHA, "battleArea", { pairedUnitId: gqId });
    findCard(state, gqId).pairedPilotId = pilotId;
    expect(isBoardConditionMet(state, "A", cond, sourceId)).toBe(true);
  });

  it("friendlyOtherUnitWithKeywordCountAtLeast conta outra Unit com a keyword", async () => {
    const { isBoardConditionMet, state } = await setup();
    const cond = { kind: "friendlyOtherUnitWithKeywordCountAtLeast" as const, keyword: "Blocker", n: 1 };
    const sourceId = place(state, "A", GAIAS_RICK_DOM, "battleArea");
    expect(isBoardConditionMet(state, "A", cond, sourceId)).toBe(false);
    place(state, "A", { ...GAIAS_RICK_DOM, code: "X-BLK", effectKeywords: ["Blocker"], keywordTags: ["Blocker"] }, "battleArea");
    expect(isBoardConditionMet(state, "A", cond, sourceId)).toBe(true);
  });
});
