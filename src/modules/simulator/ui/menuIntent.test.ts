import { describe, expect, it } from "vitest";
import type { LegalMenu } from "../engine/legalMenu";
import {
  abilityTargetsFromMenu,
  altDiscardIdsFromMenu,
  attackTargetsFromMenu,
  blockerIdsFromMenu,
  commandSecondaryFromMenu,
  commandTargetsFromMenu,
  fieldAbilityFromMenu,
  handModesFromMenu,
  normalCommandFromMenu,
  pairTargetsFromMenu,
  sacrificeIdsFromMenu,
} from "./menuIntent";

const menu: LegalMenu = {
  active: true,
  passes: ["passAction"],
  entries: [
    { kind: "activateAbility", sourceInstanceId: "aerial", trigger: "Activate·Action", resourceCost: 0, slots: [{ name: "target", legalTargets: ["e1", "e2"], min: 1, max: 1 }] },
    { kind: "activateAbility", sourceInstanceId: "base", trigger: "Activate·Main", resourceCost: 2, slots: [] },
    { kind: "activateAbility", sourceInstanceId: "geara", trigger: "Activate·Main", resourceCost: 0, support: true, slots: [{ name: "target", legalTargets: ["u1"], min: 1, max: 1 }] },
    { kind: "declareAttack", attackerId: "aerial", targets: ["player"] },
  ],
};

describe("menuIntent", () => {
  it("habilidade oferecida pelo motor vira FieldAbility com tipo, custo e alvo", () => {
    expect(fieldAbilityFromMenu(menu, "aerial")).toEqual({ kind: "activateAction", cost: 0, needsTarget: true });
    expect(fieldAbilityFromMenu(menu, "base")).toEqual({ kind: "activateMain", cost: 2, needsTarget: false });
    expect(fieldAbilityFromMenu(menu, "geara")).toEqual({ kind: "support", cost: 0, needsTarget: true });
  });

  it("carta sem habilidade no menu: sem botão", () => {
    expect(fieldAbilityFromMenu(menu, "outra")).toBeNull();
    expect(fieldAbilityFromMenu({ active: false, entries: [], passes: [] }, "aerial")).toBeNull();
  });

  it("alvos vêm do slot do motor", () => {
    expect(abilityTargetsFromMenu(menu, "aerial")).toEqual({ legalTargetInstanceIds: new Set(["e1", "e2"]), requiredTargetCount: 1, maxTargetCount: 1 });
    expect(abilityTargetsFromMenu(menu, "base")).toBeNull();
  });
});

describe("menuIntent — mão", () => {
  const hand: LegalMenu = {
    active: true,
    passes: ["finishTurn"],
    entries: [
      { kind: "deployCard", cardInstanceId: "unit", standalone: true, pairWithUnitIds: [], sacrificeIds: [] },
      { kind: "deployCard", cardInstanceId: "pilot", standalone: false, pairWithUnitIds: ["u1", "u2"], sacrificeIds: [] },
      { kind: "playCommand", cardInstanceId: "cmd", trigger: "Main", slots: [{ name: "target", legalTargets: ["e1"], min: 1, max: 1 }, { name: "friendly", legalTargets: ["u1"], min: 1, max: 1 }] },
      { kind: "playCommand", cardInstanceId: "alt", trigger: "Main", altCostDiscardId: "d1", slots: [] },
      { kind: "deployCard", cardInstanceId: "dual", standalone: false, pairWithUnitIds: ["u1"], sacrificeIds: [] },
      { kind: "playCommand", cardInstanceId: "dual", trigger: "Main", slots: [] },
      { kind: "deployCard", cardInstanceId: "unicorn", standalone: false, pairWithUnitIds: [], sacrificeIds: ["s1"] },
    ],
  };

  it("modos de jogo vêm das entradas do motor", () => {
    expect(handModesFromMenu(hand, "unit")).toEqual(["deploy"]);
    expect(handModesFromMenu(hand, "dual")).toEqual(["deploy", "commandMain"]);
    expect(handModesFromMenu(hand, "cmd")).toEqual(["commandMain"]);
    expect(handModesFromMenu(hand, "fora")).toEqual([]);
    // só pelo sacrifício: não é um deploy normal
    expect(handModesFromMenu(hand, "unicorn")).toEqual([]);
    expect(sacrificeIdsFromMenu(hand, "unicorn")).toEqual(["s1"]);
  });

  it("custo alternativo: só pelo descarte quando o custo normal não cabe", () => {
    expect(normalCommandFromMenu(hand, "alt", "Main")).toBe(false);
    expect(altDiscardIdsFromMenu(hand, "alt")).toEqual(["d1"]);
    expect(normalCommandFromMenu(hand, "cmd", "Main")).toBe(true);
  });

  it("pareamento e alvos da Command (principal e 2º)", () => {
    expect(pairTargetsFromMenu(hand, "pilot")?.legalTargetInstanceIds).toEqual(new Set(["u1", "u2"]));
    expect(pairTargetsFromMenu(hand, "unit")).toBeNull();
    expect(commandTargetsFromMenu(hand, "cmd", "Main")?.legalTargetInstanceIds).toEqual(new Set(["e1"]));
    expect(commandSecondaryFromMenu(hand, "cmd", "Main")).toEqual({ name: "friendly", ids: new Set(["u1"]) });
    expect(commandTargetsFromMenu(hand, "alt", "Main", "d1")).toBeNull();
  });
});

describe("menuIntent — combate", () => {
  const combat: LegalMenu = {
    active: true,
    passes: ["finishTurn"],
    entries: [
      { kind: "declareAttack", attackerId: "a1", targets: ["player", { unitId: "e1" }] },
      { kind: "declareAttack", attackerId: "a2", targets: [{ unitId: "e2" }] },
      { kind: "activateBlocker", blockerId: "b1" },
    ],
  };

  it("alvos de ataque por Unit, incluindo quando o jogador não pode ser alvo", () => {
    expect(attackTargetsFromMenu(combat, "a1")).toEqual({ player: true, unitIds: new Set(["e1"]) });
    expect(attackTargetsFromMenu(combat, "a2")).toEqual({ player: false, unitIds: new Set(["e2"]) });
    expect(attackTargetsFromMenu(combat, "a3")).toBeNull();
  });

  it("bloqueadores vêm do motor", () => {
    expect(blockerIdsFromMenu(combat)).toEqual(new Set(["b1"]));
  });
});
