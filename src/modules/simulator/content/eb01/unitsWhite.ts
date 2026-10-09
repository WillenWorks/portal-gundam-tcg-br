import type { CardDef } from "../../engine/types";

// Gerado por scripts/gundam-gen-carddefs.mjs --set=EB01 (texto oficial + stats do apitcg); autoria de efeito à mão por cima.
export const UNITS_WHITE: Record<string, CardDef> = {
  "EB01-041": {
    "code": "EB01-041",
    "nameEn": "Strike Freedom Gundam (EX)",
    "cardType": "UNIT",
    "color": "white",
    "level": 7,
    "cost": 6,
    "ap": 5,
    "hp": 5,
    "traits": [
      "G Generation"
    ],
    "link": {
      "kind": "trait",
      "values": [
        "Attack"
      ]
    },
    "effectKeywords": [
      "High-Maneuver"
    ],
    "triggerKeywords": [
      "Deploy"
    ]
  },
  "EB01-042": {
    "code": "EB01-042",
    "nameEn": "Psycho Haro (EX)",
    "cardType": "UNIT",
    "color": "white",
    "level": 8,
    "cost": 7,
    "ap": 6,
    "hp": 6,
    "traits": [
      "G Generation"
    ],
    "link": {
      "kind": "trait",
      "values": [
        "G Generation"
      ]
    },
    "triggerKeywords": [
      "Attack"
    ],
    staticAbilities: [
      { condition: "always", scope: "allUnits", keyword: "Blocker", boardCondition: { kind: "selfRested" }, sourceText: "While this Unit is rested, all Units gain <Blocker>." },
    ],
  },
  "EB01-043": {
    "code": "EB01-043",
    "nameEn": "Blue Destiny Unit-1 (EX)",
    "cardType": "UNIT",
    "color": "white",
    "level": 5,
    "cost": 3,
    "ap": 5,
    "hp": 3,
    "traits": [
      "G Generation"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Yuu Kajima"
      ]
    },
    "triggerKeywords": [
      "Attack"
    ]
  },
  "EB01-044": {
    "code": "EB01-044",
    "nameEn": "Justice Gundam (EX)",
    "cardType": "UNIT",
    "color": "white",
    "level": 6,
    "cost": 5,
    "ap": 5,
    "hp": 4,
    "traits": [
      "G Generation"
    ],
    "link": {
      "kind": "trait",
      "values": [
        "Durability"
      ]
    },
    "effectKeywords": [
      "Blocker"
    ],
    "triggerKeywords": [
      "Deploy"
    ]
  },
  "EB01-045": {
    "code": "EB01-045",
    "nameEn": "Psycho Zaku (EX)",
    "cardType": "UNIT",
    "color": "white",
    "level": 7,
    "cost": 5,
    "ap": 4,
    "hp": 6,
    "traits": [
      "G Generation"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Daryl Lorenz"
      ]
    },
    "effectKeywords": [
      "Suppression"
    ],
    "triggerKeywords": [
      "When Paired"
    ]
  },
  "EB01-046": {
    "code": "EB01-046",
    "nameEn": "Striker Custom (EX)",
    "cardType": "UNIT",
    "color": "white",
    "level": 3,
    "cost": 2,
    "ap": 3,
    "hp": 3,
    "traits": [
      "G Generation"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Ittou Tsurugi"
      ]
    },
    "triggerKeywords": [
      "Attack"
    ]
  },
  "EB01-047": {
    "code": "EB01-047",
    "nameEn": "Casval's Gundam",
    "cardType": "UNIT",
    "color": "white",
    "level": 4,
    "cost": 3,
    "ap": 3,
    "hp": 4,
    "traits": [
      "G Generation"
    ],
    "link": {
      "kind": "trait",
      "values": [
        "G Generation"
      ]
    },
    "triggerKeywords": [
      "When Paired"
    ]
  },
  "EB01-048": {
    "code": "EB01-048",
    "nameEn": "S Gundam",
    "cardType": "UNIT",
    "color": "white",
    "level": 4,
    "cost": 3,
    "ap": 4,
    "hp": 3,
    "traits": [
      "G Generation"
    ],
    "link": {
      "kind": "trait",
      "values": [
        "Attack"
      ]
    },
    "effectKeywords": [
      "Blocker"
    ]
  },
  "EB01-049": {
    "code": "EB01-049",
    "nameEn": "Pale Rider (Ground Heavy Equipment Type)",
    "cardType": "UNIT",
    "color": "white",
    "level": 6,
    "cost": 4,
    "ap": 5,
    "hp": 4,
    "traits": [
      "G Generation"
    ],
    staticAbilities: [
      {
        condition: "always",
        scope: "self",
        keyword: "Suppression",
        boardCondition: { kind: "friendlyUnitWithTraitAndKeyword", trait: "G Generation", keyword: "Blocker" },
        sourceText: "While a friendly (G Generation) Unit with <Blocker> is in play, this Unit gains <Suppression>.",
      },
    ],
  },
  "EB01-050": {
    "code": "EB01-050",
    "nameEn": "Saikoro Gundam",
    "cardType": "UNIT",
    "color": "white",
    "level": 6,
    "cost": 6,
    "ap": 5,
    "hp": 6,
    "traits": [
      "G Generation"
    ],
    "triggerKeywords": [
      "Attack"
    ]
  },
  "EB01-051": {
    "code": "EB01-051",
    "nameEn": "Ze'Gok",
    "cardType": "UNIT",
    "color": "white",
    "level": 1,
    "cost": 1,
    "ap": 1,
    "hp": 2,
    "traits": [
      "G Generation"
    ]
  },
  "EB01-052": {
    "code": "EB01-052",
    "nameEn": "Hildolfr",
    "cardType": "UNIT",
    "color": "white",
    "level": 2,
    "cost": 2,
    "ap": 0,
    "hp": 2,
    "traits": [
      "G Generation"
    ],
    "link": {
      "kind": "trait",
      "values": [
        "G Generation"
      ]
    },
    "triggerKeywords": [
      "Deploy"
    ]
  },
  "EB01-053": {
    "code": "EB01-053",
    "nameEn": "Gundam GP00",
    "cardType": "UNIT",
    "color": "white",
    "level": 2,
    "cost": 2,
    "ap": 3,
    "hp": 2,
    "traits": [
      "G Generation"
    ]
  },
  "EB01-054": {
    "code": "EB01-054",
    "nameEn": "Gaplant TR-5 \"Hrairoo\" Unit 1",
    "cardType": "UNIT",
    "color": "white",
    "level": 3,
    "cost": 2,
    "ap": 3,
    "hp": 3,
    "traits": [
      "G Generation"
    ],
    "effectKeywords": [
      "Blocker"
    ]
  },
  "EB01-055": {
    "code": "EB01-055",
    "nameEn": "Dom Gross Beil",
    "cardType": "UNIT",
    "color": "white",
    "level": 3,
    "cost": 2,
    "ap": 2,
    "hp": 3,
    "traits": [
      "G Generation"
    ],
    // 1v1: só 1 jogador inimigo — a guarda nunca liga
    protectsShieldsWhileRested: { boardCondition: { kind: "enemyPlayerCountAtLeast", n: 2 } },
    structuredSourceText: {
      protectsShieldsWhileRested: "If there are 2 or more enemy players and this Unit is rested, friendly Shields can't receive battle damage from enemy Units.",
    },
  },
  "EB01-056": {
    "code": "EB01-056",
    "nameEn": "Gundam Geminass 01",
    "cardType": "UNIT",
    "color": "white",
    "level": 3,
    "cost": 2,
    "ap": 4,
    "hp": 3,
    "traits": [
      "G Generation"
    ]
  },
  "EB01-057": {
    "code": "EB01-057",
    "nameEn": "Gundam Geminass 02",
    "cardType": "UNIT",
    "color": "white",
    "level": 4,
    "cost": 2,
    "ap": 3,
    "hp": 3,
    "traits": [
      "G Generation"
    ],
    "triggerKeywords": [
      "Deploy"
    ]
  },
  "EB01-058": {
    "code": "EB01-058",
    "nameEn": "Extreme Gundam",
    "cardType": "UNIT",
    "color": "white",
    "level": 4,
    "cost": 2,
    "ap": 3,
    "hp": 4,
    "traits": [
      "G Generation"
    ],
    // 1v1: só 1 jogador inimigo — nunca ganha <Blocker>
    staticAbilities: [
      {
        condition: "always",
        scope: "self",
        keyword: "Blocker",
        boardCondition: { kind: "enemyPlayerCountAtLeast", n: 2 },
        sourceText: "If there are 2 or more enemy players, this Unit gains <Blocker>.",
      },
    ],
  },
  "EB01-059": {
    "code": "EB01-059",
    "nameEn": "Psycho Zaku",
    "cardType": "UNIT",
    "color": "white",
    "level": 5,
    "cost": 3,
    "ap": 4,
    "hp": 4,
    "traits": [
      "G Generation"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Daryl Lorenz"
      ]
    },
    "triggerKeywords": [
      "Attack"
    ]
  },
  "EB01-060": {
    "code": "EB01-060",
    "nameEn": "Gundam Aquarius",
    "cardType": "UNIT",
    "color": "white",
    "level": 5,
    "cost": 4,
    "ap": 4,
    "hp": 4,
    "traits": [
      "G Generation"
    ],
    "link": {
      "kind": "trait",
      "values": [
        "Support"
      ]
    },
    "triggerKeywords": [
      "When Paired"
    ]
  },
};
