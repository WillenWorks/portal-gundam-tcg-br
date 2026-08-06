/* ---------------------------------------------------------------------------
 * Motor de regras de deck (Pacote A) — ver docs/14-motor-regras-deck.md.
 * Fonte: regras oficiais (comprehensive rules + lista de banido/restrito,
 * gundam-gcg.com/en/rules e /en/news/01_279.html), conferidas em ago/2026.
 *
 * Fica em src/lib/ (não em server/) de propósito — é lógica pura, sem depender
 * do Prisma Client, usada tanto pelo servidor (server/index.ts importa daqui,
 * mesmo padrão de src/lib/gundam-card-effects.ts) quanto pelo deckbuilder no
 * navegador (Pacote B3 — validação em tempo real sem round-trip por clique).
 * ------------------------------------------------------------------------- */
export const DECK_MAIN_SIZE = 50;
export const DECK_RESOURCE_SIZE = 10;
export const DECK_MAX_COLORS = 2;
export const DECK_MAX_COPIES_DEFAULT = 4;

export type DeckLegalityData = {
  banned: Set<string>; // CardModel.id
  restricted: Map<string, number>; // CardModel.id -> cópias permitidas
  banGroups: Map<string, { label: string; maxDistinct: number; memberIds: Set<string> }>;
};

export type DeckLegalityItem = {
  cardModelId: string | null;
  cardType: string;
  color: string | null;
  quantity: number;
  section: string;
};

/** Seções que existem no DeckItem mas não contam pro deck principal nem de
 *  recursos — EX Base/EX Resource são componente fixo do jogo (1 de cada,
 *  sempre), não uma escolha de quantidade/deckbuilding de verdade. */
export const NON_COUNTED_SECTIONS = new Set(["ex_base", "ex_resource"]);

export type DeckLegalityIssue = { type: string; message: string; cardModelId?: string };

/** items: uma linha por DeckItem já carregado com o cardModel e a cor/tipo do card.
 *  Não decide nada sobre UX — só devolve os problemas encontrados, prontos pra
 *  exibir (Pacote B decide como mostrar). */
export function computeDeckLegality(items: DeckLegalityItem[], legality: DeckLegalityData) {
  const issues: DeckLegalityIssue[] = [];
  const mainItems = items.filter((item) => item.section !== "resource" && !NON_COUNTED_SECTIONS.has(item.section));
  const resourceItems = items.filter((item) => item.section === "resource");

  const mainCount = mainItems.reduce((sum, item) => sum + item.quantity, 0);
  if (mainCount !== DECK_MAIN_SIZE) issues.push({ type: "main_size", message: `Deck principal tem ${mainCount} carta(s) — precisa de exatamente ${DECK_MAIN_SIZE}.` });
  const resourceCount = resourceItems.reduce((sum, item) => sum + item.quantity, 0);
  if (resourceCount !== DECK_RESOURCE_SIZE) issues.push({ type: "resource_size", message: `Deck de recursos tem ${resourceCount} carta(s) — precisa de exatamente ${DECK_RESOURCE_SIZE}.` });

  const colors = new Set(mainItems.map((item) => item.color).filter((color): color is string => Boolean(color)));
  if (colors.size > DECK_MAX_COLORS) issues.push({ type: "too_many_colors", message: `Deck usa ${colors.size} cores (${[...colors].join(", ")}) — o máximo permitido é ${DECK_MAX_COLORS}.` });

  for (const item of mainItems) {
    if (!item.cardModelId) continue;
    if (legality.banned.has(item.cardModelId)) issues.push({ type: "banned", cardModelId: item.cardModelId, message: "Carta banida — não pode ser usada." });
    const restrictedLimit = legality.restricted.get(item.cardModelId);
    const limit = restrictedLimit ?? DECK_MAX_COPIES_DEFAULT;
    if (item.quantity > limit) issues.push({ type: "over_copy_limit", cardModelId: item.cardModelId, message: `${item.quantity} cópias — o limite é ${limit}${restrictedLimit != null ? " (carta restrita)" : ""}.` });
  }

  for (const [, group] of legality.banGroups) {
    const present = mainItems.filter((item) => item.cardModelId && group.memberIds.has(item.cardModelId) && item.quantity > 0);
    const distinctIds = new Set(present.map((item) => item.cardModelId));
    if (distinctIds.size > group.maxDistinct) {
      issues.push({ type: "ban_group", message: `${group.label}: só pode usar ${group.maxDistinct} carta(s) diferente(s) deste grupo, mas o deck tem ${distinctIds.size}.` });
    }
  }

  return { valid: issues.length === 0, issues };
}
