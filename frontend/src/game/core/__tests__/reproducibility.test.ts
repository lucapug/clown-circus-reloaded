import { describe, expect, it } from 'vitest';
import { step } from '../engine';
import { createRng } from '../rng';
import { createInitialState } from '../state';
import type { GameInput, GameState } from '../types';

// Issue #6 AC 2 (spec §6.2): same seed + same inputs → identical state across
// runs. The input script is driven by a separate RNG stream (deliberately not
// the gameplay stream), so determinism of the kernel itself is what is tested.
const TICKS = 600;

const playing = (): GameState => ({ ...createInitialState(), phase: 'playing' });

const inputScriptFor = (seed: number): ((state: GameState) => GameInput[]) => {
  const driver = createRng((seed ^ 0x9e3779b9) >>> 0);
  return () => {
    const roll = driver.next();
    if (roll < 0.03) return [{ type: 'launch' }];
    if (roll < 0.13) return [{ type: 'move-seesaw', x: 60 + driver.next() * 680 }];
    return [];
  };
};

const run = (seed: number): string => {
  let state = playing();
  const rng = createRng(seed);
  const inputs = inputScriptFor(seed);
  for (let tick = 0; tick < TICKS; tick++) {
    state = step(state, inputs(state), rng).state;
  }
  return JSON.stringify(state);
};

describe('reproducibility (spec §6.2)', () => {
  const seeds = [1, 2, 3, 5, 7, 11, 13, 42, 99, 2026, 31337, 987654321];

  it('produces byte-identical 600-tick final states across two independent runs per seed (12 seeds)', () => {
    for (const seed of seeds) {
      const first = run(seed);
      const second = run(seed);
      expect(first).toEqual(second);
    }
  });

  it('is not vacuous: different seeds produce different final states', () => {
    const distinct = new Set(seeds.map((seed) => run(seed)));
    expect(distinct.size).toBeGreaterThan(1);
  });
});
