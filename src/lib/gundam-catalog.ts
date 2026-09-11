/* Catálogo v9.5 — opções canônicas para cadastro de cartas, artes e parsing semântico. */
export const PRODUCT_TYPE_OPTIONS = [
  { value: "BOOSTER_PACK", label: "Booster Pack" },
  { value: "STARTER_DECK", label: "Starter Deck" },
  { value: "ACCESSORIES", label: "Acessórios" },
  { value: "PREMIUM_BANDAI", label: "Premium Bandai" },
  { value: "OTHER", label: "Outro" },
] as const;

export const CARD_TYPE_OPTIONS = [
  { value: "UNIT", label: "Unidade" },
  { value: "PILOT", label: "Piloto" },
  { value: "COMMAND", label: "Comando" },
  { value: "BASE", label: "Base" },
  { value: "RESOURCE", label: "Recurso" },
  { value: "EX_BASE", label: "Base EX" },
  { value: "EX_RESOURCE", label: "Recurso EX" },
  { value: "UNIT_TOKEN", label: "Token de Unidade" },
] as const;

export const COLOR_OPTIONS = ["Blue", "Green", "Red", "Purple", "White"] as const;

// Cor de exibição de cada cor de jogo — pra qualquer gráfico/badge que precise
// representar a cor real da carta, em vez de pegar cor de paleta por índice
// (o que resulta em "Blue" aparecendo verde só porque veio primeiro nos dados).
export const GAME_COLOR_HEX: Record<string, string> = {
  Blue: "#3b82f6",
  Green: "#22c55e",
  Red: "#ef4444",
  Purple: "#a855f7",
  White: "#e2e8f0",
};

// Rótulo PT-BR de cada cor de jogo -- usado nos chips de filtro da Central de Eventos
// e em qualquer outro lugar que precise exibir a cor pro público em vez do valor cru
// gravado no banco (ver dicionário terminológico, PLANO_METAGAME_TORNEIOS_TELEMETRIA.md §3).
export const GAME_COLOR_LABEL_PT: Record<string, string> = {
  Blue: "Azul",
  Green: "Verde",
  Red: "Vermelho",
  Purple: "Roxo",
  White: "Branco",
};

// Classificação tática de evento -- abas da Central de Eventos (TournamentsPage) e
// campo de cadastro no admin. Espelha o enum TournamentTier do schema.
export const TOURNAMENT_TIER_OPTIONS = [
  { value: "LARGE_OFFICIAL", label: "Grande Oficial (Major/Regional)" },
  { value: "SMALL_OFFICIAL", label: "Oficial de Loja (Local)" },
  { value: "UNOFFICIAL", label: "Comunitário / Não-Oficial" },
  { value: "RANKED", label: "Classificatório / Power Ranking" },
  { value: "TEAM", label: "Equipe (Trios 3v3)" },
] as const;

export const TOURNAMENT_TAB_OPTIONS = [
  { value: "all", label: "Todas as Listas" },
  { value: "tournaments", label: "Eventos & Torneios" },
  { value: "large_official", label: "Grandes Oficiais", tier: "LARGE_OFFICIAL" },
  { value: "small_official", label: "Oficiais de Loja", tier: "SMALL_OFFICIAL" },
  { value: "unofficial", label: "Comunitários", tier: "UNOFFICIAL" },
  { value: "ranked", label: "Classificatório", tier: "RANKED" },
  { value: "team", label: "Equipe (Trios)", tier: "TEAM" },
] as const;

/** Agrupa uma lista de carta por tipo, na ordem que faz sentido pra montagem de deck
 *  (unidade primeiro, recurso por último) — usado onde a listagem de carta pode
 *  alternar entre "tudo junto" e "separado por tipo" (deckbuilder, binder). */
const CARD_TYPE_GROUP_ORDER = ["UNIT", "PILOT", "COMMAND", "BASE", "RESOURCE", "EX_BASE", "EX_RESOURCE", "UNIT_TOKEN"] as const;
export function groupCardsByType<T extends { type: string }>(rows: T[]): Array<{ type: string; label: string; rows: T[] }> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const key = row.type || "Outro";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(row);
  }
  const ordered = CARD_TYPE_GROUP_ORDER.filter((type) => map.has(type));
  const extra = [...map.keys()].filter((key) => !CARD_TYPE_GROUP_ORDER.includes(key as any));
  return [...ordered, ...extra].map((type) => ({ type, label: CARD_TYPE_OPTIONS.find((opt) => opt.value === type)?.label || type, rows: map.get(type)! }));
}

// Raridade base da carta. Variações de arte ficam no cadastro da imagem.
export const RARITY_OPTIONS = ["C", "U", "R", "LR"] as const;
export const ART_RARITY_OPTIONS = ["C", "C+", "U", "U+", "R", "R+", "LR", "LR+", "LR++", "Promo", "Winner", "Judge"] as const;
export const COST_LEVEL_OPTIONS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"] as const;
export const AP_HP_OPTIONS = ["-", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"] as const;

export const SOURCE_TITLE_OPTIONS = [
  "Mobile Suit Gundam",
  "Mobile Suit Gundam Wing",
  "Mobile Suit Gundam UC",
  "Mobile Suit Gundam SEED",
  "Mobile Suit Gundam: The Witch from Mercury",
  "∀ Gundam",
  "Mobile Suit Gundam 00",
  "Mobile Suit Zeta Gundam",
] as const;

export const TRAIT_OPTIONS = [
  "Earth Federation",
  "White Base Team",
  "Zeon",
  "Zeon Remnants",
  "Operation Meteor",
  "OZ",
  "Preventer",
  "Civilian",
  "Earth Alliance",
  "ZAFT",
  "Triple Ship Alliance",
  "Academy",
  "Benerit Group",
  "Peil Technologies",
  "Jeturk Heavy Machinery",
  "Shin Sei Development Corporation",
  "Celestial Being",
  "AEUG",
  "Titans",
  "Militia",
  "Warship",
] as const;

export const LINK_SUGGESTION_TRAITS = TRAIT_OPTIONS;

export const TRIGGER_KEYWORD_OPTIONS = [
  "Burst",
  "Deploy",
  "Attack",
  "Destroyed",
  "When Paired",
  "During Pair",
  "When Linked",
  "During Link",
  "Main",
  "Action",
  "Activate Main",
  "Activate Action",
] as const;

export const EFFECT_KEYWORD_OPTIONS = [
  "Blocker",
  "High-Maneuver",
  "Suppression",
  "Repair",
  "Breach",
  "Raid",
  "Support",
  "First Strike",
  "Link",
  "Once per Turn",
] as const;
