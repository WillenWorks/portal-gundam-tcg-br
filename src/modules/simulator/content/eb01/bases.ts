import type { CardDef } from "../../engine/types";

// Gerado por scripts/gundam-gen-carddefs.mjs --set=EB01 (texto oficial + stats do apitcg); autoria de efeito à mão por cima.
export const BASES: Record<string, CardDef> = {
  "EB01-085": {
    "code": "EB01-085",
    "nameEn": "Kudelia Aina Bernstein & Isaribi",
    "cardType": "BASE",
    "color": "blue",
    "level": 5,
    "cost": 1,
    "ap": 0,
    "hp": 5,
    "traits": [
      "G Generation",
      "Warship"
    ],
    "triggerKeywords": [
      "Burst",
      "Deploy"
    ],
    "hasBurst": true
  },
  "EB01-086": {
    "code": "EB01-086",
    "nameEn": "Kycilia Zabi & Gwazine",
    "cardType": "BASE",
    "color": "blue",
    "level": 4,
    "cost": 2,
    "ap": 0,
    "hp": 5,
    "traits": [
      "G Generation",
      "Warship"
    ],
    "triggerKeywords": [
      "Burst",
      "Deploy"
    ],
    "hasBurst": true
  },
  "EB01-087": {
    "code": "EB01-087",
    "nameEn": "Marina Ismail & Ptolemaios 2",
    "cardType": "BASE",
    "color": "green",
    "level": 3,
    "cost": 2,
    "ap": 0,
    "hp": 5,
    "traits": [
      "G Generation",
      "Warship"
    ],
    "triggerKeywords": [
      "Burst",
      "Deploy"
    ],
    "hasBurst": true
  },
  "EB01-088": {
    "code": "EB01-088",
    "nameEn": "Miorine Rembran & Academy Ship",
    "cardType": "BASE",
    "color": "green",
    "level": 3,
    "cost": 1,
    "ap": 0,
    "hp": 5,
    "traits": [
      "G Generation",
      "Warship"
    ],
    "triggerKeywords": [
      "Burst",
      "Deploy"
    ],
    "hasBurst": true,
    staticAbilities: [
      {
        condition: "always",
        scope: "allFriendlyUnits",
        duringOpponentTurnOnly: true,
        stat: "ap",
        amount: 1,
        targetCondition: { kind: "allOf", conditions: [{ kind: "traitIs", trait: "G Generation" }, { kind: "levelIs", n: 3 }] },
        sourceText: "All friendly (G Generation) Units that are Lv.3 get AP+1 during your opponent's turn.",
      },
    ],
  },
  "EB01-089": {
    "code": "EB01-089",
    "nameEn": "Lacus Clyne & Eternal",
    "cardType": "BASE",
    "color": "white",
    "level": 3,
    "cost": 2,
    "ap": 0,
    "hp": 5,
    "traits": [
      "G Generation",
      "Warship"
    ],
    "triggerKeywords": [
      "Burst",
      "Deploy"
    ],
    "hasBurst": true
  },
  "EB01-090": {
    "code": "EB01-090",
    "nameEn": "Tiffa Adill & Freeden",
    "cardType": "BASE",
    "color": "white",
    "level": 2,
    "cost": 2,
    "ap": 0,
    "hp": 4,
    "traits": [
      "G Generation",
      "Warship"
    ],
    "triggerKeywords": [
      "Burst",
      "Deploy"
    ],
    "hasBurst": true
  },
};
