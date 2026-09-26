import { describe, expect, it } from "vitest";
import { createGame } from "../engine/setup";
import { advanceToMainPhase } from "../engine/phases";
import { declareAttack, proceedToBlockStep, skipBlock } from "../engine/combat";
import { applyPlayerAction } from "../engine/actions";
import { deployCard } from "../engine/deploy";
import type { PlayerId } from "../engine/types";
import { effectivePilotDef, satisfiesLinkCondition } from "../engine/types";
import { placeCard } from "../engine/__testkit__/cardHarness";
import { buildSt06DeckList } from "../fixtures/st06Deck";
import { buildSt04DeckList } from "../fixtures/st04Deck";
import { GD02_CARD_DEFS } from "./gd02";
import { GD02_EFFECT_SPECS } from "./gd02/effects";
import type { CardDef, GameState } from "../engine/types";
import type { EffectContext } from "../engine/effectSpec";
import { computeLegalTargets, resolveEffectSpec } from "../engine/effectSpec";
import { applyEvents, findCard } from "../engine/events";
import { defaultPredicateResolver, defaultTargetFilterResolver } from "./predicates";
import { DEFERRED_CLAUSES } from "./deferred";

function freshGame(): GameState {
  return createGame(buildSt06DeckList(), buildSt04DeckList(), { seed: 202, firstPlayer: "A" });
}

/** Remove a Base do jogador pra ataque direto ao jogador não ser barrado (mesmo helper de st02.test.ts). */
function stripBase(state: GameState, player: PlayerId): GameState {
  return { ...state, players: { ...state.players, [player]: { ...state.players[player], baseSection: [] } } };
}

function ctxFor(state: GameState, sourceInstanceId: string, targets: Record<string, string[]> = {}): EffectContext {
  return { state, controller: "A", sourceInstanceId, turnNumber: state.turnNumber, targets };
}

describe("GD02 — catálogo e cobertura", () => {
  it("contém exatamente 130 cartas oficiais indexadas por código GD02-001 até GD02-130", () => {
    const codes = Object.keys(GD02_CARD_DEFS);
    expect(codes).toHaveLength(130);
    expect(codes).toContain("GD02-001");
    expect(codes).toContain("GD02-069");
    expect(codes).toContain("GD02-130");
  });

  it("distribui as cartas em cores e tipos consistentes", () => {
    const cards = Object.values(GD02_CARD_DEFS);
    const units = cards.filter((c) => c.cardType === "UNIT");
    const pilots = cards.filter((c) => c.cardType === "PILOT");
    const commands = cards.filter((c) => c.cardType === "COMMAND");
    const bases = cards.filter((c) => c.cardType === "BASE");

    expect(units).toHaveLength(84);
    // 15 PILOT / 21 COMMAND (dataset oficial) — GD02-106 White Wolf corrigido de "PILOT" pra
    // "COMMAND" (Sprint 2 Lote 6): tinha pilotMode mas cardType errado, um bug de dado real.
    expect(pilots).toHaveLength(15);
    expect(commands).toHaveLength(21);
    expect(bases).toHaveLength(10);
  });

  it("todas as 10 bases de GD02 possuem Deploy de puxar escudo", () => {
    const bases = Object.values(GD02_CARD_DEFS).filter((c) => c.cardType === "BASE");
    expect(bases).toHaveLength(10);
    for (const b of bases) {
      expect(b.triggerKeywords).toContain("Deploy");
    }
  });
});

describe("GD02 — resolução de efeitos bespoke", () => {
  it("bases de GD02 puxam 1 shield para a mão ao dar Deploy", () => {
    let state = freshGame();
    const baseDef = GD02_CARD_DEFS["GD02-121"]; // Dominion / Base Blue
    const baseId = placeCard(state, "A", baseDef, "baseSection");
    const initialHandCount = state.players.A.hand.length;

    const baseDeploySpec = GD02_EFFECT_SPECS.find((s) => s.cardCode === "GD02-121" && s.trigger === "Deploy");
    expect(baseDeploySpec).toBeDefined();

    if (baseDeploySpec) {
      const events = resolveEffectSpec(baseDeploySpec, ctxFor(state, baseId), defaultPredicateResolver);
      state = applyEvents(state, events);
      expect(state.players.A.hand.length).toBe(initialHandCount + 1);
    }
  });

  it("GD02-068 Gundam Barbatos 3rd Form — 【Deploy】Deal 2 damage to THIS Unit (não a um inimigo)", () => {
    let state = freshGame();
    const barbatosDef = GD02_CARD_DEFS["GD02-068"];
    const enemyDef = GD02_CARD_DEFS["GD02-004"];
    const sourceId = placeCard(state, "A", barbatosDef, "battleArea");
    const enemyId = placeCard(state, "B", enemyDef, "battleArea");

    const deploySpec = GD02_EFFECT_SPECS.find((s) => s.cardCode === "GD02-068" && s.trigger === "Deploy");
    expect(deploySpec).toBeDefined();

    if (deploySpec) {
      const events = resolveEffectSpec(deploySpec, ctxFor(state, sourceId, {}), defaultPredicateResolver);
      state = applyEvents(state, events);
      expect(findCard(state, sourceId).damage).toBe(2);
      expect(findCard(state, enemyId).damage).toBe(0);
    }
  });

  it("GD02-036 Qubeley concede Suppression ao dar When Linked", () => {
    let state = freshGame();
    const qubeleyDef = GD02_CARD_DEFS["GD02-036"];
    const sourceId = placeCard(state, "A", qubeleyDef, "battleArea");

    const spec = GD02_EFFECT_SPECS.find((s) => s.cardCode === "GD02-036");
    expect(spec).toBeDefined();

    if (spec) {
      const events = resolveEffectSpec(spec, ctxFor(state, sourceId), defaultPredicateResolver);
      state = applyEvents(state, events);
      expect(findCard(state, sourceId).keywordGrants.some((k) => k.keyword === "Suppression")).toBe(true);
    }
  });
});

// Token mínimo (mesmo shape de T-007 em fixtures/st03Deck.ts) -- só pra testar targetFilter "isToken".
const TEST_TOKEN_UNIT: CardDef = { code: "T-TEST", nameEn: "Token de Teste", cardType: "UNIT", color: "green", ap: 1, hp: 5, traits: [], isToken: true };

describe("GD02 — Sprint 2 (docs/debates 2026-09-18), 1º lote de fechamento do backlog de cobertura", () => {
  it("GD02-018/035/066: nenhuma pode escolher o jogador inimigo como alvo de ataque (attackTargetRules.cannotTargetPlayer)", () => {
    for (const code of ["GD02-018", "GD02-035", "GD02-066"] as const) {
      expect(GD02_CARD_DEFS[code].attackTargetRules?.cannotTargetPlayer).toBe(true);
    }

    const state = advanceToMainPhase(freshGame());
    const attackerId = placeCard(state, "A", GD02_CARD_DEFS["GD02-018"], "battleArea");
    expect(() => declareAttack(state, attackerId, "player")).toThrow(/não pode escolher o jogador inimigo/);
  });

  it("GD02-025 Gundam Heavyarms (Deploy): olha o topo do deck e devolve pro topo ou fundo, escolha do jogador", () => {
    const state = freshGame();
    const sourceId = placeCard(state, "A", GD02_CARD_DEFS["GD02-025"], "battleArea");
    const topId = state.players.A.deck[0].instanceId;

    const spec = GD02_EFFECT_SPECS.find((s) => s.cardCode === "GD02-025" && s.trigger === "Deploy")!;
    expect(spec).toBeDefined();

    const keepOnTop = applyEvents(state, resolveEffectSpec(spec, ctxFor(state, sourceId, { position: ["top"] }), defaultPredicateResolver));
    expect(keepOnTop.players.A.deck[0].instanceId).toBe(topId);

    const toBottom = applyEvents(state, resolveEffectSpec(spec, ctxFor(state, sourceId, { position: ["bottom"] }), defaultPredicateResolver));
    expect(toBottom.players.A.deck.at(-1)!.instanceId).toBe(topId);
  });

  it("GD02-039 Haman Karn's Gaza C (When Paired): 1 dano a Unit inimiga Lv.3 ou menor; recusa alvo Lv.4+", () => {
    let state = freshGame();
    const sourceId = placeCard(state, "A", GD02_CARD_DEFS["GD02-039"], "battleArea");
    const lowEnemyId = placeCard(state, "B", { ...GD02_CARD_DEFS["GD02-018"], level: 3 }, "battleArea"); // Lv.3 — casa o filtro
    const highEnemyId = placeCard(state, "B", { ...GD02_CARD_DEFS["GD02-018"], level: 4 }, "battleArea"); // Lv.4 — não casa

    const spec = GD02_EFFECT_SPECS.find((s) => s.cardCode === "GD02-039" && s.trigger === "When Paired")!;
    expect(spec).toBeDefined();

    const legal = computeLegalTargets(state, spec, "A", defaultTargetFilterResolver, sourceId);
    expect(legal).toContain(lowEnemyId);
    expect(legal).not.toContain(highEnemyId);

    const events = resolveEffectSpec(spec, ctxFor(state, sourceId, { target: [lowEnemyId] }), defaultPredicateResolver);
    state = applyEvents(state, events);
    expect(findCard(state, lowEnemyId).damage).toBe(1);
  });

  it("GD02-041 Sugai's Gelgoog (GQ) (Deploy): 2 dano a Unit inimiga Lv.5 ou maior; recusa alvo Lv.4-", () => {
    let state = freshGame();
    const sourceId = placeCard(state, "A", GD02_CARD_DEFS["GD02-041"], "battleArea");
    const highEnemyId = placeCard(state, "B", { ...GD02_CARD_DEFS["GD02-018"], level: 5 }, "battleArea"); // Lv.5 — casa o filtro
    const lowEnemyId = placeCard(state, "B", { ...GD02_CARD_DEFS["GD02-018"], level: 4 }, "battleArea"); // Lv.4 — não casa

    const spec = GD02_EFFECT_SPECS.find((s) => s.cardCode === "GD02-041" && s.trigger === "Deploy")!;
    expect(spec).toBeDefined();

    const legal = computeLegalTargets(state, spec, "A", defaultTargetFilterResolver, sourceId);
    expect(legal).toContain(highEnemyId);
    expect(legal).not.toContain(lowEnemyId);

    const events = resolveEffectSpec(spec, ctxFor(state, sourceId, { target: [highEnemyId] }), defaultPredicateResolver);
    state = applyEvents(state, events);
    expect(findCard(state, highEnemyId).damage).toBe(2);
  });

  it("GD02-046 Sayla's Light-Type Guncannon (Deploy): 2 dano a Unit-token inimiga; recusa Unit normal", () => {
    let state = freshGame();
    const sourceId = placeCard(state, "A", GD02_CARD_DEFS["GD02-046"], "battleArea");
    const tokenId = placeCard(state, "B", TEST_TOKEN_UNIT, "battleArea");
    const normalUnitId = placeCard(state, "B", GD02_CARD_DEFS["GD02-018"], "battleArea");

    const spec = GD02_EFFECT_SPECS.find((s) => s.cardCode === "GD02-046" && s.trigger === "Deploy")!;
    expect(spec).toBeDefined();

    const legal = computeLegalTargets(state, spec, "A", defaultTargetFilterResolver, sourceId);
    expect(legal).toContain(tokenId);
    expect(legal).not.toContain(normalUnitId);

    const events = resolveEffectSpec(spec, ctxFor(state, sourceId, { target: [tokenId] }), defaultPredicateResolver);
    state = applyEvents(state, events);
    expect(findCard(state, tokenId).damage).toBe(2);
  });

  it("GD02-008 Gabthley (When Linked): 1 dano a Unit inimiga REESTED; recusa alvo ativo", () => {
    let state = freshGame();
    const sourceId = placeCard(state, "A", GD02_CARD_DEFS["GD02-008"], "battleArea");
    const restedEnemyId = placeCard(state, "B", GD02_CARD_DEFS["GD02-018"], "battleArea", { rested: true });
    const activeEnemyId = placeCard(state, "B", GD02_CARD_DEFS["GD02-018"], "battleArea");

    const spec = GD02_EFFECT_SPECS.find((s) => s.cardCode === "GD02-008" && s.trigger === "When Linked")!;
    expect(spec).toBeDefined();

    const legal = computeLegalTargets(state, spec, "A", defaultTargetFilterResolver, sourceId);
    expect(legal).toContain(restedEnemyId);
    expect(legal).not.toContain(activeEnemyId);

    const events = resolveEffectSpec(spec, ctxFor(state, sourceId, { target: [restedEnemyId] }), defaultPredicateResolver);
    state = applyEvents(state, events);
    expect(findCard(state, restedEnemyId).damage).toBe(1);
  });

  it("GD02-045 GINN (Attack): com 5+ AP atacando uma Unit inimiga, compra 1; sem AP suficiente, não compra", () => {
    const spec = GD02_EFFECT_SPECS.find((s) => s.cardCode === "GD02-045" && s.trigger === "Attack")!;
    expect(spec).toBeDefined();

    const highApState = advanceToMainPhase(freshGame());
    const highApAttackerId = placeCard(highApState, "A", { ...GD02_CARD_DEFS["GD02-045"], ap: 5 }, "battleArea");
    const enemyId = placeCard(highApState, "B", GD02_CARD_DEFS["GD02-018"], "battleArea", { rested: true });
    const afterAttack = declareAttack(highApState, highApAttackerId, { unitId: enemyId });
    const handBefore = afterAttack.players.A.hand.length;
    const afterEffect = applyEvents(afterAttack, resolveEffectSpec(spec, ctxFor(afterAttack, highApAttackerId), defaultPredicateResolver));
    expect(afterEffect.players.A.hand).toHaveLength(handBefore + 1);

    const lowApState = advanceToMainPhase(freshGame());
    const lowApAttackerId = placeCard(lowApState, "A", GD02_CARD_DEFS["GD02-045"], "battleArea"); // AP base 1, não satisfaz selfApAtLeast:5
    const enemyId2 = placeCard(lowApState, "B", GD02_CARD_DEFS["GD02-018"], "battleArea", { rested: true });
    const afterAttack2 = declareAttack(lowApState, lowApAttackerId, { unitId: enemyId2 });
    const handBefore2 = afterAttack2.players.A.hand.length;
    const afterEffect2 = applyEvents(afterAttack2, resolveEffectSpec(spec, ctxFor(afterAttack2, lowApAttackerId), defaultPredicateResolver));
    expect(afterEffect2.players.A.hand).toHaveLength(handBefore2);
  });

  it("GD02-060 Gundam Leopard (Deploy): com 7+ cartas na lixeira, resta a Unit inimiga Lv.4- escolhida; sem lixeira suficiente, não faz nada", () => {
    let state = freshGame();
    for (let i = 0; i < 7; i++) placeCard(state, "A", GD02_CARD_DEFS["GD02-018"], "trash");
    const sourceId = placeCard(state, "A", GD02_CARD_DEFS["GD02-060"], "battleArea");
    const lowEnemyId = placeCard(state, "B", { ...GD02_CARD_DEFS["GD02-018"], level: 4 }, "battleArea");
    const highEnemyId = placeCard(state, "B", { ...GD02_CARD_DEFS["GD02-018"], level: 5 }, "battleArea");

    const spec = GD02_EFFECT_SPECS.find((s) => s.cardCode === "GD02-060" && s.trigger === "Deploy")!;
    expect(spec).toBeDefined();

    const legal = computeLegalTargets(state, spec, "A", defaultTargetFilterResolver, sourceId);
    expect(legal).toContain(lowEnemyId);
    expect(legal).not.toContain(highEnemyId);

    state = applyEvents(state, resolveEffectSpec(spec, ctxFor(state, sourceId, { target: [lowEnemyId] }), defaultPredicateResolver));
    expect(findCard(state, lowEnemyId).rested).toBe(true);

    // Menos de 7 cartas na lixeira -- condição falsa, "then" (rest) não roda.
    let poorState = freshGame();
    for (let i = 0; i < 6; i++) placeCard(poorState, "A", GD02_CARD_DEFS["GD02-018"], "trash");
    const sourceId2 = placeCard(poorState, "A", GD02_CARD_DEFS["GD02-060"], "battleArea");
    const enemyId2 = placeCard(poorState, "B", { ...GD02_CARD_DEFS["GD02-018"], level: 4 }, "battleArea");
    poorState = applyEvents(poorState, resolveEffectSpec(spec, ctxFor(poorState, sourceId2, { target: [enemyId2] }), defaultPredicateResolver));
    expect(findCard(poorState, enemyId2).rested).toBe(false);
  });
});

