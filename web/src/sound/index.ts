/** The app's single sound engine (installed once in main.tsx). */
import { SoundEngine } from "./engine";

export const sound = new SoundEngine();
export type { SoundName } from "./engine";
