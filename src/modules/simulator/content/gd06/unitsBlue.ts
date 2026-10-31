import type { CardDef } from "../../engine/types";

// Gerado por scripts/gundam-gen-carddefs.mjs --set=GD06 (texto oficial + stats do apitcg); autoria de efeito à mão por cima.
export const UNITS_BLUE: Record<string, CardDef> = {
  "GD06-001": {
    "code": "GD06-001",
    "nameEn": "Gundam GP01Fb",
    "cardType": "UNIT",
    "color": "blue",
    "level": 5,
    "cost": 4,
    "ap": 3,
    "hp": 5,
    "traits": [
      "Earth Federation",
      "Albion Squad"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Kou Uraki"
      ]
    },
    "staticAbilities": [
      {
        "condition": "duringPair",
        "scope": "self",
        "keyword": "High-Maneuver",
        "sourceText": "【During Pair】This Unit gains<High-Maneuver>."
      }
    ]
  },
  "GD06-002": {
    "code": "GD06-002",
    "nameEn": "Infinite Justice Gundam",
    "cardType": "UNIT",
    "color": "blue",
    "level": 7,
    "cost": 6,
    "ap": 5,
    "hp": 5,
    "traits": [
      "Orb"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Athrun Zala"
      ]
    },
    "triggerKeywords": [
      "Deploy"
    ]
  },
  "GD06-003": {
    "code": "GD06-003",
    "nameEn": "GQuuuuuuX (Omega Psycommu Released)",
    "cardType": "UNIT",
    "color": "blue",
    "level": 6,
    "cost": 4,
    "ap": 2,
    "hp": 5,
    "traits": [
      "Alphacide"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Amate Yuzuriha (Machu)"
      ],
      "orTraits": [
        "Machu"
      ]
    },
    "triggerKeywords": [
      "Attack"
    ],
    "staticAbilities": [
      {
        "condition": "always",
        "scope": "self",
        "stat": "ap",
        "amount": 1,
        "amountFrom": {
          "kind": "controllerHandCount"
        },
        "sourceText": "Increase this Unit's AP by an amount equal to the number of cards in your hand."
      }
    ]
  },
  "GD06-004": {
    "code": "GD06-004",
    "nameEn": "Gundam GP01",
    "cardType": "UNIT",
    "color": "blue",
    "level": 4,
    "cost": 2,
    "ap": 4,
    "hp": 3,
    "traits": [
      "Earth Federation",
      "Albion Squad"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Kou Uraki"
      ]
    },
    "triggerKeywords": [
      "Destroyed"
    ]
  },
  "GD06-005": {
    "code": "GD06-005",
    "nameEn": "Akatsuki (Shiranui)",
    "cardType": "UNIT",
    "color": "blue",
    "level": 6,
    "cost": 5,
    "ap": 5,
    "hp": 4,
    "traits": [
      "Orb"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Mu La Flaga"
      ],
      "orTraits": [
        "Orb"
      ]
    },
    "triggerKeywords": [
      "Attack"
    ]
  },
  "GD06-006": {
    "code": "GD06-006",
    "nameEn": "GQuuuuuuX (Omega Psycommu)",
    "cardType": "UNIT",
    "color": "blue",
    "level": 5,
    "cost": 3,
    "ap": 4,
    "hp": 2,
    "traits": [
      "Alphacide"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Amate Yuzuriha (Machu)",
        "Nyaan"
      ],
      "orTraits": [
        "Machu"
      ]
    },
    "triggerKeywords": [
      "Deploy"
    ]
  },
  "GD06-007": {
    "code": "GD06-007",
    "nameEn": "Kikeroga (MS Mode) (GQ)",
    "cardType": "UNIT",
    "color": "blue",
    "level": 7,
    "cost": 5,
    "ap": 4,
    "hp": 6,
    "traits": [
      "Zeon"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Challia Bull"
      ]
    },
    "effectKeywords": [
      "Repair"
    ],
    "keywordTags": [
      "Repair 2"
    ],
    "triggerKeywords": [
      "Deploy"
    ]
  },
  "GD06-008": {
    "code": "GD06-008",
    "nameEn": "Powered GM",
    "cardType": "UNIT",
    "color": "blue",
    "level": 3,
    "cost": 2,
    "ap": 2,
    "hp": 4,
    "traits": [
      "Earth Federation"
    ],
    "triggerKeywords": [
      "Attack"
    ]
  },
  "GD06-009": {
    "code": "GD06-009",
    "nameEn": "GM Custom",
    "cardType": "UNIT",
    "color": "blue",
    "level": 3,
    "cost": 2,
    "ap": 2,
    "hp": 4,
    "traits": [
      "Earth Federation",
      "Albion Squad"
    ],
    "link": {
      "kind": "trait",
      "values": [
        "Albion Squad"
      ]
    },
    "triggerKeywords": [
      "Deploy"
    ]
  },
  "GD06-010": {
    "code": "GD06-010",
    "nameEn": "GM Cannon Ⅱ",
    "cardType": "UNIT",
    "color": "blue",
    "level": 3,
    "cost": 2,
    "ap": 2,
    "hp": 3,
    "traits": [
      "Earth Federation",
      "Albion Squad"
    ],
    "link": {
      "kind": "trait",
      "values": [
        "Albion Squad"
      ]
    },
    "triggerKeywords": [
      "When Linked"
    ]
  },
  "GD06-011": {
    "code": "GD06-011",
    "nameEn": "Red Gundam",
    "cardType": "UNIT",
    "color": "blue",
    "level": 5,
    "cost": 4,
    "ap": 4,
    "hp": 4,
    "link": {
      "kind": "trait",
      "values": [
        "Newtype"
      ]
    },
    "triggerKeywords": [
      "When Linked"
    ]
  },
  "GD06-012": {
    "code": "GD06-012",
    "nameEn": "Z'Gok",
    "cardType": "UNIT",
    "color": "blue",
    "level": 4,
    "cost": 2,
    "ap": 3,
    "hp": 4,
    "traits": [
      "Zeon",
      "Marine"
    ],
    "link": {
      "kind": "trait",
      "values": [
        "Zeon"
      ]
    }
  },
  "GD06-013": {
    "code": "GD06-013",
    "nameEn": "Zaku Ⅱ F2 (EFSF)",
    "cardType": "UNIT",
    "color": "blue",
    "level": 1,
    "cost": 1,
    "ap": 1,
    "hp": 2,
    "traits": [
      "Earth Federation"
    ]
  },
  "GD06-014": {
    "code": "GD06-014",
    "nameEn": "GM Type C",
    "cardType": "UNIT",
    "color": "blue",
    "level": 2,
    "cost": 1,
    "ap": 2,
    "hp": 1,
    "traits": [
      "Earth Federation"
    ],
    "staticAbilities": [
      {
        "condition": "always",
        "scope": "self",
        "keyword": "Blocker",
        "boardCondition": {
          "kind": "enemyUnitCountAtLeast",
          "n": 3
        },
        "sourceText": "While 3 or more enemy Units are in play, this Unit gains<Blocker>."
      }
    ]
  },
  "GD06-015": {
    "code": "GD06-015",
    "nameEn": "Waldfeld's Gaia Gundam",
    "cardType": "UNIT",
    "color": "blue",
    "level": 5,
    "cost": 3,
    "ap": 3,
    "hp": 5,
    "traits": [
      "Orb"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Andrew Waldfeld"
      ]
    },
    "staticAbilities": [
      {
        "condition": "duringPair",
        "scope": "self",
        "keyword": "Blocker",
        "boardCondition": {
          "kind": "pairedPilotHasTrait",
          "trait": "Orb"
        },
        "sourceText": "【During Pair･(Orb) Pilot】This Unit gains<Blocker>."
      }
    ]
  },
  "GD06-016": {
    "code": "GD06-016",
    "nameEn": "Dom Trooper",
    "cardType": "UNIT",
    "color": "blue",
    "level": 3,
    "cost": 2,
    "ap": 3,
    "hp": 3,
    "traits": [
      "Orb"
    ],
    "link": {
      "kind": "trait",
      "values": [
        "Orb"
      ]
    }
  },
  "GD06-017": {
    "code": "GD06-017",
    "nameEn": "GQuuuuuuX",
    "cardType": "UNIT",
    "color": "blue",
    "level": 3,
    "cost": 2,
    "ap": 2,
    "hp": 4,
    "traits": [
      "Alphacide"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Amate Yuzuriha (Machu)"
      ],
      "orTraits": [
        "Machu"
      ]
    },
    "staticAbilities": [
      {
        "condition": "always",
        "scope": "self",
        "keyword": "Blocker",
        "boardCondition": {
          "kind": "friendlyOtherUnitTraitCountAtLeast",
          "trait": "Alphacide",
          "n": 1
        },
        "sourceText": "While another friendly (Alphacide) Unit is in play, this Unit gains<Blocker>."
      }
    ]
  },
};