describe("GD02 — Sprint 2 (docs/debates 2026-09-18), 3º lote de fechamento do backlog de cobertura", () => {
  it("GD02-054 Gundam Barbatos 1st Form (Attack): com dano acumulado, compra 1; sem dano, não compra", () => {
    const spec = GD02_EFFECT_SPECS.find((s) => s.cardCode === "GD02-054" && s.trigger === "Attack")!;
    expect(spec).toBeDefined();

    let damagedState = freshGame();
    const damagedSourceId = placeCard(damagedState, "A", GD02_CARD_DEFS["GD02-054"], "battleArea", { damage: 1 });
    const handBefore = damagedState.players.A.hand.length;
    damagedState = applyEvents(damagedState, resolveEffectSpec(spec, ctxFor(damagedState, damagedSourceId), defaultPredicateResolver));
    expect(damagedState.players.A.hand).toHaveLength(handBefore + 1);

    let freshSourceState = freshGame();
    const freshSourceId = placeCard(freshSourceState, "A", GD02_CARD_DEFS["GD02-054"], "battleArea");
    const handBefore2 = freshSourceState.players.A.hand.length;
    freshSourceState = applyEvents(freshSourceState, resolveEffectSpec(spec, ctxFor(freshSourceState, freshSourceId), defaultPredicateResolver));
    expect(freshSourceState.players.A.hand).toHaveLength(handBefore2);
  });

  it("GD02-070 Gundam Kimaris (Deploy): com 4+ (Gjallarhorn) na lixeira, compra 2 e descarta 2; sem lixeira suficiente, não faz nada", () => {
    const spec = GD02_EFFECT_SPECS.find((s) => s.cardCode === "GD02-070" && s.trigger === "Deploy")!;
    expect(spec).toBeDefined();

    let readyState = freshGame();
    for (let i = 0; i < 4; i++) placeCard(readyState, "A", { ...GD02_CARD_DEFS["GD02-018"], traits: ["Gjallarhorn"] }, "trash");
    const sourceId = placeCard(readyState, "A", GD02_CARD_DEFS["GD02-070"], "battleArea");
    const handBefore = readyState.players.A.hand.length;
    const discardIds = readyState.players.A.hand.slice(0, 2).map((c) => c.instanceId);
    readyState = applyEvents(
      readyState,
      resolveEffectSpec(spec, ctxFor(readyState, sourceId, { discard: discardIds }), defaultPredicateResolver),
    );
    // Compra 2, descarta 2 -- saldo líquido zero, mas a mão de fato girou (as descartadas somem, 2 novas entram).
    expect(readyState.players.A.hand).toHaveLength(handBefore);
    for (const id of discardIds) {
      expect(readyState.players.A.hand.some((c) => c.instanceId === id)).toBe(false);
    }

    let poorState = freshGame();
    for (let i = 0; i < 3; i++) placeCard(poorState, "A", { ...GD02_CARD_DEFS["GD02-018"], traits: ["Gjallarhorn"] }, "trash");
    const sourceId2 = placeCard(poorState, "A", GD02_CARD_DEFS["GD02-070"], "battleArea");
    const handBefore2 = poorState.players.A.hand.length;
    poorState = applyEvents(poorState, resolveEffectSpec(spec, ctxFor(poorState, sourceId2), defaultPredicateResolver));
    expect(poorState.players.A.hand).toHaveLength(handBefore2);
  });

  it("GD02-081 Methuss (Deploy): com Base branca em campo, Unit inimiga escolhida sofre AP-2 no turno; sem Base branca, sem alvo legal", () => {
    let state = freshGame();
    const baseId = placeCard(state, "A", GD02_CARD_DEFS["GD02-129"], "baseSection"); // Argama, Base branca
    const sourceId = placeCard(state, "A", GD02_CARD_DEFS["GD02-081"], "battleArea");
    const enemyId = placeCard(state, "B", GD02_CARD_DEFS["GD02-018"], "battleArea");

    const spec = GD02_EFFECT_SPECS.find((s) => s.cardCode === "GD02-081" && s.trigger === "Deploy")!;
    expect(spec).toBeDefined();
    expect(baseId).toBeDefined();

    const legal = computeLegalTargets(state, spec, "A", defaultTargetFilterResolver, sourceId);
    expect(legal).toContain(enemyId);

    state = applyEvents(state, resolveEffectSpec(spec, ctxFor(state, sourceId, { target: [enemyId] }), defaultPredicateResolver));
    expect(findCard(state, enemyId).statModifiers.some((m) => m.stat === "ap" && m.amount === -2)).toBe(true);

    // Sem Base branca em campo -- condição falsa, "then" (AP-2) não roda mesmo com alvo escolhido.
    let noBaseState = freshGame();
    const sourceId2 = placeCard(noBaseState, "A", GD02_CARD_DEFS["GD02-081"], "battleArea");
    const enemyId2 = placeCard(noBaseState, "B", GD02_CARD_DEFS["GD02-018"], "battleArea");
    noBaseState = applyEvents(
      noBaseState,
      resolveEffectSpec(spec, ctxFor(noBaseState, sourceId2, { target: [enemyId2] }), defaultPredicateResolver),
    );
    expect(findCard(noBaseState, enemyId2).statModifiers).toHaveLength(0);
  });
});

