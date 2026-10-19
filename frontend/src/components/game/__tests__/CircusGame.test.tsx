// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createInitialState } from '../../../game/core';
import type { GamePhase } from '../../../game/core';
import type { GameLoopApi } from '../../../game/useGameLoop';
import type {
  LeaderboardEntry,
  LeaderboardService,
  LeaderboardSnapshot,
  SubmitScoreOutcome,
} from '../../../services/leaderboard';
import { CircusGame } from '../CircusGame';
import type { AudioService } from '../../../game/audio';

afterEach(cleanup);

// jsdom has no 2d context (and would log a "Not implemented" error); the
// canvas draw effect must bail out cleanly under it.
beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  localStorage.clear();
});

const fakeLoop = (phase: GamePhase = 'idle'): GameLoopApi => ({
  frame: { state: { ...createInitialState(), phase }, floatingTexts: [] },
  start: vi.fn(),
  queueInput: vi.fn(),
});

const live = (entries: LeaderboardEntry[]): LeaderboardSnapshot => ({ entries, source: 'live' });

interface FakeAudio extends AudioService {
  pop: ReturnType<typeof vi.fn>;
  bonus: ReturnType<typeof vi.fn>;
  death: ReturnType<typeof vi.fn>;
  bounce: ReturnType<typeof vi.fn>;
  gameOverJingle: ReturnType<typeof vi.fn>;
  startBackground: ReturnType<typeof vi.fn>;
  stopAll: ReturnType<typeof vi.fn>;
}

/** Audio mock over the #11 injection seam (same pattern as the loop/service fakes). */
const fakeAudio = (): FakeAudio => ({
  pop: vi.fn(),
  bonus: vi.fn(),
  death: vi.fn(),
  bounce: vi.fn(),
  gameOverJingle: vi.fn(),
  startBackground: vi.fn(),
  stopAll: vi.fn(),
});

interface FakeService extends LeaderboardService {
  fetchLeaderboard: ReturnType<typeof vi.fn>;
  submitScore: ReturnType<typeof vi.fn>;
  drainPendingSubmissions: ReturnType<typeof vi.fn>;
}

/** Service mock whose fetchLeaderboard returns the next page on every call (#10: snapshots, not bare arrays). */
const fakeService = (pages: LeaderboardSnapshot[]): FakeService => {
  let call = 0;
  return {
    fetchLeaderboard: vi.fn(async () => pages[Math.min(call++, pages.length - 1)]),
    submitScore: vi.fn(async (): Promise<SubmitScoreOutcome> => ({ status: 'saved', submissionId: 'sub-test' })),
    drainPendingSubmissions: vi.fn(async () => ({ synced: 0, dropped: 0, stillQueued: 0 })),
  };
};

const noopService = (): FakeService => fakeService([]);

const gameoverState = () => ({
  ...createInitialState(),
  phase: 'gameover' as const,
  stats: { score: 12345, lives: 0, bonusJumps: 2 },
});

const canvasEl = (container: HTMLElement): HTMLCanvasElement => {
  const canvas = container.querySelector('canvas');
  if (!canvas) throw new Error('canvas not rendered');
  return canvas;
};

const withRect = (canvas: HTMLCanvasElement, left: number, width: number) => {
  canvas.getBoundingClientRect = () =>
    ({ left, width, height: 300, top: 0, right: left + width, bottom: 300, x: left, y: 0, toJSON: () => ({}) }) as DOMRect;
};

