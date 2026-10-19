import { describe, expect, it } from 'vitest';
import {
  BALLOON_SCORES,
  BONUS_JUMPS_FOR_BLUE_ROW,
  EDGE_LANDING_BONUS,
  LIVES_ON_DEATH,
  LIVES_ON_LEVEL_UP,
  ROW_BONUS_POINTS,
} from '../constants';
import { getBalloonScore, getBonusJumpsForRowClear, getRowBonus } from '../scoring';

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
