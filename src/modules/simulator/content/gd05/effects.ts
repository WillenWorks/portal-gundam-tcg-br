import type { EffectSpec } from "../../engine/effectSpec";
import { stdAddToHandBurst, stdBaseDeployShield, stdDeployThisBurst } from "../standardSpecs";
import { GD05_W6A_EFFECT_SPECS } from "./effectsW6a";
import { GD05_W6B_EFFECT_SPECS } from "./effectsW6b";
import { GD05_W6C_EFFECT_SPECS } from "./effectsW6c";
import { GD05_W7A_EFFECT_SPECS } from "./effectsW7a";
import { GD05_W7B_EFFECT_SPECS } from "./effectsW7b";
import { GD05_W7C_EFFECT_SPECS } from "./effectsW7c";
import { GD05_W7D_EFFECT_SPECS } from "./effectsW7d";
import { GD05_W8A_EFFECT_SPECS } from "./effectsW8a";
import { GD05_W8B_EFFECT_SPECS } from "./effectsW8b";
import { GD05_W8C_EFFECT_SPECS } from "./effectsW8c";

/**
 * Wave GD05 — EffectSpecs. W6-prep: só os textos padrão de 【Burst】 e o 【Deploy】 padrão das Bases;
 * o resto entra por wave (W6 GD05-A em diante), conforme o mapa de cláusulas da W6.
 */

const ADD_TO_HAND_BURST = [
  "GD05-081", "GD05-082", "GD05-083", "GD05-084", "GD05-085", "GD05-086", "GD05-087", "GD05-088",
  "GD05-090", "GD05-091", "GD05-092", "GD05-093", "GD05-094", "GD05-095", "GD05-096", "GD05-097",
  "GD05-098", "GD05-099", "GD05-100", "GD05-101", "GD05-120",
];
/** todas as Bases do GD05 têm 【Burst】Deploy this card. e o 【Deploy】 padrão como cláusulas inteiras */
const BASES = ["GD05-123", "GD05-124", "GD05-125", "GD05-126", "GD05-127", "GD05-128", "GD05-129", "GD05-130"];

/**
 * GD05-089 Master Asia: "【Burst】Add this card to your hand. If there are 3 or more (MF) cards in your trash,
 * you may deploy it as an (AP3･HP3) Unit instead. (Don't treat it as a Pilot.)" — só a 1ª frase (a parte
 * padrão, que `standardSpecs.test.ts` exige); o "deploy as Unit instead" é motor novo. A cláusula segue
 * `missing` na auditoria até a wave da carta.
 */
const MASTER_ASIA_BURST_BASE: EffectSpec = {
  ...stdAddToHandBurst("GD05-089"),
  // W8 — "If there are 3 or more (MF) cards in your trash, you may deploy it as an (AP3･HP3) Unit instead." O
  // "instead" vira continuação opcional depois de ir pra mão (sem gatilho de "entrar na mão", o resultado é o mesmo)
  condition: { predicate: "controllerTrashCardCountWithAnyTraitAtLeast:MF:3", then: [{ op: "thenTrigger", trigger: "Then:1" }] },
};
const MASTER_ASIA_AS_UNIT: EffectSpec = {
  id: "GD05-089-Then",
  cardCode: "GD05-089",
  trigger: "Then:1",
  optional: true,
  actions: [{ op: "deployAsUnit", target: { kind: "self" }, ap: 3, hp: 3 }],
  sourceText: "If there are 3 or more (MF) cards in your trash, you may deploy it as an (AP3･HP3) Unit instead.",
};

export const GD05_EFFECT_SPECS: EffectSpec[] = [
  ...ADD_TO_HAND_BURST.map(stdAddToHandBurst),
  MASTER_ASIA_BURST_BASE,
  MASTER_ASIA_AS_UNIT,
  ...BASES.map(stdDeployThisBurst),
  ...BASES.map(stdBaseDeployShield),
  ...GD05_W6A_EFFECT_SPECS,
  ...GD05_W6B_EFFECT_SPECS,
  ...GD05_W6C_EFFECT_SPECS,
  ...GD05_W7A_EFFECT_SPECS,
  ...GD05_W7B_EFFECT_SPECS,
  ...GD05_W7C_EFFECT_SPECS,
  ...GD05_W7D_EFFECT_SPECS,
  ...GD05_W8A_EFFECT_SPECS,
  ...GD05_W8B_EFFECT_SPECS,
  ...GD05_W8C_EFFECT_SPECS,
];
