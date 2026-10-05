import type { CardDef } from "../../engine/types";

// Gerado por scripts/gundam-gen-carddefs.mjs --set=EB01 (texto oficial + stats do apitcg); autoria de efeito à mão por cima.
export const COMMANDS: Record<string, CardDef> = {
  "EB01-073": {
    "code": "EB01-073",
    "nameEn": "Character Requests",
    "cardType": "COMMAND",
    "color": "blue",
    "level": 6,
    "cost": 2,
    "triggerKeywords": [
      "Burst",
      "Main"
    ],
    "hasBurst": true
  },
  "EB01-074": {
    "code": "EB01-074",
    "nameEn": "Eternal Road",
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
  "EB01-075": {
    "code": "EB01-075",
    "nameEn": "Fierce Enemy Assault",
    "cardType": "COMMAND",
    "color": "blue",
    "level": 3,
    "cost": 1,
    "triggerKeywords": [
      "Main",
      "Action"
    ]
  },
  "EB01-076": {
    "code": "EB01-076",
    "nameEn": "Gerbera Straight",
    "cardType": "COMMAND",
    "color": "blue",
    "level": 4,
    "cost": 1,
    "traits": [
      "G Generation",
      "Durability"
    ],
    "pilotMode": {
      "pilotName": "Lowe Guele",
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
  "EB01-077": {
    "code": "EB01-077",
    "nameEn": "Master League Begins",
    "cardType": "COMMAND",
    "color": "green",
    "level": 3,
    "cost": 1,
    "triggerKeywords": [
      "Burst",
      "Action"
    ],
    "hasBurst": true
  },
  "EB01-078": {
    "code": "EB01-078",
    "nameEn": "Premium Unit Assembly",
    "cardType": "COMMAND",
    "color": "green",
    "level": 1,
    "cost": 1,
    "triggerKeywords": [
      "Main"
    ]
  },
  "EB01-079": {
    "code": "EB01-079",
    "nameEn": "Modification",
    "cardType": "COMMAND",
    "color": "green",
    "level": 3,
    "cost": 1,
    "triggerKeywords": [
      "Main"
    ]
  },
  "EB01-080": {
    "code": "EB01-080",
    "nameEn": "Sturm Faust",
    "cardType": "COMMAND",
    "color": "green",
    "level": 4,
    "cost": 1,
    "traits": [
      "G Generation",
      "Support"
    ],
    "pilotMode": {
      "pilotName": "Jean Luc Duvall",
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
  "EB01-081": {
    "code": "EB01-081",
    "nameEn": "MAP Weapon",
    "cardType": "COMMAND",
    "color": "white",
    "level": 4,
    "cost": 2,
    "triggerKeywords": [
      "Burst",
      "Main",
      "Action"
    ],
    "hasBurst": true
  },
  "EB01-082": {
    "code": "EB01-082",
    "nameEn": "Warship Cruise",
    "cardType": "COMMAND",
    "color": "white",
    "level": 3,
    "cost": 1,
    "triggerKeywords": [
      "Burst",
      "Action"
    ],
    "hasBurst": true
  },
  "EB01-083": {
    "code": "EB01-083",
    "nameEn": "SP Conversion Chips",
    "cardType": "COMMAND",
    "color": "white",
    "level": 3,
    "cost": 1,
    "triggerKeywords": [
      "Action"
    ]
  },
  "EB01-084": {
    "code": "EB01-084",
    "nameEn": "30cm Cannon (APFSDS Round)",
    "cardType": "COMMAND",
    "color": "white",
    "level": 4,
    "cost": 1,
    "traits": [
      "G Generation",
      "Attack"
    ],
    "pilotMode": {
      "pilotName": "Demeziere Sonnen",
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
};
