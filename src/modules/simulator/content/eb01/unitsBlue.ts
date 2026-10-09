import type { CardDef } from "../../engine/types";

// Gerado por scripts/gundam-gen-carddefs.mjs --set=EB01 (texto oficial + stats do apitcg); autoria de efeito à mão por cima.
export const UNITS_BLUE: Record<string, CardDef> = {
  "EB01-001": {
    "code": "EB01-001",
    "nameEn": "Gundam Astray Red Frame Custom (EX)",
    "cardType": "UNIT",
    "color": "blue",
    "level": 6,
    "cost": 5,
    "ap": 5,
    "hp": 4,
    "traits": [
      "G Generation"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Lowe Guele"
      ]
    },
    "triggerKeywords": [
      "Activate·Main"
    ]
  },
  "EB01-002": {
    "code": "EB01-002",
    "nameEn": "Hi-Nu Gundam (EX)",
    "cardType": "UNIT",
    "color": "blue",
    "level": 8,
    "cost": 7,
    "ap": 6,
    "hp": 5,
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
      "Deploy",
      "Attack"
    ]
  },
  "EB01-003": {
    "code": "EB01-003",
    "nameEn": "Narrative Gundam A-Packs (EX)",
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
        "Jona Basta"
      ]
    },
    "effectKeywords": [
      "Repair"
    ],
    "keywordTags": [
      "Repair 2"
    ]
  },
  "EB01-004": {
    "code": "EB01-004",
    "nameEn": "Gundam Barbatos Lupus Rex (EX)",
    "cardType": "UNIT",
    "color": "blue",
    "level": 6,
    "cost": 5,
    "ap": 3,
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
      "Repair"
    ],
    "keywordTags": [
      "Repair 2"
    ],
    onSelfHeal: { oncePerTurn: true, damageRestedEnemy: 1 },
    structuredSourceText: {
      onSelfHeal: "【Once per Turn】During your turn, when this Unit recovers HP, choose 1 rested enemy Unit. Deal 1 damage to it.",
    },
  },
  "EB01-005": {
    "code": "EB01-005",
    "nameEn": "Zeta Gundam Ⅲ P2 Type",
    "cardType": "UNIT",
    "color": "blue",
    "level": 7,
    "cost": 6,
    "ap": 6,
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
      "Deploy"
    ]
  },
  "EB01-006": {
    "code": "EB01-006",
    "nameEn": "Gundam Astray Gold Frame Amatsu",
    "cardType": "UNIT",
    "color": "blue",
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
    "triggerKeywords": [
      "Deploy"
    ]
  },
  "EB01-007": {
    "code": "EB01-007",
    "nameEn": "Gundam TR-1 \"Hazel-Rah\"",
    "cardType": "UNIT",
    "color": "blue",
    "level": 5,
    "cost": 3,
    "ap": 5,
    "hp": 4,
    "traits": [
      "G Generation"
    ],
    "link": {
      "kind": "trait",
      "values": [
        "Attack"
      ]
    }
  },
  "EB01-008": {
    "code": "EB01-008",
    "nameEn": "Gundam Delta Kai",
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
      "kind": "trait",
      "values": [
        "G Generation"
      ]
    },
    "triggerKeywords": [
      "Deploy"
    ]
  },
  "EB01-009": {
    "code": "EB01-009",
    "nameEn": "Gundam Full Armor (Thunderbolt) (EX)",
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
        "Io Fleming"
      ]
    },
    "triggerKeywords": [
      "Deploy"
    ]
  },
  "EB01-010": {
    "code": "EB01-010",
    "nameEn": "Gundam Barbatos 6th Form",
    "cardType": "UNIT",
    "color": "blue",
    "level": 5,
    "cost": 4,
    "ap": 5,
    "hp": 2,
    "traits": [
      "G Generation"
    ],
    "triggerKeywords": [
      "Deploy"
    ]
  },
  "EB01-011": {
    "code": "EB01-011",
    "nameEn": "Beginning Gundam",
    "cardType": "UNIT",
    "color": "blue",
    "level": 1,
    "cost": 1,
    "ap": 1,
    "hp": 1,
    "traits": [
      "G Generation"
    ],
    "effectKeywords": [
      "Blocker"
    ]
  },
  "EB01-012": {
    "code": "EB01-012",
    "nameEn": "Dom Bein Nichts",
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
      "kind": "trait",
      "values": [
        "Support"
      ]
    }
  },
  "EB01-013": {
    "code": "EB01-013",
    "nameEn": "Red Gundam(0085)",
    "cardType": "UNIT",
    "color": "blue",
    "level": 2,
    "cost": 2,
    "ap": 0,
    "hp": 4,
    "traits": [
      "G Generation"
    ],
    "triggerKeywords": [
      "Attack"
    ]
  },
  "EB01-014": {
    "code": "EB01-014",
    "nameEn": "Gouf Vijayanta",
    "cardType": "UNIT",
    "color": "blue",
    "level": 3,
    "cost": 2,
    "ap": 3,
    "hp": 3,
    "traits": [
      "G Generation"
    ],
    damageReductions: [
      {
        immune: true,
        kind: "effect",
        duringOpponentTurnOnly: true,
        sourceUnitOnly: true,
        sourceMaxLevel: 5,
        sourceText: "During your opponent's turn, this Unit can't receive effect damage from enemy Units that are Lv.5 or lower.",
      },
    ],
  },
  "EB01-015": {
    "code": "EB01-015",
    "nameEn": "Prototype Asshimar TR-3 \"Kehaar\"",
    "cardType": "UNIT",
    "color": "blue",
    "level": 3,
    "cost": 2,
    "ap": 1,
    "hp": 4,
    "traits": [
      "G Generation"
    ],
    "triggerKeywords": [
      "Destroyed"
    ]
  },
  "EB01-016": {
    "code": "EB01-016",
    "nameEn": "Tornado Gundam",
    "cardType": "UNIT",
    "color": "blue",
    "level": 3,
    "cost": 2,
    "ap": 3,
    "hp": 3,
    "traits": [
      "G Generation"
    ],
    "link": {
      "kind": "trait",
      "values": [
        "G Generation"
      ]
    }
  },
  "EB01-017": {
    "code": "EB01-017",
    "nameEn": "Haro",
    "cardType": "UNIT",
    "color": "blue",
    "level": 3,
    "cost": 3,
    "ap": 3,
    "hp": 3,
    "traits": [
      "G Generation"
    ],
    "triggerKeywords": [
      "Destroyed"
    ]
  },
  "EB01-018": {
    "code": "EB01-018",
    "nameEn": "Gundam Astray Blue Frame Second L",
    "cardType": "UNIT",
    "color": "blue",
    "level": 4,
    "cost": 2,
    "ap": 3,
    "hp": 3,
    "traits": [
      "G Generation"
    ],
    "triggerKeywords": [
      "Attack"
    ]
  },
  "EB01-019": {
    "code": "EB01-019",
    "nameEn": "Gundam Pixy",
    "cardType": "UNIT",
    "color": "blue",
    "level": 4,
    "cost": 3,
    "ap": 2,
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
      "Attack"
    ]
  },
  "EB01-020": {
    "code": "EB01-020",
    "nameEn": "Gundam Mk-Ⅲ",
    "cardType": "UNIT",
    "color": "blue",
    "level": 4,
    "cost": 3,
    "ap": 3,
    "hp": 2,
    "traits": [
      "G Generation"
    ],
    "link": {
      "kind": "trait",
      "values": [
        "Durability"
      ]
    },
    "triggerKeywords": [
      "Activate·Action"
    ]
  },
};
