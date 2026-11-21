/**
 * Seeded randomness. Pure modules never call Math.random(): they take an Rng, so the same seed always
 * gives the same cards, options and order (tests, dev mode, and the recommender's determinism metric).
 */
import type { Rng } from "./types";

/** mulberry32: small, fast, good enough for shuffling options and picking cards. */
export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return {
    next() {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

/** 32-bit FNV-1a hash: turns any text (a session or card id) into a seed. */
export function seedFrom(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Integer in [0, n). */
export function randInt(rng: Rng, n: number): number {
  return Math.floor(rng.next() * n);
}

export function pick<T>(rng: Rng, list: readonly T[]): T | undefined {
  return list.length ? list[randInt(rng, list.length)] : undefined;
}

/** Fisher–Yates on a copy. */
export function shuffle<T>(rng: Rng, list: readonly T[]): T[] {
  const r = [...list];
  for (let i = r.length - 1; i > 0; i--) {
    const j = randInt(rng, i + 1);
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}
