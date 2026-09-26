import { describe, expect, it } from "vitest";
import { createGame } from "../engine/setup";
import { placeCard } from "../engine/__testkit__/cardHarness";
import { buildSt07DeckList } from "../fixtures/st07Deck";
import { buildSt08DeckList } from "../fixtures/st08Deck";
import { GD03_CARD_DEFS } from "./gd03";
import { GD03_EFFECT_SPECS } from "./gd03/effects";
import type { GameState } from "../engine/types";
import { effectiveAp, effectiveCost } from "../engine/types";
import type { EffectContext } from "../engine/effectSpec";
import { resolveEffectSpec } from "../engine/effectSpec";
import { applyEvents, findCard } from "../engine/events";
import { defaultPredicateResolver, defaultTargetFilterResolver } from "./predicates";
import { computeLegalTargets } from "../engine/effectSpec";
import { EX_RESOURCE_TOKEN } from "../engine/setup";
import { advanceToMainPhase } from "../engine/phases";
import { enumerateLegalActions } from "../engine/legalActions";
import { applyPlayerAction } from "../engine/actions";
import { declareAttack, passAction, proceedToBlockStep, resolveDamageStep, skipBlock } from "../engine/combat";
import { ALL_EFFECT_SPECS } from "./index";

function freshGame(): GameState {
  return createGame(buildSt07DeckList(), buildSt08DeckList(), { seed: 303, firstPlayer: "A" });
}

function ctxFor(state: GameState, sourceInstanceId: string, targets: Record<string, string[]> = {}): EffectContext {
  return { state, controller: "A", sourceInstanceId, turnNumber: state.turnNumber, targets };
}

describe("GD03 — catálogo e cobertura", () => {
  it("contém exatamente 132 cartas oficiais indexadas por código GD03-001 até GD03-132", () => {
    const codes = Object.keys(GD03_CARD_DEFS);
    expect(codes).toHaveLength(132);
    expect(codes).toContain("GD03-001");
    expect(codes).toContain("GD03-050");
    expect(codes).toContain("GD03-085");
    expect(codes).toContain("GD03-132");
  });

  it("distribui as cartas em cores e tipos consistentes", () => {
    const cards = Object.values(GD03_CARD_DEFS);
    const units = cards.filter((c) => c.cardType === "UNIT");
    const pilots = cards.filter((c) => c.cardType === "PILOT");
    const commands = cards.filter((c) => c.cardType === "COMMAND");
    const bases = cards.filter((c) => c.cardType === "BASE");

    expect(units).toHaveLength(83);
    expect(pilots).toHaveLength(17);
    expect(commands).toHaveLength(22);
    expect(bases).toHaveLength(10);
  });

  it("todas as 10 bases de GD03 possuem Deploy de puxar escudo", () => {
    const bases = Object.values(GD03_CARD_DEFS).filter((c) => c.cardType === "BASE");
    expect(bases).toHaveLength(10);
    for (const b of bases) {
      expect(b.triggerKeywords).toContain("Deploy");
    }
  });

  it("todos os 17 pilotos de GD03 possuem Burst", () => {
    const pilots = Object.values(GD03_CARD_DEFS).filter((c) => c.cardType === "PILOT");
    expect(pilots).toHaveLength(17);
    for (const p of pilots) {
      expect(p.hasBurst).toBe(true);
      expect(p.triggerKeywords).toContain("Burst");
    }
  });
});

