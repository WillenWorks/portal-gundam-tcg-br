import type { CardDef } from "../../engine/types";

// Gerado por scripts/gundam-gen-carddefs.mjs --set=GD05 (texto oficial + stats do apitcg); autoria de efeito à mão por cima.
export const PILOTS: Record<string, CardDef> = {
  "GD05-081": {
    "code": "GD05-081",
    "nameEn": "Kira Yamato",
    "cardType": "PILOT",
    "color": "blue",
    "level": 5,
    "cost": 1,
    "ap": 2,
    "hp": 2,
    "traits": [
      "Orb",
      "Coordinator"
    ],
    "triggerKeywords": [
      "Burst",
      "When Linked"
    ],
    "hasBurst": true
  },
  "GD05-082": {
    "code": "GD05-082",
    "nameEn": "Andrew Waldfeld",
    "cardType": "PILOT",
    "color": "blue",
    "level": 4,
    "cost": 1,
    "ap": 2,
    "hp": 1,
    "traits": [
      "Orb",
      "Coordinator"
    ],
    "triggerKeywords": [
      "Burst"
    ],
    // W6
    staticAbilities: [
      {
        sourceText: "【During Link】This Unit gains <Repair 2>.",
        condition: "duringLink",
        scope: "pairedUnit",
        keyword: "Repair",
        keywordValue: 2,
      },
    ],
    "hasBurst": true
  },
  "GD05-083": {
    "code": "GD05-083",
    "nameEn": "Cagalli Yula Athha",
    "cardType": "PILOT",
    "color": "blue",
    "level": 3,
    "cost": 1,
    "ap": 1,
    "hp": 1,
    "traits": [
      "Orb"
    ],
    "triggerKeywords": [
      "Burst",
      "When Paired"
    ],
    "hasBurst": true
  },
  "GD05-084": {
    "code": "GD05-084",
    "nameEn": "Odelo Henrik",
    "cardType": "PILOT",
    "color": "blue",
    "level": 3,
    "cost": 1,
    "ap": 2,
    "hp": 0,
    "traits": [
      "League Militaire"
    ],
    "triggerKeywords": [
      "Burst"
    ],
    "hasBurst": true,
    // W8 — aura sobre os tokens (League Militaire)
    "damageReductions": [
      {
        "amount": 1,
        "kind": "effect",
        "aura": { "targetCondition": { "kind": "allOf", "conditions": [{ "kind": "isToken" }, { "kind": "traitIs", "trait": "League Militaire" }] } },
        "sourceText": "When one of your (League Militaire) Unit tokens receives enemy effect damage, reduce it by 1."
      }
    ]
  },
  "GD05-085": {
    "code": "GD05-085",
    "nameEn": "Amuro Ray",
    "cardType": "PILOT",
    "color": "green",
    "level": 5,
    "cost": 1,
    "ap": 2,
    "hp": 2,
    "traits": [
      "Earth Federation",
      "Londo Bell",
      "Newtype"
    ],
    "triggerKeywords": [
      "Burst"
    ],
    "hasBurst": true
  },
  "GD05-086": {
    "code": "GD05-086",
    "nameEn": "Kayra Su",
    "cardType": "PILOT",
    "color": "green",
    "level": 3,
    "cost": 1,
    "ap": 1,
    "hp": 1,
    "traits": [
      "Earth Federation",
      "Londo Bell"
    ],
    "triggerKeywords": [
      "Burst"
    ],
    "hasBurst": true,
    // W8 — provocação do Piloto: a Unit pareada (descansada) atrai os ataques que não são de Link Unit
    "forcedAttackTarget": { "condition": "duringLink", "scope": "pairedUnit", "exceptLinkAttackers": true },
    "structuredSourceText": {
      "forcedAttackTarget": "【During Link】Enemy Units other than Link Units choose this rested Unit as their attack target if possible when attacking."
    }
  },
  "GD05-087": {
    "code": "GD05-087",
    "nameEn": "Lauda Neill",
    "cardType": "PILOT",
    "color": "green",
    "level": 3,
    "cost": 1,
    "ap": 1,
    "hp": 1,
    "traits": [
      "Academy"
    ],
    "triggerKeywords": [
      "Burst"
    ],
    // W6
    staticAbilities: [
      {
        sourceText: "While this Unit is (Academy), it gains <High-Maneuver>.",
        condition: "duringPair",
        scope: "pairedUnit",
        keyword: "High-Maneuver",
        targetCondition: { kind: "traitIs", trait: "Academy" },
      },
    ],
    "hasBurst": true
  },
  "GD05-088": {
    "code": "GD05-088",
    "nameEn": "Prospera Mercury",
    "cardType": "PILOT",
    "color": "green",
    "level": 5,
    "cost": 1,
    "ap": 1,
    "hp": 2,
    "traits": [
      "Quiet Zero"
    ],
    "triggerKeywords": [
      "Burst"
    ],
    "hasBurst": true,
    // W8 — "This Unit" = a pareada; as outras Lfrith/Gundnode pelo nome (sem somar 2× na pareada)
    "staticAbilities": [
      { "condition": "duringPair", "scope": "pairedUnit", "stat": "ap", "amount": 1, "sourceText": "This Unit and all your Units with \"Gundam Lfrith\" or \"Gundnode\" in their card name get AP+1." },
      {
        "condition": "duringPair",
        "scope": "allFriendlyUnits",
        "stat": "ap",
        "amount": 1,
        "excludePairedUnit": true,
        "targetCondition": { "kind": "nameContainsAny", "texts": ["Gundam Lfrith", "Gundnode"] },
        "sourceText": "This Unit and all your Units with \"Gundam Lfrith\" or \"Gundnode\" in their card name get AP+1."
      }
    ]
  },
  "GD05-089": {
    "code": "GD05-089",
    "nameEn": "Master Asia",
    "cardType": "PILOT",
    "color": "red",
    "level": 6,
    "cost": 1,
    "ap": 2,
    "hp": 2,
    "traits": [
      "Gundam Fighter"
    ],
    "triggerKeywords": [
      "Burst",
      "Attack"
    ],
    "hasBurst": true
  },
  "GD05-090": {
    "code": "GD05-090",
    "nameEn": "Stellar Loussier",
    "cardType": "PILOT",
    "color": "red",
    "level": 3,
    "cost": 1,
    "ap": 2,
    "hp": 0,
    "traits": [
      "Earth Alliance",
      "Phantom Pain",
      "Biological CPU"
    ],
    "triggerKeywords": [
      "Burst",
      "Destroyed"
    ],
    "hasBurst": true
  },
  "GD05-091": {
    "code": "GD05-091",
    "nameEn": "Sting Oakley",
    "cardType": "PILOT",
    "color": "red",
    "level": 3,
    "cost": 1,
    "ap": 1,
    "hp": 1,
    "traits": [
      "Earth Alliance",
      "Phantom Pain",
      "Biological CPU"
    ],
    "triggerKeywords": [
      "Burst"
    ],
    "hasBurst": true,
    // W7 — "While an enemy player has 7 or more cards in their trash, this Unit gets AP+1 and HP+1." (a Unit pareada)
    "staticAbilities": [
      {
        "condition": "duringPair",
        "scope": "pairedUnit",
        "stat": "ap",
        "amount": 1,
        "boardCondition": { "kind": "enemyTrashCountAtLeast", "n": 7 },
        "sourceText": "While an enemy player has 7 or more cards in their trash, this Unit gets AP+1 and HP+1."
      },
      {
        "condition": "duringPair",
        "scope": "pairedUnit",
        "stat": "hp",
        "amount": 1,
        "boardCondition": { "kind": "enemyTrashCountAtLeast", "n": 7 },
        "sourceText": "While an enemy player has 7 or more cards in their trash, this Unit gets AP+1 and HP+1."
      }
    ]
  },
  "GD05-092": {
    "code": "GD05-092",
    "nameEn": "Auel Neider",
    "cardType": "PILOT",
    "color": "red",
    "level": 3,
    "cost": 1,
    "ap": 1,
    "hp": 1,
    "traits": [
      "Earth Alliance",
      "Phantom Pain",
      "Biological CPU"
    ],
    "triggerKeywords": [
      "Burst",
      "Attack"
    ],
    "hasBurst": true
  },
  "GD05-093": {
    "code": "GD05-093",
    "nameEn": "Char Aznable",
    "cardType": "PILOT",
    "color": "purple",
    "level": 5,
    "cost": 1,
    "ap": 2,
    "hp": 2,
    "traits": [
      "Neo Zeon",
      "Newtype"
    ],
    "triggerKeywords": [
      "Burst",
      "When Linked"
    ],
    "hasBurst": true
  },
  "GD05-094": {
    "code": "GD05-094",
    "nameEn": "Quess Paraya",
    "cardType": "PILOT",
    "color": "purple",
    "level": 3,
    "cost": 1,
    "ap": 1,
    "hp": 1,
    "traits": [
      "Neo Zeon",
      "Newtype"
    ],
    "triggerKeywords": [
      "Burst",
      "Destroyed"
    ],
    "hasBurst": true
  },
  "GD05-095": {
    "code": "GD05-095",
    "nameEn": "Gyunei Guss",
    "cardType": "PILOT",
    "color": "purple",
    "level": 4,
    "cost": 1,
    "ap": 2,
    "hp": 1,
    "traits": [
      "Neo Zeon",
      "Cyber-Newtype"
    ],
    "triggerKeywords": [
      "Burst"
    ],
    // W6
    staticAbilities: [
      {
        sourceText: "While this Unit is (Neo Zeon), it gains <Blocker>.",
        condition: "duringPair",
        scope: "pairedUnit",
        keyword: "Blocker",
        targetCondition: { kind: "traitIs", trait: "Neo Zeon" },
      },
    ],
    "hasBurst": true
  },
  "GD05-096": {
    "code": "GD05-096",
    "nameEn": "Chad Chadan",
    "cardType": "PILOT",
    "color": "purple",
    "level": 3,
    "cost": 1,
    "ap": 0,
    "hp": 2,
    "traits": [
      "Tekkadan",
      "Alaya-Vijnana"
    ],
    "triggerKeywords": [
      "Burst",
      "Attack"
    ],
    "hasBurst": true
  },
  "GD05-097": {
    "code": "GD05-097",
    "nameEn": "Domon Kasshu",
    "cardType": "PILOT",
    "color": "white",
    "level": 4,
    "cost": 1,
    "ap": 2,
    "hp": 1,
    "traits": [
      "Gundam Fighter",
      "Shuffle Alliance"
    ],
    "triggerKeywords": [
      "Burst",
      "When Paired"
    ],
    "hasBurst": true
  },
  "GD05-098": {
    "code": "GD05-098",
    "nameEn": "Heero Yuy",
    "cardType": "PILOT",
    "color": "white",
    "level": 4,
    "cost": 1,
    "ap": 2,
    "hp": 1,
    "traits": [
      "G Team",
      "Operation Meteor"
    ],
    "triggerKeywords": [
      "Burst"
    ],
    "hasBurst": true
  },
  "GD05-099": {
    "code": "GD05-099",
    "nameEn": "Trowa Barton",
    "cardType": "PILOT",
    "color": "white",
    "level": 4,
    "cost": 1,
    "ap": 1,
    "hp": 2,
    "traits": [
      "G Team",
      "Operation Meteor"
    ],
    "triggerKeywords": [
      "Burst"
    ],
    "hasBurst": true
  },
  "GD05-100": {
    "code": "GD05-100",
    "nameEn": "Quatre Raberba Winner",
    "cardType": "PILOT",
    "color": "white",
    "level": 4,
    "cost": 1,
    "ap": 2,
    "hp": 1,
    "traits": [
      "G Team",
      "Operation Meteor"
    ],
    "triggerKeywords": [
      "Burst",
      "When Paired"
    ],
    "hasBurst": true
  },
  "GD05-101": {
    "code": "GD05-101",
    "nameEn": "Gavane Goonny",
    "cardType": "PILOT",
    "color": "white",
    "level": 3,
    "cost": 1,
    "ap": 1,
    "hp": 1,
    "traits": [
      "Militia"
    ],
    "triggerKeywords": [
      "Burst"
    ],
    "hasBurst": true
  },
};