describe("GD02 — Sprint 2 (docs/debates 2026-09-18), 4º lote de fechamento do backlog de cobertura", () => {
  it("GD02-004 Byarlant (When Paired): resta e trava reativação da próxima start phase do oponente; recusa alvo não-rested", () => {
    let state = freshGame();
    const sourceId = placeCard(state, "A", GD02_CARD_DEFS["GD02-004"], "battleArea");
    const restedLowHpId = placeCard(state, "B", { ...GD02_CARD_DEFS["GD02-018"], hp: 3 }, "battleArea", { rested: true });
    const activeId = placeCard(state, "B", { ...GD02_CARD_DEFS["GD02-018"], hp: 3 }, "battleArea");

    const spec = GD02_EFFECT_SPECS.find((s) => s.cardCode === "GD02-004" && s.trigger === "When Paired")!;
    expect(spec).toBeDefined();

    const legal = computeLegalTargets(state, spec, "A", defaultTargetFilterResolver, sourceId);
    expect(legal).toContain(restedLowHpId);
    expect(legal).not.toContain(activeId);

    state = applyEvents(state, resolveEffectSpec(spec, ctxFor(state, sourceId, { target: [restedLowHpId] }), defaultPredicateResolver));
    expect(findCard(state, restedLowHpId).rested).toBe(true);
    expect(findCard(state, restedLowHpId).cannotActivateUntilTurn).toBeDefined();
  });

  it("GD02-061 Hyakuri (When Paired, Piloto roxo): trash Teiwaz/Tekkadan >=3 resta a Unit inimiga ap<=3; sem piloto roxo, condição falsa", () => {
    let state = freshGame();
    for (let i = 0; i < 3; i++) placeCard(state, "A", { ...GD02_CARD_DEFS["GD02-018"], traits: ["Teiwaz"] }, "trash");
    const sourceId = placeCard(state, "A", GD02_CARD_DEFS["GD02-061"], "battleArea");
    const purplePilotId = placeCard(state, "A", { ...GD02_CARD_DEFS["GD02-095"] }, "battleArea");
    findCard(state, sourceId).pairedPilotId = purplePilotId;
    const lowApEnemyId = placeCard(state, "B", { ...GD02_CARD_DEFS["GD02-018"], ap: 3 }, "battleArea");

    const spec = GD02_EFFECT_SPECS.find((s) => s.cardCode === "GD02-061" && s.trigger === "When Paired")!;
    expect(spec).toBeDefined();

    state = applyEvents(state, resolveEffectSpec(spec, ctxFor(state, sourceId, { target: [lowApEnemyId] }), defaultPredicateResolver));
    expect(findCard(state, lowApEnemyId).rested).toBe(true);

    // Sem Pilot pareado -- pairedPilotColorIs falha, "then" não roda.
    let noPilotState = freshGame();
    for (let i = 0; i < 3; i++) placeCard(noPilotState, "A", { ...GD02_CARD_DEFS["GD02-018"], traits: ["Teiwaz"] }, "trash");
    const sourceId2 = placeCard(noPilotState, "A", GD02_CARD_DEFS["GD02-061"], "battleArea");
    const enemyId2 = placeCard(noPilotState, "B", { ...GD02_CARD_DEFS["GD02-018"], ap: 3 }, "battleArea");
    noPilotState = applyEvents(
      noPilotState,
      resolveEffectSpec(spec, ctxFor(noPilotState, sourceId2, { target: [enemyId2] }), defaultPredicateResolver),
    );
    expect(findCard(noPilotState, enemyId2).rested).toBe(false);
  });

  it("GD02-089 Lalah Sune (When Paired): concede Breach 1 a outra Link Unit (Zeon) escolhida; recusa Unit sem trait Zeon", () => {
    let state = freshGame();
    const sourceId = placeCard(state, "A", GD02_CARD_DEFS["GD02-089"], "battleArea");
    const zeonLinkUnitId = placeCard(
      state,
      "A",
      { ...GD02_CARD_DEFS["GD02-018"], traits: ["Zeon"], link: { kind: "trait", values: ["Zeon"] } },
      "battleArea",
    );
    const zeonPilotId = placeCard(state, "A", { ...GD02_CARD_DEFS["GD02-091"], traits: ["Zeon"] }, "battleArea");
    findCard(state, zeonLinkUnitId).pairedPilotId = zeonPilotId;
    findCard(state, zeonPilotId).pairedUnitId = zeonLinkUnitId;
    const nonZeonUnitId = placeCard(state, "A", { ...GD02_CARD_DEFS["GD02-018"], traits: ["Earth Federation"] }, "battleArea");

    const spec = GD02_EFFECT_SPECS.find((s) => s.cardCode === "GD02-089" && s.trigger === "When Paired")!;
    expect(spec).toBeDefined();

    const legal = computeLegalTargets(state, spec, "A", defaultTargetFilterResolver, sourceId);
    expect(legal).toContain(zeonLinkUnitId);
    expect(legal).not.toContain(nonZeonUnitId);

    state = applyEvents(state, resolveEffectSpec(spec, ctxFor(state, sourceId, { target: [zeonLinkUnitId] }), defaultPredicateResolver));
    expect(findCard(state, zeonLinkUnitId).keywordGrants.some((k) => k.keyword === "Breach 1")).toBe(true);
  });

  it("GD02-091 Haman Karn (When Paired, Pilot): se pareada com Unit vermelha, dano 1 a inimigo Lv<=self; se a Unit não é vermelha, condição falsa", () => {
    let state = freshGame();
    const redUnitId = placeCard(state, "A", { ...GD02_CARD_DEFS["GD02-018"], color: "red", level: 5 }, "battleArea");
    const sourceId = placeCard(state, "A", GD02_CARD_DEFS["GD02-091"], "battleArea");
    findCard(state, redUnitId).pairedPilotId = sourceId;
    findCard(state, sourceId).pairedUnitId = redUnitId;
    const lowLevelEnemyId = placeCard(state, "B", { ...GD02_CARD_DEFS["GD02-018"], level: 4 }, "battleArea");

    const spec = GD02_EFFECT_SPECS.find((s) => s.cardCode === "GD02-091" && s.trigger === "When Paired")!;
    expect(spec).toBeDefined();

    state = applyEvents(state, resolveEffectSpec(spec, ctxFor(state, sourceId, { target: [lowLevelEnemyId] }), defaultPredicateResolver));
    expect(findCard(state, lowLevelEnemyId).damage).toBe(1);

    let blueUnitState = freshGame();
    const blueUnitId = placeCard(blueUnitState, "A", { ...GD02_CARD_DEFS["GD02-018"], color: "blue", level: 5 }, "battleArea");
    const sourceId2 = placeCard(blueUnitState, "A", GD02_CARD_DEFS["GD02-091"], "battleArea");
    findCard(blueUnitState, blueUnitId).pairedPilotId = sourceId2;
    findCard(blueUnitState, sourceId2).pairedUnitId = blueUnitId;
    const enemyId2 = placeCard(blueUnitState, "B", { ...GD02_CARD_DEFS["GD02-018"], level: 4 }, "battleArea");
    blueUnitState = applyEvents(
      blueUnitState,
      resolveEffectSpec(spec, ctxFor(blueUnitState, sourceId2, { target: [enemyId2] }), defaultPredicateResolver),
    );
    expect(findCard(blueUnitState, enemyId2).damage).toBe(0);
  });

  it("GD02-095 Lafter Frankland (Attack, Pilot): Unit pareada danificada e Lv<=5 ganha High-Maneuver nesta batalha; sem dano, nada acontece", () => {
    let state = freshGame();
    const damagedUnitId = placeCard(state, "A", { ...GD02_CARD_DEFS["GD02-018"], level: 5 }, "battleArea", { damage: 1 });
    const sourceId = placeCard(state, "A", GD02_CARD_DEFS["GD02-095"], "battleArea");
    findCard(state, damagedUnitId).pairedPilotId = sourceId;
    findCard(state, sourceId).pairedUnitId = damagedUnitId;

    const spec = GD02_EFFECT_SPECS.find((s) => s.cardCode === "GD02-095" && s.trigger === "Attack")!;
    expect(spec).toBeDefined();

    state = applyEvents(state, resolveEffectSpec(spec, ctxFor(state, sourceId), defaultPredicateResolver));
    expect(findCard(state, damagedUnitId).keywordGrants.some((k) => k.keyword === "High-Maneuver")).toBe(true);

    let freshState = freshGame();
    const freshUnitId = placeCard(freshState, "A", { ...GD02_CARD_DEFS["GD02-018"], level: 5 }, "battleArea");
    const sourceId2 = placeCard(freshState, "A", GD02_CARD_DEFS["GD02-095"], "battleArea");
    findCard(freshState, freshUnitId).pairedPilotId = sourceId2;
    findCard(freshState, sourceId2).pairedUnitId = freshUnitId;
    freshState = applyEvents(freshState, resolveEffectSpec(spec, ctxFor(freshState, sourceId2), defaultPredicateResolver));
    expect(findCard(freshState, freshUnitId).keywordGrants).toHaveLength(0);
  });

  it("GD02-099 Gaelio Bauduin (When Paired, Pilot): trash Gjallarhorn>=4 aplica AP-2 no inimigo; sem lixeira suficiente, nada acontece", () => {
    let state = freshGame();
    for (let i = 0; i < 4; i++) placeCard(state, "A", { ...GD02_CARD_DEFS["GD02-018"], traits: ["Gjallarhorn"] }, "trash");
    const sourceId = placeCard(state, "A", GD02_CARD_DEFS["GD02-099"], "battleArea");
    const enemyId = placeCard(state, "B", GD02_CARD_DEFS["GD02-018"], "battleArea");

    const spec = GD02_EFFECT_SPECS.find((s) => s.cardCode === "GD02-099" && s.trigger === "When Paired")!;
    expect(spec).toBeDefined();

    state = applyEvents(state, resolveEffectSpec(spec, ctxFor(state, sourceId, { target: [enemyId] }), defaultPredicateResolver));
    expect(findCard(state, enemyId).statModifiers.some((m) => m.stat === "ap" && m.amount === -2)).toBe(true);
  });

  it("GD02-100 Dramatic Turnabout (Burst/Main): Burst compra 1; Main cura 2 HP de Unit amiga danificada e compra 1", () => {
    let burstState = freshGame();
    const burstSpec = GD02_EFFECT_SPECS.find((s) => s.cardCode === "GD02-100" && s.trigger === "Burst")!;
    expect(burstSpec).toBeDefined();
    const burstSourceId = placeCard(burstState, "A", GD02_CARD_DEFS["GD02-100"], "trash");
    const handBefore = burstState.players.A.hand.length;
    burstState = applyEvents(burstState, resolveEffectSpec(burstSpec, ctxFor(burstState, burstSourceId), defaultPredicateResolver));
    expect(burstState.players.A.hand).toHaveLength(handBefore + 1);

    let mainState = freshGame();
    const mainSourceId = placeCard(mainState, "A", GD02_CARD_DEFS["GD02-100"], "hand");
    const damagedId = placeCard(mainState, "A", GD02_CARD_DEFS["GD02-018"], "battleArea", { damage: 2 });
    const mainSpec = GD02_EFFECT_SPECS.find((s) => s.cardCode === "GD02-100" && s.trigger === "Main")!;
    expect(mainSpec).toBeDefined();
    const handBefore2 = mainState.players.A.hand.length;
    mainState = applyEvents(mainState, resolveEffectSpec(mainSpec, ctxFor(mainState, mainSourceId, { target: [damagedId] }), defaultPredicateResolver));
    expect(findCard(mainState, damagedId).damage).toBe(0);
    expect(mainState.players.A.hand).toHaveLength(handBefore2 + 1);
  });

  it("GD02-101 Beneath the Mask (Main/Action): resta 1 a 2 Units inimigas Lv<=2 escolhidas", () => {
    let state = freshGame();
    const sourceId = placeCard(state, "A", GD02_CARD_DEFS["GD02-101"], "hand");
    const lowA = placeCard(state, "B", { ...GD02_CARD_DEFS["GD02-018"], level: 2 }, "battleArea");
    const lowB = placeCard(state, "B", { ...GD02_CARD_DEFS["GD02-018"], level: 1 }, "battleArea");
    const highC = placeCard(state, "B", { ...GD02_CARD_DEFS["GD02-018"], level: 3 }, "battleArea");

    const spec = GD02_EFFECT_SPECS.find((s) => s.cardCode === "GD02-101" && s.trigger === "Main")!;
    expect(spec).toBeDefined();

    const legal = computeLegalTargets(state, spec, "A", defaultTargetFilterResolver, sourceId);
    expect(legal).toContain(lowA);
    expect(legal).toContain(lowB);
    expect(legal).not.toContain(highC);

    state = applyEvents(state, resolveEffectSpec(spec, ctxFor(state, sourceId, { target: [lowA, lowB] }), defaultPredicateResolver));
    expect(findCard(state, lowA).rested).toBe(true);
    expect(findCard(state, lowB).rested).toBe(true);
    expect(findCard(state, highC).rested).toBe(false);
  });

  it("GD02-103 AGE Device (Burst/Main): Burst busca Pilot (Asuno Family) da lixeira; Main põe EX Resource se houver Unit (AGE System)", () => {
    let burstState = freshGame();
    const burstSourceId = placeCard(burstState, "A", GD02_CARD_DEFS["GD02-103"], "trash");
    const asunoFamilyPilotId = placeCard(burstState, "A", { ...GD02_CARD_DEFS["GD02-095"], traits: ["Asuno Family"] }, "trash");
    const burstSpec = GD02_EFFECT_SPECS.find((s) => s.cardCode === "GD02-103" && s.trigger === "Burst")!;
    expect(burstSpec).toBeDefined();
    burstState = applyEvents(
      burstState,
      resolveEffectSpec(burstSpec, ctxFor(burstState, burstSourceId, { trashSearch: [asunoFamilyPilotId] }), defaultPredicateResolver),
    );
    expect(burstState.players.A.hand.some((c) => c.instanceId === asunoFamilyPilotId)).toBe(true);

    let mainState = freshGame();
    const mainSourceId = placeCard(mainState, "A", GD02_CARD_DEFS["GD02-103"], "hand");
    placeCard(mainState, "A", { ...GD02_CARD_DEFS["GD02-018"], traits: ["AGE System"] }, "battleArea");
    const resourcesBefore = mainState.players.A.resourceArea.length;
    const mainSpec = GD02_EFFECT_SPECS.find((s) => s.cardCode === "GD02-103" && s.trigger === "Main")!;
    expect(mainSpec).toBeDefined();
    mainState = applyEvents(mainState, resolveEffectSpec(mainSpec, ctxFor(mainState, mainSourceId), defaultPredicateResolver));
    expect(mainState.players.A.resourceArea).toHaveLength(resourcesBefore + 1);
  });

  it("GD02-107 All-Range Attack (Burst/Main): Burst dano 1 a 1 inimigo; Main dano 1 a TODAS as Units inimigas, exceto Link Units", () => {
    let burstState = freshGame();
    const burstSourceId = placeCard(burstState, "A", GD02_CARD_DEFS["GD02-107"], "trash");
    const enemyId = placeCard(burstState, "B", GD02_CARD_DEFS["GD02-018"], "battleArea");
    const burstSpec = GD02_EFFECT_SPECS.find((s) => s.cardCode === "GD02-107" && s.trigger === "Burst")!;
    expect(burstSpec).toBeDefined();
    burstState = applyEvents(burstState, resolveEffectSpec(burstSpec, ctxFor(burstState, burstSourceId, { target: [enemyId] }), defaultPredicateResolver));
    expect(findCard(burstState, enemyId).damage).toBe(1);

    let mainState = freshGame();
    const mainSourceId = placeCard(mainState, "A", GD02_CARD_DEFS["GD02-107"], "hand");
    const normalEnemyId = placeCard(mainState, "B", GD02_CARD_DEFS["GD02-018"], "battleArea");
    const linkEnemyId = placeCard(
      mainState,
      "B",
      { ...GD02_CARD_DEFS["GD02-018"], link: { kind: "trait", values: ["Neo Zeon"] } },
      "battleArea",
    );
    const linkPilotId = placeCard(mainState, "B", GD02_CARD_DEFS["GD02-091"], "battleArea");
    findCard(mainState, linkEnemyId).pairedPilotId = linkPilotId;
    findCard(mainState, linkPilotId).pairedUnitId = linkEnemyId;
    const mainSpec = GD02_EFFECT_SPECS.find((s) => s.cardCode === "GD02-107" && s.trigger === "Main")!;
    expect(mainSpec).toBeDefined();
    mainState = applyEvents(mainState, resolveEffectSpec(mainSpec, ctxFor(mainState, mainSourceId), defaultPredicateResolver));
    expect(findCard(mainState, normalEnemyId).damage).toBe(1);
    expect(findCard(mainState, linkEnemyId).damage).toBe(0);
  });

  it("GD02-108 That One Looks A Lot Stronger? (Main): concede attackTargetRelax (Lv<=4 ativo) a Unit amiga (Clan) escolhida", () => {
    let state = freshGame();
    const sourceId = placeCard(state, "A", GD02_CARD_DEFS["GD02-108"], "hand");
    const clanUnitId = placeCard(state, "A", { ...GD02_CARD_DEFS["GD02-018"], traits: ["Clan"] }, "battleArea");

    const spec = GD02_EFFECT_SPECS.find((s) => s.cardCode === "GD02-108" && s.trigger === "Main")!;
    expect(spec).toBeDefined();

    state = applyEvents(state, resolveEffectSpec(spec, ctxFor(state, sourceId, { target: [clanUnitId] }), defaultPredicateResolver));
    expect(findCard(state, clanUnitId).attackTargetRelaxUntilTurn).toBeDefined();
  });

  it("GD02-109 Undying Persistence (Main/Action): dano 1 a Unit inimiga escolhida", () => {
    const state = freshGame();
    const sourceId = placeCard(state, "A", GD02_CARD_DEFS["GD02-109"], "hand");
    const enemyId = placeCard(state, "B", GD02_CARD_DEFS["GD02-018"], "battleArea");

    const spec = GD02_EFFECT_SPECS.find((s) => s.cardCode === "GD02-109" && s.trigger === "Main")!;
    expect(spec).toBeDefined();

    const next = applyEvents(state, resolveEffectSpec(spec, ctxFor(state, sourceId, { target: [enemyId] }), defaultPredicateResolver));
    expect(findCard(next, enemyId).damage).toBe(1);
  });

  it("GD02-112 Momentary Respite (Burst/Main): Burst compra 1; Main busca Pilot roxo da lixeira, recusa Pilot de outra cor", () => {
    let burstState = freshGame();
    const burstSourceId = placeCard(burstState, "A", GD02_CARD_DEFS["GD02-112"], "trash");
    const burstSpec = GD02_EFFECT_SPECS.find((s) => s.cardCode === "GD02-112" && s.trigger === "Burst")!;
    expect(burstSpec).toBeDefined();
    const handBefore = burstState.players.A.hand.length;
    burstState = applyEvents(burstState, resolveEffectSpec(burstSpec, ctxFor(burstState, burstSourceId), defaultPredicateResolver));
    expect(burstState.players.A.hand).toHaveLength(handBefore + 1);

    let mainState = freshGame();
    const mainSourceId = placeCard(mainState, "A", GD02_CARD_DEFS["GD02-112"], "hand");
    const purplePilotId = placeCard(mainState, "A", GD02_CARD_DEFS["GD02-095"], "trash");
    const mainSpec = GD02_EFFECT_SPECS.find((s) => s.cardCode === "GD02-112" && s.trigger === "Main")!;
    expect(mainSpec).toBeDefined();
    mainState = applyEvents(
      mainState,
      resolveEffectSpec(mainSpec, ctxFor(mainState, mainSourceId, { trashSearch: [purplePilotId] }), defaultPredicateResolver),
    );
    expect(mainState.players.A.hand.some((c) => c.instanceId === purplePilotId)).toBe(true);
  });

  it("GD02-113 Sisterly Care (Main/Action): com Teiwaz Link Unit em campo, destrói Unit inimiga ap<=2; sem Link Unit, condição falsa", () => {
    let state = freshGame();
    const teiwazUnitId = placeCard(
      state,
      "A",
      { ...GD02_CARD_DEFS["GD02-018"], traits: ["Teiwaz"], link: { kind: "trait", values: ["Teiwaz"] } },
      "battleArea",
    );
    const teiwazPilotId = placeCard(state, "A", GD02_CARD_DEFS["GD02-095"], "battleArea");
    findCard(state, teiwazUnitId).pairedPilotId = teiwazPilotId;
    findCard(state, teiwazPilotId).pairedUnitId = teiwazUnitId;
    const sourceId = placeCard(state, "A", GD02_CARD_DEFS["GD02-113"], "hand");
    const lowApEnemyId = placeCard(state, "B", { ...GD02_CARD_DEFS["GD02-018"], ap: 2 }, "battleArea");

    const spec = GD02_EFFECT_SPECS.find((s) => s.cardCode === "GD02-113" && s.trigger === "Main")!;
    expect(spec).toBeDefined();

    state = applyEvents(state, resolveEffectSpec(spec, ctxFor(state, sourceId, { target: [lowApEnemyId] }), defaultPredicateResolver));
    expect(state.players.B.battleArea.some((c) => c.instanceId === lowApEnemyId)).toBe(false);

    let noLinkState = freshGame();
    const sourceId2 = placeCard(noLinkState, "A", GD02_CARD_DEFS["GD02-113"], "hand");
    const enemyId2 = placeCard(noLinkState, "B", { ...GD02_CARD_DEFS["GD02-018"], ap: 2 }, "battleArea");
    noLinkState = applyEvents(
      noLinkState,
      resolveEffectSpec(spec, ctxFor(noLinkState, sourceId2, { target: [enemyId2] }), defaultPredicateResolver),
    );
    expect(noLinkState.players.B.battleArea.some((c) => c.instanceId === enemyId2)).toBe(true);
  });

  it("GD02-116 Comrades Come First (Main): trash>=7 concede attackTargetRelax a Unit amiga (Vulture); sem lixeira suficiente, nada acontece", () => {
    let state = freshGame();
    for (let i = 0; i < 7; i++) placeCard(state, "A", GD02_CARD_DEFS["GD02-018"], "trash");
    const sourceId = placeCard(state, "A", GD02_CARD_DEFS["GD02-116"], "hand");
    const vultureUnitId = placeCard(state, "A", { ...GD02_CARD_DEFS["GD02-018"], traits: ["Vulture"] }, "battleArea");

    const spec = GD02_EFFECT_SPECS.find((s) => s.cardCode === "GD02-116" && s.trigger === "Main")!;
    expect(spec).toBeDefined();

    state = applyEvents(state, resolveEffectSpec(spec, ctxFor(state, sourceId, { target: [vultureUnitId] }), defaultPredicateResolver));
    expect(findCard(state, vultureUnitId).attackTargetRelaxUntilTurn).toBeDefined();
  });

  it("GD02-119 Persistent and Fortudinous (Action): com Gjallarhorn Link Unit em campo, AP-3 na Unit inimiga nesta batalha; sem Link Unit, condição falsa", () => {
    let state = freshGame();
    const gjallarhornUnitId = placeCard(
      state,
      "A",
      { ...GD02_CARD_DEFS["GD02-018"], traits: ["Gjallarhorn"], link: { kind: "trait", values: ["Gjallarhorn"] } },
      "battleArea",
    );
    const gjallarhornPilotId = placeCard(state, "A", GD02_CARD_DEFS["GD02-099"], "battleArea");
    findCard(state, gjallarhornUnitId).pairedPilotId = gjallarhornPilotId;
    findCard(state, gjallarhornPilotId).pairedUnitId = gjallarhornUnitId;
    const sourceId = placeCard(state, "A", GD02_CARD_DEFS["GD02-119"], "hand");
    const enemyId = placeCard(state, "B", GD02_CARD_DEFS["GD02-018"], "battleArea");

    const spec = GD02_EFFECT_SPECS.find((s) => s.cardCode === "GD02-119" && s.trigger === "Action")!;
    expect(spec).toBeDefined();

    state = applyEvents(state, resolveEffectSpec(spec, ctxFor(state, sourceId, { target: [enemyId] }), defaultPredicateResolver));
    expect(findCard(state, enemyId).statModifiers.some((m) => m.stat === "ap" && m.amount === -3)).toBe(true);
  });

  it("GD02-006 Forbidden Gundam: innateDamageProtection impede dano de batalha de atacante Lv.2 ou menor", () => {
    expect(GD02_CARD_DEFS["GD02-006"].innateDamageProtection).toEqual({ maxAttackerLevel: 2, duringYourTurnOnly: true });
  });

  it("GD02-053 Gundam X: StaticAbility AP+2 pra outras Units (Vulture) durante Link, seu turno, trash>=7", () => {
    const ability = GD02_CARD_DEFS["GD02-053"].staticAbilities?.[0];
    expect(ability).toBeDefined();
    expect(ability).toMatchObject({
      condition: "duringLink",
      scope: "allFriendlyUnits",
      stat: "ap",
      amount: 2,
      excludeSelf: true,
      duringYourTurnOnly: true,
      boardCondition: { kind: "trashCountAtLeast", n: 7 },
      targetCondition: { kind: "traitIs", trait: "Vulture" },
    });
  });
});

