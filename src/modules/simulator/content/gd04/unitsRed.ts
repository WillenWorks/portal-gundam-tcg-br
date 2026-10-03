import type { CardDef } from "../../engine/types";

// Gerado por scripts/gundam-gen-carddefs.mjs --set=GD04 (texto oficial + stats do apitcg); autoria de efeito à mão por cima.
export const UNITS_RED: Record<string, CardDef> = {
  "GD04-033": {
    "code": "GD04-033",
    // W5 (C12)
    grantsTraitToFriendlyUnits: { trait: "Neo Zeon", duringLink: true, sourceText: "【During Link】All your Units gain (Neo Zeon)." },
    "nameEn": "Neo Zeong",
    "cardType": "UNIT",
    "color": "red",
    "level": 9,
    "cost": 8,
    "ap": 6,
    "hp": 7,
    "traits": [
      "Neo Zeon"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Full Frontal"
      ]
    }
  },
  "GD04-034": {
    "code": "GD04-034",
    // W4 (GD04)
    staticAbilities: [
      {
        sourceText: "【During Link】This Unit gets AP+2 for each of your rested (CB) Units.",
        condition: "duringLink",
        scope: "self",
        stat: "ap",
        amount: 2,
        amountFrom: { kind: "friendlyRestedUnitsWithTrait", trait: "CB" },
      },
    ],
    "nameEn": "Gundam Kyrios",
    "cardType": "UNIT",
    "color": "red",
    "level": 4,
    "cost": 3,
    "ap": 1,
    "hp": 4,
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
    "effectKeywords": [
      "First Strike"
    ]
  },
  "GD04-035": {
    "code": "GD04-035",
    "nameEn": "Ξ Gundam",
    "cardType": "UNIT",
    "color": "red",
    "level": 5,
    "cost": 4,
    "ap": 4,
    "hp": 4,
    "traits": [
      "Mafty"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Hathaway Noa"
      ]
    },
    "triggerKeywords": [
      "Deploy"
    ]
  },
  "GD04-036": {
    "code": "GD04-036",
    "nameEn": "Gundam Throne Eins",
    "cardType": "UNIT",
    "color": "red",
    "level": 6,
    "cost": 4,
    "ap": 5,
    "hp": 2,
    "traits": [
      "CB",
      "Trinity"
    ],
    "link": {
      "kind": "trait",
      "values": [
        "Trinity"
      ]
    },
    "triggerKeywords": [
      "Deploy"
    ]
  },
  "GD04-037": {
    "code": "GD04-037",
    // W4 (GD04)
    staticAbilities: [
      {
        sourceText: "While you have a red (Super Soldier) Pilot in play, this Unit gains <First Strike>.",
        condition: "always",
        scope: "self",
        boardCondition: { kind: "friendlyPilotInPlay", trait: "Super Soldier", color: "red" },
        keyword: "First Strike",
      },
      {
        sourceText: "While you have a green (Super Soldier) Pilot in play, this Unit gains <Breach 3>.",
        condition: "always",
        scope: "self",
        boardCondition: { kind: "friendlyPilotInPlay", trait: "Super Soldier", color: "green" },
        keyword: "Breach",
        keywordValue: 3,
      },
    ],
    "nameEn": "Gundam Kyrios (Trans-Am)",
    "cardType": "UNIT",
    "color": "red",
    "level": 6,
    "cost": 5,
    "ap": 5,
    "hp": 4,
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
    }
  },
  "GD04-038": {
    "code": "GD04-038",
    "nameEn": "Gundam Exia",
    "cardType": "UNIT",
    "color": "red",
    "level": 3,
    "cost": 2,
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
      "Deploy"
    ]
  },
  "GD04-039": {
    "code": "GD04-039",
    // W4 (GD04)
    dynamicCost: { condition: { kind: "trashTraitCountAtLeast", trait: "Neo Zeon", n: 8 }, amount: -4 },
    structuredSourceText: { dynamicCost: "If there are 8 or more (Neo Zeon) cards in your trash, this card in your hand gets cost -4." },
    "nameEn": "Rozen Zulu",
    "cardType": "UNIT",
    "color": "red",
    "level": 4,
    "cost": 6,
    "ap": 4,
    "hp": 4,
    "traits": [
      "Neo Zeon"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Angelo Sauper"
      ]
    },
    "triggerKeywords": [
      "Deploy"
    ]
  },
  "GD04-040": {
    "code": "GD04-040",
    "nameEn": "Schuzrum-Galluss",
    "cardType": "UNIT",
    "color": "red",
    "level": 4,
    "cost": 2,
    "ap": 4,
    "hp": 3,
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
  "GD04-041": {
    "code": "GD04-041",
    "nameEn": "Gundam Throne Drei",
    "cardType": "UNIT",
    "color": "red",
    "level": 5,
    "cost": 2,
    "ap": 3,
    "hp": 3,
    "traits": [
      "CB",
      "Trinity"
    ],
    "link": {
      "kind": "trait",
      "values": [
        "Trinity"
      ]
    }
  },
  "GD04-042": {
    "code": "GD04-042",
    "nameEn": "Psycho Gundam (GQ)",
    "cardType": "UNIT",
    "color": "red",
    "level": 7,
    "cost": 5,
    "ap": 4,
    "hp": 5,
    "traits": [
      "Earth Federation"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Deux Murasame"
      ]
    }
  },
  "GD04-043": {
    "code": "GD04-043",
    "nameEn": "Zssa (Sleeves)",
    "cardType": "UNIT",
    "color": "red",
    "level": 3,
    "cost": 2,
    "ap": 2,
    "hp": 3,
    "traits": [
      "Neo Zeon"
    ],
    "triggerKeywords": [
      "Deploy"
    ]
  },
  "GD04-044": {
    "code": "GD04-044",
    "nameEn": "Gadeel",
    "cardType": "UNIT",
    "color": "red",
    "level": 3,
    "cost": 2,
    "ap": 3,
    "hp": 3,
    "traits": [
      "New UNE"
    ],
    "triggerKeywords": [
      "Attack"
    ]
  },
  "GD04-045": {
    "code": "GD04-045",
    "nameEn": "Gundam Throne Zwei",
    "cardType": "UNIT",
    "color": "red",
    "level": 4,
    "cost": 3,
    "ap": 3,
    "hp": 4,
    "traits": [
      "CB",
      "Trinity"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Ali al-Saachez"
      ],
      "orTraits": [
        "Trinity"
      ]
    },
    "triggerKeywords": [
      "When Linked"
    ]
  },
  "GD04-046": {
    "code": "GD04-046",
    "nameEn": "Gundam Dynames",
    "cardType": "UNIT",
    "color": "red",
    "level": 5,
    "cost": 4,
    "ap": 4,
    "hp": 4,
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
    "triggerKeywords": [
      "Deploy"
    ]
  },
  "GD04-047": {
    "code": "GD04-047",
    "nameEn": "Gundam Virtue",
    "cardType": "UNIT",
    "color": "red",
    "level": 3,
    "cost": 1,
    "ap": 3,
    "hp": 1,
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
  "GD04-048": {
    "code": "GD04-048",
    "nameEn": "Hambrabi (GQ)",
    "cardType": "UNIT",
    "color": "red",
    "level": 5,
    "cost": 3,
    "ap": 4,
    "hp": 4,
    "traits": [
      "Earth Federation"
    ],
    "link": {
      "kind": "trait",
      "values": [
        "Earth Federation"
      ]
    }
  },
};
