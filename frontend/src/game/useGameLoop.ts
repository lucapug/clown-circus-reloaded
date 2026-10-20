import { useCallback, useEffect, useRef, useState } from 'react';
import {
  advance,
  createConsequences,
  createInitialState,
  createRng,
  type GameEvent,
  type GameInput,
  type GameState,
  type Rng,
  type Simulation,
} from './core';
import { createGameDebugApi, installDebugHooks } from './debugHooks';
import { projectSnapshot } from './recorder/snapshot';
import type { SessionRecorder } from './recorder/sessionRecorder';
import { pruneTexts, textsFromEvents } from '../components/game/floatingTexts';
import type { FloatingText } from '../components/game/floatingTexts';

// The rAF driver (issue #9, decisions 1 and 4) — OUTSIDE core/ so the
// deterministic kernel stays framework-free (spec §6.1). The hook owns the
// Simulation + seeded Rng refs, the rAF lifecycle, real dt from rAF
// timestamps (the in-advance 600-tick cap is the spiral guard), the
// pending-input queue, floating-text aging, and DEV-only debug-hook
// installation. Each frame publishes a FRESH wrapper object so React
// re-renders and the canvas redraws in ALL phases (the animated rainbow
// border stays alive; step() no-ops while phase ≠ 'playing').
// Issue #30 adds the cumulative logic-tick counter (tickRef) and the
// optional DEV session recorder plumbing.

export interface GameFrame {
  state: GameState;
  floatingTexts: FloatingText[];
}

export interface GameLoopApi {
  frame: GameFrame;
  /** Fresh level-1 'playing' simulation with a new seed (tests/debug pass fixed seeds). */
  start: (seed?: number) => void;
  /** Queue an input for the next frame's first tick boundary. */
  queueInput: (input: GameInput) => void;
  /** #30: cumulative logic tick of the last advanced frame (0 before the first tick) — the M-key marker source. */
  getTick?: () => number;
}

interface UseGameLoopOptions {
  /** The clean #11 audio seam — wired but unused in #9. */
  onEvents?: (events: GameEvent[]) => void;
  /** #30: DEV-only session recorder; undefined in production, so every recording branch no-ops. */
  recorder?: SessionRecorder | null;
}

const randomSeed = (): number => Math.floor(Math.random() * 2 ** 31);

export const useGameLoop = (options: UseGameLoopOptions = {}): GameLoopApi => {
  const simRef = useRef<Simulation>({ state: createInitialState(), accumulator: 0 });
  const rngRef = useRef<Rng>(createRng(randomSeed()));
  const pendingRef = useRef<GameInput[]>([]);
  const textsRef = useRef<FloatingText[]>([]);
  const tickRef = useRef(0);
  const [frame, setFrame] = useState<GameFrame>(() => ({ state: simRef.current.state, floatingTexts: [] }));

  // Ref-mirrored so rAF and the debug api always see the latest callback
  // without resubscribing the loop.
  const onEventsRef = useRef(options.onEvents);
  onEventsRef.current = options.onEvents;
  const recorderRef = useRef(options.recorder);
  recorderRef.current = options.recorder;

  const publish = useCallback(() => {
    setFrame({ state: simRef.current.state, floatingTexts: [...textsRef.current] });
  }, []);

  // One shared path for start and Play Again: fresh Simulation at level 1,
  // 'playing' by construction, NEW random seed for live play, queue and
  // texts cleared.
  const start = useCallback((seed?: number) => {
    const effectiveSeed = seed ?? randomSeed(); // #30: captured once — the recorder only ever sees the concrete number
    rngRef.current = createRng(effectiveSeed);
    simRef.current = { state: { ...createInitialState(), phase: 'playing' }, accumulator: 0 };
    tickRef.current = 0;
    pendingRef.current = [];
    textsRef.current = [];
    recorderRef.current?.start(effectiveSeed);
    setFrame({ state: simRef.current.state, floatingTexts: [] });
  }, []);

  const queueInput = useCallback((input: GameInput) => {
    pendingRef.current.push(input);
  }, []);

  const getTick = useCallback(() => tickRef.current, []);

  useEffect(() => {
    // DEV-gated AT THE CALL SITE so Vite statically eliminates the debug
    // module (and window.__game) from production bundles.
    if (import.meta.env.DEV) {
      installDebugHooks(
        createGameDebugApi({
          sim: () => simRef.current,
          rng: () => rngRef.current,
          texts: () => textsRef.current,
          setTexts: (texts) => {
            textsRef.current = texts;
          },
          publish,
          reset: start,
          recorder: () => recorderRef.current,
        }),
      );
    }

    let raf = 0;
    let last = performance.now();
    const onFrame = (now: number) => {
      const dtSeconds = (now - last) / 1000;
      last = now;

      // The #7 wiring contract, completed with the #9 inputs seam (decision 2):
      // drain pending inputs → advance → resubmit them when no tick ran.
      const taken = pendingRef.current.splice(0);
      const firstTick = tickRef.current + 1;
      const result = advance(simRef.current, dtSeconds, rngRef.current, createConsequences(), taken);
      if (result.ticks === 0 && taken.length > 0) pendingRef.current.unshift(...taken);
      tickRef.current += result.ticks;

      // #30 DEV recording (issue #30). The recorder is undefined in
      // production (DEV-gated at the call sites), so the block below no-ops
      // and tree-shakes. Recording targets ORGANIC play only:
      // __game.advanceTicks/inject bypass these seams and invalidate an
      // active trace (documented limitation, no fix this cycle).
      const recorder = recorderRef.current;
      if (recorder) {
        if (result.ticks > 0) for (const input of taken) recorder.recordInput(firstTick, input);
        if (result.events.length > 0) recorder.recordEvents(firstTick, result.events);
        // Normative boundary crossing: the first frame whose end crosses a
        // 600k boundary (floor(end/600) > floor(prev/600)).
        if (result.ticks > 0 && Math.floor(tickRef.current / 600) > Math.floor((firstTick - 1) / 600)) {
          recorder.recordSnapshot(tickRef.current, projectSnapshot(result.state));
        }
        if (result.state.phase === 'gameover') {
          recorder.recordTerminal(tickRef.current, projectSnapshot(result.state)); // idempotent; writes the ring once
        }
      }

      // Floating texts are presentation-owned: mapped from this frame's
      // events, aged and pruned here (1 s lifetime), never in GameState.
      const nowMs = Date.now();
      const spawned = textsFromEvents(result.events, result.state);
      textsRef.current = pruneTexts([...textsRef.current, ...spawned], nowMs);

      onEventsRef.current?.(result.events);
      setFrame({ state: result.state, floatingTexts: textsRef.current });

      raf = requestAnimationFrame(onFrame);
    };
    raf = requestAnimationFrame(onFrame);
    return () => cancelAnimationFrame(raf);
  }, [publish, start]);

  return { frame, start, queueInput, getTick };
};