describe("GD02 — Sprint 2 (docs/debates 2026-09-18), 5º lote de fechamento do backlog de cobertura", () => {
  it("GD02-005 Tallgeese (During Link, Attack): resta Unit inimiga hp<=2; sem Link, condição falsa", () => {
    let state = freshGame();
    const unitId = placeCard(state, "A", { ...GD02_CARD_DEFS["GD02-005"], link: { kind: "trait", values: ["OZ"] } }, "battleArea");
    const pilotId = placeCard(state, "A", { ...GD02_CARD_DEFS["GD02-091"], traits: ["OZ"] }, "battleArea");
    findCard(state, unitId).pairedPilotId = pilotId;
    findCard(state, pilotId).pairedUnitId = unitId;
    const lowHpEnemyId = placeCard(state, "B", { ...GD02_CARD_DEFS["GD02-018"], hp: 2 }, "battleArea");

    const spec = GD02_EFFECT_SPECS.find((s) => s.cardCode === "GD02-005" && s.trigger === "Attack")!;
    expect(spec).toBeDefined();

    state = applyEvents(state, resolveEffectSpec(spec, ctxFor(state, unitId, { target: [lowHpEnemyId] }), defaultPredicateResolver));
    expect(findCard(state, lowHpEnemyId).rested).toBe(true);

    let noLinkState = freshGame();
    const unitId2 = placeCard(noLinkState, "A", GD02_CARD_DEFS["GD02-005"], "battleArea");
    const enemyId2 = placeCard(noLinkState, "B", { ...GD02_CARD_DEFS["GD02-018"], hp: 2 }, "battleArea");
    noLinkState = applyEvents(
      noLinkState,
      resolveEffectSpec(spec, ctxFor(noLinkState, unitId2, { target: [enemyId2] }), defaultPredicateResolver),
    );
    expect(findCard(noLinkState, enemyId2).rested).toBe(false);
  });

  it("GD02-024 Red Gundam: StaticAbility concede High-Maneuver durante Link", () => {
    expect(GD02_CARD_DEFS["GD02-024"].staticAbilities?.[0]).toMatchObject({
      condition: "duringLink",
      scope: "self",
      keyword: "High-Maneuver",
    });
  });

  it("GD02-037 Gundam Virsago (Deploy): com <=3 escudos inimigos, dano 2 a Unit inimiga ap<=5; com 4+ escudos, condição falsa", () => {
    let state = freshGame();
    const sourceId = placeCard(state, "A", GD02_CARD_DEFS["GD02-037"], "battleArea");
    const lowApEnemyId = placeCard(state, "B", { ...GD02_CARD_DEFS["GD02-018"], ap: 5 }, "battleArea");
    state.players.B.shields = state.players.B.shields.slice(0, 3);

    const spec = GD02_EFFECT_SPECS.find((s) => s.cardCode === "GD02-037" && s.trigger === "Deploy")!;
    expect(spec).toBeDefined();

    state = applyEvents(state, resolveEffectSpec(spec, ctxFor(state, sourceId, { target: [lowApEnemyId] }), defaultPredicateResolver));
    expect(findCard(state, lowApEnemyId).damage).toBe(2);

    let manyShieldsState = freshGame();
    const sourceId2 = placeCard(manyShieldsState, "A", GD02_CARD_DEFS["GD02-037"], "battleArea");
    const enemyId2 = placeCard(manyShieldsState, "B", { ...GD02_CARD_DEFS["GD02-018"], ap: 5 }, "battleArea");
    manyShieldsState = applyEvents(
      manyShieldsState,
      resolveEffectSpec(spec, ctxFor(manyShieldsState, sourceId2, { target: [enemyId2] }), defaultPredicateResolver),
    );
    expect(findCard(manyShieldsState, enemyId2).damage).toBe(0);
  });

  it("GD02-042 Gundam Ashtaron (MA Mode) (Deploy): concede High-Maneuver a Unit amiga (New UNE) escolhida; recusa Unit sem o trait", () => {
    let state = freshGame();
    const sourceId = placeCard(state, "A", GD02_CARD_DEFS["GD02-042"], "battleArea");
    const newUneUnitId = placeCard(state, "A", { ...GD02_CARD_DEFS["GD02-018"], traits: ["New UNE"] }, "battleArea");
    const otherUnitId = placeCard(state, "A", { ...GD02_CARD_DEFS["GD02-018"], traits: ["Earth Federation"] }, "battleArea");

    const spec = GD02_EFFECT_SPECS.find((s) => s.cardCode === "GD02-042" && s.trigger === "Deploy")!;
    expect(spec).toBeDefined();

    const legal = computeLegalTargets(state, spec, "A", defaultTargetFilterResolver, sourceId);
    expect(legal).toContain(newUneUnitId);
    expect(legal).not.toContain(otherUnitId);

    state = applyEvents(state, resolveEffectSpec(spec, ctxFor(state, sourceId, { target: [newUneUnitId] }), defaultPredicateResolver));
    expect(findCard(state, newUneUnitId).keywordGrants.some((k) => k.keyword === "High-Maneuver")).toBe(true);
  });

  it("GD02-043 Daughtress Weapon (Deploy) / GD02-044 Daughtress Command (Destroyed): com outra Unit (New UNE) em campo, invoca token Daughtress rested; sem outra Unit, nada acontece", () => {
    let state = freshGame();
    placeCard(state, "A", { ...GD02_CARD_DEFS["GD02-018"], traits: ["New UNE"] }, "battleArea");
    const sourceId = placeCard(state, "A", GD02_CARD_DEFS["GD02-043"], "battleArea");
    const battleAreaBefore = state.players.A.battleArea.length;

    const deploySpec = GD02_EFFECT_SPECS.find((s) => s.cardCode === "GD02-043" && s.trigger === "Deploy")!;
    expect(deploySpec).toBeDefined();
    state = applyEvents(state, resolveEffectSpec(deploySpec, ctxFor(state, sourceId), defaultPredicateResolver));
    expect(state.players.A.battleArea).toHaveLength(battleAreaBefore + 1);
    const token = state.players.A.battleArea.at(-1)!;
    expect(token.def.code).toBe("T-012");
    expect(token.rested).toBe(true);

    const destroyedSpec = GD02_EFFECT_SPECS.find((s) => s.cardCode === "GD02-044" && s.trigger === "Destroyed")!;
    expect(destroyedSpec).toBeDefined();

    let aloneState = freshGame();
    const aloneSourceId = placeCard(aloneState, "A", GD02_CARD_DEFS["GD02-044"], "battleArea");
    const aloneBattleAreaBefore = aloneState.players.A.battleArea.length;
    aloneState = applyEvents(aloneState, resolveEffectSpec(destroyedSpec, ctxFor(aloneState, aloneSourceId), defaultPredicateResolver));
    expect(aloneState.players.A.battleArea).toHaveLength(aloneBattleAreaBefore);
  });

  it("GD02-055 Gundam Gusion Rebake (Deploy): dano 1 a Unit amiga escolhida e 1 a Unit inimiga escolhida", () => {
    let state = freshGame();
    const sourceId = placeCard(state, "A", GD02_CARD_DEFS["GD02-055"], "battleArea");
    const friendlyId = placeCard(state, "A", GD02_CARD_DEFS["GD02-018"], "battleArea");
    const enemyId = placeCard(state, "B", GD02_CARD_DEFS["GD02-018"], "battleArea");

    const spec = GD02_EFFECT_SPECS.find((s) => s.cardCode === "GD02-055" && s.trigger === "Deploy")!;
    expect(spec).toBeDefined();

    state = applyEvents(
      state,
      resolveEffectSpec(spec, ctxFor(state, sourceId, { target: [friendlyId], enemyTarget: [enemyId] }), defaultPredicateResolver),
    );
    expect(findCard(state, friendlyId).damage).toBe(1);
    expect(findCard(state, enemyId).damage).toBe(1);
  });

  it("GD02-072 Hyaku-Shiki: <Blocker> é inato; <Repair 1> é condicional a Base branca em campo (StaticAbility, não innato)", () => {
    const def = GD02_CARD_DEFS["GD02-072"];
    expect(def.keywordTags).toEqual(["Blocker"]);
    expect(def.staticAbilities?.[0]).toMatchObject({
      condition: "always",
      scope: "self",
      keyword: "Repair",
      keywordValue: 1,
      boardCondition: { kind: "baseColorInPlay", color: "white" },
    });
  });

  it("GD02-076 Buster Gundam: <Blocker> é condicional a AP>=5 (StaticAbility, não innato)", () => {
    const def = GD02_CARD_DEFS["GD02-076"];
    expect(def.keywordTags).toBeUndefined();
    expect(def.staticAbilities?.[0]).toMatchObject({
      condition: "always",
      scope: "self",
      keyword: "Blocker",
      targetCondition: { kind: "apAtLeast", n: 5 },
    });
  });
});

