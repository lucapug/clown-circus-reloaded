import { describe, expect, it } from 'vitest';
import { GRAVITY, LANDING_Y, RANDOM_HEIGHT_START_LEVEL } from '../constants';
import type { GameEvent } from '../events';
import { step } from '../engine';
import { createRng } from '../rng';
import { createBalloonGrid, createInitialState } from '../state';
import type { Balloon, Clown, GameInput, GameState, Rng } from '../types';

// Issue #20 (owner decision 2026-10-19): from level 4 the entering clown takes
// the high or low board of the free side, 50/50 via ONE seeded rng.next() draw
// per death; below the threshold the entrant always takes the HIGH board and
// the RNG stream must not advance at all. All assertions here are behavioral
// (constructed states are fine — the kernel is pure): side via seatedFreeSide,
// height via the respawned clown's divingBoardIndex, draws via a counting
// Rng wrapper, determinism via the reproducibility-suite pattern (spec §6.2).

const playing = (overrides: Partial<GameState> = {}): GameState => ({
  ...createInitialState(),
  phase: 'playing',
  ...overrides,
});

const seated = (side: 'left' | 'right', x: number): Clown => ({
  x,
  y: LANDING_Y,
  vx: 0,
  vy: 0,
  isFlying: false,
  isOnSeesaw: true,
  seesawSide: side,
  isOnDivingBoard: false,
  divingBoardIndex: null,
});

const flying = (x: number, y: number, vx: number, vy: number, seesawSide: 'left' | 'right' = 'right'): Clown => ({
  x,
  y,
  vx,
  vy,
  isFlying: true,
  isOnSeesaw: false,
  seesawSide,
  isOnDivingBoard: false,
  divingBoardIndex: null,
});

const countDeaths = (events: GameEvent[]): number => events.filter((e) => e.type === 'death').length;

// One tick containing exactly one forced death: the flying clown lands the
// middle third (x=400, the seesaw default center — see tick-order.test.ts),
// the other clown is seated on `seatSide` (so the free side is the opposite).
const die = (level: number, seatSide: 'left' | 'right', rng: Rng) =>
  step(
    playing({
      level,
      balloons: [],
      clowns:
        seatSide === 'left'
          ? [flying(400, LANDING_Y, 0, 0), seated('left', 370)]
          : [seated('right', 430), flying(400, LANDING_Y, 0, 0)],
    }),
    [],
    rng,
  );

/** Rng wrapper counting every next() call that reaches the core (draw-count ACs). */
const countingRng = (seed: number): { rng: Rng; draws: () => number } => {
  const underlying = createRng(seed);
  let count = 0;
  return {
    rng: {
      next: () => {
        count += 1;
        return underlying.next();
      },
    },
    draws: () => count,
  };
};

