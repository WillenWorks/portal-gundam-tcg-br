import type { CardDef } from "../../engine/types";

// Gerado por scripts/gundam-gen-carddefs.mjs --set=GD05 (texto oficial + stats do apitcg); autoria de efeito à mão por cima.
export const UNITS_PURPLE: Record<string, CardDef> = {
  "GD05-049": {
    "code": "GD05-049",
    "nameEn": "Sazabi",
    "cardType": "UNIT",
    "color": "purple",
    "level": 7,
    "cost": 5,
    "ap": 5,
    "hp": 5,
    "traits": [
      "Neo Zeon"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Char Aznable"
      ]
    },
    "effectKeywords": [
      "Suppression"
    ],
    "triggerKeywords": [
      "Attack"
    ]
  },
  "GD05-050": {
    "code": "GD05-050",
    "nameEn": "Gundam Exia Repair",
    "cardType": "UNIT",
    "color": "purple",
    "level": 2,
    "cost": 1,
    "ap": 2,
    "hp": 1,
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
      "Destroyed"
    ]
  },
  "GD05-051": {
    "code": "GD05-051",
    "nameEn": "Gundam Barbatos Lupus Rex",
    "cardType": "UNIT",
    "color": "purple",
    "level": 7,
    "cost": 6,
    "ap": 4,
    "hp": 6,
    "traits": [
      "Tekkadan",
      "Gundam Frame"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Mikazuki Augus"
      ]
    }
  },
  "GD05-052": {
    "code": "GD05-052",
    "nameEn": "Sazabi",
    "cardType": "UNIT",
    "color": "purple",
    "level": 5,
    "cost": 4,
    "ap": 5,
    "hp": 4,
    "traits": [
      "Neo Zeon"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Char Aznable"
      ]
    },
    "triggerKeywords": [
      "Deploy"
    ]
  },
  "GD05-053": {
    "code": "GD05-053",
    "nameEn": "Quess's Jagd Doga",
    "cardType": "UNIT",
    "color": "purple",
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
        "Quess Paraya"
      ]
    },
    "triggerKeywords": [
      "Destroyed"
    ]
  },
  "GD05-054": {
    "code": "GD05-054",
    "nameEn": "Alpha Azieru",
    "cardType": "UNIT",
    "color": "purple",
    "level": 8,
    "cost": 7,
    "ap": 6,
    "hp": 5,
    "traits": [
      "Neo Zeon"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Quess Paraya"
      ]
    },
    "effectKeywords": [
      "Blocker"
    ]
  },
  "GD05-055": {
    "code": "GD05-055",
    // W6
    damageReductions: [
      { amount: 2, kind: "battle", oncePerTurn: true, sourceText: "【Once per Turn】When this Unit receives enemy battle damage, reduce it by 2." },
    ],
    "nameEn": "Destiny Gundam",
    "cardType": "UNIT",
    "color": "purple",
    "level": 8,
    "cost": 7,
    "ap": 5,
    "hp": 6,
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
      "First Strike"
    ]
  },
  "GD05-056": {
    "code": "GD05-056",
    "nameEn": "Rezin's Geara Doga",
    "cardType": "UNIT",
    "color": "purple",
    "level": 4,
    "cost": 2,
    "ap": 3,
    "hp": 4,
    "traits": [
      "Neo Zeon"
    ],
    "link": {
      "kind": "trait",
      "values": [
        "Neo Zeon"
      ]
    }
  },
  "GD05-057": {
    "code": "GD05-057",
    "nameEn": "Gyunei's Jagd Doga",
    "cardType": "UNIT",
    "color": "purple",
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
        "Gyunei Guss"
      ]
    },
    "triggerKeywords": [
      "Activate·Main"
    ]
  },
  "GD05-058": {
    "code": "GD05-058",
    "nameEn": "Shiden Custom (Ryusei-Go)",
    "cardType": "UNIT",
    "color": "purple",
    "level": 4,
    "cost": 3,
    "ap": 4,
    "hp": 3,
    "traits": [
      "Tekkadan"
    ],
    "link": {
      "kind": "trait",
      "values": [
        "Tekkadan"
      ]
    },
    "effectKeywords": [
      "Blocker"
    ]
  },
  "GD05-059": {
    "code": "GD05-059",
    "nameEn": "Gundam Barbatos Lupus",
    "cardType": "UNIT",
    "color": "purple",
    "level": 6,
    "cost": 4,
    "ap": 5,
    "hp": 4,
    "traits": [
      "Tekkadan",
      "Gundam Frame"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Mikazuki Augus"
      ]
    },
    "triggerKeywords": [
      "Attack"
    ]
  },
  "GD05-060": {
    "code": "GD05-060",
    "nameEn": "Gundam Flauros (Ryusei-Go)",
    "cardType": "UNIT",
    "color": "purple",
    "level": 5,
    "cost": 4,
    "ap": 5,
    "hp": 3,
    "traits": [
      "Tekkadan",
      "Gundam Frame"
    ],
    "link": {
      "kind": "trait",
      "values": [
        "Tekkadan"
      ]
    },
    "triggerKeywords": [
      "Deploy",
      "Attack"
    ]
  },
  "GD05-061": {
    "code": "GD05-061",
    "nameEn": "Geara Doga",
    "cardType": "UNIT",
    "color": "purple",
    "level": 2,
    "cost": 2,
    "ap": 3,
    "hp": 1,
    "traits": [
      "Neo Zeon"
    ],
    // W6
    staticAbilities: [
      {
        sourceText: "While you have another (Neo Zeon) Unit in play, this Unit gains <Blocker>.",
        condition: "always",
        scope: "self",
        keyword: "Blocker",
        boardCondition: { kind: "friendlyOtherUnitTraitCountAtLeast", trait: "Neo Zeon", n: 1 },
      },
    ],
  },
  "GD05-062": {
    "code": "GD05-062",
    "nameEn": "Hobby Hizack",
    "cardType": "UNIT",
    "color": "purple",
    "level": 2,
    "cost": 1,
    "ap": 2,
    "hp": 2,
    "traits": [
      "Neo Zeon"
    ]
  },
  "GD05-063": {
    "code": "GD05-063",
    "nameEn": "Gyunei's Jagd Doga",
    "cardType": "UNIT",
    "color": "purple",
    "level": 3,
    "cost": 2,
    "ap": 3,
    "hp": 2,
    "traits": [
      "Neo Zeon"
    ],
    "link": {
      "kind": "trait",
      "values": [
        "Neo Zeon"
      ]
    }
  },
  "GD05-064": {
    "code": "GD05-064",
    "nameEn": "Force Impulse Gundam",
    "cardType": "UNIT",
    "color": "purple",
    "level": 4,
    "cost": 3,
    "ap": 3,
    "hp": 4,
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
    "triggerKeywords": [
      "Deploy"
    ]
  },
  "GD05-065": {
    "code": "GD05-065",
    "nameEn": "Landman Rodi",
    "cardType": "UNIT",
    "color": "purple",
    "level": 2,
    "cost": 2,
    "ap": 1,
    "hp": 2,
    "traits": [
      "Tekkadan"
    ],
    "link": {
      "kind": "trait",
      "values": [
        "Tekkadan"
      ]
    },
    // W6
    staticAbilities: [
      {
        sourceText: "【During Link】This Unit gets AP+2 during your turn.",
        condition: "duringLink",
        scope: "self",
        stat: "ap",
        amount: 2,
        duringYourTurnOnly: true,
      },
    ],
  },
};
