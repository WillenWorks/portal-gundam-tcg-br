import type { CardDef } from "../../engine/types";

// Gerado por scripts/gundam-gen-carddefs.mjs --set=GD04 (texto oficial + stats do apitcg); autoria de efeito à mão por cima.
export const BASES: Record<string, CardDef> = {
  "GD04-121": {
    "code": "GD04-121",
    "nameEn": "Reineforce Jr.",
    "cardType": "BASE",
    "color": "blue",
    "level": 3,
    "cost": 1,
    "ap": 0,
    "hp": 5,
    "traits": [
      "League Militaire",
      "Warship"
    ],
    "triggerKeywords": [
      "Burst",
      "Deploy"
    ],
    "hasBurst": true
  },
  "GD04-122": {
    "code": "GD04-122",
    "nameEn": "Jaburo",
    "cardType": "BASE",
    "color": "blue",
    "level": 4,
    "cost": 1,
    "ap": 0,
    "hp": 5,
    "traits": [
      "Earth Federation",
      "Stronghold"
    ],
    "triggerKeywords": [
      "Burst",
      "Deploy",
      "Activate·Main"
    ],
    "hasBurst": true
  },
  "GD04-123": {
    "code": "GD04-123",
    // W5 (C2)
    damageReductions: [
      {
        immune: true,
        kind: "battle",
        sourceUnitOnly: true,
        sourceMaxLevel: 4,
        boardCondition: { kind: "friendlyRestedUnitWithTrait", trait: "Zeon" },
        sourceText: "While you have a rested (Zeon) Unit in play, this Base can't receive battle damage from enemy Units that are Lv.4 or lower.",
      },
    ],
    "nameEn": "A Baoa Qu",
    "cardType": "BASE",
    "color": "green",
    "level": 5,
    "cost": 1,
    "ap": 0,
    "hp": 5,
    "traits": [
      "Zeon",
      "Stronghold"
    ],
    "triggerKeywords": [
      "Burst",
      "Deploy"
    ],
    "hasBurst": true
  },
  "GD04-124": {
    "code": "GD04-124",
    "nameEn": "9th Tactical Testing Sector",
    "cardType": "BASE",
    "color": "green",
    "level": 3,
    "cost": 1,
    "ap": 0,
    "hp": 5,
    "traits": [
      "Academy",
      "Stronghold"
    ],
    "triggerKeywords": [
      "Burst",
      "Deploy"
    ],
    "hasBurst": true
  },
  "GD04-125": {
    "code": "GD04-125",
    "nameEn": "Trinity Warship",
    "cardType": "BASE",
    "color": "red",
    "level": 4,
    "cost": 1,
    "ap": 0,
    "hp": 5,
    "traits": [
      "CB",
      "Warship"
    ],
    "triggerKeywords": [
      "Burst",
      "Deploy",
      "Activate·Main"
    ],
    "hasBurst": true
  },
  "GD04-126": {
    "code": "GD04-126",
    "nameEn": "Izuma Colony",
    "cardType": "BASE",
    "color": "red",
    "level": 1,
    "cost": 1,
    "ap": 0,
    "hp": 4,
    "traits": [
      "Clan",
      "Stronghold"
    ],
    "triggerKeywords": [
      "Burst",
      "Deploy"
    ],
    "hasBurst": true
  },
  "GD04-127": {
    "code": "GD04-127",
    "nameEn": "Freeden Ⅱ",
    "cardType": "BASE",
    "color": "purple",
    "level": 4,
    "cost": 1,
    "ap": 0,
    "hp": 5,
    "traits": [
      "Vulture",
      "Warship"
    ],
    "triggerKeywords": [
      "Burst",
      "Deploy"
    ],
    "hasBurst": true
  },
  "GD04-128": {
    "code": "GD04-128",
    "nameEn": "Armory One",
    "cardType": "BASE",
    "color": "purple",
    "level": 4,
    "cost": 1,
    "ap": 0,
    "hp": 6,
    "traits": [
      "ZAFT",
      "Stronghold"
    ],
    "triggerKeywords": [
      "Burst",
      "Deploy",
      "Destroyed"
    ],
    "hasBurst": true
  },
  "GD04-129": {
    "code": "GD04-129",
    "nameEn": "Willgem",
    "cardType": "BASE",
    "color": "white",
    "level": 3,
    "cost": 1,
    "ap": 0,
    "hp": 7,
    "traits": [
      "Militia",
      "Warship"
    ],
    "triggerKeywords": [
      "Burst",
      "Deploy"
    ],
    "hasBurst": true
  },
  "GD04-130": {
    "code": "GD04-130",
    "nameEn": "Industrial 7",
    "cardType": "BASE",
    "color": "white",
    "level": 4,
    "cost": 1,
    "ap": 0,
    "hp": 5,
    "traits": [
      "Civilian",
      "Stronghold"
    ],
    "triggerKeywords": [
      "Burst",
      "Deploy",
      "Activate·Main"
    ],
    "hasBurst": true
  },
};
