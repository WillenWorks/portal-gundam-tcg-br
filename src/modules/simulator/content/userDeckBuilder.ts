import type { CardDef } from "../engine/types";
import type { DeckList } from "../engine/setup";
import { getCardDefByCode } from "./allCardDefs";
import { ST01_CARD_DEFS } from "../fixtures/st01Deck";
import { ST02_CARD_DEFS } from "../fixtures/st02Deck";
import { ST03_CARD_DEFS } from "../fixtures/st03Deck";
import { ST04_CARD_DEFS } from "../fixtures/st04Deck";

export class UserDeckSimulatorError extends Error {
  status: number;
  unsupportedCodes?: string[];
  constructor(message: string, status = 400, unsupportedCodes?: string[]) {
    super(message);
    this.name = "UserDeckSimulatorError";
    this.status = status;
    this.unsupportedCodes = unsupportedCodes;
  }
}

export interface UserDeckItemInput {
  quantity: number;
  section?: string;
  card: {
    code: string;
    nameEn?: string;
    cardType?: string;
    color?: string;
  };
}

export interface UserDeckInput {
  id?: string;
  name: string;
  items: UserDeckItemInput[];
}

function getDefaultResourceForColor(color?: string): CardDef {
  switch (color?.toLowerCase()) {
    case "green":
      return ST02_CARD_DEFS.RESOURCE;
    case "red":
      return ST03_CARD_DEFS.RESOURCE;
    case "white":
      return ST04_CARD_DEFS.RESOURCE;
    case "blue":
    default:
      return ST01_CARD_DEFS.RESOURCE;
  }
}

/**
 * Converte um deck do banco de dados (Prisma Deck com DeckItem[] e Card)
 * para uma DeckList ({ main, resources }) consumível pelo simulador e pelo bot.
 *
 * Valida a existência de CardDef no motor para cada carta do deck.
 */
export function buildDeckListFromUserDeck(deck: UserDeckInput): DeckList {
  const mainDefs: CardDef[] = [];
  const resourceDefs: CardDef[] = [];
  const unsupportedCodes = new Set<string>();
  let primaryColor: string | undefined;

  for (const item of deck.items) {
    const code = item.card.code.toUpperCase();
    const def = getCardDefByCode(code);

    if (!def) {
      unsupportedCodes.add(code);
      continue;
    }

    if (!primaryColor && def.color) {
      primaryColor = def.color;
    }

    const section = item.section ?? "main";
    for (let i = 0; i < item.quantity; i++) {
      if (section === "resource" || def.cardType === "RESOURCE") {
        resourceDefs.push(def);
      } else {
        mainDefs.push(def);
      }
    }
  }

  if (unsupportedCodes.size > 0) {
    const list = Array.from(unsupportedCodes).sort().join(", ");
    throw new UserDeckSimulatorError(
      `O deck "${deck.name}" contém cartas ainda não implementadas no simulador: ${list}. Decks para treino devem conter apenas cartas dos starter decks (ST01 a ST04).`,
      400,
      Array.from(unsupportedCodes),
    );
  }

  if (mainDefs.length !== 50) {
    throw new UserDeckSimulatorError(
      `O deck "${deck.name}" possui ${mainDefs.length} cartas principais (o regulamento do Gundam TCG exige exatamente 50 cartas).`,
      400,
    );
  }

  // Preenche automaticamente recursos se o deck salvo tiver menos de 10 recursos
  if (resourceDefs.length < 10) {
    const defaultResource = getDefaultResourceForColor(primaryColor);
    while (resourceDefs.length < 10) {
      resourceDefs.push(defaultResource);
    }
  }

  return {
    main: mainDefs,
    resources: resourceDefs.slice(0, 10),
  };
}
