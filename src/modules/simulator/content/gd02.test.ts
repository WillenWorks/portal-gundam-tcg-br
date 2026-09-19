import { describe, expect, it } from "vitest";
import { createGame } from "../engine/setup";
import { advanceToMainPhase } from "../engine/phases";
import { declareAttack } from "../engine/combat";
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

function freshGame(): GameState {
  return createGame(buildSt06DeckList(), buildSt04DeckList(), { seed: 202, firstPlayer: "A" });
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
    expect(pilots).toHaveLength(16);
    expect(commands).toHaveLength(20);
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

  it("GD02-068 Gundam Barbatos causa 2 de dano a unidade alvo no Deploy", () => {
    let state = freshGame();
    const barbatosDef = GD02_CARD_DEFS["GD02-068"];
    const enemyDef = GD02_CARD_DEFS["GD02-004"];
    const sourceId = placeCard(state, "A", barbatosDef, "battleArea");
    const enemyId = placeCard(state, "B", enemyDef, "battleArea");

    const deploySpec = GD02_EFFECT_SPECS.find((s) => s.cardCode === "GD02-068" && s.trigger === "Deploy");
    expect(deploySpec).toBeDefined();

    if (deploySpec) {
      const events = resolveEffectSpec(deploySpec, ctxFor(state, sourceId, { target: [enemyId] }), defaultPredicateResolver);
      state = applyEvents(state, events);
      expect(findCard(state, enemyId).damage).toBe(2);
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
