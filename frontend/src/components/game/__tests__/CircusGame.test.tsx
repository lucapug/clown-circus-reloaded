// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createInitialState } from '../../../game/core';
import type { GamePhase } from '../../../game/core';
import type { GameLoopApi } from '../../../game/useGameLoop';
import type { LeaderboardEntry, LeaderboardService } from '../../../services/leaderboard';
import { CircusGame } from '../CircusGame';

afterEach(cleanup);

// jsdom has no 2d context (and would log a "Not implemented" error); the
// canvas draw effect must bail out cleanly under it.
beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});

const fakeLoop = (phase: GamePhase = 'idle'): GameLoopApi => ({
  frame: { state: { ...createInitialState(), phase }, floatingTexts: [] },
  start: vi.fn(),
  queueInput: vi.fn(),
});

/** Service mock whose fetchLeaderboard returns the next page on every call. */
const fakeService = (pages: LeaderboardEntry[][]): LeaderboardService => {
  let call = 0;
  return {
    fetchLeaderboard: vi.fn(async () => pages[Math.min(call++, pages.length - 1)]),
    submitScore: vi.fn(async () => {}),
  };
};

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
    render(<CircusGame loop={loop} />);
    fireEvent.keyDown(window, { code: 'Space' });
    expect(loop.start).toHaveBeenCalledTimes(1);
    expect(loop.queueInput).not.toHaveBeenCalled();
  });

  it('SPACE while playing queues a launch (and never restarts)', () => {
    const loop = fakeLoop('idle');
    const { rerender } = render(<CircusGame loop={loop} />);
    loop.frame = { state: { ...createInitialState(), phase: 'playing' }, floatingTexts: [] };
    rerender(<CircusGame loop={loop} />);
    fireEvent.keyDown(window, { code: 'Space' });
    expect(loop.queueInput).toHaveBeenCalledWith({ type: 'launch' });
    expect(loop.start).not.toHaveBeenCalled();
  });

  it('a canvas click while playing queues a launch', () => {
    const loop = fakeLoop('playing');
    const { container } = render(<CircusGame loop={loop} />);
    fireEvent.click(canvasEl(container));
    expect(loop.queueInput).toHaveBeenCalledWith({ type: 'launch' });
  });

  it('a canvas click while idle does NOT queue a launch', () => {
    const loop = fakeLoop('idle');
    const { container } = render(<CircusGame loop={loop} />);
    fireEvent.click(canvasEl(container));
    expect(loop.queueInput).not.toHaveBeenCalled();
  });

  it('mouse move queues move-seesaw with the baseline-scaled x', () => {
    const loop = fakeLoop('playing');
    const { container } = render(<CircusGame loop={loop} />);
    withRect(canvasEl(container), 100, 400); // canvas displayed at 400px wide
    fireEvent.mouseMove(canvasEl(container), { clientX: 300 });
    // (300 − 100) * (800 / 400) = 400
    expect(loop.queueInput).toHaveBeenCalledWith({ type: 'move-seesaw', x: 400 });
  });

  it('SPACE while gameover is ignored (Play Again button only, 2025 parity)', () => {
    const loop = fakeLoop('gameover');
    render(<CircusGame loop={loop} />);
    fireEvent.keyDown(window, { code: 'Space' });
    expect(loop.start).not.toHaveBeenCalled();
    expect(loop.queueInput).not.toHaveBeenCalled();
    expect(screen.getByTestId('play-again')).toBeInTheDocument();
  });

  it('shows the start screen and footer while idle', () => {
    const loop = fakeLoop('idle');
    render(<CircusGame loop={loop} />);
    expect(screen.getByRole('button', { name: 'START GAME' })).toBeInTheDocument();
    expect(screen.getByText('Move mouse to control seesaw • Click or SPACE to launch clown')).toBeInTheDocument();
  });

  it('Play Again restarts through the shared start path', () => {
    const loop = fakeLoop('gameover');
    render(<CircusGame loop={loop} />);
    fireEvent.click(screen.getByTestId('play-again'));
    expect(loop.start).toHaveBeenCalledTimes(1);
  });
});

describe('CircusGame leaderboard save flow over the service seam (issue #9 DoD c)', () => {
  it('submits the TRIMMED name, refetches the leaderboard and shows Score Saved!', async () => {
    const saved: LeaderboardEntry[] = [{ rank: 1, name: 'Ada', score: 12345, date: '2026-01-01' }];
    const service = fakeService([[], saved]);
    const loop = fakeLoop('gameover');
    loop.frame = { state: gameoverState(), floatingTexts: [] };

    render(<CircusGame loop={loop} service={service} />);
    expect(screen.getByText('No scores yet')).toBeInTheDocument(); // stub-empty at mount

    await userEvent.type(screen.getByTestId('player-name'), '  Ada  ');
    await userEvent.click(screen.getByTestId('save-score'));

    expect(service.submitScore).toHaveBeenCalledWith('Ada', 12345);
    expect(await screen.findByText('Score Saved!')).toBeInTheDocument();
    expect(service.fetchLeaderboard).toHaveBeenCalledTimes(2); // mount + refetch after save
    const rows = await screen.findAllByText(/1\. Ada/); // refreshed list rendered (duplicated scroll list)
    expect(rows.length).toBeGreaterThanOrEqual(1);
  });

  it('fetches the leaderboard once on mount', () => {
    const service = fakeService([[]]);
    render(<CircusGame loop={fakeLoop('idle')} service={service} />);
    expect(service.fetchLeaderboard).toHaveBeenCalledTimes(1);
  });
});