describe("GD02 — Sprint 2 (docs/debates 2026-09-18), 6º lote de fechamento do backlog de cobertura", () => {
  it("GD02-074 Gundam Aerial Rebuild: <High-Maneuver> é inato; <Blocker> é condicional a During Pair + trash Command>=4", () => {
    const def = GD02_CARD_DEFS["GD02-074"];
    expect(def.keywordTags).toEqual(["High-Maneuver"]);
    expect(def.staticAbilities?.[0]).toMatchObject({
      condition: "duringPair",
      scope: "self",
      keyword: "Blocker",
      boardCondition: { kind: "trashCardTypeCountAtLeast", cardType: "COMMAND", n: 4 },
    });
  });

  it("GD02-083 Graze Ritter (Ground Type) (Destroyed): no turno do oponente, reativa Unit amiga (Gjallarhorn); no próprio turno, condição falsa", () => {
    let state = freshGame();
    state = { ...state, activePlayer: "B" }; // turno do oponente (controller = A)
    const restedGjallarhornId = placeCard(state, "A", { ...GD02_CARD_DEFS["GD02-018"], traits: ["Gjallarhorn"] }, "battleArea", { rested: true });
    const sourceId = placeCard(state, "A", GD02_CARD_DEFS["GD02-083"], "trash");

    const spec = GD02_EFFECT_SPECS.find((s) => s.cardCode === "GD02-083" && s.trigger === "Destroyed")!;
    expect(spec).toBeDefined();

    state = applyEvents(state, resolveEffectSpec(spec, ctxFor(state, sourceId, { target: [restedGjallarhornId] }), defaultPredicateResolver));
    expect(findCard(state, restedGjallarhornId).rested).toBe(false);

    let ownTurnState = freshGame();
    ownTurnState = { ...ownTurnState, activePlayer: "A" }; // próprio turno -- isOpponentTurn falha
    const restedId2 = placeCard(ownTurnState, "A", { ...GD02_CARD_DEFS["GD02-018"], traits: ["Gjallarhorn"] }, "battleArea", { rested: true });
    const sourceId2 = placeCard(ownTurnState, "A", GD02_CARD_DEFS["GD02-083"], "trash");
    ownTurnState = applyEvents(
      ownTurnState,
      resolveEffectSpec(spec, ctxFor(ownTurnState, sourceId2, { target: [restedId2] }), defaultPredicateResolver),
    );
    expect(findCard(ownTurnState, restedId2).rested).toBe(true);
  });

  it("GD02-087 Orga, Crot, and Shani (When Linked): se a Unit pareada é azul, resta Unit inimiga com Blocker; se não é azul, condição falsa", () => {
    let state = freshGame();
    const blueUnitId = placeCard(state, "A", { ...GD02_CARD_DEFS["GD02-018"], color: "blue" }, "battleArea");
    const sourceId = placeCard(state, "A", GD02_CARD_DEFS["GD02-087"], "battleArea");
    findCard(state, blueUnitId).pairedPilotId = sourceId;
    findCard(state, sourceId).pairedUnitId = blueUnitId;
    const blockerEnemyId = placeCard(state, "B", { ...GD02_CARD_DEFS["GD02-018"], effectKeywords: ["Blocker"], keywordTags: ["Blocker"] }, "battleArea");

    const spec = GD02_EFFECT_SPECS.find((s) => s.cardCode === "GD02-087" && s.trigger === "When Linked")!;
    expect(spec).toBeDefined();

    state = applyEvents(state, resolveEffectSpec(spec, ctxFor(state, sourceId, { target: [blockerEnemyId] }), defaultPredicateResolver));
    expect(findCard(state, blockerEnemyId).rested).toBe(true);

    let redUnitState = freshGame();
    const redUnitId = placeCard(redUnitState, "A", { ...GD02_CARD_DEFS["GD02-018"], color: "red" }, "battleArea");
    const sourceId2 = placeCard(redUnitState, "A", GD02_CARD_DEFS["GD02-087"], "battleArea");
    findCard(redUnitState, redUnitId).pairedPilotId = sourceId2;
    findCard(redUnitState, sourceId2).pairedUnitId = redUnitId;
    const blockerEnemyId2 = placeCard(redUnitState, "B", { ...GD02_CARD_DEFS["GD02-018"], effectKeywords: ["Blocker"], keywordTags: ["Blocker"] }, "battleArea");
    redUnitState = applyEvents(
      redUnitState,
      resolveEffectSpec(spec, ctxFor(redUnitState, sourceId2, { target: [blockerEnemyId2] }), defaultPredicateResolver),
    );
    expect(findCard(redUnitState, blockerEnemyId2).rested).toBe(false);
  });

  it("GD02-106 White Wolf: achado de dado corrigido pra cardType COMMAND (estava PILOT); Action protege shields de atacante Lv<=3", () => {
    expect(GD02_CARD_DEFS["GD02-106"].cardType).toBe("COMMAND");

    let state = stripBase(freshGame(), "B");
    const attackerId = placeCard(state, "A", { ...GD02_CARD_DEFS["GD02-018"], level: 2, attackTargetRules: undefined }, "battleArea");
    const sourceId = placeCard(state, "A", GD02_CARD_DEFS["GD02-106"], "hand");

    state = { ...state, phase: "main" };
    state = declareAttack(state, attackerId, "player");
    state = proceedToBlockStep(state);
    state = skipBlock(state);

    const spec = GD02_EFFECT_SPECS.find((s) => s.cardCode === "GD02-106" && s.trigger === "Action")!;
    expect(spec).toBeDefined();

    state = applyEvents(state, resolveEffectSpec(spec, ctxFor(state, sourceId), defaultPredicateResolver));
    expect(state.combat?.shieldProtection).toEqual({ maxAttackerLevel: 3 });
  });
});

