/** Mesmo mecanismo de "clonar deck" já usado em SharedDeckPage (localStorage +
 *  navegação pro Hangar OZ) -- reaproveitado aqui pra carregar uma decklist congelada
 *  (DeckSnapshot de resultado de torneio/evento) direto no deckbuilder do usuário. */
export type DeckbuilderDraftEntry = { cardId: string; quantity: number; section: string };

export const DECKBUILDER_DRAFT_KEY = "gundam_deckbuilder_draft";

export function loadDeckbuilderDraft(navigate: (path: string) => void, name: string, entries: DeckbuilderDraftEntry[]) {
  localStorage.setItem(
    DECKBUILDER_DRAFT_KEY,
    JSON.stringify({ deckName: name, visibility: "PUBLIC", entries }),
  );
  navigate("/deckbuilder/novo");
}

type DraftVisibility = "PRIVATE" | "UNLISTED" | "PUBLIC";
type DraftSection = "main" | "resource" | "ex_base" | "ex_resource";

export type DeckbuilderDraft = {
  deckName?: string;
  visibility: DraftVisibility;
  coverImage?: string;
  featuredCardIds: string[];
  entries: Array<{ cardId: string; quantity: number; section: DraftSection }>;
};

const VISIBILITIES = new Set<string>(["PRIVATE", "UNLISTED", "PUBLIC"]);
const SECTIONS = new Set<string>(["main", "resource", "ex_base", "ex_resource"]);
const MAX_COPIES_PER_LINE = 60;

/**
 * Lê o rascunho gravado por "Copiar deck", "Montar núcleo", "Carregar" (lista de torneio) ou pelo visitante que
 * tentou salvar sem conta. Valor inválido some; sem nenhuma carta válida, não há rascunho.
 */
export function parseDeckbuilderDraft(raw: string | null): DeckbuilderDraft | null {
  if (!raw) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const draft = data as Record<string, unknown>;

  const merged = new Map<string, { cardId: string; quantity: number; section: DraftSection }>();
  for (const item of Array.isArray(draft.entries) ? draft.entries : []) {
    if (!item || typeof item !== "object") continue;
    const { cardId, quantity, section } = item as Record<string, unknown>;
    if (typeof cardId !== "string" || !cardId.trim()) continue;
    if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < 1) continue;
    const sec = (typeof section === "string" && SECTIONS.has(section) ? section : "main") as DraftSection;
    const key = `${sec}:${cardId}`;
    const current = merged.get(key);
    merged.set(key, { cardId, section: sec, quantity: Math.min(MAX_COPIES_PER_LINE, (current?.quantity ?? 0) + quantity) });
  }
  if (!merged.size) return null;

  return {
    ...(typeof draft.deckName === "string" && draft.deckName.trim() ? { deckName: draft.deckName.trim() } : {}),
    visibility: typeof draft.visibility === "string" && VISIBILITIES.has(draft.visibility) ? (draft.visibility as DraftVisibility) : "PUBLIC",
    ...(typeof draft.coverImage === "string" && draft.coverImage ? { coverImage: draft.coverImage } : {}),
    featuredCardIds: Array.isArray(draft.featuredCardIds) ? draft.featuredCardIds.filter((id): id is string => typeof id === "string" && Boolean(id)).slice(0, 2) : [],
    entries: [...merged.values()],
  };
}
