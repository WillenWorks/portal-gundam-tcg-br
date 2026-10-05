import type { CardDef } from "../../engine/types";

/** Tokens gerados por cartas do EB01 (traits/AP/HP do texto da carta geradora; cor = a da geradora). */

// T-025 — EB01-022 Gundam Exia (EX): "[Gundam Exia]((G Generation)･AP2･HP2)"
export const TOKEN_GUNDAM_EXIA_GGEN: CardDef = {
  code: "T-025",
  nameEn: "Gundam Exia",
  cardType: "UNIT",
  color: "green",
  ap: 2,
  hp: 2,
  traits: ["G Generation"],
  isToken: true,
};
