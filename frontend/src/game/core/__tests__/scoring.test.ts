import { describe, expect, it } from 'vitest';
import {
  BALLOON_SCORES,
  EDGE_LANDING_BONUS,
  JUMP_STREAK_GOAL,
  LIVES_ON_DEATH,
  LIVES_ON_LEVEL_UP,
  ROW_BONUS_POINTS,
} from '../constants';
import { createConsequences } from '../consequences';
import type { GameEvent } from '../events';
import { getBalloonScore, getRowBonus } from '../scoring';
import { createInitialState } from '../state';
import type { BalloonColor, GameState } from '../types';

// Issue #7 AC 1: every §3.2/§3.5 scoring value asserted as a pinned literal in
// its single home (constants.ts) — never re-derived in the tests.
describe('§3.2/§3.5 scoring constants (single home: constants.ts)', () => {
  it('pins balloon scores 20/50/100 for yellow/green/blue', () => {
    expect(BALLOON_SCORES).toEqual({ yellow: 20, green: 50, blue: 100 });
  });

  it('pins row-clear bonuses 200/500/1000 for yellow/green/blue', () => {
    expect(ROW_BONUS_POINTS).toEqual({ yellow: 200, green: 500, blue: 1000 });
  });

  it('pins the seesaw edge-landing bonus at 10', () => {
    expect(EDGE_LANDING_BONUS).toBe(10);
  });

  it('pins the life deltas (±1)', () => {
    expect(LIVES_ON_LEVEL_UP).toBe(1);
    expect(LIVES_ON_DEATH).toBe(1);
  });
});

// Issue #7 D1: pure §3.2 scoring translation — the ONLY implementation, keyed
// by the color carried on the kernel's events. #24 removed the blue-row jump
// helper: rows translate to points only (the streak fold owns earning v2).
describe('pure scoring functions (spec §3.2)', () => {
  it.each([
    ['yellow', 20],
    ['green', 50],
    ['blue', 100],
  ] as const)('getBalloonScore(%s) is the pinned %i', (color, expected) => {
    expect(getBalloonScore(color)).toBe(expected);
  });

  it.each([
    ['yellow', 200],
    ['green', 500],
    ['blue', 1000],
  ] as const)('getRowBonus(%s) is the pinned %i', (color, expected) => {
    expect(getRowBonus(color)).toBe(expected);
  });
});

// Issue #7 D3: the shipped ConsequenceReducer — a pure fold over the tick's
// events in emission order. Unit-level here (events constructed directly);
// the through-the-kernel path lives in consequences-live.test.ts.
describe('createConsequences — pure fold over the tick events (D3)', () => {
  const consequences = createConsequences();
  const base = (): GameState => ({ ...createInitialState(), phase: 'playing' });

  const pop = (color: BalloonColor): GameEvent => ({
    type: 'balloon-popped',
    balloonId: 't',
    row: 1,
    color,
    x: 0,
    y: 0,
  });

  const chainLaunch = (): GameEvent => ({ type: 'launched', clownIndex: 1, via: 'chain', vx: 1, vy: -14 });

  it('adds getBalloonScore for each balloon-popped event', () => {
    const result = consequences(base(), [pop('yellow'), pop('blue')]);
    expect(result.stats.score).toBe(getBalloonScore('yellow') + getBalloonScore('blue'));
    expect(result.stats.lives).toBe(3);
    expect(result.stats.bonusJumps).toBe(0);
  });

  it('adds getRowBonus on row-cleared and earns NO jump — not even for blue (#24: the 1000-point bonus is all a row grants)', () => {
    const green = consequences(base(), [{ type: 'row-cleared', row: 1, color: 'green' }]);
    expect(green.stats.score).toBe(getRowBonus('green'));
    expect(green.stats.bonusJumps).toBe(0);
    expect(green.stats.streak).toBe(0);

    const blue = consequences(base(), [{ type: 'row-cleared', row: 0, color: 'blue' }]);
    expect(blue.stats.score).toBe(getRowBonus('blue'));
    expect(blue.stats.bonusJumps).toBe(0); // earning moved to the launch streak (§3.3 v2)
    expect(blue.stats.streak).toBe(0); // a row clear is not a launch cycle
  });

  it('adds EDGE_LANDING_BONUS for landed-edge', () => {
    const result = consequences(base(), [{ type: 'landed-edge', clownIndex: 0, side: 'right' }]);
    expect(result.stats.score).toBe(EDGE_LANDING_BONUS);
  });

  it('applies the §3.5 life deltas: −LIVES_ON_DEATH per death, +LIVES_ON_LEVEL_UP per level-completed', () => {
    const result = consequences(base(), [
      { type: 'death', clownIndex: 0, cause: 'middle' },
      { type: 'level-completed', newLevel: 2 },
    ]);
    expect(result.stats.lives).toBe(3 - LIVES_ON_DEATH + LIVES_ON_LEVEL_UP);
  });

  it('folds in emission order: two deaths and a level-completed net −1 life', () => {
    const result = consequences(base(), [
      { type: 'death', clownIndex: 0, cause: 'middle' },
      { type: 'level-completed', newLevel: 2 },
      { type: 'death', clownIndex: 0, cause: 'fall-off' },
    ]);
    expect(result.stats.lives).toBe(2); // 3 − LIVES_ON_DEATH + LIVES_ON_LEVEL_UP − LIVES_ON_DEATH
  });

  it('treats input launches, board-bounced and game-over as no-ops (#24: input launches never count)', () => {
    const events: GameEvent[] = [
      { type: 'launched', clownIndex: 0, via: 'input', vx: 1, vy: -14 },
      { type: 'board-bounced', clownIndex: 0 },
      { type: 'game-over' },
    ];
    const result = consequences(base(), events);
    expect(result.stats).toEqual({ score: 0, lives: 3, bonusJumps: 0, streak: 0 });
  });

  it('is pure: never mutates the input state or events, returns a new state', () => {
    const state = base();
    const events: GameEvent[] = [
      pop('green'),
      { type: 'row-cleared', row: 1, color: 'green' },
      { type: 'death', clownIndex: 0, cause: 'middle' },
    ];
    const stateBefore = JSON.parse(JSON.stringify(state)) as GameState;
    const eventsBefore = JSON.parse(JSON.stringify(events)) as GameEvent[];

    const result = consequences(state, events);

    expect(state).toEqual(stateBefore);
    expect(events).toEqual(eventsBefore);
    expect(result).not.toBe(state);
    expect(result.stats).not.toBe(state.stats);
    expect(result.stats).toEqual({
      score: getBalloonScore('green') + getRowBonus('green'),
      lives: 2,
      bonusJumps: 0,
      streak: 0,
    });
  });
});

