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

describe("deployIntent", () => {
  it("specNeedsNamedTarget: true pra 'rest target', false pra 'draw' condicional", () => {
    expect(specNeedsNamedTarget(AMURO_RAY_WHEN_PAIRED)).toBe(true);
    expect(specNeedsNamedTarget(GUNDAM_MA_FORM_WHEN_PAIRED)).toBe(false);
  });

  it("pairingNeedsExtraTarget: Amuro Ray (piloto) e Gundam Aerial (unidade) exigem alvo; ST01-002 não", () => {
    expect(pairingNeedsExtraTarget("ST01-010")).toBe(true); // Amuro Ray — lado do Piloto
    expect(pairingNeedsExtraTarget(undefined, "ST01-006")).toBe(true); // Gundam Aerial — lado da Unit
    expect(pairingNeedsExtraTarget("ST01-002")).toBe(false); // Gundam MA Form — draw, sem alvo
    expect(pairingNeedsExtraTarget("XX-999", "YY-000")).toBe(false); // cartas sem spec
  });

  const ownUnits = [
    { instanceId: "u1", code: "ST01-001", paired: false },
    { instanceId: "u2", code: "ST01-006", paired: false },
    { instanceId: "u3", code: "ST01-001", paired: true },
  ];

  it("Piloto sem Unit selecionada: erro de pareamento", () => {
    const sel = resolveDeploySelection({ card: card({ code: "ST01-010", cardType: "PILOT" }), selected: [], ownBattleUnits: ownUnits });
    expect(sel.error).toMatch(/Unit própria pra parear/);
    expect(sel.pairWithUnitId).toBeUndefined();
  });

  it("Amuro Ray pareado com 1 clique só (sem alvo inimigo): bloqueia com erro de 【When Paired】", () => {
    const sel = resolveDeploySelection({
      card: card({ code: "ST01-010", cardType: "PILOT" }),
      selected: ["u1"],
      ownBattleUnits: ownUnits,
    });
    expect(sel.pairWithUnitId).toBe("u1");
    expect(sel.needsWhenPairedTarget).toBe(true);
    expect(sel.error).toMatch(/When Paired.*clique também em 1 Unit inimiga/);
  });

  it("Amuro Ray pareado + alvo inimigo escolhido: sem erro, targetIds = [inimigo]", () => {
    const sel = resolveDeploySelection({
      card: card({ code: "ST01-010", cardType: "PILOT" }),
      selected: ["u1", "enemy-1"],
      ownBattleUnits: ownUnits,
    });
    expect(sel.pairWithUnitId).toBe("u1");
    expect(sel.targetIds).toEqual(["enemy-1"]);
    expect(sel.error).toBeUndefined();
  });

  it("parear com Gundam Aerial (Unit com 【When Paired】 direcionado) também exige alvo", () => {
    const sel = resolveDeploySelection({
      card: card({ code: "ST99-001", cardType: "PILOT" }), // piloto genérico sem spec
      selected: ["u2"], // Aerial
      ownBattleUnits: ownUnits,
    });
    expect(sel.needsWhenPairedTarget).toBe(true);
    expect(sel.error).toBeTruthy();
  });

  it("Piloto comum (sem 【When Paired】 direcionado): pareia com 1 clique, sem pedir alvo", () => {
    const sel = resolveDeploySelection({
      card: card({ code: "ST99-001", cardType: "PILOT" }),
      selected: ["u1"], // ST01-001 não tem When Paired direcionado
      ownBattleUnits: ownUnits,
    });
    expect(sel.pairWithUnitId).toBe("u1");
    expect(sel.needsWhenPairedTarget).toBe(false);
    expect(sel.error).toBeUndefined();
    expect(sel.targetIds).toEqual([]);
  });

  it("deploy de Unit comum (não é Piloto): sem pareamento, targetIds = cliques", () => {
    const sel = resolveDeploySelection({
      card: card({ code: "ST01-003", cardType: "UNIT" }),
      selected: ["enemy-1"],
      ownBattleUnits: ownUnits,
    });
    expect(sel.pairWithUnitId).toBeUndefined();
    expect(sel.targetIds).toEqual(["enemy-1"]);
    expect(sel.error).toBeUndefined();
  });
});
