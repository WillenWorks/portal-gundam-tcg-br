import type { CardDef } from "../../engine/types";

// Gerado por scripts/gundam-gen-carddefs.mjs --set=GD04 (texto oficial + stats do apitcg); autoria de efeito à mão por cima.
export const UNITS_PURPLE: Record<string, CardDef> = {
  "GD04-049": {
    "code": "GD04-049",
    "nameEn": "Gundam DX",
    "cardType": "UNIT",
    "color": "purple",
    "level": 8,
    "cost": 7,
    "ap": 6,
    "hp": 6,
    "traits": [
      "Vulture"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Garrod Ran"
      ]
    },
    "effectKeywords": [
      "Suppression"
    ],
    "triggerKeywords": [
      "Attack"
    ]
  },
  "GD04-050": {
    "code": "GD04-050",
    "nameEn": "Destiny Gundam",
    "cardType": "UNIT",
    "color": "purple",
    "level": 7,
    "cost": 5,
    "ap": 5,
    "hp": 5,
    "traits": [
      "ZAFT",
      "Minerva Squad"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Shinn Asuka"
      ]
    },
    "effectKeywords": [
      "High-Maneuver"
    ],
    "triggerKeywords": [
      "Attack"
    ]
  },
  "GD04-051": {
    "code": "GD04-051",
    // W5
    attackTargetRules: { mayTargetActiveEnemyWithKeyword: { pairedPilotTrait: "Vulture", trashAtLeast: 7 } },
    structuredSourceText: {
      attackTargetRules:
        "【During Pair･(Vulture) Pilot】If there are 7 or more cards in your trash, this Unit may choose an active enemy Unit with a keyword effect as its attack target.",
    },
    "nameEn": "Gundam Airmaster Burst",
    "cardType": "UNIT",
    "color": "purple",
    "level": 5,
    "cost": 4,
    "ap": 5,
    "hp": 3,
    "traits": [
      "Vulture"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Witz Sou"
      ]
    }
  },
  "GD04-052": {
    "code": "GD04-052",
    "nameEn": "Gundam Leopard Destroy",
    "cardType": "UNIT",
    "color": "purple",
    "level": 6,
    "cost": 4,
    "ap": 4,
    "hp": 5,
    "traits": [
      "Vulture"
    ],
    "link": {
      "kind": "trait",
      "values": [
        "Vulture"
      ]
    },
    "triggerKeywords": [
      "Attack"
    ]
  },
  "GD04-053": {
    "code": "GD04-053",
    // W5 (C2)
    damageReductions: [
      { amount: 1, duringLink: true, oncePerTurn: true, sourceText: "【During Link】【Once per Turn】When this Unit receives damage from an enemy, reduce it by 1." },
    ],
    "nameEn": "Rey's Blaze Zaku Phantom",
    "cardType": "UNIT",
    "color": "purple",
    "level": 4,
    "cost": 3,
    "ap": 4,
    "hp": 3,
    "traits": [
      "ZAFT",
      "Minerva Squad"
    ],
    "link": {
      "kind": "trait",
      "values": [
        "Minerva Squad"
      ]
    }
  },
  "GD04-054": {
    "code": "GD04-054",
    "nameEn": "Gundam Virtue (Trans-Am)",
    "cardType": "UNIT",
    "color": "purple",
    "level": 7,
    "cost": 5,
    "ap": 2,
    "hp": 6,
    "traits": [
      "CB",
      "GN Drive"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Tieria Erde"
      ]
    }
  },
  "GD04-055": {
    "code": "GD04-055",
    "nameEn": "Heine's Gouf Ignited",
    "cardType": "UNIT",
    "color": "purple",
    "level": 5,
    "cost": 3,
    "ap": 5,
    "hp": 4,
    "traits": [
      "ZAFT",
      "Minerva Squad"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Heine Westenfluss"
      ]
    }
  },
  "GD04-056": {
    "code": "GD04-056",
    "nameEn": "Sword Impulse Gundam",
    "cardType": "UNIT",
    "color": "purple",
    "level": 4,
    "cost": 2,
    "ap": 3,
    "hp": 3,
    "traits": [
      "ZAFT",
      "Minerva Squad"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Shinn Asuka",
        "Lunamaria Hawke"
      ]
    },
    "triggerKeywords": [
      "Deploy"
    ]
  },
  "GD04-057": {
    "code": "GD04-057",
    "nameEn": "Gundam Nadleeh",
    "cardType": "UNIT",
    "color": "purple",
    "level": 4,
    "cost": 3,
    "ap": 4,
    "hp": 3,
    "traits": [
      "CB",
      "GN Drive"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Tieria Erde"
      ]
    },
    "triggerKeywords": [
      "Deploy"
    ]
  },
  "GD04-058": {
    "code": "GD04-058",
    "nameEn": "Jamil's Gundam X",
    "cardType": "UNIT",
    "color": "purple",
    "level": 3,
    "cost": 2,
    "ap": 2,
    "hp": 1,
    "traits": [
      "Old UNE"
    ],
    "triggerKeywords": [
      "Destroyed"
    ]
  },
  "GD04-059": {
    "code": "GD04-059",
    "nameEn": "Daughtress High Mobility Command Wise Wallaby",
    "cardType": "UNIT",
    "color": "purple",
    "level": 2,
    "cost": 2,
    "ap": 2,
    "hp": 2,
    "traits": [
      "Vulture"
    ],
    "link": {
      "kind": "trait",
      "values": [
        "Vulture"
      ]
    }
  },
  "GD04-060": {
    "code": "GD04-060",
    "nameEn": "Esperansa",
    "cardType": "UNIT",
    "color": "purple",
    "level": 3,
    "cost": 2,
    "ap": 1,
    "hp": 4,
    "traits": [
      "Vulture"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Ennil El"
      ]
    },
    "triggerKeywords": [
      "Deploy"
    ]
  },
  "GD04-061": {
    "code": "GD04-061",
    // W4 (GD04)
    attackRestriction: { requiresTrashCountAtLeast: 7 },
    structuredSourceText: { attackRestriction: "This Unit can't attack while there are 6 or less cards in your trash." },
    "nameEn": "G-Falcon",
    "cardType": "UNIT",
    "color": "purple",
    "level": 2,
    "cost": 2,
    "ap": 3,
    "hp": 1,
    "traits": [
      "Vulture"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Pala Sys"
      ]
    },
    "effectKeywords": [
      "Blocker"
    ]
  },
  "GD04-062": {
    "code": "GD04-062",
    "nameEn": "Lunamaria's Gunner Zaku Warrior",
    "cardType": "UNIT",
    "color": "purple",
    "level": 3,
    "cost": 2,
    "ap": 2,
    "hp": 4,
    "traits": [
      "ZAFT",
      "Minerva Squad"
    ],
    "link": {
      "kind": "trait",
      "values": [
        "Minerva Squad"
      ]
    }
  },
  "GD04-063": {
    "code": "GD04-063",
    "nameEn": "GN Armor Type-E",
    "cardType": "UNIT",
    "color": "purple",
    "level": 4,
    "cost": 2,
    "ap": 3,
    "hp": 3,
    "traits": [
      "CB",
      "GN Drive"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Setsuna F. Seiei"
      ]
    },
    "triggerKeywords": [
      "Deploy"
    ]
  },
  "GD04-064": {
    "code": "GD04-064",
    "nameEn": "Gundam Exia",
    "cardType": "UNIT",
    "color": "purple",
    "level": 2,
    "cost": 2,
    "ap": 2,
    "hp": 3,
    "traits": [
      "CB",
      "GN Drive"
    ]
  },
};
