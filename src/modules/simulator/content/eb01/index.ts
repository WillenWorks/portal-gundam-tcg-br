import type { CardDef } from "../../engine/types";
import type { EffectSpec } from "../../engine/effectSpec";
import { UNITS_BLUE } from "./unitsBlue";
import { UNITS_GREEN } from "./unitsGreen";
import { UNITS_WHITE } from "./unitsWhite";
import { PILOTS } from "./pilots";
import { COMMANDS } from "./commands";
import { BASES } from "./bases";
import { EB01_W10A_EFFECT_SPECS } from "./effectsW10a";
import { EB01_W10B_EFFECT_SPECS } from "./effectsW10b";
import { EB01_W11_EFFECT_SPECS } from "./effectsW11";

export * from "./tokens";

export const EB01_CARD_DEFS: Record<string, CardDef> = {
  ...UNITS_BLUE,
  ...UNITS_GREEN,
  ...UNITS_WHITE,
  ...PILOTS,
  ...COMMANDS,
  ...BASES,
};

/** Extra Booster EB01 — EffectSpecs (W10/W11). */
export const EB01_EFFECT_SPECS: EffectSpec[] = [...EB01_W10A_EFFECT_SPECS, ...EB01_W10B_EFFECT_SPECS, ...EB01_W11_EFFECT_SPECS];