describe('random entry-board height (issue #20, spec §3.4)', () => {
  it('below the start level: always the HIGH board of the free side, zero RNG draws', () => {
    const below = RANDOM_HEIGHT_START_LEVEL - 1; // level 3
    // 22 distinct seeds × both seat sides = 44 forced deaths (DoD: ≥ 20 seeds).
    const seeds = [3, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89];
    for (const seed of seeds) {
      for (const seatSide of ['left', 'right'] as const) {
        const { rng, draws } = countingRng(seed);
        const { state, events } = die(below, seatSide, rng);

        expect(countDeaths(events)).toBe(1);
        expect(state.level).toBe(below);
        // Free side is opposite the seat: seated left → right pair {2,3},
        // seated right → left pair {0,1}; the HIGH board of that pair.
        expect(state.clowns.find((c) => c.isOnDivingBoard)?.divingBoardIndex).toBe(seatSide === 'left' ? 2 : 0);
        expect(draws()).toBe(0); // the stream is untouched below the threshold
      }
    }
  });

  it('from the start level: 50/50 within 40–60% and exactly one draw per death (240 seeded runs)', () => {
    const RUNS = 240;
    const indices: Clown['divingBoardIndex'][] = [];
    let totalDraws = 0;
    for (let seed = 1; seed <= RUNS; seed++) {
      const { rng, draws } = countingRng(seed);
      const { state, events } = die(RANDOM_HEIGHT_START_LEVEL + 1, 'left', rng); // level 5

      expect(countDeaths(events)).toBe(1);
      expect(state.level).toBe(RANDOM_HEIGHT_START_LEVEL + 1);
      totalDraws += draws();
      indices.push(state.clowns.find((c) => c.isOnDivingBoard)?.divingBoardIndex ?? null);
    }
    expect(totalDraws).toBe(RUNS); // exactly one rng.next() per qualifying entry

    const high = indices.filter((b) => b === 2).length;
    const low = indices.filter((b) => b === 3).length;
    expect(high + low).toBe(RUNS);
    expect(high / RUNS).toBeGreaterThanOrEqual(0.4);
    expect(high / RUNS).toBeLessThanOrEqual(0.6);
    expect(low / RUNS).toBeGreaterThanOrEqual(0.4);
    expect(low / RUNS).toBeLessThanOrEqual(0.6);
  });

  it('both heights land on the correct free-side pair (seated left → {2,3}, seated right → {0,1})', () => {
    for (const seatSide of ['left', 'right'] as const) {
      const pair = seatSide === 'left' ? [2, 3] : [0, 1];
      const seen = new Set<number>();
      for (let seed = 1; seed <= 60; seed++) {
        const { rng } = countingRng(seed * 104729);
        const { state, events } = die(RANDOM_HEIGHT_START_LEVEL + 1, seatSide, rng);

        expect(countDeaths(events)).toBe(1);
        const index = state.clowns.find((c) => c.isOnDivingBoard)?.divingBoardIndex;
        expect(pair).toContain(index);
        if (typeof index === 'number') seen.add(index);
      }
      expect([...seen].sort()).toEqual(pair); // both heights occur, only within the pair
    }
  });

  it('pins the same-tick level-up read: a death on the tick the level completes to 4 uses the NEW rule (one draw)', () => {
    // Owner-decided implementation read (issue #20 brief, rule 1): the death
    // sites read the LIVE level local, post-step-5 — so a level-up resolved
    // earlier in the SAME tick counts. Level 3 at tick start; the dying clown
    // pops the LAST balloon at its own post-integration position (step 4),
    // the level completes to 4 (step 5), the middle-third death resolves
    // (step 6) — the #20 draw must fire on this very tick. Reading the
    // tick-start level instead would draw nothing and respawn on the high
    // board, so the draw-count assertion discriminates the two reads.
    const balloons: Balloon[] = createBalloonGrid().map((b) =>
      b.id === '0-0' ? { ...b, x: 400, y: LANDING_Y + GRAVITY } : { ...b, popped: true },
    );
    for (const seatSide of ['left', 'right'] as const) {
      const { rng, draws } = countingRng(11);
      const { state, events } = step(
        playing({
          level: 3,
          balloons,
          clowns:
            seatSide === 'left'
              ? [flying(400, LANDING_Y, 0, 0), seated('left', 370)]
              : [seated('right', 430), flying(400, LANDING_Y, 0, 0)],
        }),
        [],
        rng,
      );

      expect(events.map((e) => e.type)).toEqual(['balloon-popped', 'row-cleared', 'level-completed', 'death']);
      expect(state.level).toBe(4); // the level-up landed inside this same tick
      expect(draws()).toBe(1); // NEW rule: the entry draw consumed a stream position
    }

    // Contrast, same seed: the identical death WITHOUT the same-tick level-up
    // (balloons empty, level stays 3) draws nothing and takes the HIGH board.
    const { rng: noLevelUpRng, draws: noLevelUpDraws } = countingRng(11);
    const noLevelUp = die(3, 'left', noLevelUpRng);
    expect(countDeaths(noLevelUp.events)).toBe(1);
    expect(noLevelUp.state.level).toBe(3);
    expect(noLevelUp.state.clowns.find((c) => c.isOnDivingBoard)?.divingBoardIndex).toBe(2);
    expect(noLevelUpDraws()).toBe(0);
  });

  it('is deterministic at level ≥ 4: same seed + inputs → identical final state and events (spec §6.2 pattern)', () => {
    const first = runScripted(2026);
    const second = runScripted(2026);
    expect(first).toEqual(second);
  });

  it('scripted level-5 run is non-vacuous: it contains deaths, so the new draw path fired', () => {
    const run = runScripted(2026);
    expect(run.deaths).toBeGreaterThan(0);
    expect(run.events).toContain('"type":"death"');
  });
});

// --- Determinism harness: the reproducibility-suite pattern (separate input
// driver stream, gameplay stream = createRng(seed)), started at level 5 so the
// #20 draw participates in the replayed stream.
const TICKS = 400;

const inputScriptFor = (seed: number): (() => GameInput[]) => {
  const driver = createRng((seed ^ 0x9e3779b9) >>> 0);
  return () => {
    const roll = driver.next();
    if (roll < 0.05) return [{ type: 'launch' }];
    if (roll < 0.15) return [{ type: 'move-seesaw', x: 60 + driver.next() * 680 }];
    return [];
  };
};

const runScripted = (seed: number): { state: string; events: string; deaths: number } => {
  let state = playing({ level: RANDOM_HEIGHT_START_LEVEL + 1 });
  const rng = createRng(seed);
  const inputs = inputScriptFor(seed);
  const events: GameEvent[] = [];
  for (let tick = 0; tick < TICKS; tick++) {
    const result = step(state, inputs(), rng);
    state = result.state;
    events.push(...result.events);
  }
  return {
    state: JSON.stringify(state),
    events: JSON.stringify(events),
    deaths: countDeaths(events),
  };
};
