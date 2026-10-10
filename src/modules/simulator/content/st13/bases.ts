import type { CardDef } from "../../engine/types";

// Gerado por scripts/gundam-gen-carddefs.mjs --set=ST13 (texto oficial + stats do apitcg); autoria de efeito à mão por cima.
export const BASES: Record<string, CardDef> = {
  "ST13-016": {
    "code": "ST13-016",
    "nameEn": "Sodon",
    "cardType": "BASE",
    "color": "green",
    "level": 2,
    "cost": 1,
    "ap": 0,
    "hp": 5,
    "traits": [
      "Zeon",
      "Warship"
    ],
    "triggerKeywords": [
      "Burst",
      "Deploy"
    ],
    "hasBurst": true
  },
};
