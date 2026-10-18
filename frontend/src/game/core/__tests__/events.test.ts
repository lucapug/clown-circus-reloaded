import { describe, expect, it } from 'vitest';
import { BOARD_LAUNCH_VX, BOARD_LAUNCH_VY, LANDING_Y } from '../constants';
import {
  isBalloonPoppedEvent,
  isDeathEvent,
  isGameOverEvent,
  type BalloonPoppedEvent,
  type DeathEvent,
  type GameEvent,
  type GameOverEvent,
} from '../events';
import { nullConsequences, step } from '../engine';
import { createRng } from '../rng';
import { createBalloonGrid, createInitialState } from '../state';
import type { Balloon, Clown, ConsequenceReducer, GameState } from '../types';

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

const expectEvent = <T extends GameEvent['type']>(events: GameEvent[], type: T): Extract<GameEvent, { type: T }> => {
  const event = events.find((e) => e.type === type);
  if (!event || event.type !== type) throw new Error(`expected a '${type}' event`);
  return event as Extract<GameEvent, { type: T }>;
};

describe('event surface (issue brief, design decisions 1–2)', () => {
  it('emits typed pop payloads with the balloon grid data', () => {
    // Exactly one row-0 balloon left unpopped, sitting on the clown's arrival
    // point; row 1 stays alive so the level does not complete.
    const balloons: Balloon[] = createBalloonGrid().map((b) => {
      if (b.id === '0-0') return { ...b, x: 440, y: LANDING_Y + 0.3 };
      return b.row === 0 ? { ...b, popped: true } : b;
    });
    const { events } = step(
      playing({ balloons, clowns: [flying(440, LANDING_Y, 0, 0), seatedLeft(370)] }),
      [],
      createRng(5),
    );
    const pop = events.find(isBalloonPoppedEvent) as BalloonPoppedEvent | undefined;
    expect(pop).toBeDefined();
    expect(pop!.balloonId).toBe('0-0');
    expect(pop!.row).toBe(0);
    expect(pop!.color).toBe('blue');
    expect(pop!.x).toBe(440);
    expect(pop!.y).toBe(LANDING_Y + 0.3);
    const cleared = events.find((e) => e.type === 'row-cleared');
    expect(cleared).toEqual({ type: 'row-cleared', row: 0, color: 'blue' });
  });

  it('ships nullConsequences: the kernel never writes stats', () => {
    // A middle-death tick under the identity reducer: detection happens,
    // respawn and velocity reset happen, but stats stay exactly as given.
    const before = playing({
      balloons: [],
      clowns: [flying(400, LANDING_Y, 0, 0), seatedLeft(370)],
      stats: { score: 123, lives: 1, bonusJumps: 2 },
    });
    const { state, events } = step(before, [], createRng(1), nullConsequences);
    expect(events.some(isDeathEvent)).toBe(true);
    expect(state.stats).toEqual({ score: 123, lives: 1, bonusJumps: 2 });
    expect(state.phase).toBe('playing'); // no game-over without a consequence reducer
    expect(events.some(isGameOverEvent)).toBe(false);
  });

  it('lets an injected reducer consume deaths through the seam and drive game-over in the same tick', () => {
    const spendLife: ConsequenceReducer = (state, events) =>
      events.some(isDeathEvent) ? { ...state, stats: { ...state.stats, lives: state.stats.lives - 1 } } : state;
    const before = playing({
      balloons: [],
      clowns: [flying(400, LANDING_Y, 0, 0), seatedLeft(370)],
      stats: { score: 0, lives: 1, bonusJumps: 0 },
    });
    const { state, events } = step(before, [], createRng(1), spendLife);
    const death = events.find(isDeathEvent) as DeathEvent | undefined;
    expect(death?.cause).toBe('middle');
    const gameOver = events.find(isGameOverEvent) as GameOverEvent | undefined;
    expect(gameOver).toBeDefined(); // decided inside the same tick, after the reducer
    expect(events[events.length - 1].type).toBe('game-over');
    expect(state.phase).toBe('gameover');
    expect(state.stats.lives).toBe(0);
  });

  it('narrows events with the exported type guards', () => {
    const { events } = step(playing({ balloons: [] }), [{ type: 'launch' }], createRng(1));
    expect(events.map((e) => e.type)).toEqual(['launched', 'board-bounced']);
    const event = events[0];
    expect(isDeathEvent(event)).toBe(false);
    expect(isGameOverEvent(event)).toBe(false);
    if (isBalloonPoppedEvent(event)) throw new Error('launched event misclassified');
    expect(event.type).toBe('launched');
  });

  it('emits launched events with the input-launch velocities', () => {
    const { events } = step(playing({ balloons: [] }), [{ type: 'launch' }], createRng(1));
    const launched = expectEvent(events, 'launched');
    expect(launched).toEqual({
      type: 'launched',
      clownIndex: 1,
      via: 'input',
      vx: -BOARD_LAUNCH_VX,
      vy: BOARD_LAUNCH_VY,
    });
  });

  it('emits nothing when the phase is not playing', () => {
    const idle = step(createInitialState(), [{ type: 'launch' }], createRng(1));
    expect(idle.events).toEqual([]);
    const over = step({ ...createInitialState(), phase: 'gameover' }, [], createRng(1));
    expect(over.events).toEqual([]);
  });
});
