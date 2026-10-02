import type { EffectSpec } from "../../engine/effectSpec";
import { stdAddToHandBurst, stdDeployThisBurst } from "../standardSpecs";
import { GD04_W3_EFFECT_SPECS } from "./effectsW3";
import { GD04_W4_EFFECT_SPECS } from "./effectsW4";
import { GD04_W5_EFFECT_SPECS } from "./effectsW5";

/**
 * Wave GD04 "Phantom Aria" — EffectSpecs. W3 (GD04-A): textos padrão de 【Burst】 e o 【Deploy】
 * padrão das Bases; o resto entra por wave (W4/W5), conforme o motor ganha os pacotes C3–C12.
 */

const ADD_TO_HAND_BURST = [
  "GD04-081", "GD04-082", "GD04-083", "GD04-084", "GD04-085", "GD04-086", "GD04-087", "GD04-088",
  "GD04-089", "GD04-090", "GD04-091", "GD04-092", "GD04-093", "GD04-094", "GD04-095", "GD04-096",
  "GD04-097", "GD04-098", "GD04-099", "GD04-100", "GD04-107",
];
const BASES = ["GD04-121", "GD04-122", "GD04-123", "GD04-124", "GD04-125", "GD04-126", "GD04-127", "GD04-128", "GD04-129", "GD04-130"];
/** Bases cujo 【Deploy】 é SÓ o texto padrão (121/127/129 têm "Then, …" — autoria própria) */
const PLAIN_DEPLOY_BASES = ["GD04-122", "GD04-123", "GD04-124", "GD04-125", "GD04-126", "GD04-128", "GD04-130"];

const stdBaseDeployShield = (cardCode: string): EffectSpec => ({
  id: `${cardCode}-Deploy`,
  cardCode,
  trigger: "Deploy",
  actions: [{ op: "addShieldToHand", player: "controller", count: 1 }],
  sourceText: "【Deploy】Add 1 of your Shields to your hand.",
});

export const GD04_EFFECT_SPECS: EffectSpec[] = [
  ...ADD_TO_HAND_BURST.map(stdAddToHandBurst),
  ...BASES.map(stdDeployThisBurst),
  ...PLAIN_DEPLOY_BASES.map(stdBaseDeployShield),
  ...GD04_W3_EFFECT_SPECS,
  ...GD04_W4_EFFECT_SPECS,
  ...GD04_W5_EFFECT_SPECS,
];
