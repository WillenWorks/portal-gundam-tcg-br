import type { CardDef } from "../../engine/types";

// Gerado por scripts/gundam-gen-carddefs.mjs --set=ST14 (texto oficial + stats do apitcg); autoria de efeito à mão por cima.
export const UNITS_WHITE: Record<string, CardDef> = {
  "ST14-001": {
    "code": "ST14-001",
    "nameEn": "The-O",
    "cardType": "UNIT",
    "color": "white",
    "level": 9,
    "cost": 8,
    "ap": 6,
    "hp": 7,
    "traits": [
      "Titans",
      "Jupitris"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Paptimus Scirocco"
      ]
    },
    "effectKeywords": [
      "Suppression"
    ],
    lowestLevelEnemyRestedStayRested: {},
    structuredSourceText: {
      lowestLevelEnemyRestedStayRested: "Each enemy player's rested Units with the lowest Lv. won't be set as active during the start phase of their turn.",
    },
  },
  "ST14-002": {
    "code": "ST14-002",
    "nameEn": "Gundam NT-1 Full Armor",
    "cardType": "UNIT",
    "color": "white",
    "level": 5,
    "cost": 4,
    "ap": 4,
    "hp": 4,
    "traits": [
      "Earth Federation"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Christina Mackenzie"
      ],
      "orTraits": [
        "Newtype"
      ]
    },
    "effectKeywords": [
      "Blocker"
    ]
  },
  "ST14-003": {
    "code": "ST14-003",
    "nameEn": "Palace Athene",
    "cardType": "UNIT",
    "color": "white",
    "level": 4,
    "cost": 3,
    "ap": 3,
    "hp": 4,
    "traits": [
      "Titans",
      "Jupitris"
    ],
    "link": {
      "kind": "trait",
      "values": [
        "Jupitris"
      ]
    },
    "triggerKeywords": [
      "Deploy"
    ]
  },
  "ST14-004": {
    "code": "ST14-004",
    "nameEn": "Geara Doga (Heavy Armed Type)",
    "cardType": "UNIT",
    "color": "white",
    "level": 1,
    "cost": 1,
    "ap": 2,
    "hp": 1,
    "traits": [
      "Neo Zeon"
    ],
    "effectKeywords": [
      "Blocker"
    ],
    attackTargetRules: { cannotTargetPlayer: true },
    structuredSourceText: { attackTargetRules: "This Unit can't choose the enemy player as its attack target." },
  },
  "ST14-005": {
    "code": "ST14-005",
    "nameEn": "G-Falcon DX",
    "cardType": "UNIT",
    "color": "white",
    "level": 7,
    "cost": 6,
    "ap": 5,
    "hp": 5,
    "traits": [
      "Vulture"
    ],
    "link": {
      "kind": "trait",
      "values": [
        "Vulture",
        "Newtype"
      ]
    },
    "triggerKeywords": [
      "Deploy"
    ]
  },
};
