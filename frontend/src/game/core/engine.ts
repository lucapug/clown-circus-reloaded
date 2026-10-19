import {
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
  MAX_JUMP_VELOCITY,
  MAX_TICKS_PER_ADVANCE,
  RESPAWN_BOARD_HEIGHT_INDEX,
  SEAT_OFFSET,
  SEESAW_CLAMP_MAX,
  SEESAW_CLAMP_MIN,
  SEESAW_WIDTH,
  TICK_DURATION,
  WALL_DAMPING,
  WALL_X_MAX,
  WALL_X_MIN,
  levelMultiplier,
} from './constants';
import type { GameEvent } from './events';
import { createBalloonGrid, createBoardClown } from './state';
import type {
  Clown,
  ConsequenceReducer,
  GameInput,
  GameState,
  Rng,
  Simulation,
} from './types';

/**
 * Shipped consequence reducer: the identity. #6 owns death/landing/level
 * detection and emits events; score/lives/bonusJumps writes are #7/#8
 * reducers plugged in here (issue brief, design decision 2).
 */
export const nullConsequences: ConsequenceReducer = (state) => state;

export interface StepResult {
  state: GameState;
  events: GameEvent[];
}

const freeSideOf = (side: 'left' | 'right'): 'left' | 'right' => (side === 'left' ? 'right' : 'left');

// Entering clowns take the free end of the seesaw (owner decisions
// 2026-10-18 issue #6 comment 6252402875 and 2026-10-19 issue #19): the side
// pair comes from seatedFreeSide — opposite the currently seated clown — for
// ALL three death causes. The height within the pair is the still-open owner
// decision (interim: high board). 'left' pair is boards 0/1, 'right' is 2/3.
const respawnBoardIndex = (enteringSide: 'left' | 'right'): 0 | 1 | 2 | 3 =>
  // base ∈ {0, 2} + height ∈ {0, 1} ⊆ {0, 1, 2, 3} — cast only narrows arithmetic.
  ((enteringSide === 'left' ? 0 : 2) + RESPAWN_BOARD_HEIGHT_INDEX) as 0 | 1 | 2 | 3;

// Owner decision 2026-10-19 (issue #19): ALL three death causes enter on the
// FREE end — opposite the currently seated clown (receiver's perspective),
// read from the LIVE clowns array (fall-off precedent :277; PR #17 review
// approves that reading). No clown seated at resolution → 2025 fallback: right.
const seatedFreeSide = (clowns: readonly Clown[]): 'left' | 'right' => {
  const seated = clowns.find((c) => c.isOnSeesaw);
  return seated ? freeSideOf(seated.seesawSide) : 'right';
};

/**
 * Advance the simulation by exactly one logic tick (1/60 s).
 *
 * Pinned §3 tick order:
 *   0. drain the input queue at the tick boundary (before gravity)
 *   1. gravity, then position integration (semi-implicit Euler)
 *   2. wall-bounce clamp
 *   3. diving-board bounce (falling clowns only, all four boards in order)
 *   4. balloon collisions, in balloon-array order (row-clear checked per pop)
 *   5. level-complete check (kernel regenerates the grid in the same tick)
 *   6. seesaw landing rules and fall-off, in clown-array order
 *   7. chain launch of the other seated clown, with this tick's velocity
 *   8. consequence reducer, then game-over check, then seesaw tilt
 *
 * Pure: never mutates `state`, never writes `stats`, never touches the DOM.
 */
