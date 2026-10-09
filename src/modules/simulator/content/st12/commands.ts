import type { CardDef } from "../../engine/types";

// Gerado por scripts/gundam-gen-carddefs.mjs --set=ST12 (texto oficial + stats do apitcg); autoria de efeito à mão por cima.
export const COMMANDS: Record<string, CardDef> = {
  "ST12-013": {
    "code": "ST12-013",
    "nameEn": "The Final Victor",
    "cardType": "COMMAND",
    "color": "red",
    "level": 6,
    "cost": 2,
    "triggerKeywords": [
      "Burst",
      "Main"
    ],
    "hasBurst": true
  },
  "ST12-014": {
    "code": "ST12-014",
    "nameEn": "Wise Leader's Pride",
    "cardType": "COMMAND",
    "color": "purple",
    "level": 3,
    "cost": 1,
    "traits": [
      "Zeon"
    ],
    "pilotMode": {
      "pilotName": "M'Quve",
      "ap": 1,
      "hp": 0
    },
    "ap": 1,
    "hp": 0,
    "triggerKeywords": [
      "Action"
    ]
  },
  "ST12-015": {
    "code": "ST12-015",
    "nameEn": "Two Unicorns",
    "cardType": "COMMAND",
    "color": "purple",
    "level": 4,
    "cost": 1,
    "triggerKeywords": [
      "Action"
    ]
  },
};
