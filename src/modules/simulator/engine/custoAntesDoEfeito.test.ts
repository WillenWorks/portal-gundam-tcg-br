/* O que vem antes do "：" é CUSTO e se paga primeiro; o alvo do efeito se escolhe depois (pedido do Willen, 2026-10-25,
 * relato da Gundam Aerial ST13-006). "Choose 1 friendly and 1 enemy" sem "：" é um efeito só — escolhas juntas. */
import { describe, expect, it } from "vitest";
import { createGame } from "./setup";
import { advanceToMainPhase } from "./phases";
import { applyPlayerAction, type PlayerAction } from "./actions";
import { actionOwner, enumerateLegalActions } from "./legalActions";
import { legalMenuFor } from "./legalMenu";
import { placeCard } from "./__testkit__/cardHarness";
import { scenarioOpts } from "./__testkit__/cardScenario";
import type { CardDef, GameState } from "./types";
import { buildSt01DeckList, ST01_CARD_DEFS } from "../fixtures/st01Deck";
import { buildSt02DeckList } from "../fixtures/st02Deck";
import { ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver } from "../content";
import { ALL_CARD_DEFS } from "../content/allCardDefs";

const RESOURCE: CardDef = { code: "CA-RES", nameEn: "Resource", cardType: "RESOURCE", color: "colorless" };
const apply = (s: GameState, seat: "A" | "B", a: PlayerAction) =>
  applyPlayerAction(s, seat, a, ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver);

/** A ataca com outra Unit e para no próprio Action Step, com a Aerial, uma Unit amiga ativa e um inimigo Lv.2 */
function aerialInActionStep() {
  let state = advanceToMainPhase(createGame(buildSt01DeckList(), buildSt02DeckList(), { seed: 7, firstPlayer: "A" }));
  for (let i = 0; i < 6; i++) placeCard(state, "A", RESOURCE, "resourceArea");
  const aerial = placeCard(state, "A", ALL_CARD_DEFS["ST13-006"], "battleArea");
  const friend = placeCard(state, "A", ST01_CARD_DEFS.GM, "battleArea");
  const attacker = placeCard(state, "A", ST01_CARD_DEFS.GUNDAM, "battleArea");
  const enemy = placeCard(state, "B", ST01_CARD_DEFS.GM, "battleArea");
  state = apply(state, "A", { kind: "declareAttack", attackerId: attacker, target: "player" });
  for (let i = 0; i < 6 && !(state.combat?.step === "action" && actionOwner(state) === "A"); i++) {
    const seat = actionOwner(state)!;
    const pass = enumerateLegalActions(state, seat, ALL_EFFECT_SPECS, scenarioOpts).find((a) => a.kind === "skipBlock" || a.kind === "passAction")!;
    state = apply(state, seat, pass);
  }
  return { state, aerial, friend, enemy };
}

const card = (s: GameState, id: string) => [...s.players.A.battleArea, ...s.players.B.battleArea].find((c) => c.instanceId === id)!;

