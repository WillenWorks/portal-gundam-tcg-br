import type { CardDef } from "../../engine/types";

// Gerado por scripts/gundam-gen-carddefs.mjs --set=GD04 (texto oficial + stats do apitcg); autoria de efeito à mão por cima.
export const PILOTS: Record<string, CardDef> = {
  "GD04-081": {
    "code": "GD04-081",
    "nameEn": "Üso Ewin",
    "cardType": "PILOT",
    "color": "blue",
    "level": 4,
    "cost": 1,
    "ap": 2,
    "hp": 1,
    "traits": [
      "League Militaire",
      "Newtype"
    ],
    "triggerKeywords": [
      "Burst",
      "When Paired"
    ],
    "hasBurst": true
  },
  "GD04-082": {
    "code": "GD04-082",
    "nameEn": "Rosamia Badam",
    "cardType": "PILOT",
    "color": "blue",
    "level": 3,
    "cost": 1,
    "ap": 2,
    "hp": 0,
    "traits": [
      "Titans",
      "Cyber-Newtype"
    ],
    "triggerKeywords": [
      "Burst",
      "When Linked"
    ],
    "hasBurst": true
  },
  "GD04-083": {
    "code": "GD04-083",
    // W3 (GD04)
    staticAbilities: [
      {
        sourceText: "All your (League Militaire) Unit tokens get AP+1.",
        condition: "duringPair",
        scope: "allFriendlyUnits",
        targetCondition: { kind: "allOf", conditions: [{ kind: "isToken" }, { kind: "traitIs", trait: "League Militaire" }] },
        stat: "ap",
        amount: 1,
      },
    ],
    "nameEn": "Marbet Fingerhat",
    "cardType": "PILOT",
    "color": "blue",
    "level": 3,
    "cost": 1,
    "ap": 1,
    "hp": 1,
    "traits": [
      "League Militaire"
    ],
    "triggerKeywords": [
      "Burst"
    ],
    "hasBurst": true
  },
  "GD04-084": {
    "code": "GD04-084",
    "nameEn": "Sleggar Law",
    "cardType": "PILOT",
    "color": "blue",
    "level": 3,
    "cost": 1,
    "ap": 1,
    "hp": 1,
    "traits": [
      "Earth Federation",
      "White Base Team"
    ],
    "triggerKeywords": [
      "Burst",
      "Attack"
    ],
    "hasBurst": true
  },
  "GD04-085": {
    "code": "GD04-085",
    "nameEn": "Suletta Mercury",
    "cardType": "PILOT",
    "color": "green",
    "level": 5,
    "cost": 1,
    "ap": 2,
    "hp": 2,
    "traits": [
      "Academy"
    ],
    "triggerKeywords": [
      "Burst"
    ],
    "hasBurst": true
  },
  "GD04-086": {
    "code": "GD04-086",
    "nameEn": "Garma Zabi",
    "cardType": "PILOT",
    "color": "green",
    "level": 3,
    "cost": 1,
    "ap": 1,
    "hp": 0,
    "traits": [
      "Zeon"
    ],
    "triggerKeywords": [
      "Burst",
      "Destroyed"
    ],
    "hasBurst": true
  },
  "GD04-087": {
    "code": "GD04-087",
    "nameEn": "Elan Ceres (Enhanced Person Number 5)",
    "cardType": "PILOT",
    "color": "green",
    "level": 4,
    "cost": 1,
    "ap": 1,
    "hp": 2,
    "traits": [
      "Academy"
    ],
    "triggerKeywords": [
      "Burst",
      "Attack"
    ],
    "hasBurst": true
  },
  "GD04-088": {
    "code": "GD04-088",
    "nameEn": "Tokwan",
    "cardType": "PILOT",
    "color": "green",
    "level": 4,
    "cost": 1,
    "ap": 2,
    "hp": 0,
    "traits": [
      "Zeon"
    ],
    "triggerKeywords": [
      "Burst"
    ],
    "hasBurst": true
  },
  "GD04-089": {
    "code": "GD04-089",
    "nameEn": "Nena Trinity",
    "cardType": "PILOT",
    "color": "red",
    "level": 4,
    "cost": 1,
    "ap": 0,
    "hp": 3,
    "traits": [
      "CB",
      "Trinity"
    ],
    "effectKeywords": [
      "Support"
    ],
    "keywordTags": [
      "Support 2"
    ],
    "triggerKeywords": [
      "Burst",
      "Activate·Main"
    ],
    "hasBurst": true
  },
  "GD04-090": {
    "code": "GD04-090",
    "nameEn": "Hallelujah Haptism",
    "cardType": "PILOT",
    "color": "red",
    "level": 4,
    "cost": 1,
    "ap": 2,
    "hp": 1,
    "traits": [
      "CB",
      "Super Soldier"
    ],
    "triggerKeywords": [
      "Burst"
    ],
    "hasBurst": true
  },
  "GD04-091": {
    "code": "GD04-091",
    "nameEn": "Deux Murasame",
    "cardType": "PILOT",
    "color": "red",
    "level": 4,
    "cost": 1,
    "ap": 2,
    "hp": 1,
    "traits": [
      "Earth Federation",
      "Cyber-Newtype"
    ],
    "triggerKeywords": [
      "Burst",
      "Destroyed"
    ],
    "hasBurst": true
  },
  "GD04-092": {
    "code": "GD04-092",
    "nameEn": "Michael Trinity",
    "cardType": "PILOT",
    "color": "red",
    "level": 4,
    "cost": 1,
    "ap": 2,
    "hp": 1,
    "traits": [
      "CB",
      "Trinity"
    ],
    "triggerKeywords": [
      "Burst",
      "When Linked"
    ],
    "hasBurst": true
  },
  "GD04-093": {
    "code": "GD04-093",
    "nameEn": "Rey Za Burrel",
    "cardType": "PILOT",
    "color": "purple",
    "level": 4,
    "cost": 1,
    "ap": 1,
    "hp": 2,
    "traits": [
      "ZAFT",
      "Minerva Squad"
    ],
    "triggerKeywords": [
      "Burst",
      "When Linked"
    ],
    "hasBurst": true
  },
  "GD04-094": {
    "code": "GD04-094",
    "nameEn": "Pala Sys",
    "cardType": "PILOT",
    "color": "purple",
    "level": 3,
    "cost": 1,
    "ap": 1,
    "hp": 1,
    "traits": [
      "Satyricon",
      "Vulture"
    ],
    "triggerKeywords": [
      "Burst",
      "When Linked"
    ],
    "hasBurst": true
  },
  "GD04-095": {
    "code": "GD04-095",
    "nameEn": "Lunamaria Hawke",
    "cardType": "PILOT",
    "color": "purple",
    "level": 3,
    "cost": 1,
    "ap": 1,
    "hp": 1,
    "traits": [
      "ZAFT",
      "Minerva Squad",
      "Coordinator"
    ],
    "triggerKeywords": [
      "Burst",
      "When Linked"
    ],
    "hasBurst": true
  },
  "GD04-096": {
    "code": "GD04-096",
    "nameEn": "Ennil El",
    "cardType": "PILOT",
    "color": "purple",
    "level": 4,
    "cost": 1,
    "ap": 1,
    "hp": 2,
    "traits": [
      "Vulture"
    ],
    "triggerKeywords": [
      "Burst"
    ],
    "hasBurst": true
  },
  "GD04-097": {
    "code": "GD04-097",
    "nameEn": "Loran Cehack",
    "cardType": "PILOT",
    "color": "white",
    "level": 4,
    "cost": 1,
    "ap": 2,
    "hp": 1,
    "traits": [
      "Militia",
      "Moonrace"
    ],
    "triggerKeywords": [
      "Burst",
      "When Linked"
    ],
    "hasBurst": true
  },
  "GD04-098": {
    "code": "GD04-098",
    "nameEn": "Riddhe Marcenas",
    "cardType": "PILOT",
    "color": "white",
    "level": 4,
    "cost": 1,
    "ap": 1,
    "hp": 2,
    "traits": [
      "Earth Federation",
      "Newtype"
    ],
    "triggerKeywords": [
      "Burst"
    ],
    "hasBurst": true
  },
  "GD04-099": {
    "code": "GD04-099",
    "nameEn": "Ali al-Saachez",
    "cardType": "PILOT",
    "color": "white",
    "level": 4,
    "cost": 1,
    "ap": 2,
    "hp": 1,
    "traits": [
      "Superpower Bloc",
      "UN"
    ],
    "triggerKeywords": [
      "Burst",
      "Attack"
    ],
    "hasBurst": true
  },
  "GD04-100": {
    "code": "GD04-100",
    "nameEn": "Sochie Heim",
    "cardType": "PILOT",
    "color": "white",
    "level": 3,
    "cost": 1,
    "ap": 0,
    "hp": 2,
    "traits": [
      "Militia"
    ],
    "triggerKeywords": [
      "Burst"
    ],
    "hasBurst": true
  },
};
