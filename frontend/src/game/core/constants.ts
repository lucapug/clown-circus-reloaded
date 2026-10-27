// Single source of truth for every pinned §3.1/§3.2/§3.4/§3.5 value (2025 lesson: the
// baseline duplicated these constants across engine and types, and the tested
// copy drifted). All values are per logic tick; one tick is exactly 1/60 s
// (owner decision, 2026-10-15 — an explicit, recorded deviation from the 2025
// display-dependent frame loop).
export const TICK_DURATION = 1 / 60;

// Spiral-of-death guard for advance(): at most 600 logic ticks per call,
// excess time discarded ("Fix Your Timestep" pattern).
export const MAX_TICKS_PER_ADVANCE = 600;

// Playfield (the spec's 800×600 stage; the core never touches rendering).
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

// Board rest-exit threshold (issue #57, owner decisions 2026-10-27): a
// falling board contact bounces only while vy · BOARD_DAMPING ≥ this; below
// it the contact enters the slide regime instead (vy zeroed, minimum slide).
// MUST stay > GRAVITY · BOARD_DAMPING = 0.27: the no-state-flag slide regime
// relies on the per-tick re-contact (gravity re-adds 0.3) re-firing the
// sub-threshold branch — below 0.27 it would re-emit board-bounced and the
// micro-bounce storm returns (spec §3.4 invariant, 2026 owner deviation).
export const BOARD_REST_VY = 0.5;

// Minimum slide speed in the board rest-exit regime (issue #57): while
// sliding, |vx| is floored at this every tick — direction is sign(vx), else
// the board-side launch direction — so a stranded vx ≈ 0 clown always
// crosses the board and falls off (deterministic end state, spec §3.4).
export const BOARD_MIN_SLIDE_VX = 0.5;

// Random entry-board height (owner decision 2026-10-19, issue #20 — resolves
// the TODO(owner) of issue #6 comment 6252402875): from level 4 a death
// respawns the entering clown on the high or low board of the free side,
// 50/50 via exactly one seeded rng.next() draw (engine.ts drawEntryHeightIndex);
// below the start level the entrant always takes the HIGH board (y=250), the
// 2025 default, with NO draw. 0 = high board (y=250), 1 = low board (y=350).
// The entry SIDE is always the free end of the seesaw (see engine.ts) and is
// not affected by this decision.
export const RANDOM_HEIGHT_START_LEVEL = 4;
export const RANDOM_HEIGHT_PROBABILITY = 0.5;

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

// Scoring, bonus jumps and lives (spec §3.2/§3.5, issue #7). Consumed only by
// scoring.ts/consequences.ts; the kernel stays free of pinned score values.
export const BALLOON_SCORES: Record<(typeof BALLOON_ROW_COLORS)[number], number> = {
  yellow: 20,
  green: 50,
  blue: 100,
};
export const ROW_BONUS_POINTS: Record<(typeof BALLOON_ROW_COLORS)[number], number> = {
  yellow: 200,
  green: 500,
  blue: 1000,
};
export const EDGE_LANDING_BONUS = 10; // "Bounce (land on seesaw edge)", §3.2
// §3.3 v2 EARNING (owner decision, issue #24 — replaces blue-row earning):
// consecutive chain launches (completed safe launch cycles) needed to earn
// +1 bonusJumps; the streak resets at the goal and on any death. A
// CALIBRATION PARAMETER — tune with real M5 telemetry once observability is
// live; HUD and StartScreen import this constant.
export const JUMP_STREAK_GOAL = 25;
export const LIVES_ON_LEVEL_UP = 1; // §3.5
export const LIVES_ON_DEATH = 1; // §3.5
// §3.3 CONSUMPTION — 2026 design decision A (an explicit owner decision of
// 2026-10-15, NOT inferred 2025 intent): when a death would occur and
// bonusJumps > 0, one bonus jump is spent instead of one life; the death
// sequence itself is otherwise unchanged (issue #8).
export const BONUS_JUMPS_ON_DEATH = 1;
