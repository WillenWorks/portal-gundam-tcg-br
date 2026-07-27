/* Catálogo v9.5 — opções canônicas para cadastro de cartas, artes e parsing semântico. */
export const PRODUCT_TYPE_OPTIONS = [
  { value: "BOOSTER_PACK", label: "Booster Pack" },
  { value: "STARTER_DECK", label: "Starter Deck" },
  { value: "ACCESSORIES", label: "Acessórios" },
  { value: "PREMIUM_BANDAI", label: "Premium Bandai" },
  { value: "OTHER", label: "Outro" },
] as const;

export const CARD_TYPE_OPTIONS = [
  { value: "UNIT", label: "Unit" },
  { value: "PILOT", label: "Pilot" },
  { value: "COMMAND", label: "Command" },
  { value: "COMMAND_PILOT", label: "Command / Pilot" },
  { value: "BASE", label: "Base" },
  { value: "RESOURCE", label: "Resource" },
  { value: "EX_BASE", label: "EX Base" },
  { value: "EX_RESOURCE", label: "EX Resource" },
] as const;

export const COLOR_OPTIONS = ["Blue", "Green", "Red", "Purple", "White"] as const;

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
