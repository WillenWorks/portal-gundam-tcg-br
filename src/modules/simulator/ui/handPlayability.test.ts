import { describe, expect, it } from "vitest";
import type { CardDef } from "../engine/types";
import { isPlayableNow, playableModes, type PlayabilityContext } from "./handPlayability";

const CTX: PlayabilityContext = {
  myTurnMain: true,
  inActionStep: false,
  activeResources: 5,
  totalResources: 5,
  hasUnpairedFriendlyUnit: false,
  targetCounts: { enemyUnit: 0, friendlyUnit: 0, ownResource: 0 },
};
const ctx = (
  over: Partial<Omit<PlayabilityContext, "targetCounts">> & {
    targetCounts?: Partial<PlayabilityContext["targetCounts"]>;
  },
): PlayabilityContext => ({
  ...CTX,
  ...over,
  targetCounts: { ...CTX.targetCounts, ...(over.targetCounts ?? {}) },
});

const def = (over: Partial<CardDef>): CardDef => ({
  code: "X",
  nameEn: "X",
  cardType: "UNIT",
  color: "blue",
  ...over,
});

describe("playableModes — custo / nível", () => {
  it("Unit sem recursos ativos suficientes → injogável", () => {
    const u = def({ cardType: "UNIT", cost: 3, level: 3 });
    expect(playableModes(u, ctx({ activeResources: 2, totalResources: 5 }))).toEqual([]);
  });

  it("Unit sem nível (poucos recursos em campo) → injogável mesmo com AP ativo", () => {
    const u = def({ cardType: "UNIT", cost: 1, level: 4 });
    expect(playableModes(u, ctx({ activeResources: 5, totalResources: 3 }))).toEqual([]);
  });

  it("Unit com custo e nível satisfeitos na Main → deploy", () => {
    const u = def({ cardType: "UNIT", cost: 2, level: 2 });
    expect(playableModes(u, ctx({}))).toEqual(["deploy"]);
  });

  it("Unit fora da Main Phase → injogável", () => {
    const u = def({ cardType: "UNIT", cost: 0, level: 0 });
    expect(playableModes(u, ctx({ myTurnMain: false }))).toEqual([]);
  });
});

describe("playableModes — Pilot / pareamento", () => {
  it("Pilot nativo sem Unit amiga livre → injogável", () => {
    const p = def({ cardType: "PILOT", cost: 1, level: 1 });
    expect(playableModes(p, ctx({ hasUnpairedFriendlyUnit: false }))).toEqual([]);
  });

  it("Pilot nativo com Unit amiga livre → deploy", () => {
    const p = def({ cardType: "PILOT", cost: 1, level: 1 });
    expect(playableModes(p, ctx({ hasUnpairedFriendlyUnit: true }))).toEqual(["deploy"]);
  });
});

describe("playableModes — Command e alvos", () => {
  it("Command 【Main】 sem alvo inimigo em campo → bloqueada (Thoroughly Damaged / ST01-012)", () => {
    const c = def({
      code: "ST01-012",
      cardType: "COMMAND",
      cost: 0,
      level: 0,
      triggerKeywords: ["Main"],
      pilotMode: { pilotName: "Hayato Kobayashi", hp: 1 },
    });
    expect(playableModes(c, ctx({ targetCounts: { enemyUnit: 0 } }))).not.toContain("commandMain");
  });

  it("Command 【Main】 com alvo inimigo em campo → commandMain liberado", () => {
    const c = def({
      code: "ST01-012",
      cardType: "COMMAND",
      cost: 0,
      level: 0,
      triggerKeywords: ["Main"],
      pilotMode: { pilotName: "Hayato Kobayashi", hp: 1 },
    });
    expect(playableModes(c, ctx({ targetCounts: { enemyUnit: 1 } }))).toContain("commandMain");
  });

  it("Command 【Action】 só sai num Action Step", () => {
    const c = def({ code: "C-ACT", cardType: "COMMAND", cost: 0, level: 0, triggerKeywords: ["Action"] });
    expect(playableModes(c, ctx({ myTurnMain: true, inActionStep: false }))).toEqual([]);
    expect(playableModes(c, ctx({ myTurnMain: false, inActionStep: true }))).toEqual(["commandAction"]);
  });
});

describe("isPlayableNow", () => {
  it("resume playableModes num booleano", () => {
    const u = def({ cardType: "UNIT", cost: 9, level: 9 });
    expect(isPlayableNow(u, ctx({}))).toBe(false);
    expect(isPlayableNow(def({ cardType: "UNIT", cost: 1, level: 1 }), ctx({}))).toBe(true);
  });
});
