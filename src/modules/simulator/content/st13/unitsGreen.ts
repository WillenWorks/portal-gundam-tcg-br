import type { CardDef } from "../../engine/types";

// Gerado por scripts/gundam-gen-carddefs.mjs --set=ST13 (texto oficial + stats do apitcg); autoria de efeito à mão por cima.
export const UNITS_GREEN: Record<string, CardDef> = {
  "ST13-001": {
    "code": "ST13-001",
    "nameEn": "Qubeley",
    "cardType": "UNIT",
    "color": "green",
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
        "Haman Karn"
      ]
    },
    "triggerKeywords": [
      "Activate·Main"
    ]
  },
  "ST13-002": {
    "code": "ST13-002",
    "nameEn": "Elmeth",
    "cardType": "UNIT",
    "color": "green",
    "level": 4,
    "cost": 3,
    "ap": 3,
    "hp": 3,
    "traits": [
      "Zeon"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Lalah Sune"
      ]
    },
    "triggerKeywords": [
      "Deploy"
    ]
  },
  "ST13-003": {
    "code": "ST13-003",
    "nameEn": "Bertigo",
    "cardType": "UNIT",
    "color": "green",
    "level": 4,
    "cost": 2,
    "ap": 3,
    "hp": 4,
    "traits": [
      "SRA"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Carris Nautilus"
      ]
    }
  },
  "ST13-004": {
    "code": "ST13-004",
    "nameEn": "GX-Bit",
    "cardType": "UNIT",
    "color": "green",
    "level": 2,
    "cost": 2,
    "ap": 3,
    "hp": 1,
    "traits": [
      "Old UNE",
      "Vulture",
      "Long-Range Weapon"
    ],
    "triggerKeywords": [
      "Deploy"
    ]
  },
  "ST13-005": {
    "code": "ST13-005",
    "nameEn": "GFreD",
    "cardType": "UNIT",
    "color": "green",
    "level": 3,
    "cost": 2,
    "ap": 3,
    "hp": 2,
    "traits": [
      "Zeon"
    ],
    "triggerKeywords": [
      "Deploy"
    ]
  },
};
