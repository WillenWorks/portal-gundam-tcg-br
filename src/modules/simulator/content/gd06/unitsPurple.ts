import type { CardDef } from "../../engine/types";

// Gerado por scripts/gundam-gen-carddefs.mjs --set=GD06 (texto oficial + stats do apitcg); autoria de efeito à mão por cima.
export const UNITS_PURPLE: Record<string, CardDef> = {
  "GD06-049": {
    "code": "GD06-049",
    "nameEn": "Gundam GP02A",
    "cardType": "UNIT",
    "color": "purple",
    "level": 5,
    "cost": 4,
    "ap": 4,
    "hp": 3,
    "traits": [
      "Zeon",
      "Delaz Fleet"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Anavel Gato"
      ]
    },
    "triggerKeywords": [
      "When Paired",
      "Destroyed"
    ]
  },
  "GD06-050": {
    "code": "GD06-050",
    "nameEn": "Legend Gundam",
    "cardType": "UNIT",
    "color": "purple",
    "level": 6,
    "cost": 5,
    "ap": 4,
    "hp": 5,
    "traits": [
      "ZAFT",
      "Minerva Squad"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Rey Za Burrel"
      ]
    },
    "triggerKeywords": [
      "Deploy"
    ]
  },
  "GD06-051": {
    "code": "GD06-051",
    "nameEn": "GFreD",
    "cardType": "UNIT",
    "color": "purple",
    "level": 6,
    "cost": 5,
    "ap": 5,
    "hp": 4,
    "traits": [
      "Zeon",
      "Alphacide"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Nyaan"
      ]
    },
    "triggerKeywords": [
      "Activate·Main",
      "Deploy"
    ]
  },
  "GD06-052": {
    "code": "GD06-052",
    "nameEn": "Val Walo",
    "cardType": "UNIT",
    "color": "purple",
    "level": 5,
    "cost": 4,
    "ap": 4,
    "hp": 4,
    "traits": [
      "Zeon",
      "Civilian"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Kelley Layzner"
      ]
    },
    "triggerKeywords": [
      "Deploy"
    ],
    "staticAbilities": [
      {
        "condition": "always",
        "scope": "self",
        "keyword": "High-Maneuver",
        "boardCondition": {
          "kind": "trashTraitCountAtLeast",
          "trait": "Zeon",
          "cardType": "UNIT",
          "n": 5
        },
        "sourceText": "While there are 5 or more (Zeon) Unit cards in your trash, this Unit gains<High-Maneuver>."
      }
    ]
  },
  "GD06-053": {
    "code": "GD06-053",
    "nameEn": "Xavier's Gyan Hakuji-Packs (GQ)",
    "cardType": "UNIT",
    "color": "purple",
    "level": 5,
    "cost": 3,
    "ap": 4,
    "hp": 4,
    "traits": [
      "Zeon"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Xavier Olivette"
      ]
    },
    "effectKeywords": [
      "Blocker"
    ],
    "triggerKeywords": [
      "Destroyed"
    ]
  },
  "GD06-054": {
    "code": "GD06-054",
    "nameEn": "GFreD",
    "cardType": "UNIT",
    "color": "purple",
    "level": 7,
    "cost": 6,
    "ap": 6,
    "hp": 5,
    "traits": [
      "Zeon",
      "Alphacide"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Nyaan"
      ]
    },
    "effectKeywords": [
      "Suppression"
    ],
    "triggerKeywords": [
      "Deploy"
    ]
  },
  "GD06-055": {
    "code": "GD06-055",
    "nameEn": "Gundam GP02A",
    "cardType": "UNIT",
    "color": "purple",
    "level": 4,
    "cost": 2,
    "ap": 4,
    "hp": 3,
    "traits": [
      "Zeon",
      "Delaz Fleet"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Anavel Gato"
      ]
    },
    "triggerKeywords": [
      "Attack"
    ]
  },
  "GD06-056": {
    "code": "GD06-056",
    "nameEn": "Xamel",
    "cardType": "UNIT",
    "color": "purple",
    "level": 4,
    "cost": 3,
    "ap": 3,
    "hp": 4,
    "traits": [
      "Zeon",
      "Delaz Fleet"
    ],
    "triggerKeywords": [
      "Attack"
    ]
  },
  "GD06-057": {
    "code": "GD06-057",
    "nameEn": "Karius' Rick Dom Ⅱ",
    "cardType": "UNIT",
    "color": "purple",
    "level": 3,
    "cost": 2,
    "ap": 3,
    "hp": 3,
    "traits": [
      "Zeon",
      "Delaz Fleet"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Karius"
      ]
    },
    "staticAbilities": [
      {
        "condition": "always",
        "scope": "self",
        "keyword": "Blocker",
        "boardCondition": {
          "kind": "friendlyOtherUnitTraitCountAtLeast",
          "trait": "Delaz Fleet",
          "n": 1
        },
        "sourceText": "While you have another (Delaz Fleet) Unit in play, this Unit gains<Blocker>."
      }
    ]
  },
  "GD06-058": {
    "code": "GD06-058",
    "nameEn": "Blast Impulse Gundam",
    "cardType": "UNIT",
    "color": "purple",
    "level": 4,
    "cost": 2,
    "ap": 3,
    "hp": 2,
    "traits": [
      "ZAFT",
      "Minerva Squad"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Lunamaria Hawke"
      ]
    },
    "attackOnDeployTurnVsRestedUnit": {
      "sourceText": "On the turn this Unit is deployed, it may choose a rested enemy Unit as its attack target and attack it."
    }
  },
  "GD06-059": {
    "code": "GD06-059",
    "nameEn": "Dom Tropen",
    "cardType": "UNIT",
    "color": "purple",
    "level": 3,
    "cost": 2,
    "ap": 3,
    "hp": 3,
    "traits": [
      "Zeon",
      "Delaz Fleet"
    ],
    "link": {
      "kind": "trait",
      "values": [
        "Delaz Fleet"
      ]
    }
  },
  "GD06-060": {
    "code": "GD06-060",
    "nameEn": "Zaku Ⅱ F2",
    "cardType": "UNIT",
    "color": "purple",
    "level": 2,
    "cost": 1,
    "ap": 2,
    "hp": 1,
    "traits": [
      "Zeon",
      "Delaz Fleet"
    ],
    "staticAbilities": [
      {
        "condition": "always",
        "scope": "self",
        "stat": "ap",
        "amount": 1,
        "boardCondition": {
          "kind": "trashTraitCountAtLeast",
          "trait": "Zeon",
          "cardType": "UNIT",
          "n": 4
        },
        "sourceText": "While there are 4 or more (Zeon) Unit cards in your trash, this Unit gets AP+1."
      }
    ]
  },
  "GD06-061": {
    "code": "GD06-061",
    "nameEn": "Dra-C",
    "cardType": "UNIT",
    "color": "purple",
    "level": 1,
    "cost": 1,
    "ap": 1,
    "hp": 1,
    "traits": [
      "Zeon",
      "Delaz Fleet"
    ],
    "effectKeywords": [
      "Support"
    ],
    "keywordTags": [
      "Support 1"
    ],
    "triggerKeywords": [
      "Activate·Main"
    ]
  },
  "GD06-062": {
    "code": "GD06-062",
    "nameEn": "Gyan Hakuji-Packs (GQ)",
    "cardType": "UNIT",
    "color": "purple",
    "level": 3,
    "cost": 2,
    "ap": 4,
    "hp": 3,
    "traits": [
      "Zeon"
    ]
  },
  "GD06-063": {
    "code": "GD06-063",
    "nameEn": "GFreD",
    "cardType": "UNIT",
    "color": "purple",
    "level": 2,
    "cost": 1,
    "ap": 2,
    "hp": 2,
    "traits": [
      "Zeon",
      "Alphacide"
    ]
  },
};
