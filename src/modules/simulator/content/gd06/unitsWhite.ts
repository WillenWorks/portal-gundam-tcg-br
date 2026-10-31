import type { CardDef } from "../../engine/types";

// Gerado por scripts/gundam-gen-carddefs.mjs --set=GD06 (texto oficial + stats do apitcg); autoria de efeito à mão por cima.
export const UNITS_WHITE: Record<string, CardDef> = {
  "GD06-064": {
    "code": "GD06-064",
    "nameEn": "Altron Gundam (EW)",
    "cardType": "UNIT",
    "color": "white",
    "level": 3,
    "cost": 3,
    "ap": 3,
    "hp": 4,
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
    "effectKeywords": [
      "Blocker"
    ],
    "staticAbilities": [
      {
        "condition": "always",
        "scope": "self",
        "stat": "ap",
        "amount": 3,
        "boardCondition": {
          "kind": "enemyUnitLevelAtLeast",
          "n": 5
        },
        "sourceText": "While an enemy Unit that is Lv.5 or higher is in play, this Unit gets AP+3."
      }
    ]
  },
  "GD06-065": {
    "code": "GD06-065",
    "nameEn": "SUMO Gold Type",
    "cardType": "UNIT",
    "color": "white",
    "level": 6,
    "cost": 4,
    "ap": 4,
    "hp": 5,
    "traits": [
      "Dianna Counter"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Harry Ord"
      ]
    },
    "effectKeywords": [
      "Blocker"
    ],
    "triggerKeywords": [
      "Activate·Main"
    ]
  },
  "GD06-066": {
    "code": "GD06-066",
    "nameEn": "Shadow Gundam",
    "cardType": "UNIT",
    "color": "white",
    "level": 6,
    "cost": 4,
    "ap": 5,
    "hp": 4,
    "traits": [
      "MF"
    ],
    "link": {
      "kind": "trait",
      "values": [
        "Gundam Fighter"
      ]
    },
    "effectKeywords": [
      "Blocker"
    ],
    "triggerKeywords": [
      "Attack"
    ]
  },
  "GD06-067": {
    "code": "GD06-067",
    "nameEn": "Gundam Sandrock Custom (EW)",
    "cardType": "UNIT",
    "color": "white",
    "level": 5,
    "cost": 4,
    "ap": 3,
    "hp": 5,
    "traits": [
      "G Team"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Quatre Raberba Winner"
      ]
    },
    "effectKeywords": [
      "Blocker"
    ],
    "triggerKeywords": [
      "When Paired"
    ]
  },
  "GD06-068": {
    "code": "GD06-068",
    "nameEn": "Gundam Heavyarms Custom (EW)",
    "cardType": "UNIT",
    "color": "white",
    "level": 4,
    "cost": 3,
    "ap": 4,
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
      "Deploy"
    ]
  },
  "GD06-069": {
    "code": "GD06-069",
    "nameEn": "SUMO Silver Type",
    "cardType": "UNIT",
    "color": "white",
    "level": 4,
    "cost": 3,
    "ap": 4,
    "hp": 3,
    "traits": [
      "Dianna Counter"
    ],
    "link": {
      "kind": "trait",
      "values": [
        "Moonrace"
      ]
    },
    "effectKeywords": [
      "Blocker"
    ],
    "triggerKeywords": [
      "Activate·Action"
    ]
  },
  "GD06-070": {
    "code": "GD06-070",
    "nameEn": "Eagail",
    "cardType": "UNIT",
    "color": "white",
    "level": 6,
    "cost": 5,
    "ap": 5,
    "hp": 3,
    "traits": [
      "Dianna Counter"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Corin Nander"
      ]
    },
    "triggerKeywords": [
      "Deploy",
      "Attack"
    ]
  },
  "GD06-071": {
    "code": "GD06-071",
    "nameEn": "Shining Gundam (Meikyo Shisui)",
    "cardType": "UNIT",
    "color": "white",
    "level": 6,
    "cost": 5,
    "ap": 4,
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
    }
  },
  "GD06-072": {
    "code": "GD06-072",
    "nameEn": "Gundam Deathscythe Hell (EW)",
    "cardType": "UNIT",
    "color": "white",
    "level": 5,
    "cost": 3,
    "ap": 5,
    "hp": 3,
    "traits": [
      "G Team"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Duo Maxwell"
      ]
    },
    "triggerKeywords": [
      "Destroyed"
    ]
  },
  "GD06-073": {
    "code": "GD06-073",
    "nameEn": "Wing Gundam Zero (EW)",
    "cardType": "UNIT",
    "color": "white",
    "level": 4,
    "cost": 2,
    "ap": 4,
    "hp": 3,
    "traits": [
      "G Team"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Heero Yuy"
      ]
    }
  },
  "GD06-074": {
    "code": "GD06-074",
    "nameEn": "Flat",
    "cardType": "UNIT",
    "color": "white",
    "level": 4,
    "cost": 2,
    "ap": 4,
    "hp": 3,
    "traits": [
      "Dianna Counter"
    ],
    "link": {
      "kind": "trait",
      "values": [
        "Moonrace"
      ]
    }
  },
  "GD06-075": {
    "code": "GD06-075",
    "nameEn": "Serpent",
    "cardType": "UNIT",
    "color": "white",
    "level": 3,
    "cost": 2,
    "ap": 4,
    "hp": 3,
    "traits": [
      "Mariemaia Army"
    ]
  },
  "GD06-076": {
    "code": "GD06-076",
    "nameEn": "WaDom",
    "cardType": "UNIT",
    "color": "white",
    "level": 5,
    "cost": 4,
    "ap": 4,
    "hp": 4,
    "traits": [
      "Dianna Counter"
    ],
    "link": {
      "kind": "trait",
      "values": [
        "Moonrace"
      ]
    },
    "triggerKeywords": [
      "Deploy"
    ]
  },
  "GD06-077": {
    "code": "GD06-077",
    "nameEn": "Cannon Illfuto",
    "cardType": "UNIT",
    "color": "white",
    "level": 3,
    "cost": 2,
    "ap": 3,
    "hp": 3,
    "traits": [
      "Dianna Counter"
    ],
    "effectKeywords": [
      "Blocker"
    ]
  },
  "GD06-078": {
    "code": "GD06-078",
    "nameEn": "WaD",
    "cardType": "UNIT",
    "color": "white",
    "level": 1,
    "cost": 1,
    "ap": 1,
    "hp": 1,
    "traits": [
      "Dianna Counter"
    ],
    "triggerKeywords": [
      "Activate·Main"
    ]
  },
  "GD06-079": {
    "code": "GD06-079",
    "nameEn": "Muttowooo",
    "cardType": "UNIT",
    "color": "white",
    "level": 2,
    "cost": 2,
    "ap": 3,
    "hp": 2,
    "traits": [
      "Dianna Counter"
    ]
  },
};
