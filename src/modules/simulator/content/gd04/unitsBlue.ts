import type { CardDef } from "../../engine/types";

// Gerado por scripts/gundam-gen-carddefs.mjs --set=GD04 (texto oficial + stats do apitcg); autoria de efeito à mão por cima.
export const UNITS_BLUE: Record<string, CardDef> = {
  "GD04-001": {
    "code": "GD04-001",
    "nameEn": "Gundam",
    "cardType": "UNIT",
    "color": "blue",
    "level": 6,
    "cost": 4,
    "ap": 6,
    "hp": 3,
    "traits": [
      "Earth Federation",
      "White Base Team"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Amuro Ray"
      ]
    },
    "triggerKeywords": [
      "Attack"
    ]
  },
  "GD04-002": {
    "code": "GD04-002",
    // W3 (GD04)
    staticAbilities: [
      {
        sourceText: "During your turn, all your (Earth Federation) Units get AP+1.",
        condition: "always",
        scope: "allFriendlyUnits",
        targetCondition: { kind: "traitIs", trait: "Earth Federation" },
        duringYourTurnOnly: true,
        stat: "ap",
        amount: 1,
      },
    ],
    "nameEn": "Penelope (Flight Form)",
    "cardType": "UNIT",
    "color": "blue",
    "level": 6,
    "cost": 5,
    "ap": 3,
    "hp": 5,
    "traits": [
      "Earth Federation"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Lane Aim"
      ]
    },
    "triggerKeywords": [
      "Deploy"
    ]
  },
  "GD04-003": {
    "code": "GD04-003",
    "nameEn": "Victory Gundam",
    "cardType": "UNIT",
    "color": "blue",
    "level": 4,
    "cost": 3,
    "ap": 3,
    "hp": 4,
    "traits": [
      "League Militaire",
      "Victory Type"
    ],
    "link": {
      "kind": "trait",
      "values": [
        "League Militaire"
      ]
    },
    "triggerKeywords": [
      "Attack"
    ]
  },
  "GD04-004": {
    "code": "GD04-004",
    "nameEn": "Psycho Gundam Mk-Ⅱ",
    "cardType": "UNIT",
    "color": "blue",
    "level": 8,
    "cost": 7,
    "ap": 4,
    "hp": 7,
    "traits": [
      "Titans"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Rosamia Badam"
      ]
    },
    "effectKeywords": [
      "Repair"
    ],
    "keywordTags": [
      "Repair 2"
    ]
  },
  "GD04-005": {
    "code": "GD04-005",
    "nameEn": "GM III",
    "cardType": "UNIT",
    "color": "blue",
    "level": 2,
    "cost": 2,
    "ap": 3,
    "hp": 2,
    "traits": [
      "Earth Federation"
    ]
  },
  "GD04-006": {
    "code": "GD04-006",
    "nameEn": "V-Dash Gundam",
    "cardType": "UNIT",
    "color": "blue",
    "level": 6,
    "cost": 4,
    "ap": 4,
    "hp": 5,
    "traits": [
      "League Militaire",
      "Victory Type"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Üso Ewin"
      ]
    },
    "effectKeywords": [
      "Breach"
    ],
    "keywordTags": [
      "Breach 3"
    ],
    "triggerKeywords": [
      "Activate·Main"
    ]
  },
  "GD04-007": {
    "code": "GD04-007",
    "nameEn": "Victory Gundam Hexa",
    "cardType": "UNIT",
    "color": "blue",
    "level": 5,
    "cost": 4,
    "ap": 4,
    "hp": 4,
    "traits": [
      "League Militaire",
      "Victory Type"
    ],
    "link": {
      "kind": "trait",
      "values": [
        "League Militaire"
      ]
    },
    "triggerKeywords": [
      "Attack"
    ]
  },
  "GD04-008": {
    "code": "GD04-008",
    // W3 (GD04)
    staticAbilities: [{ sourceText: "【During Link】This Unit gains <High-Maneuver>.", condition: "duringLink", scope: "self", keyword: "High-Maneuver" }],
    "nameEn": "Gundam",
    "cardType": "UNIT",
    "color": "blue",
    "level": 5,
    "cost": 3,
    "ap": 4,
    "hp": 4,
    "traits": [
      "Earth Federation",
      "White Base Team"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Amuro Ray"
      ]
    }
  },
  "GD04-009": {
    "code": "GD04-009",
    "nameEn": "Guncannon (108) & Guncannon (109)",
    "cardType": "UNIT",
    "color": "blue",
    "level": 5,
    "cost": 4,
    "ap": 3,
    "hp": 4,
    "traits": [
      "Earth Federation",
      "White Base Team"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Kai Shiden",
        "Hayato Kobayashi"
      ]
    },
    "triggerKeywords": [
      "When Linked"
    ]
  },
  "GD04-010": {
    "code": "GD04-010",
    "nameEn": "Gaplant",
    "cardType": "UNIT",
    "color": "blue",
    "level": 4,
    "cost": 2,
    "ap": 3,
    "hp": 4,
    "traits": [
      "Titans"
    ],
    "link": {
      "kind": "trait",
      "values": [
        "Titans"
      ]
    }
  },
  "GD04-011": {
    "code": "GD04-011",
    "nameEn": "Victory Gundam",
    "cardType": "UNIT",
    "color": "blue",
    "level": 3,
    "cost": 2,
    "ap": 3,
    "hp": 2,
    "traits": [
      "League Militaire",
      "Victory Type"
    ],
    "triggerKeywords": [
      "Destroyed"
    ]
  },
  "GD04-012": {
    "code": "GD04-012",
    "nameEn": "Core Booster (005) & Core Booster (006)",
    "cardType": "UNIT",
    "color": "blue",
    "level": 3,
    "cost": 2,
    "ap": 3,
    "hp": 3,
    "traits": [
      "Earth Federation",
      "White Base Team"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Sleggar Law",
        "Sayla Mass"
      ]
    }
  },
  "GD04-013": {
    "code": "GD04-013",
    "nameEn": "Core Fighter",
    "cardType": "UNIT",
    "color": "blue",
    "level": 4,
    "cost": 2,
    "ap": 2,
    "hp": 3,
    "traits": [
      "League Militaire",
      "Victory Type"
    ],
    "link": {
      "kind": "trait",
      "values": [
        "League Militaire"
      ]
    }
  },
  "GD04-014": {
    "code": "GD04-014",
    "nameEn": "Shokew",
    "cardType": "UNIT",
    "color": "blue",
    "level": 2,
    "cost": 2,
    "ap": 2,
    "hp": 3,
    "traits": [
      "League Militaire",
      "Zanscare"
    ]
  },
  "GD04-015": {
    "code": "GD04-015",
    "nameEn": "Gun EZ",
    "cardType": "UNIT",
    "color": "blue",
    "level": 3,
    "cost": 2,
    "ap": 2,
    "hp": 3,
    "traits": [
      "League Militaire",
      "Shrike Team"
    ],
    "link": {
      "kind": "trait",
      "values": [
        "Shrike Team"
      ]
    },
    "triggerKeywords": [
      "Deploy"
    ]
  },
  "GD04-016": {
    "code": "GD04-016",
    // W3 (GD04)
    attackTargetRules: { cannotTargetPlayer: true },
    structuredSourceText: { attackTargetRules: "This Unit can't choose the enemy player as its attack target." },
    "nameEn": "Zoloat (League Militaire)",
    "cardType": "UNIT",
    "color": "blue",
    "level": 2,
    "cost": 2,
    "ap": 3,
    "hp": 2,
    "traits": [
      "League Militaire"
    ],
    "effectKeywords": [
      "Blocker"
    ]
  },
};
