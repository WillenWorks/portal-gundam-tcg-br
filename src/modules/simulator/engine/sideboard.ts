import type { CardDef } from "./types";
import type { DeckList } from "./setup";

/**
 * DeckList com suporte a Sideboard competitivo oficial.
 * Regras oficiais Bandai / Gundam TCG:
 * - Deck principal: exatamente 50 cartas
 * - Deck de recursos: exatamente 10 cartas
 * - Sideboard: até 10 cartas (0 a 10)
 * - Cores permitidas: máximo 2 cores no conjunto (Main + Sideboard)
 * - Limite de cópias: máximo 4 cópias da mesma carta no conjunto (Main + Sideboard)
 */
export interface DeckListWithSideboard extends DeckList {
  sideboard: CardDef[];
}

export type SideboardValidationErrorCode =
  | "MAIN_DECK_SIZE_INVALID"
  | "SIDEBOARD_SIZE_EXCEEDED"
  | "RESOURCES_SIZE_INVALID"
  | "TOO_MANY_COLORS"
  | "TOO_MANY_COPIES"
  | "SWAP_COUNT_MISMATCH"
  | "CARD_NOT_IN_MAIN"
  | "CARD_NOT_IN_SIDEBOARD";

export interface SideboardValidationError {
  code: SideboardValidationErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

export interface SideboardValidationResult {
  valid: boolean;
  errors: SideboardValidationError[];
  colors: string[];
  cardCounts: Record<string, number>;
}

export interface SideboardSwapRequest {
  /** Códigos das cartas a retirar do deck principal e mover pro sideboard */
  mainOut: string[];
  /** Códigos das cartas a retirar do sideboard e mover pro deck principal */
  sideIn: string[];
}

/**
 * Valida um deck com sideboard conforme as regras do formato competitivo.
 */
export function validateDeckWithSideboard(deck: DeckListWithSideboard): SideboardValidationResult {
  const errors: SideboardValidationError[] = [];

  // 1. Quantidade de cartas no Main Deck (exatamente 50)
  if (deck.main.length !== 50) {
    errors.push({
      code: "MAIN_DECK_SIZE_INVALID",
      message: `Deck principal deve conter exatamente 50 cartas (atual: ${deck.main.length}).`,
      details: { expected: 50, actual: deck.main.length },
    });
  }

  // 2. Quantidade de cartas no Sideboard (até 10)
  if (deck.sideboard.length > 10) {
    errors.push({
      code: "SIDEBOARD_SIZE_EXCEEDED",
      message: `Sideboard não pode exceder 10 cartas (atual: ${deck.sideboard.length}).`,
      details: { max: 10, actual: deck.sideboard.length },
    });
  }

  // 3. Quantidade de recursos (exatamente 10)
  if (deck.resources && deck.resources.length !== 10) {
    errors.push({
      code: "RESOURCES_SIZE_INVALID",
      message: `Deck de recursos deve conter exatamente 10 cartas (atual: ${deck.resources.length}).`,
      details: { expected: 10, actual: deck.resources.length },
    });
  }

  // 4. Limite de cópias (máximo 4 cópias entre Main + Sideboard somados)
  const cardCounts: Record<string, number> = {};
  for (const card of deck.main) {
    cardCounts[card.code] = (cardCounts[card.code] ?? 0) + 1;
  }
  for (const card of deck.sideboard) {
    cardCounts[card.code] = (cardCounts[card.code] ?? 0) + 1;
  }

  for (const [code, count] of Object.entries(cardCounts)) {
    if (count > 4) {
      errors.push({
        code: "TOO_MANY_COPIES",
        message: `Carta "${code}" excede o limite de 4 cópias entre Main Deck e Sideboard (atual: ${count}).`,
        details: { cardCode: code, count, max: 4 },
      });
    }
  }

  // 5. Restrição de cores (máximo 2 cores no pool Main + Sideboard)
  const colorsSet = new Set<string>();
  const addColor = (c: CardDef) => {
    if (!c.color) return;
    const norm = c.color.toLowerCase().trim();
    if (norm && norm !== "colorless" && norm !== "neutral") {
      colorsSet.add(norm);
    }
  };

  for (const card of deck.main) addColor(card);
  for (const card of deck.sideboard) addColor(card);

  const colors = Array.from(colorsSet).sort();
  if (colors.length > 2) {
    errors.push({
      code: "TOO_MANY_COLORS",
      message: `Deck excede o limite de 2 cores entre Main Deck e Sideboard (cores encontradas: ${colors.join(", ")}).`,
      details: { colors, max: 2 },
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    colors,
    cardCounts,
  };
}

/**
 * Aplica troca tática de cartas entre Main Deck e Sideboard.
 * Garante que a troca preserve exatamente 50 cartas no Main e respeite todas as regras.
 */
export function applySideboardSwap(
  currentDeck: DeckListWithSideboard,
  swaps: SideboardSwapRequest,
): DeckListWithSideboard {
  if (swaps.mainOut.length !== swaps.sideIn.length) {
    throw new Error(
      `Troca de sideboard inválida: quantidade retirada (${swaps.mainOut.length}) difere da quantidade inserida (${swaps.sideIn.length}).`,
    );
  }

  const nextMain = [...currentDeck.main];
  const nextSide = [...currentDeck.sideboard];

  // 1. Retira cartas do main e coloca no sideboard temporário
  for (const code of swaps.mainOut) {
    const idx = nextMain.findIndex((c) => c.code === code);
    if (idx === -1) {
      throw new Error(`Carta "${code}" para retirar não foi encontrada no Main Deck.`);
    }
    const [removed] = nextMain.splice(idx, 1);
    nextSide.push(removed);
  }

  // 2. Retira cartas do sideboard e coloca no main
  for (const code of swaps.sideIn) {
    const idx = nextSide.findIndex((c) => c.code === code);
    if (idx === -1) {
      throw new Error(`Carta "${code}" para adicionar não foi encontrada no Sideboard.`);
    }
    const [removed] = nextSide.splice(idx, 1);
    nextMain.push(removed);
  }

  const newDeck: DeckListWithSideboard = {
    main: nextMain,
    resources: currentDeck.resources,
    sideboard: nextSide,
  };

  const validation = validateDeckWithSideboard(newDeck);
  if (!validation.valid) {
    const firstMsg = validation.errors[0]?.message ?? "Deck inválido após troca de sideboard.";
    throw new Error(`Troca de sideboard resultou em deck inválido: ${firstMsg}`);
  }

  return newDeck;
}
