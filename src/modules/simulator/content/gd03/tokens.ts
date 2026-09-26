import type { CardDef } from "../../engine/types";

/**
 * Tokens gerados por cartas de GD03. Traits/AP/HP vêm do texto da carta que gera o token
 * (ex. "[Hy-Gogg]((Cyclops Team)·AP2·HP1)"); a cor segue a da carta geradora, mesma
 * convenção dos tokens de ST01–GD02 (o catálogo oficial não traz cor de token).
 */

// T-013 — GD03-024 Hy-Gogg / GD03-108 How Many Miles to the Battlefield?
export const TOKEN_HY_GOGG: CardDef = {
  code: "T-013",
  nameEn: "Hy-Gogg",
  cardType: "UNIT",
  color: "green",
  ap: 2,
  hp: 1,
  traits: ["Cyclops Team"],
  isToken: true,
};

// T-018 — GD03-106 M.A.V. Tactics
export const TOKEN_RED_GUNDAM: CardDef = {
  code: "T-018",
  nameEn: "Red Gundam",
  cardType: "UNIT",
  color: "green",
  ap: 2,
  hp: 3,
  traits: ["Clan"],
  isToken: true,
};

// T-019 — GD03-106 M.A.V. Tactics
export const TOKEN_GQUUUUUUX_OMEGA: CardDef = {
  code: "T-019",
  nameEn: "GQuuuuuuX (Omega Psycommu)",
  cardType: "UNIT",
  color: "green",
  ap: 3,
  hp: 2,
  traits: ["Clan"],
  isToken: true,
};

// T-020 — GD03-048 GFreD
export const TOKEN_GFRED: CardDef = {
  code: "T-020",
  nameEn: "GFreD",
  cardType: "UNIT",
  color: "red",
  ap: 4,
  hp: 3,
  traits: ["Zeon"],
  isToken: true,
};

// T-015 — GD03-060
export const TOKEN_CGS_MOBILE_WORKER: CardDef = {
  code: "T-015",
  nameEn: "CGS Mobile Worker",
  cardType: "UNIT",
  color: "purple",
  ap: 1,
  hp: 1,
  traits: ["Tekkadan"],
  isToken: true,
};
