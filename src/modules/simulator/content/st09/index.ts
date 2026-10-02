import type { CardDef } from "../../engine/types";
import { UNITS_PURPLE } from "./unitsPurple";
import { UNITS_RED } from "./unitsRed";
import { UNITS_WHITE } from "./unitsWhite";
import { PILOTS } from "./pilots";
import { COMMANDS } from "./commands";
import { BASES } from "./bases";

export * from "./effects";

export const ST09_CARD_DEFS: Record<string, CardDef> = {
  ...UNITS_PURPLE,
  ...UNITS_RED,
  ...UNITS_WHITE,
  ...PILOTS,
  ...COMMANDS,
  ...BASES,
};
