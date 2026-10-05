import type { CardDef } from "../../engine/types";

// Gerado por scripts/gundam-gen-carddefs.mjs --set=GD05 (texto oficial + stats do apitcg); autoria de efeito à mão por cima.
export const UNITS_RED: Record<string, CardDef> = {
  "GD05-033": {
    "code": "GD05-033",
    "nameEn": "Master Gundam",
    "cardType": "UNIT",
    "color": "red",
    "level": 7,
    "cost": 5,
    "ap": 5,
    "hp": 5,
    "traits": [
      "MF",
      "DG Cells"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Master Asia"
      ]
    },
    "triggerKeywords": [
      "Attack"
    ]
  },
  "GD05-034": {
    "code": "GD05-034",
    "nameEn": "Gaia Gundam",
    "cardType": "UNIT",
    "color": "red",
    "level": 3,
    "cost": 2,
    "ap": 3,
    "hp": 3,
    "traits": [
      "Earth Alliance",
      "Phantom Pain"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Stellar Loussier"
      ]
    }
  },
  "GD05-035": {
    "code": "GD05-035",
    "nameEn": "Dragon Gundam",
    "cardType": "UNIT",
    "color": "red",
    "level": 5,
    "cost": 3,
    "ap": 4,
    "hp": 4,
    "traits": [
      "MF",
      "Shuffle Alliance"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Sai Saici"
      ]
    },
    "triggerKeywords": [
      "Attack"
    ]
  },
  "GD05-036": {
    "code": "GD05-036",
    "nameEn": "Haow Gundam",
    "cardType": "UNIT",
    "color": "red",
    "level": 6,
    "cost": 4,
    "ap": 4,
    "hp": 4,
    "traits": [
      "MF"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Master Asia"
      ]
    },
    "triggerKeywords": [
      "When Paired"
    ]
  },
  "GD05-037": {
    "code": "GD05-037",
    "nameEn": "Destroy Gundam",
    "cardType": "UNIT",
    "color": "red",
    "level": 9,
    "cost": 8,
    "ap": 6,
    "hp": 6,
    "traits": [
      "Earth Alliance",
      "Phantom Pain"
    ],
    "link": {
      "kind": "trait",
      "values": [
        "Biological CPU"
      ]
    },
    // W7 — "While an enemy player has 7 or more cards in their trash, this card in your hand gets Lv. -3 and cost -3."
    "dynamicCost": { "condition": { "kind": "enemyTrashCountAtLeast", "n": 7 }, "amount": -3 },
    "dynamicLevel": { "condition": { "kind": "enemyTrashCountAtLeast", "n": 7 }, "amount": -3 },
    "structuredSourceText": {
      "dynamicCost": "While an enemy player has 7 or more cards in their trash, this card in your hand gets Lv. -3 and cost -3."
    },
    "staticAbilities": [
      { "condition": "duringLink", "scope": "self", "keyword": "Breach", "keywordValue": 3, "sourceText": "【During Link】This Unit gains <Breach 3>." }
    ]
  },
  "GD05-038": {
    "code": "GD05-038",
    "nameEn": "Gundam Throne Eins (GN High Mega Launcher)",
    "cardType": "UNIT",
    "color": "red",
    "level": 7,
    "cost": 5,
    "ap": 6,
    "hp": 4,
    "traits": [
      "CB",
      "Trinity"
    ],
    "link": {
      "kind": "trait",
      "values": [
        "Trinity"
      ]
    },
    "triggerKeywords": [
      "Activate·Main"
    ]
  },
  "GD05-039": {
    "code": "GD05-039",
    "nameEn": "Chaos Gundam",
    "cardType": "UNIT",
    "color": "red",
    "level": 3,
    "cost": 2,
    "ap": 4,
    "hp": 2,
    "traits": [
      "Earth Alliance",
      "Phantom Pain"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Sting Oakley"
      ]
    },
    "triggerKeywords": [
      "Attack"
    ]
  },
  "GD05-040": {
    "code": "GD05-040",
    "nameEn": "Abyss Gundam",
    "cardType": "UNIT",
    "color": "red",
    "level": 3,
    "cost": 2,
    "ap": 2,
    "hp": 4,
    "traits": [
      "Earth Alliance",
      "Phantom Pain"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Auel Neider"
      ]
    },
    "effectKeywords": [
      "Support"
    ],
    "keywordTags": [
      "Support 2"
    ],
    "triggerKeywords": [
      "Activate·Main"
    ]
  },
  "GD05-041": {
    "code": "GD05-041",
    "nameEn": "Gaia Gundam (MA Mode)",
    "cardType": "UNIT",
    "color": "red",
    "level": 4,
    "cost": 3,
    "ap": 4,
    "hp": 3,
    "traits": [
      "Earth Alliance",
      "Phantom Pain"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Stellar Loussier"
      ]
    },
    // W7 (C10) — desconto no turno em que o oponente descartou por efeito seu (GD05-034/046)
    "dynamicCost": { "condition": { "kind": "opponentDiscardedByYourEffectThisTurn" }, "amount": -2 },
    "structuredSourceText": {
      "dynamicCost": "During a turn where your opponent has discarded due to one of your effects, this card in your hand gets cost -2."
    }
  },
  "GD05-042": {
    "code": "GD05-042",
    "nameEn": "Shining Gundam",
    "cardType": "UNIT",
    "color": "red",
    "level": 2,
    "cost": 1,
    "ap": 2,
    "hp": 2,
    "traits": [
      "MF",
      "Shuffle Alliance"
    ]
  },
  "GD05-043": {
    "code": "GD05-043",
    "nameEn": "Neros Gundam",
    "cardType": "UNIT",
    "color": "red",
    "level": 2,
    "cost": 2,
    "ap": 3,
    "hp": 2,
    "traits": [
      "MF"
    ]
  },
  "GD05-044": {
    "code": "GD05-044",
    "nameEn": "Gundam Rose",
    "cardType": "UNIT",
    "color": "red",
    "level": 3,
    "cost": 2,
    "ap": 3,
    "hp": 3,
    "traits": [
      "MF",
      "Shuffle Alliance"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "George de Sand"
      ]
    },
    "triggerKeywords": [
      "Attack"
    ]
  },
  "GD05-045": {
    "code": "GD05-045",
    "nameEn": "Chaos Gundam (MA Mode)",
    "cardType": "UNIT",
    "color": "red",
    "level": 4,
    "cost": 3,
    "ap": 3,
    "hp": 4,
    "traits": [
      "Earth Alliance",
      "Phantom Pain"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Sting Oakley"
      ]
    },
    "effectKeywords": [
      "Breach"
    ],
    "keywordTags": [
      "Breach 3"
    ]
  },
  "GD05-046": {
    "code": "GD05-046",
    "nameEn": "Abyss Gundam (MA Mode)",
    "cardType": "UNIT",
    "color": "red",
    "level": 4,
    "cost": 2,
    "ap": 3,
    "hp": 3,
    "traits": [
      "Earth Alliance",
      "Phantom Pain"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Auel Neider"
      ]
    },
    "triggerKeywords": [
      "When Paired"
    ]
  },
  "GD05-047": {
    "code": "GD05-047",
    "nameEn": "Exass",
    "cardType": "UNIT",
    "color": "red",
    "level": 3,
    "cost": 2,
    "ap": 4,
    "hp": 2,
    "traits": [
      "Earth Alliance",
      "Phantom Pain"
    ],
    "link": {
      "kind": "trait",
      "values": [
        "Earth Alliance"
      ]
    }
  },
  "GD05-048": {
    "code": "GD05-048",
    "nameEn": "Gundam Kyrios (Flight Mode)",
    "cardType": "UNIT",
    "color": "red",
    "level": 3,
    "cost": 2,
    "ap": 3,
    "hp": 1,
    "traits": [
      "CB",
      "GN Drive"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Allelujah Haptism",
        "Hallelujah Haptism"
      ]
    }
  },
};
