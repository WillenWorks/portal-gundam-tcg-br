import type { CardDef } from "../../engine/types";

// Gerado por scripts/gundam-gen-carddefs.mjs --set=ST12 (texto oficial + stats do apitcg); autoria de efeito à mão por cima.
export const PILOTS: Record<string, CardDef> = {
  "ST12-011": {
    "code": "ST12-011",
    "nameEn": "Milliardo Peacecraft",
    "cardType": "PILOT",
    "color": "red",
    "level": 5,
    "cost": 1,
    "ap": 3,
    "hp": 1,
    "traits": [
      "White Fang"
    ],
    "triggerKeywords": [
      "Burst",
      "Activate·Action"
    ],
    "hasBurst": true,
    nameAliases: ["Zechs Merquise"],
    structuredSourceText: { nameAliases: "This card's name is also treated as [Zechs Merquise]." },
  },
  "ST12-012": {
    "code": "ST12-012",
    "nameEn": "Ple-Twelve",
    "cardType": "PILOT",
    "color": "purple",
    "level": 4,
    "cost": 1,
    "ap": 1,
    "hp": 2,
    "traits": [
      "Earth Federation",
      "Cyber-Newtype"
    ],
    "triggerKeywords": [
      "Burst",
      "When Linked"
    ],
    "hasBurst": true,
    nameAliases: ["Marida Cruz"],
    structuredSourceText: { nameAliases: "This card's name is also treated as [Marida Cruz]." },
  },
};
