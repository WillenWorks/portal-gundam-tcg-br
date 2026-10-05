import type { CardDef } from "../../engine/types";

// Gerado por scripts/gundam-gen-carddefs.mjs --set=ST10 (texto oficial + stats do apitcg); autoria de efeito à mão por cima.
export const COMMANDS: Record<string, CardDef> = {
  "ST10-013": {
    "code": "ST10-013",
    "nameEn": "Tactical Training",
    "cardType": "COMMAND",
    "color": "blue",
    "level": 3,
    "cost": 1,
    "triggerKeywords": [
      "Burst",
      "Main",
      "Action"
    ],
    "hasBurst": true
  },
  "ST10-014": {
    "code": "ST10-014",
    "nameEn": "Unlocking the Development Diagram",
    // W9 — custo alternativo: descarta 1 Unit (G Generation) da mão e joga como Lv.2/custo 2
    "altPlayByDiscard": {
      "cardType": "UNIT",
      "trait": "G Generation",
      "level": 2,
      "cost": 2,
      "sourceText": "When playing this card from your hand, you may discard 1 (G Generation) Unit card. If you do, play this card as if it has 2 Lv. and cost."
    },
    "cardType": "COMMAND",
    "color": "blue",
    "level": 4,
    "cost": 4,
    "triggerKeywords": [
      "Main"
    ]
  },
  "ST10-015": {
    "code": "ST10-015",
    "nameEn": "Diffuse Beam Cannon",
    "cardType": "COMMAND",
    "color": "white",
    "level": 3,
    "cost": 1,
    "traits": [
      "G Generation",
      "Durability"
    ],
    "pilotMode": {
      "pilotName": "Claire Heathrow",
      "ap": 1,
      "hp": 0
    },
    "ap": 1,
    "hp": 0,
    "triggerKeywords": [
      "Action"
    ]
  },
};
