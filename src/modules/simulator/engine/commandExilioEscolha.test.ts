/* Operation to Intercept Solomon (ST13-015) 【Main】/【Action】 "Choose 3 Unit cards from your trash. Exile them from the
 * game. If you do, choose 1 enemy Unit. Deal 3 damage to it." — o jogador escolhe QUAIS Units exilar (antes eram as 3
 * primeiras do trash) e só DEPOIS escolhe o alvo ("If you do"), na mesma ordem das habilidades com custo de exílio. */
import { describe, expect, it } from "vitest";
import { createGame } from "./setup";
import { advanceToMainPhase } from "./phases";
import { applyPlayerAction, playerHasActionStepPlay, type PlayerAction } from "./actions";
import { enumerateLegalActions } from "./legalActions";
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

/** A na Main Phase com a Command na mão, `unitsInTrash` Units no trash e 1 inimigo em campo */
function solomonReady(unitsInTrash: number) {
  const state = advanceToMainPhase(createGame(buildSt01DeckList(), buildSt02DeckList(), { seed: 7, firstPlayer: "A" }));
  for (let i = 0; i < 6; i++) placeCard(state, "A", RESOURCE, "resourceArea");
  const command = placeCard(state, "A", ALL_CARD_DEFS["ST13-015"], "hand");
  const trash = Array.from({ length: unitsInTrash }, () => placeCard(state, "A", ST01_CARD_DEFS.GM, "trash"));
  const enemy = placeCard(state, "B", ST01_CARD_DEFS.GUNDAM, "battleArea");
  return { state, command, trash, enemy };
}

const enemyCard = (s: GameState, id: string) => s.players.B.battleArea.find((c) => c.instanceId === id);

describe("Operation to Intercept Solomon ST13-015 — escolher as Units do trash e depois o alvo", () => {
  it("com mais Units que o necessário no trash, o menu não pré-escolhe o alvo (a escolha do exílio vem antes)", () => {
    const { state, command } = solomonReady(4);
    const entry = legalMenuFor(state, "A", ALL_EFFECT_SPECS, scenarioOpts).entries.find((e) => e.kind === "playCommand" && e.cardInstanceId === command);
    expect(entry).toBeDefined();
    expect(entry?.kind === "playCommand" ? entry.slots : null).toEqual([]);
  });

  it("1º as 3 Units: a decisão oferece as do trash; as escolhidas vão pro exílio e a que sobra fica", () => {
    const { state, command, trash, enemy } = solomonReady(4);
    const played = apply(state, "A", { kind: "playCommand", cardInstanceId: command, trigger: "Main" });
    expect(played.players.A.hand.some((c) => c.instanceId === command)).toBe(true);
    const d = played.pendingDecision.A;
    const q = d?.kind === "abilityResolution" ? d.queue[0] : undefined;
    expect(q?.costStage).toBe(true);
    expect(q?.trashExile).toMatchObject({ count: 3, legalTrashIds: trash });
    expect(enemyCard(played, enemy)?.damage).toBe(0);

    const chosen = [trash[3], trash[1], trash[2]];
    const exiled = apply(played, "A", { kind: "resolveAbility", resolutions: [{ specId: q!.specId, activate: true, targetIds: [], trashExileIds: chosen }] });
    expect(exiled.players.A.exile.map((c) => c.instanceId).sort()).toEqual([...chosen].sort());
    expect(exiled.players.A.trash.map((c) => c.instanceId)).toContain(trash[0]);
    // 2º o alvo, já com o exílio feito
    const eq = exiled.pendingDecision.A?.kind === "abilityResolution" ? exiled.pendingDecision.A.queue[0] : undefined;
    expect(eq?.costPaid).toBe(true);
    expect(eq?.legalTargets).toEqual([enemy]);
    expect(exiled.players.A.hand.some((c) => c.instanceId === command)).toBe(true);
  });

  it("depois do alvo: 3 de dano e a Command vai pro trash", () => {
    const { state, command, trash, enemy } = solomonReady(4);
    const played = apply(state, "A", { kind: "playCommand", cardInstanceId: command, trigger: "Main" });
    const specId = played.pendingDecision.A?.kind === "abilityResolution" ? played.pendingDecision.A.queue[0].specId : "";
    const exiled = apply(played, "A", { kind: "resolveAbility", resolutions: [{ specId, activate: true, targetIds: [], trashExileIds: trash.slice(1) }] });
    const done = apply(exiled, "A", { kind: "resolveAbility", resolutions: [{ specId, activate: true, targetIds: [enemy] }] });
    expect(enemyCard(done, enemy)?.damage ?? "destruída").not.toBe(0);
    expect(done.players.A.trash.some((c) => c.instanceId === command)).toBe(true);
    expect(done.players.A.hand.some((c) => c.instanceId === command)).toBe(false);
    expect(done.pendingDecision.A).toBeNull();
  });

  it("sem inimigo em campo: exila, a escolha do alvo vem vazia e, confirmada, a Command vai pro trash", () => {
    const { state, command, trash, enemy } = solomonReady(4);
    state.players.B.battleArea = state.players.B.battleArea.filter((c) => c.instanceId !== enemy);
    const played = apply(state, "A", { kind: "playCommand", cardInstanceId: command, trigger: "Main" });
    const specId = played.pendingDecision.A?.kind === "abilityResolution" ? played.pendingDecision.A.queue[0].specId : "";
    const exiled = apply(played, "A", { kind: "resolveAbility", resolutions: [{ specId, activate: true, targetIds: [], trashExileIds: trash.slice(0, 3) }] });
    expect(exiled.players.A.exile).toHaveLength(3);
    const eq = exiled.pendingDecision.A?.kind === "abilityResolution" ? exiled.pendingDecision.A.queue[0] : undefined;
    expect(eq?.legalTargets).toEqual([]);
    const done = apply(exiled, "A", { kind: "resolveAbility", resolutions: [{ specId, activate: true, targetIds: [] }] });
    expect(done.players.A.trash.some((c) => c.instanceId === command)).toBe(true);
    expect(done.pendingDecision.A).toBeNull();
  });

  it("com exatamente 3 Units no trash continua jogável", () => {
    const { state, command } = solomonReady(3);
    expect(enumerateLegalActions(state, "A", ALL_EFFECT_SPECS, scenarioOpts).some((a) => a.kind === "playCommand" && a.cardInstanceId === command)).toBe(true);
  });

  it("bot/fluxo antigo (alvo já na ação): resolve de uma vez, como antes", () => {
    const { state, command, enemy } = solomonReady(4);
    const done = apply(state, "A", { kind: "playCommand", cardInstanceId: command, trigger: "Main", targets: { target: [enemy] } });
    expect(done.pendingDecision.A).toBeNull();
    expect(done.players.A.exile).toHaveLength(3);
    expect(done.players.A.trash.some((c) => c.instanceId === command)).toBe(true);
  });
});

