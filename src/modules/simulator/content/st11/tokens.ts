import type { CardDef } from "../../engine/types";

/** Tokens gerados por cartas do ST11 (traits/AP/HP do texto da carta geradora; cor = a da geradora). */

// T-028 — ST11-004 ZnO: "[GOOhN]((ZAFT) (Marine)･AP1･HP1)"
export const TOKEN_GOOHN: CardDef = {
  code: "T-028",
  nameEn: "GOOhN",
  cardType: "UNIT",
  color: "blue",
  ap: 1,
  hp: 1,
  traits: ["ZAFT", "Marine"],
  isToken: true,
};
