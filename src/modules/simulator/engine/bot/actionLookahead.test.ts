import { describe, expect, it } from "vitest";
import { createGame } from "../setup";
import { advanceToMainPhase } from "../phases";
import { applyPlayerAction } from "../actions";
import { viewStateFor } from "../viewState";
import type { CardDef, CardInstance, GameState, PlayerId, Zone } from "../types";
import type { EffectSpec } from "../effectSpec";
import { validatedDeckList } from "../../content/index";
import { heuristicPolicy } from "./heuristicPolicy";
import { EffectActionBudget, evaluateAction } from "./actionLookahead";

const decks = validatedDeckList();
const deckBuild = (id: string) => decks.find((d) => d.id === id)!.build;
const settlePolicy = heuristicPolicy({ level: "normal" });

let seq = 0;
function put(state: GameState, player: PlayerId, zone: Zone, def: CardDef, rested = false): CardInstance {
  const card: CardInstance = {
    instanceId: `${player}-lafx-${seq++}`,
    def,
    owner: player,
    zone,
    rested,
    damage: 0,
    statModifiers: [],
    keywordGrants: [],
    usedKeywordsThisTurn: [],
    enteredZoneOnTurn: state.turnNumber - 1,
  };
  state.players[player][zone].push(card);
  return card;
}

const RESOURCE: CardDef = { code: "LA-RES", nameEn: "Res", cardType: "RESOURCE", color: "blue" };
const command = (code: string, cost = 1): CardDef => ({
  code,
  nameEn: code,
  cardType: "COMMAND",
  color: "blue",
  level: 1,
  cost,
  triggerKeywords: ["Main", "Action"],
});
const spec = (code: string, trigger: string, actions: EffectSpec["actions"], targetScope?: EffectSpec["targetScope"]): EffectSpec => ({
  id: `${code}-${trigger}`,
  cardCode: code,
  trigger,
  actions,
  targetScope,
  sourceText: "",
});
const UNIT = (code: string, ap: number, hp: number): CardDef => ({ code, nameEn: code, cardType: "UNIT", color: "blue", level: 1, cost: 1, ap, hp });

const DRAW = command("LA-DRAW");
const REMOVAL = command("LA-KILL");
const DEATHRATTLE_UNIT = UNIT("LA-DR", 2, 2);
const SELF_BURN = command("LA-BURN");
const BATTLE_PUMP = command("LA-PUMP");
const SPECS: EffectSpec[] = [
  spec("LA-DRAW", "Main", [{ op: "draw", player: "controller", n: 2 }]),
  spec("LA-KILL", "Main", [{ op: "destroy", target: { kind: "named", name: "target" } }], "enemyUnit"),
  { ...spec("LA-DR", "Destroyed", [{ op: "draw", player: "controller", n: 1 }]), optional: true },
  spec("LA-BURN", "Main", [{ op: "damageShield", player: "controller", count: 1 }]),
  spec("LA-PUMP", "Action", [{ op: "modifyStat", target: { kind: "named", name: "target" }, stat: "ap", amount: 3, duration: "thisBattle" }], "friendlyUnit"),
];

function mainBoard(): GameState {
  const state = advanceToMainPhase(createGame(deckBuild("ST01")(), deckBuild("ST02")(), { seed: 11, firstPlayer: "A" }));
  for (const id of ["A", "B"] as const) {
    state.players[id].hand = [];
    state.players[id].battleArea = [];
    state.players[id].resourceArea = [];
  }
  put(state, "A", "resourceArea", RESOURCE);
  put(state, "A", "resourceArea", RESOURCE);
  return state;
}

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
  /** A ataca a Unit rested de B; B pula bloqueio e passa → prioridade de A no Action Step */
  function combatWithPriorityA(attackerAp: number): { state: GameState; attacker: CardInstance; pump: CardInstance } {
    const state = mainBoard();
    const attacker = put(state, "A", "battleArea", UNIT("LA-ATK", attackerAp, 3));
    const defender = put(state, "B", "battleArea", UNIT("LA-DEF", 4, 4), true);
    const pump = put(state, "A", "hand", BATTLE_PUMP);
    let s = applyPlayerAction(state, "A", { kind: "declareAttack", attackerId: attacker.instanceId, target: { unitId: defender.instanceId } }, SPECS);
    if (s.combat?.step === "block") s = applyPlayerAction(s, "B", { kind: "skipBlock" }, SPECS);
    if (s.combat?.step === "action" && s.combat.actionPriority === "B") s = applyPlayerAction(s, "B", { kind: "passAction" }, SPECS);
    expect(s.combat?.step).toBe("action");
    expect(s.combat?.actionPriority).toBe("A");
    return { state: s, attacker, pump };
  }

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