describe("GD02 — Sprint 2 (docs/debates 2026-09-18), 7º lote de fechamento do backlog de cobertura", () => {
  it("GD02-075 Rick Dias (Red) (Attack): resta Base amiga ativa escolhida; se fez, AP-2 nesta batalha em Unit inimiga Lv<=4", () => {
    let state = freshGame();
    const sourceId = placeCard(state, "A", GD02_CARD_DEFS["GD02-075"], "battleArea");
    const baseId = placeCard(state, "A", GD02_CARD_DEFS["GD02-121"], "baseSection"); // Dominion, ativa por padrão
    const enemyId = placeCard(state, "B", { ...GD02_CARD_DEFS["GD02-018"], level: 4 }, "battleArea");

    const spec = GD02_EFFECT_SPECS.find((s) => s.cardCode === "GD02-075" && s.trigger === "Attack")!;
    expect(spec).toBeDefined();

    const legal = computeLegalTargets(state, spec, "A", defaultTargetFilterResolver, sourceId);
    expect(legal).toContain(baseId);

    state = applyEvents(
      state,
      resolveEffectSpec(spec, ctxFor(state, sourceId, { target: [baseId], enemyTarget: [enemyId] }), defaultPredicateResolver),
    );
    expect(findCard(state, baseId).rested).toBe(true);
    expect(findCard(state, enemyId).statModifiers.some((m) => m.stat === "ap" && m.amount === -2 && m.duration === "thisBattle")).toBe(true);
  });

  it("GD02-069 Zeta Gundam (During Link, Activate·Main): Link Unit resta Base amiga ativa, reativa a si mesma e ganha CannotTargetPlayer; sem Link, nada acontece", () => {
    let state = freshGame();
    const unitId = placeCard(
      state,
      "A",
      { ...GD02_CARD_DEFS["GD02-018"], link: { kind: "trait", values: ["AEUG"] } },
      "battleArea",
      { rested: true },
    );
    const pilotId = placeCard(state, "A", { ...GD02_CARD_DEFS["GD02-091"], traits: ["AEUG"] }, "battleArea");
    findCard(state, unitId).pairedPilotId = pilotId;
    findCard(state, pilotId).pairedUnitId = unitId;
    const baseId = placeCard(state, "A", GD02_CARD_DEFS["GD02-121"], "baseSection");

    const spec = GD02_EFFECT_SPECS.find((s) => s.cardCode === "GD02-069" && s.trigger === "Activate·Main")!;
    expect(spec).toBeDefined();

    state = applyEvents(state, resolveEffectSpec(spec, ctxFor(state, unitId, { target: [baseId] }), defaultPredicateResolver));
    expect(findCard(state, baseId).rested).toBe(true);
    expect(findCard(state, unitId).rested).toBe(false);
    expect(findCard(state, unitId).keywordGrants.some((k) => k.keyword === "CannotTargetPlayer")).toBe(true);

    let noLinkState = freshGame();
    const unitId2 = placeCard(noLinkState, "A", GD02_CARD_DEFS["GD02-018"], "battleArea", { rested: true });
    const baseId2 = placeCard(noLinkState, "A", GD02_CARD_DEFS["GD02-121"], "baseSection");
    noLinkState = applyEvents(
      noLinkState,
      resolveEffectSpec(spec, ctxFor(noLinkState, unitId2, { target: [baseId2] }), defaultPredicateResolver),
    );
    expect(findCard(noLinkState, baseId2).rested).toBe(false);
    expect(findCard(noLinkState, unitId2).rested).toBe(true);
  });
});

describe("GD02 — Sprint 2 (docs/debates 2026-09-18), 8º lote de fechamento do backlog de cobertura", () => {
  it("GD02-047 Gaza C (Activate·Main): resta e destrói a si mesma, dano 1 a Unit inimiga Lv<=5", () => {
    let state = freshGame();
    const sourceId = placeCard(state, "A", GD02_CARD_DEFS["GD02-047"], "battleArea");
    const enemyId = placeCard(state, "B", { ...GD02_CARD_DEFS["GD02-018"], level: 5 }, "battleArea");

    const spec = GD02_EFFECT_SPECS.find((s) => s.cardCode === "GD02-047" && s.trigger === "Activate·Main")!;
    expect(spec).toBeDefined();

    const legal = computeLegalTargets(state, spec, "A", defaultTargetFilterResolver, sourceId);
    expect(legal).toContain(enemyId);

    state = applyEvents(state, resolveEffectSpec(spec, ctxFor(state, sourceId, { target: [enemyId] }), defaultPredicateResolver));
    expect(state.players.A.battleArea.some((c) => c.instanceId === sourceId)).toBe(false);
    expect(findCard(state, enemyId).damage).toBe(1);
  });

  it("GD02-105 Valedictorian (Action): Unit token amiga escolhida fica protegida de qualquer dano de batalha nesta batalha (unconditional)", () => {
    let state = freshGame();
    const sourceId = placeCard(state, "A", GD02_CARD_DEFS["GD02-105"], "hand");
    const tokenId = placeCard(state, "A", TEST_TOKEN_UNIT, "battleArea");
    const normalUnitId = placeCard(state, "A", GD02_CARD_DEFS["GD02-018"], "battleArea");

    const spec = GD02_EFFECT_SPECS.find((s) => s.cardCode === "GD02-105" && s.trigger === "Action")!;
    expect(spec).toBeDefined();

    const legal = computeLegalTargets(state, spec, "A", defaultTargetFilterResolver, sourceId);
    expect(legal).toContain(tokenId);
    expect(legal).not.toContain(normalUnitId);

    // combate em andamento é pré-requisito de SET_UNIT_DAMAGE_PROTECTION (mesmo setup mínimo de ST03-014 The Blue Giant)
    state.combat = {
      step: "action",
      attackerId: "x",
      attackingPlayer: "B",
      defendingPlayer: "A",
      originalTarget: "player",
      currentTarget: "player",
      actionPasses: { A: false, B: false },
      actionPriority: "A",
    };
    state = applyEvents(state, resolveEffectSpec(spec, ctxFor(state, sourceId, { target: [tokenId] }), defaultPredicateResolver));
    expect(state.combat?.unitDamageProtection).toEqual({ instanceId: tokenId, unconditional: true });
  });

  it("GD02-120 Aspiring Pilot (Action): cura 2 HP de Unit OU Base amiga (AEUG) escolhida; recusa alvo sem o trait", () => {
    let state = freshGame();
    const sourceId = placeCard(state, "A", GD02_CARD_DEFS["GD02-120"], "hand");
    const aeugUnitId = placeCard(state, "A", { ...GD02_CARD_DEFS["GD02-018"], traits: ["AEUG"] }, "battleArea", { damage: 3 });
    const aeugBaseId = placeCard(state, "A", { ...GD02_CARD_DEFS["GD02-121"], traits: ["AEUG"] }, "baseSection", { damage: 2 });
    const otherUnitId = placeCard(state, "A", { ...GD02_CARD_DEFS["GD02-018"], traits: ["Earth Federation"] }, "battleArea");

    const spec = GD02_EFFECT_SPECS.find((s) => s.cardCode === "GD02-120" && s.trigger === "Action")!;
    expect(spec).toBeDefined();

    const legal = computeLegalTargets(state, spec, "A", defaultTargetFilterResolver, sourceId);
    expect(legal).toContain(aeugUnitId);
    expect(legal).toContain(aeugBaseId);
    expect(legal).not.toContain(otherUnitId);

    state = applyEvents(state, resolveEffectSpec(spec, ctxFor(state, sourceId, { target: [aeugUnitId] }), defaultPredicateResolver));
    expect(findCard(state, aeugUnitId).damage).toBe(1);

    let baseHealState = freshGame();
    const sourceId2 = placeCard(baseHealState, "A", GD02_CARD_DEFS["GD02-120"], "hand");
    const aeugBaseId2 = placeCard(baseHealState, "A", { ...GD02_CARD_DEFS["GD02-121"], traits: ["AEUG"] }, "baseSection", { damage: 2 });
    baseHealState = applyEvents(
      baseHealState,
      resolveEffectSpec(spec, ctxFor(baseHealState, sourceId2, { target: [aeugBaseId2] }), defaultPredicateResolver),
    );
    expect(findCard(baseHealState, aeugBaseId2).damage).toBe(0);
  });
});

describe("GD02 — Sprint 2 (docs/debates 2026-09-18), 9º lote de fechamento do backlog de cobertura", () => {
  it("GD02-056 Gundam X (During Pair, Destroyed): se o Pilot que estava pareado é (Vulture), busca Unit (Vulture) Lv>=5 da lixeira; sem o trait, condição falsa", () => {
    expect(GD02_EFFECT_SPECS.find((s) => s.cardCode === "GD02-056")?.duringPair).toBe(true);

    let state = freshGame();
    const sourceId = placeCard(state, "A", GD02_CARD_DEFS["GD02-056"], "trash"); // já destruída no momento da resolução
    const vulturePilotId = placeCard(state, "A", { ...GD02_CARD_DEFS["GD02-091"], traits: ["Vulture"] }, "trash"); // "ex-Pilot" (CR 3-3-6, já na lixeira)
    const highVultureUnitId = placeCard(state, "A", { ...GD02_CARD_DEFS["GD02-018"], traits: ["Vulture"], level: 5 }, "trash");
    const lowVultureUnitId = placeCard(state, "A", { ...GD02_CARD_DEFS["GD02-018"], traits: ["Vulture"], level: 4 }, "trash");

    const spec = GD02_EFFECT_SPECS.find((s) => s.cardCode === "GD02-056" && s.trigger === "Destroyed")!;
    expect(spec).toBeDefined();

    const ctx = { ...ctxFor(state, sourceId, { trashSearch: [highVultureUnitId] }), targets: { formerPairedPilot: [vulturePilotId], trashSearch: [highVultureUnitId] } };
    state = applyEvents(state, resolveEffectSpec(spec, ctx, defaultPredicateResolver));
    expect(state.players.A.hand.some((c) => c.instanceId === highVultureUnitId)).toBe(true);
    expect(state.players.A.trash.some((c) => c.instanceId === lowVultureUnitId)).toBe(true); // Lv4- não é o alvo, fica na lixeira

    let nonVultureState = freshGame();
    const sourceId2 = placeCard(nonVultureState, "A", GD02_CARD_DEFS["GD02-056"], "trash");
    const nonVulturePilotId = placeCard(nonVultureState, "A", { ...GD02_CARD_DEFS["GD02-091"], traits: ["Neo Zeon"] }, "trash");
    const vultureUnitId2 = placeCard(nonVultureState, "A", { ...GD02_CARD_DEFS["GD02-018"], traits: ["Vulture"], level: 5 }, "trash");
    const ctx2 = {
      ...ctxFor(nonVultureState, sourceId2, { trashSearch: [vultureUnitId2] }),
      targets: { formerPairedPilot: [nonVulturePilotId], trashSearch: [vultureUnitId2] },
    };
    nonVultureState = applyEvents(nonVultureState, resolveEffectSpec(spec, ctx2, defaultPredicateResolver));
    expect(nonVultureState.players.A.hand.some((c) => c.instanceId === vultureUnitId2)).toBe(false);
  });
});

