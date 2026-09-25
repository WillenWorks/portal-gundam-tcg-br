import { describe, expect, it } from "vitest";
import { applyPlayerAction } from "../actions";
import { viewStateFor } from "../viewState";
import { EffectActionBudget, evaluateAction } from "./actionLookahead";
import {
  DEATHRATTLE_UNIT,
  DRAW,
  REMOVAL,
  SELF_BURN,
  SPECS,
  UNIT,
  combatWithPriorityA,
  mainBoard,
  put,
  settlePolicy,
} from "./lookaheadTestFixtures";

const opts = { specs: SPECS, settlePolicy };

describe("evaluateAction — núcleo", () => {
  it("Comando de compra na Main → delta > 0", () => {
    const state = mainBoard();
    const cmd = put(state, "A", "hand", DRAW);
    const out = evaluateAction(viewStateFor(state, "A"), { kind: "playCommand", cardInstanceId: cmd.instanceId, trigger: "Main" }, opts);
    expect(out).not.toBeNull();
    expect(out!.delta).toBeGreaterThan(0);
  });

  it("efeito que prejudica o próprio bot → delta < 0", () => {
    const state = mainBoard();
    const cmd = put(state, "A", "hand", SELF_BURN);
    const out = evaluateAction(viewStateFor(state, "A"), { kind: "playCommand", cardInstanceId: cmd.instanceId, trigger: "Main" }, opts);
    expect(out!.delta).toBeLessThan(0);
  });

  it("ação recusada no estado determinizado → null (não lança)", () => {
    const state = mainBoard();
    expect(evaluateAction(viewStateFor(state, "A"), { kind: "playCommand", cardInstanceId: "inexistente", trigger: "Main" }, opts)).toBeNull();
  });

  it("determinística: mesma entrada → mesmo delta", () => {
    const state = mainBoard();
    const cmd = put(state, "A", "hand", DRAW);
    const view = viewStateFor(state, "A");
    const action = { kind: "playCommand" as const, cardInstanceId: cmd.instanceId, trigger: "Main" as const };
    expect(evaluateAction(view, action, opts)!.delta).toBe(evaluateAction(view, action, opts)!.delta);
  });

  it("não vaza informação oculta: trocar a mão real do oponente não muda o delta", () => {
    const a = mainBoard();
    const cmdA = put(a, "A", "hand", DRAW);
    put(a, "B", "hand", UNIT("LA-OPP-1", 1, 1));
    const b = mainBoard();
    const cmdB = put(b, "A", "hand", DRAW);
    put(b, "B", "hand", UNIT("LA-OPP-2", 9, 9));
    // mesmo instanceId pra ação ser idêntica
    cmdB.instanceId = cmdA.instanceId;
    const action = { kind: "playCommand" as const, cardInstanceId: cmdA.instanceId, trigger: "Main" as const };
    expect(evaluateAction(viewStateFor(a, "A"), action, opts)!.delta).toBe(evaluateAction(viewStateFor(b, "A"), action, opts)!.delta);
  });
});

describe("evaluateAction — decisões que o próprio efeito abre", () => {
  it("【Destroyed】 'you may' do oponente disparado pelo efeito é resolvido na simulação", () => {
    const state = mainBoard();
    const cmd = put(state, "A", "hand", REMOVAL);
    const enemy = put(state, "B", "battleArea", DEATHRATTLE_UNIT);
    const action = { kind: "playCommand" as const, cardInstanceId: cmd.instanceId, trigger: "Main" as const, targets: { target: [enemy.instanceId] } };
    const opened = applyPlayerAction(state, "A", action, SPECS);
    expect(opened.pendingDecision.B).not.toBeNull();
    const out = evaluateAction(viewStateFor(state, "A"), action, opts);
    expect(out).not.toBeNull();
    expect(out!.delta).toBeGreaterThan(0);
  });
});

describe("evaluateAction — resultado de batalha", () => {

  it("pump que vira a batalha (atacante 3 AP vs defensor 4 HP) → delta claramente > 0", () => {
    const { state, attacker, pump } = combatWithPriorityA(3);
    const out = evaluateAction(
      viewStateFor(state, "A"),
      { kind: "playCommand", cardInstanceId: pump.instanceId, trigger: "Action", targets: { target: [attacker.instanceId] } },
      opts,
    );
    expect(out!.delta).toBeGreaterThan(1);
  });

  it("pump irrelevante (atacante já destrói o defensor) → delta ≤ 0 (só gasta recurso)", () => {
    const { state, attacker, pump } = combatWithPriorityA(9);
    const out = evaluateAction(
      viewStateFor(state, "A"),
      { kind: "playCommand", cardInstanceId: pump.instanceId, trigger: "Action", targets: { target: [attacker.instanceId] } },
      opts,
    );
    expect(out!.delta).toBeLessThanOrEqual(0);
  });
});

describe("evaluateAction — guardas", () => {
  it("orçamento de tempo estourado → null", () => {
    const state = mainBoard();
    const cmd = put(state, "A", "hand", DRAW);
    let t = 0;
    const out = evaluateAction(viewStateFor(state, "A"), { kind: "playCommand", cardInstanceId: cmd.instanceId, trigger: "Main" }, {
      ...opts,
      budgetMs: 5,
      now: () => (t += 10),
    });
    expect(out).toBeNull();
  });

  it("EffectActionBudget limita ativações da mesma fonte por turno", () => {
    const budget = new EffectActionBudget(2);
    const action = { kind: "activateAbility" as const, sourceInstanceId: "u-1" };
    expect(budget.allows(3, action)).toBe(true);
    budget.record(3, action);
    budget.record(3, action);
    expect(budget.allows(3, action)).toBe(false);
    expect(budget.allows(4, action)).toBe(true);
  });
});
