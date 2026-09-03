import { describe, expect, it } from "vitest";
import type { CardDef, CardInstance } from "../engine/types";
import { pairingNeedsExtraTarget, resolveDeploySelection, specNeedsNamedTarget } from "./deployIntent";
import { AMURO_RAY_WHEN_PAIRED, GUNDAM_MA_FORM_WHEN_PAIRED } from "../content/st01";

let seq = 0;
function card(def: Partial<CardDef> & Pick<CardDef, "code" | "cardType">): CardInstance {
  return {
    instanceId: `inst-${seq++}`,
    def: { nameEn: def.code, color: "blue", ...def },
    owner: "A",
    zone: "hand",
    rested: false,
    damage: 0,
    statModifiers: [],
    keywordGrants: [],
    usedKeywordsThisTurn: [],
    enteredZoneOnTurn: 0,
  };
}

const ownUnits = [
  { instanceId: "u1", code: "ST01-001", paired: false },
  { instanceId: "u2", code: "ST01-006", paired: false }, // Gundam Aerial (When Paired direcionado)
  { instanceId: "u3", code: "ST01-001", paired: true },
];

describe("deployIntent", () => {
  it("specNeedsNamedTarget: true pra 'rest target', false pra 'draw' condicional", () => {
    expect(specNeedsNamedTarget(AMURO_RAY_WHEN_PAIRED)).toBe(true);
    expect(specNeedsNamedTarget(GUNDAM_MA_FORM_WHEN_PAIRED)).toBe(false);
  });

  it("pairingNeedsExtraTarget: Amuro Ray (piloto) e Gundam Aerial (unidade) exigem alvo; ST01-002 não", () => {
    expect(pairingNeedsExtraTarget("ST01-010")).toBe(true);
    expect(pairingNeedsExtraTarget(undefined, "ST01-006")).toBe(true);
    expect(pairingNeedsExtraTarget("ST01-002")).toBe(false);
    expect(pairingNeedsExtraTarget("XX-999", "YY-000")).toBe(false);
  });

  it("carta que não é Piloto: sem pareamento", () => {
    const sel = resolveDeploySelection({ card: card({ code: "ST01-003", cardType: "UNIT" }), selected: [], ownBattleUnits: ownUnits });
    expect(sel.pairWithUnitId).toBeUndefined();
    expect(sel.error).toBeUndefined();
  });

  it("Piloto sem Unit selecionada: erro de pareamento", () => {
    const sel = resolveDeploySelection({ card: card({ code: "ST01-010", cardType: "PILOT" }), selected: [], ownBattleUnits: ownUnits });
    expect(sel.error).toMatch(/Unit própria pra parear/);
    expect(sel.pairWithUnitId).toBeUndefined();
  });

  it("Amuro Ray + Unit escolhida: sem erro, pairWithUnitId setado, marca needsWhenPairedTarget", () => {
    const sel = resolveDeploySelection({
      card: card({ code: "ST01-010", cardType: "PILOT" }),
      selected: ["u1"],
      ownBattleUnits: ownUnits,
    });
    expect(sel.pairWithUnitId).toBe("u1");
    expect(sel.needsWhenPairedTarget).toBe(true);
    expect(sel.error).toBeUndefined();
  });

  it("parear com Gundam Aerial também marca needsWhenPairedTarget (lado da Unit)", () => {
    const sel = resolveDeploySelection({
      card: card({ code: "ST99-001", cardType: "PILOT" }),
      selected: ["u2"],
      ownBattleUnits: ownUnits,
    });
    expect(sel.pairWithUnitId).toBe("u2");
    expect(sel.needsWhenPairedTarget).toBe(true);
  });

  it("Piloto comum: pareia com 1 clique, sem 【When Paired】 direcionado", () => {
    const sel = resolveDeploySelection({
      card: card({ code: "ST99-001", cardType: "PILOT" }),
      selected: ["u1"],
      ownBattleUnits: ownUnits,
    });
    expect(sel.pairWithUnitId).toBe("u1");
    expect(sel.needsWhenPairedTarget).toBe(false);
    expect(sel.error).toBeUndefined();
  });

  it("ignora Unit já pareada ao procurar a Unit de pareio", () => {
    const sel = resolveDeploySelection({
      card: card({ code: "ST01-010", cardType: "PILOT" }),
      selected: ["u3", "u1"], // u3 já pareada -> escolhe u1
      ownBattleUnits: ownUnits,
    });
    expect(sel.pairWithUnitId).toBe("u1");
  });
});
