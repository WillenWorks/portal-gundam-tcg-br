import type { CardDef } from "../../engine/types";
import { BASES } from "./bases";
import { COMMANDS } from "./commands";
import { PILOTS } from "./pilots";
import { UNITS_GREEN } from "./unitsGreen";
import { UNITS_RED } from "./unitsRed";

export * from "./effects";
export * from "./tokens";

export const ST13_CARD_DEFS: Record<string, CardDef> = {
  ...BASES,
  ...COMMANDS,
  ...PILOTS,
  ...UNITS_GREEN,
  ...UNITS_RED,
};
