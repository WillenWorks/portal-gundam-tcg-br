import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ALL_EFFECT_SPECS } from "./index";
import { ALL_CARD_DEFS } from "./allCardDefs";
import { burstEligibleShieldIds } from "../engine/dispatcher";
import { createGame } from "../engine/setup";
import { buildSt01DeckList } from "../fixtures/st01Deck";

const official: Array<{ code: string; effect?: string }> = JSON.parse(
  readFileSync(path.resolve(__dirname, "../../../../data/gcg-official-cards.json"), "utf8"),
).cards;
const defs = new Map(Object.values(ALL_CARD_DEFS).map((d) => [d.code, d]));
const withDef = official.filter((c) => defs.has(c.code));

describe("【Burst】 padrão — toda carta implementada com o texto tem spec E hasBurst", () => {
  for (const [label, text, op] of [
    ["Add this card to your hand", "【Burst】Add this card to your hand.", "moveZone"],
    ["Deploy this card", "【Burst】Deploy this card.", "deployThisCard"],
  ] as const) {
    it(label, () => {
      const cards = withDef.filter((c) => (c.effect ?? "").includes(text));
      expect(cards.length).toBeGreaterThan(20);
      const broken = cards.filter((c) => {
        const spec = ALL_EFFECT_SPECS.find((s) => s.cardCode === c.code && s.trigger === "Burst");
        return !defs.get(c.code)?.hasBurst || !spec || spec.actions[0]?.op !== op;
      });
      expect(broken.map((c) => c.code)).toEqual([]);
    });
  }

  it("o Burst de um piloto que faltava (GD01-087 Sayla) agora é oferecido quando o Shield quebra", () => {
    const before = createGame(buildSt01DeckList(), buildSt01DeckList(), { seed: 1, firstPlayer: "A" });
    const sayla = defs.get("GD01-087");
    if (!sayla) throw new Error("sem CardDef");
    const shield = before.players.B.shields[0];
    shield.def = sayla;
    const after = structuredClone(before);
    const broken = after.players.B.shields.shift();
    if (!broken) throw new Error("sem shield");
    broken.zone = "trash";
    after.players.B.trash.push(broken);
    expect(burstEligibleShieldIds(before, after, "B", ALL_EFFECT_SPECS)).toEqual([shield.instanceId]);
  });
});
