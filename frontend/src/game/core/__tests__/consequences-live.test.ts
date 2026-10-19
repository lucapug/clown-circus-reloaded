import { describe, expect, it } from 'vitest';
import { GRAVITY, INITIAL_JUMP_VELOCITY, JUMP_VELOCITY_STEP, LANDING_Y, TICK_DURATION } from '../constants';
import { createConsequences } from '../consequences';
import type { GameEvent } from '../events';
import { advance, step } from '../engine';
import { createRng } from '../rng';
import { getBalloonScore, getRowBonus } from '../scoring';
import { createBalloonGrid, createInitialState } from '../state';
import type { Balloon, Clown, GameState } from '../types';

// Issue #7 AC-2/AC-3/AC-4: scoring asserted THROUGH the kernel — step() and
// advance() receive createConsequences() and stats come back changed. This is
// the anti-2025-defect proof (the tested module is the wired module, D4).
// Constructed states are allowed everywhere because kernel functions are pure
// (tick-order precedent); point values come from scoring.ts, never re-derived.
const consequences = createConsequences();

const playing = (overrides: Partial<GameState> = {}): GameState => ({
  ...createInitialState(),
  phase: 'playing',
  ...overrides,
});

const flying = (x: number, y: number, vx: number, vy: number): Clown => ({
  x,
  y,
  vx,
  vy,
  isFlying: true,
  isOnSeesaw: false,
  seesawSide: 'right',
  isOnDivingBoard: false,
  divingBoardIndex: null,
});

const seatedLeft = (x: number): Clown => ({
  x,
  y: LANDING_Y,
  vx: 0,
  vy: 0,
  isFlying: false,
  isOnSeesaw: true,
  seesawSide: 'left',
  isOnDivingBoard: false,
  divingBoardIndex: null,
});

const movedSeesaw = (x: number) => ({ ...createInitialState().seesaw, x });

/** Fresh grid with every balloon popped except `id`, relocated onto (x, y). */
const gridWithLastAt = (id: string, x: number, y: number): Balloon[] =>
  createBalloonGrid().map((b) => (b.id === id ? { ...b, x, y } : { ...b, popped: true }));

const eventTypes = (events: GameEvent[]): string[] => events.map((e) => e.type);

