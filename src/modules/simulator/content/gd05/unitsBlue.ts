import type { CardDef } from "../../engine/types";

// Gerado por scripts/gundam-gen-carddefs.mjs --set=GD05 (texto oficial + stats do apitcg); autoria de efeito à mão por cima.
export const UNITS_BLUE: Record<string, CardDef> = {
  "GD05-001": {
    "code": "GD05-001",
    "nameEn": "V2 Gundam",
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
      "Repair"
    ],
    "keywordTags": [
      "Repair 2"
    ],
    "triggerKeywords": [
      "Activate·Main"
    ]
  },
  "GD05-002": {
    "code": "GD05-002",
    "nameEn": "Strike Freedom Gundam",
    "cardType": "UNIT",
    "color": "blue",
    "level": 8,
    "cost": 6,
    "ap": 5,
    "hp": 6,
    "traits": [
      "Orb"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Kira Yamato"
      ]
    },
    "triggerKeywords": [
      "Deploy",
      "Attack"
    ]
  },
  "GD05-003": {
    "code": "GD05-003",
    "nameEn": "Waldfeld's Murasame",
    "cardType": "UNIT",
    "color": "blue",
    "level": 3,
    "cost": 2,
    "ap": 2,
    "hp": 4,
    "traits": [
      "Orb"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Andrew Waldfeld"
      ]
    },
    "triggerKeywords": [
      "Destroyed"
    ]
  },
  "GD05-004": {
    "code": "GD05-004",
    "nameEn": "Akatsuki (Oowashi)",
    "cardType": "UNIT",
    "color": "blue",
    "level": 6,
    "cost": 6,
    "ap": 4,
    "hp": 4,
    "traits": [
      "Orb"
    ],
    "link": {
      "kind": "trait",
      "values": [
        "Orb"
      ]
    },
    "triggerKeywords": [
      "When Linked"
    ]
  },
  "GD05-005": {
    "code": "GD05-005",
    "nameEn": "Strike Rouge (Ootori)",
    "cardType": "UNIT",
    "color": "blue",
    "level": 4,
    "cost": 3,
    "ap": 3,
    "hp": 4,
    "traits": [
      "Orb"
    ],
    "link": {
      "kind": "trait",
      "values": [
        "Orb"
      ]
    },
    "effectKeywords": [
      "Blocker"
    ]
  },
  "GD05-006": {
    "code": "GD05-006",
    "nameEn": "Hashmal",
    "cardType": "UNIT",
    "color": "blue",
    "level": 7,
    "cost": 6,
    "ap": 5,
    "hp": 6,
    "traits": [
      "Calamity War"
    ]
  },
  "GD05-007": {
    "code": "GD05-007",
    "nameEn": "Asshimar",
    "cardType": "UNIT",
    "color": "blue",
    "level": 3,
    "cost": 2,
    "ap": 1,
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
  "GD05-008": {
    "code": "GD05-008",
    "nameEn": "Dijeh",
    "cardType": "UNIT",
    "color": "blue",
    "level": 4,
    "cost": 3,
    "ap": 3,
    "hp": 4,
    "traits": [
      "Karaba"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Amuro Ray"
      ]
    }
  },
  "GD05-009": {
    "code": "GD05-009",
    "nameEn": "Gun Blaster",
    "cardType": "UNIT",
    "color": "blue",
    "level": 4,
    "cost": 2,
    "ap": 3,
    "hp": 4,
    "traits": [
      "League Militaire"
    ],
    "link": {
      "kind": "trait",
      "values": [
        "League Militaire"
      ]
    }
  },
  "GD05-010": {
    "code": "GD05-010",
    "nameEn": "Kira's Strike Rouge",
    "cardType": "UNIT",
    "color": "blue",
    "level": 4,
    "cost": 2,
    "ap": 3,
    "hp": 4,
    "traits": [
      "Orb"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Kira Yamato"
      ],
      "orTraits": [
        "Orb"
      ]
    }
  },
  "GD05-011": {
    "code": "GD05-011",
    "nameEn": "Calamity Gundam & Raider Gundam",
    "cardType": "UNIT",
    "color": "blue",
    "level": 5,
    "cost": 4,
    "ap": 4,
    "hp": 4,
    "traits": [
      "Earth Alliance"
    ],
    "link": {
      "kind": "trait",
      "values": [
        "Biological CPU"
      ]
    },
    "triggerKeywords": [
      "Deploy"
    ]
  },
  "GD05-012": {
    "code": "GD05-012",
    "nameEn": "Forbidden Gundam",
    "cardType": "UNIT",
    "color": "blue",
    "level": 4,
    "cost": 3,
    "ap": 3,
    "hp": 4,
    "traits": [
      "Earth Alliance"
    ],
    "link": {
      "kind": "trait",
      "values": [
        "Biological CPU"
      ]
    },
    "triggerKeywords": [
      "When Linked"
    ]
  },
  "GD05-013": {
    "code": "GD05-013",
    "nameEn": "Gun EZ",
    "cardType": "UNIT",
    "color": "blue",
    "level": 2,
    "cost": 2,
    "ap": 2,
    "hp": 1,
    "traits": [
      "League Militaire",
      "Shrike Team"
    ],
    "effectKeywords": [
      "Blocker"
    ]
  },
  "GD05-014": {
    "code": "GD05-014",
    "nameEn": "Javelin",
    "cardType": "UNIT",
    "color": "blue",
    "level": 2,
    "cost": 1,
    "ap": 2,
    "hp": 2,
    "traits": [
      "Earth Federation",
      "League Militaire"
    ]
  },
  "GD05-015": {
    "code": "GD05-015",
    "nameEn": "M1 Astray Shrike",
    "cardType": "UNIT",
    "color": "blue",
    "level": 2,
    "cost": 1,
    "ap": 1,
    "hp": 2,
    "traits": [
      "Orb"
    ],
    "triggerKeywords": [
      "Deploy"
    ]
  },
  "GD05-016": {
    "code": "GD05-016",
    "nameEn": "Murasame",
    "cardType": "UNIT",
    "color": "blue",
    "level": 3,
    "cost": 2,
    "ap": 2,
    "hp": 4,
    "traits": [
      "Orb"
    ]
  },
};
