import { describe, expect, it } from 'vitest';
import { TICK_DURATION } from '../constants';
import { advance } from '../engine';
import { createRng } from '../rng';
import { createInitialState } from '../state';
import type { GameInput, Simulation } from '../types';

// Issue #9 decision 2: advance() gains an optional `inputs` drain, forwarded
// to the FIRST executed step of the tick loop only — the seam that lets the
// #9 rAF driver deliver launch/move-seesaw inputs at a tick boundary (spec
// §6.2). step() consumes a whole input batch in its step-0 queue drain, so
// "drain on the first executed tick" means the entire frame's queue goes to
// that one step; later ticks run with []. Backward-compat pins: existing
// callers pass nothing and stay byte-for-byte unaffected (golden and
// reproducibility suites), and a zero-tick frame consumes nothing (the #9
// caller resubmits).
const sim = (): Simulation => ({ state: { ...createInitialState(), phase: 'playing' }, accumulator: 0 });

const launchesOf = (events: ReturnType<typeof advance>['events']) =>
  events.filter((e) => e.type === 'launched');

describe('advance() optional inputs drain (issue #9 decision 2)', () => {
  it('drains the whole queued batch at the first tick boundary (two launches in one tick)', () => {
    const s = sim();
    const inputs: readonly GameInput[] = [{ type: 'launch' }, { type: 'launch' }];

    const result = advance(s, TICK_DURATION, createRng(42), undefined, inputs);

    expect(result.ticks).toBe(1);
    expect(launchesOf(result.events)).toHaveLength(2); // board clown, then seated clown
    expect(result.state.clowns[1].isFlying).toBe(true);
    expect(result.state.clowns[1].isOnDivingBoard).toBe(false);
    expect(result.state.clowns[0].isFlying).toBe(true);
  });

  it('drains on the FIRST executed tick only (later ticks never re-apply the batch)', () => {
    const s = sim();

    const result = advance(s, 2 * TICK_DURATION, createRng(42), undefined, [{ type: 'launch' }]);

    expect(result.ticks).toBe(2);
    expect(launchesOf(result.events)).toHaveLength(1); // no re-launch on tick 2
    expect(result.state.clowns[1].isFlying).toBe(true);
    expect(result.state.clowns[1].isOnDivingBoard).toBe(false);
    expect(result.state.clowns[0].isOnSeesaw).toBe(true); // seated clown untouched
  });

  it('applies a move-seesaw input at the first tick boundary', () => {
    const s = sim();

    const result = advance(s, TICK_DURATION, createRng(1), undefined, [{ type: 'move-seesaw', x: 600 }]);

    expect(result.ticks).toBe(1);
    expect(result.state.seesaw.x).toBe(600);
  });

  it('consumes nothing on a zero-tick frame (caller resubmits)', () => {
    const s = sim();
    const before = s.state;

    const result = advance(s, 0, createRng(3), undefined, [{ type: 'launch' }]);

    expect(result.ticks).toBe(0);
    expect(result.events).toEqual([]);
    expect(s.state).toBe(before); // same reference — untouched
    expect(s.state.clowns[1].isOnDivingBoard).toBe(true);
  });

  it('applies one multi-input batch on tick 1 and nothing on the following ticks', () => {
    const s = sim();

    const result = advance(
      s,
      3 * TICK_DURATION,
      createRng(5),
      undefined,
      [{ type: 'move-seesaw', x: 200 }, { type: 'move-seesaw', x: 700 }],
    );

    expect(result.ticks).toBe(3);
    expect(result.state.seesaw.x).toBe(700); // batch order preserved, ticks 2–3 input-free
  });

  it('defaults to no inputs: a plain advance call stays input-free', () => {
    const s = sim();

    const result = advance(s, TICK_DURATION, createRng(9));

    expect(result.ticks).toBe(1);
    expect(result.events).toEqual([]); // no launch without queued inputs
    expect(result.state.clowns[1].isOnDivingBoard).toBe(true);
  });
});