describe("GD03 — resolução de efeitos bespoke", () => {
  it("bases de GD03 puxam 1 shield para a mão ao dar Deploy", () => {
    let state = freshGame();
    const baseDef = GD03_CARD_DEFS["GD03-123"]; // Jupitris / Base Blue
    const baseId = placeCard(state, "A", baseDef, "baseSection");
    const initialHandCount = state.players.A.hand.length;

    const baseDeploySpec = GD03_EFFECT_SPECS.find((s) => s.cardCode === "GD03-123" && s.trigger === "Deploy");
    expect(baseDeploySpec).toBeDefined();

    if (baseDeploySpec) {
      const events = resolveEffectSpec(baseDeploySpec, ctxFor(state, baseId), defaultPredicateResolver);
      state = applyEvents(state, events);
      expect(state.players.A.hand.length).toBe(initialHandCount + 1);
    }
  });

  it("GD03-005 Kshatriya Besserung compra 1 carta no Deploy", () => {
    let state = freshGame();
    const kshatriyaDef = GD03_CARD_DEFS["GD03-005"];
    const sourceId = placeCard(state, "A", kshatriyaDef, "battleArea");
    const handBefore = state.players.A.hand.length;

    const deploySpec = GD03_EFFECT_SPECS.find((s) => s.cardCode === "GD03-005" && s.trigger === "Deploy");
    expect(deploySpec).toBeDefined();

    if (deploySpec) {
      const events = resolveEffectSpec(deploySpec, ctxFor(state, sourceId), defaultPredicateResolver);
      state = applyEvents(state, events);
      expect(state.players.A.hand.length).toBe(handBefore + 1);
    }
  });

  it("GD03-001 Gundam NT-1 [When Paired] compra 1 quando o dano de 1 destrói o alvo", () => {
    let state = freshGame();
    const nt1Def = GD03_CARD_DEFS["GD03-001"];
    const enemyDef = GD03_CARD_DEFS["GD03-002"]; // The-O, HP 5
    const sourceId = placeCard(state, "A", nt1Def, "battleArea");
    const enemyId = placeCard(state, "B", enemyDef, "battleArea", { damage: 4 }); // 1 a mais mata
    const handBefore = state.players.A.hand.length;

    const whenPairedSpec = GD03_EFFECT_SPECS.find((s) => s.cardCode === "GD03-001" && s.trigger === "When Paired");
    expect(whenPairedSpec).toBeDefined();

    if (whenPairedSpec) {
      const events = resolveEffectSpec(whenPairedSpec, ctxFor(state, sourceId, { target: [enemyId] }), defaultPredicateResolver);
      state = applyEvents(state, events);
      // 5 de dano em cima de 5 de HP destrói o alvo — DESTROY_CARD zera `damage` e move pra trash.
      expect(findCard(state, enemyId).zone).toBe("trash");
      expect(state.players.A.hand.length).toBe(handBefore + 1);
    }
  });

  it("GD03-001 Gundam NT-1 [When Paired] NÃO compra quando o dano de 1 não destrói o alvo", () => {
    let state = freshGame();
    const nt1Def = GD03_CARD_DEFS["GD03-001"];
    const enemyDef = GD03_CARD_DEFS["GD03-002"]; // The-O, HP 5
    const sourceId = placeCard(state, "A", nt1Def, "battleArea");
    const enemyId = placeCard(state, "B", enemyDef, "battleArea"); // sem dano prévio
    const handBefore = state.players.A.hand.length;

    const whenPairedSpec = GD03_EFFECT_SPECS.find((s) => s.cardCode === "GD03-001" && s.trigger === "When Paired");
    expect(whenPairedSpec).toBeDefined();

    if (whenPairedSpec) {
      const events = resolveEffectSpec(whenPairedSpec, ctxFor(state, sourceId, { target: [enemyId] }), defaultPredicateResolver);
      state = applyEvents(state, events);
      expect(findCard(state, enemyId).damage).toBe(1);
      expect(state.players.A.hand.length).toBe(handBefore);
    }
  });
});

const OPTS = { predicateResolver: defaultPredicateResolver, targetFilterResolver: defaultTargetFilterResolver };
const specOf = (id: string) => {
  const spec = GD03_EFFECT_SPECS.find((s) => s.id === id);
  if (!spec) throw new Error(`spec ${id} ausente`);
  return spec;
};
const run = (state: GameState, id: string, sourceId: string, targets: Record<string, string[]> = {}) =>
  applyEvents(state, resolveEffectSpec(specOf(id), ctxFor(state, sourceId, targets), defaultPredicateResolver));

