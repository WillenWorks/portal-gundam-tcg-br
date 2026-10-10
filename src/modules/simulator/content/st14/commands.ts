import type { CardDef } from "../../engine/types";

// Gerado por scripts/gundam-gen-carddefs.mjs --set=ST14 (texto oficial + stats do apitcg); autoria de efeito à mão por cima.
export const COMMANDS: Record<string, CardDef> = {
  "ST14-013": {
    "code": "ST14-013",
    "nameEn": "Natural Talent",
    "cardType": "COMMAND",
    "color": "white",
    "level": 4,
    "cost": 2,
    "triggerKeywords": [
      "Burst",
      "Main",
      "Action"
    ],
    "hasBurst": true
  },
  "ST14-014": {
    "code": "ST14-014",
    "nameEn": "Blazing Mobile Suit Rider",
    "cardType": "COMMAND",
    "color": "white",
    "level": 5,
    "cost": 1,
    "traits": [
      "Vulture",
      "Newtype"
    ],
    "pilotMode": {
      "pilotName": "Garrod Ran & Tiffa Adill",
      "ap": 2,
      "hp": 1
    },
    "ap": 2,
    "hp": 1,
    "triggerKeywords": [
      "Main",
      "Action"
    ]
  },
  "ST14-015": {
    "code": "ST14-015",
    "nameEn": "Battlefield Emotions",
    "cardType": "COMMAND",
    "color": "green",
    "level": 4,
    "cost": 4,
    "triggerKeywords": [
      "Burst",
      "Main"
    ],
    "hasBurst": true
  },
};
