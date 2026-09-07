import type { CardDef } from "../engine/types";
import type { DeckList } from "../engine/setup";
import { buildSt01DeckList } from "../fixtures/st01Deck";
import { buildSt02DeckList } from "../fixtures/st02Deck";
import { buildSt03DeckList } from "../fixtures/st03Deck";
import { buildSt04DeckList } from "../fixtures/st04Deck";
import { computeDeckLegality } from "../../../lib/deck-legality";
import type { DeckLegalityData, DeckLegalityItem } from "../../../lib/deck-legality";

/**
 * Registro dos decks liberados para o bot (docs/44, Fase 2 — §4.1). Um deck só
 * entra aqui quando cumpre os dois critérios abaixo, ambos verificados por
 * ferramenta e não por inspeção manual:
 *
 * 1. **Legalidade estrutural** — passa `computeDeckLegality` (Pacote A,
 *    `src/lib/deck-legality.ts`): 50 cartas no deck principal, 10 no de
 *    recursos, no máximo 2 cores e no máximo 4 cópias por `code`. A checagem de
 *    banido/restrito depende do catálogo vivo (Prisma) e roda no servidor / CI
 *    (`catalog:*`), fora do alcance deste módulo puro — os fixtures ST01-04 são
 *    os starter decks oficiais, sem carta banida.
 * 2. **Cobertura de efeitos** — toda carta do deck é `implementada`, `vanilla`
 *    ou `implementada*` no dashboard `pnpm catalog:coverage` (docs/48). O gate
 *    de CI (`catalog:coverage:gate` sobre ST01..ST04) confirma `0 faltando`
 *    para esses quatro sets, então o bot nunca encosta num efeito sem regra.
 *
 * Enquanto só os quatro starter decks passam nos dois critérios, o registro tem
 * quatro entradas. Novos decks entram aqui conforme a cobertura avança.
 */
export interface ValidatedDeck {
  id: string;
  label: string;
  build: () => DeckList;
}

export const VALIDATED_DECKS: Record<string, ValidatedDeck> = {
  ST01: { id: "ST01", label: 'ST01 "Heroic Beginnings"', build: buildSt01DeckList },
  ST02: { id: "ST02", label: 'ST02 "Ruination Ablaze"', build: buildSt02DeckList },
  ST03: { id: "ST03", label: 'ST03 "Zeon\'s Fangs"', build: buildSt03DeckList },
  ST04: { id: "ST04", label: 'ST04 "Aile of Justice"', build: buildSt04DeckList },
};

/** `true` se `id` é um deck liberado para o bot (chave de `VALIDATED_DECKS`). */
export function isValidatedDeck(id: string): boolean {
  return Object.prototype.hasOwnProperty.call(VALIDATED_DECKS, id);
}

/** Lista os decks validados em ordem estável de id — conveniência para self-play e relatórios. */
export function validatedDeckList(): ValidatedDeck[] {
  return Object.keys(VALIDATED_DECKS)
    .sort()
    .map((id) => VALIDATED_DECKS[id]);
}

const EMPTY_LEGALITY_DATA: DeckLegalityData = {
  banned: new Set(),
  restricted: new Map(),
  banGroups: new Map(),
};

function groupToItems(cards: CardDef[], section: string): DeckLegalityItem[] {
  const byCode = new Map<string, { def: CardDef; quantity: number }>();
  for (const card of cards) {
    const entry = byCode.get(card.code);
    if (entry) {
      entry.quantity += 1;
    } else {
      byCode.set(card.code, { def: card, quantity: 1 });
    }
  }
  return [...byCode.values()].map(({ def, quantity }) => ({
    cardModelId: def.code,
    cardType: def.cardType,
    color: def.color,
    quantity,
    section,
  }));
}

/** Converte um `DeckList` do motor no formato que `computeDeckLegality` consome. */
export function deckListToLegalityItems(deck: DeckList): DeckLegalityItem[] {
  return [...groupToItems(deck.main, "deck"), ...groupToItems(deck.resources, "resource")];
}

/** Roda `computeDeckLegality` sobre um `DeckList` (só a parte estrutural — ver nota do módulo). */
export function checkDeckListLegality(deck: DeckList, legality: DeckLegalityData = EMPTY_LEGALITY_DATA) {
  return computeDeckLegality(deckListToLegalityItems(deck), legality);
}
