import type { CardDef } from "../../engine/types";

// Gerado por scripts/gundam-gen-carddefs.mjs --set=ST14 (texto oficial + stats do apitcg); autoria de efeito à mão por cima.
export const PILOTS: Record<string, CardDef> = {
  "ST14-011": {
    "code": "ST14-011",
    "nameEn": "Paptimus Scirocco",
    "cardType": "PILOT",
    "color": "white",
    "level": 4,
    "cost": 1,
    "ap": 2,
    "hp": 1,
    "traits": [
      "Titans",
      "Jupitris",
      "Newtype"
    ],
    "triggerKeywords": [
      "Burst",
      "Attack"
    ],
    "hasBurst": true
  },
  "ST14-012": {
    "code": "ST14-012",
    "nameEn": "Banagher Links",
    "cardType": "PILOT",
    "color": "green",
    "level": 4,
    "cost": 1,
    "ap": 2,
    "hp": 1,
    "traits": [
      "Civilian",
      "Newtype"
    ],
    "triggerKeywords": [
      "Burst",
      "When Paired"
    ],
    "hasBurst": true
  },
};
