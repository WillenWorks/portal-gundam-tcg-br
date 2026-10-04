import type { CardDef } from "../../engine/types";

// Gerado por scripts/gundam-gen-carddefs.mjs --set=GD05 (texto oficial + stats do apitcg); autoria de efeito à mão por cima.
export const UNITS_WHITE: Record<string, CardDef> = {
  "GD05-066": {
    "code": "GD05-066",
    "nameEn": "Shining Gundam",
    "cardType": "UNIT",
    "color": "white",
    "level": 4,
    "cost": 3,
    "ap": 3,
    "hp": 4,
    "traits": [
      "MF",
      "Shuffle Alliance"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Domon Kasshu"
      ]
    },
    "triggerKeywords": [
      "Deploy",
      "Attack"
    ]
  },
  "GD05-067": {
    "code": "GD05-067",
    "nameEn": "Wing Gundam Zero (EW)",
    "cardType": "UNIT",
    "color": "white",
    "level": 6,
    "cost": 5,
    "ap": 5,
    "hp": 4,
    "traits": [
      "G Team"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Heero Yuy"
      ]
    },
    "triggerKeywords": [
      "Attack"
    ]
  },
  "GD05-068": {
    "code": "GD05-068",
    "nameEn": "Shining Gundam (Super Mode)",
    "cardType": "UNIT",
    "color": "white",
    "level": 6,
    "cost": 5,
    "ap": 4,
    "hp": 5,
    "traits": [
      "MF",
      "Shuffle Alliance"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Domon Kasshu"
      ]
    },
    "triggerKeywords": [
      "Attack"
    ],
    // W7 — "When you activate a (Special Move) Command's 【Main】/【Action】, this Unit gains <Suppression> during this turn"
    "staticAbilities": [
      {
        "condition": "always",
        "scope": "self",
        "keyword": "Suppression",
        "boardCondition": { "kind": "activatedCommandWithTraitThisTurn", "trait": "Special Move" },
        "sourceText": "When you activate a (Special Move) Command's 【Main】/【Action】, this Unit gains <Suppression> during this turn."
      }
    ]
  },
  "GD05-069": {
    "code": "GD05-069",
    "nameEn": "Gundam Maxter",
    "cardType": "UNIT",
    "color": "white",
    "level": 3,
    "cost": 2,
    "ap": 3,
    "hp": 2,
    "traits": [
      "MF",
      "Shuffle Alliance"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Chibodee Crocket"
      ]
    },
    "triggerKeywords": [
      "Attack"
    ]
  },
  "GD05-070": {
    "code": "GD05-070",
    "nameEn": "Tallgeese Ⅲ",
    "cardType": "UNIT",
    "color": "white",
    "level": 5,
    "cost": 3,
    "ap": 4,
    "hp": 4,
    "traits": [
      "Preventer"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Zechs Merquise"
      ]
    }
  },
  "GD05-071": {
    "code": "GD05-071",
    "nameEn": "Gundam Sandrock Custom (EW)",
    "cardType": "UNIT",
    "color": "white",
    "level": 4,
    "cost": 3,
    "ap": 3,
    "hp": 4,
    "traits": [
      "G Team"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Quatre Raberba Winner"
      ]
    },
    "triggerKeywords": [
      "Attack"
    ]
  },
  "GD05-072": {
    "code": "GD05-072",
    "nameEn": "Rising Gundam",
    "cardType": "UNIT",
    "color": "white",
    "level": 4,
    "cost": 3,
    "ap": 4,
    "hp": 3,
    "traits": [
      "MF"
    ],
    "link": {
      "kind": "trait",
      "values": [
        "Gundam Fighter"
      ]
    },
    "triggerKeywords": [
      "When Linked"
    ]
  },
  "GD05-073": {
    "code": "GD05-073",
    "nameEn": "Altron Gundam (EW)",
    "cardType": "UNIT",
    "color": "white",
    "level": 7,
    "cost": 5,
    "ap": 5,
    "hp": 5,
    "traits": [
      "G Team",
      "Mariemaia Army"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Chang Wufei"
      ]
    },
    "triggerKeywords": [
      "Deploy"
    ]
  },
  "GD05-074": {
    "code": "GD05-074",
    "nameEn": "Noin's Taurus",
    "cardType": "UNIT",
    "color": "white",
    "level": 2,
    "cost": 2,
    "ap": 3,
    "hp": 1,
    "traits": [
      "Preventer"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Lucrezia Noin"
      ],
      "orTraits": [
        "Preventer"
      ]
    },
    "triggerKeywords": [
      "Destroyed"
    ]
  },
  "GD05-075": {
    "code": "GD05-075",
    "nameEn": "Royal Gundam",
    "cardType": "UNIT",
    "color": "white",
    "level": 2,
    "cost": 2,
    "ap": 3,
    "hp": 2,
    "traits": [
      "MF"
    ],
    "effectKeywords": [
      "Blocker"
    ],
    // W6
    attackTargetRules: { cannotTargetPlayer: true },
    structuredSourceText: { attackTargetRules: "This Unit can't choose the enemy player as its attack target." },
  },
  "GD05-076": {
    "code": "GD05-076",
    "nameEn": "Bolt Gundam",
    "cardType": "UNIT",
    "color": "white",
    "level": 4,
    "cost": 2,
    "ap": 4,
    "hp": 3,
    "traits": [
      "MF",
      "Shuffle Alliance"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Argo Gulskii"
      ]
    },
    "triggerKeywords": [
      "Attack"
    ]
  },
  "GD05-077": {
    "code": "GD05-077",
    "nameEn": "Leo",
    "cardType": "UNIT",
    "color": "white",
    "level": 2,
    "cost": 1,
    "ap": 2,
    "hp": 2,
    "traits": [
      "G Team"
    ]
  },
  "GD05-078": {
    "code": "GD05-078",
    "nameEn": "Gundam Deathscythe Hell (EW)",
    "cardType": "UNIT",
    "color": "white",
    "level": 5,
    "cost": 4,
    "ap": 5,
    "hp": 2,
    "traits": [
      "G Team"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Duo Maxwell"
      ]
    }
  },
  "GD05-079": {
    "code": "GD05-079",
    "nameEn": "Gundam Heavyarms Custom (EW)",
    "cardType": "UNIT",
    "color": "white",
    "level": 3,
    "cost": 2,
    "ap": 3,
    "hp": 3,
    "traits": [
      "G Team"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Trowa Barton"
      ]
    },
    "triggerKeywords": [
      "Activate·Main"
    ]
  },
  "GD05-080": {
    "code": "GD05-080",
    "nameEn": "Gavane's Borjarnon",
    "cardType": "UNIT",
    "color": "white",
    "level": 3,
    "cost": 1,
    "ap": 1,
    "hp": 3,
    "traits": [
      "Militia"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Gavane Goonny"
      ]
    }
  },
};
