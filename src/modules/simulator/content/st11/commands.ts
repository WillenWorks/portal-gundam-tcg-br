import type { CardDef } from "../../engine/types";

// Gerado por scripts/gundam-gen-carddefs.mjs --set=ST11 (texto oficial + stats do apitcg); autoria de efeito à mão por cima.
export const COMMANDS: Record<string, CardDef> = {
  "ST11-013": {
    "code": "ST11-013",
    "nameEn": "Poorly Planned Offensive",
    "cardType": "COMMAND",
    "color": "blue",
    "level": 4,
    "cost": 2,
    "triggerKeywords": [
      "Burst",
      "Main",
      "Action"
    ],
    "hasBurst": true
  },
  "ST11-014": {
    "code": "ST11-014",
    "nameEn": "The Orca of Red Sea",
    "cardType": "COMMAND",
    "color": "blue",
    "level": 3,
    "cost": 1,
    "traits": [
      "ZAFT",
      "Coordinator"
    ],
    "pilotMode": {
      "pilotName": "Marco Morassim",
      "ap": 1,
      "hp": 1
    },
    "ap": 1,
    "hp": 1,
    "triggerKeywords": [
      "Action"
    ]
  },
  "ST11-015": {
    "code": "ST11-015",
    "nameEn": "A Twinkle from the Abyss",
    "cardType": "COMMAND",
    "color": "purple",
    "level": 5,
    "cost": 2,
    "triggerKeywords": [
      "Main"
    ]
  },
};
