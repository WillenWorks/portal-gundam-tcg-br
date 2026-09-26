import type { CardDef } from "../../engine/types";

export const UNITS_BLUE: Record<string, CardDef> = {
  "GD03-001": {
    "code": "GD03-001",
    "nameEn": "Gundam NT-1",
    "cardType": "UNIT",
    "color": "blue",
    "level": 5,
    "cost": 4,
    "ap": 4,
    "hp": 4,
    "traits": [
      "Earth Federation"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Christina Mackenzie",
        "Amuro Ray"
      ]
    },
    "effectKeywords": [
      "Repair"
    ],
    "keywordTags": [
      "Repair 2"
    ],
    "triggerKeywords": [
      "When Paired"
    ]
  },
  "GD03-002": {
    "code": "GD03-002",
    "nameEn": "The-O",
    "cardType": "UNIT",
    "color": "blue",
    "level": 7,
    "cost": 5,
    "ap": 5,
    "hp": 5,
    "traits": [
      "Titans",
      "Jupitris"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Paptimus Scirocco"
      ]
    },
    "effectKeywords": [
      "Repair"
    ],
    "keywordTags": [
      "Repair 3"
    ],
    "triggerKeywords": [
      "During Pair"
    ]
  },
  "GD03-003": {
    "code": "GD03-003",
    "nameEn": "Messala",
    "cardType": "UNIT",
    "color": "blue",
    "level": 6,
    "cost": 4,
    "ap": 5,
    "hp": 4,
    "traits": [
      "Titans",
      "Jupitris"
    ],
    "link": {
      "kind": "trait",
      "values": [
        "Jupitris"
      ]
    },
    "effectKeywords": [
      "Blocker",
      "Repair"
    ],
    "keywordTags": [
      "Repair 1"
    ]
  },
  "GD03-004": {
    "code": "GD03-004",
    "nameEn": "Hambrabi",
    "cardType": "UNIT",
    "color": "blue",
    "level": 5,
    "cost": 4,
    "ap": 5,
    "hp": 4,
    "traits": [
      "Titans"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Yazan Gable"
      ]
    },
    "triggerKeywords": [
      "Attack"
    ]
  },
  "GD03-005": {
    "code": "GD03-005",
    "nameEn": "Kshatriya Besserung",
    "cardType": "UNIT",
    "color": "blue",
    "level": 6,
    "cost": 5,
    "ap": 4,
    "hp": 4,
    "traits": [
      "Neo Zeon"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Marida Cruz"
      ]
    },
    "effectKeywords": [
      "Repair"
    ],
    "keywordTags": [
      "Repair 1"
    ],
    "triggerKeywords": [
      "Deploy"
    ]
  },
  "GD03-006": {
    "code": "GD03-006",
    "nameEn": "Penelope (Middle Form)",
    "cardType": "UNIT",
    "color": "blue",
    "level": 6,
    "cost": 5,
    "ap": 4,
    "hp": 4,
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
  "GD03-007": {
    "code": "GD03-007",
    "nameEn": "Gundam NT-1 Full Armor",
    "cardType": "UNIT",
    "color": "blue",
    "level": 3,
    "cost": 2,
    "ap": 2,
    "hp": 3,
    "traits": [
      "Earth Federation"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Christina Mackenzie"
      ]
    },
    "triggerKeywords": [
      "Destroyed"
    ]
  },
  // W0.3 (revisão semântica): Repair 2 só pareada (era inato)
  "GD03-008": {
    "code": "GD03-008",
    "nameEn": "Bolinoak Sammahn",
    "cardType": "UNIT",
    "color": "blue",
    "level": 4,
    "cost": 2,
    "ap": 3,
    "hp": 3,
    "traits": [
      "Titans",
      "Jupitris"
    ],
    "link": {
      "kind": "trait",
      "values": [
        "Jupitris"
      ]
    },
    "triggerKeywords": [
      "During Pair"
    ],
    "staticAbilities": [
      {
        "condition": "duringPair",
        "scope": "self",
        "keyword": "Repair",
        "keywordValue": 2,
        "sourceText": "【During Pair】This Unit gains <Repair 2>."
      }
    ]
  },
  "GD03-009": {
    "code": "GD03-009",
    "nameEn": "Palace Athene",
    "cardType": "UNIT",
    "color": "blue",
    "level": 5,
    "cost": 3,
    "ap": 5,
    "hp": 3,
    "traits": [
      "Titans",
      "Jupitris"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Reccoa Londe"
      ]
    },
    "triggerKeywords": [
      "Deploy"
    ]
  },
  "GD03-010": {
    "code": "GD03-010",
    "nameEn": "Full Armor Unicorn Gundam (Destroy Mode)",
    "cardType": "UNIT",
    "color": "blue",
    "level": 8,
    "cost": 6,
    "ap": 6,
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
      "Repair"
    ],
    "keywordTags": [
      "Repair 3"
    ]
  },
  "GD03-011": {
    "code": "GD03-011",
    "nameEn": "GM Sniper II",
    "cardType": "UNIT",
    "color": "blue",
    "level": 2,
    "cost": 2,
    "ap": 2,
    "hp": 3,
    "traits": [
      "Earth Federation"
    ]
  },
  "GD03-012": {
    "code": "GD03-012",
    "nameEn": "Messala (MA Mode)",
    "cardType": "UNIT",
    "color": "blue",
    "level": 3,
    "cost": 2,
    "ap": 3,
    "hp": 2,
    "traits": [
      "Titans",
      "Jupitris"
    ],
    "link": {
      "kind": "trait",
      "values": [
        "Jupitris"
      ]
    },
    "effectKeywords": [
      "Repair"
    ],
    "keywordTags": [
      "Repair 1"
    ]
  },
  // W0.3 (revisão semântica): AP+1 e Repair 1 só com outra (Jupitris) (era Repair inato, sem AP+1)
  "GD03-013": {
    "code": "GD03-013",
    "nameEn": "Hizack",
    "cardType": "UNIT",
    "color": "blue",
    "level": 2,
    "cost": 2,
    "ap": 2,
    "hp": 2,
    "traits": [
      "Titans",
      "Jupitris"
    ],
    "staticAbilities": [
      {
        "condition": "always",
        "scope": "self",
        "stat": "ap",
        "amount": 1,
        "boardCondition": {
          "kind": "friendlyOtherUnitTraitCountAtLeast",
          "trait": "Jupitris",
          "n": 1
        }
      },
      {
        "condition": "always",
        "scope": "self",
        "keyword": "Repair",
        "keywordValue": 1,
        "boardCondition": {
          "kind": "friendlyOtherUnitTraitCountAtLeast",
          "trait": "Jupitris",
          "n": 1
        },
        "sourceText": "While you have another (Jupitris) Unit in play, this Unit gets AP+1 and <Repair 1>."
      }
    ]
  },
  "GD03-014": {
    "code": "GD03-014",
    "nameEn": "Hizack Custom",
    "cardType": "UNIT",
    "color": "blue",
    "level": 3,
    "cost": 2,
    "ap": 3,
    "hp": 2,
    "traits": [
      "Titans"
    ]
  },
  // W0.3 (revisão semântica): Breach 4 era inato e grátis — é custo de exilar 3 (Titans) do trash (C3, deferido)
  "GD03-015": {
    "code": "GD03-015",
    "nameEn": "Baund Doc",
    "cardType": "UNIT",
    "color": "blue",
    "level": 6,
    "cost": 5,
    "ap": 4,
    "hp": 5,
    "traits": [
      "Titans"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Jerid Messa"
      ]
    },
    "triggerKeywords": [
      "Activate: Main"
    ],
    "oncePerTurn": true
  },
  "GD03-016": {
    "code": "GD03-016",
    "nameEn": "Full Armor Unicorn Gundam (Unicorn Mode)",
    "cardType": "UNIT",
    "color": "blue",
    "level": 5,
    "cost": 3,
    "ap": 5,
    "hp": 4,
    "traits": [
      "Civilian"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Banagher Links"
      ]
    }
  },
};
