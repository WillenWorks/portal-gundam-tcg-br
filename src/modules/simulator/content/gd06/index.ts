import type { CardDef } from "../../engine/types";
import type { EffectSpec } from "../../engine/effectSpec";
import { UNITS_BLUE } from "./unitsBlue";
import { UNITS_GREEN } from "./unitsGreen";
import { UNITS_RED } from "./unitsRed";
import { UNITS_PURPLE } from "./unitsPurple";
import { UNITS_WHITE } from "./unitsWhite";
import { PILOTS } from "./pilots";
import { COMMANDS } from "./commands";
import { BASES } from "./bases";
import { GD06_W13A_EFFECT_SPECS } from "./effectsW13a";

export * from "./tokens";

export const GD06_CARD_DEFS: Record<string, CardDef> = {
  ...UNITS_BLUE,
  ...UNITS_GREEN,
  ...UNITS_RED,
  ...UNITS_PURPLE,
  ...UNITS_WHITE,
  ...PILOTS,
  ...COMMANDS,
  ...BASES,
};

/** Booster GD06 (Stardust Trails) — EffectSpecs (W13). */
export const GD06_EFFECT_SPECS: EffectSpec[] = [...GD06_W13A_EFFECT_SPECS];
