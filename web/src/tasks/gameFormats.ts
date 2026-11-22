/** Minigames (SPEC §4.7). Part E owns this list and the `game-*` format folders it imports. */
import type { TaskSpec } from "../core/types";
import { gameGrid } from "./game-grid/spec";
import { gameRain } from "./game-rain/spec";
import { gameWordsearch } from "./game-wordsearch/spec";

export const GAME_FORMATS: readonly TaskSpec[] = [gameRain as TaskSpec, gameGrid as TaskSpec, gameWordsearch as TaskSpec];