describe("Gundam Aerial ST13-006 — 【Activate･Action】Rest 1 friendly Unit：Choose 1 enemy Unit Lv.4 or lower. Deal 1 damage", () => {
  it("o menu não pré-escolhe o alvo do efeito (a ativação pede o custo primeiro)", () => {
    const { state, aerial } = aerialInActionStep();
    const entry = legalMenuFor(state, "A", ALL_EFFECT_SPECS, scenarioOpts).entries.find((e) => e.kind === "activateAbility" && e.sourceInstanceId === aerial);
    expect(entry).toBeDefined();
    expect(entry?.kind === "activateAbility" ? entry.slots : null).toEqual([]);
  });

  it("1º o custo: a decisão só oferece Units amigas, sem alvo inimigo; pagar descansa a Unit do custo", () => {
    const { state, aerial, friend, enemy } = aerialInActionStep();
    const costStage = apply(state, "A", { kind: "activateAbility", sourceInstanceId: aerial });
    const d = costStage.pendingDecision.A;
    expect(d?.kind).toBe("abilityResolution");
    const q = d?.kind === "abilityResolution" ? d.queue[0] : undefined;
    expect(q?.costStage).toBe(true);
    expect(q?.legalTargets).toEqual([]);
    expect(q?.secondaryTarget?.legalTargets).toEqual(expect.arrayContaining([friend]));
    expect(q?.secondaryTarget?.legalTargets).not.toContain(enemy);

    const paid = apply(costStage, "A", { kind: "resolveAbility", resolutions: [{ specId: q!.specId, activate: true, targetIds: [], secondaryTargetIds: [friend] }] });
    expect(card(paid, friend).rested).toBe(true); // custo pago ANTES de escolher o alvo
    expect(card(paid, enemy).damage).toBe(0);
    const effect = paid.pendingDecision.A;
    const eq = effect?.kind === "abilityResolution" ? effect.queue[0] : undefined;
    expect(eq?.costStage).toBeUndefined();
    expect(eq?.costPaid).toBe(true);
    expect(eq?.secondaryTarget).toBeUndefined();
    expect(eq?.legalTargets).toEqual([enemy]);
  });

  it("2º o efeito: 1 de dano no inimigo; o custo não é cobrado de novo e nada além da Unit do custo descansa", () => {
    const { state, aerial, friend, enemy } = aerialInActionStep();
    const costStage = apply(state, "A", { kind: "activateAbility", sourceInstanceId: aerial });
    const specId = costStage.pendingDecision.A?.kind === "abilityResolution" ? costStage.pendingDecision.A.queue[0].specId : "";
    const paid = apply(costStage, "A", { kind: "resolveAbility", resolutions: [{ specId, activate: true, targetIds: [], secondaryTargetIds: [friend] }] });
    const done = apply(paid, "A", { kind: "resolveAbility", resolutions: [{ specId, activate: true, targetIds: [enemy] }] });
    expect(card(done, enemy).damage).toBe(1);
    expect(card(done, enemy).rested).toBe(false);
    expect(card(done, aerial).rested).toBe(false);
    expect(done.pendingDecision.A).toBeNull();
    const rests = done.eventLog.slice(state.eventLog.length).filter((e) => e.type === "REST_CARD");
    expect(rests).toEqual([{ type: "REST_CARD", instanceId: friend }]);
  });

  it("pelas jogadas legais (bot): custo, depois efeito", () => {
    const { state, aerial, enemy } = aerialInActionStep();
    let s = apply(state, "A", { kind: "activateAbility", sourceInstanceId: aerial });
    for (let i = 0; i < 3 && s.pendingDecision.A; i++) s = apply(s, "A", enumerateLegalActions(s, "A", ALL_EFFECT_SPECS, scenarioOpts)[0]);
    expect(card(s, enemy).damage).toBe(1);
  });
});

describe("custo sem escolha (\"Rest this Base：\") também se paga antes do alvo", () => {
  it("GD01-124 Side 7: ativar descansa a Base e só então pede a Unit que recupera HP", () => {
    const state = advanceToMainPhase(createGame(buildSt01DeckList(), buildSt02DeckList(), { seed: 7, firstPlayer: "A" }));
    state.players.A.baseSection = [];
    const base = placeCard(state, "A", ALL_CARD_DEFS["GD01-124"], "baseSection");
    const hurt = placeCard(state, "A", ST01_CARD_DEFS.GM, "battleArea", { damage: 1 });
    const activation = enumerateLegalActions(state, "A", ALL_EFFECT_SPECS, scenarioOpts).find((a) => a.kind === "activateAbility" && a.sourceInstanceId === base);
    expect(activation).toEqual({ kind: "activateAbility", sourceInstanceId: base }); // sem alvo embutido
    const paid = apply(state, "A", activation!);
    expect(card(paid, base)).toBeUndefined(); // Base não está na battleArea — confere direto
    expect(paid.players.A.baseSection.find((c) => c.instanceId === base)?.rested).toBe(true);
    const d = paid.pendingDecision.A;
    const q = d?.kind === "abilityResolution" ? d.queue[0] : undefined;
    expect(q).toMatchObject({ costPaid: true });
    expect(q?.legalTargets).toContain(hurt);
    const done = apply(paid, "A", { kind: "resolveAbility", resolutions: [{ specId: q!.specId, activate: true, targetIds: [hurt] }] });
    expect(card(done, hurt).damage).toBe(0);
    expect(done.eventLog.slice(state.eventLog.length).filter((e) => e.type === "REST_CARD")).toEqual([{ type: "REST_CARD", instanceId: base }]);
  });
});
