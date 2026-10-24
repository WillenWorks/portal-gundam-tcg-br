import { describe, expect, it } from "vitest";
import { parseDeckbuilderDraft } from "./deckbuilder-draft";

describe("parseDeckbuilderDraft", () => {
  it("lê o rascunho gravado pelo copiar deck, pelo núcleo e pela lista de torneio", () => {
    const raw = JSON.stringify({
      deckName: "Wing (Cópia)",
      visibility: "PRIVATE",
      coverImage: "https://cdn/x.jpg",
      featuredCardIds: ["a", "b", "c"],
      entries: [
        { cardId: "p1", quantity: 4, section: "main" },
        { cardId: "r1", quantity: 10, section: "resource" },
        { cardId: "e1", quantity: 1, section: "ex_base" },
      ],
    });
    expect(parseDeckbuilderDraft(raw)).toEqual({
      deckName: "Wing (Cópia)",
      visibility: "PRIVATE",
      coverImage: "https://cdn/x.jpg",
      featuredCardIds: ["a", "b"],
      entries: [
        { cardId: "p1", quantity: 4, section: "main" },
        { cardId: "r1", quantity: 10, section: "resource" },
        { cardId: "e1", quantity: 1, section: "ex_base" },
      ],
    });
  });

  it("sem visibilidade válida o deck fica público; seção desconhecida vira main", () => {
    const draft = parseDeckbuilderDraft(JSON.stringify({ deckName: "Núcleo", entries: [{ cardId: "p1", quantity: 2, section: "sideboard" }] }));
    expect(draft?.visibility).toBe("PUBLIC");
    expect(draft?.entries).toEqual([{ cardId: "p1", quantity: 2, section: "main" }]);
  });

  it("junta a mesma carta repetida na mesma seção e descarta linhas inválidas", () => {
    const draft = parseDeckbuilderDraft(
      JSON.stringify({
        entries: [
          { cardId: "p1", quantity: 2, section: "main" },
          { cardId: "p1", quantity: 1, section: "main" },
          { cardId: "", quantity: 2 },
          { cardId: "p2", quantity: 0 },
          { cardId: "p3", quantity: "x" },
          null,
        ],
      }),
    );
    expect(draft?.entries).toEqual([{ cardId: "p1", quantity: 3, section: "main" }]);
  });

  it("nada gravado, JSON quebrado ou sem cartas: sem rascunho", () => {
    expect(parseDeckbuilderDraft(null)).toBeNull();
    expect(parseDeckbuilderDraft("{oops")).toBeNull();
    expect(parseDeckbuilderDraft(JSON.stringify({ deckName: "x", entries: [] }))).toBeNull();
    expect(parseDeckbuilderDraft(JSON.stringify([1, 2]))).toBeNull();
  });
});
