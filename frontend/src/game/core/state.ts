import {
  ARENA_WIDTH,
  BALLOON_GRID_X_START,
  BALLOON_GRID_X_STEP,
  BALLOON_GRID_Y_TOP,
  BALLOON_ROW_COLORS,
  BALLOON_ROW_SPACING,
  BALLOONS_PER_ROW,
  BALLOON_ROWS,
  BOARD_HEIGHT,
  BOARD_RECT_LEFT_X,
  BOARD_RECT_RIGHT_X,
  BOARD_WIDTH,
  CLOWN_SIZE,
  DIVING_BOARDS,
  INITIAL_JUMP_VELOCITY,
  SEESAW_WIDTH,
  SEESAW_Y,
  type DivingBoard,
} from './constants';
import type { Balloon, Clown, GameState } from './types';

/** Collision rect of a diving board (left x=22, right x=708, width 70, height 10). */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const boardRect = (board: DivingBoard): Rect => ({
  x: board.side === 'left' ? BOARD_RECT_LEFT_X : BOARD_RECT_RIGHT_X,
  y: board.y - BOARD_HEIGHT / 2,
  width: BOARD_WIDTH,
  height: BOARD_HEIGHT,
});

/** Fresh 4×14 grid; ids are the structural "${row}-${col}" grid ids (baseline :49). */
export const createBalloonGrid = (): Balloon[] => {
  const balloons: Balloon[] = [];
  for (let row = 0; row < BALLOON_ROWS; row++) {
    const color = BALLOON_ROW_COLORS[row];
    const y = BALLOON_GRID_Y_TOP + row * BALLOON_ROW_SPACING;
    for (let col = 0; col < BALLOONS_PER_ROW; col++) {
      const x = BALLOON_GRID_X_START + col * BALLOON_GRID_X_STEP;
      balloons.push({ id: `${row}-${col}`, x, y, color, row, popped: false });
    }
  }
  return balloons;
};

/** Clown standing on a diving board, ready to launch (baseline createInitialClown). */
export const createBoardClown = (boardIndex: 0 | 1 | 2 | 3): Clown => {
  const board = DIVING_BOARDS[boardIndex];
  return {
    x: board.side === 'left' ? 60 : ARENA_WIDTH - 60,
    y: board.y - CLOWN_SIZE - 4,
    vx: 0,
    vy: 0,
    isFlying: false,
    isOnSeesaw: false,
    seesawSide: board.side,
    isOnDivingBoard: true,
    divingBoardIndex: boardIndex,
  };
};

/**
 * Baseline initial state (useGameEngine.ts@0d365e6:93–111): one clown seated
 * left on the seesaw at x = center − width/3 (the baseline quirk — later
 * snapping uses width/4; kept for fixture fidelity, owner-decided), one clown
 * on the upper-right diving board, tilt 'left'. Phase starts 'idle'; the
 * start-game flow (#9) moves it to 'playing'.
 */
export const createInitialState = (): GameState => ({
  phase: 'idle',
  clowns: [
    {
      x: ARENA_WIDTH / 2 - SEESAW_WIDTH / 3,
      y: SEESAW_Y - CLOWN_SIZE,
      vx: 0,
      vy: 0,
      isFlying: false,
      isOnSeesaw: true,
      seesawSide: 'left',
      isOnDivingBoard: false,
      divingBoardIndex: null,
    },
    createBoardClown(2),
  ],
  balloons: createBalloonGrid(),
  seesaw: {
    x: ARENA_WIDTH / 2,
    y: SEESAW_Y,
    width: SEESAW_WIDTH,
    tilt: 'left',
  },
  currentJumpVelocity: INITIAL_JUMP_VELOCITY,
  level: 1,
  stats: { score: 0, lives: 3, bonusJumps: 0 },
});
