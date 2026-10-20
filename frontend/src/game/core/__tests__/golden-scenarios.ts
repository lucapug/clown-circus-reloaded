import { LANDING_Y } from '../constants';
import type { GameEvent } from '../events';
import { nullConsequences, step } from '../engine';
import { createRng } from '../rng';
import { createInitialState } from '../state';
import type { Clown, ConsequenceReducer, GameInput, GameState } from '../types';

// Shared, fully deterministic scenario definitions for the golden-tick and
// reproducibility tests (issue #6 AC 1–2). Snapshot ticks per the DoD.
export const SNAPSHOT_TICKS = [1, 30, 60, 120, 300] as const;
export const SCENARIO_TICKS = 300;

export const playing = (overrides: Partial<GameState> = {}): GameState => ({
  ...createInitialState(),
  phase: 'playing',
  ...overrides,
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

export type InputsAt = (state: GameState, tick: number) => GameInput[];

export interface ScenarioRun {
  finalState: GameState;
  events: GameEvent[];
  snapshots: Record<number, GameState>;
  /** Events emitted in each snapshot tick, in emission order (design decision 1). */
  eventSnapshots: Record<number, GameEvent[]>;
}

export const runScenario = (
  start: GameState,
  inputsAt: InputsAt,
  seed: number,
  consequences: ConsequenceReducer = nullConsequences,
): ScenarioRun => {
  let state = start;
  const rng = createRng(seed);
  const events: GameEvent[] = [];
  const snapshots: Record<number, GameState> = {};
  const eventSnapshots: Record<number, GameEvent[]> = {};
  for (let tick = 1; tick <= SCENARIO_TICKS; tick++) {
    const result = step(state, inputsAt(state, tick), rng, consequences);
    state = result.state;
    events.push(...result.events);
    if ((SNAPSHOT_TICKS as readonly number[]).includes(tick)) {
      snapshots[tick] = state;
      eventSnapshots[tick] = result.events;
    }
  }
  return { finalState: state, events, snapshots, eventSnapshots };
};

// (a) Seed 42: diving-board clown launched at tick 10; the tick-20 launch is
// a no-op since issue #35 (lever-only launch, spec §3.4 — no board clown left
// by then), so the run diverges from the pre-#35 fixture from tick 20 on.
// Periodic move-seesaw every 7th tick.
export const scenarioAInputs: InputsAt = (_state, tick) => {
  const inputs: GameInput[] = [];
  if (tick === 10 || tick === 20) inputs.push({ type: 'launch' });
  if (tick % 7 === 0) inputs.push({ type: 'move-seesaw', x: 400 + ((tick * 37) % 280) - 140 });
  return inputs;
};

// (b) Constructed chain-launch/edge-landing stretch: a flying clown lands on
// the right edge at tick 1 (chain-launching the seated clown with the
// strengthened velocity), then a fixed intercept heuristic steers the seesaw
// under later descents (aim: the left edge).
export const scenarioBStart = (): GameState =>
  playing({ balloons: [], clowns: [seatedLeft(370), flying(440, LANDING_Y, 0, 0)] });

export const scenarioBInputs: InputsAt = (state) => {
  const inputs: GameInput[] = [];
  if (state.clowns.some((c) => c.isOnDivingBoard)) inputs.push({ type: 'launch' });
  const flyer = state.clowns.find((c) => c.isFlying);
  if (flyer && flyer.vy > 6 && flyer.y > 350) {
    inputs.push({ type: 'move-seesaw', x: flyer.x + 40 });
  }
  return inputs;
};

// (c) One scripted scenario per death cause, states constructed directly
// (functions are pure). Lives = 1 under nullConsequences so the snapshots
// also prove the kernel never writes stats.
export interface DeathScenario {
  name: 'c-middle' | 'c-occupied-edge' | 'c-fall-off';
  cause: 'middle' | 'occupied-edge' | 'fall-off';
  start: GameState;
}

export const deathScenarios = (): DeathScenario[] => [
  {
    name: 'c-middle',
    cause: 'middle',
    start: playing({
      balloons: [],
      clowns: [flying(400, LANDING_Y, 0, 0), seatedLeft(370)],
      stats: { score: 0, lives: 1, bonusJumps: 0 },
    }),
  },
  {
    name: 'c-occupied-edge',
    cause: 'occupied-edge',
    start: playing({
      balloons: [],
      clowns: [seatedLeft(370), flying(380, LANDING_Y, 0, 0)],
      stats: { score: 0, lives: 1, bonusJumps: 0 },
    }),
  },
  {
    name: 'c-fall-off',
    cause: 'fall-off',
    // Seated clown on the RIGHT: under the owner free-side rule (issue #6
    // comment 6252402875) the entering clown takes the LEFT board — this is
    // what distinguishes the rule from the 2025 always-right hardcode.
    start: playing({
      balloons: [],
      clowns: [flying(200, 650, 0, 0), seatedRight(430)],
      stats: { score: 0, lives: 1, bonusJumps: 0 },
    }),
  },
];
