import { describe, expect, it } from "vitest";
import { createGame } from "./setup";
import type { GameState } from "./types";
import { applyEvent } from "./events";
import { applyPlayerAction } from "./actions";
import { enumerateLegalActions } from "./legalActions";
import { legalMenuFor } from "./legalMenu";
import { placeCard } from "./__testkit__/cardHarness";
import { buildSt01DeckList } from "../fixtures/st01Deck";
import { buildSt02DeckList } from "../fixtures/st02Deck";
import { getCardDefByCode } from "../content/allCardDefs";
import { ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver } from "../content";

/**
 * BUG-QW8NEV (produção, 2026-10-26) — 【Burst】 com alvo ("Choose 1 enemy Unit", GD05-110 Darkness Finger e mais
 * 23 cartas): a tela só mandava `activate: true`, sem alvo, e o motor recusava com "Alvo inválido pra …-Burst".
 * A decisão de 【Burst】 não carrega alvo; o menu de jogadas (`legalMenuFor`) é quem diz à tela quais Units ela
 * precisa oferecer.
 */

const opts = { predicateResolver: defaultPredicateResolver, targetFilterResolver: defaultTargetFilterResolver };

function def(code: string) {
  const d = getCardDefByCode(code);
  if (!d) throw new Error(`carta ${code} fora do catálogo`);
  return d;
}

function pendingBurst(code: string, enemyCodes = ["GD05-027", "GD05-021"]): { state: GameState; burstId: string; enemyIds: string[] } {
  let state = createGame(buildSt01DeckList(), buildSt02DeckList(), { seed: 11, firstPlayer: "B" });
  state.players.A.battleArea = [];
  state.players.B.battleArea = [];
  const enemyIds = enemyCodes.map((c) => placeCard(state, "B", def(c), "battleArea"));
  const burstId = placeCard(state, "A", def(code), "trash");
  state = applyEvent(state, {
    type: "SET_PENDING_DECISION",
    player: "A",
    decision: { kind: "burst", cardInstanceId: burstId, cardDef: def(code), choices: [], queuedInstanceIds: [], pendingDestroyed: [] },
  });
  return { state, burstId, enemyIds };
}

describe("【Burst】 com alvo — menu de jogadas (BUG-QW8NEV)", () => {
  it("GD05-110 Darkness Finger: o menu traz as Units inimigas como alvo do 【Burst】, e o motor aceita cada uma", () => {
    const { state, enemyIds } = pendingBurst("GD05-110");
    const menu = legalMenuFor(state, "A", ALL_EFFECT_SPECS, opts);
    expect(menu.burstTarget).toEqual({ name: "target", legalTargets: expect.arrayContaining(enemyIds), min: 1, max: 1 });
    expect(menu.burstTarget?.legalTargets).toHaveLength(enemyIds.length);

    for (const id of enemyIds) {
      const after = applyPlayerAction(state, "A", { kind: "resolveBurstDecision", activate: true, targets: { target: [id] } }, ALL_EFFECT_SPECS, opts.predicateResolver, opts.targetFilterResolver);
      expect(after.players.B.battleArea.find((u) => u.instanceId === id)?.damage ?? "destruída").not.toBe(0);
    }
  });

  it("os alvos do menu são os mesmos que a enumeração de jogadas legais oferece (fonte da verdade)", () => {
    const { state } = pendingBurst("GD05-110");
    const menu = legalMenuFor(state, "A", ALL_EFFECT_SPECS, opts);
    const enumerated = enumerateLegalActions(state, "A", ALL_EFFECT_SPECS, opts).flatMap((a) =>
      a.kind === "resolveBurstDecision" && a.activate ? (a.targets?.target ?? []) : [],
    );
    expect([...(menu.burstTarget?.legalTargets ?? [])].sort()).toEqual([...enumerated].sort());
  });

  it("GD04-117 (1 a 2 Units Lv.3 ou menos): o slot devolve o pool inteiro com min 1 / max 2", () => {
    const { state, enemyIds } = pendingBurst("GD04-117", ["GD05-027", "GD05-027"]);
    const slot = legalMenuFor(state, "A", ALL_EFFECT_SPECS, opts).burstTarget;
    expect(slot).toMatchObject({ name: "target", min: 1, max: 2 });
    expect([...(slot?.legalTargets ?? [])].sort()).toEqual([...enemyIds].sort());
  });

  it("【Burst】 sem alvo (Archangel, GD05-123): sem slot — 'Ativar efeito' segue direto", () => {
    const { state } = pendingBurst("GD05-123");
    expect(legalMenuFor(state, "A", ALL_EFFECT_SPECS, opts).burstTarget).toBeUndefined();
  });

  it("【Burst】 com alvo mas sem Unit inimiga em campo: sem slot (o efeito não ativa, a carta segue)", () => {
    const { state } = pendingBurst("GD05-110");
    state.players.B.battleArea = [];
    expect(legalMenuFor(state, "A", ALL_EFFECT_SPECS, opts).burstTarget).toBeUndefined();
  });

  it("o oponente (sem a decisão) não recebe o slot", () => {
    const { state } = pendingBurst("GD05-110");
    expect(legalMenuFor(state, "B", ALL_EFFECT_SPECS, opts).burstTarget).toBeUndefined();
  });
});