describe('live-path scoring through step/advance (spec §3.2–§3.3)', () => {
  it('scores a green row clear through step: pop + row bonus, bonusJumps unchanged (AC-3 green)', () => {
    // Row 1 (green) reduced to one balloon on the flying clown's
    // post-integration position; '3-13' stays unpopped so the level does NOT
    // complete; the seesaw is parked away so the clown simply keeps falling.
    const before = playing({
      balloons: createBalloonGrid().map((b) =>
        b.id === '1-0' ? { ...b, x: 440, y: LANDING_Y + GRAVITY } : b.id === '3-13' ? b : { ...b, popped: true },
      ),
      clowns: [flying(440, LANDING_Y, 0, 0), seatedLeft(370)],
      seesaw: movedSeesaw(100),
    });

    const { state, events } = step(before, [], createRng(1), consequences);

    expect(eventTypes(events)).toEqual(['balloon-popped', 'row-cleared']);
    expect(state.stats.score).toBe(getBalloonScore('green') + getRowBonus('green')); // 50 + 500
    expect(state.stats.bonusJumps).toBe(0); // green earns nothing (§3.3)
    expect(state.stats.lives).toBe(3);
    expect(state.level).toBe(1);
  });

  it('scores two pops in one tick plus a blue row bonus, earning a bonus jump (AC-3 blue)', () => {
    // Two blue row-0 balloons straddle the clown's post-integration position;
    // '3-13' keeps the level alive. Array order: later-in-space pops first.
    const laterInSpace: Balloon = { id: '0-1', x: 129, y: 100, color: 'blue', row: 0, popped: false };
    const earlierInSpace: Balloon = { id: '0-0', x: 80, y: 100, color: 'blue', row: 0, popped: false };
    const keeper: Balloon = { id: '3-13', x: 720, y: 180, color: 'yellow', row: 3, popped: false };
    const before = playing({
      balloons: [laterInSpace, earlierInSpace, keeper],
      clowns: [flying(105, 100, 0, 0), seatedLeft(370)],
    });

    const { state, events } = step(before, [], createRng(1), consequences);

    expect(eventTypes(events)).toEqual(['balloon-popped', 'balloon-popped', 'row-cleared']);
    expect(state.stats.score).toBe(2 * getBalloonScore('blue') + getRowBonus('blue')); // 200 + 1000
    expect(state.stats.bonusJumps).toBe(1); // blue row clear earns exactly +1
    expect(state.stats.lives).toBe(3);
  });

  it('scores landed-edge at +10 through step (board-bounced would score nothing)', () => {
    // The flyer lands on the right edge (seesaw at 400 → right edge [420,460])
    // and the seated clown chain-launches, exactly like the tick-order probe.
    const before = playing({
      balloons: [],
      clowns: [flying(440, LANDING_Y, 0, 0), seatedLeft(370)],
    });

    const { state, events } = step(before, [], createRng(11), consequences);

    expect(eventTypes(events)).toEqual(['landed-edge', 'launched']);
    expect(state.stats.score).toBe(10);
    expect(state.stats.bonusJumps).toBe(0);
    expect(state.stats.lives).toBe(3);
  });

  it('takes a life per death through advance, with the kernel velocity reset to −14', () => {
    // x = 400 under the default seesaw is the middle third → 'middle' death.
    // The jump velocity is pre-strengthened so the reset is observable; the
    // tick runs through advance() to prove the consequences wiring there too.
    const before = playing({
      balloons: [],
      clowns: [flying(400, LANDING_Y, 0, 0), seatedLeft(370)],
      currentJumpVelocity: INITIAL_JUMP_VELOCITY - JUMP_VELOCITY_STEP, // −14.2
    });
    const sim = { state: before, accumulator: 0 };

    const result = advance(sim, TICK_DURATION, createRng(7), consequences);

    expect(result.ticks).toBe(1);
    expect(eventTypes(result.events)).toEqual(['death']);
    expect(result.state.stats.lives).toBe(2); // 3 − 1
    expect(result.state.stats.score).toBe(0);
    expect(result.state.currentJumpVelocity).toBe(INITIAL_JUMP_VELOCITY); // kernel reset, −14
    expect(result.state.phase).toBe('playing'); // lives still above zero
  });

  it('grants +1 life, level+1 and a fresh 56-balloon grid on level-completed (AC-4)', () => {
    // The last blue balloon sits on the flyer's post-integration position; the
    // same tick also lands it on the right edge and chain-launches the seated
    // clown — a four-event fold in one tick.
    const before = playing({
      balloons: gridWithLastAt('0-0', 440, LANDING_Y + GRAVITY),
      clowns: [flying(440, LANDING_Y, 0, 0), seatedLeft(370)],
    });

    const { state, events } = step(before, [], createRng(11), consequences);

    expect(eventTypes(events)).toEqual(['balloon-popped', 'row-cleared', 'level-completed', 'landed-edge', 'launched']);
    expect(state.stats.score).toBe(getBalloonScore('blue') + getRowBonus('blue') + 10); // 100 + 1000 + 10
    expect(state.stats.bonusJumps).toBe(1);
    expect(state.stats.lives).toBe(4); // 3 + LIVES_ON_LEVEL_UP
    expect(state.level).toBe(2); // kernel, same tick
    expect(state.balloons).toHaveLength(56);
    expect(state.balloons.every((b) => !b.popped)).toBe(true);
  });

  it('nets ±0 lives on a same-tick level-up + death — both §3.5 rules fold sequentially', () => {
    // The last balloon pops AND the clown lands the middle third: the fold
    // applies level-completed (+1) and death (−1) to the same tick's stats.
    const before = playing({
      balloons: gridWithLastAt('0-0', 440, LANDING_Y + GRAVITY),
      clowns: [flying(440, LANDING_Y, 0, 0), seatedLeft(370)],
      seesaw: movedSeesaw(440), // x = 440 becomes the middle third → death
      stats: { score: 0, lives: 2, bonusJumps: 0 },
    });

    const { state, events } = step(before, [], createRng(11), consequences);

    expect(eventTypes(events)).toEqual(['balloon-popped', 'row-cleared', 'level-completed', 'death']);
    expect(state.stats.lives).toBe(2); // 2 + 1 − 1: spec-correct net zero
    expect(state.stats.score).toBe(getBalloonScore('blue') + getRowBonus('blue')); // no edge bonus
    expect(state.stats.bonusJumps).toBe(1);
    expect(state.level).toBe(2);
    expect(state.balloons).toHaveLength(56);
    expect(state.currentJumpVelocity).toBe(INITIAL_JUMP_VELOCITY);
    expect(state.phase).toBe('playing'); // 2 lives left: no game-over
  });
});
