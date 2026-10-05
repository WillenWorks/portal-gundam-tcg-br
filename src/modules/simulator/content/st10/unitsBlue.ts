import type { CardDef } from "../../engine/types";

// Gerado por scripts/gundam-gen-carddefs.mjs --set=ST10 (texto oficial + stats do apitcg); autoria de efeito à mão por cima.
export const UNITS_BLUE: Record<string, CardDef> = {
  "ST10-001": {
    "code": "ST10-001",
    "nameEn": "Zeta Gundam (EX)",
    "cardType": "UNIT",
    "color": "blue",
    "level": 7,
    "cost": 6,
    "ap": 5,
    "hp": 5,
    "traits": [
      "G Generation"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Kamille Bidan"
      ]
    }
  },
  "ST10-002": {
    "code": "ST10-002",
    "nameEn": "Zeta Gundam",
    "cardType": "UNIT",
    "color": "blue",
    "level": 5,
    "cost": 4,
    "ap": 4,
    "hp": 4,
    "traits": [
      "G Generation"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Kamille Bidan"
      ],
      "orTraits": [
        "Support"
      ]
    },
    "triggerKeywords": [
      "Deploy"
    ]
  },
  "ST10-003": {
    "code": "ST10-003",
    "nameEn": "Gundam Mk-II (AEUG)",
    "cardType": "UNIT",
    "color": "blue",
    "level": 2,
    "cost": 2,
    "ap": 2,
    "hp": 2,
    "traits": [
      "G Generation"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Kamille Bidan"
      ]
    }
  },
  "ST10-004": {
    "code": "ST10-004",
    "nameEn": "Super Gundam",
    "cardType": "UNIT",
    "color": "blue",
    "level": 4,
    "cost": 3,
    "ap": 3,
    "hp": 4,
    "traits": [
      "G Generation"
    ],
    "effectKeywords": [
      "Repair"
    ],
    "keywordTags": [
      "Repair 2"
    ]
  },
  "ST10-005": {
    "code": "ST10-005",
    "nameEn": "Nemo",
    "cardType": "UNIT",
    "color": "blue",
    "level": 2,
    "cost": 1,
    "ap": 2,
    "hp": 2,
    "traits": [
      "G Generation"
    ]
  },
};
