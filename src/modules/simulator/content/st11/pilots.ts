import type { CardDef } from "../../engine/types";

// Gerado por scripts/gundam-gen-carddefs.mjs --set=ST11 (texto oficial + stats do apitcg); autoria de efeito à mão por cima.
export const PILOTS: Record<string, CardDef> = {
  "ST11-011": {
    "code": "ST11-011",
    "nameEn": "Char Aznable",
    "cardType": "PILOT",
    "color": "blue",
    "level": 4,
    "cost": 1,
    "ap": 2,
    "hp": 1,
    "traits": [
      "Zeon",
      "Newtype"
    ],
    "triggerKeywords": [
      "Burst",
      "When Paired"
    ],
    "hasBurst": true
  },
  "ST11-012": {
    "code": "ST11-012",
    "nameEn": "Loni Garvey",
    "cardType": "PILOT",
    "color": "purple",
    "level": 4,
    "cost": 1,
    "ap": 2,
    "hp": 1,
    "traits": [
      "Zeon",
      "Newtype"
    ],
    "triggerKeywords": [
      "Burst",
      "When Paired"
    ],
    "hasBurst": true
  },
};
