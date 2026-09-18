import type { CardDef } from "../../engine/types";

export const COMMANDS: Record<string, CardDef> = {
  "GD03-101": {
    "code": "GD03-101",
    "nameEn": "A Healthy Curiosity",
    "cardType": "COMMAND",
    "color": "blue",
    "level": 3,
    "cost": 1,
    "triggerKeywords": [
      "Main"
    ]
  },
  "GD03-102": {
    "code": "GD03-102",
    "nameEn": "Privileged Position",
    "cardType": "COMMAND",
    "color": "blue",
    "level": 6,
    "cost": 2,
    "triggerKeywords": [
      "Action",
      "Burst"
    ],
    "hasBurst": true
  },
  "GD03-103": {
    "code": "GD03-103",
    "nameEn": "Field Directive",
    "cardType": "COMMAND",
    "color": "blue",
    "level": 4,
    "cost": 1,
    "triggerKeywords": [
      "Main",
      "Burst"
    ],
    "hasBurst": true
  },
  "GD03-104": {
    "code": "GD03-104",
    "nameEn": "Reccoa's Shadow",
    "cardType": "COMMAND",
    "color": "blue",
    "level": 3,
    "cost": 1,
    "ap": 1,
    "hp": 0,
    "traits": [
      "Titans",
      "Jupitris"
    ],
    "triggerKeywords": [
      "Main",
      "Action"
    ]
  },
  "GD03-105": {
    "code": "GD03-105",
    "nameEn": "Bridge Crew",
    "cardType": "COMMAND",
    "color": "green",
    "level": 4,
    "cost": 1,
    "triggerKeywords": [
      "Main",
      "Burst"
    ],
    "hasBurst": true
  },
  "GD03-106": {
    "code": "GD03-106",
    "nameEn": "M.A.V. Tactics",
    "cardType": "COMMAND",
    "color": "green",
    "level": 6,
    "cost": 4,
    "triggerKeywords": [
      "Main"
    ]
  },
  "GD03-107": {
    "code": "GD03-107",
    "nameEn": "Over the River and Through the Woods",
    "cardType": "COMMAND",
    "color": "green",
    "level": 4,
    "cost": 1,
    "ap": 1,
    "hp": 1,
    "traits": [
      "Zeon",
      "Cyclops Team"
    ],
    "triggerKeywords": [
      "Main"
    ]
  },
  "GD03-108": {
    "code": "GD03-108",
    "nameEn": "How Many Miles to the Battlefield?",
    "cardType": "COMMAND",
    "color": "green",
    "level": 3,
    "cost": 1,
    "ap": 1,
    "hp": 0,
    "traits": [
      "Zeon",
      "Cyclops Team"
    ],
    "triggerKeywords": [
      "Main"
    ]
  },
  "GD03-109": {
    "code": "GD03-109",
    "nameEn": "Improved Technique",
    "cardType": "COMMAND",
    "color": "red",
    "level": 3,
    "cost": 3,
    "triggerKeywords": [
      "Main",
      "Action",
      "Burst"
    ],
    "hasBurst": true
  },
  "GD03-110": {
    "code": "GD03-110",
    "nameEn": "Eliminate Target",
    "cardType": "COMMAND",
    "color": "red",
    "level": 6,
    "cost": 1,
    "triggerKeywords": [
      "Main",
      "Action"
    ]
  },
  "GD03-111": {
    "code": "GD03-111",
    "nameEn": "Infiltrator Present",
    "cardType": "COMMAND",
    "color": "red",
    "level": 3,
    "cost": 1,
    "ap": 0,
    "hp": 1,
    "traits": [
      "Mafty"
    ],
    "triggerKeywords": [
      "Main",
      "Action"
    ]
  },
  "GD03-112": {
    "code": "GD03-112",
    "nameEn": "Warped Intent",
    "cardType": "COMMAND",
    "color": "red",
    "level": 4,
    "cost": 1,
    "triggerKeywords": [
      "Main",
      "Action",
      "Burst"
    ],
    "hasBurst": true
  },
  "GD03-113": {
    "code": "GD03-113",
    "nameEn": "Human Karma",
    "cardType": "COMMAND",
    "color": "red",
    "level": 3,
    "cost": 2,
    "triggerKeywords": [
      "Main",
      "Action"
    ]
  },
  "GD03-114": {
    "code": "GD03-114",
    "nameEn": "Look of Determination",
    "cardType": "COMMAND",
    "color": "purple",
    "level": 2,
    "cost": 2,
    "triggerKeywords": [
      "Action",
      "Burst"
    ],
    "hasBurst": true
  },
  "GD03-115": {
    "code": "GD03-115",
    "nameEn": "Distant Reunion",
    "cardType": "COMMAND",
    "color": "purple",
    "level": 3,
    "cost": 1,
    "ap": 1,
    "hp": 0,
    "traits": [
      "Civilian",
      "Vagan",
      "X-Rounder"
    ],
    "triggerKeywords": [
      "Action"
    ]
  },
  "GD03-116": {
    "code": "GD03-116",
    "nameEn": "Towards Destiny",
    "cardType": "COMMAND",
    "color": "purple",
    "level": 3,
    "cost": 1,
    "triggerKeywords": [
      "Main",
      "Action"
    ]
  },
  "GD03-117": {
    "code": "GD03-117",
    "nameEn": "Orga's Order",
    "cardType": "COMMAND",
    "color": "purple",
    "level": 3,
    "cost": 1,
    "triggerKeywords": [
      "Main"
    ]
  },
  "GD03-118": {
    "code": "GD03-118",
    "nameEn": "Awakened Potential",
    "cardType": "COMMAND",
    "color": "white",
    "level": 4,
    "cost": 1,
    "effectKeywords": [
      "Blocker"
    ],
    "triggerKeywords": [
      "Action",
      "Burst"
    ],
    "hasBurst": true
  },
  "GD03-119": {
    "code": "GD03-119",
    "nameEn": "Awkward Approach",
    "cardType": "COMMAND",
    "color": "white",
    "level": 3,
    "cost": 1,
    "triggerKeywords": [
      "Main"
    ]
  },
  "GD03-120": {
    "code": "GD03-120",
    "nameEn": "Immortal Colasour",
    "cardType": "COMMAND",
    "color": "white",
    "level": 2,
    "cost": 1,
    "ap": 1,
    "hp": 0,
    "traits": [
      "Superpower Bloc",
      "UN"
    ],
    "triggerKeywords": [
      "Main"
    ]
  },
  "GD03-121": {
    "code": "GD03-121",
    "nameEn": "Unheralded Attack",
    "cardType": "COMMAND",
    "color": "white",
    "level": 1,
    "cost": 1,
    "ap": 1,
    "hp": 0,
    "traits": [
      "AEUG",
      "Newtype"
    ],
    "triggerKeywords": [
      "Action"
    ]
  },
  "GD03-122": {
    "code": "GD03-122",
    "nameEn": "Veteran Tactics",
    "cardType": "COMMAND",
    "color": "white",
    "level": 2,
    "cost": 1,
    "ap": 0,
    "hp": 1,
    "traits": [
      "Superpower Bloc",
      "UN"
    ],
    "triggerKeywords": [
      "Action"
    ]
  },
};
