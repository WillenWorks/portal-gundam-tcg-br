import type { CardDef } from "../../engine/types";

// Gerado por scripts/gundam-gen-carddefs.mjs --set=ST14 (texto oficial + stats do apitcg); autoria de efeito à mão por cima.
export const UNITS_GREEN: Record<string, CardDef> = {
  "ST14-006": {
    "code": "ST14-006",
    "nameEn": "Full Armor Unicorn Gundam (Destroy Mode)",
    "cardType": "UNIT",
    "color": "green",
    "level": 8,
    "cost": 6,
    "ap": 3,
    "hp": 6,
    "traits": [
      "Civilian"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Banagher Links"
      ]
    },
    "triggerKeywords": [
      "Deploy"
    ],
    damageReductions: [
      {
        immune: true,
        kind: "battle",
        duringPair: true,
        oncePerTurn: true,
        sourceUnitOnly: true,
        sourceApAtMostSelf: true,
        sourceText:
          "【During Pair】【Once per Turn】When this Unit would receive battle damage from an enemy Unit with AP equal to or less than it, it doesn't receive that damage.",
      },
    ],
  },
  "ST14-007": {
    "code": "ST14-007",
    "nameEn": "Full Armor Unicorn Gundam (Unicorn Mode)",
    "cardType": "UNIT",
    "color": "green",
    "level": 5,
    "cost": 3,
    "ap": 4,
    "hp": 4,
    "traits": [
      "Civilian"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Banagher Links"
      ]
    },
    "effectKeywords": [
      "Breach"
    ],
    "keywordTags": [
      "Breach 3"
    ]
  },
  "ST14-008": {
    "code": "ST14-008",
    "nameEn": "Gundam Heavyarms Custom (EW)",
    "cardType": "UNIT",
    "color": "green",
    "level": 6,
    "cost": 4,
    "ap": 6,
    "hp": 4,
    "traits": [
      "G Team"
    ],
    "link": {
      "kind": "trait",
      "values": [
        "G Team",
        "Operation Meteor"
      ]
    }
  },
  "ST14-009": {
    "code": "ST14-009",
    "nameEn": "Duel Gundam (Assault Shroud)",
    "cardType": "UNIT",
    "color": "green",
    "level": 3,
    "cost": 3,
    "ap": 3,
    "hp": 2,
    "traits": [
      "ZAFT"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Yzak Jule"
      ]
    },
    "triggerKeywords": [
      "Destroyed"
    ]
  },
  "ST14-010": {
    "code": "ST14-010",
    "nameEn": "Perfect Strike Gundam",
    "cardType": "UNIT",
    "color": "green",
    "level": 4,
    "cost": 2,
    "ap": 4,
    "hp": 3,
    "traits": [
      "Triple Ship Alliance"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Mu La Flaga"
      ]
    }
  },
};
