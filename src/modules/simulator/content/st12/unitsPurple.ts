import type { CardDef } from "../../engine/types";

// Gerado por scripts/gundam-gen-carddefs.mjs --set=ST12 (texto oficial + stats do apitcg); autoria de efeito à mão por cima.
export const UNITS_PURPLE: Record<string, CardDef> = {
  "ST12-006": {
    "code": "ST12-006",
    "nameEn": "Unicorn Gundam 02 Banshee (Destroy Mode)",
    "cardType": "UNIT",
    "color": "purple",
    "level": 6,
    "cost": 5,
    "ap": 5,
    "hp": 4,
    "traits": [
      "Earth Federation"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Marida Cruz"
      ]
    },
    "triggerKeywords": [
      "Activate·Main",
      "Activate·Action"
    ]
  },
  "ST12-007": {
    "code": "ST12-007",
    "nameEn": "Gyan",
    "cardType": "UNIT",
    "color": "purple",
    "level": 2,
    "cost": 2,
    "ap": 3,
    "hp": 1,
    "traits": [
      "Zeon"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "M'Quve"
      ]
    },
    "triggerKeywords": [
      "When Linked"
    ]
  },
  "ST12-008": {
    "code": "ST12-008",
    "nameEn": "Efreet Schneid",
    "cardType": "UNIT",
    "color": "purple",
    "level": 4,
    "cost": 2,
    "ap": 4,
    "hp": 3,
    "traits": [
      "Zeon"
    ],
    "link": {
      "kind": "trait",
      "values": [
        "Zeon"
      ]
    }
  },
  "ST12-009": {
    "code": "ST12-009",
    "nameEn": "Unicorn Gundam 02 Banshee (Unicorn Mode)",
    "cardType": "UNIT",
    "color": "purple",
    "level": 4,
    "cost": 3,
    "ap": 3,
    "hp": 4,
    "traits": [
      "Earth Federation"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Marida Cruz"
      ]
    },
    "triggerKeywords": [
      "Destroyed"
    ]
  },
  "ST12-010": {
    "code": "ST12-010",
    "nameEn": "Slash Zaku Phantom",
    "cardType": "UNIT",
    "color": "purple",
    "level": 2,
    "cost": 1,
    "ap": 2,
    "hp": 2,
    "traits": [
      "ZAFT"
    ]
  },
};
