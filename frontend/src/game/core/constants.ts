// Single source of truth for every pinned §3.1/§3.4 value (2025 lesson: the
// baseline duplicated these constants across engine and types, and the tested
// copy drifted). All values are per logic tick; one tick is exactly 1/60 s
// (owner decision, 2026-10-15 — an explicit, recorded deviation from the 2025
// display-dependent frame loop).
export const TICK_DURATION = 1 / 60;

// Spiral-of-death guard for advance(): at most 600 logic ticks per call,
// excess time discarded ("Fix Your Timestep" pattern).
export const MAX_TICKS_PER_ADVANCE = 600;

// Playfield (the spec's 800×600 canvas; the core never touches rendering).
export const ARENA_WIDTH = 800;
export const ARENA_HEIGHT = 600;

// Physics.
export const GRAVITY = 0.3;
export const WALL_DAMPING = 0.8;
export const BOARD_DAMPING = 0.9; // applied to vy only, and only while falling (vy > 0)
export const COLLISION_DISTANCE = 40; // CLOWN_SIZE + BALLOON_RADIUS
export const CLOWN_SIZE = 24;
export const BALLOON_RADIUS = 16;

// Wall bounce clamp values.
export const WALL_X_MIN = CLOWN_SIZE; // 24
export const WALL_X_MAX = ARENA_WIDTH - CLOWN_SIZE; // 776

// Seesaw.
export const SEESAW_WIDTH = 120;
export const SEESAW_Y = ARENA_HEIGHT - 80; // 520
export const SEESAW_CLAMP_MIN = SEESAW_WIDTH / 2; // 60
export const SEESAW_CLAMP_MAX = ARENA_WIDTH - SEESAW_WIDTH / 2; // 740
export const LANDING_Y = SEESAW_Y - CLOWN_SIZE; // 496
export const EDGE_WIDTH = SEESAW_WIDTH / 3; // 40 — outer thirds are safe edges
export const SEAT_OFFSET = SEESAW_WIDTH / 4; // 30 — see baseline note: initial seats use width/3 instead

// Fall-off death line.
export const FALL_OFF_Y = ARENA_HEIGHT + 50; // 650

// Diving boards: anchor points per spec (x-sides at 40 and 760, y = 250/350),
// with collision rects (left x=22, right x=708, width 70, height 10).
export const BOARD_WIDTH = 70;
export const BOARD_HEIGHT = 10;
export const BOARD_RECT_LEFT_X = 22;
export const BOARD_RECT_RIGHT_X = ARENA_WIDTH - BOARD_RECT_LEFT_X - BOARD_WIDTH; // 708
export interface DivingBoard {
  x: number;
  y: number;
  side: 'left' | 'right';
  index: 0 | 1 | 2 | 3;
}
export const DIVING_BOARDS: readonly DivingBoard[] = [
  { x: 40, y: ARENA_HEIGHT / 2 - 50, side: 'left', index: 0 },
  { x: 40, y: ARENA_HEIGHT / 2 + 50, side: 'left', index: 1 },
  { x: ARENA_WIDTH - 40, y: ARENA_HEIGHT / 2 - 50, side: 'right', index: 2 },
  { x: ARENA_WIDTH - 40, y: ARENA_HEIGHT / 2 + 50, side: 'right', index: 3 },
];

// Progressive jump velocity (baseline §3.4).
export const INITIAL_JUMP_VELOCITY = -14;
export const MAX_JUMP_VELOCITY = -17;
export const JUMP_VELOCITY_STEP = 0.2;

// Diving-board launch (baseline §3.4): vy = 2, vx = ±3·levelMult toward center.
export const BOARD_LAUNCH_VY = 2;
export const BOARD_LAUNCH_VX = 3;

// Level scaling of horizontal launch velocity.
export const LEVEL_MULT_STEP = 0.25;
export const levelMultiplier = (level: number): number => 1 + (level - 1) * LEVEL_MULT_STEP;

// Balloon grid: 4 rows × 14, y 60/100/140/180, x 80→720 evenly spaced.
export const BALLOON_ROWS = 4;
export const BALLOONS_PER_ROW = 14;
export const BALLOON_GRID_Y_TOP = 60;
export const BALLOON_ROW_SPACING = 40;
export const BALLOON_GRID_X_START = 80;
export const BALLOON_GRID_X_END = ARENA_WIDTH - 80; // 720
export const BALLOON_GRID_X_STEP = (BALLOON_GRID_X_END - BALLOON_GRID_X_START) / (BALLOONS_PER_ROW - 1); // 640/13

// Row colors top→bottom. BalloonColor is derived so this stays the only place
// the mapping exists.
export const BALLOON_ROW_COLORS = ['blue', 'green', 'green', 'yellow'] as const;
