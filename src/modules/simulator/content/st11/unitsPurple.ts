import type { CardDef } from "../../engine/types";

// Gerado por scripts/gundam-gen-carddefs.mjs --set=ST11 (texto oficial + stats do apitcg); autoria de efeito à mão por cima.
export const UNITS_PURPLE: Record<string, CardDef> = {
  "ST11-006": {
    "code": "ST11-006",
    "nameEn": "Shamblo",
    "cardType": "UNIT",
    "color": "purple",
    "level": 6,
    "cost": 5,
    "ap": 4,
    "hp": 5,
    "traits": [
      "Zeon",
      "Marine"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Loni Garvey"
      ]
    },
    "triggerKeywords": [
      "Deploy"
    ],
    shieldAreaEffectDamageReduction: {
      amount: 5,
      boardCondition: { kind: "friendlyOtherUnitTraitCountAtLeast", trait: "Marine", n: 1 },
      sourceText:
        "If another friendly (Marine) Unit is in play at the start of your opponent's turn, during this turn, when a friendly shield area card receives enemy effect damage, reduce it by 5.",
    },
  },
  "ST11-007": {
    "code": "ST11-007",
    "nameEn": "Gundam Leopard",
    "cardType": "UNIT",
    "color": "purple",
    "level": 3,
    "cost": 2,
    "ap": 4,
    "hp": 3,
    "traits": [
      "Vulture",
      "Marine"
    ]
  },
  "ST11-008": {
    "code": "ST11-008",
    "nameEn": "Daughseat",
    "cardType": "UNIT",
    "color": "purple",
    "level": 2,
    "cost": 1,
    "ap": 2,
    "hp": 2,
    "traits": [
      "Vulture",
      "Marine"
    ]
  },
  "ST11-009": {
    "code": "ST11-009",
    "nameEn": "Kapool",
    "cardType": "UNIT",
    "color": "purple",
    "level": 1,
    "cost": 1,
    "ap": 1,
    "hp": 1,
    "traits": [
      "Militia",
      "Marine"
    ],
    "triggerKeywords": [
      "Destroyed"
    ]
  },
  "ST11-010": {
    "code": "ST11-010",
    "nameEn": "Abyss Gundam",
    "cardType": "UNIT",
    "color": "purple",
    "level": 4,
    "cost": 3,
    "ap": 4,
    "hp": 3,
    "traits": [
      "Earth Alliance",
      "Phantom Pain",
      "Marine"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Auel Neider"
      ]
    },
    "effectKeywords": [
      "Blocker"
    ]
  },
};
