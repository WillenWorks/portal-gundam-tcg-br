import type { CardDef } from "../../engine/types";

// Gerado por scripts/gundam-gen-carddefs.mjs --set=ST12 (texto oficial + stats do apitcg); autoria de efeito à mão por cima.
export const UNITS_RED: Record<string, CardDef> = {
  "ST12-001": {
    "code": "ST12-001",
    "nameEn": "Gundam Epyon",
    "cardType": "UNIT",
    "color": "red",
    "level": 7,
    "cost": 6,
    "ap": 5,
    "hp": 5,
    "traits": [
      "White Fang"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Zechs Merquise"
      ]
    },
    "triggerKeywords": [
      "Deploy"
    ]
  },
  "ST12-002": {
    "code": "ST12-002",
    "nameEn": "Shining Gundam",
    "cardType": "UNIT",
    "color": "red",
    "level": 5,
    "cost": 4,
    "ap": 5,
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
      "Deploy"
    ]
  },
  "ST12-003": {
    "code": "ST12-003",
    "nameEn": "Tallgeese Ⅲ",
    "cardType": "UNIT",
    "color": "red",
    "level": 5,
    "cost": 4,
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
  "ST12-004": {
    "code": "ST12-004",
    "nameEn": "Gundam Exia",
    "cardType": "UNIT",
    "color": "red",
    "level": 4,
    "cost": 3,
    "ap": 3,
    "hp": 4,
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
    "effectKeywords": [
      "Breach"
    ],
    "keywordTags": [
      "Breach 3"
    ]
  },
  "ST12-005": {
    "code": "ST12-005",
    "nameEn": "GQuuuuuuX (Omega Psycommu)",
    "cardType": "UNIT",
    "color": "red",
    "level": 3,
    "cost": 2,
    "ap": 3,
    "hp": 2,
    "traits": [
      "Clan"
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
      "Attack"
    ]
  },
};