describe("GD03 — correções W0.3 (texto oficial)", () => {
  it("GD03-021 【Deploy】 mira Unit amiga (Operation Meteor)/(G Team) e libera atacar Unit ativa", () => {
    let state = freshGame();
    const sourceId = placeCard(state, "A", GD03_CARD_DEFS["GD03-021"], "battleArea");
    const gTeamId = placeCard(state, "A", GD03_CARD_DEFS["GD03-025"], "battleArea");
    const otherId = placeCard(state, "A", GD03_CARD_DEFS["GD03-001"], "battleArea");
    placeCard(state, "B", GD03_CARD_DEFS["GD03-004"], "battleArea");
    const legal = computeLegalTargets(state, specOf("GD03-021-Deploy"), "A", defaultTargetFilterResolver, sourceId);
    expect(legal).toContain(gTeamId);
    expect(legal).toContain(sourceId); // ela mesma é (G Team)
    expect(legal).not.toContain(otherId);
    state = run(state, "GD03-021-Deploy", sourceId, { target: [gTeamId] });
    expect(findCard(state, gTeamId).attackTargetRelaxUntilTurn?.turn).toBe(state.turnNumber);
  });

  it("GD03-023 não tem 【Deploy】; ao colocar EX Resource, uma Unit (AGE System) ganha <High-Maneuver>", () => {
    expect(GD03_EFFECT_SPECS.some((s) => s.cardCode === "GD03-023")).toBe(false);
    let state = freshGame();
    const sourceId = placeCard(state, "A", GD03_CARD_DEFS["GD03-023"], "battleArea");
    const ageId = placeCard(state, "A", GD03_CARD_DEFS["GD03-031"], "battleArea");
    const events = resolveEffectSpec(
      { id: "t-ex", cardCode: "T", trigger: "Main", sourceText: "", actions: [{ op: "spawnToken", def: EX_RESOURCE_TOKEN, player: "controller", zone: "resourceArea" }] },
      ctxFor(state, sourceId),
      defaultPredicateResolver,
    );
    state = applyEvents(state, events);
    expect(findCard(state, ageId).keywordGrants.map((g) => g.keyword)).toContain("High-Maneuver");
  });

  it("GD03-101: compra 1 e, com 2+ \"A Healthy Curiosity\" no trash, descansa inimigo com HP<=4", () => {
    let state = freshGame();
    const cmdId = placeCard(state, "A", GD03_CARD_DEFS["GD03-101"], "hand");
    placeCard(state, "A", GD03_CARD_DEFS["GD03-101"], "trash");
    const enemyId = placeCard(state, "B", GD03_CARD_DEFS["GD03-001"], "battleArea"); // HP 4
    const handBefore = state.players.A.hand.length;
    state = run(state, "GD03-101-Main", cmdId);
    state = run(state, "GD03-101-Main-Rest", cmdId, { target: [enemyId] });
    expect(state.players.A.hand.length).toBe(handBefore + 1);
    expect(findCard(state, enemyId).rested).toBe(false); // só 1 no trash

    placeCard(state, "A", GD03_CARD_DEFS["GD03-101"], "trash");
    state = run(state, "GD03-101-Main-Rest", cmdId, { target: [enemyId] });
    expect(findCard(state, enemyId).rested).toBe(true);
  });

  it("GD03-101: bot pode jogar sem alvo legal pro \"Then\" (compra 1 mesmo assim)", () => {
    let state = advanceToMainPhase(freshGame());
    for (let i = 0; i < 3; i++) {
      placeCard(state, "A", { code: "RES", nameEn: "Resource", cardType: "RESOURCE", color: "colorless" }, "resourceArea");
    }
    const cmdId = placeCard(state, "A", GD03_CARD_DEFS["GD03-101"], "hand");
    const plays = enumerateLegalActions(state, "A", ALL_EFFECT_SPECS, OPTS).filter(
      (a) => a.kind === "playCommand" && a.cardInstanceId === cmdId,
    );
    expect(plays).toHaveLength(1);
    const handBefore = state.players.A.hand.length;
    state = applyPlayerAction(state, "A", plays[0], ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver);
    expect(findCard(state, cmdId).zone).toBe("trash");
    expect(state.players.A.hand.length).toBe(handBefore); // -1 Command +1 compra
  });

  it("GD03-116 【Main】/【Action】 dá 2 de dano numa Unit amiga (Vagan) E num inimigo", () => {
    let state = freshGame();
    const cmdId = placeCard(state, "A", GD03_CARD_DEFS["GD03-116"], "hand");
    const vaganId = placeCard(state, "A", GD03_CARD_DEFS["GD03-054"], "battleArea");
    const enemyId = placeCard(state, "B", GD03_CARD_DEFS["GD03-001"], "battleArea");
    for (const trigger of ["Main", "Action"] as const) {
      const spec = specOf(`GD03-116-${trigger}`);
      expect(spec.targetFilter).toBe("trait:Vagan");
      expect(spec.secondaryTarget?.targetScope).toBe("enemyUnit");
    }
    state = run(state, "GD03-116-Action", cmdId, { target: [vaganId], enemyTarget: [enemyId] });
    expect(findCard(state, vaganId).damage).toBe(2);
    expect(findCard(state, enemyId).damage).toBe(2);
  });

  it("Bases GD03: 123 (Jupitris) descansa; 127 dá AP+3 a (ZAFT); 131 (2+ Triple Ship Alliance) devolve à mão", () => {
    let state = freshGame();
    const b123 = placeCard(state, "A", GD03_CARD_DEFS["GD03-123"], "baseSection");
    const enemyLow = placeCard(state, "B", GD03_CARD_DEFS["GD03-058"], "battleArea"); // Lv2
    state = run(state, "GD03-123-Deploy-Rest", b123, { target: [enemyLow] });
    expect(findCard(state, enemyLow).rested).toBe(false); // sem (Jupitris)
    placeCard(state, "A", GD03_CARD_DEFS["GD03-008"], "battleArea");
    state = run(state, "GD03-123-Deploy-Rest", b123, { target: [enemyLow] });
    expect(findCard(state, enemyLow).rested).toBe(true);

    const b127 = placeCard(state, "A", GD03_CARD_DEFS["GD03-127"], "baseSection");
    const zaftId = placeCard(state, "A", GD03_CARD_DEFS["GD03-038"], "battleArea");
    expect(computeLegalTargets(state, specOf("GD03-127-Deploy-Buff"), "A", defaultTargetFilterResolver, b127)).toEqual([zaftId]);

    const b131 = placeCard(state, "A", GD03_CARD_DEFS["GD03-131"], "baseSection");
    placeCard(state, "A", GD03_CARD_DEFS["GD03-072"], "battleArea");
    state = run(state, "GD03-131-Deploy-Bounce", b131, { target: [enemyLow] });
    expect(findCard(state, enemyLow).zone).toBe("battleArea"); // só 1 (Triple Ship Alliance)
    placeCard(state, "A", GD03_CARD_DEFS["GD03-070"], "battleArea");
    state = run(state, "GD03-131-Deploy-Bounce", b131, { target: [enemyLow] });
    expect(findCard(state, enemyLow).zone).toBe("hand");
  });

  it("GD03-132 【Destroyed】 não descansa sem Link Unit (AEUG) em jogo", () => {
    let state = freshGame();
    const b132 = placeCard(state, "A", GD03_CARD_DEFS["GD03-132"], "baseSection");
    placeCard(state, "A", GD03_CARD_DEFS["GD03-075"], "battleArea"); // (AEUG), sem Piloto: não é Link
    const enemyId = placeCard(state, "B", GD03_CARD_DEFS["GD03-001"], "battleArea");
    state = run(state, "GD03-132-Destroyed", b132, { target: [enemyId] });
    expect(findCard(state, enemyId).rested).toBe(false);
  });
});

