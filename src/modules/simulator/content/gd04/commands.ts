import type { CardDef } from "../../engine/types";

// Gerado por scripts/gundam-gen-carddefs.mjs --set=GD04 (texto oficial + stats do apitcg); autoria de efeito à mão por cima.
export const COMMANDS: Record<string, CardDef> = {
  "GD04-101": {
    "code": "GD04-101",
    "nameEn": "Kindhearted",
    "cardType": "COMMAND",
    "color": "blue",
    "level": 3,
    "cost": 1,
    "triggerKeywords": [
      "Burst",
      "Main",
      "Action"
    ],
    "hasBurst": true
  },
  "GD04-102": {
    "code": "GD04-102",
    "nameEn": "Moment of Rest",
    "cardType": "COMMAND",
    "color": "blue",
    "level": 4,
    "cost": 1,
    "triggerKeywords": [
      "Burst",
      "Main"
    ],
    "hasBurst": true
  },
  "GD04-103": {
    "code": "GD04-103",
    "nameEn": "Spiritual Support",
    "cardType": "COMMAND",
    "color": "blue",
    "level": 4,
    "cost": 1,
    "triggerKeywords": [
      "Main"
    ]
  },
  "GD04-104": {
    "code": "GD04-104",
    "nameEn": "Shrike Team's Bulwark",
    "cardType": "COMMAND",
    "color": "blue",
    "level": 3,
    "cost": 1,
    "traits": [
      "League Militaire",
      "Shrike Team"
    ],
    "pilotMode": {
      "pilotName": "Junko Jenko",
      "ap": 1,
      "hp": 1
    },
    "ap": 1,
    "hp": 1,
    "triggerKeywords": [
      "Main",
      "Action"
    ]
  },
  "GD04-105": {
    "code": "GD04-105",
    "nameEn": "Encounter",
    "cardType": "COMMAND",
    "color": "green",
    "level": 5,
    "cost": 1,
    "triggerKeywords": [
      "Main"
    ]
  },
  "GD04-106": {
    "code": "GD04-106",
    "nameEn": "Indiscriminate Violence",
    "cardType": "COMMAND",
    "color": "green",
    "level": 5,
    "cost": 1,
    "traits": [
      "Academy",
      "Dawn of Fold"
    ],
    "pilotMode": {
      "pilotName": "Norea Du Noc",
      "ap": 2,
      "hp": 0
    },
    "ap": 2,
    "hp": 0,
    "triggerKeywords": [
      "Main"
    ]
  },
  "GD04-107": {
    "code": "GD04-107",
    "nameEn": "Destined Battle",
    "cardType": "COMMAND",
    "color": "green",
    "level": 2,
    "cost": 1,
    "triggerKeywords": [
      "Burst",
      "Action"
    ],
    "hasBurst": true
  },
  "GD04-108": {
    "code": "GD04-108",
    "nameEn": "Witches from Earth",
    "cardType": "COMMAND",
    "color": "green",
    "level": 4,
    "cost": 1,
    "traits": [
      "Academy",
      "Dawn of Fold"
    ],
    "pilotMode": {
      "pilotName": "Sophie Pulone",
      "ap": 1,
      "hp": 1
    },
    "ap": 1,
    "hp": 1,
    "triggerKeywords": [
      "Main",
      "Action"
    ]
  },
  "GD04-109": {
    "code": "GD04-109",
    "nameEn": "Overwhelming Pressure",
    "cardType": "COMMAND",
    "color": "red",
    "level": 5,
    "cost": 3,
    "triggerKeywords": [
      "Main",
      "Action"
    ]
  },
  "GD04-110": {
    "code": "GD04-110",
    "nameEn": "Financier",
    "cardType": "COMMAND",
    "color": "red",
    "level": 6,
    "cost": 3,
    "triggerKeywords": [
      "Main",
      "Action"
    ]
  },
  "GD04-111": {
    "code": "GD04-111",
    "nameEn": "Trinity",
    "cardType": "COMMAND",
    "color": "red",
    "level": 4,
    "cost": 1,
    "traits": [
      "CB",
      "Trinity"
    ],
    "pilotMode": {
      "pilotName": "Johann Trinity",
      "ap": 1,
      "hp": 1
    },
    "ap": 1,
    "hp": 1,
    "triggerKeywords": [
      "Main",
      "Action"
    ]
  },
  "GD04-112": {
    "code": "GD04-112",
    "nameEn": "Inspector",
    "cardType": "COMMAND",
    "color": "red",
    "level": 4,
    "cost": 1,
    "traits": [
      "Earth Federation",
      "Cyber-Newtype"
    ],
    "pilotMode": {
      "pilotName": "Gates Capa",
      "ap": 1,
      "hp": 1
    },
    "ap": 1,
    "hp": 1,
    "triggerKeywords": [
      "Main"
    ]
  },
  "GD04-113": {
    "code": "GD04-113",
    "nameEn": "Damage Control",
    "cardType": "COMMAND",
    "color": "purple",
    "level": 3,
    "cost": 1,
    "triggerKeywords": [
      "Burst",
      "Action"
    ],
    "hasBurst": true
  },
  "GD04-114": {
    "code": "GD04-114",
    "nameEn": "Reformationist",
    "cardType": "COMMAND",
    "color": "purple",
    "level": 2,
    "cost": 1,
    "triggerKeywords": [
      "Burst",
      "Main",
      "Action"
    ],
    "hasBurst": true
  },
  "GD04-115": {
    "code": "GD04-115",
    "nameEn": "Backup",
    "cardType": "COMMAND",
    "color": "purple",
    "level": 3,
    "cost": 1,
    "triggerKeywords": [
      "Burst",
      "Main"
    ],
    "hasBurst": true
  },
  "GD04-116": {
    "code": "GD04-116",
    "nameEn": "Reliable Big Brother",
    "cardType": "COMMAND",
    "color": "purple",
    "level": 4,
    "cost": 1,
    "traits": [
      "ZAFT",
      "Minerva Squad",
      "Coordinator"
    ],
    "pilotMode": {
      "pilotName": "Heine Westenfluss",
      "ap": 0,
      "hp": 2
    },
    "ap": 0,
    "hp": 2,
    "triggerKeywords": [
      "Main"
    ]
  },
  "GD04-117": {
    "code": "GD04-117",
    "nameEn": "Graceful Demeanor",
    "cardType": "COMMAND",
    "color": "white",
    "level": 4,
    "cost": 2,
    "triggerKeywords": [
      "Burst",
      "Action"
    ],
    "hasBurst": true
  },
  "GD04-118": {
    "code": "GD04-118",
    "nameEn": "World Distortion",
    "cardType": "COMMAND",
    "color": "white",
    "level": 3,
    "cost": 1,
    "traits": [
      "UN"
    ],
    "pilotMode": {
      "pilotName": "Alejandro Corner",
      "ap": 1,
      "hp": 0
    },
    "ap": 1,
    "hp": 0,
    "triggerKeywords": [
      "Main",
      "Action"
    ]
  },
  "GD04-119": {
    "code": "GD04-119",
    "nameEn": "Fighting Alone",
    "cardType": "COMMAND",
    "color": "white",
    "level": 4,
    "cost": 1,
    "traits": [
      "Civilian"
    ],
    "pilotMode": {
      "pilotName": "Gael Chan",
      "ap": 1,
      "hp": 1
    },
    "ap": 1,
    "hp": 1,
    "triggerKeywords": [
      "Main",
      "Action"
    ]
  },
  "GD04-120": {
    "code": "GD04-120",
    "nameEn": "Machine Doll Squad",
    "cardType": "COMMAND",
    "color": "white",
    "level": 2,
    "cost": 1,
    "traits": [
      "Militia"
    ],
    "pilotMode": {
      "pilotName": "Miashei Kune",
      "ap": 1,
      "hp": 0
    },
    "ap": 1,
    "hp": 0,
    "triggerKeywords": [
      "Main",
      "Action"
    ]
  },
};
