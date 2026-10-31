import type { CardDef } from "../../engine/types";

// Gerado por scripts/gundam-gen-carddefs.mjs --set=GD06 (texto oficial + stats do apitcg); autoria de efeito à mão por cima.
export const UNITS_RED: Record<string, CardDef> = {
  "GD06-033": {
    "code": "GD06-033",
    "nameEn": "ZZ Gundam",
    "cardType": "UNIT",
    "color": "red",
    "level": 9,
    "cost": 8,
    "ap": 7,
    "hp": 7,
    "traits": [
      "AEUG",
      "Gundam Team"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Judau Ashta"
      ]
    },
    "triggerKeywords": [
      "Deploy"
    ],
    "damageBoost": {
      "sourceTrait": "AEUG",
      "amount": 1,
      "sourceText": "When your (AEUG) cards deal damage to enemy Units, increase the damage dealt by 1."
    }
  },
  "GD06-034": {
    "code": "GD06-034",
    "nameEn": "Gundam Bael",
    "cardType": "UNIT",
    "color": "red",
    "level": 7,
    "cost": 6,
    "ap": 5,
    "hp": 5,
    "traits": [
      "Gjallarhorn",
      "Gundam Frame"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "McGillis Fareed"
      ]
    },
    "effectKeywords": [
      "High-Maneuver"
    ],
    "triggerKeywords": [
      "Deploy"
    ]
  },
  "GD06-035": {
    "code": "GD06-035",
    "nameEn": "Zeta Gundam",
    "cardType": "UNIT",
    "color": "red",
    "level": 5,
    "cost": 4,
    "ap": 4,
    "hp": 4,
    "traits": [
      "AEUG",
      "Gundam Team"
    ],
    "link": {
      "kind": "trait",
      "values": [
        "AEUG"
      ]
    }
  },
  "GD06-036": {
    "code": "GD06-036",
    "nameEn": "Gundam Vidar",
    "cardType": "UNIT",
    "color": "red",
    "level": 4,
    "cost": 2,
    "ap": 3,
    "hp": 4,
    "traits": [
      "Gjallarhorn",
      "Gundam Frame"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Gaelio Bauduin"
      ]
    },
    "triggerKeywords": [
      "When Linked"
    ]
  },
  "GD06-037": {
    "code": "GD06-037",
    "nameEn": "Reginlaze Julia",
    "cardType": "UNIT",
    "color": "red",
    "level": 6,
    "cost": 4,
    "ap": 4,
    "hp": 4,
    "traits": [
      "Gjallarhorn"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Julieta Juris"
      ]
    },
    "staticAbilities": [
      {
        "condition": "always",
        "scope": "self",
        "keyword": "First Strike",
        "duringYourTurnOnly": true,
        "boardCondition": {
          "kind": "battlingEnemyDamaged"
        },
        "sourceText": "During your turn, while this Unit is battling a damaged enemy Unit, it gains<First Strike>."
      }
    ],
    "preventsEnemySelfSetActive": {
      "condition": "duringPair",
      "sourceText": "【During Pair】Enemy Units can't be set as active by enemy effects."
    }
  },
  "GD06-038": {
    "code": "GD06-038",
    "nameEn": "Gundam Kimaris Vidar",
    "cardType": "UNIT",
    "color": "red",
    "level": 7,
    "cost": 6,
    "ap": 5,
    "hp": 5,
    "traits": [
      "Gjallarhorn",
      "Gundam Frame"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Gaelio Bauduin"
      ]
    },
    "effectKeywords": [
      "Breach"
    ],
    "keywordTags": [
      "Breach 3"
    ],
    "triggerKeywords": [
      "When Paired"
    ]
  },
  "GD06-039": {
    "code": "GD06-039",
    "nameEn": "Neo Core Fighter",
    "cardType": "UNIT",
    "color": "red",
    "level": 2,
    "cost": 2,
    "ap": 1,
    "hp": 2,
    "traits": [
      "AEUG",
      "Gundam Team"
    ],
    "triggerKeywords": [
      "Activate·Main"
    ]
  },
  "GD06-040": {
    "code": "GD06-040",
    "nameEn": "Gundam Mk-Ⅱ",
    "cardType": "UNIT",
    "color": "red",
    "level": 4,
    "cost": 2,
    "ap": 3,
    "hp": 4,
    "traits": [
      "AEUG",
      "Gundam Team"
    ],
    "link": {
      "kind": "trait",
      "values": [
        "AEUG"
      ]
    }
  },
  "GD06-041": {
    "code": "GD06-041",
    "nameEn": "Neo Lorrnoke's Windam (Jet Striker)",
    "cardType": "UNIT",
    "color": "red",
    "level": 4,
    "cost": 3,
    "ap": 3,
    "hp": 4,
    "traits": [
      "Earth Alliance",
      "Phantom Pain"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Neo Lorrnoke"
      ]
    },
    "triggerKeywords": [
      "Deploy"
    ]
  },
  "GD06-042": {
    "code": "GD06-042",
    "nameEn": "Destroy Gundam (MA Mode)",
    "cardType": "UNIT",
    "color": "red",
    "level": 6,
    "cost": 6,
    "ap": 4,
    "hp": 6,
    "traits": [
      "Earth Alliance",
      "Phantom Pain"
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
  "GD06-043": {
    "code": "GD06-043",
    "nameEn": "Julieta's Reginlaze",
    "cardType": "UNIT",
    "color": "red",
    "level": 4,
    "cost": 3,
    "ap": 4,
    "hp": 3,
    "traits": [
      "Gjallarhorn"
    ],
    "link": {
      "kind": "trait",
      "values": [
        "Gjallarhorn"
      ]
    },
    "staticAbilities": [
      {
        "condition": "duringLink",
        "scope": "allUnits",
        "stat": "ap",
        "amount": 1,
        "duringYourTurnOnly": true,
        "excludeSelf": true,
        "targetCondition": {
          "kind": "traitIs",
          "trait": "Gjallarhorn"
        },
        "sourceText": "【During Link】During your turn, all other (Gjallarhorn) Units get AP+1."
      }
    ]
  },
  "GD06-044": {
    "code": "GD06-044",
    "nameEn": "Core Top",
    "cardType": "UNIT",
    "color": "red",
    "level": 3,
    "cost": 2,
    "ap": 3,
    "hp": 3,
    "traits": [
      "AEUG",
      "Gundam Team"
    ],
    "link": {
      "kind": "trait",
      "values": [
        "Gundam Team"
      ]
    }
  },
  "GD06-045": {
    "code": "GD06-045",
    "nameEn": "Core Base",
    "cardType": "UNIT",
    "color": "red",
    "level": 3,
    "cost": 2,
    "ap": 3,
    "hp": 2,
    "traits": [
      "AEUG",
      "Gundam Team"
    ],
    "triggerKeywords": [
      "Destroyed"
    ]
  },
  "GD06-046": {
    "code": "GD06-046",
    "nameEn": "Hyaku-Shiki",
    "cardType": "UNIT",
    "color": "red",
    "level": 4,
    "cost": 3,
    "ap": 4,
    "hp": 3,
    "traits": [
      "AEUG",
      "Gundam Team"
    ],
    "link": {
      "kind": "trait",
      "values": [
        "Gundam Team"
      ]
    },
    "triggerKeywords": [
      "Attack"
    ]
  },
  "GD06-047": {
    "code": "GD06-047",
    "nameEn": "Windam",
    "cardType": "UNIT",
    "color": "red",
    "level": 2,
    "cost": 1,
    "ap": 2,
    "hp": 2,
    "traits": [
      "Earth Alliance",
      "Phantom Pain"
    ]
  },
  "GD06-048": {
    "code": "GD06-048",
    "nameEn": "Helmwige Reincar",
    "cardType": "UNIT",
    "color": "red",
    "level": 3,
    "cost": 2,
    "ap": 2,
    "hp": 3,
    "traits": [
      "Gjallarhorn"
    ],
    "triggerKeywords": [
      "Deploy"
    ]
  },
};