export function step(
  state: GameState,
  inputs: readonly GameInput[],
  rng: Rng,
  consequences: ConsequenceReducer = nullConsequences,
): StepResult {
  if (state.phase !== 'playing') return { state, events: [] };

  const events: GameEvent[] = [];
  const clowns: Clown[] = state.clowns.map((c) => ({ ...c }));
  let balloons = state.balloons.map((b) => ({ ...b }));
  const seesaw = { ...state.seesaw };
  let currentJumpVelocity = state.currentJumpVelocity;
  const levelAtTickStart = state.level;
  const levelMult = levelMultiplier(levelAtTickStart);
  const allPoppedAtTickStart = balloons.every((b) => b.popped);

  // Step 0 — drain the input queue at the tick boundary, before gravity.
  for (const input of inputs) {
    if (input.type === 'move-seesaw') {
      const x = Math.max(SEESAW_CLAMP_MIN, Math.min(SEESAW_CLAMP_MAX, input.x));
      seesaw.x = x;
      for (const clown of clowns) {
        if (!clown.isOnSeesaw) continue;
        clown.x = x + (clown.seesawSide === 'left' ? -SEAT_OFFSET : SEAT_OFFSET);
      }
    } else {
      // Launch: diving-board clown first (§3.4), else the seated clown,
      // both in clown-array order. Board launches draw nothing from the RNG.
      const boardIdx = clowns.findIndex((c) => c.isOnDivingBoard);
      if (boardIdx !== -1) {
        const clown = clowns[boardIdx];
        const board = DIVING_BOARDS[clown.divingBoardIndex ?? 0];
        const direction = board.side === 'left' ? 1 : -1;
        clown.isFlying = true;
        clown.isOnDivingBoard = false;
        clown.vy = BOARD_LAUNCH_VY;
        clown.vx = direction * BOARD_LAUNCH_VX * levelMult;
        events.push({ type: 'launched', clownIndex: boardIdx as 0 | 1, via: 'input', vx: clown.vx, vy: clown.vy });
      } else {
        const seatedIdx = clowns.findIndex((c) => c.isOnSeesaw);
        if (seatedIdx !== -1) {
          const clown = clowns[seatedIdx];
          clown.isFlying = true;
          clown.isOnSeesaw = false;
          clown.vy = currentJumpVelocity;
          clown.vx = (rng.next() - 0.5) * 4 * levelMult; // the one RNG draw in the core
          events.push({ type: 'launched', clownIndex: seatedIdx as 0 | 1, via: 'input', vx: clown.vx, vy: clown.vy });
        }
      }
    }
  }

  // Steps 1–3 — flight physics per flying clown, in clown-array order.
  for (let i = 0; i < clowns.length; i++) {
    const clown = clowns[i];
    if (!clown.isFlying) continue;

    // 1. gravity, then integration (semi-implicit Euler)
    clown.vy = clown.vy + GRAVITY;
    clown.x = clown.x + clown.vx;
    clown.y = clown.y + clown.vy;

    // 2. wall bounce (x clamped, vx damped, vy untouched)
    if (clown.x < WALL_X_MIN) {
      clown.x = WALL_X_MIN;
      clown.vx = Math.abs(clown.vx) * WALL_DAMPING;
    }
    if (clown.x > WALL_X_MAX) {
      clown.x = WALL_X_MAX;
      clown.vx = -Math.abs(clown.vx) * WALL_DAMPING;
    }

    // 3. diving-board bounce: all four boards in array order, no early exit
    //    (baseline :177–195). boardY = board.y − 5; hit box y ∈ [boardY−24, boardY+10].
    for (const board of DIVING_BOARDS) {
      const boardX = board.side === 'left' ? BOARD_RECT_LEFT_X : BOARD_RECT_RIGHT_X;
      const boardY = board.y - BOARD_HEIGHT / 2;
      if (
        clown.x >= boardX &&
        clown.x <= boardX + BOARD_WIDTH &&
        clown.y >= boardY - CLOWN_SIZE &&
        clown.y <= boardY + BOARD_HEIGHT
      ) {
        if (clown.vy > 0) {
          clown.vy = -Math.abs(clown.vy) * BOARD_DAMPING;
          clown.y = boardY - CLOWN_SIZE;
          events.push({ type: 'board-bounced', clownIndex: i as 0 | 1 });
        }
      }
    }
  }

  // Post-integration snapshot: occupied-edge checks and the chain-launch
  // target search see these positions, exactly like the baseline's newClowns.
  const integrated: Clown[] = clowns.map((c) => ({ ...c }));

  // Step 4 — balloon collisions: flying clowns outer, balloons inner (array
  // order); one clown may pop several per tick; row-clear checked per pop.
  for (const clown of clowns) {
    if (!clown.isFlying) continue;
    for (const balloon of balloons) {
      if (balloon.popped) continue;
      const dx = clown.x - balloon.x;
      const dy = clown.y - balloon.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < COLLISION_DISTANCE) {
        balloon.popped = true;
        events.push({
          type: 'balloon-popped',
          balloonId: balloon.id,
          row: balloon.row,
          color: balloon.color,
          x: balloon.x,
          y: balloon.y,
        });
        const rowBalloons = balloons.filter((b) => b.row === balloon.row);
        if (rowBalloons.every((b) => b.popped)) {
          events.push({ type: 'row-cleared', row: balloon.row, color: balloon.color });
        }
      }
    }
  }

  // Step 5 — level-complete check (baseline :236 once-guard): all popped now
  // AND not all popped at tick start. The kernel regenerates the grid in the
  // same tick, deterministically, without RNG (baseline :379).
  let level = levelAtTickStart;
  if (balloons.every((b) => b.popped) && !allPoppedAtTickStart) {
    level = level + 1;
    balloons = createBalloonGrid();
    events.push({ type: 'level-completed', newLevel: level });
  }

  // Step 6 — seesaw landing rules and fall-off, in clown-array order.
  let chainLaunchIdx: number | null = null;
  for (let i = 0; i < clowns.length; i++) {
    const clown = clowns[i];
    if (!clown.isFlying) continue;

    let landedOrDied = false;

    // Landing gate: falling, at seesaw level, x within [seesawX−60, seesawX+60].
    if (clown.vy > 0 && clown.y >= LANDING_Y) {
      const seesawLeft = seesaw.x - SEESAW_WIDTH / 2;
      const seesawRight = seesaw.x + SEESAW_WIDTH / 2;
      if (clown.x >= seesawLeft && clown.x <= seesawRight) {
        const leftEdgeRight = seesawLeft + EDGE_WIDTH;
        const rightEdgeLeft = seesawRight - EDGE_WIDTH;
        const isOnLeftEdge = clown.x >= seesawLeft && clown.x <= leftEdgeRight;
        const isOnRightEdge = clown.x >= rightEdgeLeft && clown.x <= seesawRight;

        if (isOnLeftEdge || isOnRightEdge) {
          const side = isOnLeftEdge ? 'left' : 'right';
          const otherClownOnSameSide = integrated.find(
            (c, idx) => idx !== i && c.isOnSeesaw && c.seesawSide === side,
          );
          if (otherClownOnSameSide) {
            // Occupied edge → death (baseline :286–287). Issue #19: the
            // entering clown takes the FREE side — opposite the seated
            // occupier (necessarily the landing side's seated clown), never
            // the dying clown's stale seesawSide (the old bug pointed the
            // entrant back at the occupied side).
            currentJumpVelocity = INITIAL_JUMP_VELOCITY;
            clowns[i] = createBoardClown(respawnBoardIndex(seatedFreeSide(clowns)));
            events.push({ type: 'death', clownIndex: i as 0 | 1, cause: 'occupied-edge' });
          } else {
            // Safe edge landing: snap to the seat, strengthen the jump velocity
            // (−0.2, clamped at −17), and mark the other seated clown for the
            // step-7 chain launch (baseline :296–313, :347–360).
            currentJumpVelocity = Math.max(MAX_JUMP_VELOCITY, currentJumpVelocity - JUMP_VELOCITY_STEP);
            clown.isFlying = false;
            clown.isOnSeesaw = true;
            clown.seesawSide = side;
            clown.y = LANDING_Y;
            clown.x = seesaw.x + (side === 'left' ? -SEAT_OFFSET : SEAT_OFFSET);
            clown.vx = 0;
            clown.vy = 0;
            events.push({ type: 'landed-edge', clownIndex: i as 0 | 1, side });
            const otherIdx = integrated.findIndex((c, idx) => idx !== i && c.isOnSeesaw);
            if (otherIdx !== -1) chainLaunchIdx = otherIdx;
          }
        } else {
          // Middle third → death (baseline :324–325). Issue #19: the entering
          // clown takes the FREE side — opposite the currently seated clown,
          // read live (a same-tick lower-index safe landing counts as the
          // receiver; the dying clown itself is flying, never a match).
          currentJumpVelocity = INITIAL_JUMP_VELOCITY;
          clowns[i] = createBoardClown(respawnBoardIndex(seatedFreeSide(clowns)));
          events.push({ type: 'death', clownIndex: i as 0 | 1, cause: 'middle' });
        }
        landedOrDied = true;
      }
    }

    // Fall-off (baseline :331 threshold) — issue #19: the same unified rule
    // as every death cause (seatedFreeSide; owner decisions 2026-10-18 issue
    // #6 comment 6252402875 and 2026-10-19 issue #19, overriding the 2025
    // always-right hardcode at baseline :340; spec §3.4 primacy).
    if (!landedOrDied && clown.y > FALL_OFF_Y) {
      currentJumpVelocity = INITIAL_JUMP_VELOCITY;
      clowns[i] = createBoardClown(respawnBoardIndex(seatedFreeSide(clowns)));
      events.push({ type: 'death', clownIndex: i as 0 | 1, cause: 'fall-off' });
    }
  }

  // Step 7 — chain launch of the other seated clown using this tick's
  // (post-strengthening) velocity (baseline second pass).
  if (chainLaunchIdx !== null) {
    const clown = clowns[chainLaunchIdx];
    if (clown.isOnSeesaw) {
      clown.isFlying = true;
      clown.isOnSeesaw = false;
      clown.vy = currentJumpVelocity;
      clown.vx = (rng.next() - 0.5) * 4 * levelMult;
      events.push({ type: 'launched', clownIndex: chainLaunchIdx as 0 | 1, via: 'chain', vx: clown.vx, vy: clown.vy });
    }
  }

  // Between steps 7 and 8: consequences (#7/#8 seam). The kernel hands over
  // the post-step-7 state plus this tick's events; stats may change here.
  const afterKernelSteps: GameState = {
    ...state,
    clowns,
    balloons,
    seesaw,
    currentJumpVelocity,
    level,
  };
  let result = consequences(afterKernelSteps, events);

  // Step 8a — game-over check reads the post-reducer lives, inside the same
  // tick (baseline :362–367, once-guard via the phase transition).
  if (result.stats.lives <= 0 && result.phase === 'playing') {
    result = { ...result, phase: 'gameover' };
    events.push({ type: 'game-over' });
  }

  // Step 8b — seesaw tilt from the final clowns (baseline :369–374).
  const seated = result.clowns.filter((c) => c.isOnSeesaw);
  const tilt = seated.length === 1 ? seated[0].seesawSide : 'center';
  result = { ...result, seesaw: { ...result.seesaw, tilt } };

  return { state: result, events };
}

export interface AdvanceResult extends StepResult {
  ticks: number;
}

/**
 * Fixed-timestep driver ("Fix Your Timestep"): accumulate real time, run
 * floor(accumulator / TICK_DURATION) logic ticks, carry the remainder. At
 * most MAX_TICKS_PER_ADVANCE ticks per call; excess time is discarded
 * (spiral-of-death guard — a 2026 implementation choice, not product scope).
 * The rAF wiring consuming this belongs to #9.
 */
export function advance(
  sim: Simulation,
  dtSeconds: number,
  rng: Rng,
  consequences?: ConsequenceReducer,
): AdvanceResult {
  sim.accumulator += dtSeconds;
  const pending = Math.floor(sim.accumulator / TICK_DURATION);
  const capped = pending > MAX_TICKS_PER_ADVANCE;
  const ticks = capped ? MAX_TICKS_PER_ADVANCE : pending;
  sim.accumulator = capped ? 0 : sim.accumulator - ticks * TICK_DURATION;

  const events: GameEvent[] = [];
  for (let i = 0; i < ticks; i++) {
    const result = step(sim.state, [], rng, consequences);
    sim.state = result.state;
    events.push(...result.events);
  }
  return { state: sim.state, events, ticks };
}
