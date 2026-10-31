import type { CardDef } from "../../engine/types";

// Gerado por scripts/gundam-gen-carddefs.mjs --set=GD06 (texto oficial + stats do apitcg); autoria de efeito à mão por cima.
export const UNITS_GREEN: Record<string, CardDef> = {
  "GD06-018": {
    "code": "GD06-018",
    "nameEn": "Elpeo Ple's Qubeley Mk-Ⅱ",
    "cardType": "UNIT",
    "color": "green",
    "level": 3,
    "cost": 2,
    "ap": 3,
    "hp": 2,
    "traits": [
      "Neo Zeon"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Elpeo Ple"
      ]
    },
    "effectKeywords": [
      "Breach"
    ],
    "keywordTags": [
      "Breach 1"
    ],
    "triggerKeywords": [
      "Activate·Action"
    ]
  },
  "GD06-019": {
    "code": "GD06-019",
    "nameEn": "Turn X",
    "cardType": "UNIT",
    "color": "green",
    "level": 8,
    "cost": 7,
    "ap": 5,
    "hp": 6,
    "traits": [
      "Ghingnham Fleet"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Gym Ghingnham"
      ]
    },
    "triggerKeywords": [
      "Attack"
    ],
    "forcedAttackTarget": {
      "condition": "always",
      "scope": "friendlyUnitTokens"
    },
    "structuredSourceText": {
      "forcedAttackTarget": "Enemy Units choose one of your rested Unit tokens as their attack target if possible when attacking."
    }
  },
  "GD06-020": {
    "code": "GD06-020",
    "nameEn": "Hamma-Hamma",
    "cardType": "UNIT",
    "color": "green",
    "level": 3,
    "cost": 3,
    "ap": 3,
    "hp": 4,
    "traits": [
      "Neo Zeon"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Mashymre Cello"
      ]
    }
  },
  "GD06-021": {
    "code": "GD06-021",
    "nameEn": "Turn X (Top)",
    "cardType": "UNIT",
    "color": "green",
    "level": 4,
    "cost": 3,
    "ap": 2,
    "hp": 2,
    "traits": [
      "Ghingnham Fleet"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Gym Ghingnham"
      ]
    },
    "triggerKeywords": [
      "Deploy"
    ]
  },
  "GD06-022": {
    "code": "GD06-022",
    "nameEn": "Merrybell's Bandit",
    "cardType": "UNIT",
    "color": "green",
    "level": 6,
    "cost": 4,
    "ap": 4,
    "hp": 4,
    "traits": [
      "Ghingnham Fleet"
    ],
    "link": {
      "kind": "trait",
      "values": [
        "Moonrace"
      ]
    },
    "triggerKeywords": [
      "When Linked"
    ]
  },
  "GD06-023": {
    "code": "GD06-023",
    "nameEn": "Galluss J",
    "cardType": "UNIT",
    "color": "green",
    "level": 1,
    "cost": 1,
    "ap": 2,
    "hp": 1,
    "traits": [
      "Neo Zeon"
    ],
    "triggerKeywords": [
      "Deploy"
    ]
  },
  "GD06-024": {
    "code": "GD06-024",
    "nameEn": "R-Jarja",
    "cardType": "UNIT",
    "color": "green",
    "level": 5,
    "cost": 4,
    "ap": 4,
    "hp": 4,
    "traits": [
      "Neo Zeon"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Chara Soon"
      ]
    },
    "triggerKeywords": [
      "Destroyed"
    ]
  },
  "GD06-025": {
    "code": "GD06-025",
    "nameEn": "Re-GZ",
    "cardType": "UNIT",
    "color": "green",
    "level": 4,
    "cost": 2,
    "ap": 3,
    "hp": 4,
    "traits": [
      "Earth Federation",
      "Londo Bell"
    ],
    "link": {
      "kind": "trait",
      "values": [
        "Londo Bell"
      ]
    }
  },
  "GD06-026": {
    "code": "GD06-026",
    "nameEn": "Stero's Mahiroo",
    "cardType": "UNIT",
    "color": "green",
    "level": 4,
    "cost": 3,
    "ap": 3,
    "hp": 4,
    "traits": [
      "Ghingnham Fleet"
    ],
    "link": {
      "kind": "trait",
      "values": [
        "Moonrace"
      ]
    },
    "triggerKeywords": [
      "Attack"
    ]
  },
  "GD06-027": {
    "code": "GD06-027",
    "nameEn": "Mashymre's Zssa",
    "cardType": "UNIT",
    "color": "green",
    "level": 3,
    "cost": 2,
    "ap": 3,
    "hp": 2,
    "traits": [
      "Neo Zeon"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Mashymre Cello"
      ]
    },
    "triggerKeywords": [
      "Deploy"
    ]
  },
  "GD06-028": {
    "code": "GD06-028",
    "nameEn": "Gaza D",
    "cardType": "UNIT",
    "color": "green",
    "level": 2,
    "cost": 1,
    "ap": 2,
    "hp": 2,
    "traits": [
      "Neo Zeon"
    ]
  },
  "GD06-029": {
    "code": "GD06-029",
    "nameEn": "Elpeo Ple's Qubeley Mk-Ⅱ",
    "cardType": "UNIT",
    "color": "green",
    "level": 4,
    "cost": 3,
    "ap": 4,
    "hp": 3,
    "traits": [
      "Neo Zeon"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Elpeo Ple"
      ]
    },
    "effectKeywords": [
      "Breach"
    ],
    "keywordTags": [
      "Breach 3"
    ]
  },
  "GD06-030": {
    "code": "GD06-030",
    "nameEn": "Mahiroo",
    "cardType": "UNIT",
    "color": "green",
    "level": 3,
    "cost": 2,
    "ap": 2,
    "hp": 4,
    "traits": [
      "Ghingnham Fleet"
    ],
    "staticAbilities": [
      {
        "condition": "always",
        "scope": "self",
        "stat": "ap",
        "amount": 2,
        "boardCondition": {
          "kind": "friendlyOtherUnitWithAnyTraitCountAtLeast",
          "traits": [
            "Ghingnham Fleet",
            "Long-Range Weapon"
          ],
          "n": 3
        },
        "sourceText": "While you have 3 or more other (Ghingnham Fleet)/(Long-Range Weapon) Units in play, this Unit gets AP+2."
      }
    ]
  },
  "GD06-031": {
    "code": "GD06-031",
    "nameEn": "Zssan",
    "cardType": "UNIT",
    "color": "green",
    "level": 2,
    "cost": 2,
    "ap": 3,
    "hp": 2,
    "traits": [
      "Ghingnham Fleet"
    ]
  },
  "GD06-032": {
    "code": "GD06-032",
    "nameEn": "Bellona",
    "cardType": "UNIT",
    "color": "green",
    "level": 1,
    "cost": 1,
    "ap": 0,
    "hp": 1,
    "traits": [
      "Ghingnham Fleet"
    ],
    "triggerKeywords": [
      "Destroyed"
    ]
  },
};
