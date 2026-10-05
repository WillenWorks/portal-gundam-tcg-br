import type { CardDef } from "../../engine/types";
import { UNITS_BLUE } from "./unitsBlue";
import { UNITS_WHITE } from "./unitsWhite";
import { PILOTS } from "./pilots";
import { COMMANDS } from "./commands";
import { BASES } from "./bases";

export * from "./effects";

export const ST10_CARD_DEFS: Record<string, CardDef> = {
  ...UNITS_BLUE,
  ...UNITS_WHITE,
  ...PILOTS,
  ...COMMANDS,
  ...BASES,
};