describe("GD02 — Sprint 2 (docs/debates 2026-09-19), 10º lote de fechamento do backlog de cobertura", () => {
  it("GD02-003 Gundam Mk-II (Titans) (During Pair, Destroyed): Pilot pareado Lv<=3 + escolha de discard não vazia devolve o Pilot à mão", () => {
    let state = freshGame();
    const sourceId = placeCard(state, "A", GD02_CARD_DEFS["GD02-003"], "trash");
    const lowLevelPilotId = placeCard(state, "A", { ...GD02_CARD_DEFS["GD02-099"], level: 3 }, "trash");
    const discardedUnitId = placeCard(state, "A", GD02_CARD_DEFS["GD02-018"], "hand");

    const spec = GD02_EFFECT_SPECS.find((s) => s.cardCode === "GD02-003" && s.trigger === "Destroyed")!;
    expect(spec.duringPair).toBe(true);

    const ctx = { ...ctxFor(state, sourceId, { discard: [discardedUnitId] }), targets: { formerPairedPilot: [lowLevelPilotId], discard: [discardedUnitId] } };
    state = applyEvents(state, resolveEffectSpec(spec, ctx, defaultPredicateResolver));
    expect(state.players.A.trash.some((c) => c.instanceId === discardedUnitId)).toBe(true);
    expect(state.players.A.hand.some((c) => c.instanceId === lowLevelPilotId)).toBe(true);
  });

  it("GD02-003: Pilot pareado Lv.4+ não devolve o Pilot à mão mesmo com uma escolha de discard presente", () => {
    let state = freshGame();
    const sourceId = placeCard(state, "A", GD02_CARD_DEFS["GD02-003"], "trash");
    const highLevelPilotId = placeCard(state, "A", { ...GD02_CARD_DEFS["GD02-099"], level: 4 }, "trash");
    const discardedUnitId = placeCard(state, "A", GD02_CARD_DEFS["GD02-018"], "hand");

    const spec = GD02_EFFECT_SPECS.find((s) => s.cardCode === "GD02-003" && s.trigger === "Destroyed")!;
    const ctx = { ...ctxFor(state, sourceId, { discard: [discardedUnitId] }), targets: { formerPairedPilot: [highLevelPilotId], discard: [discardedUnitId] } };
    state = applyEvents(state, resolveEffectSpec(spec, ctx, defaultPredicateResolver));
    expect(state.players.A.hand.some((c) => c.instanceId === highLevelPilotId)).toBe(false);
  });

  it("GD02-057 Zedas (During Pair, Attack): sacrificando 1 outra Unit amiga, causa 2 de dano numa Unit inimiga Lv<=4 escolhida", () => {
    let state = freshGame();
    const sourceId = placeCard(state, "A", GD02_CARD_DEFS["GD02-057"], "battleArea");
    const sacrificeId = placeCard(state, "A", GD02_CARD_DEFS["GD02-018"], "battleArea");
    const enemyId = placeCard(state, "B", { ...GD02_CARD_DEFS["GD02-004"], level: 4 }, "battleArea");

    const spec = GD02_EFFECT_SPECS.find((s) => s.cardCode === "GD02-057" && s.trigger === "Attack")!;
    expect(spec.optional).toBe(true);
    const ctx = { ...ctxFor(state, sourceId, { target: [sacrificeId], enemyTarget: [enemyId] }), targets: { target: [sacrificeId], enemyTarget: [enemyId] } };
    state = applyEvents(state, resolveEffectSpec(spec, ctx, defaultPredicateResolver));
    expect(state.players.A.trash.some((c) => c.instanceId === sacrificeId)).toBe(true);
    expect(findCard(state, enemyId).damage).toBe(2);
  });

  it("GD02-057: declinando o sacrifício (target vazio), nada é destruído nem sofre dano", () => {
    let state = freshGame();
    const sourceId = placeCard(state, "A", GD02_CARD_DEFS["GD02-057"], "battleArea");
    const untouchedId = placeCard(state, "A", GD02_CARD_DEFS["GD02-018"], "battleArea");
    const enemyId = placeCard(state, "B", { ...GD02_CARD_DEFS["GD02-004"], level: 4 }, "battleArea");

    const spec = GD02_EFFECT_SPECS.find((s) => s.cardCode === "GD02-057" && s.trigger === "Attack")!;
    const ctx = { ...ctxFor(state, sourceId, { target: [], enemyTarget: [enemyId] }), targets: { target: [], enemyTarget: [enemyId] } };
    state = applyEvents(state, resolveEffectSpec(spec, ctx, defaultPredicateResolver));
    expect(state.players.A.battleArea.some((c) => c.instanceId === untouchedId)).toBe(true);
    expect(findCard(state, enemyId).damage).toBe(0);
  });

  it("GD02-098 Quattro Bajeena (When Linked): 'this' Unit (AEUG) causa draw 1 + discard 1; Unit não-(AEUG) não dispara nada", () => {
    let state = freshGame();
    const aeugUnitId = placeCard(state, "A", { ...GD02_CARD_DEFS["GD02-071"], traits: ["AEUG"] }, "battleArea");
    const pilotId = placeCard(state, "A", GD02_CARD_DEFS["GD02-098"], "battleArea");
    state = { ...state, players: { ...state.players, A: { ...state.players.A } } };
    findCard(state, aeugUnitId).pairedPilotId = pilotId;
    findCard(state, pilotId).pairedUnitId = aeugUnitId;
    const extraHandId = placeCard(state, "A", GD02_CARD_DEFS["GD02-004"], "hand");

    const spec = GD02_EFFECT_SPECS.find((s) => s.cardCode === "GD02-098" && s.trigger === "When Linked")!;
    const handBefore = state.players.A.hand.length;
    const ctx = { ...ctxFor(state, pilotId, { discard: [extraHandId] }), targets: { discard: [extraHandId] } };
    state = applyEvents(state, resolveEffectSpec(spec, ctx, defaultPredicateResolver));
    expect(state.players.A.hand.length).toBe(handBefore); // +1 draw, -1 discard = líquido 0
    expect(state.players.A.trash.some((c) => c.instanceId === extraHandId)).toBe(true);

    let nonAeugState = freshGame();
    const nonAeugUnitId = placeCard(nonAeugState, "A", { ...GD02_CARD_DEFS["GD02-004"], traits: ["Zeon"] }, "battleArea");
    const pilotId2 = placeCard(nonAeugState, "A", GD02_CARD_DEFS["GD02-098"], "battleArea");
    findCard(nonAeugState, nonAeugUnitId).pairedPilotId = pilotId2;
    findCard(nonAeugState, pilotId2).pairedUnitId = nonAeugUnitId;
    const handBefore2 = nonAeugState.players.A.hand.length;
    const ctx2 = ctxFor(nonAeugState, pilotId2);
    nonAeugState = applyEvents(nonAeugState, resolveEffectSpec(spec, ctx2, defaultPredicateResolver));
    expect(nonAeugState.players.A.hand.length).toBe(handBefore2);
  });

  it("GD02-098: o alias 'Char Aznable' satisfaz a link condition de OUTRAS cartas por pilotName (ex. GD02-032 White Gundam)", () => {
    const whiteGundamDef = { ...GD02_CARD_DEFS["GD02-018"], link: { kind: "pilotName" as const, values: ["Char Aznable"] } };
    expect(satisfiesLinkCondition(effectivePilotDef({ def: GD02_CARD_DEFS["GD02-098"] } as never), whiteGundamDef)).toBe(true);
  });

  it("GD02-111 Decisive Last Resort (Burst): causa 2 de dano numa Unit inimiga Lv<=3", () => {
    let state = freshGame();
    const sourceId = placeCard(state, "A", GD02_CARD_DEFS["GD02-111"], "trash");
    const enemyId = placeCard(state, "B", { ...GD02_CARD_DEFS["GD02-004"], level: 3 }, "battleArea");
    const spec = GD02_EFFECT_SPECS.find((s) => s.cardCode === "GD02-111" && s.trigger === "Burst")!;
    const ctx = { ...ctxFor(state, sourceId, { target: [enemyId] }), targets: { target: [enemyId] } };
    state = applyEvents(state, resolveEffectSpec(spec, ctx, defaultPredicateResolver));
    expect(findCard(state, enemyId).damage).toBe(2);
  });

  it("GD02-111 (Main): com 6+ Units purple na lixeira, exila as 6 primeiras e destrói a Unit inimiga escolhida", () => {
    let state = freshGame();
    const sourceId = placeCard(state, "A", GD02_CARD_DEFS["GD02-111"], "hand");
    const purpleTrashIds = Array.from({ length: 7 }, () => placeCard(state, "A", { ...GD02_CARD_DEFS["GD02-057"], color: "purple" as const }, "trash"));
    const enemyId = placeCard(state, "B", GD02_CARD_DEFS["GD02-004"], "battleArea");

    const spec = GD02_EFFECT_SPECS.find((s) => s.cardCode === "GD02-111" && s.trigger === "Main")!;
    const ctx = { ...ctxFor(state, sourceId, { target: [enemyId] }), targets: { target: [enemyId] } };
    state = applyEvents(state, resolveEffectSpec(spec, ctx, defaultPredicateResolver));
    const exiledCount = purpleTrashIds.filter((id) => state.players.A.exile.some((c) => c.instanceId === id)).length;
    expect(exiledCount).toBe(6);
    expect(state.players.A.trash.some((c) => c.instanceId === purpleTrashIds[6])).toBe(true); // a 7ª ficou na lixeira
    expect(state.players.B.battleArea.some((c) => c.instanceId === enemyId)).toBe(false);
  });

  it("GD02-111 (Main): com menos de 6 Units purple na lixeira, não exila nada nem destrói o alvo escolhido", () => {
    let state = freshGame();
    const sourceId = placeCard(state, "A", GD02_CARD_DEFS["GD02-111"], "hand");
    const purpleTrashIds = Array.from({ length: 5 }, () => placeCard(state, "A", { ...GD02_CARD_DEFS["GD02-057"], color: "purple" as const }, "trash"));
    const enemyId = placeCard(state, "B", GD02_CARD_DEFS["GD02-004"], "battleArea");

    const spec = GD02_EFFECT_SPECS.find((s) => s.cardCode === "GD02-111" && s.trigger === "Main")!;
    const ctx = { ...ctxFor(state, sourceId, { target: [enemyId] }), targets: { target: [enemyId] } };
    state = applyEvents(state, resolveEffectSpec(spec, ctx, defaultPredicateResolver));
    expect(state.players.A.exile).toHaveLength(0);
    expect(purpleTrashIds.every((id) => state.players.A.trash.some((c) => c.instanceId === id))).toBe(true);
    expect(state.players.B.battleArea.some((c) => c.instanceId === enemyId)).toBe(true);
  });
});

/** Adiciona N Recursos ACTIVE genéricos na resourceArea do jogador — mesmo padrão de gd01.test.ts/st01.test.ts. */
function addActiveResources(state: GameState, player: PlayerId, n: number): void {
  for (let i = 0; i < n; i++) {
    placeCard(state, player, { code: "R", nameEn: "Resource", cardType: "RESOURCE", color: "colorless" }, "resourceArea");
  }
}

