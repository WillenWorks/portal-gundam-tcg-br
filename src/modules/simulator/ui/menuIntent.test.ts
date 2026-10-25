import { describe, expect, it } from "vitest";
import type { LegalMenu } from "../engine/legalMenu";
import { abilityTargetsFromMenu, fieldAbilityFromMenu } from "./menuIntent";

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
