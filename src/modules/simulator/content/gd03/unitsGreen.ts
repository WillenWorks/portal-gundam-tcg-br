import type { CardDef } from "../../engine/types";

export const UNITS_GREEN: Record<string, CardDef> = {
  "GD03-017": {
    "code": "GD03-017",
    "nameEn": "Kämpfer",
    "cardType": "UNIT",
    "color": "green",
    "level": 4,
    "cost": 3,
    "ap": 4,
    "hp": 3,
    "traits": [
      "Zeon",
      "Cyclops Team"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Mikhail Kaminsky"
      ]
    },
    "triggerKeywords": [
      "Burst"
    ],
    "hasBurst": true
  },
  // W0.3 (revisão semântica): Blocker indevido (o texto só cita inimigos com <Blocker>)
  "GD03-018": {
    "code": "GD03-018",
    "nameEn": "Altron Gundam",
    "cardType": "UNIT",
    "color": "green",
    "level": 8,
    "cost": 6,
    "ap": 5,
    "hp": 6,
    "traits": [
      "G Team"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Chang Wufei"
      ]
    },
    "effectKeywords": [
      "Breach"
    ],
    "keywordTags": [
      "Breach 5"
    ],
    "triggerKeywords": [
      "Attack"
    ]
  },
  "GD03-019": {
    "code": "GD03-019",
    "nameEn": "Gundam AGE-2 Normal",
    "cardType": "UNIT",
    "color": "green",
    "level": 5,
    "cost": 4,
    "ap": 4,
    "hp": 4,
    "traits": [
      "Earth Federation",
      "AGE System"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Asemu Asuno"
      ]
    },
    "triggerKeywords": [
      "During Pair"
    ]
  },
  "GD03-020": {
    "code": "GD03-020",
    "nameEn": "Zaku Ⅱ FZ",
    "cardType": "UNIT",
    "color": "green",
    "level": 2,
    "cost": 2,
    "ap": 1,
    "hp": 2,
    "traits": [
      "Zeon",
      "Cyclops Team"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Bernard Wiseman"
      ]
    },
    "triggerKeywords": [
      "When Paired"
    ]
  },
  "GD03-021": {
    "code": "GD03-021",
    "nameEn": "Gundam Deathscythe Hell",
    "cardType": "UNIT",
    "color": "green",
    "level": 8,
    "cost": 7,
    "ap": 6,
    "hp": 5,
    "traits": [
      "G Team"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Duo Maxwell"
      ]
    },
    "triggerKeywords": [
      "Deploy"
    ]
  },
  "GD03-022": {
    "code": "GD03-022",
    "nameEn": "Gundam Kyrios",
    "cardType": "UNIT",
    "color": "green",
    "level": 5,
    "cost": 3,
    "ap": 5,
    "hp": 3,
    "traits": [
      "CB",
      "GN Drive"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Allelujah Haptism",
        "Hallelujah Haptism"
      ]
    },
    "triggerKeywords": [
      "During Link"
    ]
  },
  // W0.3 (revisão semântica): High-Maneuver inato indevido
  "GD03-023": {
    "code": "GD03-023",
    "nameEn": "G-Bouncer",
    "cardType": "UNIT",
    "color": "green",
    "level": 4,
    "cost": 3,
    "ap": 4,
    "hp": 3,
    "traits": [
      "Earth Federation"
    ],
    "link": {
      "kind": "trait",
      "values": [
        "Earth Federation"
      ]
    },
    // W0.3 — "When you place an EX Resource, choose 1 of your (AGE System) Units. It gains
    // <High-Maneuver> during this turn." (sem 【Once per Turn】, ao contrário de GD02-022).
    onExResourcePlaced: {
      grantKeyword: "High-Maneuver",
      requiresTargetTrait: "AGE System",
      sourceText: "When you place an EX Resource, choose 1 of your (AGE System) Units. It gains <High-Maneuver> during this turn.",
    },
  },
  "GD03-024": {
    "code": "GD03-024",
    "nameEn": "Hy-Gogg",
    "cardType": "UNIT",
    "color": "green",
    "level": 3,
    "cost": 2,
    "ap": 3,
    "hp": 2,
    "traits": [
      "Zeon",
      "Cyclops Team"
    ],
    "link": {
      "kind": "trait",
      "values": [
        "Cyclops Team"
      ]
    }
  },
  "GD03-025": {
    "code": "GD03-025",
    "nameEn": "Gundam Sandrock Custom",
    "cardType": "UNIT",
    "color": "green",
    "level": 5,
    "cost": 4,
    "ap": 5,
    "hp": 4,
    "traits": [
      "G Team"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Quatre Raberba Winner"
      ]
    }
  },
  "GD03-026": {
    "code": "GD03-026",
    "nameEn": "Gundam Dynames",
    "cardType": "UNIT",
    "color": "green",
    "level": 5,
    "cost": 3,
    "ap": 4,
    "hp": 4,
    "traits": [
      "CB",
      "GN Drive"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Lockon Stratos"
      ]
    },
    "effectKeywords": [
      "Breach"
    ],
    "keywordTags": [
      "Breach 3"
    ]
  },
  "GD03-027": {
    "code": "GD03-027",
    "nameEn": "Z’Gok E",
    "cardType": "UNIT",
    "color": "green",
    "level": 3,
    "cost": 2,
    "ap": 3,
    "hp": 3,
    "traits": [
      "Zeon",
      "Cyclops Team"
    ],
    "link": {
      "kind": "trait",
      "values": [
        "Cyclops Team"
      ]
    }
  },
  "GD03-028": {
    "code": "GD03-028",
    "nameEn": "Auda's Maganac",
    "cardType": "UNIT",
    "color": "green",
    "level": 3,
    "cost": 2,
    "ap": 2,
    "hp": 3,
    "traits": [
      "Maganac Corps"
    ],
    "link": {
      "kind": "trait",
      "values": [
        "Maganac Corps"
      ]
    },
    "triggerKeywords": [
      "Attack"
    ]
  },
  // W0.3 (revisão semântica): Blocker indevido (o texto só cita inimigos com <Blocker>)
  "GD03-029": {
    "code": "GD03-029",
    "nameEn": "Gundam Heavyarms Custom",
    "cardType": "UNIT",
    "color": "green",
    "level": 6,
    "cost": 5,
    "ap": 4,
    "hp": 5,
    "traits": [
      "G Team"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Trowa Barton"
      ]
    }
  },
  "GD03-030": {
    "code": "GD03-030",
    "nameEn": "Gundam Kyrios (Tail Unit Flight Mode)",
    "cardType": "UNIT",
    "color": "green",
    "level": 3,
    "cost": 4,
    "ap": 3,
    "hp": 4,
    "traits": [
      "CB",
      "GN Drive"
    ],
    "link": {
      "kind": "pilotName",
      "values": [
        "Allelujah Haptism",
        "Hallelujah Haptism"
      ]
    }
  },
  "GD03-031": {
    "code": "GD03-031",
    "nameEn": "Gundam AGE-1 Flat",
    "cardType": "UNIT",
    "color": "green",
    "level": 4,
    "cost": 2,
    "ap": 4,
    "hp": 3,
    "traits": [
      "Earth Federation",
      "AGE System"
    ],
    "link": {
      "kind": "trait",
      "values": [
        "Asuno Family"
      ]
    }
  },
  "GD03-032": {
    "code": "GD03-032",
    "nameEn": "Zaku (Four Snake Eyes') [YETI] (GQ)",
    "cardType": "UNIT",
    "color": "green",
    "level": 2,
    "cost": 1,
    "ap": 2,
    "hp": 2,
    "traits": [
      "Clan"
    ]
  },
};
