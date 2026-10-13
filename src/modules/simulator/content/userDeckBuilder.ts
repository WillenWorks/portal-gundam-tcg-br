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
  section?: string | null;
  // `null` aceito: é o formato que o Prisma devolve pra colunas opcionais.
  card: {
    code: string;
    nameEn?: string | null;
    cardType?: string | null;
    color?: string | null;
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

function isExBase(item: UserDeckItemInput): boolean {
  const code = (item.card.code || "").toUpperCase();
  const type = (item.card.cardType || "").toUpperCase();
  const section = (item.section || "").toLowerCase();
  return section === "ex_base" || type === "EX BASE" || type === "EX_BASE" || code.startsWith("EXB-");
}

function isExResource(item: UserDeckItemInput): boolean {
  const code = (item.card.code || "").toUpperCase();
  const type = (item.card.cardType || "").toUpperCase();
  const section = (item.section || "").toLowerCase();
  return section === "ex_resource" || type === "EX RESOURCE" || type === "EX_RESOURCE" || code.startsWith("EXR-");
}

function isResource(item: UserDeckItemInput): boolean {
  const code = (item.card.code || "").toUpperCase();
  const type = (item.card.cardType || "").toUpperCase();
  const section = (item.section || "").toLowerCase();
  return section === "resource" || type === "RESOURCE" || code.startsWith("R-") || code.includes("-RESOURCE");
}

/**
 * Converte um deck do banco de dados (Prisma Deck com DeckItem[] e Card)
 * para uma DeckList ({ main, resources }) consumível pelo simulador e pelo bot.
 *
 * EX Base e EX Resource são puramente cosméticos (o motor instancia os tokens
 * no setup do jogo). Cartas de recurso são aceitas e preenchidas até 10.
 * Apenas cartas do deck principal (50 cartas) são validadas quanto à implementação no motor.
 */
export function buildDeckListFromUserDeck(deck: UserDeckInput): DeckList {
  const mainDefs: CardDef[] = [];
  const resourceDefs: CardDef[] = [];
  const unsupportedCodes = new Set<string>();
  let primaryColor: string | undefined;

  for (const item of deck.items) {
    if (!item.quantity || item.quantity <= 0) continue;

    const code = (item.card.code || "").trim().toUpperCase();

    // 1. EX Base: componente cosmético, não entra na contagem de 50 cartas principais
    if (isExBase(item)) {
      continue;
    }

    // 2. EX Resource: componente cosmético, não entra na contagem de 50 cartas principais
    if (isExResource(item)) {
      continue;
    }

    // 3. Resource: deck de recursos (10 cartas de recurso)
    if (isResource(item)) {
      const def = getCardDefByCode(code);
      const resDef: CardDef = def ?? {
        code,
        nameEn: item.card.nameEn || "Resource",
        cardType: "RESOURCE",
        color: (item.card.color?.toLowerCase() as any) || "colorless",
      };
      for (let i = 0; i < item.quantity; i++) {
        resourceDefs.push(resDef);
      }
      continue;
    }

    // 4. Main Deck: cartas principais (Unit, Pilot, Command, Base)
    const def = getCardDefByCode(code);
    if (!def) {
      unsupportedCodes.add(code);
      continue;
    }

    if (!primaryColor && def.color) {
      primaryColor = def.color;
    }

    for (let i = 0; i < item.quantity; i++) {
      mainDefs.push(def);
    }
  }

  if (unsupportedCodes.size > 0) {
    const list = Array.from(unsupportedCodes).sort().join(", ");
    throw new UserDeckSimulatorError(
      `O deck "${deck.name}" contém cartas ainda não implementadas no simulador: ${list}. Para jogar no simulador, remova ou troque essas cartas.`,
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