/* BUG-BM8YZN — com 1 Unit (e 2 Bases) no trash a Command foi jogada: exilou a única Unit e deu os 3 de dano. O custo não
 * pode ser pago por inteiro, então a carta não pode ser jogada (Q121 da GD01-003: "You cannot activate it if you cannot
 * choose 12 cards"). */
describe("Operation to Intercept Solomon ST13-015 — menos de 3 Units no trash", () => {
  function shortTrash(units: number) {
    const ready = solomonReady(units);
    placeCard(ready.state, "A", ALL_CARD_DEFS["GD05-128"], "trash");
    placeCard(ready.state, "A", ALL_CARD_DEFS["GD05-130"], "trash");
    return ready;
  }

  it.each([0, 1, 2])("com %i Unit(s) e 2 Bases no trash não aparece no menu nem nas jogadas legais", (units) => {
    const { state, command } = shortTrash(units);
    expect(legalMenuFor(state, "A", ALL_EFFECT_SPECS, scenarioOpts).entries.some((e) => e.kind === "playCommand" && e.cardInstanceId === command)).toBe(false);
    const raw = enumerateLegalActions(state, "A", ALL_EFFECT_SPECS, { ...scenarioOpts, validate: false });
    expect(raw.some((a) => a.kind === "playCommand" && a.cardInstanceId === command)).toBe(false);
  });

  it("o motor recusa a jogada e nada muda (sem exílio, sem dano, a Command fica na mão)", () => {
    const { state, command, enemy } = shortTrash(1);
    expect(() => apply(state, "A", { kind: "playCommand", cardInstanceId: command, trigger: "Main" })).toThrow(/trash/);
    expect(() => apply(state, "A", { kind: "playCommand", cardInstanceId: command, trigger: "Main", targets: { target: [enemy] } })).toThrow(/trash/);
    expect(state.players.A.exile).toHaveLength(0);
    expect(state.players.A.hand.some((c) => c.instanceId === command)).toBe(true);
  });

  it("não conta como jogada de Action Step (o auto-pass não espera por ela)", () => {
    const { state } = shortTrash(1);
    state.players.A.hand = state.players.A.hand.filter((c) => c.def.code === "ST13-015");
    expect(playerHasActionStepPlay(state, "A", ALL_EFFECT_SPECS)).toBe(false);
    placeCard(state, "A", ST01_CARD_DEFS.GM, "trash");
    placeCard(state, "A", ST01_CARD_DEFS.GM, "trash");
    expect(playerHasActionStepPlay(state, "A", ALL_EFFECT_SPECS)).toBe(true);
  });
});
