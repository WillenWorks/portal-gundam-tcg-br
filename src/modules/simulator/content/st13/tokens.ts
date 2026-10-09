import type { CardDef } from "../../engine/types";

/** Tokens gerados por cartas do ST13 (traits/AP/HP do texto da carta geradora; cor = a da geradora). */

// T-029 — ST13-001/002/013/016: "[Bit / Funnel]((Long-Range Weapon)･AP2･HP2･This Unit can't be paired with a Pilot or attack)"
export const TOKEN_BIT_FUNNEL: CardDef = {
  code: "T-029",
  nameEn: "Bit / Funnel",
  cardType: "UNIT",
  color: "green",
  ap: 2,
  hp: 2,
  traits: ["Long-Range Weapon"],
  isToken: true,
  cannotBePaired: true,
  cannotAttack: true,
};
