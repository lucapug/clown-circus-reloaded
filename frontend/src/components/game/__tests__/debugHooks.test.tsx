// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import {
  TICK_DURATION,
  advance,
  createConsequences,
  createInitialState,
  createRng,
  type Simulation,
} from '../../../game/core';
import { createGameDebugApi, installDebugHooks, type GameDebugRefs } from '../../../game/debugHooks';
import { GameHUD } from '../GameHUD';
import { SESSIONS_KEY, type JsonSession } from '../../../game/recorder/types';
import type { SessionRecorder } from '../../../game/recorder/sessionRecorder';

// Issue #9 DoD (f): the DEV-gated window.__game surface, exercised exactly
// the way useGameLoop installs it (same createGameDebugApi + installer), in
// jsdom. Rendering a tiny component alongside proves the jsdom env is live.

afterEach(cleanup);

const rig = (seed = 7, recorder?: GameDebugRefs['recorder']) => {
  const sim: Simulation = { state: { ...createInitialState(), phase: 'playing' }, accumulator: 0 };
  let rng = createRng(seed);
  const api = createGameDebugApi({
    sim: () => sim,
    rng: () => rng,
    texts: () => [],
    setTexts: () => {},
    publish: () => {},
    reset: (s) => {
      sim.state = { ...createInitialState(), phase: 'playing' };
      sim.accumulator = 0;
      rng = createRng(s ?? seed);
    },
    recorder,
  });
  installDebugHooks(api);
  return { sim, api };
};

/** A flying clown so advanceTicks provably integrates physics. */
const injectFlier = () => {
  const game = window.__game!;
  const clowns = game.getState().clowns.map((c, i) =>
    i === 0 ? { ...c, x: 400, y: 300, vx: 2, vy: 0, isFlying: true, isOnSeesaw: false } : c,
  );
  game.inject({ clowns });
};

describe('window.__game debug hooks (issue #9 DoD f)', () => {
  it('install exposes the four-function debug api on window.__game', () => {
    rig();
    expect(window.__game).toBeDefined();
    expect(typeof window.__game!.advanceTicks).toBe('function');
    expect(typeof window.__game!.getState).toBe('function');
    expect(typeof window.__game!.inject).toBe('function');
    expect(typeof window.__game!.reset).toBe('function');
  });

  it('advanceTicks advances the live sim deterministically (bypasses rAF)', () => {
    rig(7);
    injectFlier();
    const yBefore = window.__game!.getState().clowns[0].y;
    window.__game!.advanceTicks(10);
    expect(window.__game!.getState().clowns[0].y).toBeGreaterThan(yBefore);

    // determinism: the same seed + same ticks → the same final state
    rig(7);
    injectFlier();
    window.__game!.advanceTicks(10);
    const a = window.__game!.getState();

    rig(7);
    injectFlier();
    window.__game!.advanceTicks(10);
    expect(window.__game!.getState()).toEqual(a);
  });

  it('advanceTicks matches n manual advance(sim, 1/60, …) calls', () => {
    rig(11);
    injectFlier();
    window.__game!.advanceTicks(5);
    const viaApi = window.__game!.getState();

    // manual reference: the same starting playing state with the same
    // injection, stepped by hand through the raw advance driver
    const reference: Simulation = { state: { ...createInitialState(), phase: 'playing' }, accumulator: 0 };
    reference.state = {
      ...reference.state,
      clowns: reference.state.clowns.map((c, i) =>
        i === 0 ? { ...c, x: 400, y: 300, vx: 2, vy: 0, isFlying: true, isOnSeesaw: false } : c,
      ),
    };
    for (let i = 0; i < 5; i++) advance(reference, TICK_DURATION, createRng(11), createConsequences());

    expect(viaApi).toEqual(reference.state);
  });

  it('inject({ stats … }) with lives 0 reaches game over through the core step-8 check next tick', () => {
    rig();
    window.__game!.inject({ stats: { score: 123, lives: 0, bonusJumps: 0 } });
    expect(window.__game!.getState().stats).toEqual({ score: 123, lives: 0, bonusJumps: 0 });
    expect(window.__game!.getState().phase).toBe('playing');
    window.__game!.advanceTicks(1);
    expect(window.__game!.getState().phase).toBe('gameover');
  });

  it('inject({ phase: "gameover" }) shows the overlay state instantly (no ticks)', () => {
    rig();
    window.__game!.inject({ phase: 'gameover' });
    expect(window.__game!.getState().phase).toBe('gameover');
  });

  it('inject replaces nested top-level objects wholesale', () => {
    rig();
    window.__game!.inject({ seesaw: { x: 555, y: 520, width: 120, tilt: 'right' } });
    expect(window.__game!.getState().seesaw).toEqual({ x: 555, y: 520, width: 120, tilt: 'right' });
  });

  it('reset(seed) restores a fresh level-1 playing state', () => {
    rig();
    window.__game!.advanceTicks(3);
    window.__game!.inject({ stats: { score: 999, lives: 1, bonusJumps: 1 } });
    window.__game!.reset(42);
    const state = window.__game!.getState();
    expect(state.phase).toBe('playing');
    expect(state.level).toBe(1);
    expect(state.stats).toEqual({ score: 0, lives: 3, bonusJumps: 0 });
    expect(state.balloons).toHaveLength(56);
    expect(state.balloons.every((b) => !b.popped)).toBe(true);
  });

  it('the jsdom environment is real (sanity: a component renders alongside)', () => {
    render(<GameHUD score={7} lives={3} bonusJumps={1} />);
    expect(screen.getByTestId('hud-score').textContent).toBe('000007');
  });
});

