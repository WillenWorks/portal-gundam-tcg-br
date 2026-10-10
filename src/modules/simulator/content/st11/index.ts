import type { CardDef } from "../../engine/types";
import { UNITS_BLUE } from "./unitsBlue";
import { UNITS_PURPLE } from "./unitsPurple";
import { PILOTS } from "./pilots";
import { COMMANDS } from "./commands";
import { BASES } from "./bases";

export * from "./effects";
export * from "./tokens";

export const ST11_CARD_DEFS: Record<string, CardDef> = {
  ...UNITS_BLUE,
  ...UNITS_PURPLE,
  ...PILOTS,
  ...COMMANDS,
  ...BASES,
};
