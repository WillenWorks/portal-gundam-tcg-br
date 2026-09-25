import { describe, expect, it } from "vitest";
import { BOT_LEVELS, policyForLevel } from "./levelPolicies";
import { mainBoard, put, DRAW, SPECS } from "./lookaheadTestFixtures";
import { enumerateLegalActions } from "../legalActions";
import { viewStateFor } from "../viewState";

describe("policyForLevel — mesma config do bot do produto", () => {
  it("cobre os 5 níveis da escada", () => {
    expect(BOT_LEVELS).toEqual(["random", "facil", "normal", "dificil", "zero_system"]);
    for (const level of BOT_LEVELS) expect(typeof policyForLevel(level, { specs: SPECS })).toBe("function");
  });

  it("normal usa lookahead (joga Comando de compra); facil não", () => {
    const state = mainBoard();
    const cmd = put(state, "A", "hand", DRAW);
    const legal = enumerateLegalActions(state, "A", SPECS, {});
    const view = viewStateFor(state, "A");
    const rng = () => 0.42;
    expect(policyForLevel("normal", { specs: SPECS })(view, legal, rng)).toMatchObject({ kind: "playCommand", cardInstanceId: cmd.instanceId });
    expect(policyForLevel("facil", { specs: SPECS })(view, legal, rng).kind).not.toBe("playCommand");
  });

  it("random escolhe sempre uma ação legal", () => {
    const state = mainBoard();
    const legal = enumerateLegalActions(state, "A", SPECS, {});
    const chosen = policyForLevel("random", { specs: SPECS })(viewStateFor(state, "A"), legal, () => 0.99);
    expect(legal).toContainEqual(chosen);
  });

  it("nível desconhecido lança", () => {
    expect(() => policyForLevel("impossivel" as never, { specs: SPECS })).toThrow(/nível/);
  });
});

describe("policyForLevel — Zero System", () => {
  it("joga igual ao difícil (mesma escolha no mesmo ponto)", () => {
    const state = mainBoard();
    put(state, "A", "hand", DRAW);
    const legal = enumerateLegalActions(state, "A", SPECS, {});
    const view = viewStateFor(state, "A");
    const zero = policyForLevel("zero_system", { specs: SPECS, mctsRollouts: 2 })(view, legal, () => 0.42);
    const dificil = policyForLevel("dificil", { specs: SPECS, mctsRollouts: 2 })(view, legal, () => 0.42);
    expect(zero).toEqual(dificil);
  });
});
