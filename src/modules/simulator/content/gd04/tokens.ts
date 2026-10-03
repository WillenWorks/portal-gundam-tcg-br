import type { CardDef } from "../../engine/types";

/**
 * Tokens gerados por cartas de GD04. Traits/AP/HP/texto vêm do texto da carta geradora; a cor segue
 * a da carta geradora (convenção de ST01–GD03 — o catálogo oficial não traz cor de token).
 */

// T-021 — GD04-007/011/081/121 "[Parts]((League Militaire)･AP1･HP1･This Unit can't choose the enemy player as its attack target)"
export const TOKEN_PARTS: CardDef = {
  code: "T-021",
  nameEn: "Parts",
  cardType: "UNIT",
  color: "blue",
  ap: 1,
  hp: 1,
  traits: ["League Militaire"],
  isToken: true,
  attackTargetRules: { cannotTargetPlayer: true },
};

// T-022 — GD04-017 "[Wire-Guided Arm]((Zeon)･AP2･HP1･This Unit can't be paired with a Pilot)"
export const TOKEN_WIRE_GUIDED_ARM: CardDef = {
  code: "T-022",
  nameEn: "Wire-Guided Arm",
  cardType: "UNIT",
  color: "green",
  ap: 2,
  hp: 1,
  traits: ["Zeon"],
  isToken: true,
  cannotBePaired: true,
};

// T-023 — GD04-017 "[Zeong (Head)]((Zeon)･AP3･HP1)"
export const TOKEN_ZEONG_HEAD: CardDef = {
  code: "T-023",
  nameEn: "Zeong (Head)",
  cardType: "UNIT",
  color: "green",
  ap: 3,
  hp: 1,
  traits: ["Zeon"],
  isToken: true,
};

// T-024 — GD04-080 "[Alvaaron]((UN)･AP4･HP1)"
export const TOKEN_ALVAARON: CardDef = {
  code: "T-024",
  nameEn: "Alvaaron",
  cardType: "UNIT",
  color: "white",
  ap: 4,
  hp: 1,
  traits: ["UN"],
  isToken: true,
};
