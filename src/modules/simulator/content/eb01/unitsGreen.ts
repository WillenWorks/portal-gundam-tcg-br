import type { CardDef } from "../../engine/types";

// Gerado por scripts/gundam-gen-carddefs.mjs --set=EB01 (texto oficial + stats do apitcg); autoria de efeito à mão por cima.
export const UNITS_GREEN: Record<string, CardDef> = {
  "EB01-021": {
    "code": "EB01-021",
    "nameEn": "Build Strike Gundam (Full Package) (EX)",
    "cardType": "UNIT",
    "color": "green",
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
        "Reiji"
      ]
    },
    "effectKeywords": [
      "Breach"
    ],
    "keywordTags": [
      "Breach 4"
    ],
    "triggerKeywords": [
      "When Paired"
    ]
  },
  "EB01-022": {
    "code": "EB01-022",
    "nameEn": "Gundam Exia (EX)",
    "cardType": "UNIT",
    "color": "green",
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
        "Attack"
      ]
    },
    "effectKeywords": [
      "Breach"
    ],
    "keywordTags": [
      "Breach 5"
    ]
  },
  "EB01-023": {
    "code": "EB01-023",
    "nameEn": "Le Cygne (EX)",
    "cardType": "UNIT",
    "color": "green",
    "level": 4,
    "cost": 3,
    "ap": 3,
    "hp": 3,
    "traits": [
      "G Generation"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Asuna Elmarit"
      ]
    },
    "triggerKeywords": [
      "Attack"
    ]
  },
  "EB01-024": {
    "code": "EB01-024",
    "nameEn": "GQuuuuuuX (Omega Psycommu)",
    "cardType": "UNIT",
    "color": "green",
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
        "Attack"
      ]
    },
    "effectKeywords": [
      "Breach"
    ],
    "keywordTags": [
      "Breach 3"
    ],
    "triggerKeywords": [
      "Attack"
    ]
  },
  "EB01-025": {
    "code": "EB01-025",
    "nameEn": "Tallgeese Ⅱ",
    "cardType": "UNIT",
    "color": "green",
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
        "G Generation"
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
        sourceUnitOnly: true,
        sourceMaxLevel: 5,
        boardCondition: { kind: "opponentHasExResource" },
        sourceText: "【During Pair】While your opponent has an EX Resource, this Unit can't receive battle damage from enemy Units that are Lv.5 or lower.",
      },
    ],
  },
  "EB01-026": {
    "code": "EB01-026",
    "nameEn": "Gundam Astaroth Origin",
    "cardType": "UNIT",
    "color": "green",
    "level": 4,
    "cost": 2,
    "ap": 4,
    "hp": 3,
    "traits": [
      "G Generation"
    ],
    "link": {
      "kind": "trait",
      "values": [
        "Durability"
      ]
    }
  },
  "EB01-027": {
    "code": "EB01-027",
    "nameEn": "Tallgeese",
    "cardType": "UNIT",
    "color": "green",
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
        "G Generation"
      ]
    },
    "triggerKeywords": [
      "Deploy"
    ]
  },
  "EB01-028": {
    "code": "EB01-028",
    "nameEn": "Gundam Plutone",
    "cardType": "UNIT",
    "color": "green",
    "level": 4,
    "cost": 3,
    "ap": 3,
    "hp": 3,
    "traits": [
      "G Generation"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Chall Acustica"
      ]
    }
  },
  "EB01-029": {
    "code": "EB01-029",
    "nameEn": "Gundam Astaroth Rinascimento (EX)",
    "cardType": "UNIT",
    "color": "green",
    "level": 4,
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
      "Deploy"
    ]
  },
  "EB01-030": {
    "code": "EB01-030",
    "nameEn": "Big-Rang",
    "cardType": "UNIT",
    "color": "green",
    "level": 5,
    "cost": 4,
    "ap": 5,
    "hp": 3,
    "traits": [
      "G Generation"
    ],
    "triggerKeywords": [
      "Deploy"
    ]
  },
  "EB01-031": {
    "code": "EB01-031",
    "nameEn": "Oggo",
    "cardType": "UNIT",
    "color": "green",
    "level": 3,
    "cost": 1,
    "ap": 1,
    "hp": 2,
    "traits": [
      "G Generation"
    ],
    attackTargetRules: { mayTargetActiveEnemyUnit: { maxLevel: 3 } },
    structuredSourceText: { attackTargetRules: "This Unit may choose an active enemy Unit that is Lv.3 or lower as its attack target." },
  },
  "EB01-032": {
    "code": "EB01-032",
    "nameEn": "Gundam Ez8 High Mobility Custom",
    "cardType": "UNIT",
    "color": "green",
    "level": 3,
    "cost": 2,
    "ap": 4,
    "hp": 3,
    "traits": [
      "G Generation"
    ]
  },
  "EB01-033": {
    "code": "EB01-033",
    "nameEn": "Taurus (Sanc Kingdom)",
    "cardType": "UNIT",
    "color": "green",
    "level": 3,
    "cost": 2,
    "ap": 2,
    "hp": 3,
    "traits": [
      "G Generation"
    ],
    "triggerKeywords": [
      "Activate·Action"
    ]
  },
  "EB01-034": {
    "code": "EB01-034",
    "nameEn": "Gundam Lfrith Ur",
    "cardType": "UNIT",
    "color": "green",
    "level": 3,
    "cost": 2,
    "ap": 2,
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
      "When Linked"
    ]
  },
  "EB01-035": {
    "code": "EB01-035",
    "nameEn": "Gundam Lfrith Thorn",
    "cardType": "UNIT",
    "color": "green",
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
        "Support"
      ]
    }
  },
  "EB01-036": {
    "code": "EB01-036",
    "nameEn": "Darilbalde",
    "cardType": "UNIT",
    "color": "green",
    "level": 3,
    "cost": 3,
    "ap": 4,
    "hp": 3,
    "traits": [
      "G Generation"
    ],
    staticAbilities: [
      {
        condition: "always",
        scope: "allFriendlyUnits",
        excludeSelf: true,
        duringYourTurnOnly: true,
        stat: "ap",
        amount: 1,
        targetCondition: { kind: "allOf", conditions: [{ kind: "traitIs", trait: "G Generation" }, { kind: "levelIs", n: 3 }] },
        sourceText: "During your turn, all other (G Generation) Units that are Lv.3 get AP+1.",
      },
    ],
  },
  "EB01-037": {
    "code": "EB01-037",
    "nameEn": "Zudah Unit 1",
    "cardType": "UNIT",
    "color": "green",
    "level": 4,
    "cost": 3,
    "ap": 4,
    "hp": 1,
    "traits": [
      "G Generation"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Jean Luc Duvall"
      ]
    },
    innateDamageProtection: { unconditional: true, duringYourTurnOnly: true, boardCondition: { kind: "battlingEnemyHasKeyword", keyword: "Blocker" } },
    structuredSourceText: {
      innateDamageProtection: "During your turn, while this Unit is battling an enemy Unit with <Blocker>, this Unit can't receive battle damage.",
    },
  },
  "EB01-038": {
    "code": "EB01-038",
    "nameEn": "G-Self",
    "cardType": "UNIT",
    "color": "green",
    "level": 4,
    "cost": 3,
    "ap": 3,
    "hp": 2,
    "traits": [
      "G Generation"
    ],
    "triggerKeywords": [
      "Deploy"
    ]
  },
  "EB01-039": {
    "code": "EB01-039",
    "nameEn": "Rising Freedom Gundam",
    "cardType": "UNIT",
    "color": "green",
    "level": 6,
    "cost": 5,
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
    // "play it as if it has 3 Lv. and cost" — impresso Lv.6/custo 5
    dynamicCost: { condition: { kind: "enemyUnitCountAtLeast", n: 3 }, amount: -2 },
    dynamicLevel: { condition: { kind: "enemyUnitCountAtLeast", n: 3 }, amount: -3 },
    structuredSourceText: {
      dynamicCost: "When playing this card from your hand, if 3 or more enemy Units are in play, play it as if it has 3 Lv. and cost.",
    },
  },
  "EB01-040": {
    "code": "EB01-040",
    "nameEn": "Gundam Epyon",
    "cardType": "UNIT",
    "color": "green",
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
        "Attack"
      ]
    },
    "triggerKeywords": [
      "Deploy"
    ]
  },
};
