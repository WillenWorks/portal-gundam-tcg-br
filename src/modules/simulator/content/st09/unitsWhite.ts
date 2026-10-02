import type { CardDef } from "../../engine/types";

// Gerado por scripts/gundam-gen-carddefs.mjs --set=ST09 (texto oficial + stats do apitcg); autoria de efeito à mão por cima.
export const UNITS_WHITE: Record<string, CardDef> = {
  "ST09-004": {
    "code": "ST09-004",
    "nameEn": "Freedom Gundam",
    "cardType": "UNIT",
    "color": "white",
    "level": 6,
    "cost": 5,
    "ap": 4,
    "hp": 5,
    "traits": [
      "Orb"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Kira Yamato"
      ]
    },
    "effectKeywords": [
      "Blocker"
    ]
  },
};
