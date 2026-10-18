import type { Rng } from './types';

// mulberry32 — a tiny, fast, seeded PRNG (~5 lines, per the brief: no new
// dependencies). The only gameplay consumer in #6 is the seated-launch vx;
// exactly one next() draw per seated launch (issue brief, design decision 4).
// Submission/floating-text IDs deliberately never touch this stream (spec §6.2).
export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return {
    next: () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}
