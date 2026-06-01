/* Catálogo v9.2 — opções canônicas para cadastro de cartas e parsing semântico de efeitos. */
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

export const RARITY_OPTIONS = ["LR++", "LR+", "LR", "R+", "R", "U+", "U", "C+", "C", "Promo", "Winner", "Judge"] as const;
export const COST_LEVEL_OPTIONS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;
export const AP_HP_OPTIONS = ["-", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;

export const LINK_SUGGESTION_TRAITS = [
  "Operation Meteor",
  "Earth Federation",
  "Zeon",
  "AEUG",
  "White Base Team",
  "Celestial Being",
] as const;

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
