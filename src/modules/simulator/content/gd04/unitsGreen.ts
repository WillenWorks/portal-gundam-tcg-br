import type { CardDef } from "../../engine/types";

// Gerado por scripts/gundam-gen-carddefs.mjs --set=GD04 (texto oficial + stats do apitcg); autoria de efeito à mão por cima.
export const UNITS_GREEN: Record<string, CardDef> = {
  "GD04-017": {
    "code": "GD04-017",
    "nameEn": "Zeong",
    "cardType": "UNIT",
    "color": "green",
    "level": 6,
    "cost": 5,
    "ap": 4,
    "hp": 3,
    "traits": [
      "Zeon"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Char Aznable"
      ]
    },
    "triggerKeywords": [
      "When Paired",
      "Destroyed"
    ]
  },
  "GD04-018": {
    "code": "GD04-018",
    "nameEn": "Gundam Pharact",
    "cardType": "UNIT",
    "color": "green",
    "level": 6,
    "cost": 4,
    "ap": 5,
    "hp": 4,
    "traits": [
      "Academy"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Elan Ceres"
      ]
    },
    "effectKeywords": [
      "Breach"
    ],
    "keywordTags": [
      "Breach 5"
    ]
  },
  "GD04-019": {
    "code": "GD04-019",
    "nameEn": "GN Armor Type-D (Trans-Am)",
    "cardType": "UNIT",
    "color": "green",
    "level": 6,
    "cost": 5,
    "ap": 4,
    "hp": 5,
    "traits": [
      "CB",
      "GN Drive"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Lockon Stratos"
      ]
    },
    "effectKeywords": [
      "Breach"
    ],
    "keywordTags": [
      "Breach 3"
    ],
    "triggerKeywords": [
      "Destroyed"
    ]
  },
  "GD04-020": {
    "code": "GD04-020",
    "nameEn": "Gundam Lfrith Ur",
    "cardType": "UNIT",
    "color": "green",
    "level": 4,
    "cost": 3,
    "ap": 4,
    "hp": 3,
    "traits": [
      "Dawn of Fold",
      "Academy"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Sophie Pulone"
      ]
    }
  },
  "GD04-021": {
    "code": "GD04-021",
    "nameEn": "Gundam Lfrith Thorn",
    "cardType": "UNIT",
    "color": "green",
    "level": 5,
    "cost": 3,
    "ap": 4,
    "hp": 4,
    "traits": [
      "Dawn of Fold",
      "Academy"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Norea Du Noc"
      ]
    },
    "effectKeywords": [
      "Breach"
    ],
    "keywordTags": [
      "Breach 3"
    ]
  },
  "GD04-022": {
    "code": "GD04-022",
    // W3 (GD04)
    staticAbilities: [
      {
        sourceText: "All your Unit tokens gain <Breach 1>.",
        condition: "always",
        scope: "allFriendlyUnits",
        targetCondition: { kind: "isToken" },
        keyword: "Breach",
        keywordValue: 1,
      },
    ],
    "nameEn": "Kikeroga (MS Mode) (GQ)",
    "cardType": "UNIT",
    "color": "green",
    "level": 7,
    "cost": 4,
    "ap": 3,
    "hp": 6,
    "traits": [
      "Zeon"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Challia Bull"
      ]
    }
  },
  "GD04-023": {
    "code": "GD04-023",
    "nameEn": "Gundam Kyrios (Tail Booster)",
    "cardType": "UNIT",
    "color": "green",
    "level": 5,
    "cost": 4,
    "ap": 5,
    "hp": 3,
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
    },
    "triggerKeywords": [
      "Deploy"
    ]
  },
  "GD04-024": {
    "code": "GD04-024",
    "nameEn": "Gundam Aerial Rebuild",
    "cardType": "UNIT",
    "color": "green",
    "level": 7,
    "cost": 5,
    "ap": 5,
    "hp": 5,
    "traits": [
      "Academy"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Suletta Mercury"
      ]
    },
    "triggerKeywords": [
      "Deploy"
    ]
  },
  "GD04-025": {
    "code": "GD04-025",
    "nameEn": "Gundvölva",
    "cardType": "UNIT",
    "color": "green",
    "level": 3,
    "cost": 2,
    "ap": 3,
    "hp": 2,
    "traits": [
      "Dawn of Fold",
      "Academy"
    ],
    "triggerKeywords": [
      "Destroyed"
    ]
  },
  "GD04-026": {
    "code": "GD04-026",
    "nameEn": "Garma's Dopp",
    "cardType": "UNIT",
    "color": "green",
    "level": 3,
    "cost": 1,
    "ap": 1,
    "hp": 1,
    "traits": [
      "Zeon"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Garma Zabi"
      ]
    },
    "triggerKeywords": [
      "Deploy"
    ]
  },
  "GD04-027": {
    "code": "GD04-027",
    "nameEn": "Bigro",
    "cardType": "UNIT",
    "color": "green",
    "level": 5,
    "cost": 3,
    "ap": 5,
    "hp": 4,
    "traits": [
      "Zeon"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Tokwan"
      ]
    }
  },
  "GD04-028": {
    "code": "GD04-028",
    "nameEn": "Zakrello",
    "cardType": "UNIT",
    "color": "green",
    "level": 3,
    "cost": 1,
    "ap": 4,
    "hp": 1,
    "traits": [
      "Zeon"
    ],
    "triggerKeywords": [
      "Attack"
    ]
  },
  "GD04-029": {
    "code": "GD04-029",
    "nameEn": "Gundam Dynames (GN Full Shield)",
    "cardType": "UNIT",
    "color": "green",
    "level": 3,
    "cost": 2,
    "ap": 2,
    "hp": 3,
    "traits": [
      "CB",
      "GN Drive"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Lockon Stratos"
      ]
    }
  },
  "GD04-030": {
    "code": "GD04-030",
    "nameEn": "Chuchu's Demi Trainer",
    "cardType": "UNIT",
    "color": "green",
    "level": 3,
    "cost": 2,
    "ap": 3,
    "hp": 2,
    "traits": [
      "Academy"
    ],
    "link": {
      "kind": "trait",
      "values": [
        "Academy"
      ]
    },
    "triggerKeywords": [
      "Attack"
    ]
  },
  "GD04-031": {
    "code": "GD04-031",
    "nameEn": "Heindree",
    "cardType": "UNIT",
    "color": "green",
    "level": 2,
    "cost": 2,
    "ap": 3,
    "hp": 2,
    "traits": [
      "Academy"
    ]
  },
  "GD04-032": {
    "code": "GD04-032",
    "nameEn": "Xavier's Gyan Hakuji-Packs (GQ)",
    "cardType": "UNIT",
    "color": "green",
    "level": 5,
    "cost": 3,
    "ap": 4,
    "hp": 5,
    "traits": [
      "Zeon"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Xavier Olivette"
      ]
    }
  },
};
