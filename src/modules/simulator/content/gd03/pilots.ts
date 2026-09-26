import type { CardDef } from "../../engine/types";

export const PILOTS: Record<string, CardDef> = {
  // W0.3 (revisão semântica): metadado falso (Pilot concede, não tem)
  "GD03-084": {
    "code": "GD03-084",
    "nameEn": "Paptimus Scirocco",
    "cardType": "PILOT",
    "color": "blue",
    "level": 5,
    "cost": 1,
    "ap": 2,
    "hp": 2,
    "traits": [
      "Titans",
      "Jupitris",
      "Newtype"
    ],
    "triggerKeywords": [
      "Burst"
    ],
    "hasBurst": true
  },
  "GD03-085": {
    "code": "GD03-085",
    "nameEn": "Christina Mackenzie",
    "cardType": "PILOT",
    "color": "blue",
    "level": 3,
    "cost": 1,
    "ap": 1,
    "hp": 1,
    "traits": [
      "Earth Federation"
    ],
    "triggerKeywords": [
      "Burst"
    ],
    "hasBurst": true
  },
  "GD03-086": {
    "code": "GD03-086",
    "nameEn": "Yazan Gable",
    "cardType": "PILOT",
    "color": "blue",
    "level": 4,
    "cost": 1,
    "ap": 1,
    "hp": 2,
    "traits": [
      "Titans"
    ],
    "triggerKeywords": [
      "Attack",
      "Burst"
    ],
    "hasBurst": true
  },
  "GD03-087": {
    "code": "GD03-087",
    "nameEn": "Sarah Zabiarov",
    "cardType": "PILOT",
    "color": "blue",
    "level": 3,
    "cost": 1,
    "ap": 1,
    "hp": 1,
    "traits": [
      "Titans",
      "Jupitris",
      "Newtype"
    ],
    "triggerKeywords": [
      "Burst"
    ],
    "hasBurst": true
  },
  // W0.3 (revisão semântica): metadado falso
  "GD03-088": {
    "code": "GD03-088",
    "nameEn": "Asemu Asuno",
    "cardType": "PILOT",
    "color": "green",
    "level": 4,
    "cost": 1,
    "ap": 2,
    "hp": 1,
    "traits": [
      "Earth Federation",
      "Asuno Family"
    ],
    "triggerKeywords": [
      "During Link",
      "Burst"
    ],
    "hasBurst": true
  },
  "GD03-089": {
    "code": "GD03-089",
    "nameEn": "Bernard Wiseman",
    "cardType": "PILOT",
    "color": "green",
    "level": 2,
    "cost": 1,
    "ap": 0,
    "hp": 1,
    "traits": [
      "Zeon",
      "Cyclops Team"
    ],
    "triggerKeywords": [
      "Burst"
    ],
    "hasBurst": true
  },
  // W0.3 (revisão semântica): metadado falso
  "GD03-090": {
    "code": "GD03-090",
    "nameEn": "Mikhail Kaminsky",
    "cardType": "PILOT",
    "color": "green",
    "level": 4,
    "cost": 1,
    "ap": 2,
    "hp": 1,
    "traits": [
      "Zeon",
      "Cyclops Team"
    ],
    "triggerKeywords": [
      "Attack",
      "Burst"
    ],
    "hasBurst": true
  },
  "GD03-091": {
    "code": "GD03-091",
    "nameEn": "Rau Le Creuset",
    "cardType": "PILOT",
    "color": "red",
    "level": 4,
    "cost": 1,
    "ap": 2,
    "hp": 1,
    "traits": [
      "ZAFT"
    ],
    "triggerKeywords": [
      "Burst"
    ],
    "hasBurst": true
  },
  "GD03-092": {
    "code": "GD03-092",
    "nameEn": "Nyaan",
    "cardType": "PILOT",
    "color": "red",
    "level": 4,
    "cost": 1,
    "ap": 1,
    "hp": 2,
    "traits": [
      "Zeon",
      "Newtype"
    ],
    "triggerKeywords": [
      "Burst"
    ],
    "hasBurst": true
  },
  "GD03-093": {
    "code": "GD03-093",
    // W1 (GD03)
    staticAbilities: [
      {
        sourceText: "While no enemy Base is in play, this Unit gets AP+1.",
        condition: "duringPair",
        boardCondition: { kind: "noEnemyBase" },
        scope: "pairedUnit",
        stat: "ap",
        amount: 1,
      },
    ],
    "nameEn": "Carris Nautilus",
    "cardType": "PILOT",
    "color": "red",
    "level": 4,
    "cost": 1,
    "ap": 2,
    "hp": 1,
    "traits": [
      "SRA",
      "Newtype"
    ],
    "triggerKeywords": [
      "Burst"
    ],
    "hasBurst": true
  },
  "GD03-094": {
    "code": "GD03-094",
    "nameEn": "Zeheart Galette",
    "cardType": "PILOT",
    "color": "purple",
    "level": 5,
    "cost": 1,
    "ap": 2,
    "hp": 2,
    "traits": [
      "Vagan",
      "X-Rounder"
    ],
    "triggerKeywords": [
      "When Paired",
      "Burst"
    ],
    "hasBurst": true
  },
  "GD03-095": {
    "code": "GD03-095",
    "nameEn": "Azee Gurumin",
    "cardType": "PILOT",
    "color": "purple",
    "level": 4,
    "cost": 1,
    "ap": 1,
    "hp": 2,
    "traits": [
      "Teiwaz"
    ],
    "triggerKeywords": [
      "Burst"
    ],
    "hasBurst": true,
    "oncePerTurn": true
  },
  "GD03-096": {
    "code": "GD03-096",
    "nameEn": "Jamil Neate",
    "cardType": "PILOT",
    "color": "purple",
    "level": 4,
    "cost": 1,
    "ap": 2,
    "hp": 1,
    "traits": [
      "Vulture",
      "Newtype"
    ],
    "triggerKeywords": [
      "Attack",
      "During Link",
      "Burst"
    ],
    "hasBurst": true
  },
  "GD03-097": {
    "code": "GD03-097",
    "nameEn": "Wistario Afam",
    "cardType": "PILOT",
    "color": "purple",
    "level": 4,
    "cost": 1,
    "ap": 1,
    "hp": 2,
    "traits": [
      "Civilian"
    ],
    "triggerKeywords": [
      "During Link",
      "Burst"
    ],
    "hasBurst": true,
    "oncePerTurn": true
  },
  "GD03-098": {
    "code": "GD03-098",
    "nameEn": "Graham Aker",
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
      "During Link",
      "Burst"
    ],
    "hasBurst": true
  },
  "GD03-099": {
    "code": "GD03-099",
    "nameEn": "Emma Sheen",
    "cardType": "PILOT",
    "color": "white",
    "level": 3,
    "cost": 1,
    "ap": 1,
    "hp": 1,
    "traits": [
      "AEUG"
    ],
    "triggerKeywords": [
      "Destroyed",
      "During Link",
      "Burst"
    ],
    "hasBurst": true
  },
  "GD03-100": {
    "code": "GD03-100",
    "nameEn": "Soma Peries",
    "cardType": "PILOT",
    "color": "white",
    "level": 3,
    "cost": 1,
    "ap": 1,
    "hp": 1,
    "traits": [
      "Superpower Bloc",
      "UN",
      "Super Soldier"
    ],
    "triggerKeywords": [
      "Destroyed",
      "Burst"
    ],
    "hasBurst": true
  },
};
