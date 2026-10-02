import type { CardDef } from "../../engine/types";

// Gerado por scripts/gundam-gen-carddefs.mjs --set=ST09 (texto oficial + stats do apitcg); autoria de efeito à mão por cima.
export const UNITS_PURPLE: Record<string, CardDef> = {
  "ST09-001": {
    "code": "ST09-001",
    "nameEn": "Impulse Gundam",
    "cardType": "UNIT",
    "color": "purple",
    "level": 3,
    "cost": 2,
    "ap": 3,
    "hp": 3,
    "traits": [
      "ZAFT",
      "Minerva Squad"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Shinn Asuka"
      ]
    },
    "triggerKeywords": [
      "Activate·Main"
    ]
  },
  "ST09-002": {
    "code": "ST09-002",
    "nameEn": "Force Impulse Gundam",
    "cardType": "UNIT",
    "color": "purple",
    "level": 5,
    "cost": 4,
    "ap": 5,
    "hp": 4,
    "traits": [
      "ZAFT",
      "Minerva Squad"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Shinn Asuka"
      ]
    },
    "triggerKeywords": [
      "Destroyed"
    ]
  },
  "ST09-005": {
    "code": "ST09-005",
    "nameEn": "Zaku Warrior",
    "cardType": "UNIT",
    "color": "purple",
    "level": 2,
    "cost": 1,
    "ap": 2,
    "hp": 2,
    "traits": [
      "ZAFT",
      "Minerva Squad"
    ]
  },
  "ST09-006": {
    "code": "ST09-006",
    "nameEn": "Sword Impulse Gundam",
    "cardType": "UNIT",
    "color": "purple",
    "level": 4,
    "cost": 2,
    "ap": 4,
    "hp": 2,
    "traits": [
      "ZAFT",
      "Minerva Squad"
    ],
    "link": {
      "kind": "trait",
      "values": [
        "Coordinator",
        "Minerva Squad"
      ]
    },
    "triggerKeywords": [
      "Deploy"
    ]
  },
  "ST09-007": {
    "code": "ST09-007",
    "nameEn": "Blast Impulse Gundam",
    "cardType": "UNIT",
    "color": "purple",
    "level": 5,
    "cost": 3,
    "ap": 5,
    "hp": 3,
    "traits": [
      "ZAFT",
      "Minerva Squad"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Shinn Asuka"
      ]
    },
    "effectKeywords": [
      "Blocker"
    ]
  },
};