// Issue #33: downloadSession must fall back to the newest FINALIZED ring
// session when no live recorder exists, and never give up silently.
describe('downloadSession ring fallback (issue #33)', () => {
  const createObjectURL = vi.fn<(blob: Blob) => string>(() => 'blob:mock-url');
  const revokeObjectURL = vi.fn<(url: string) => void>(() => {});
  const realCreateObjectURL = URL.createObjectURL;
  const realRevokeObjectURL = URL.revokeObjectURL;
  let clickedDownload: string | null = null;
  let infoSpy: ReturnType<typeof vi.spyOn>;

  const ringSession = (sessionId: string): JsonSession => ({
    format: 'clown-session',
    formatVersion: 1,
    header: { sessionId, startedAt: '2026-10-20T00:00:00.000Z', appGitSha: 'sha', seed: 7 },
    inputs: [],
    events: [],
    snapshots: [],
    markers: [],
    terminal: null,
  });

  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    URL.createObjectURL = createObjectURL as unknown as typeof URL.createObjectURL;
    URL.revokeObjectURL = revokeObjectURL as unknown as typeof URL.revokeObjectURL;
    createObjectURL.mockClear();
    revokeObjectURL.mockClear();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clickedDownload = this.download;
    });
    infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    URL.createObjectURL = realCreateObjectURL;
    URL.revokeObjectURL = realRevokeObjectURL;
    vi.restoreAllMocks();
    vi.useRealTimers();
    clickedDownload = null;
  });

  it('downloads the newest finalized ring session when the live recorder is null', () => {
    rig(7, () => null);
    localStorage.setItem(SESSIONS_KEY, JSON.stringify([ringSession('old-1'), ringSession('new-2')]));
    expect(window.__game!.downloadSession()).toBe('clown-session-new-2.json');
    expect(clickedDownload).toBe('clown-session-new-2.json');
    expect(infoSpy).not.toHaveBeenCalled();
    vi.advanceTimersByTime(10_000); // drain the deferred revocation
  });

  it('prefers the live recorder export over the ring', () => {
    const live = ringSession('live-3');
    rig(7, () => ({ export: () => live }) as SessionRecorder);
    localStorage.setItem(SESSIONS_KEY, JSON.stringify([ringSession('old-1')]));
    expect(window.__game!.downloadSession()).toBe('clown-session-live-3.json');
    vi.advanceTimersByTime(10_000);
  });

  it('logs an info and returns null (no throw) when nothing exists anywhere', () => {
    rig(7, () => null);
    expect(() => window.__game!.downloadSession()).not.toThrow();
    expect(window.__game!.downloadSession()).toBeNull();
    expect(infoSpy).toHaveBeenCalledTimes(2);
    expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining('no session yet'));
  });
});