describe('CircusGame flows with an injected fake loop (issue #9 DoD d)', () => {
  it('SPACE while idle starts the game', () => {
    const loop = fakeLoop('idle');
    render(<CircusGame loop={loop} service={noopService()} />);
    fireEvent.keyDown(window, { code: 'Space' });
    expect(loop.start).toHaveBeenCalledTimes(1);
    expect(loop.queueInput).not.toHaveBeenCalled();
  });

  it('SPACE while playing queues a launch (and never restarts)', () => {
    const loop = fakeLoop('idle');
    const { rerender } = render(<CircusGame loop={loop} service={noopService()} />);
    loop.frame = { state: { ...createInitialState(), phase: 'playing' }, floatingTexts: [] };
    rerender(<CircusGame loop={loop} service={noopService()} />);
    fireEvent.keyDown(window, { code: 'Space' });
    expect(loop.queueInput).toHaveBeenCalledWith({ type: 'launch' });
    expect(loop.start).not.toHaveBeenCalled();
  });

  it('a canvas click while playing queues a launch', () => {
    const loop = fakeLoop('playing');
    const { container } = render(<CircusGame loop={loop} service={noopService()} />);
    fireEvent.click(canvasEl(container));
    expect(loop.queueInput).toHaveBeenCalledWith({ type: 'launch' });
  });

  it('a canvas click while idle does NOT queue a launch', () => {
    const loop = fakeLoop('idle');
    const { container } = render(<CircusGame loop={loop} service={noopService()} />);
    fireEvent.click(canvasEl(container));
    expect(loop.queueInput).not.toHaveBeenCalled();
  });

  it('mouse move queues move-seesaw with the baseline-scaled x', () => {
    const loop = fakeLoop('playing');
    const { container } = render(<CircusGame loop={loop} service={noopService()} />);
    withRect(canvasEl(container), 100, 400); // canvas displayed at 400px wide
    fireEvent.mouseMove(canvasEl(container), { clientX: 300 });
    // (300 − 100) * (800 / 400) = 400
    expect(loop.queueInput).toHaveBeenCalledWith({ type: 'move-seesaw', x: 400 });
  });

  it('SPACE while gameover is ignored (Play Again button only, 2025 parity)', () => {
    const loop = fakeLoop('gameover');
    render(<CircusGame loop={loop} service={noopService()} />);
    fireEvent.keyDown(window, { code: 'Space' });
    expect(loop.start).not.toHaveBeenCalled();
    expect(loop.queueInput).not.toHaveBeenCalled();
    expect(screen.getByTestId('play-again')).toBeInTheDocument();
  });

  it('shows the start screen and footer while idle', () => {
    const loop = fakeLoop('idle');
    render(<CircusGame loop={loop} service={noopService()} />);
    expect(screen.getByRole('button', { name: 'START GAME' })).toBeInTheDocument();
    expect(screen.getByText('Move mouse to control seesaw • Click or SPACE to launch clown')).toBeInTheDocument();
  });

  it('Play Again restarts through the shared start path', () => {
    const loop = fakeLoop('gameover');
    render(<CircusGame loop={loop} service={noopService()} />);
    fireEvent.click(screen.getByTestId('play-again'));
    expect(loop.start).toHaveBeenCalledTimes(1);
  });
});

describe('CircusGame audio start path (issue #11 DoD 2 — jingle stops when a new game starts)', () => {
  it('Play Again runs audio.stopAll → loop.start → audio.startBackground, in that order', () => {
    const loop = fakeLoop('gameover');
    const audio = fakeAudio();
    render(<CircusGame loop={loop} service={noopService()} audio={audio} />);
    fireEvent.click(screen.getByTestId('play-again'));
    expect(audio.stopAll).toHaveBeenCalledTimes(1);
    expect(audio.startBackground).toHaveBeenCalledTimes(1);
    expect(loop.start).toHaveBeenCalledTimes(1);
    const stopOrder = audio.stopAll.mock.invocationCallOrder[0];
    const startOrder = vi.mocked(loop.start).mock.invocationCallOrder[0];
    const bgOrder = audio.startBackground.mock.invocationCallOrder[0];
    expect(stopOrder).toBeLessThan(startOrder);
    expect(startOrder).toBeLessThan(bgOrder);
  });

  it('SPACE while idle runs the same audio start sequence (stopAll before startBackground)', () => {
    const loop = fakeLoop('idle');
    const audio = fakeAudio();
    render(<CircusGame loop={loop} service={noopService()} audio={audio} />);
    fireEvent.keyDown(window, { code: 'Space' });
    expect(audio.stopAll).toHaveBeenCalledTimes(1);
    expect(audio.startBackground).toHaveBeenCalledTimes(1);
    expect(loop.start).toHaveBeenCalledTimes(1);
    expect(audio.stopAll.mock.invocationCallOrder[0]).toBeLessThan(audio.startBackground.mock.invocationCallOrder[0]);
  });
});

describe('CircusGame leaderboard save flow over the service seam (issue #9 DoD c, #10 outcomes)', () => {
  it('submits the TRIMMED name, refetches the leaderboard and shows Score Saved!', async () => {
    const saved: LeaderboardEntry[] = [{ rank: 1, name: 'Ada', score: 12345, date: '2026-01-01' }];
    const service = fakeService([live([]), live(saved)]);
    const loop = fakeLoop('gameover');
    loop.frame = { state: gameoverState(), floatingTexts: [] };

    render(<CircusGame loop={loop} service={service} />);
    expect(screen.getByText('No scores yet')).toBeInTheDocument(); // empty at mount

    await userEvent.type(screen.getByTestId('player-name'), '  Ada  ');
    await userEvent.click(screen.getByTestId('save-score'));

    expect(service.submitScore).toHaveBeenCalledWith('Ada', 12345);
    expect(await screen.findByText('Score Saved!')).toBeInTheDocument();
    expect(service.fetchLeaderboard).toHaveBeenCalledTimes(2); // mount + refetch after save
    const rows = await screen.findAllByText(/1\. Ada/); // refreshed list rendered (duplicated scroll list)
    expect(rows.length).toBeGreaterThanOrEqual(1);
  });

  it('fetches the leaderboard once on mount', async () => {
    const service = fakeService([live([])]);
    render(<CircusGame loop={fakeLoop('idle')} service={service} />);
    await waitFor(() => expect(service.fetchLeaderboard).toHaveBeenCalledTimes(1)); // after the async drain
    expect(service.fetchLeaderboard).toHaveBeenCalledTimes(1);
  });
});

