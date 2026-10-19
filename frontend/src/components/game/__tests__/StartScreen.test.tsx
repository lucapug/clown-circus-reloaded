// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { LeaderboardEntry } from '../../../services/leaderboard';
import { StartScreen } from '../StartScreen';

afterEach(cleanup);

const entries = (n: number): LeaderboardEntry[] =>
  Array.from({ length: n }, (_, i) => ({ rank: i + 1, name: `Player${i + 1}`, score: (n - i) * 100, date: '2026-01-01' }));

describe('StartScreen (issue #9 DoD b)', () => {
  it('renders the per-letter titles, HOW TO PLAY, scoring legend and START button', () => {
    const { container } = render(<StartScreen onStart={vi.fn()} leaderboard={[]} />);

    expect(container.querySelector('h1')?.textContent).toBe('CIRCUS');
    expect(container.querySelector('h2')?.textContent).toBe('CLOWNS');
    expect(screen.getByText('HOW TO PLAY')).toBeInTheDocument();
    expect(screen.getByText('SCORING')).toBeInTheDocument();
    expect(screen.getByText('Yellow: 20 pts')).toBeInTheDocument();
    expect(screen.getByText('Green: 50 pts')).toBeInTheDocument();
    expect(screen.getByText('Blue: 100 pts')).toBeInTheDocument();
    expect(screen.getByText('Clear row = Bonus!')).toBeInTheDocument();
    expect(screen.getByText('Clear the blue row = +1 Jump · A Jump absorbs one crash')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'START GAME' })).toBeInTheDocument();
    expect(screen.getByText('Click or press SPACE to begin')).toBeInTheDocument();
  });

  it('hides the HIGH SCORES block when the leaderboard is empty', () => {
    render(<StartScreen onStart={vi.fn()} leaderboard={[]} />);
    expect(screen.queryByTestId('high-scores')).not.toBeInTheDocument();
  });

  it('shows only the top-3 rows when 5 entries exist', () => {
    render(<StartScreen onStart={vi.fn()} leaderboard={entries(5)} />);
    expect(screen.getByTestId('high-scores')).toBeInTheDocument();
    const rows = screen.getAllByTestId('high-score-row');
    expect(rows).toHaveLength(3);
    expect(screen.getByText('Player1')).toBeInTheDocument();
    expect(screen.queryByText('Player4')).not.toBeInTheDocument();
  });

  it('fires onStart from the START GAME button', () => {
    const onStart = vi.fn();
    render(<StartScreen onStart={onStart} leaderboard={[]} />);
    fireEvent.click(screen.getByRole('button', { name: 'START GAME' }));
    expect(onStart).toHaveBeenCalledTimes(1);
  });
});

describe('StartScreen offline indicator (issue #10, the one sanctioned line)', () => {
  it('shows the badge beside HIGH SCORES when offline with cached entries', () => {
    render(<StartScreen onStart={vi.fn()} leaderboard={entries(5)} offline />);
    expect(screen.getByTestId('offline-indicator')).toHaveTextContent('Offline — showing saved scores');
    expect(screen.getByTestId('high-scores')).toBeInTheDocument();
  });

  it('renders no badge when online', () => {
    render(<StartScreen onStart={vi.fn()} leaderboard={entries(5)} />);
    expect(screen.queryByTestId('offline-indicator')).not.toBeInTheDocument();
  });

  it('offline-and-empty keeps the hidden HIGH SCORES block (no badge anywhere)', () => {
    render(<StartScreen onStart={vi.fn()} leaderboard={[]} offline />);
    expect(screen.queryByTestId('high-scores')).not.toBeInTheDocument();
    expect(screen.queryByTestId('offline-indicator')).not.toBeInTheDocument();
  });
});
