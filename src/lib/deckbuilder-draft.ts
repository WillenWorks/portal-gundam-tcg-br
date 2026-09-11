/** Mesmo mecanismo de "clonar deck" já usado em SharedDeckPage (localStorage +
 *  navegação pro Hangar OZ) -- reaproveitado aqui pra carregar uma decklist congelada
 *  (DeckSnapshot de resultado de torneio/evento) direto no deckbuilder do usuário. */
export type DeckbuilderDraftEntry = { cardId: string; quantity: number; section: string };

export function loadDeckbuilderDraft(navigate: (path: string) => void, name: string, entries: DeckbuilderDraftEntry[]) {
  localStorage.setItem(
    "gundam_deckbuilder_draft",
    JSON.stringify({ deckName: name, visibility: "PRIVATE", entries }),
  );
  navigate("/deckbuilder/novo");
}
