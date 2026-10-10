import type { CardDef } from "../../engine/types";

// Gerado por scripts/gundam-gen-carddefs.mjs --set=ST12 (texto oficial + stats do apitcg); autoria de efeito à mão por cima.
export const BASES: Record<string, CardDef> = {
  "ST12-016": {
    "code": "ST12-016",
    "nameEn": "Libra",
    "cardType": "BASE",
    "color": "red",
    "level": 3,
    "cost": 1,
    "ap": 0,
    "hp": 5,
    "traits": [
      "White Fang",
      "Warship"
    ],
    "triggerKeywords": [
      "Burst",
      "Deploy",
      "Activate·Main"
    ],
    "hasBurst": true
  },
};
