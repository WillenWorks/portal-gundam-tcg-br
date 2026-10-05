import type { CardDef } from "../../engine/types";

// Gerado por scripts/gundam-gen-carddefs.mjs --set=ST10 (texto oficial + stats do apitcg); autoria de efeito à mão por cima.
export const BASES: Record<string, CardDef> = {
  "ST10-016": {
    "code": "ST10-016",
    "nameEn": "Luna Mana & Carry Base",
    "cardType": "BASE",
    "color": "blue",
    "level": 4,
    "cost": 1,
    "ap": 0,
    "hp": 5,
    "traits": [
      "G Generation",
      "Warship"
    ],
    "triggerKeywords": [
      "Burst",
      "Deploy"
    ],
    "hasBurst": true
  },
};
