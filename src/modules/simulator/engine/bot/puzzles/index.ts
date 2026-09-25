import type { Puzzle } from "./types";
import { COMBAT_PUZZLES } from "./combat";
import { MAIN_PUZZLES } from "./main";

/** banco completo de situações (spec bot-avaliacao-forca) — ids únicos garantidos por teste */
export const ALL_PUZZLES: Puzzle[] = [...COMBAT_PUZZLES, ...MAIN_PUZZLES];

export type { Puzzle, PuzzleCategory, PuzzleSetup, ActionMatcher } from "./types";
