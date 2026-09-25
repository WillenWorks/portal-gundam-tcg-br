import { describe, expect, it } from "vitest";
import { VALIDATED_DECKS } from "../src/modules/simulator/content/validatedDecks.ts";
import type { UserDeckInput } from "../src/modules/simulator/content/userDeckBuilder.ts";
import { buildBotDeckPool, type DbDeckCandidate } from "./botDeckPool.ts";

/** deck validado → formato do banco (itens agrupados por código) */
function asUserDeck(id: keyof typeof VALIDATED_DECKS): UserDeckInput {
  const list = VALIDATED_DECKS[id].build();
  const items = new Map<string, { quantity: number; section: string; card: { code: string } }>();
  for (const [section, cards] of [["main", list.main], ["resource", list.resources]] as const) {
    for (const c of cards) {
      const key = `${section}:${c.code}`;
      const item = items.get(key) ?? { quantity: 0, section, card: { code: c.code } };
      item.quantity++;
      items.set(key, item);
    }
  }
  return { name: id, items: [...items.values()] };
}

const candidate = (over: Partial<DbDeckCandidate> & Pick<DbDeckCandidate, "id" | "deck">): DbDeckCandidate => ({
  label: over.id,
  source: "public",
  ...over,
});

describe("buildBotDeckPool", () => {
  it("aceita deck jogável e legal, com a lista em códigos", () => {
    const { decks, rejected } = buildBotDeckPool([candidate({ id: "d1", deck: asUserDeck("ST01") })], { max: 10 });
    expect(rejected).toEqual([]);
    expect(decks).toHaveLength(1);
    expect(decks[0].list.main).toHaveLength(50);
  });

  it("mesma lista em torneio e em deck público → uma só, com a melhor colocação", () => {
    const { decks, duplicates } = buildBotDeckPool(
      [
        candidate({ id: "pub", deck: asUserDeck("ST02") }),
        candidate({ id: "t-8", source: "tournament", placement: 8, deck: asUserDeck("ST02") }),
        candidate({ id: "t-1", source: "tournament", placement: 1, deck: asUserDeck("ST02") }),
      ],
      { max: 10 },
    );
    expect(decks.map((d) => d.id)).toEqual(["t-1"]);
    expect(duplicates).toBe(2);
  });

  it("carta sem cobertura no motor → rejeitado com motivo", () => {
    const deck = asUserDeck("ST03");
    deck.items[0] = { ...deck.items[0], card: { code: "GD99-001" } };
    const { decks, rejected } = buildBotDeckPool([candidate({ id: "bad", deck })], { max: 10 });
    expect(decks).toEqual([]);
    expect(rejected[0].id).toBe("bad");
    expect(rejected[0].reason).toMatch(/GD99-001|cobertura|carta/i);
  });

  it("respeita o teto, mantendo os de torneio primeiro", () => {
    const { decks } = buildBotDeckPool(
      [
        candidate({ id: "pub", deck: asUserDeck("ST01") }),
        candidate({ id: "t", source: "tournament", placement: 3, deck: asUserDeck("ST04") }),
      ],
      { max: 1 },
    );
    expect(decks.map((d) => d.id)).toEqual(["t"]);
  });
});
