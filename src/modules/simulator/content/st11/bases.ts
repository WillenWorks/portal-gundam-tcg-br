import type { CardDef } from "../../engine/types";

// Gerado por scripts/gundam-gen-carddefs.mjs --set=ST11 (texto oficial + stats do apitcg); autoria de efeito à mão por cima.
export const BASES: Record<string, CardDef> = {
  "ST11-016": {
    "code": "ST11-016",
    "nameEn": "Mad Angler",
    "cardType": "BASE",
    "color": "blue",
    "level": 3,
    "cost": 1,
    "ap": 0,
    "hp": 5,
    "traits": [
      "Zeon",
      "Warship",
      "Marine"
    ],
    "triggerKeywords": [
      "Burst",
      "Deploy"
    ],
    "hasBurst": true
  },
};