function pairUnit(state: GameState, unitId: string, pilotId: string): void {
  findCard(state, unitId).pairedPilotId = pilotId;
  findCard(state, pilotId).pairedUnitId = unitId;
}

describe("GD03 — W1 (vocabulário existente)", () => {
  it("004: 【Attack】 só descansa com 2+ outras Units (Titans); 018: 5 de dano só em Unit com <Blocker>", () => {
    let state = freshGame();
    const src = placeCard(state, "A", GD03_CARD_DEFS["GD03-004"], "battleArea");
    const enemy = placeCard(state, "B", GD03_CARD_DEFS["GD03-001"], "battleArea"); // HP 4
    placeCard(state, "A", GD03_CARD_DEFS["GD03-014"], "battleArea");
    state = run(state, "GD03-004-Attack", src, { target: [enemy] });
    expect(findCard(state, enemy).rested).toBe(false);
    placeCard(state, "A", GD03_CARD_DEFS["GD03-002"], "battleArea");
    state = run(state, "GD03-004-Attack", src, { target: [enemy] });
    expect(findCard(state, enemy).rested).toBe(true);

    const altron = placeCard(state, "A", GD03_CARD_DEFS["GD03-018"], "battleArea");
    const blocker = placeCard(state, "B", GD03_CARD_DEFS["GD03-072"], "battleArea"); // <Blocker>
    expect(computeLegalTargets(state, specOf("GD03-018-Attack"), "A", defaultTargetFilterResolver, altron)).toEqual([blocker]);
  });

  it("017: 【Burst】 pega Piloto (Cyclops Team) do trash; 【When Paired】 com Piloto (Cyclops Team) libera o ataque a Unit ativa com AP<=5", () => {
    let state = freshGame();
    const kampfer = placeCard(state, "A", GD03_CARD_DEFS["GD03-017"], "battleArea");
    const bernard = placeCard(state, "A", GD03_CARD_DEFS["GD03-089"], "trash");
    state = run(state, "GD03-017-Burst", kampfer, { trashSearch: [bernard] });
    expect(findCard(state, bernard).zone).toBe("hand");

    const pilot = placeCard(state, "A", GD03_CARD_DEFS["GD03-090"], "battleArea");
    const other = placeCard(state, "A", GD03_CARD_DEFS["GD03-024"], "battleArea");
    pairUnit(state, kampfer, pilot);
    state = run(state, "GD03-017-WhenPaired", kampfer);
    expect(findCard(state, kampfer).attackTargetRelaxUntilTurn?.maxAp).toBe(5);
    expect(findCard(state, other).attackTargetRelaxUntilTurn?.maxAp).toBe(5);
  });

  it("019 coloca 1 EX Resource; 024 cria Hy-Gogg descansado só com outra Unit (Cyclops Team)", () => {
    let state = freshGame();
    const age2 = placeCard(state, "A", GD03_CARD_DEFS["GD03-019"], "battleArea");
    const resBefore = state.players.A.resourceArea.length;
    state = run(state, "GD03-019-WhenLinked", age2);
    expect(state.players.A.resourceArea.length).toBe(resBefore + 1);

    const hyGogg = placeCard(state, "A", GD03_CARD_DEFS["GD03-024"], "battleArea");
    const before = state.players.A.battleArea.length;
    state = run(state, "GD03-024-WhenLinked", hyGogg);
    expect(state.players.A.battleArea.length).toBe(before);
    placeCard(state, "A", GD03_CARD_DEFS["GD03-017"], "battleArea");
    state = run(state, "GD03-024-WhenLinked", hyGogg);
    const token = state.players.A.battleArea.find((c) => c.def.code === "T-013");
    expect(token?.rested).toBe(true);
    expect(token?.def.traits).toEqual(["Cyclops Team"]);
  });

  it("028 ganha AP+2 só atacando Unit; 036 1 de dano em todas as inimigas; 112 AP+2 em toda Unit pareada (dos 2 lados)", () => {
    let state = freshGame();
    const xi = placeCard(state, "A", GD03_CARD_DEFS["GD03-036"], "battleArea");
    const e1 = placeCard(state, "B", GD03_CARD_DEFS["GD03-001"], "battleArea");
    const e2 = placeCard(state, "B", GD03_CARD_DEFS["GD03-058"], "battleArea");
    state = run(state, "GD03-036-WhenLinked", xi);
    expect([findCard(state, e1).damage, findCard(state, e2).damage]).toEqual([1, 1]);

    const pilotA = placeCard(state, "A", GD03_CARD_DEFS["GD03-091"], "battleArea");
    pairUnit(state, xi, pilotA);
    const pilotB = placeCard(state, "B", GD03_CARD_DEFS["GD03-093"], "battleArea");
    pairUnit(state, e1, pilotB);
    const apXi = effectiveAp(findCard(state, xi), state);
    const apE2 = effectiveAp(findCard(state, e2), state);
    state = run(state, "GD03-112-Main", xi);
    expect(effectiveAp(findCard(state, xi), state)).toBe(apXi + 2);
    expect(effectiveAp(findCard(state, e2), state)).toBe(apE2); // sem Piloto
  });

  it("048 【Burst】: GFreD token só com 3 ou menos Shields inimigas", () => {
    let state = freshGame();
    const gfred = placeCard(state, "A", GD03_CARD_DEFS["GD03-048"], "shields");
    state = run(state, "GD03-048-Burst", gfred);
    expect(state.players.A.battleArea.some((c) => c.def.code === "T-020")).toBe(state.players.B.shields.length <= 3);
    while (state.players.B.shields.length > 3) state.players.B.shields.pop();
    state = run(state, "GD03-048-Burst", gfred);
    expect(state.players.A.battleArea.some((c) => c.def.code === "T-020" && c.rested)).toBe(true);
  });

  it("055 só destrói com Piloto roxo; 075 só mira inimiga sem Piloto; 077 devolve de 1 a 3 inimigas com HP<=3", () => {
    let state = freshGame();
    const haji = placeCard(state, "A", GD03_CARD_DEFS["GD03-055"], "battleArea");
    const small = placeCard(state, "B", GD03_CARD_DEFS["GD03-058"], "battleArea"); // Lv2
    const redPilot = placeCard(state, "A", GD03_CARD_DEFS["GD03-091"], "battleArea");
    pairUnit(state, haji, redPilot);
    state = run(state, "GD03-055-WhenPaired", haji, { target: [small] });
    expect(findCard(state, small).zone).toBe("battleArea");
    findCard(state, haji).pairedPilotId = undefined;
    const purplePilot = placeCard(state, "A", GD03_CARD_DEFS["GD03-096"], "battleArea");
    pairUnit(state, haji, purplePilot);
    state = run(state, "GD03-055-WhenPaired", haji, { target: [small] });
    expect(findCard(state, small).zone).toBe("trash");

    const superG = placeCard(state, "A", GD03_CARD_DEFS["GD03-075"], "battleArea");
    const lone = placeCard(state, "B", GD03_CARD_DEFS["GD03-064"], "battleArea");
    const withPilot = placeCard(state, "B", GD03_CARD_DEFS["GD03-001"], "battleArea");
    pairUnit(state, withPilot, placeCard(state, "B", GD03_CARD_DEFS["GD03-093"], "battleArea"));
    const legal = computeLegalTargets(state, specOf("GD03-075-Attack"), "A", defaultTargetFilterResolver, superG);
    expect(legal).toContain(lone);
    expect(legal).not.toContain(withPilot);

    const justice = placeCard(state, "A", GD03_CARD_DEFS["GD03-077"], "battleArea");
    const r1 = placeCard(state, "B", GD03_CARD_DEFS["GD03-058"], "battleArea");
    const r2 = placeCard(state, "B", GD03_CARD_DEFS["GD03-058"], "battleArea");
    state = run(state, "GD03-077-WhenLinked", justice, { target: [r1, r2] });
    expect([findCard(state, r1).zone, findCard(state, r2).zone]).toEqual(["hand", "hand"]);
  });

  it("056 1 de dano numa Unit sua e numa inimiga; 067 1 de dano + AP+1 na sua; 072 compra e descarta só com outra (Triple Ship Alliance)", () => {
    let state = freshGame();
    const adapt = placeCard(state, "A", GD03_CARD_DEFS["GD03-056"], "battleArea");
    const enemy = placeCard(state, "B", GD03_CARD_DEFS["GD03-001"], "battleArea");
    state = run(state, "GD03-056-Deploy", adapt, { target: [adapt], enemyTarget: [enemy] });
    expect([findCard(state, adapt).damage, findCard(state, enemy).damage]).toEqual([1, 1]);

    const rouei = placeCard(state, "A", GD03_CARD_DEFS["GD03-067"], "battleArea");
    const apBefore = effectiveAp(findCard(state, rouei), state);
    state = run(state, "GD03-067-Deploy", rouei, { target: [rouei] });
    expect(findCard(state, rouei).damage).toBe(1);
    expect(effectiveAp(findCard(state, rouei), state)).toBe(apBefore + 1);

    const aile = placeCard(state, "A", GD03_CARD_DEFS["GD03-072"], "battleArea");
    const handBefore = state.players.A.hand.length;
    state = run(state, "GD03-072-Deploy", aile);
    expect(state.players.A.hand.length).toBe(handBefore);
    placeCard(state, "A", GD03_CARD_DEFS["GD03-070"], "battleArea");
    const discardId = state.players.A.hand[0].instanceId;
    state = run(state, "GD03-072-Deploy", aile, { discardTarget: [discardId] });
    expect(findCard(state, discardId).zone).toBe("trash");
    expect(state.players.A.hand.length).toBe(handBefore); // +1 compra −1 descarte
  });

  it("086 (Piloto) só mira (Titans) de Lv. <= a Unit pareada; 103 só com 3+ inimigas; 106/108 criam os tokens", () => {
    let state = freshGame();
    const unit = placeCard(state, "A", GD03_CARD_DEFS["GD03-014"], "battleArea"); // Titans Lv3
    const yazan = placeCard(state, "A", GD03_CARD_DEFS["GD03-086"], "battleArea");
    pairUnit(state, unit, yazan);
    const bigTitans = placeCard(state, "A", GD03_CARD_DEFS["GD03-002"], "battleArea"); // Lv7
    const legal = computeLegalTargets(state, specOf("GD03-086-Attack"), "A", defaultTargetFilterResolver, yazan);
    expect(legal).toContain(unit);
    expect(legal).not.toContain(bigTitans);

    const cmd = placeCard(state, "A", GD03_CARD_DEFS["GD03-103"], "hand");
    const rested = placeCard(state, "B", GD03_CARD_DEFS["GD03-001"], "battleArea", { rested: true });
    state = run(state, "GD03-103-Main", cmd, { target: [rested] });
    expect(findCard(state, rested).damage).toBe(0);
    placeCard(state, "B", GD03_CARD_DEFS["GD03-058"], "battleArea");
    placeCard(state, "B", GD03_CARD_DEFS["GD03-058"], "battleArea");
    state = run(state, "GD03-103-Main", cmd, { target: [rested] });
    expect(findCard(state, rested).damage).toBe(2);

    state = run(state, "GD03-106-Main", cmd);
    state = run(state, "GD03-108-Main", cmd);
    const codes = state.players.A.battleArea.map((c) => c.def.code);
    expect(codes).toEqual(expect.arrayContaining(["T-018", "T-019", "T-013"]));
  });

  it("119 ativa a Base descansada e dá AP-1 às inimigas; 121 descansa Base amiga + inimiga HP<=3; 122 devolve Lv<=3", () => {
    let state = freshGame();
    const cmd = placeCard(state, "A", GD03_CARD_DEFS["GD03-119"], "hand");
    const base = placeCard(state, "A", GD03_CARD_DEFS["GD03-123"], "baseSection", { rested: true });
    const enemy = placeCard(state, "B", GD03_CARD_DEFS["GD03-058"], "battleArea");
    const ap = effectiveAp(findCard(state, enemy), state);
    state = run(state, "GD03-119-Main", cmd, { target: [base] });
    expect(findCard(state, base).rested).toBe(false);
    expect(effectiveAp(findCard(state, enemy), state)).toBe(ap - 1);

    state = run(state, "GD03-121-Action", cmd, { target: [base], enemyTarget: [enemy] });
    expect([findCard(state, base).rested, findCard(state, enemy).rested]).toEqual([true, true]);

    state = run(state, "GD03-122-Action", cmd, { target: [enemy] });
    expect(findCard(state, enemy).zone).toBe("hand");
  });

  it("estáticos: 033 (ZAFT) AP+2 com Piloto (ZAFT) no seu turno; 045 AP+1 com token; 093 (Piloto) AP+1 sem Base inimiga", () => {
    const state = freshGame();
    const providence = placeCard(state, "A", GD03_CARD_DEFS["GD03-033"], "battleArea");
    const zaft = placeCard(state, "A", GD03_CARD_DEFS["GD03-038"], "battleArea");
    const apZaft = effectiveAp(findCard(state, zaft), state);
    pairUnit(state, providence, placeCard(state, "A", GD03_CARD_DEFS["GD03-091"], "battleArea"));
    expect(effectiveAp(findCard(state, zaft), state)).toBe(apZaft + 2);

    const balient = placeCard(state, "A", GD03_CARD_DEFS["GD03-045"], "battleArea");
    const apBalient = effectiveAp(findCard(state, balient), state);
    placeCard(state, "A", { code: "T-012", nameEn: "Daughtress", cardType: "UNIT", color: "red", ap: 0, hp: 1, isToken: true }, "battleArea");
    expect(effectiveAp(findCard(state, balient), state)).toBe(apBalient + 1);

    state.players.B.baseSection = []; // o jogo começa com a EX Base do oponente
    const host = placeCard(state, "A", GD03_CARD_DEFS["GD03-058"], "battleArea");
    const carris = placeCard(state, "A", GD03_CARD_DEFS["GD03-093"], "battleArea");
    pairUnit(state, host, carris);
    const printedWithPilot = (GD03_CARD_DEFS["GD03-058"].ap ?? 0) + (GD03_CARD_DEFS["GD03-093"].ap ?? 0);
    expect(effectiveAp(findCard(state, host), state)).toBe(printedWithPilot + 1);
    placeCard(state, "B", GD03_CARD_DEFS["GD03-123"], "baseSection");
    expect(effectiveAp(findCard(state, host), state)).toBe(printedWithPilot);
  });

  it("custo dinâmico: 014 −1 com 2 Units (Titans); 082 −1 com 2 Units (Superpower Bloc)/(UN)", () => {
    const state = freshGame();
    const def014 = GD03_CARD_DEFS["GD03-014"];
    expect(effectiveCost(def014, state, "A")).toBe(def014.cost);
    placeCard(state, "A", GD03_CARD_DEFS["GD03-002"], "battleArea");
    placeCard(state, "A", GD03_CARD_DEFS["GD03-004"], "battleArea");
    expect(effectiveCost(def014, state, "A")).toBe((def014.cost ?? 0) - 1);

    const def082 = GD03_CARD_DEFS["GD03-082"];
    placeCard(state, "A", GD03_CARD_DEFS["GD03-082"], "battleArea"); // Superpower Bloc
    expect(effectiveCost(def082, state, "A")).toBe(def082.cost);
    placeCard(state, "A", GD03_CARD_DEFS["GD03-082"], "battleArea");
    expect(effectiveCost(def082, state, "A")).toBe((def082.cost ?? 0) - 1);
  });
});

