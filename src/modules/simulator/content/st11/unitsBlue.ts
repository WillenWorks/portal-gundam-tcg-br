import type { CardDef } from "../../engine/types";

// Gerado por scripts/gundam-gen-carddefs.mjs --set=ST11 (texto oficial + stats do apitcg); autoria de efeito à mão por cima.
export const UNITS_BLUE: Record<string, CardDef> = {
  "ST11-001": {
    "code": "ST11-001",
    "nameEn": "Char's Z'Gok",
    "cardType": "UNIT",
    "color": "blue",
    "level": 4,
    "cost": 3,
    "ap": 3,
    "hp": 3,
    "traits": [
      "Zeon",
      "Marine"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Char Aznable"
      ]
    },
    "triggerKeywords": [
      "Deploy"
    ],
    cannotBeAttackTarget: {
      condition: "duringPair",
      boardCondition: { kind: "friendlyOtherUnitTraitCountAtLeast", trait: "Marine", n: 2 },
      sourceText: "【During Pair】While 2 or more other friendly (Marine) Units are in play, enemy Units can't choose this Unit as their attack target.",
    },
  },
  "ST11-002": {
    "code": "ST11-002",
    "nameEn": "Acguy",
    "cardType": "UNIT",
    "color": "blue",
    "level": 3,
    "cost": 2,
    "ap": 3,
    "hp": 1,
    "traits": [
      "Zeon",
      "Marine"
    ],
    "link": {
      "kind": "trait",
      "values": [
        "Zeon"
      ]
    },
    damageReductions: [
      {
        immune: true,
        kind: "effect",
        duringOpponentTurnOnly: true,
        boardCondition: { kind: "selfRested" },
        aura: { targetCondition: { kind: "allOf", conditions: [{ kind: "traitIs", trait: "Marine" }, { kind: "hpAtMost", n: 2 }] } },
        sourceText:
          "During your opponent's turn, while this Unit is rested, friendly (Marine) Units with 2 or less HP can't receive enemy effect damage.",
      },
    ],
  },
  "ST11-003": {
    "code": "ST11-003",
    "nameEn": "Zock",
    "cardType": "UNIT",
    "color": "blue",
    "level": 3,
    "cost": 2,
    "ap": 3,
    "hp": 3,
    "traits": [
      "Zeon",
      "Marine"
    ],
    staticAbilities: [
      {
        condition: "always",
        scope: "self",
        keyword: "Blocker",
        boardCondition: { kind: "friendlyOtherUnitTraitCountAtLeast", trait: "Marine", n: 1 },
        sourceText: "While another friendly (Marine) Unit is in play, this Unit gains <Blocker>.",
      },
    ],
  },
  "ST11-004": {
    "code": "ST11-004",
    "nameEn": "ZnO",
    "cardType": "UNIT",
    "color": "blue",
    "level": 3,
    "cost": 3,
    "ap": 3,
    "hp": 2,
    "traits": [
      "ZAFT",
      "Marine"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Marco Morassim"
      ]
    },
    "triggerKeywords": [
      "Deploy"
    ]
  },
  "ST11-005": {
    "code": "ST11-005",
    "nameEn": "Ash",
    "cardType": "UNIT",
    "color": "blue",
    "level": 5,
    "cost": 4,
    "ap": 4,
    "hp": 4,
    "traits": [
      "ZAFT",
      "Marine"
    ],
    "link": {
      "kind": "trait",
      "values": [
        "ZAFT"
      ]
    },
    "effectKeywords": [
      "Repair"
    ],
    "keywordTags": [
      "Repair 2"
    ]
  },
};
