import type { CardDef } from "../../engine/types";

/**
 * Tokens gerados por cartas do GD06 (códigos oficiais em data/gcg-official-cards.json). Traits/AP/HP/keyword
 * vêm do texto da carta geradora; a cor segue a da carta geradora (convenção de ST01–GD05 — o catálogo
 * oficial não traz cor de token).
 */

// T-030 — GD06-070 Eagail "[Gozzo]((Dianna Counter)･AP0･HP3･<Blocker>)"
export const TOKEN_GOZZO: CardDef = {
  code: "T-030",
  nameEn: "Gozzo",
  cardType: "UNIT",
  color: "white",
  ap: 0,
  hp: 3,
  traits: ["Dianna Counter"],
  effectKeywords: ["Blocker"],
  isToken: true,
};

// T-031 — GD06-019 Turn X / GD06-109 God of War Ghingnham "[Turn X (Arms)]((Ghingnham Fleet) (Long-Range Weapon)･AP2･HP3)"
export const TOKEN_TURN_X_ARMS: CardDef = {
  code: "T-031",
  nameEn: "Turn X (Arms)",
  cardType: "UNIT",
  color: "green",
  ap: 2,
  hp: 3,
  traits: ["Ghingnham Fleet", "Long-Range Weapon"],
  isToken: true,
};

// T-032 — GD06-019 Turn X / GD06-109 God of War Ghingnham "[Turn X (Legs)]((Ghingnham Fleet) (Long-Range Weapon)･AP3･HP2)"
export const TOKEN_TURN_X_LEGS: CardDef = {
  code: "T-032",
  nameEn: "Turn X (Legs)",
  cardType: "UNIT",
  color: "green",
  ap: 3,
  hp: 2,
  traits: ["Ghingnham Fleet", "Long-Range Weapon"],
  isToken: true,
};

// T-033 — GD06-115 Teaching New Techniques "[Sazabi]((Neo Zeon)･AP4･HP4)"
export const TOKEN_SAZABI: CardDef = {
  code: "T-033",
  nameEn: "Sazabi",
  cardType: "UNIT",
  color: "purple",
  ap: 4,
  hp: 4,
  traits: ["Neo Zeon"],
  isToken: true,
};

// T-034 — GD06-115 Teaching New Techniques (o dono da Unit destruída) "[Nu Gundam]((Londo Bell)･AP3･HP3･<First Strike>)"
export const TOKEN_NU_GUNDAM: CardDef = {
  code: "T-034",
  nameEn: "Nu Gundam",
  cardType: "UNIT",
  color: "purple",
  ap: 3,
  hp: 3,
  traits: ["Londo Bell"],
  effectKeywords: ["First Strike"],
  isToken: true,
};

// T-035 — GD06-105 Grace Under Pressure "[Gundam Calibarn]((Academy)･AP5･HP3･<High-Maneuver>)"
export const TOKEN_GUNDAM_CALIBARN: CardDef = {
  code: "T-035",
  nameEn: "Gundam Calibarn",
  cardType: "UNIT",
  color: "green",
  ap: 5,
  hp: 3,
  traits: ["Academy"],
  effectKeywords: ["High-Maneuver"],
  isToken: true,
};

// T-036 — GD06-105 Grace Under Pressure "[Gundam Aerial Rebuild]((Quiet Zero)･AP3･HP5･<Breach 3>)"
export const TOKEN_GUNDAM_AERIAL_REBUILD: CardDef = {
  code: "T-036",
  nameEn: "Gundam Aerial Rebuild",
  cardType: "UNIT",
  color: "green",
  ap: 3,
  hp: 5,
  traits: ["Quiet Zero"],
  effectKeywords: ["Breach"],
  keywordTags: ["Breach 3"],
  isToken: true,
};

// T-037 — GD06-129 5th Luna 【Destroyed】 "[Axis]((Neo Zeon)･AP0･HP5) Base token"
export const TOKEN_AXIS_BASE: CardDef = {
  code: "T-037",
  nameEn: "Axis",
  cardType: "BASE",
  color: "purple",
  ap: 0,
  hp: 5,
  traits: ["Neo Zeon"],
  isToken: true,
};
