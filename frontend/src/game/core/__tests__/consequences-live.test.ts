import { describe, expect, it } from 'vitest';
import { FALL_OFF_Y, GRAVITY, INITIAL_JUMP_VELOCITY, JUMP_VELOCITY_STEP, LANDING_Y, TICK_DURATION } from '../constants';
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
    expect(result.state.stats.bonusJumps).toBe(0); // §3.3 AC-2: never dips negative at jumps 0
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

  it('nets +1 life and a spent jump on a same-tick level-up + death — earn precedes spend in the fold', () => {
    // The last balloon pops AND the clown lands the middle third. Emission
    // order puts row-cleared (+1 earned jump, §3.3 EARNING) BEFORE the death,
    // so the death spends that same-tick jump: level-completed's +1 life is
    // never deducted back (issue #8 fold-order pin; 2026-10-15 decision A).
    const before = playing({
      balloons: gridWithLastAt('0-0', 440, LANDING_Y + GRAVITY),
      clowns: [flying(440, LANDING_Y, 0, 0), seatedLeft(370)],
      seesaw: movedSeesaw(440), // x = 440 becomes the middle third → death
      stats: { score: 0, lives: 2, bonusJumps: 0 },
    });

    const { state, events } = step(before, [], createRng(11), consequences);

    expect(eventTypes(events)).toEqual(['balloon-popped', 'row-cleared', 'level-completed', 'death']);
    expect(state.stats.lives).toBe(3); // 2 + 1: the death spends a jump, not this life
    expect(state.stats.score).toBe(getBalloonScore('blue') + getRowBonus('blue')); // no edge bonus
    expect(state.stats.bonusJumps).toBe(0); // earned by row-cleared, spent by the death
    expect(state.level).toBe(2);
    expect(state.balloons).toHaveLength(56);
    expect(state.currentJumpVelocity).toBe(INITIAL_JUMP_VELOCITY);
    expect(state.phase).toBe('playing'); // 3 lives left: no game-over
  });
});

