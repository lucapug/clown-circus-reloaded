import type { BALLOON_ROW_COLORS } from './constants';
import type { GameEvent } from './events';

// Core entity and state types (issue #6 file tree). `stats` exists from day
// one, but the kernel NEVER writes it — score/lives/bonusJumps are #7/#8
// consequences, injected through ConsequenceReducer.

export type BalloonColor = (typeof BALLOON_ROW_COLORS)[number];

export interface Balloon {
  /** Structural grid id "${row}-${col}" — deterministic, unrelated to §6.2 IDs. */
  id: string;
  x: number;
  y: number;
  color: BalloonColor;
  row: number;
  popped: boolean;
}

export interface Clown {
  x: number;
  y: number;
  vx: number;
  vy: number;
  isFlying: boolean;
  isOnSeesaw: boolean;
  /** The side this clown last occupied/launched from; kept while flying. */
  seesawSide: 'left' | 'right';
  isOnDivingBoard: boolean;
  divingBoardIndex: 0 | 1 | 2 | 3 | null;
}

export type SeesawTilt = 'left' | 'right' | 'center';

export interface Seesaw {
  x: number;
  y: number;
  width: number;
  tilt: SeesawTilt;
}

export type GamePhase = 'idle' | 'playing' | 'gameover';

export interface GameStats {
  score: number;
  lives: number;
  bonusJumps: number;
  /**
   * #24 launch streak: consecutive `launched{via:'chain'}` events toward
   * JUMP_STREAK_GOAL (reset at the goal and on any death). The consequences
   * fold is the ONLY writer and always emits it as a number after a real
   * fold; it is ABSENT under nullConsequences and in fresh initial state —
   * readers default with `?? 0`. The goal is deliberately NOT tracked in
   * state: import JUMP_STREAK_GOAL instead, so recalibration propagates with
   * zero state churn.
   */
  streak?: number;
}

export interface GameState {
  phase: GamePhase;
  clowns: Clown[];
  balloons: Balloon[];
  seesaw: Seesaw;
  currentJumpVelocity: number;
  level: number;
  stats: GameStats;
}

export type GameInput = { type: 'launch' } | { type: 'move-seesaw'; x: number };

/** Injectable seeded PRNG (mulberry32, see rng.ts). */
export interface Rng {
  next(): number;
}

/**
 * The #6/#7/#8 seam: consequences (score, lives, bonusJumps) are reduced from
 * the tick's events after kernel steps 1–7 and before the step-8 game-over
 * check. #6 ships `nullConsequences` (the identity reducer).
 */
export type ConsequenceReducer = (state: GameState, events: GameEvent[]) => GameState;

/** Fixed-timestep simulation handle consumed by advance(). */
export interface Simulation {
  state: GameState;
  accumulator: number;
}
