// @vitest-environment jsdom
// The M-key marker on the LIVE path (issue #30, test plan 3): real
// useGameLoop, no injection — the only live-path render in the suite. Vitest
// runs with DEV=true, so the DEV-gated recorder and the M-key listener
// attach; production absence is proven by the dist grep, not by a test.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { CircusGame } from '../../../components/game/CircusGame';
import type { LeaderboardService, LeaderboardSnapshot } from '../../../services/leaderboard';

afterEach(cleanup);

beforeEach(() => {
  // jsdom has no 2d context (and would log a "Not implemented" error).
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  // jsdom has no blob-URL store either; the download flow only needs the seam.
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:mock'), revokeObjectURL: vi.fn() }));
  localStorage.clear();
});

const noopService = (): LeaderboardService => ({
  fetchLeaderboard: vi.fn(async (): Promise<LeaderboardSnapshot> => ({ entries: [], source: 'live' })),
  submitScore: vi.fn(),
  drainPendingSubmissions: vi.fn(async () => ({ synced: 0, dropped: 0, stillQueued: 0 })),
});

describe('M-key marker on the live path (issue #30)', () => {
  it('presses M while playing → the exported session carries the marker', () => {
    render(<CircusGame service={noopService()} />);
    fireEvent.keyDown(window, { code: 'Space' }); // idle → start: recorder.start(seed)
    fireEvent.keyDown(window, { code: 'KeyM' }); // playing → marker at the current tick

    const session = window.__game?.exportSession();
    expect(session).not.toBeNull();
    expect(session!.format).toBe('clown-session');
    expect(session!.formatVersion).toBe(1);
    expect(session!.markers).toHaveLength(1);
    expect(session!.markers[0].marker).toBe(true);
    expect(Number.isInteger(session!.markers[0].tick)).toBe(true);
    expect(session!.header.appGitSha).toBe(__APP_GIT_SHA__);
    expect(typeof session!.header.seed).toBe('number');
  });

  it('M while idle records nothing (listener is playing-gated, session not started)', () => {
    render(<CircusGame service={noopService()} />);
    fireEvent.keyDown(window, { code: 'KeyM' });
    expect(window.__game?.exportSession()).toBeNull(); // no session started → recorder ignored the marker
  });

  it('the additive __game surface exposes sessions() and downloadSession()', () => {
    render(<CircusGame service={noopService()} />);
    fireEvent.keyDown(window, { code: 'Space' });
    expect(window.__game!.sessions()).toEqual([]); // nothing finalized yet — the ring is untouched
    const session = window.__game!.exportSession();
    expect(session).not.toBeNull();
    expect(window.__game!.downloadSession()).toMatch(/^clown-session-.+\.json$/);
    expect(window.__game!.replaySession(session!)).toEqual({
      status: 'ok',
      ticksReplayed: 0, // no checkpoints yet
      snapshotsMatched: 0,
    });
  });
});
