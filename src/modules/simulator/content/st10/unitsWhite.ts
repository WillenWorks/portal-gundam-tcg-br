import type { CardDef } from "../../engine/types";

// Gerado por scripts/gundam-gen-carddefs.mjs --set=ST10 (texto oficial + stats do apitcg); autoria de efeito à mão por cima.
export const UNITS_WHITE: Record<string, CardDef> = {
  "ST10-006": {
    "code": "ST10-006",
    "nameEn": "Phoenix Gundam (Power Unleashed) (EX)",
    "cardType": "UNIT",
    "color": "white",
    "level": 5,
    "cost": 3,
    "ap": 4,
    "hp": 4,
    "traits": [
      "G Generation"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Mark Guilder"
      ]
    }
  },
  "ST10-007": {
    "code": "ST10-007",
    "nameEn": "Gundam Barbatos 4th Form",
    "cardType": "UNIT",
    "color": "white",
    "level": 6,
    "cost": 5,
    "ap": 4,
    "hp": 5,
    "traits": [
      "G Generation"
    ],
    "link": {
      "kind": "trait",
      "values": [
        "G Generation"
      ]
    },
    "triggerKeywords": [
      "When Linked"
    ]
  },
  "ST10-008": {
    "code": "ST10-008",
    "nameEn": "Gundam Barbatos 1st Form",
    "cardType": "UNIT",
    "color": "white",
    "level": 4,
    "cost": 3,
    "ap": 4,
    "hp": 3,
    "traits": [
      "G Generation"
    ],
    "link": {
      "kind": "trait",
      "values": [
        "G Generation"
      ]
    },
    "triggerKeywords": [
      "Deploy"
    ]
  },
  "ST10-009": {
    "code": "ST10-009",
    "nameEn": "Graze Duel Type",
    "cardType": "UNIT",
    "color": "white",
    "level": 3,
    "cost": 2,
    "ap": 2,
    "hp": 3,
    "traits": [
      "G Generation"
    ],
    "link": {
      "kind": "trait",
      "values": [
        "G Generation"
      ]
    },
    "effectKeywords": [
      "Blocker"
    ]
  },
  "ST10-010": {
    "code": "ST10-010",
    "nameEn": "Mobile Worker (Tekkadan)",
    "cardType": "UNIT",
    "color": "white",
    "level": 2,
    "cost": 2,
    "ap": 2,
    "hp": 1,
    "traits": [
      "G Generation"
    ],
    "effectKeywords": [
      "Blocker"
    ]
  },
};
