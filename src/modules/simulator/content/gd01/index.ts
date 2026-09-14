import type { CardDef } from "../../engine/types";
import { UNITS_BLUE } from "./unitsBlue";
import { UNITS_GREEN } from "./unitsGreen";
import { UNITS_RED } from "./unitsRed";
import { UNITS_WHITE } from "./unitsWhite";
import { PILOTS } from "./pilots";
import { COMMANDS } from "./commands";
import { BASES } from "./bases";

export * from "./effects";

export const GD01_CARD_DEFS: Record<string, CardDef> = {
  ...UNITS_BLUE,
  ...UNITS_GREEN,
  ...UNITS_RED,
  ...UNITS_WHITE,
  ...PILOTS,
  ...COMMANDS,
  ...BASES,
};
