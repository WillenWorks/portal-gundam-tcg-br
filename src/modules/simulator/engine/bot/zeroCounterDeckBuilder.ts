import type { CardDef } from "../types";
import type { DeckList } from "../setup";
import { getCardDefByCode } from "../../content/allCardDefs";
import { buildSt01MainDeck } from "../../fixtures/st01Deck";
import { buildSt02MainDeck } from "../../fixtures/st02Deck";
import { buildSt03MainDeck } from "../../fixtures/st03Deck";
import { buildSt08MainDeck } from "../../fixtures/st08Deck";
import { computeDeckLegality, type DeckLegalityItem } from "../../../../lib/deck-legality";
import type { ZeroSystemPersona } from "./zeroSystemPolicy";

/**
 * Perfil analítico do deck ou cartas do oponente.
 * Avalia distribuição de cores, curva de custos/níveis, presença de keywords
 * e identifica o arquétipo tático predominante (Aggro, Control, Midrange Synergy, Tempo).
 */
export interface OpponentDeckProfile {
  totalCards: number;
  colors: Record<string, number>;
  primaryColor: string;
  secondaryColor?: string;
  curve: {
    low: number; // Nível <= 2 (early game / rush)
    mid: number; // Nível 3..4 (midgame / link synergy)
    high: number; // Nível >= 5 (late game / boss units)
  };
  types: {
    unit: number;
    pilot: number;
    command: number;
    base: number;
  };
  keywords: {
    rush: number;
    blocker: number;
    breach: number;
    burst: number;
  };
  archetype: "aggro" | "control" | "midrange_synergy" | "tempo";
}

export interface ZeroCounterDeckOptions {
  /**
   * Persona do Zero System a adotar.
   * Se for "adaptive" ou omitida, o sistema analisa o oponente e seleciona a persona ideal.
   */
  persona?: ZeroSystemPersona;
  /**
   * Deck ou cartas reveladas do oponente para análise de perfil.
   */
  opponentDeck?: CardDef[] | DeckList;
  /**
   * Perfil já calculado do oponente (opcional se opponentDeck foi fornecido).
   */
  opponentProfile?: OpponentDeckProfile;
}

export interface ZeroCounterDeckResult {
  persona: "amuro" | "char" | "heero" | "treize";
  profile?: OpponentDeckProfile;
  deck: DeckList;
  tacticalNotes: string[];
}

const RESOURCE_CARD: CardDef = {
  code: "RESOURCE",
  nameEn: "Resource",
  cardType: "RESOURCE",
  color: "colorless",
};

function copies(codeOrDef: string | CardDef, count: number): CardDef[] {
  const def = typeof codeOrDef === "string" ? getCardDefByCode(codeOrDef) : codeOrDef;
  if (!def) {
    throw new Error(`Card definition not found for: ${typeof codeOrDef === "string" ? codeOrDef : codeOrDef.code}`);
  }
  return Array.from({ length: count }, () => def);
}

/**
 * Analisa uma lista de cartas ou DeckList e extrai as métricas fundamentais
 * de arquétipo, cores e curva de mana/nível.
 */
