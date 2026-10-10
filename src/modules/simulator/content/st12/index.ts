import type { CardDef } from "../../engine/types";
import { BASES } from "./bases";
import { COMMANDS } from "./commands";
import { PILOTS } from "./pilots";
import { UNITS_PURPLE } from "./unitsPurple";
import { UNITS_RED } from "./unitsRed";

export * from "./effects";

export const ST12_CARD_DEFS: Record<string, CardDef> = {
  ...BASES,
  ...COMMANDS,
  ...PILOTS,
  ...UNITS_PURPLE,
  ...UNITS_RED,
};