// Issue #8 (spec §3.3 CONSUMPTION — 2026 design decision A, an explicit owner
// decision of 2026-10-15, NOT inferred 2025 intent): when a death would occur
// and bonusJumps > 0, one bonus jump is spent instead of one life; the death
// sequence itself is otherwise unchanged. Every slice runs THROUGH the kernel
// (step/advance + createConsequences(), D4) except the one marked unit seam,
// and consumption is per-event, in fold order (reviewer note on PR #18).
describe('bonusJumps consumption through step/advance (spec §3.3 decision A)', () => {
  it('spends one bonus jump instead of a life on death, with the kernel death sequence unchanged (AC-1)', () => {
    // x = 400 under the default seesaw is the middle third → 'middle' death;
    // the jump velocity is pre-strengthened so the −14 reset is observable.
    const before = playing({
      balloons: [],
      clowns: [flying(400, LANDING_Y, 0, 0), seatedLeft(370)],
      currentJumpVelocity: INITIAL_JUMP_VELOCITY - JUMP_VELOCITY_STEP, // −14.2
      stats: { score: 0, lives: 3, bonusJumps: 1 },
    });

    const { state, events } = step(before, [], createRng(7), consequences);

    expect(eventTypes(events)).toEqual(['death']);
    expect(events[0].type === 'death' && events[0].cause).toBe('middle');
    expect(state.stats.bonusJumps).toBe(0); // spent
    expect(state.stats.lives).toBe(3); // untouched
    expect(state.currentJumpVelocity).toBe(INITIAL_JUMP_VELOCITY); // kernel reset, −14
    expect(state.clowns[0].isOnDivingBoard).toBe(true); // dying clown replaced by a board clown
    expect(state.clowns[0].isFlying).toBe(false);
    expect(state.phase).toBe('playing');
  });

  it('unit seam: the fold alone spends one jump on a synthetic death event and leaves lives untouched', () => {
    const folded = consequences(playing({ stats: { score: 0, lives: 3, bonusJumps: 1 } }), [
      { type: 'death', clownIndex: 0, cause: 'fall-off' },
    ]);
    expect(folded.stats).toEqual({ score: 0, lives: 3, bonusJumps: 0 });
  });

  it('delays game-over: a jump-backed death keeps playing; the next death ends the game with game-over last', () => {
    // lives 1 + jumps 1: the first death spends the jump, so the engine's
    // step-8 game-over check (post-reducer, same tick) still sees lives 1.
    const first = step(
      playing({
        balloons: [],
        clowns: [flying(400, LANDING_Y, 0, 0), seatedLeft(370)],
        stats: { score: 0, lives: 1, bonusJumps: 1 },
      }),
      [],
      createRng(7),
      consequences,
    );
    expect(eventTypes(first.events)).toEqual(['death']); // no game-over event
    expect(first.state.stats.lives).toBe(1);
    expect(first.state.stats.bonusJumps).toBe(0);
    expect(first.state.phase).toBe('playing');

    // Carried forward, only the clowns replaced (§3.5 precedent): the second
    // death finds no jump → lives 0 → game-over, emitted LAST in the tick.
    const second = step(
      { ...first.state, clowns: [flying(400, LANDING_Y, 0, 0), seatedLeft(370)] },
      [],
      createRng(7),
      consequences,
    );
    expect(eventTypes(second.events)).toEqual(['death', 'game-over']);
    expect(second.state.stats.lives).toBe(0);
    expect(second.state.phase).toBe('gameover');
  });

  it('dead-end impossibility: a jump earned by a real tick is spent by the next death (AC-3, live path)', () => {
    // Earn: one real kernel tick pops the last two blue row-0 balloons
    // (keeper '3-13' keeps the level alive), folding row-cleared → +1 jump.
    const laterInSpace: Balloon = { id: '0-1', x: 129, y: 100, color: 'blue', row: 0, popped: false };
    const earlierInSpace: Balloon = { id: '0-0', x: 80, y: 100, color: 'blue', row: 0, popped: false };
    const keeper: Balloon = { id: '3-13', x: 720, y: 180, color: 'yellow', row: 3, popped: false };
    const earned = step(
      playing({ balloons: [laterInSpace, earlierInSpace, keeper], clowns: [flying(105, 100, 0, 0), seatedLeft(370)] }),
      [],
      createRng(1),
      consequences,
    );
    expect(eventTypes(earned.events)).toEqual(['balloon-popped', 'balloon-popped', 'row-cleared']);
    expect(earned.state.stats.bonusJumps).toBe(1); // blue row clear earned it
    expect(earned.state.stats.lives).toBe(3);

    // Spend: the carried state (stats intact, clowns replaced — §3.5 precedent)
    // meets a middle-third death; the SAME jump the fold earned is consumed.
    const spent = step(
      { ...earned.state, clowns: [flying(400, LANDING_Y, 0, 0), seatedLeft(370)] },
      [],
      createRng(7),
      consequences,
    );
    expect(eventTypes(spent.events)).toEqual(['death']);
    expect(spent.state.stats.bonusJumps).toBe(0); // the earned jump is gone
    expect(spent.state.stats.lives).toBe(3); // and no life was taken
  });

  it('fold order: two deaths in one tick spend per-event — two jumps absorb both, one does not', () => {
    // Two flying clowns die in the same tick (step 6 walks the clown array):
    // clown 0 hits the middle third, clown 1 is past FALL_OFF_Y. Emission
    // order: middle death first, fall-off second; each death evaluates the
    // RUNNING counters, not the tick-start stats (reviewer note on PR #18).
    const twoDeaths = (bonusJumps: number): GameState =>
      playing({
        balloons: [],
        clowns: [flying(400, LANDING_Y, 0, 0), flying(200, FALL_OFF_Y, 0, 0)],
        stats: { score: 0, lives: 3, bonusJumps },
      });

    const bothSpent = step(twoDeaths(2), [], createRng(7), consequences);
    expect(eventTypes(bothSpent.events)).toEqual(['death', 'death']);
    expect(bothSpent.events[0].type === 'death' && bothSpent.events[0].cause).toBe('middle');
    expect(bothSpent.events[1].type === 'death' && bothSpent.events[1].cause).toBe('fall-off');
    expect(bothSpent.state.stats.bonusJumps).toBe(0); // 2 − 1 − 1
    expect(bothSpent.state.stats.lives).toBe(3); // unchanged

    const oneSpent = step(twoDeaths(1), [], createRng(7), consequences);
    expect(oneSpent.state.stats.bonusJumps).toBe(0); // first death spends it
    expect(oneSpent.state.stats.lives).toBe(2); // second death takes a life
  });
});

