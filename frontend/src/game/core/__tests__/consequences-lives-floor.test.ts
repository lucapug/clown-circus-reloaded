import { describe, expect, it } from 'vitest';
import {
  BOARD_DAMPING,
  BOARD_HEIGHT,
  BOARD_RECT_LEFT_X,
  BOARD_RECT_RIGHT_X,
  BOARD_WIDTH,
  CLOWN_SIZE,
  DIVING_BOARDS,
  FALL_OFF_Y,
  GRAVITY,
  LANDING_Y,
  MAX_JUMP_VELOCITY,
  TICK_DURATION,
  WALL_DAMPING,
  WALL_X_MAX,
  WALL_X_MIN,
} from '../constants';
import { createConsequences } from '../consequences';
import { advance, step } from '../engine';
import { createRng } from '../rng';
import { createInitialState } from '../state';
import type { Clown, ConsequenceReducer, GameInput, GameState } from '../types';

// Issue #27 regression: two clowns dying in the SAME tick used to fold two
// life decrements with no floor → lives −1 at lives 1. The spec (§3.5) never
// contemplates negative lives: game-over fires at 0, and the state must hold
// exactly that (pinned by the state-injected property test below). The slim
// fuzz harness (round-2 fuzz investigation; the heavy 300-game harness was
// deliberately kept out of CI) now carries the issue #35 invariant: under the
// spam-launch policy, input launches only fire diving-board clowns and at
// most one clown flies at any tick (spec §3.4).
const consequences = createConsequences();

const clampX = (x: number): number => Math.max(60, Math.min(740, x));

/** Mirror of engine steps 1–3 (gravity, integration, wall + board bounce). */
const predictLandingX = (c: Clown): number | null => {
  let x = c.x;
  let y = c.y;
  let vx = c.vx;
  let vy = c.vy;
  for (let i = 0; i < 3000; i++) {
    vy = vy + GRAVITY;
    x = x + vx;
    y = y + vy;
    if (x < WALL_X_MIN) {
      x = WALL_X_MIN;
      vx = Math.abs(vx) * WALL_DAMPING;
    }
    if (x > WALL_X_MAX) {
      x = WALL_X_MAX;
      vx = -Math.abs(vx) * WALL_DAMPING;
    }
    for (const board of DIVING_BOARDS) {
      const boardX = board.side === 'left' ? BOARD_RECT_LEFT_X : BOARD_RECT_RIGHT_X;
      const boardY = board.y - BOARD_HEIGHT / 2;
      if (x >= boardX && x <= boardX + BOARD_WIDTH && y >= boardY - CLOWN_SIZE && y <= boardY + BOARD_HEIGHT) {
        if (vy > 0) {
          vy = -Math.abs(vy) * BOARD_DAMPING;
          y = boardY - CLOWN_SIZE;
        }
      }
    }
    if (vy > 0 && y >= LANDING_Y) return x;
    if (y > FALL_OFF_Y) return null;
  }
  return null;
};

/** The harness policy that minimizes seed 22 to the tick-233 double death —
 * verbatim from the investigation (draw order included: the policy stream is
 * part of the repro). */
type Strategy = 'random-x' | 'chase-center' | 'chase-edge' | 'mixed';

interface PolicySpec {
  launchProb: number;
  moveProb: number;
  strategy: Strategy;
  edgeSide: 'left' | 'right';
  doubleLaunchProb: number;
}

const makePolicy = (prng: ReturnType<typeof createRng>): PolicySpec => ({
  launchProb: 0.02 + prng.next() * 0.18,
  moveProb: 0.1 + prng.next() * 0.6,
  strategy: (['random-x', 'chase-center', 'chase-edge', 'mixed'] as Strategy[])[
    Math.floor(prng.next() * 4)
  ],
  edgeSide: prng.next() < 0.5 ? 'left' : 'right',
  doubleLaunchProb: 0.02 + prng.next() * 0.08,
});