export function analyzeOpponentDeck(cardsOrDeck: CardDef[] | DeckList): OpponentDeckProfile {
  const cards = Array.isArray(cardsOrDeck) ? cardsOrDeck : cardsOrDeck.main;
  const colors: Record<string, number> = {};
  const curve = { low: 0, mid: 0, high: 0 };
  const types = { unit: 0, pilot: 0, command: 0, base: 0 };
  const keywords = { rush: 0, blocker: 0, breach: 0, burst: 0 };

  for (const card of cards) {
    if (card.color && card.color !== "colorless") {
      colors[card.color] = (colors[card.color] ?? 0) + 1;
    }

    const lvl = card.level ?? card.cost ?? 0;
    if (lvl <= 2) curve.low++;
    else if (lvl <= 4) curve.mid++;
    else curve.high++;

    if (card.cardType === "UNIT") types.unit++;
    else if (card.cardType === "PILOT") types.pilot++;
    else if (card.cardType === "COMMAND") types.command++;
    else if (card.cardType === "BASE") types.base++;

    if (card.effectKeywords?.includes("Rush") || card.triggerKeywords?.includes("Rush") || card.staticAbilities?.some((s) => s.keyword === "High-Maneuver")) {
      keywords.rush++;
    }
    if (card.effectKeywords?.includes("Blocker") || card.triggerKeywords?.includes("Blocker")) {
      keywords.blocker++;
    }
    if (card.effectKeywords?.includes("Breach") || card.triggerKeywords?.includes("Breach")) {
      keywords.breach++;
    }
    if (card.hasBurst || card.triggerKeywords?.includes("Burst")) {
      keywords.burst++;
    }
  }

  // Identifica cor primária e secundária
  const sortedColors = Object.entries(colors).sort((a, b) => b[1] - a[1]);
  const primaryColor = sortedColors[0]?.[0] ?? "blue";
  const secondaryColor = sortedColors[1]?.[0];

  // Classificação de arquétipo
  const total = cards.length || 1;
  let archetype: "aggro" | "control" | "midrange_synergy" | "tempo" = "tempo";

  if (keywords.rush >= 2 || curve.low / total >= 0.38) {
    archetype = "aggro";
  } else if (curve.high / total > 0.20 || types.command / total > 0.22) {
    archetype = "control";
  } else if (types.pilot / total >= 0.14 || curve.mid / total > 0.45) {
    archetype = "midrange_synergy";
  }

  return {
    totalCards: cards.length,
    colors,
    primaryColor,
    secondaryColor,
    curve,
    types,
    keywords,
    archetype,
  };
}

/**
 * Recomenda a persona ideal do Zero System com base no perfil tático do adversário:
 * - Aggro/Rush -> Amuro Ray (Contenção tática, Blockers, estabilização de escudos).
 * - Control/Lento -> Char Aznable (Red Rush implacável, Breach, destruição rápida da base).
 * - Midrange/Links -> Treize Khushrenada (Duelo de honra com Mobile Suits de elite de alta patente).
 * - Tempo/Equilibrado -> Heero Yuy (Cálculo cirúrgico e neutralização precisa de alvos).
 */
export function recommendCounterPersona(profile: OpponentDeckProfile): "amuro" | "char" | "heero" | "treize" {
  switch (profile.archetype) {
    case "aggro":
      return "amuro";
    case "control":
      return "char";
    case "midrange_synergy":
      return "treize";
    case "tempo":
    default:
      return "heero";
  }
}

/**
 * Constrói o deck de Amuro Ray ("The White Devil / Tactical Defense & Link Mastery").
 * Arquétipo Blue + White centrado em RX-78-2, Blockers e estabilização de campo.
 */
function buildAmuroCounterDeck(_profile?: OpponentDeckProfile): CardDef[] {
  return buildSt01MainDeck();
}

/**
 * Constrói o deck de Char Aznable ("The Red Comet / 3x Speed Blitz & Breach Assault").
 * Arquétipo Red + Green focado em agressão fulminante de Zeon e Breach implacável.
 */
function buildCharCounterDeck(_profile?: OpponentDeckProfile): CardDef[] {
  return buildSt03MainDeck();
}

/**
 * Constrói o deck de Heero Yuy ("Zero System / Surgical Mission Execution").
 * Arquétipo Green + White centrado em Wing Gundam, Operation Meteor e remoção calculada de alvos.
 */
function buildHeeroCounterDeck(_profile?: OpponentDeckProfile): CardDef[] {
  return buildSt02MainDeck();
}

/**
 * Constrói o deck de Treize Khushrenada ("Aristocratic Chivalry & Elite Mobile Suit Mastery").
 * Persona nobre, cavalheiresca e astuta. Rejeita vitórias mesquinhas e comanda Mobile Suits
 * de elite (Xi Gundam Lv.9, Penelope Lv.7, Gustav Karl, Hathaway e Lane Aim).
 * Esmaga a vanguarda inimiga em combates honrosos com poder de fogo e elegância incomparáveis.
 */
function buildTreizeCounterDeck(_profile?: OpponentDeckProfile): CardDef[] {
  return buildSt08MainDeck();
}

