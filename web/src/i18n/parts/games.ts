/**
 * Strings of the minigames and the game shell, in every UI language.
 * Part E owns this file. Add each string to `en` and `es` (the build fails if
 * one is missing), and each new format's title and rules to `formats`. Components read them as
 * `t.games.…`, and format titles through `t.formats`.
 */
import { definePart } from "./types";

export const games = definePart({
  en: {
    rain: {
      badge: "Game",
      prompt: "Tap the letter before the sign lands",
      timeUp: "Time's up!",
      score: (n: number) => (n === 1 ? "1 sign caught" : `${n} signs caught`),
    },
    grid: { prompt: "Find", tile: "Sign tile" },
    wordsearch: {
      promptSigns: "Find the words in the signs",
      score: (n: number) => (n === 1 ? "1 word found" : `${n} words found`),
    },
  },
  es: {
    rain: {
      badge: "Juego",
      prompt: "Toca la letra antes de que caiga el signo",
      timeUp: "¡Se acabó el tiempo!",
      score: (n: number) => (n === 1 ? "1 signo atrapado" : `${n} signos atrapados`),
    },
    grid: { prompt: "Busca", tile: "Casilla de signo" },
    wordsearch: {
      promptSigns: "Encuentra las palabras en los signos",
      score: (n: number) => (n === 1 ? "1 palabra encontrada" : `${n} palabras encontradas`),
    },
  },
  formats: {
    en: {
      "game-rain": { title: "Sign rain", rules: "Signs fall: tap their letter before they land. Wrong taps cost time." },
      "game-grid": { title: "Sign grid", rules: "Find the sign of each letter in the grid. Wrong taps cost time." },
      "game-wordsearch": { title: "Word search", rules: "Find the words in a grid of signs. Wrong taps cost time." },
    },
    es: {
      "game-rain": { title: "Lluvia de signos", rules: "Caen signos: toca su letra antes de que lleguen abajo. Fallar resta tiempo." },
      "game-grid": { title: "Cuadrícula de signos", rules: "Encuentra en la cuadrícula el signo de cada letra. Fallar resta tiempo." },
      "game-wordsearch": { title: "Sopa de letras", rules: "Encuentra las palabras en una cuadrícula de signos. Fallar resta tiempo." },
    },
  },
});
