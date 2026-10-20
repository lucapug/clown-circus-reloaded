import { advance, createConsequences, TICK_DURATION } from './core';
import type { GameEvent, GameState, Rng, Simulation } from './core';
import { downloadSession } from './recorder/export';
import { replaySession as runReplay } from './recorder/replay';
import { readSessions } from './recorder/sessionStore';
import type { SessionRecorder } from './recorder/sessionRecorder';
import type { JsonSession, ReplayResult } from './recorder/types';
import { pruneTexts, textsFromEvents } from '../components/game/floatingTexts';
import type { FloatingText } from '../components/game/floatingTexts';

// E2E debug hooks (issue #9, decision 6; spec §6.3). Export-only module —
// no side effects at import time. The DEV gate lives AT THE CALL SITE
// (useGameLoop), so Vite statically eliminates this module and the
// window.__game surface from production builds. M4's Playwright layer
// consumes exactly this surface — do not reshape it. Issue #30 adds four
// ADDITIVE session-recorder methods; the original four keep signature and
// semantics.
export interface GameDebugApi {
  /** Synchronous ticks with the live rng + consequences; bypasses rAF/accumulator. */
  advanceTicks(n: number): void;
  /** Snapshot of the live sim state. */
  getState(): Readonly<GameState>;
  /** Shallow top-level merge; nested objects replace wholesale. */
  inject(patch: Partial<GameState>): void;
  /** Fresh level-1 'playing' state (same path as Play Again). */
  reset(seed?: number): void;
  /** #30: the current/last recorded session as a JSON-safe object. */
  exportSession(): JsonSession | null;
  /** #30: blob-download the current/last session as clown-session-<id>.json; returns the filename. */
  downloadSession(): string | null;
  /** #30: the localStorage session ring (last 20 finalized sessions). */
  sessions(): readonly JsonSession[];
  /** #30: deterministic replay of a trace through the untouched core. */
  replaySession(session: JsonSession): ReplayResult;
}

/** Live refs the api closes over — provided by useGameLoop. */
export interface GameDebugRefs {
  sim(): Simulation;
  rng(): Rng;
  texts(): readonly FloatingText[];
  setTexts(texts: FloatingText[]): void;
  publish(): void;
  reset(seed?: number): void;
  /** #30 additive: the live session recorder (null/undefined when idle/unset). */
  recorder?(): SessionRecorder | null | undefined;
}

export const createGameDebugApi = (refs: GameDebugRefs): GameDebugApi => ({
  advanceTicks: (n) => {
    const events: GameEvent[] = [];
    for (let i = 0; i < n; i++) {
      const result = advance(refs.sim(), TICK_DURATION, refs.rng(), createConsequences());
      events.push(...result.events);
    }
    refs.setTexts(pruneTexts([...refs.texts(), ...textsFromEvents(events, refs.sim().state)], Date.now()));
    refs.publish();
  },
  getState: () => refs.sim().state,
  inject: (patch) => {
    refs.sim().state = { ...refs.sim().state, ...patch };
    refs.publish();
  },
  reset: (seed) => refs.reset(seed),
  // #30 additive surface — never reshapes the original four above.
  exportSession: () => refs.recorder?.()?.export() ?? null,
  downloadSession: () => {
    const session = refs.recorder?.()?.export();
    return session ? downloadSession(session) : null;
  },
  sessions: () => readSessions(),
  replaySession: (session) => runReplay(session),
});

export const installDebugHooks = (api: GameDebugApi): void => {
  window.__game = api;
};

declare global {
  interface Window {
    __game?: GameDebugApi;
  }
}
