import { describe, expect, it } from 'vitest';
import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  BALLOON_GRID_X_END,
  BALLOON_GRID_X_START,
  BALLOON_GRID_X_STEP,
  BALLOON_GRID_Y_TOP,
  BALLOON_RADIUS,
  BALLOON_ROW_COLORS,
  BALLOON_ROW_SPACING,
  BALLOON_ROWS,
  BALLOONS_PER_ROW,
  BONUS_JUMPS_ON_DEATH,
  BOARD_DAMPING,
  BOARD_HEIGHT,
  BOARD_LAUNCH_VX,
  BOARD_LAUNCH_VY,
  BOARD_RECT_LEFT_X,
  BOARD_RECT_RIGHT_X,
  BOARD_WIDTH,
  COLLISION_DISTANCE,
  CLOWN_SIZE,
  DIVING_BOARDS,
  EDGE_WIDTH,
  FALL_OFF_Y,
  GRAVITY,
  INITIAL_JUMP_VELOCITY,
  JUMP_VELOCITY_STEP,
  LANDING_Y,
  LEVEL_MULT_STEP,
  MAX_JUMP_VELOCITY,
  RESPAWN_BOARD_HEIGHT_INDEX,
  SEAT_OFFSET,
  SEESAW_CLAMP_MAX,
  SEESAW_CLAMP_MIN,
  SEESAW_WIDTH,
  SEESAW_Y,
  TICK_DURATION,
  WALL_DAMPING,
  WALL_X_MAX,
  WALL_X_MIN,
  levelMultiplier,
} from '../constants';
import { advance } from '../engine';
import { createRng } from '../rng';
import { boardRect, createInitialState } from '../state';

// Issue #6 AC 4: every §3.1/§3.4 value asserted as a pinned literal against the
// single source of truth — never re-derived in the tests.
describe('core constants (spec §3.1/§3.4 pinned values)', () => {
  it('pins the canonical tick and arena size', () => {
    expect(TICK_DURATION).toBe(1 / 60);
    expect(ARENA_WIDTH).toBe(800);
    expect(ARENA_HEIGHT).toBe(600);
  });

  it('pins the physics constants', () => {
    expect(GRAVITY).toBe(0.3);
    expect(WALL_DAMPING).toBe(0.8);
    expect(BOARD_DAMPING).toBe(0.9);
    expect(COLLISION_DISTANCE).toBe(40);
    expect(CLOWN_SIZE).toBe(24);
    expect(BALLOON_RADIUS).toBe(16);
    expect(WALL_X_MIN).toBe(24);
    expect(WALL_X_MAX).toBe(776);
  });

  it('pins the seesaw geometry', () => {
    expect(SEESAW_WIDTH).toBe(120);
    expect(SEESAW_Y).toBe(520);
    expect(SEESAW_CLAMP_MIN).toBe(60);
    expect(SEESAW_CLAMP_MAX).toBe(740);
    expect(LANDING_Y).toBe(496);
    expect(EDGE_WIDTH).toBe(40);
    expect(SEAT_OFFSET).toBe(30);
    expect(FALL_OFF_Y).toBe(650);
  });

  it('pins the four diving boards and their collision rects', () => {
    expect(DIVING_BOARDS.map((b) => [b.x, b.y, b.side])).toEqual([
      [40, 250, 'left'],
      [40, 350, 'left'],
      [760, 250, 'right'],
      [760, 350, 'right'],
    ]);
    for (const board of DIVING_BOARDS) {
      const rect = boardRect(board);
      expect(rect.x).toBe(board.side === 'left' ? 22 : 708);
      expect(rect.x).toBe(board.side === 'left' ? BOARD_RECT_LEFT_X : BOARD_RECT_RIGHT_X);
      expect(rect.width).toBe(70);
      expect(rect.width).toBe(BOARD_WIDTH);
      expect(rect.height).toBe(10);
      expect(rect.height).toBe(BOARD_HEIGHT);
      expect(rect.y).toBe(board.y - BOARD_HEIGHT / 2);
      expect([245, 345]).toContain(rect.y);
    }
  });

  it('pins the balloon grid', () => {
    expect(BALLOON_ROWS).toBe(4);
    expect(BALLOONS_PER_ROW).toBe(14);
    expect([...BALLOON_ROW_COLORS]).toEqual(['blue', 'green', 'green', 'yellow']);
    expect(BALLOON_GRID_Y_TOP).toBe(60);
    expect(BALLOON_ROW_SPACING).toBe(40);
    expect(BALLOON_GRID_X_START).toBe(80);
    expect(BALLOON_GRID_X_END).toBe(720);
    expect(BALLOON_GRID_X_STEP).toBe((720 - 80) / 13);
  });

  it('pins the launch velocities and progression', () => {
    expect(INITIAL_JUMP_VELOCITY).toBe(-14);
    expect(MAX_JUMP_VELOCITY).toBe(-17);
    expect(JUMP_VELOCITY_STEP).toBe(0.2);
    expect(BOARD_LAUNCH_VY).toBe(2);
    expect(BOARD_LAUNCH_VX).toBe(3);
    expect(LEVEL_MULT_STEP).toBe(0.25);
    expect(levelMultiplier(1)).toBe(1);
    expect(levelMultiplier(3)).toBe(1.5);
  });

  it('pins the interim entry-trampoline height default (owner decision still open on the height)', () => {
    // Only the HEIGHT default is pinned here (0 = high board, y=250). The
    // entry SIDE is the free end of the seesaw and is asserted by the
    // tick-order death tests, never by height.
    expect(RESPAWN_BOARD_HEIGHT_INDEX).toBe(0);
  });

  it('pins the §3.3 death-consumption rate: one bonus jump spent per death (2026 design decision A)', () => {
    // An explicit owner decision of 2026-10-15 (issue #8), NOT inferred 2025
    // intent: a death with bonusJumps > 0 spends exactly one jump instead of
    // one life.
    expect(BONUS_JUMPS_ON_DEATH).toBe(1);
  });

  it('decouples the accumulator: dt = 1/30 runs exactly 2 ticks', () => {
    const state = { ...createInitialState(), phase: 'playing' as const };
    const sim = { state, accumulator: 0 };
    const result = advance(sim, 1 / 30, createRng(7));
    expect(result.ticks).toBe(2);
    expect(sim.accumulator).toBe(0);
  });

  it('caps advance at 600 ticks per call and discards the excess (spiral-of-death guard)', () => {
    const state = { ...createInitialState(), phase: 'playing' as const };
    const sim = { state, accumulator: 0 };
    const result = advance(sim, 12.5, createRng(7));
    expect(result.ticks).toBe(600);
    expect(sim.accumulator).toBe(0);
  });
});
