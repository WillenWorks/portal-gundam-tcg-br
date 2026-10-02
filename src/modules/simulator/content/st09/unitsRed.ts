import type { CardDef } from "../../engine/types";

// Gerado por scripts/gundam-gen-carddefs.mjs --set=ST09 (texto oficial + stats do apitcg); autoria de efeito à mão por cima.
export const UNITS_RED: Record<string, CardDef> = {
  "ST09-003": {
    "code": "ST09-003",
    "nameEn": "Saviour Gundam",
    "cardType": "UNIT",
    "color": "red",
    "level": 6,
    "cost": 5,
    "ap": 5,
    "hp": 4,
    "traits": [
      "ZAFT",
      "Minerva Squad"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Athrun Zala"
      ]
    },
    "effectKeywords": [
      "Breach"
    ],
    "keywordTags": [
      "Breach 3"
    ],
    "triggerKeywords": [
      "When Linked"
    ]
  },
};
