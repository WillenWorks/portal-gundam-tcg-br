import type { CardDef } from "../../engine/types";

// Gerado por scripts/gundam-gen-carddefs.mjs --set=ST09 (texto oficial + stats do apitcg); autoria de efeito à mão por cima.
export const BASES: Record<string, CardDef> = {
  "ST09-010": {
    "code": "ST09-010",
    "nameEn": "Minerva",
    "cardType": "BASE",
    "color": "purple",
    "level": 2,
    "cost": 1,
    "ap": 0,
    "hp": 5,
    "traits": [
      "ZAFT",
      "Minerva Squad",
      "Warship"
    ],
    "triggerKeywords": [
      "Burst",
      "Deploy"
    ],
    "hasBurst": true
  },
};