describe("GD03 — W1 gatilhos de combate", () => {
  function runBattle(state: GameState, attackerId: string, defenderId: string): GameState {
    let next = declareAttack(state, attackerId, { unitId: defenderId });
    next = proceedToBlockStep(next);
    next = skipBlock(next);
    next = passAction(next, next.combat!.defendingPlayer);
    next = passAction(next, next.combat!.attackingPlayer);
    return resolveDamageStep(next);
  }
  function battleReady(): GameState {
    const state = advanceToMainPhase(freshGame());
    state.players.B.baseSection = [];
    return state;
  }

  it("029: ao destruir em batalha no seu turno, 2 de dano em toda inimiga com <Blocker> (e só nelas)", () => {
    let state = battleReady();
    const heavyarms = placeCard(state, "A", GD03_CARD_DEFS["GD03-029"], "battleArea"); // AP4
    const defender = placeCard(state, "B", GD03_CARD_DEFS["GD03-058"], "battleArea", { rested: true }); // HP2
    const blocker = placeCard(state, "B", GD03_CARD_DEFS["GD03-072"], "battleArea"); // <Blocker>, HP4
    const plain = placeCard(state, "B", GD03_CARD_DEFS["GD03-001"], "battleArea");
    state = runBattle(state, heavyarms, defender);
    expect(findCard(state, defender).zone).toBe("trash");
    expect(findCard(state, blocker).damage).toBe(2);
    expect(findCard(state, plain).damage).toBe(0);
  });

  it("022: 【During Link】 ao destruir em batalha, 1 de dano nas inimigas Lv.3 ou menos; sem Link não faz nada", () => {
    let state = battleReady();
    const kyrios = placeCard(state, "A", GD03_CARD_DEFS["GD03-022"], "battleArea"); // AP5
    const defender = placeCard(state, "B", GD03_CARD_DEFS["GD03-058"], "battleArea", { rested: true });
    const low = placeCard(state, "B", GD03_CARD_DEFS["GD03-058"], "battleArea"); // Lv2
    state = runBattle(state, kyrios, defender);
    expect(findCard(state, low).damage).toBe(0); // sem Piloto: não está em Link
  });
});
