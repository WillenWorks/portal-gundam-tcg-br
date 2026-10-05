import type { CardDef } from "../../engine/types";

// Gerado por scripts/gundam-gen-carddefs.mjs --set=ST10 (texto oficial + stats do apitcg); autoria de efeito à mão por cima.
export const PILOTS: Record<string, CardDef> = {
  "ST10-011": {
    "code": "ST10-011",
    "nameEn": "Kamille Bidan",
    "cardType": "PILOT",
    "color": "blue",
    "level": 4,
    "cost": 1,
    "ap": 2,
    "hp": 1,
    "traits": [
      "G Generation",
      "Attack"
    ],
    "triggerKeywords": [
      "Burst",
      "When Linked"
    ],
    "hasBurst": true
  },
  "ST10-012": {
    "code": "ST10-012",
    "nameEn": "Mark Guilder",
    "cardType": "PILOT",
    "color": "white",
    "level": 4,
    "cost": 1,
    "ap": 2,
    "hp": 1,
    "traits": [
      "G Generation",
      "Support"
    ],
    "triggerKeywords": [
      "Burst",
      "When Paired"
    ],
    "hasBurst": true
  },
};