// Issue #24 (§3.3 v2 earning): the fold's streak track. JUMP_STREAK_GOAL
// consecutive `launched{via:'chain'}` events grant +1 bonusJumps and reset;
// `launched{via:'input'}` never counts; ANY death resets; level-completed
// does not. Synthetic fold-level pins — the live-path suite lives in
// consequences-live.test.ts.
describe('createConsequences — launch streak v2 (issue #24, fold-level)', () => {
  const consequences = createConsequences();
  const base = (streak: number, bonusJumps = 0): GameState => ({
    ...createInitialState(),
    phase: 'playing',
    stats: { score: 0, lives: 3, bonusJumps, streak },
  });
  const chainLaunch = (): GameEvent => ({ type: 'launched', clownIndex: 1, via: 'chain', vx: 1, vy: -14 });

  it('pins the streak goal at 25 chain launches (calibration parameter)', () => {
    expect(JUMP_STREAK_GOAL).toBe(25);
  });

  it('counts chain launches and grants +1 jump, resetting the streak, at the goal', () => {
    const result = consequences(base(JUMP_STREAK_GOAL - 1), [chainLaunch()]);
    expect(result.stats.bonusJumps).toBe(1);
    expect(result.stats.streak).toBe(0); // reset at the goal, ready for the next run
  });

  it('keeps counting below the goal without granting', () => {
    const result = consequences(base(JUMP_STREAK_GOAL - 2), [chainLaunch()]);
    expect(result.stats.bonusJumps).toBe(0);
    expect(result.stats.streak).toBe(JUMP_STREAK_GOAL - 1);
  });

  it('a chain launch at streak 0 after a grant starts the next run from 1', () => {
    const granted = consequences(base(JUMP_STREAK_GOAL - 1), [chainLaunch()]);
    const next = consequences(granted, [chainLaunch()]);
    expect(next.stats.bonusJumps).toBe(1);
    expect(next.stats.streak).toBe(1);
  });

  it('level-completed does NOT reset the streak (a deathless rally spans levels)', () => {
    const result = consequences(base(7), [{ type: 'level-completed', newLevel: 2 }]);
    expect(result.stats.streak).toBe(7);
    expect(result.stats.lives).toBe(3 + LIVES_ON_LEVEL_UP);
  });

  it('same-tick order pin [chain reaching the goal, then death]: the grant fires and the death spends it (§3.3 decision A)', () => {
    // The documented #8 rule cuts both ways: a jump earned EARLIER in the
    // same tick is spendable, so the death consumes the freshly granted jump
    // instead of a life. The grant is not reverted by the death; the streak
    // stays at its goal reset, not the death reset.
    const result = consequences(base(JUMP_STREAK_GOAL - 1, 1), [chainLaunch(), { type: 'death', clownIndex: 0, cause: 'middle' }]);
    expect(result.stats.bonusJumps).toBe(1); // grant → 2, death spends → 1: the starting jump survives
    expect(result.stats.lives).toBe(3); // the death absorbed the fresh jump, took no life
    expect(result.stats.streak).toBe(0);
  });

  it('same-tick order pin [death, then chain]: no grant, the streak counts from the death reset', () => {
    const result = consequences(base(JUMP_STREAK_GOAL - 1, 1), [{ type: 'death', clownIndex: 0, cause: 'middle' }, chainLaunch()]);
    expect(result.stats.bonusJumps).toBe(0); // the death spent the starting jump; the chain grants nothing
    expect(result.stats.lives).toBe(2); // no fresh jump to absorb it
    expect(result.stats.streak).toBe(1); // death reset to 0, then the chain launch counted
  });

  it('normalizes the optional field: a state without streak folds to streak 0, never undefined', () => {
    const result = consequences({ ...base(0), stats: { score: 5, lives: 3, bonusJumps: 0 } }, [chainLaunch()]);
    expect(result.stats.streak).toBe(1);
    expect(result.stats).toEqual({ score: 5, lives: 3, bonusJumps: 0, streak: 1 });
  });
});
