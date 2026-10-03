import type { CardDef } from "../../engine/types";

// Gerado por scripts/gundam-gen-carddefs.mjs --set=ST09 (texto oficial + stats do apitcg); autoria de efeito à mão por cima.
export const PILOTS: Record<string, CardDef> = {
  "ST09-008": {
    "code": "ST09-008",
    "nameEn": "Shinn Asuka",
    "cardType": "PILOT",
    "color": "purple",
    "level": 4,
    "cost": 1,
    "ap": 3,
    "hp": 0,
    "traits": [
      "ZAFT",
      "Minerva Squad",
      "Coordinator"
    ],
    "triggerKeywords": [
      "Burst",
      "Attack"
    ],
    "hasBurst": true
  },
};
