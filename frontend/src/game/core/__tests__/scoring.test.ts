import { describe, expect, it } from 'vitest';
import {
  BALLOON_SCORES,
  BONUS_JUMPS_FOR_BLUE_ROW,
  EDGE_LANDING_BONUS,
  LIVES_ON_DEATH,
  LIVES_ON_LEVEL_UP,
  ROW_BONUS_POINTS,
} from '../constants';
import { createConsequences } from '../consequences';
import type { GameEvent } from '../events';
import { getBalloonScore, getBonusJumpsForRowClear, getRowBonus } from '../scoring';
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

  it('pins blue-only bonus-jump earning (1) and the life deltas (±1)', () => {
    expect(BONUS_JUMPS_FOR_BLUE_ROW).toBe(1);
    expect(LIVES_ON_LEVEL_UP).toBe(1);
    expect(LIVES_ON_DEATH).toBe(1);
  });
});

// Issue #7 D1: pure §3.2 scoring translation — the ONLY implementation, keyed
// by the color carried on the kernel's events.
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

  it('earns a bonus jump for a blue row clear only (§3.3 earning)', () => {
    expect(getBonusJumpsForRowClear('blue')).toBe(1);
    expect(getBonusJumpsForRowClear('green')).toBe(0);
    expect(getBonusJumpsForRowClear('yellow')).toBe(0);
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

  it('adds getBalloonScore for each balloon-popped event', () => {
    const result = consequences(base(), [pop('yellow'), pop('blue')]);
    expect(result.stats.score).toBe(getBalloonScore('yellow') + getBalloonScore('blue'));
    expect(result.stats.lives).toBe(3);
    expect(result.stats.bonusJumps).toBe(0);
  });

  it('adds getRowBonus on row-cleared and earns a bonus jump for blue only', () => {
    const green = consequences(base(), [{ type: 'row-cleared', row: 1, color: 'green' }]);
    expect(green.stats.score).toBe(getRowBonus('green'));
    expect(green.stats.bonusJumps).toBe(0); // earning is blue-only (§3.3)

    const blue = consequences(base(), [{ type: 'row-cleared', row: 0, color: 'blue' }]);
    expect(blue.stats.score).toBe(getRowBonus('blue'));
    expect(blue.stats.bonusJumps).toBe(BONUS_JUMPS_FOR_BLUE_ROW);
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

  it('treats launched, board-bounced and game-over as no-ops', () => {
    const events: GameEvent[] = [
      { type: 'launched', clownIndex: 0, via: 'input', vx: 1, vy: -14 },
      { type: 'board-bounced', clownIndex: 0 },
      { type: 'game-over' },
    ];
    const result = consequences(base(), events);
    expect(result.stats).toEqual({ score: 0, lives: 3, bonusJumps: 0 });
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
    expect(result.stats).toEqual({ score: getBalloonScore('green') + getRowBonus('green'), lives: 2, bonusJumps: 0 });
  });
});
