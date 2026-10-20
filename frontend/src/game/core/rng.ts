import type { Rng } from './types';

// mulberry32 — a tiny, fast, seeded PRNG (~5 lines, per the brief: no new
// dependencies). Two gameplay consumers, exactly one next() draw each: the
// seated-launch vx (issue brief, design decision 4) and — since issue #20 —
// the entry-board height draw, one per qualifying entry at level ≥ 4
// (engine.ts drawEntryHeightIndex; the stream position of seeded runs that
// contain level ≥ 4 entries therefore shifts vs pre-#20 recordings, spec §6.2).
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
