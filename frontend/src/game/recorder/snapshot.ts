import type { GameState } from '../core';
import type { SnapshotDigest } from './types';

// The ONE state projection (issue #30): recorder, replay and tests all
// compare through projectSnapshot, so there is exactly one definition of
// "state equality". Pure: reads the GameState, returns plain JSON-safe data.
export const projectSnapshot = (state: GameState): SnapshotDigest => ({
  phase: state.phase,
  level: state.level,
  currentJumpVelocity: state.currentJumpVelocity,
  stats: { score: state.stats.score, lives: state.stats.lives, bonusJumps: state.stats.bonusJumps },
  seesaw: { x: state.seesaw.x, tilt: state.seesaw.tilt },
  clowns: state.clowns.map((c) => ({
    x: c.x,
    y: c.y,
    vx: c.vx,
    vy: c.vy,
    isFlying: c.isFlying,
    isOnSeesaw: c.isOnSeesaw,
    seesawSide: c.seesawSide,
    isOnDivingBoard: c.isOnDivingBoard,
    divingBoardIndex: c.divingBoardIndex,
  })),
  balloonsPopped: state.balloons.filter((b) => b.popped).length,
  balloonBits: state.balloons.map((b) => (b.popped ? '1' : '0')).join(''),
});
