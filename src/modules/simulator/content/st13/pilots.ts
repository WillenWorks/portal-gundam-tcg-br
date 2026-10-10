import type { CardDef } from "../../engine/types";

// Gerado por scripts/gundam-gen-carddefs.mjs --set=ST13 (texto oficial + stats do apitcg); autoria de efeito à mão por cima.
export const PILOTS: Record<string, CardDef> = {
  "ST13-011": {
    "code": "ST13-011",
    "nameEn": "Haman Karn",
    "cardType": "PILOT",
    "color": "green",
    "level": 6,
    "cost": 1,
    "ap": 2,
    "hp": 2,
    "traits": [
      "Neo Zeon",
      "Newtype"
    ],
    "triggerKeywords": [
      "Burst",
      "When Paired"
    ],
    "hasBurst": true
  },
  "ST13-012": {
    "code": "ST13-012",
    "nameEn": "Suletta Mercury",
    "cardType": "PILOT",
    "color": "red",
    "level": 4,
    "cost": 1,
    "ap": 2,
    "hp": 1,
    "traits": [
      "Academy"
    ],
    "triggerKeywords": [
      "Burst"
    ],
    "hasBurst": true
  },
};
