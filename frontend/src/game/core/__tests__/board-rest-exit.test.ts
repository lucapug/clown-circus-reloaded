import { describe, expect, it } from 'vitest';
import {
  BOARD_DAMPING,
  BOARD_HEIGHT,
  BOARD_LAUNCH_VY,
  BOARD_RECT_LEFT_X,
  BOARD_WIDTH,
  CLOWN_SIZE,
  DIVING_BOARDS,
  GRAVITY,
} from '../constants';
import { isDeathEvent, type GameEvent } from '../events';
import { step } from '../engine';
import { createRng } from '../rng';
import { playing } from './golden-scenarios';
import type { Clown, GameState } from '../types';

// Issue #57: a boarded clown whose bounce decays into micro-bounces used to
// bounce forever at |vx| ≈ 0 — the stranding/storm this file pins the fix
// against (rest-exit gate + minimum slide). BOARD_REST_VY and
// BOARD_MIN_SLIDE_VX are added to constants.ts WITH the fix; the two values
// are mirrored as commented literals here so this file is behavior-red on
// main (stranding/storm), not import-red.
const REST_VY = 0.5; // mirrors BOARD_REST_VY
const MIN_SLIDE_VX = 0.5; // mirrors BOARD_MIN_SLIDE_VX

// Upper-left diving board (DIVING_BOARDS[0], side 'left'): rect x ∈
// [BOARD_RECT_LEFT_X, BOARD_RECT_LEFT_X + BOARD_WIDTH] = [22, 92]; boardY =
// board.y − BOARD_HEIGHT / 2 = 245 and the board-top pin at
// boardY − CLOWN_SIZE = 221.
const BOARD = DIVING_BOARDS[0];
const BOARD_Y = BOARD.y - BOARD_HEIGHT / 2; // 245
const PIN_Y = BOARD_Y - CLOWN_SIZE; // 221 — the board-top rest position
const BOARD_RIGHT = BOARD_RECT_LEFT_X + BOARD_WIDTH; // 92

const flyer = (x: number, y: number, vx: number, vy: number): Clown => ({
  x,
  y,
  vx,
  vy,
  isFlying: true,
  isOnSeesaw: false,
  seesawSide: 'left',
  isOnDivingBoard: false,
  divingBoardIndex: null,
});

const startWith = (clown: Clown): GameState => playing({ balloons: [], clowns: [clown] });

