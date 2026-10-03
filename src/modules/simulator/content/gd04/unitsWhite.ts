import type { CardDef } from "../../engine/types";

// Gerado por scripts/gundam-gen-carddefs.mjs --set=GD04 (texto oficial + stats do apitcg); autoria de efeito à mão por cima.
export const UNITS_WHITE: Record<string, CardDef> = {
  "GD04-065": {
    "code": "GD04-065",
    "nameEn": "Unicorn Gundam 02 Banshee Norn (Destroy Mode)",
    "cardType": "UNIT",
    "color": "white",
    "level": 7,
    "cost": 5,
    "ap": 5,
    "hp": 5,
    "traits": [
      "Earth Federation"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Riddhe Marcenas"
      ]
    },
    "triggerKeywords": [
      "Activate·Main",
      "Attack"
    ]
  },
  "GD04-066": {
    "code": "GD04-066",
    "nameEn": "Unicorn Gundam (Awakened)",
    "cardType": "UNIT",
    "color": "white",
    "level": 7,
    "cost": 5,
    "ap": 4,
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
    "effectKeywords": [
      "Suppression"
    ]
  },
  "GD04-067": {
    "code": "GD04-067",
    "nameEn": "∀ Gundam",
    "cardType": "UNIT",
    "color": "white",
    "level": 5,
    "cost": 3,
    "ap": 4,
    "hp": 4,
    "traits": [
      "Militia"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Loran Cehack"
      ]
    },
    "triggerKeywords": [
      "Activate·Main"
    ]
  },
  "GD04-068": {
    "code": "GD04-068",
    // W5 (C2)
    damageReductions: [{ amount: 3, kind: "effect", sourceText: "When this Unit receives effect damage from an enemy, reduce it by 3." }],
    "nameEn": "Silver Bullet",
    "cardType": "UNIT",
    "color": "white",
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
        "Gael Chan"
      ]
    },
    "effectKeywords": [
      "Blocker"
    ]
  },
  "GD04-069": {
    "code": "GD04-069",
    "nameEn": "∀ Gundam",
    "cardType": "UNIT",
    "color": "white",
    "level": 5,
    "cost": 3,
    "ap": 4,
    "hp": 3,
    "traits": [
      "Militia"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Loran Cehack"
      ]
    },
    "effectKeywords": [
      "Blocker"
    ]
  },
  "GD04-070": {
    "code": "GD04-070",
    "nameEn": "Al-Saachez's AEU Enact Custom Moralia Development Experiment Type",
    "cardType": "UNIT",
    "color": "white",
    "level": 2,
    "cost": 2,
    "ap": 3,
    "hp": 1,
    "traits": [
      "Superpower Bloc"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Ali al-Saachez"
      ]
    },
    "triggerKeywords": [
      "Deploy"
    ]
  },
  "GD04-071": {
    "code": "GD04-071",
    "nameEn": "Graham's Union Flag Custom Ⅱ (GN Flag)",
    "cardType": "UNIT",
    "color": "white",
    "level": 5,
    "cost": 3,
    "ap": 4,
    "hp": 3,
    "traits": [
      "UN"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Graham Aker"
      ]
    },
    "triggerKeywords": [
      "Burst",
      "Activate·Main"
    ],
    "hasBurst": true
  },
  "GD04-072": {
    "code": "GD04-072",
    "nameEn": "Unicorn Gundam 02 Banshee Norn (Unicorn Mode)",
    "cardType": "UNIT",
    "color": "white",
    "level": 5,
    "cost": 3,
    "ap": 5,
    "hp": 3,
    "traits": [
      "Earth Federation"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Riddhe Marcenas"
      ]
    },
    "triggerKeywords": [
      "When Linked"
    ]
  },
  "GD04-073": {
    "code": "GD04-073",
    "nameEn": "∀ Gundam",
    "cardType": "UNIT",
    "color": "white",
    "level": 4,
    "cost": 2,
    "ap": 3,
    "hp": 3,
    "traits": [
      "Militia"
    ],
    "link": {
      "kind": "trait",
      "values": [
        "Militia",
        "Moonrace"
      ]
    },
    "triggerKeywords": [
      "Activate·Main"
    ]
  },
  "GD04-074": {
    "code": "GD04-074",
    "nameEn": "Kapool",
    "cardType": "UNIT",
    "color": "white",
    "level": 3,
    "cost": 2,
    "ap": 3,
    "hp": 3,
    "traits": [
      "Militia"
    ],
    "link": {
      "kind": "trait",
      "values": [
        "Militia"
      ]
    },
    "triggerKeywords": [
      "Attack"
    ]
  },
  "GD04-075": {
    "code": "GD04-075",
    // W4 (GD04)
    dynamicCost: { amount: -1, perTrashMatching: { cardType: "COMMAND", anyTrait: ["UN", "Superpower Bloc"] } },
    structuredSourceText: { dynamicCost: "Reduce the cost of this card in your hand by an amount equal to the number of (UN)/(Superpower Bloc) Command cards in your trash." },
    "nameEn": "GN-X",
    "cardType": "UNIT",
    "color": "white",
    "level": 4,
    "cost": 6,
    "ap": 5,
    "hp": 3,
    "traits": [
      "UN"
    ],
    "link": {
      "kind": "trait",
      "values": [
        "UN"
      ]
    }
  },
  "GD04-076": {
    "code": "GD04-076",
    "nameEn": "Hipheavy",
    "cardType": "UNIT",
    "color": "white",
    "level": 1,
    "cost": 1,
    "ap": 1,
    "hp": 2,
    "traits": [
      "Militia"
    ]
  },
  "GD04-077": {
    "code": "GD04-077",
    "nameEn": "Flat (Militia)",
    "cardType": "UNIT",
    "color": "white",
    "level": 3,
    "cost": 2,
    "ap": 2,
    "hp": 4,
    "traits": [
      "Militia"
    ],
    "effectKeywords": [
      "Blocker"
    ]
  },
  "GD04-078": {
    "code": "GD04-078",
    "nameEn": "Borjarnon",
    "cardType": "UNIT",
    "color": "white",
    "level": 2,
    "cost": 1,
    "ap": 2,
    "hp": 2,
    "traits": [
      "Militia"
    ]
  },
  "GD04-079": {
    "code": "GD04-079",
    "nameEn": "Agrissa",
    "cardType": "UNIT",
    "color": "white",
    "level": 5,
    "cost": 3,
    "ap": 5,
    "hp": 4,
    "traits": [
      "Superpower Bloc"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Ali al-Saachez"
      ]
    }
  },
  "GD04-080": {
    "code": "GD04-080",
    "nameEn": "Alvatore",
    "cardType": "UNIT",
    "color": "white",
    "level": 4,
    "cost": 4,
    "ap": 4,
    "hp": 4,
    "traits": [
      "UN"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Alejandro Corner"
      ]
    },
    "triggerKeywords": [
      "Destroyed"
    ]
  },
};
