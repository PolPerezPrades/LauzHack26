/** React side of the minigames (Part E owns this file): FormatId → view, and media prefetch. */
import { prefetchSigns } from "../viewer/prefetch";
import { prefetchStills } from "../viewer/SignStill";
import { GameGridView } from "./game-grid/View";
import { GameRainView } from "./game-rain/View";
import { GameWordsearchView } from "./game-wordsearch/View";
import { view, type PrefetchMap, type ViewMap } from "./viewTypes";

export const GAME_VIEWS: ViewMap = {
  "game-rain": view(GameRainView),
  "game-grid": view(GameGridView),
  "game-wordsearch": view(GameWordsearchView),
};

export const GAME_PREFETCH: PrefetchMap = {
  "game-rain": (plan) => prefetchSigns([...plan.items]),
  "game-grid": (plan) => prefetchSigns((plan.params as { tiles?: string[] }).tiles ?? [...plan.items]),
  "game-wordsearch": (plan) => prefetchStills([...plan.items]),
};