describe('boarded-clown rest-exit and minimum slide (issue #57)', () => {
  it('boarded clown with vx = 0 cannot strand: slide regime crosses the board and the clown falls off', () => {
    // Sub-threshold by construction: (0.2 + GRAVITY) * BOARD_DAMPING = 0.45
    // < REST_VY — the very first tick enters the slide regime. x = 24 is the
    // discrimination point: the board-side launch rule gives +1; a "nearest
    // end" rule would give −1 (the left board's edge is 2 px away).
    let state = startWith(flyer(BOARD_RECT_LEFT_X + 2, PIN_Y, 0, 0.2));
    const rng = createRng(1);
    const events: GameEvent[] = [];
    const advance = (): void => {
      const result = step(state, [], rng);
      state = result.state;
      events.push(...result.events);
    };

    // First slide tick: vx floored to +MIN_SLIDE_VX (left board ⇒ +1), vy
    // zeroed, y pinned to the board top — and NO board-bounced event.
    advance();
    expect(state.clowns[0].vx).toBe(MIN_SLIDE_VX);
    expect(state.clowns[0].vy).toBe(0);
    expect(state.clowns[0].y).toBe(PIN_Y);
    expect(events.some((e) => e.type === 'board-bounced')).toBe(false);

    // Slide across the board: while the post-integration x stays inside the
    // board rect, x advances exactly MIN_SLIDE_VX per tick with vy = 0 and y
    // pinned, every tick. (Gravity re-adds 0.3 each tick; 0.3 * 0.9 = 0.27
    // < REST_VY re-fires the sub-threshold branch — the branch IS the
    // regime, no state flag.)
    let slideTicks = 1;
    while (state.clowns[0].x + MIN_SLIDE_VX <= BOARD_RIGHT) {
      const before = state.clowns[0].x;
      advance();
      slideTicks++;
      expect(state.clowns[0].vx).toBe(MIN_SLIDE_VX);
      expect(state.clowns[0].vy).toBe(0);
      expect(state.clowns[0].y).toBe(PIN_Y);
      expect(state.clowns[0].x).toBe(before + MIN_SLIDE_VX);
    }
    // Pinned: the first slide tick ends at x = 24 (vx is floored AFTER
    // integration, so the advance starts the next tick), then +0.5/tick to
    // x = 92 — 137 slide ticks (≤ the ~140-tick bound).
    expect(slideTicks).toBe(137);

    // Exit tick: x leaves the board rect; the board block no longer matches,
    // gravity resumes (vy = 0.3) and the clown falls.
    advance();
    expect(state.clowns[0].x).toBe(BOARD_RIGHT + MIN_SLIDE_VX);
    expect(state.clowns[0].vy).toBe(GRAVITY);
    expect(state.clowns[0].y).toBe(PIN_Y + GRAVITY);

    // Deterministic end state: the exit x (~92) is far left of the seesaw
    // landing gate ([340, 460] at the initial seesaw.x = 400), so the clown
    // falls past FALL_OFF_Y — a fall-off death, bounded (136 slide ticks +
    // the pinned fall below; the old behavior stranded here forever).
    let totalTicks = 138;
    while (!events.some(isDeathEvent)) {
      advance();
      totalTicks++;
      expect(totalTicks).toBeLessThanOrEqual(140 + 1400);
    }
    const death = events.find(isDeathEvent);
    expect(death?.cause).toBe('fall-off');
    expect(totalTicks).toBe(190); // pinned observed death tick
  });

  it('board-bounced events from a BOARD_LAUNCH_VY landing are finite and bounded; after the last bounce the clown is in the slide regime', () => {
    // Launched straight down onto the upper-left board at the pin position,
    // vx = 0 (the stranding input). Bounces are bounded: each flight is
    // shorter than the last, so the gravity gain per flight shrinks and the
    // arrival vy decays below the rest threshold in a handful of bounces —
    // the naive ceil(log(0.5 / 2.3) / log(0.9)) ≈ 15 overestimates (it
    // assumes constant-length flights). Observed count pinned below, versus
    // the old decay-forever storm (~60 events/s sustained).
    let state = startWith(flyer(40, PIN_Y, 0, BOARD_LAUNCH_VY));
    const rng = createRng(1);
    const eventsAt: GameEvent[][] = [];
    const statesAt: GameState[] = [];
    for (let tick = 1; tick <= 300; tick++) {
      const result = step(state, [], rng);
      state = result.state;
      eventsAt.push(result.events);
      statesAt.push(state);
    }

    const bounceTicks = eventsAt
      .map((evts, idx) => (evts.some((e) => e.type === 'board-bounced') ? idx + 1 : 0))
      .filter((t) => t > 0);
    // Bounded: exact deterministic count pinned (arithmetic above; fallback
    // bound 1–20 per the issue analysis).
    expect(bounceTicks.length).toBe(7);
    expect(bounceTicks.length).toBeGreaterThanOrEqual(1);
    expect(bounceTicks.length).toBeLessThanOrEqual(20);

    // Zero board-bounced events after the last one, for the whole run (the
    // old behavior bounced forever — hundreds of events over 300 ticks).
    const lastBounceTick = bounceTicks[bounceTicks.length - 1];
    expect(lastBounceTick).toBeLessThan(100);
    for (let tick = lastBounceTick + 1; tick <= 300; tick++) {
      expect(eventsAt[tick - 1].some((e) => e.type === 'board-bounced')).toBe(false);
    }

    // Post-rest state: within a few ticks of the last bounce the run enters
    // the slide regime — every tick from there until the board x-range is
    // exited ends with vy = 0, y pinned to the board top, and x advancing
    // exactly MIN_SLIDE_VX per tick (asserted on the recorded per-tick
    // states, so the slide window is fully covered, not spot-checked).
    let slideStart = 0;
    for (let tick = lastBounceTick + 1; tick <= lastBounceTick + 8; tick++) {
      const clown = statesAt[tick - 1].clowns[0];
      if (clown.vy === 0 && clown.y === PIN_Y) {
        slideStart = tick;
        break;
      }
    }
    expect(slideStart).toBeGreaterThan(0);
    for (let tick = slideStart; tick <= 300; tick++) {
      const clown = statesAt[tick - 1].clowns[0];
      if (clown.x > BOARD_RIGHT) break; // board exited → free fall (test 1's scope)
      expect(clown.vx).toBe(MIN_SLIDE_VX);
      expect(clown.vy).toBe(0);
      expect(clown.y).toBe(PIN_Y);
      if (tick > slideStart) {
        expect(clown.x).toBe(statesAt[tick - 2].clowns[0].x + MIN_SLIDE_VX);
      }
    }
  });
});