describe("GD02 — Sprint 2 (docs/debates 2026-09-19), 11º lote — fecha os 3 deferimentos ativos (Classe G)", () => {
  const MOEBIUS_SPEC = GD02_EFFECT_SPECS.find((s) => s.cardCode === "GD02-011" && s.trigger === "Activate·Action")!;

  it("GD02-011 Moebius: spec tem custo 'destroy self' + targetScope battlingBaseOrShield", () => {
    expect(MOEBIUS_SPEC).toBeDefined();
    expect(MOEBIUS_SPEC.cost).toEqual([{ op: "destroy", target: { kind: "self" } }]);
    expect(MOEBIUS_SPEC.targetScope).toBe("battlingBaseOrShield");
  });

  it("GD02-011: targetScope battlingBaseOrShield é [] fora de combate, e [] se a fonte não é o atacante contra o jogador", () => {
    let state = freshGame();
    const moebiusId = placeCard(state, "A", GD02_CARD_DEFS["GD02-011"], "battleArea");
    expect(computeLegalTargets(state, MOEBIUS_SPEC, "A", defaultTargetFilterResolver, moebiusId)).toEqual([]);

    // combate existe, mas o alvo original é uma Unit rested (não o jogador) -> ainda []
    state = stripBase(state, "B");
    const enemyUnitId = placeCard(state, "B", GD02_CARD_DEFS["GD02-004"], "battleArea", { rested: true });
    state = { ...state, phase: "main" };
    state = declareAttack(state, moebiusId, { unitId: enemyUnitId });
    expect(computeLegalTargets(state, MOEBIUS_SPEC, "A", defaultTargetFilterResolver, moebiusId)).toEqual([]);
  });

  it("GD02-011: batalhando o jogador, a pool inclui a Base (se houver) E todos os Shields — texto oficial é 'Base/Shield' (OR), não 'o que intercepta primeiro'", () => {
    let withBase = stripBase(freshGame(), "B");
    const baseId = placeCard(withBase, "B", GD02_CARD_DEFS["GD02-121"], "baseSection");
    const moebiusId = placeCard(withBase, "A", GD02_CARD_DEFS["GD02-011"], "battleArea");
    withBase = { ...withBase, phase: "main" };
    withBase = declareAttack(withBase, moebiusId, "player");
    const poolWithBase = computeLegalTargets(withBase, MOEBIUS_SPEC, "A", defaultTargetFilterResolver, moebiusId);
    expect(poolWithBase[0]).toBe(baseId);
    expect(poolWithBase.slice(1)).toEqual(withBase.players.B.shields.map((c) => c.instanceId));

    let noBase = stripBase(freshGame(), "B");
    const moebiusId2 = placeCard(noBase, "A", GD02_CARD_DEFS["GD02-011"], "battleArea");
    const shieldIds = noBase.players.B.shields.map((c) => c.instanceId);
    expect(shieldIds.length).toBeGreaterThan(0);
    noBase = { ...noBase, phase: "main" };
    noBase = declareAttack(noBase, moebiusId2, "player");
    expect(computeLegalTargets(noBase, MOEBIUS_SPEC, "A", defaultTargetFilterResolver, moebiusId2)).toEqual(shieldIds);
  });

  it("GD02-011: caminho real via applyPlayerAction(activateAbility) — destrói a própria Unit (custo) e causa 6 de dano na Base escolhida (destrói, HP efetivo 5)", () => {
    let state = stripBase(freshGame(), "B");
    const baseId = placeCard(state, "B", GD02_CARD_DEFS["GD02-121"], "baseSection"); // HP 5
    const moebiusId = placeCard(state, "A", GD02_CARD_DEFS["GD02-011"], "battleArea");
    state = { ...state, phase: "main" };
    state = declareAttack(state, moebiusId, "player");
    state = proceedToBlockStep(state);
    state = skipBlock(state); // combat.step === "action"
    expect(state.combat?.step).toBe("action");
    // Action Step começa com a prioridade do DEFENSOR (events.ts: actionPriority = defendingPlayer) — B passa pra A poder agir.
    state = applyPlayerAction(state, "B", { kind: "passAction" }, GD02_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver);

    const next = applyPlayerAction(
      state,
      "A",
      { kind: "activateAbility", sourceInstanceId: moebiusId, targets: { target: [baseId] } },
      GD02_EFFECT_SPECS,
      defaultPredicateResolver,
      defaultTargetFilterResolver,
    );

    expect(next.players.A.trash.some((c) => c.instanceId === moebiusId)).toBe(true); // custo: destruiu a própria Unit
    expect(next.players.B.baseSection.some((c) => c.instanceId === baseId)).toBe(false);
    expect(next.players.B.trash.some((c) => c.instanceId === baseId)).toBe(true); // 6 dano >= 5 HP -> destruída
  });

  it("GD02-011: sem Base, causa dano num Shield escolhido -> Shield sai de shields e vai pra trash direto (não acumula dano, 'tem 1 HP')", () => {
    let state = stripBase(freshGame(), "B");
    const moebiusId = placeCard(state, "A", GD02_CARD_DEFS["GD02-011"], "battleArea");
    const targetShieldId = state.players.B.shields[0].instanceId;
    const shieldCountBefore = state.players.B.shields.length;
    state = { ...state, phase: "main" };
    state = declareAttack(state, moebiusId, "player");
    state = proceedToBlockStep(state);
    state = skipBlock(state);
    state = applyPlayerAction(state, "B", { kind: "passAction" }, GD02_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver);

    const next = applyPlayerAction(
      state,
      "A",
      { kind: "activateAbility", sourceInstanceId: moebiusId, targets: { target: [targetShieldId] } },
      GD02_EFFECT_SPECS,
      defaultPredicateResolver,
      defaultTargetFilterResolver,
    );

    expect(next.players.B.shields).toHaveLength(shieldCountBefore - 1);
    expect(next.players.B.shields.some((c) => c.instanceId === targetShieldId)).toBe(false);
    expect(next.players.B.trash.some((c) => c.instanceId === targetShieldId)).toBe(true);
  });

  it("GD02-011: atacante se autodestrói no Action Step (custo) — regressão do bug real achado na revalidação: resolveDamageStep NÃO deve causar dano de batalha sem atacante em campo (shield 'de graça' apesar de AP efetivo 0)", () => {
    let state = stripBase(freshGame(), "B");
    const moebiusId = placeCard(state, "A", GD02_CARD_DEFS["GD02-011"], "battleArea");
    const targetShieldId = state.players.B.shields[0].instanceId;
    const shieldCountBeforeAbility = state.players.B.shields.length;
    state = { ...state, phase: "main" };
    state = declareAttack(state, moebiusId, "player");
    state = proceedToBlockStep(state);
    state = skipBlock(state);
    state = applyPlayerAction(state, "B", { kind: "passAction" }, GD02_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver);

    let next = applyPlayerAction(
      state,
      "A",
      { kind: "activateAbility", sourceInstanceId: moebiusId, targets: { target: [targetShieldId] } },
      GD02_EFFECT_SPECS,
      defaultPredicateResolver,
      defaultTargetFilterResolver,
    );
    // 1 shield já saiu (a ação em si), atacante já está na lixeira.
    expect(next.players.B.shields).toHaveLength(shieldCountBeforeAbility - 1);
    expect(findCard(next, moebiusId).zone).toBe("trash");

    // Bug real achado nesta revalidação, corrigido na causa raiz (combat.ts,
    // guard `attacker.zone !== "battleArea"`): sem o fix, mesmo um atacante já
    // destruído (AP efetivo 0 ou não — shieldDamageEvents quebra por CONTAGEM
    // fixa, nunca proporcional ao AP) ainda estourava 1 Shield "de graça" no
    // Damage Step seguinte. Alterna prioridade até os 2 passarem em sequência.
    const shieldsBeforeDamageStep = next.players.B.shields.length;
    expect(() => {
      while (next.combat?.step === "action") {
        const priority = next.combat.actionPriority;
        next = applyPlayerAction(next, priority, { kind: "passAction" }, GD02_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver);
      }
    }).not.toThrow();
    expect(next.players.B.shields.length).toBe(shieldsBeforeDamageStep);
  });

  it("GD02-096 Desil Galette (When Linked): deploya a Unit (Vagan) Lv<=2 escolhida da lixeira pagando o CUSTO IMPRESSO dela (variável, não o custo de Desil Galette)", () => {
    let state = freshGame();
    const sourceId = placeCard(state, "A", GD02_CARD_DEFS["GD02-096"], "battleArea");
    const cheapVaganId = placeCard(state, "A", { ...GD02_CARD_DEFS["GD02-018"], traits: ["Vagan"], level: 2, cost: 3 }, "trash");
    addActiveResources(state, "A", 5);

    const spec = GD02_EFFECT_SPECS.find((s) => s.cardCode === "GD02-096" && s.trigger === "When Linked")!;
    expect(spec).toBeDefined();

    const ctx = { ...ctxFor(state, sourceId, { trashSearch: [cheapVaganId] }), targets: { trashSearch: [cheapVaganId] } };
    state = applyEvents(state, resolveEffectSpec(spec, ctx, defaultPredicateResolver));

    expect(state.players.A.battleArea.some((c) => c.instanceId === cheapVaganId)).toBe(true);
    expect(state.players.A.trash.some((c) => c.instanceId === cheapVaganId)).toBe(false);
    // pagou EXATAMENTE 3 (custo da carta escolhida), não o custo/nível de Desil Galette
    expect(state.players.A.resourceArea.filter((r) => !r.rested)).toHaveLength(2);
  });

  it("GD02-096: sem escolha (declina o 'you may'), nada acontece — nenhum Recurso pago, nada sai da lixeira", () => {
    let state = freshGame();
    const sourceId = placeCard(state, "A", GD02_CARD_DEFS["GD02-096"], "battleArea");
    placeCard(state, "A", { ...GD02_CARD_DEFS["GD02-018"], traits: ["Vagan"], level: 2, cost: 3 }, "trash");
    addActiveResources(state, "A", 5);

    const spec = GD02_EFFECT_SPECS.find((s) => s.cardCode === "GD02-096" && s.trigger === "When Linked")!;
    state = applyEvents(state, resolveEffectSpec(spec, ctxFor(state, sourceId), defaultPredicateResolver));

    expect(state.players.A.resourceArea.filter((r) => !r.rested)).toHaveLength(5);
  });

  it("GD02-110 Awakened Power (Main): deploya 1 Unit Lv<=5 escolhida da lixeira pagando o custo impresso dela; carta que não casa o filtro (Lv6) lança", () => {
    let state = freshGame();
    const sourceId = placeCard(state, "A", GD02_CARD_DEFS["GD02-110"], "hand");
    const cheapUnitId = placeCard(state, "A", { ...GD02_CARD_DEFS["GD02-018"], level: 5, cost: 2 }, "trash");
    addActiveResources(state, "A", 4);

    const spec = GD02_EFFECT_SPECS.find((s) => s.cardCode === "GD02-110" && s.trigger === "Main")!;
    expect(spec).toBeDefined();

    const ctx = { ...ctxFor(state, sourceId, { trashSearch: [cheapUnitId] }), targets: { trashSearch: [cheapUnitId] } };
    state = applyEvents(state, resolveEffectSpec(spec, ctx, defaultPredicateResolver));
    expect(state.players.A.battleArea.some((c) => c.instanceId === cheapUnitId)).toBe(true);
    expect(state.players.A.resourceArea.filter((r) => !r.rested)).toHaveLength(2);

    const badState = freshGame();
    const sourceId2 = placeCard(badState, "A", GD02_CARD_DEFS["GD02-110"], "hand");
    const highLevelUnitId = placeCard(badState, "A", { ...GD02_CARD_DEFS["GD02-018"], level: 6, cost: 1 }, "trash");
    addActiveResources(badState, "A", 4);
    const ctx2 = { ...ctxFor(badState, sourceId2, { trashSearch: [highLevelUnitId] }), targets: { trashSearch: [highLevelUnitId] } };
    expect(() => resolveEffectSpec(spec, ctx2, defaultPredicateResolver)).toThrow(/não casa o filtro do efeito/);
  });

  it("GD02-071 Gundam Mk-II (AEUG) (achado da revalidação): pairFromHandSearch agora tem entrada de fila real (handChoice) — antes só funcionava via resolveEffectSpec direto de teste", () => {
    let state = freshGame();
    state = { ...state, phase: "main" };
    const mkIIId = placeCard(state, "A", GD02_CARD_DEFS["GD02-071"], "hand");
    addActiveResources(state, "A", 4); // GD02-071 é Lv.4 — canPayLevel exige resourceArea.length >= 4
    placeCard(state, "A", { ...GD02_CARD_DEFS["GD02-121"], color: "white" }, "baseSection"); // condição do spec: Base branca em campo
    const aeugPilotId = placeCard(state, "A", { ...GD02_CARD_DEFS["GD02-099"], traits: ["AEUG"] }, "hand");

    const next = deployCard(state, "A", mkIIId, { specs: GD02_EFFECT_SPECS, predicateResolver: defaultPredicateResolver, targetFilterResolver: defaultTargetFilterResolver });

    const decision = next.pendingDecision.A;
    expect(decision?.kind).toBe("abilityResolution");
    if (decision?.kind === "abilityResolution") {
      const entry = decision.queue.find((q) => q.specId === "GD02-071-Deploy");
      expect(entry?.handChoice?.legalHandIds).toContain(aeugPilotId);
    }
  });

  it("DEFERRED_CLAUSES não tem mais entradas GD02-011/096/110 — Classe G fechada", () => {
    const stillDeferred = ["GD02-011", "GD02-096", "GD02-110"];
    expect(DEFERRED_CLAUSES.some((d) => stillDeferred.includes(d.cardCode))).toBe(false);
  });
});

describe("GD02 — correções da revisão semântica (W0.3)", () => {
  const specsOf = (code: string) => GD02_EFFECT_SPECS.filter((s) => s.cardCode === code);

  it("GD02-102/114/115: 【Main】 e 【Action】, com o filtro do texto", () => {
    for (const [code, filter] of [["GD02-102", "trait:Titans"], ["GD02-114", "damaged"], ["GD02-115", "trait:Vulture"]] as const) {
      const specs = specsOf(code);
      expect(specs.map((s) => s.trigger).sort()).toEqual(["Action", "Main"]);
      expect(specs.every((s) => s.targetFilter === filter)).toBe(true);
    }
  });

  it("GD02-117: o 【Burst】 busca Base (AEUG) no trash; o 【Main】 compra 3 e descarta 2", () => {
    const burst = specsOf("GD02-117").find((s) => s.trigger === "Burst");
    expect(burst?.actions[0]).toMatchObject({ op: "searchTrashToHand", filter: { cardType: "BASE", anyTrait: ["AEUG"] } });
    const main = specsOf("GD02-117").find((s) => s.trigger === "Main");
    expect(main?.actions.map((a) => a.op)).toEqual(["draw", "discardNamed"]);
  });

  it("nenhuma Unit/Pilot de GD02 tem spec de 【Main】/【Action】 (só Command joga esses gatilhos)", () => {
    const dead = GD02_EFFECT_SPECS.filter(
      (s) => (s.trigger === "Main" || s.trigger === "Action") && GD02_CARD_DEFS[s.cardCode]?.cardType !== "COMMAND",
    );
    expect(dead.map((s) => s.id)).toEqual([]);
  });

  it("GD02-121: o escudo e a cura são specs separados (sem alvo azul, o escudo ainda vem)", () => {
    const deploys = specsOf("GD02-121").filter((s) => s.trigger === "Deploy");
    expect(deploys).toHaveLength(2);
    expect(deploys.find((s) => !s.targetScope)?.actions[0].op).toBe("addShieldToHand");
    expect(deploys.find((s) => s.targetScope)?.targetFilter).toBe("color:blue");
  });

  it("GD02-124 (Base): Units verdes (Earth Federation) +1 AP no seu turno com Lv.7+", async () => {
    const { effectiveAp } = await import("../engine/types");
    const state = freshGame();
    state.players.A.baseSection.splice(0);
    placeCard(state, "A", GD02_CARD_DEFS["GD02-124"], "baseSection");
    const green = { code: "X-G", nameEn: "G", cardType: "UNIT", color: "green", ap: 2, hp: 2, traits: ["Earth Federation"] } as CardDef;
    const unitId = placeCard(state, "A", green, "battleArea");
    const ap = () => effectiveAp(findCard(state, unitId), state);
    state.players.A.resourceArea.splice(0);
    expect(ap()).toBe(2);
    for (let i = 0; i < 7; i++) placeCard(state, "A", { code: "R", nameEn: "R", cardType: "RESOURCE", color: "colorless" } as CardDef, "resourceArea");
    state.activePlayer = "A";
    expect(ap()).toBe(3);
  });

  it("GD02-020: 【During Link】 This Unit gets AP+2 virou efeito contínuo (o spec 'DuringLink' não disparava)", () => {
    expect(specsOf("GD02-020").map((s) => s.trigger)).toEqual(["Deploy"]);
    expect(GD02_CARD_DEFS["GD02-020"].staticAbilities?.[0]).toMatchObject({ condition: "duringLink", stat: "ap", amount: 2 });
  });
});
