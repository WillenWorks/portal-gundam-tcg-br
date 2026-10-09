import type { CardDef } from "../../engine/types";

// Gerado por scripts/gundam-gen-carddefs.mjs --set=ST13 (texto oficial + stats do apitcg); autoria de efeito à mão por cima.
export const UNITS_RED: Record<string, CardDef> = {
  "ST13-006": {
    "code": "ST13-006",
    "nameEn": "Gundam Aerial",
    "cardType": "UNIT",
    "color": "red",
    "level": 6,
    "cost": 5,
    "ap": 5,
    "hp": 4,
    "traits": [
      "Academy"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Suletta Mercury"
      ]
    },
    "triggerKeywords": [
      "Attack",
      "Activate·Action"
    ]
  },
  "ST13-007": {
    "code": "ST13-007",
    "nameEn": "Gyunei's Jagd Doga",
    "cardType": "UNIT",
    "color": "red",
    "level": 4,
    "cost": 3,
    "ap": 3,
    "hp": 4,
    "traits": [
      "Neo Zeon"
    ],
    "link": {
      "kind": "trait",
      "values": [
        "Neo Zeon"
      ]
    },
    "triggerKeywords": [
      "Activate·Main"
    ],
    effectKeywords: ["Support"],
    keywordTags: ["Support 1"],
  },
  "ST13-008": {
    "code": "ST13-008",
    "nameEn": "Gundam Throne Zwei",
    "cardType": "UNIT",
    "color": "red",
    "level": 3,
    "cost": 2,
    "ap": 4,
    "hp": 3,
    "traits": [
      "CB",
      "Trinity"
    ]
  },
  "ST13-009": {
    "code": "ST13-009",
    "nameEn": "Gundam Pharact",
    "cardType": "UNIT",
    "color": "red",
    "level": 3,
    "cost": 2,
    "ap": 3,
    "hp": 3,
    "traits": [
      "Academy"
    ],
    "link": {
      "kind": "trait",
      "values": [
        "Academy"
      ]
    },
    "triggerKeywords": [
      "Attack"
    ]
  },
  "ST13-010": {
    "code": "ST13-010",
    "nameEn": "Red Gundam (0079)",
    "cardType": "UNIT",
    "color": "red",
    "level": 5,
    "cost": 4,
    "ap": 4,
    "hp": 4,
    "traits": [
      "Zeon"
    ],
    "link": {
      "kind": "trait",
      "values": [
        "Newtype"
      ]
    },
    "triggerKeywords": [
      "Activate·Main"
    ]
  },
};
