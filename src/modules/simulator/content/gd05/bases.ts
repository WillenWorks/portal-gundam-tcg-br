import type { CardDef } from "../../engine/types";

// Gerado por scripts/gundam-gen-carddefs.mjs --set=GD05 (texto oficial + stats do apitcg); autoria de efeito à mão por cima.
export const BASES: Record<string, CardDef> = {
  "GD05-123": {
    "code": "GD05-123",
    "nameEn": "Archangel",
    "cardType": "BASE",
    "color": "blue",
    "level": 2,
    "cost": 1,
    "ap": 0,
    "hp": 5,
    "traits": [
      "Orb",
      "Warship"
    ],
    "triggerKeywords": [
      "Burst",
      "Deploy"
    ],
    "hasBurst": true,
    // W8 — aura: no turno do oponente, (Orb) não recebe dano de efeito inimigo ≤ 2
    "damageReductions": [
      {
        "immuneIfAtMost": 2,
        "kind": "effect",
        "duringOpponentTurnOnly": true,
        "aura": { "targetCondition": { "kind": "traitIs", "trait": "Orb" } },
        "sourceText": "During your opponent's turn, friendly (Orb) Units can't receive 2 or less enemy effect damage."
      }
    ]
  },
  "GD05-124": {
    "code": "GD05-124",
    "nameEn": "White Ark",
    "cardType": "BASE",
    "color": "blue",
    "level": 2,
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
  "GD05-125": {
    "code": "GD05-125",
    "nameEn": "Ra Cailum",
    "cardType": "BASE",
    "color": "green",
    "level": 3,
    "cost": 1,
    "ap": 0,
    "hp": 5,
    "traits": [
      "Earth Federation",
      "Londo Bell",
      "Warship"
    ],
    "triggerKeywords": [
      "Burst",
      "Deploy",
      "Activate·Main"
    ],
    "hasBurst": true
  },
  "GD05-126": {
    "code": "GD05-126",
    "nameEn": "Quiet Zero",
    "cardType": "BASE",
    "color": "green",
    "level": 6,
    "cost": 1,
    "ap": 0,
    "hp": 6,
    "traits": [
      "Quiet Zero",
      "Stronghold"
    ],
    "triggerKeywords": [
      "Burst",
      "Deploy",
      "Activate·Main"
    ],
    "hasBurst": true
  },
  "GD05-127": {
    "code": "GD05-127",
    "nameEn": "Girty Lue",
    "cardType": "BASE",
    "color": "red",
    "level": 2,
    "cost": 1,
    "ap": 0,
    "hp": 5,
    "traits": [
      "Earth Alliance",
      "Phantom Pain",
      "Warship"
    ],
    "triggerKeywords": [
      "Burst",
      "Deploy"
    ],
    "hasBurst": true
  },
  "GD05-128": {
    "code": "GD05-128",
    "nameEn": "Gundam Fight",
    "cardType": "BASE",
    "color": "red",
    "level": 3,
    "cost": 1,
    "ap": 0,
    "hp": 5,
    "traits": [
      "Stronghold"
    ],
    "triggerKeywords": [
      "Burst",
      "Deploy",
      "Activate·Main"
    ],
    "hasBurst": true
  },
  "GD05-129": {
    "code": "GD05-129",
    "nameEn": "Axis",
    "cardType": "BASE",
    "color": "purple",
    "level": 4,
    "cost": 1,
    "ap": 0,
    "hp": 6,
    "traits": [
      "Neo Zeon",
      "Stronghold"
    ],
    "triggerKeywords": [
      "Burst",
      "Deploy",
      "Activate·Main"
    ],
    "hasBurst": true
  },
  "GD05-130": {
    "code": "GD05-130",
    "nameEn": "Presidential Office",
    "cardType": "BASE",
    "color": "white",
    "level": 2,
    "cost": 1,
    "ap": 0,
    "hp": 5,
    "traits": [
      "Earth Sphere Unified Nation",
      "Stronghold"
    ],
    "triggerKeywords": [
      "Burst",
      "Deploy",
      "Destroyed"
    ],
    "hasBurst": true
  },
};