describe('CircusGame offline queue wiring (issue #10)', () => {
  it('drains pending submissions BEFORE fetching on mount', async () => {
    const service = fakeService([live([])]);
    render(<CircusGame loop={fakeLoop('idle')} service={service} />);
    await waitFor(() => expect(service.fetchLeaderboard).toHaveBeenCalledTimes(1));
    expect(service.drainPendingSubmissions).toHaveBeenCalledTimes(1);
    const drainOrder = service.drainPendingSubmissions.mock.invocationCallOrder[0];
    const fetchOrder = service.fetchLeaderboard.mock.invocationCallOrder[0];
    expect(drainOrder).toBeLessThan(fetchOrder);
  });

  it('renders the sync notice once when the mount drain dropped entries', async () => {
    const service = fakeService([live([])]);
    service.drainPendingSubmissions.mockResolvedValue({ synced: 0, dropped: 2, stillQueued: 0 });
    render(<CircusGame loop={fakeLoop('idle')} service={service} />);
    expect(await screen.findByTestId('sync-notice')).toHaveTextContent('2 offline score(s) rejected by server');
  });

  it('no sync notice when the drain dropped nothing', async () => {
    render(<CircusGame loop={fakeLoop('idle')} service={fakeService([live([])])} />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'START GAME' })).toBeInTheDocument());
    expect(screen.queryByTestId('sync-notice')).not.toBeInTheDocument();
  });

  it('flags the start screen offline when the snapshot came from the cache', async () => {
    const cached: LeaderboardEntry[] = [{ rank: 1, name: 'Ada', score: 100, date: '2026-01-01' }];
    render(<CircusGame loop={fakeLoop('idle')} service={fakeService([{ entries: cached, source: 'cached' }])} />);
    expect(await screen.findByTestId('offline-indicator')).toHaveTextContent('Offline — showing saved scores');
    expect(screen.getByTestId('high-scores')).toBeInTheDocument();
  });

  it('live snapshots render no offline indicator', async () => {
    render(<CircusGame loop={fakeLoop('idle')} service={fakeService([live([])])} />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'START GAME' })).toBeInTheDocument());
    expect(screen.queryByTestId('offline-indicator')).not.toBeInTheDocument();
  });

  it('shows the honest offline-queued message when the service queues the save', async () => {
    const service = fakeService([live([]), live([])]);
    service.submitScore.mockResolvedValue({ status: 'queued', submissionId: 'sub-1' });
    const loop = fakeLoop('gameover');
    loop.frame = { state: gameoverState(), floatingTexts: [] };
    render(<CircusGame loop={loop} service={service} />);

    await userEvent.type(screen.getByTestId('player-name'), 'Ada');
    await userEvent.click(screen.getByTestId('save-score'));

    expect(await screen.findByTestId('save-queued')).toHaveTextContent('Saved offline — will sync');
    expect(screen.queryByText('Score Saved!')).not.toBeInTheDocument();
  });

  it('a rejected save never shows "Saved" and skips the leaderboard refetch', async () => {
    const service = fakeService([live([])]);
    service.submitScore.mockResolvedValue({ status: 'rejected', reason: 'conflict', httpStatus: 409 });
    const loop = fakeLoop('gameover');
    loop.frame = { state: gameoverState(), floatingTexts: [] };
    render(<CircusGame loop={loop} service={service} />);

    await userEvent.type(screen.getByTestId('player-name'), 'Ada');
    await userEvent.click(screen.getByTestId('save-score'));

    expect(await screen.findByTestId('save-rejected')).toHaveTextContent('Could not save: sync conflict');
    expect(screen.queryByText('Score Saved!')).not.toBeInTheDocument();
    expect(service.fetchLeaderboard).toHaveBeenCalledTimes(1); // mount only — nothing changed
  });
});
