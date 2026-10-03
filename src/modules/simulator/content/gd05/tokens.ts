import type { CardDef } from "../../engine/types";

/**
 * Tokens gerados por cartas de GD05 (códigos oficiais em data/gcg-official-cards.json). Traits/AP/HP/keyword
 * vêm do texto da carta geradora; a cor segue a da carta geradora (convenção de ST01–GD04 — o catálogo
 * oficial não traz cor de token). Entram nos specs na wave da carta geradora.
 */

// T-026 — GD05-126 Quiet Zero "[Gundnode]((Quiet Zero)･AP2･HP2･<Breach 1>)"
export const TOKEN_GUNDNODE: CardDef = {
  code: "T-026",
  nameEn: "Gundnode",
  cardType: "UNIT",
  color: "green",
  ap: 2,
  hp: 2,
  traits: ["Quiet Zero"],
  effectKeywords: ["Breach"],
  keywordTags: ["Breach 1"],
  isToken: true,
};

// T-027 — GD05-006 Hashmal "[Pluma]((Calamity War)･AP2･HP1)"
export const TOKEN_PLUMA: CardDef = {
  code: "T-027",
  nameEn: "Pluma",
  cardType: "UNIT",
  color: "blue",
  ap: 2,
  hp: 1,
  traits: ["Calamity War"],
  isToken: true,
};
