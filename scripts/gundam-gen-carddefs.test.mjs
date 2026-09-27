import { describe, expect, it } from "vitest";
import { buildCardDef } from "./lib/gen-carddefs.mjs";

const unit = (extra = {}) => ({ code: "GDXX-001", name: "Test", cardType: "UNIT", traits: ["Zeon"], link: "-", effect: "", ...extra });
const STATS = { Level: "4", Cost: "3", Color: "Red", "Attack Points": "4", "Hit Points": "3" };

describe("gundam-gen-carddefs — buildCardDef", () => {
  it("stats do apitcg: Lv., custo, cor minúscula, AP/HP; Piloto com \"+N\" vira N", () => {
    expect(buildCardDef(unit(), STATS)).toMatchObject({ level: 4, cost: 3, color: "red", ap: 4, hp: 3, traits: ["Zeon"] });
    const pilot = buildCardDef(unit({ cardType: "PILOT" }), { ...STATS, "Attack Points": "+2", "Hit Points": "+1" });
    expect(pilot).toMatchObject({ ap: 2, hp: 1 });
  });

  it("link por nome, por trait e misto (nome OU trait)", () => {
    expect(buildCardDef(unit({ link: "[Amuro Ray]" }), STATS).link).toEqual({ kind: "pilotName", values: ["Amuro Ray"] });
    expect(buildCardDef(unit({ link: "[Kai Shiden] / [Hayato Kobayashi]" }), STATS).link).toEqual({
      kind: "pilotName",
      values: ["Kai Shiden", "Hayato Kobayashi"],
    });
    expect(buildCardDef(unit({ link: "(Titans) Trait" }), STATS).link).toEqual({ kind: "trait", values: ["Titans"] });
    expect(buildCardDef(unit({ link: "(Trinity) Trait / [Ali al-Saachez]" }), STATS).link).toEqual({
      kind: "pilotName",
      values: ["Ali al-Saachez"],
      orTraits: ["Trinity"],
    });
    expect(buildCardDef(unit({ link: "-" }), STATS).link).toBeUndefined();
  });

  it("keyword contínua vira effectKeywords/keywordTags; com gatilho (efeito) não", () => {
    const kw = buildCardDef(unit({ effect: "<Repair 2> (At the end of your turn, this Unit recovers the specified number of HP.)\n<Blocker>" }), STATS);
    expect(kw.effectKeywords).toEqual(["Repair", "Blocker"]);
    expect(kw.keywordTags).toEqual(["Repair 2"]);
    const triggered = buildCardDef(unit({ effect: "【Deploy】<Repair 2>" }), STATS);
    expect(triggered.effectKeywords).toBeUndefined();
    expect(triggered.triggerKeywords).toEqual(["Deploy"]);
  });

  it("gatilhos, 【Burst】 e 【Pilot】[Nome] (AP/HP do modo Piloto também no def)", () => {
    const cmd = buildCardDef(
      { code: "GDXX-101", name: "Cmd", cardType: "COMMAND", traits: [], link: "-", effect: "【Burst】Draw 1.\n【Main】/【Action】Draw 1.\n【Pilot】[Hardie Steiner]" },
      { Level: "3", Cost: "1", Color: "Green", "Attack Points": "+1", "Hit Points": "+1" },
    );
    expect(cmd.triggerKeywords).toEqual(["Burst", "Main", "Action"]);
    expect(cmd.hasBurst).toBe(true);
    expect(cmd.pilotMode).toEqual({ pilotName: "Hardie Steiner", ap: 1, hp: 1 });
    expect(cmd).toMatchObject({ ap: 1, hp: 1 });
    expect(cmd.traits).toBeUndefined();
  });

  it("sem stats no apitcg lança", () => {
    expect(() => buildCardDef(unit(), undefined)).toThrow(/apitcg/);
  });
});
