import { describe, expect, it } from "vitest";
import type { CardDef, CardInstance } from "../engine/types";
import { abilityResourceCost, fieldAbilityFor, findActivateMainSpec } from "./abilityIntent";

let seq = 0;
function inst(def: Partial<CardDef> & Pick<CardDef, "code">, over: Partial<CardInstance> = {}): CardInstance {
  return {
    instanceId: `i-${seq++}`,
    def: { nameEn: def.code, cardType: "UNIT", color: "blue", ...def },
    owner: "A",
    zone: "battleArea",
    rested: false,
    damage: 0,
    statModifiers: [],
    keywordGrants: [],
    usedKeywordsThisTurn: [],
    enteredZoneOnTurn: 0,
    ...over,
  };
}

describe("abilityIntent", () => {
  it("findActivateMainSpec: Tallgeese (ST02-006) tem 【Activate·Main】, unidade comum não", () => {
    expect(findActivateMainSpec("ST02-006")?.trigger).toBe("Activate·Main");
    expect(findActivateMainSpec("ST01-001")).toBeUndefined();
  });

  it("abilityResourceCost: lê o `payResourceCost.n` (Tallgeese = 4)", () => {
    expect(abilityResourceCost(findActivateMainSpec("ST02-006")!)).toBe(4);
  });

  it("fieldAbilityFor: Tallgeese em campo → { cost 4, needsTarget false }", () => {
    const ab = fieldAbilityFor(inst({ code: "ST02-006", oncePerTurn: true }));
    expect(ab).toEqual(expect.objectContaining({ cost: 4, needsTarget: false }));
  });

  it("fieldAbilityFor: null se já usou a habilidade neste turno (oncePerTurn)", () => {
    const used = inst({ code: "ST02-006", oncePerTurn: true }, { usedKeywordsThisTurn: ["Activate·Main"] });
    expect(fieldAbilityFor(used)).toBeNull();
  });

  it("fieldAbilityFor: null pra carta sem 【Activate·Main】", () => {
    expect(fieldAbilityFor(inst({ code: "ST01-001" }))).toBeNull();
  });
});