/**
 * Valida a legalidade oficial do deck gerado (50 cartas no main, 10 no resource,
 * máximo de 2 cores, máximo de 4 cópias por card code).
 */
export function validateGeneratedDeckLegality(deck: DeckList): { valid: boolean; issues: string[] } {
  const items: DeckLegalityItem[] = [
    ...deck.main.map((c) => ({
      cardModelId: c.code,
      cardType: c.cardType,
      color: c.color ?? null,
      quantity: 1,
      section: "main",
    })),
    ...deck.resources.map((c) => ({
      cardModelId: c.code,
      cardType: c.cardType,
      color: c.color ?? null,
      quantity: 1,
      section: "resource",
    })),
  ];

  // Agrupa quantidades
  const grouped = new Map<string, DeckLegalityItem>();
  for (const item of items) {
    const key = `${item.section}:${item.cardModelId}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.quantity += item.quantity;
    } else {
      grouped.set(key, { ...item });
    }
  }

  const result = computeDeckLegality(Array.from(grouped.values()), {
    banned: new Set(),
    restricted: new Map(),
    banGroups: new Map(),
  });

  return {
    valid: result.valid,
    issues: result.issues.map((i) => i.message),
  };
}

/**
 * Construtor Mestre de Counter-Decks do Zero System Nível 4.
 * Gera uma DeckList legal e completa (50 cartas + 10 recursos) sob a ótica
 * da Persona especificada ou adaptada dinamicamente ao oponente.
 */
export function buildZeroCounterDeck(options: ZeroCounterDeckOptions = {}): ZeroCounterDeckResult {
  let profile = options.opponentProfile;
  if (!profile && options.opponentDeck) {
    profile = analyzeOpponentDeck(options.opponentDeck);
  }

  let persona: "amuro" | "char" | "heero" | "treize";
  if (options.persona && options.persona !== "adaptive") {
    persona = options.persona;
  } else if (profile) {
    persona = recommendCounterPersona(profile);
  } else {
    persona = "treize"; // Padrão nobre e aristocrático
  }

  let mainCards: CardDef[];
  const tacticalNotes: string[] = [];

  switch (persona) {
    case "amuro":
      mainCards = buildAmuroCounterDeck(profile);
      tacticalNotes.push(
        "Postura Tática Defensiva (Amuro Ray): Estabelece rede de Blockers e sinergia de links RX-78-2.",
        "Projetado para resistir à pressão inicial de decks Aggro e punir investidas precipitadas.",
      );
      break;

    case "char":
      mainCards = buildCharCounterDeck(profile);
      tacticalNotes.push(
        "Postura Ofensiva Fulminante (Char Aznable): Velocidade 3x com Red Rush e Breach implacável.",
        "Projetado para superar barreiras de decks Control antes do estabelecimento de late game.",
      );
      break;

    case "heero":
      mainCards = buildHeeroCounterDeck(profile);
      tacticalNotes.push(
        "Cálculo Cirúrgico de Missão (Heero Yuy): Remoção precisa de alvos com Wing Gundam e Operation Meteor.",
        "Neutraliza unidades chave e mantém equilíbrio tático de campo.",
      );
      break;

    case "treize":
    default:
      mainCards = buildTreizeCounterDeck(profile);
      tacticalNotes.push(
        "Duelo Aristocrático de Campeões (Treize Khushrenada): Força aérea e Mobile Suits de elite Lv 5-9 em duelos gloriosos e honrosos.",
        "Mobiliza Xi Gundam e Penelope para subjugar o oponente com superioridade técnica e cavalheirismo militar.",
      );
      break;
  }

  const resourceCards = copies(RESOURCE_CARD, 10);
  const deck: DeckList = {
    main: mainCards,
    resources: resourceCards,
  };

  // Verificação de integridade formal
  const legality = validateGeneratedDeckLegality(deck);
  if (!legality.valid) {
    throw new Error(`ZeroCounterDeckBuilder produced illegal deck: ${legality.issues.join("; ")}`);
  }

  return {
    persona,
    profile,
    deck,
    tacticalNotes,
  };
}
