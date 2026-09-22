import { describe, expect, it } from "vitest";
import type { CombatState, PendingDecision } from "../engine/types";
import { shouldAnimateAttackStrike, shouldWaitForBurstReveal } from "./viewAnimationQueue";

function combat(overrides: Partial<CombatState> & Pick<CombatState, "step" | "attackerId">): CombatState {
  return {
    attackingPlayer: "A",
    defendingPlayer: "B",
    originalTarget: "player",
    currentTarget: "player",
    actionPasses: { A: false, B: false },
    actionPriority: "B",
    ...overrides,
  };
}

describe("shouldAnimateAttackStrike", () => {
  it("não dispara sem combate anterior (nada a animar)", () => {
    expect(shouldAnimateAttackStrike(null, combat({ step: "action", attackerId: "u1" }))).toBe(false);
  });

  it("dispara quando o combate do mesmo atacante desapareceu (settleAutoPasses resolveu tudo síncrono)", () => {
    const prev = combat({ step: "attack", attackerId: "u1" });
    expect(shouldAnimateAttackStrike(prev, null)).toBe(true);
  });

  it("dispara quando o combate chegou em battleEnd, mesmo atacante", () => {
    const prev = combat({ step: "action", attackerId: "u1" });
    const incoming = combat({ step: "battleEnd", attackerId: "u1" });
    expect(shouldAnimateAttackStrike(prev, incoming)).toBe(true);
  });

  it("dispara quando um NOVO combate (atacante diferente) já começou no lugar", () => {
    const prev = combat({ step: "attack", attackerId: "u1" });
    const incoming = combat({ step: "attack", attackerId: "u2" });
    expect(shouldAnimateAttackStrike(prev, incoming)).toBe(true);
  });

  it("NÃO dispara enquanto o mesmo combate continua em andamento (attack/block/action)", () => {
    const prev = combat({ step: "attack", attackerId: "u1" });
    expect(shouldAnimateAttackStrike(prev, combat({ step: "block", attackerId: "u1" }))).toBe(false);
    expect(shouldAnimateAttackStrike(prev, combat({ step: "action", attackerId: "u1" }))).toBe(false);
    expect(shouldAnimateAttackStrike(prev, combat({ step: "damage", attackerId: "u1" }))).toBe(false);
  });
});

describe("shouldWaitForBurstReveal", () => {
  const burst = {
    kind: "burst",
    cardInstanceId: "shield-1",
    cardDef: { code: "ST01-000", nameEn: "Test", cardType: "UNIT" },
    choices: [],
    queuedInstanceIds: [],
  } as unknown as PendingDecision;

  it("não espera sem decisão pendente", () => {
    expect(shouldWaitForBurstReveal(undefined, null)).toBe(false);
  });

  it("não espera decisão de outro tipo", () => {
    expect(shouldWaitForBurstReveal({ kind: "mulligan" } as unknown as PendingDecision, null)).toBe(false);
  });

  it("não espera um Burst já revelado", () => {
    expect(shouldWaitForBurstReveal(burst, "shield-1")).toBe(false);
  });

  it("espera um Burst novo, ainda não revelado", () => {
    expect(shouldWaitForBurstReveal(burst, null)).toBe(true);
    expect(shouldWaitForBurstReveal(burst, "outro-shield")).toBe(true);
  });
});
