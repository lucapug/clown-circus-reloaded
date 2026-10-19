import { describe, expect, it } from 'vitest';
import {
  BOARD_DAMPING,
  BOARD_LAUNCH_VX,
  BOARD_LAUNCH_VY,
  CLOWN_SIZE,
  GRAVITY,
  INITIAL_JUMP_VELOCITY,
  JUMP_VELOCITY_STEP,
  LANDING_Y,
  SEAT_OFFSET,
  WALL_X_MIN,
  levelMultiplier,
} from '../constants';
import type { GameEvent } from '../events';
import { nullConsequences, step } from '../engine';
import { createRng } from '../rng';
import { createBalloonGrid, createInitialState } from '../state';
import type { Balloon, Clown, ConsequenceReducer, GameState } from '../types';

// Issue #6 AC 3: the pinned §3 tick order, asserted observably. Constructed
// states are allowed everywhere because kernel functions are pure.
const playing = (overrides: Partial<GameState> = {}): GameState => ({
  ...createInitialState(),
  phase: 'playing',
  ...overrides,
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

const seatedRight = (x: number): Clown => ({
  x,
  y: LANDING_Y,
  vx: 0,
  vy: 0,
  isFlying: false,
  isOnSeesaw: true,
  seesawSide: 'right',
  isOnDivingBoard: false,
  divingBoardIndex: null,
});

const expectEvent = <T extends GameEvent['type']>(events: GameEvent[], type: T): Extract<GameEvent, { type: T }> => {
  const event = events.find((e) => e.type === type);
  if (!event || event.type !== type) throw new Error(`expected a '${type}' event, got: ${events.map((e) => e.type).join(', ')}`);
  return event as Extract<GameEvent, { type: T }>;
};

// The #6/#7 seam probe: a trivial ConsequenceReducer that spends one life per
// death event (in the shipped kernel this is #7's job, not the kernel's).
const spendLifeOnDeath: ConsequenceReducer = (state, events) =>
  events.some((e) => e.type === 'death') ? { ...state, stats: { ...state.stats, lives: state.stats.lives - 1 } } : state;

describe('pinned tick order (spec §3)', () => {
  it('applies gravity before integration (semi-implicit Euler: vy += G before y += vy)', () => {
    const { state } = step(
      playing({ balloons: [], clowns: [flying(400, 300, 0, 0), seatedLeft(370)] }),
      [],
      createRng(1),
    );
    const c = state.clowns[0];
    expect(c.vy).toBe(GRAVITY);
    expect(c.y).toBe(300 + GRAVITY); // exactly one gravity step, not zero
  });

  it('clamps at the wall before the diving-board bounce check', () => {
    // Integrates to x = 20 (outside the left board rect [22, 92]); the wall
    // clamp must move it to 24 BEFORE the board check, so it still bounces.
    const { state } = step(
      playing({ balloons: [], clowns: [flying(21, 250, -1, 0), seatedLeft(370)] }),
      [],
      createRng(1),
    );
    const c = state.clowns[0];
    expect(c.x).toBe(WALL_X_MIN);
    expect(c.y).toBe(245 - CLOWN_SIZE); // bounced off the upper-left board (boardY = 250 - 5)
    expect(c.vy).toBe(-(GRAVITY * BOARD_DAMPING));
  });

  it('bounces on diving boards before balloon collision (pop reflects the post-bounce position)', () => {
    // Pre-bounce the clown is 60.3px from the balloon (> 40); post-bounce (y = 321) it is 31px (< 40).
    const balloon: Balloon = { id: 't', x: 740, y: 290, color: 'yellow', row: 3, popped: false };
    const { state, events } = step(
      playing({ balloons: [balloon], clowns: [flying(740, 350, 0, 0), seatedLeft(370)] }),
      [],
      createRng(1),
    );
    expect(state.clowns[0].y).toBe(345 - CLOWN_SIZE); // bounced off the lower-right board first
    expect(events.some((e) => e.type === 'balloon-popped')).toBe(true);
  });

  it('pops balloons in balloon-array order, several per clown per tick', () => {
    // Array order is deliberately reversed relative to spatial order.
    const laterInSpace: Balloon = { id: '0-1', x: 129, y: 100, color: 'green', row: 0, popped: false };
    const earlierInSpace: Balloon = { id: '0-0', x: 80, y: 100, color: 'blue', row: 0, popped: false };
    const { events } = step(
      playing({ balloons: [laterInSpace, earlierInSpace], clowns: [flying(105, 100, 0, 0), seatedLeft(370)] }),
      [],
      createRng(1),
    );
    const poppedIds = events.flatMap((e) => (e.type === 'balloon-popped' ? [e.balloonId] : []));
    expect(poppedIds).toEqual(['0-1', '0-0']);
  });

  it('checks level completion before seesaw landing, then chain-launches with the strengthened velocity', () => {
    // One unpopped balloon sits exactly on the flying clown's post-integration
    // position; the clown also crosses the right-edge landing gate this tick.
    const balloons: Balloon[] = createBalloonGrid().map((b) =>
      b.id === '0-0' ? { ...b, x: 440, y: LANDING_Y + GRAVITY } : { ...b, popped: true },
    );
    const before = playing({
      balloons,
      clowns: [flying(440, LANDING_Y, 0, 0), seatedLeft(370)],
      currentJumpVelocity: INITIAL_JUMP_VELOCITY,
    });
    const { state, events } = step(before, [], createRng(11));

    expect(events.map((e) => e.type)).toEqual([
      'balloon-popped',
      'row-cleared',
      'level-completed',
      'landed-edge',
      'launched',
    ]);
    const landed = expectEvent(events, 'landed-edge');
    expect(landed.clownIndex).toBe(0);
    expect(landed.side).toBe('right');
    const chain = expectEvent(events, 'launched');
    expect(chain.via).toBe('chain');
    expect(chain.clownIndex).toBe(1);
    expect(chain.vy).toBe(INITIAL_JUMP_VELOCITY - JUMP_VELOCITY_STEP); // −14.2, post-strengthening

    expect(state.level).toBe(2); // regeneration happened inside the same tick
    expect(state.balloons).toHaveLength(56);
    expect(state.balloons.every((b) => !b.popped)).toBe(true);
    const lander = state.clowns[0];
    expect(lander.isFlying).toBe(false);
    expect(lander.isOnSeesaw).toBe(true);
    expect(lander.seesawSide).toBe('right');
    expect(lander.x).toBe(400 + SEAT_OFFSET);
    expect(lander.y).toBe(LANDING_Y);
    expect(lander.vx).toBe(0);
    expect(lander.vy).toBe(0);
    expect(state.clowns[1].isFlying).toBe(true);
    expect(state.currentJumpVelocity).toBe(INITIAL_JUMP_VELOCITY - JUMP_VELOCITY_STEP);
    expect(state.seesaw.tilt).toBe('right'); // tilt is computed last: the lander stays seated on the right
  });

  it('decides game-over after the consequence reducer, emitting it last, with tilt from the final clowns', () => {
    const before = playing({
      balloons: [],
      clowns: [flying(400, LANDING_Y, 0, 0), seatedLeft(370)],
      stats: { score: 0, lives: 1, bonusJumps: 0 },
    });
    const { state, events } = step(before, [], createRng(1), spendLifeOnDeath);

    expect(events.map((e) => e.type)).toEqual(['death', 'game-over']); // game-over is last in the tick
    const death = expectEvent(events, 'death');
    expect(death.cause).toBe('middle');
    expect(state.phase).toBe('gameover');
    expect(state.stats.lives).toBe(0); // the reducer ran before the game-over check
    expect(state.currentJumpVelocity).toBe(INITIAL_JUMP_VELOCITY);
    expect(state.clowns[0]).toMatchObject({ isOnDivingBoard: true, divingBoardIndex: 2, x: 740, y: 222 }); // issue #19: seated-left survivor → right pair
    expect(state.seesaw.tilt).toBe('left'); // one seated clown remains, on the left
  });

  it('drains the input queue at the tick boundary, before gravity', () => {
    // Initial state: clowns[1] sits on the upper-right board (740, 222).
    const { state, events } = step(playing({ balloons: [] }), [{ type: 'launch' }], createRng(1));
    // Launch, then this same tick's board bounce as the clown leaves the board.
    expect(events.map((e) => e.type)).toEqual(['launched', 'board-bounced']);
    const launched = expectEvent(events, 'launched');
    expect(launched.clownIndex).toBe(1);
    expect(launched.via).toBe('input');
    expect(launched.vy).toBe(BOARD_LAUNCH_VY); // payload captured before gravity
    expect(launched.vx).toBe(-BOARD_LAUNCH_VX); // right board → toward center
    const c = state.clowns[1];
    expect(c.isFlying).toBe(true);
    // The launch (vy = 2) is followed by gravity (vy = 2.3) and then the board
    // bounce of this same tick (0.9 damping), all visible in one stepped state.
    expect(c.vy).toBe(-((BOARD_LAUNCH_VY + GRAVITY) * BOARD_DAMPING));
    expect(c.y).toBe(221);
    expect(c.x).toBe(740 - BOARD_LAUNCH_VX);
  });

  it('applies move-seesaw at the tick boundary and re-seats seated clowns', () => {
    const { state } = step(playing({ balloons: [] }), [{ type: 'move-seesaw', x: 500 }], createRng(1));
    expect(state.seesaw.x).toBe(500);
    expect(state.clowns[0].x).toBe(500 - SEAT_OFFSET);
  });

  it('clamps move-seesaw x to [60, 740]', () => {
    const high = step(playing({ balloons: [] }), [{ type: 'move-seesaw', x: 5000 }], createRng(1));
    expect(high.state.seesaw.x).toBe(740);
    const low = step(playing({ balloons: [] }), [{ type: 'move-seesaw', x: -3 }], createRng(1));
    expect(low.state.seesaw.x).toBe(60);
  });

  it('consumes exactly one rng draw per seated launch, in clown-array order', () => {
    const firstDraw = createRng(123).next();
    const probe = createRng(123);
    probe.next();
    const secondDraw = probe.next();

    const before = playing({ balloons: [], clowns: [seatedLeft(370), seatedRight(430)] });
    const rng = createRng(123);
    const { events } = step(before, [{ type: 'launch' }], rng);
    const launched = expectEvent(events, 'launched');
    expect(launched.clownIndex).toBe(0);
    expect(launched.vx).toBe((firstDraw - 0.5) * 4 * levelMultiplier(1));
    expect(launched.vy).toBe(INITIAL_JUMP_VELOCITY);
    expect(rng.next()).toBe(secondDraw); // the stream advanced by exactly one draw
  });

  it('launches a diving-board clown before any seated clown', () => {
    const before = playing({
      balloons: [],
      clowns: [seatedLeft(370), { ...flying(0, 0, 0, 0), isFlying: false, isOnDivingBoard: true, isOnSeesaw: false, divingBoardIndex: 0, x: 60, y: 222 }],
    });
    const { events } = step(before, [{ type: 'launch' }], createRng(1));
    expect(expectEvent(events, 'launched').clownIndex).toBe(1);
  });

  it('kills a clown landing in the middle third and respawns it on the FREE side (issue #19 unified rule)', () => {
    const { state, events } = step(
      playing({ balloons: [], clowns: [flying(400, LANDING_Y, 0, 0), seatedLeft(370)] }),
      [],
      createRng(1),
    );
    const death = expectEvent(events, 'death');
    expect(death.cause).toBe('middle');
    expect(death.clownIndex).toBe(0);
    // Issue #19 (owner decision 2026-10-19): entry side = opposite the SEATED
    // clown (survivor left → right pair). The dying clown's stale seesawSide
    // ('right', the flying() default) must be ignored — the old per-clown
    // derivation (freeSideOf(clown.seesawSide)) sent the entrant to the left
    // pair (board 0, x 60).
    expect([2, 3]).toContain(state.clowns[0].divingBoardIndex); // right-side pair
    expect(state.clowns[0].x).toBe(740);
    expect(state.clowns[0].isOnDivingBoard).toBe(true);
    expect(state.currentJumpVelocity).toBe(INITIAL_JUMP_VELOCITY);
  });

  it('kills a clown landing on the occupied edge and respawns it on the FREE side, not back at the occupier (issue #19)', () => {
    const { state, events } = step(
      playing({ balloons: [], clowns: [seatedLeft(370), flying(380, LANDING_Y, 0, 0)] }),
      [],
      createRng(1),
    );
    const death = expectEvent(events, 'death');
    expect(death.cause).toBe('occupied-edge');
    expect(death.clownIndex).toBe(1);
    // Issue #19 (owner decision 2026-10-19): entry side = opposite the seated
    // occupier (left → right pair). The old per-clown derivation read the
    // dying clown's stale seesawSide ('right' → free 'left'), re-sending the
    // entrant straight back to the occupier's side (board 0, x 60).
    expect([2, 3]).toContain(state.clowns[1].divingBoardIndex); // right-side pair
    expect(state.clowns[1].x).toBe(740);
    expect(state.clowns[1].isOnDivingBoard).toBe(true);
  });

  it('sends a fall-off death to the board on the FREE side (seated left → right entry)', () => {
    // Owner rule (issue #6 comment 6252402875): entry side = free end of the
    // seesaw, derived from gameplay state — the 2025 always-right hardcode is
    // overridden. Assertions are side-based, never height-based.
    const { state, events } = step(
      playing({ balloons: [], clowns: [flying(200, 650, 0, 0), seatedLeft(370)] }),
      [],
      createRng(1),
    );
    const death = expectEvent(events, 'death');
    expect(death.cause).toBe('fall-off');
    expect([2, 3]).toContain(state.clowns[0].divingBoardIndex); // right-side pair
    expect(state.clowns[0].x).toBe(740);
    expect(state.clowns[0].isOnDivingBoard).toBe(true);
  });

  it('sends a fall-off death to the LEFT side when the seated clown is on the right (free-side rule)', () => {
    const { state, events } = step(
      playing({ balloons: [], clowns: [flying(200, 650, 0, 0, 'right'), seatedRight(430)] }),
      [],
      createRng(1),
    );
    const death = expectEvent(events, 'death');
    expect(death.cause).toBe('fall-off');
    expect([0, 1]).toContain(state.clowns[0].divingBoardIndex); // left-side pair
    expect(state.clowns[0].x).toBe(60);
    expect(state.clowns[0].isOnDivingBoard).toBe(true);
  });

  it('falls back to the 2025 side (right) when no clown is seated at fall-off resolution', () => {
    const { state, events } = step(
      playing({ balloons: [], clowns: [flying(200, 650, 0, 0), flying(600, 500, 0, 5, 'right')] }),
      [],
      createRng(1),
    );
    const death = expectEvent(events, 'death');
    expect(death.cause).toBe('fall-off');
    expect([2, 3]).toContain(state.clowns[0].divingBoardIndex); // 2025 fallback side: right pair
    expect(state.clowns[0].x).toBe(740);
  });

  it('falls back to the 2025 side (right) when no clown is seated at middle-death resolution (issue #19)', () => {
    // Issue #19: middle shares fall-off's deterministic no-seated fallback.
    // Both clowns fly, so no receiver exists; the dying clown's stale
    // seesawSide is 'right', which the old per-clown derivation would have
    // flipped to 'left' (board 0, x 60) — this discriminates the shared
    // fallback too.
    const { state, events } = step(
      playing({ balloons: [], clowns: [flying(400, LANDING_Y, 0, 0), flying(200, 650, 0, 0)] }),
      [],
      createRng(1),
    );
    const death = expectEvent(events, 'death');
    expect(death.cause).toBe('middle');
    expect(death.clownIndex).toBe(0);
    expect([2, 3]).toContain(state.clowns[0].divingBoardIndex); // 2025 fallback side: right pair
    expect(state.clowns[0].x).toBe(740);
  });

  it('no-ops unless the phase is playing', () => {
    const idle = createInitialState();
    const r1 = step(idle, [{ type: 'launch' }], createRng(1), nullConsequences);
    expect(r1.state).toBe(idle);
    expect(r1.events).toEqual([]);
    const over: GameState = { ...idle, phase: 'gameover' };
    const r2 = step(over, [{ type: 'move-seesaw', x: 100 }], createRng(1), nullConsequences);
    expect(r2.state).toBe(over);
    expect(r2.events).toEqual([]);
  });
});
