import type { CardDef } from "../../engine/types";

// Gerado por scripts/gundam-gen-carddefs.mjs --set=ST13 (texto oficial + stats do apitcg); autoria de efeito à mão por cima.
export const COMMANDS: Record<string, CardDef> = {
  "ST13-013": {
    "code": "ST13-013",
    "nameEn": "I'm a Newtype",
    "cardType": "COMMAND",
    "color": "green",
    "level": 4,
    "cost": 1,
    "traits": [
      "SRA",
      "Newtype"
    ],
    "pilotMode": {
      "pilotName": "Carris Nautilus",
      "ap": 1,
      "hp": 1
    },
    "ap": 1,
    "hp": 1,
    "triggerKeywords": [
      "Main"
    ]
  },
  "ST13-014": {
    "code": "ST13-014",
    "nameEn": "Final Duty",
    "cardType": "COMMAND",
    "color": "red",
    "level": 6,
    "cost": 2,
    "triggerKeywords": [
      "Main"
    ]
  },
  "ST13-015": {
    "code": "ST13-015",
    "nameEn": "Operation to Intercept Solomon",
    "cardType": "COMMAND",
    "color": "red",
    "level": 4,
    "cost": 2,
    "triggerKeywords": [
      "Burst",
      "Main",
      "Action"
    ],
    "hasBurst": true
  },
};
