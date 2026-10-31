import type { CardDef } from "../../engine/types";

// Gerado por scripts/gundam-gen-carddefs.mjs --set=GD06 (texto oficial + stats do apitcg); autoria de efeito à mão por cima.
export const PILOTS: Record<string, CardDef> = {
  "GD06-080": {
    "code": "GD06-080",
    "nameEn": "Kou Uraki",
    "cardType": "PILOT",
    "color": "blue",
    "level": 4,
    "cost": 1,
    "ap": 2,
    "hp": 1,
    "traits": [
      "Earth Federation",
      "Albion Squad"
    ],
    "triggerKeywords": [
      "Burst",
      "Activate·Action"
    ],
    "hasBurst": true
  },
  "GD06-081": {
    "code": "GD06-081",
    "nameEn": "Amate Yuzuriha (Machu)",
    "cardType": "PILOT",
    "color": "blue",
    "level": 4,
    "cost": 1,
    "ap": 1,
    "hp": 2,
    "traits": [
      "Alphacide",
      "Newtype"
    ],
    "triggerKeywords": [
      "Burst"
    ],
    "hasBurst": true,
    "staticAbilities": [
      {
        "condition": "always",
        "scope": "pairedUnit",
        "keyword": "Repair",
        "keywordValue": 2,
        "targetCondition": {
          "kind": "traitIs",
          "trait": "Alphacide"
        },
        "sourceText": "While this Unit is (Alphacide), it gains<Repair 2>."
      }
    ]
  },
  "GD06-082": {
    "code": "GD06-082",
    "nameEn": "Athrun Zala",
    "cardType": "PILOT",
    "color": "blue",
    "level": 5,
    "cost": 1,
    "ap": 2,
    "hp": 2,
    "traits": [
      "Orb",
      "Coordinator"
    ],
    "triggerKeywords": [
      "Burst",
      "When Paired"
    ],
    "hasBurst": true
  },
  "GD06-083": {
    "code": "GD06-083",
    "nameEn": "Challia Bull (GQ)",
    "cardType": "PILOT",
    "color": "blue",
    "level": 5,
    "cost": 1,
    "ap": 2,
    "hp": 2,
    "traits": [
      "Zeon",
      "Newtype"
    ],
    "triggerKeywords": [
      "Burst"
    ],
    "hasBurst": true,
    "staticAbilities": [
      {
        "condition": "duringLink",
        "scope": "pairedUnit",
        "keyword": "High-Maneuver",
        "targetCondition": {
          "kind": "hasKeyword",
          "keyword": "Repair"
        },
        "sourceText": "【During Link】While this Unit has<Repair>, it gains<High-Maneuver>."
      }
    ]
  },
  "GD06-084": {
    "code": "GD06-084",
    "nameEn": "Elpeo Ple",
    "cardType": "PILOT",
    "color": "green",
    "level": 3,
    "cost": 1,
    "ap": 2,
    "hp": 0,
    "traits": [
      "Neo Zeon",
      "Newtype"
    ],
    "triggerKeywords": [
      "Burst",
      "When Paired"
    ],
    "hasBurst": true
  },
  "GD06-085": {
    "code": "GD06-085",
    "nameEn": "Gym Ghingnham",
    "cardType": "PILOT",
    "color": "green",
    "level": 5,
    "cost": 1,
    "ap": 2,
    "hp": 2,
    "traits": [
      "Ghingnham Fleet",
      "Moonrace"
    ],
    "triggerKeywords": [
      "Burst"
    ],
    "hasBurst": true,
    "staticAbilities": [
      {
        "condition": "duringLink",
        "scope": "allFriendlyUnits",
        "stat": "ap",
        "amount": 1,
        "duringOpponentTurnOnly": true,
        "targetCondition": {
          "kind": "traitIs",
          "trait": "Ghingnham Fleet"
        },
        "sourceText": "【During Link】All your (Ghingnham Fleet) Units get AP+1 during your opponent's turn."
      }
    ]
  },
  "GD06-086": {
    "code": "GD06-086",
    "nameEn": "Mashymre Cello",
    "cardType": "PILOT",
    "color": "green",
    "level": 3,
    "cost": 1,
    "ap": 0,
    "hp": 2,
    "traits": [
      "Neo Zeon"
    ],
    "triggerKeywords": [
      "Burst"
    ],
    "hasBurst": true,
    "pairingCostReduction": {
      "amount": 1,
      "unitLinkPilotName": "Mashymre Cello",
      "sourceText": "When playing this card from your hand and pairing it with a Unit with the [Mashymre Cello] link condition, it gets cost -1."
    }
  },
  "GD06-087": {
    "code": "GD06-087",
    "nameEn": "Merrybell Gadget",
    "cardType": "PILOT",
    "color": "green",
    "level": 4,
    "cost": 1,
    "ap": 2,
    "hp": 1,
    "traits": [
      "Ghingnham Fleet",
      "Moonrace"
    ],
    "triggerKeywords": [
      "Burst",
      "Attack"
    ],
    "hasBurst": true
  },
  "GD06-088": {
    "code": "GD06-088",
    "nameEn": "Judau Ashta",
    "cardType": "PILOT",
    "color": "red",
    "level": 5,
    "cost": 1,
    "ap": 2,
    "hp": 2,
    "traits": [
      "AEUG",
      "Gundam Team",
      "Newtype"
    ],
    "triggerKeywords": [
      "Burst",
      "Destroyed"
    ],
    "hasBurst": true
  },
  "GD06-089": {
    "code": "GD06-089",
    "nameEn": "McGillis Fareed",
    "cardType": "PILOT",
    "color": "red",
    "level": 4,
    "cost": 1,
    "ap": 1,
    "hp": 2,
    "traits": [
      "Gjallarhorn",
      "Alaya-Vijnana"
    ],
    "triggerKeywords": [
      "Burst"
    ],
    "hasBurst": true
  },
  "GD06-090": {
    "code": "GD06-090",
    "nameEn": "Vidar",
    "cardType": "PILOT",
    "color": "red",
    "level": 4,
    "cost": 1,
    "ap": 2,
    "hp": 1,
    "traits": [
      "Gjallarhorn",
      "Alaya-Vijnana"
    ],
    "triggerKeywords": [
      "Burst",
      "Attack"
    ],
    "hasBurst": true,
    "nameAliases": [
      "Gaelio Bauduin"
    ],
    "structuredSourceText": {
      "nameAliases": "This card's name is also treated as [Gaelio Bauduin]."
    }
  },
  "GD06-091": {
    "code": "GD06-091",
    "nameEn": "Roux Louka",
    "cardType": "PILOT",
    "color": "red",
    "level": 4,
    "cost": 1,
    "ap": 2,
    "hp": 1,
    "traits": [
      "AEUG",
      "Gundam Team",
      "Newtype"
    ],
    "triggerKeywords": [
      "Burst"
    ],
    "hasBurst": true,
    "staticAbilities": [
      {
        "condition": "always",
        "scope": "pairedUnit",
        "keyword": "Breach",
        "keywordValue": 1,
        "targetCondition": {
          "kind": "traitIs",
          "trait": "AEUG"
        },
        "sourceText": "While this Unit is (AEUG), it gains<Breach 1>."
      }
    ]
  },
  "GD06-092": {
    "code": "GD06-092",
    "nameEn": "Neo Lorrnoke",
    "cardType": "PILOT",
    "color": "red",
    "level": 4,
    "cost": 1,
    "ap": 1,
    "hp": 2,
    "traits": [
      "Earth Alliance",
      "Phantom Pain",
      "Orb"
    ],
    "triggerKeywords": [
      "Burst",
      "When Paired"
    ],
    "hasBurst": true,
    "nameAliases": [
      "Mu La Flaga"
    ],
    "structuredSourceText": {
      "nameAliases": "This card's name is also treated as [Mu La Flaga]."
    }
  },
  "GD06-093": {
    "code": "GD06-093",
    "nameEn": "Anavel Gato",
    "cardType": "PILOT",
    "color": "purple",
    "level": 4,
    "cost": 1,
    "ap": 2,
    "hp": 1,
    "traits": [
      "Zeon",
      "Delaz Fleet"
    ],
    "triggerKeywords": [
      "Burst",
      "Attack"
    ],
    "hasBurst": true
  },
  "GD06-094": {
    "code": "GD06-094",
    "nameEn": "Nyaan",
    "cardType": "PILOT",
    "color": "purple",
    "level": 4,
    "cost": 1,
    "ap": 2,
    "hp": 1,
    "traits": [
      "Zeon",
      "Alphacide",
      "Newtype"
    ],
    "triggerKeywords": [
      "Burst",
      "When Paired"
    ],
    "hasBurst": true
  },
  "GD06-095": {
    "code": "GD06-095",
    "nameEn": "Kelley Layzner",
    "cardType": "PILOT",
    "color": "purple",
    "level": 3,
    "cost": 1,
    "ap": 1,
    "hp": 1,
    "traits": [
      "Zeon",
      "Civilian"
    ],
    "triggerKeywords": [
      "Burst",
      "Attack"
    ],
    "hasBurst": true
  },
  "GD06-096": {
    "code": "GD06-096",
    "nameEn": "Xavier Olivette",
    "cardType": "PILOT",
    "color": "purple",
    "level": 4,
    "cost": 1,
    "ap": 2,
    "hp": 1,
    "traits": [
      "Zeon",
      "Newtype"
    ],
    "triggerKeywords": [
      "Burst",
      "Attack"
    ],
    "hasBurst": true
  },
  "GD06-097": {
    "code": "GD06-097",
    "nameEn": "Harry Ord",
    "cardType": "PILOT",
    "color": "white",
    "level": 5,
    "cost": 1,
    "ap": 2,
    "hp": 2,
    "traits": [
      "Dianna Counter",
      "Moonrace"
    ],
    "triggerKeywords": [
      "Burst"
    ],
    "hasBurst": true
  },
  "GD06-098": {
    "code": "GD06-098",
    "nameEn": "Duo Maxwell",
    "cardType": "PILOT",
    "color": "white",
    "level": 4,
    "cost": 1,
    "ap": 1,
    "hp": 2,
    "traits": [
      "G Team",
      "Operation Meteor"
    ],
    "triggerKeywords": [
      "Burst"
    ],
    "hasBurst": true,
    "damageReductions": [
      {
        "immune": true,
        "aura": {
          "bases": true
        },
        "holderLinked": true,
        "holderUnitRested": true,
        "sourceUnitOnly": true,
        "sourceLevelAtMostHolderUnit": true,
        "sourceText": "【During Link】While this Unit is rested, friendly Bases can't receive damage from enemy Units whose Lv. are equal to or lower than this Unit."
      }
    ]
  },
  "GD06-099": {
    "code": "GD06-099",
    "nameEn": "Chang Wufei",
    "cardType": "PILOT",
    "color": "white",
    "level": 4,
    "cost": 1,
    "ap": 2,
    "hp": 1,
    "traits": [
      "G Team",
      "Operation Meteor",
      "Mariemaia Army"
    ],
    "triggerKeywords": [
      "Burst",
      "Attack"
    ],
    "hasBurst": true
  },
  "GD06-100": {
    "code": "GD06-100",
    "nameEn": "Corin Nander",
    "cardType": "PILOT",
    "color": "white",
    "level": 4,
    "cost": 1,
    "ap": 3,
    "hp": 0,
    "traits": [
      "Dianna Counter",
      "Moonrace"
    ],
    "triggerKeywords": [
      "Burst"
    ],
    "hasBurst": true,
    "pairingCostReduction": {
      "amount": 1,
      "unitTrait": "Dianna Counter",
      "unitMinLevel": 5,
      "sourceText": "When playing this card from your hand and pairing it with a (Dianna Counter) Unit that is Lv.5 or higher, it gets cost -1."
    }
  },
};