const buildInputs = (policy: PolicySpec, state: GameState, prng: ReturnType<typeof createRng>): GameInput[] => {
  const inputs: GameInput[] = [];
  const flying = state.clowns.find((c) => c.isFlying);

  let strategy = policy.strategy;
  if (strategy === 'mixed') {
    const r = prng.next();
    strategy = r < 0.5 ? 'chase-edge' : r < 0.75 ? 'chase-center' : 'random-x';
  }
  let moved = false;
  if (flying && (strategy === 'chase-center' || strategy === 'chase-edge')) {
    const pred = predictLandingX(flying);
    if (pred !== null) {
      const target =
        strategy === 'chase-center' ? pred : pred + (policy.edgeSide === 'right' ? -30 : 30);
      inputs.push({ type: 'move-seesaw', x: clampX(target) });
      moved = true;
    }
  }
  if (!moved && prng.next() < policy.moveProb) {
    inputs.push({ type: 'move-seesaw', x: clampX(60 + prng.next() * 680) });
  }

  if (prng.next() < policy.launchProb) {
    inputs.push({ type: 'launch' });
    if (prng.next() < policy.doubleLaunchProb) inputs.push({ type: 'launch' });
  }
  return inputs;
};

/** Issue #27 repro start: post-level-1 state {lives 4, jumps 0, level 2, cv −17}. */
const reproStart = (): GameState => ({
  ...createInitialState(),
  phase: 'playing',
  currentJumpVelocity: MAX_JUMP_VELOCITY,
  level: 2,
  stats: { score: 0, lives: 4, bonusJumps: 0 },
});

describe('issue #27: lives never go below zero on a same-tick double death', () => {
  it('invariant (issue #35): input launches only board clowns and at most one clown flies, per tick (20 seeds)', () => {
    // Same harness as the old seed-22 repro (both streams, the doubleLaunchProb
    // spam-launch policy) — but post-#35 the spam can no longer force seated
    // launches: every input launch must name a clown that was isOnDivingBoard
    // in that tick's pre-step state, and at most one clown may be flying at
    // any tick (spec §3.4 corollary; two-flying state stays reachable only via
    // direct state injection — see the property test below).
    for (let seed = 1; seed <= 20; seed++) {
      const rng = createRng(seed);
      const policyRng = createRng((seed ^ 0x5f3759df) >>> 0); // same policy stream as the investigation
      const policy = makePolicy(policyRng);
      const sim = { state: reproStart(), accumulator: 0 };
      let inputLaunches = 0;
      let tick = 0;

      while (sim.state.phase === 'playing' && tick < 10_000) {
        const inputs = buildInputs(policy, sim.state, policyRng);
        const before = sim.state;
        const res = advance(sim, TICK_DURATION, rng, consequences, inputs);
        tick += res.ticks;

        expect(sim.state.clowns.filter((c) => c.isFlying).length).toBeLessThanOrEqual(1);
        for (const event of res.events) {
          if (event.type === 'launched' && event.via === 'input') {
            inputLaunches++;
            expect(before.clowns[event.clownIndex].isOnDivingBoard).toBe(true);
          }
        }
      }

      expect(inputLaunches).toBeGreaterThan(0); // non-vacuity: the policy really launches via input
    }
  });

  it('property: 20 seeds × double-death-at-lives-1 folds stay at 0, never negative', () => {
    // Two flying clowns die in the same tick (middle third + fall-off, the
    // #18 fold-order construction); lives start at 1 with jumps 0 or 1 — the
    // worst case for the old unfounded decrement. Every seed must land on
    // exactly 0 lives with game-over, never below.
    for (let seed = 1; seed <= 20; seed++) {
      const before: GameState = {
        ...createInitialState(),
        phase: 'playing',
        stats: { score: 0, lives: 1, bonusJumps: seed % 2 },
        clowns: [
          {
            x: 400,
            y: LANDING_Y,
            vx: 0,
            vy: 0,
            isFlying: true,
            isOnSeesaw: false,
            seesawSide: 'right',
            isOnDivingBoard: false,
            divingBoardIndex: null,
          },
          {
            x: 200,
            y: FALL_OFF_Y,
            vx: 0,
            vy: 0,
            isFlying: true,
            isOnSeesaw: false,
            seesawSide: 'left',
            isOnDivingBoard: false,
            divingBoardIndex: null,
          },
        ],
      };

      const { state, events } = step(before, [], createRng(seed), consequences as ConsequenceReducer);

      expect(state.stats.lives).toBeGreaterThanOrEqual(0);
      expect(state.stats.lives).toBe(0); // both deaths land on the floor
      expect(state.phase).toBe('gameover');
      expect(events.filter((e) => e.type === 'game-over')).toHaveLength(1);
    }
  });
});