// Issue #7 AC-5: the spec §3.5 scripted scenario, headless and deterministic
// (seeded RNG), entirely through step() with createConsequences(). The §3.5
// start state (3 lives, level 1, score 0, phase 'playing') is the ONLY
// constructed stats write; afterwards stats and level flow from step result
// to step result — each segment's state is a spread of the previous one with
// only the clowns replaced (kernel purity, tick-order precedent).
describe('spec §3.5 scripted end-to-end scenario (headless)', () => {
  it('levels up at 3 lives (+1), spends the earned jump on the first death, then four lethal deaths end the game', () => {
    const rng = createRng(2026);
    const run = (state: GameState) => step(state, [], rng, consequences);

    // §3.5 start state.
    const start = playing(); // 3 lives, level 1, score 0, bonusJumps 0

    // (i) 55/56 pre-popped; the LAST blue balloon sits on the flying clown's
    // post-integration position (construction of the tick-order level probe):
    // one tick = pop + blue row clear + level-completed + edge landing +
    // chain launch. Score earns pop and row bonus; a life is gained.
    const i = run({
      ...start,
      balloons: gridWithLastAt('0-0', 440, LANDING_Y + GRAVITY),
      clowns: [flying(440, LANDING_Y, 0, 0), seatedLeft(370)],
    });
    expect(eventTypes(i.events)).toEqual(['balloon-popped', 'row-cleared', 'level-completed', 'landed-edge', 'launched']);
    expect(i.state.stats.score).toBe(getBalloonScore('blue') + getRowBonus('blue') + 10); // 1110
    expect(i.state.stats.bonusJumps).toBe(1); // blue row clear earned it
    expect(i.state.stats.lives).toBe(4); // 3 + 1
    expect(i.state.level).toBe(2);
    expect(i.state.balloons).toHaveLength(56);
    expect(i.state.balloons.every((b) => !b.popped)).toBe(true);
    expect(i.state.phase).toBe('playing');

    // (ii) five death segments — middle (jump-absorbed), occupied-edge,
    // fall-off, middle, middle again — carrying score/bonusJumps/level
    // forward through real steps. Balloons (fresh grid, y ≤ 180) are never
    // near the constructed descent paths, so no pops interfere.

    // Segment 1: middle third under the default seesaw (x = 400) — the death
    // SPENDS the segment-(i) bonus jump instead of a life (§3.3 decision A).
    const d1 = run({ ...i.state, clowns: [flying(400, LANDING_Y, 0, 0), seatedLeft(370)] });
    expect(eventTypes(d1.events)).toEqual(['death']);
    expect(d1.state.stats.lives).toBe(4); // jump spent, life kept
    expect(d1.state.stats.bonusJumps).toBe(0); // the earned jump is gone
    expect(d1.state.currentJumpVelocity).toBe(INITIAL_JUMP_VELOCITY); // reset from −14.2

    // Segment 2: left edge occupied by the seated clown — no jump left, so
    // the 2025 rule applies.
    const d2 = run({ ...d1.state, clowns: [seatedLeft(370), flying(380, LANDING_Y, 0, 0)] });
    expect(eventTypes(d2.events)).toEqual(['death']);
    expect(d2.events[0].type === 'death' && d2.events[0].cause).toBe('occupied-edge');
    expect(d2.state.stats.lives).toBe(3);
    expect(d2.state.currentJumpVelocity).toBe(INITIAL_JUMP_VELOCITY);

    // Segment 3: fall-off past the death line (x = 200 misses the seesaw).
    const d3 = run({ ...d2.state, clowns: [seatedLeft(370), flying(200, 650, 0, 0)] });
    expect(eventTypes(d3.events)).toEqual(['death']);
    expect(d3.events[0].type === 'death' && d3.events[0].cause).toBe('fall-off');
    expect(d3.state.stats.lives).toBe(2);
    expect(d3.state.currentJumpVelocity).toBe(INITIAL_JUMP_VELOCITY);

    // Segment 4: another middle-third death — lethal at jumps 0, but one life
    // remains, so NO game-over fires yet (the d1 consumption bought a tick).
    const d4 = run({ ...d3.state, clowns: [flying(400, LANDING_Y, 0, 0), seatedLeft(370)] });
    expect(eventTypes(d4.events)).toEqual(['death']); // no game-over event
    expect(d4.state.stats.lives).toBe(1);
    expect(d4.state.phase).toBe('playing');

    // (iii) Final tick: the fifth death reaches 0 lives and the kernel's
    // once-guard transitions the phase with 'game-over' emitted LAST.
    const d5 = run({ ...d4.state, clowns: [flying(400, LANDING_Y, 0, 0), seatedLeft(370)] });
    expect(eventTypes(d5.events)).toEqual(['death', 'game-over']); // game-over last in the tick
    expect(d5.events[0].type === 'death' && d5.events[0].cause).toBe('middle');
    expect(d5.state.stats.lives).toBe(0);
    expect(d5.state.phase).toBe('gameover');
    // Carried through all five deaths: score and level from segment (i); the
    // earned jump was spent at d1 (§3.3 consumption, issue #8).
    expect(d5.state.stats.score).toBe(getBalloonScore('blue') + getRowBonus('blue') + 10);
    expect(d5.state.stats.bonusJumps).toBe(0);
    expect(d5.state.level).toBe(2);
  });
});
