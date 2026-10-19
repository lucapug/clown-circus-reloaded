// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { LeaderboardEntry } from '../../../services/leaderboard';
import { GameOver } from '../GameOver';

afterEach(cleanup);

const entries = (n: number): LeaderboardEntry[] =>
  Array.from({ length: n }, (_, i) => ({ rank: i + 1, name: `Player${i + 1}`, score: (n - i) * 100, date: '2026-01-01' }));

const renderGameOver = (overrides: Partial<Parameters<typeof GameOver>[0]> = {}) => {
  const props = {
    score: 1234,
    onRestart: vi.fn(),
    onSaveScore: vi.fn(async () => {}),
    leaderboard: [] as LeaderboardEntry[],
    ...overrides,
  };
  render(<GameOver {...props} />);
  return props;
};

describe('GameOver (issue #9 DoD c)', () => {
  it('shows the 6-digit final score', () => {
    renderGameOver({ score: 1234 });
    expect(screen.getByTestId('final-score')).toHaveTextContent('001234');
  });

  it('truncates the name input at 10 characters', async () => {
    renderGameOver();
    const input = screen.getByTestId('player-name');
    await userEvent.type(input, 'abcdefghijklmnop');
    expect(input).toHaveValue('abcdefghij');
  });

  it('disables Save until the name is non-empty (trimmed)', async () => {
    renderGameOver();
    const save = screen.getByTestId('save-score');
    expect(save).toBeDisabled();
    await userEvent.type(screen.getByTestId('player-name'), '   ');
    expect(save).toBeDisabled();
    await userEvent.type(screen.getByTestId('player-name'), 'Ada');
    expect(save).toBeEnabled();
  });

  it('saves the TRIMMED name and shows Score Saved!', async () => {
    const props = renderGameOver();
    await userEvent.type(screen.getByTestId('player-name'), '  Ada  ');
    await userEvent.click(screen.getByTestId('save-score'));
    expect(props.onSaveScore).toHaveBeenCalledWith('Ada', 1234);
    expect(await screen.findByText('Score Saved!')).toBeInTheDocument();
  });

  it('renders No scores yet when the leaderboard is empty', () => {
    renderGameOver();
    expect(screen.getByText('No scores yet')).toBeInTheDocument();
  });

  it('renders only the top 10 (duplicated for the seamless 14.4s scroll loop)', () => {
    renderGameOver({ leaderboard: entries(12) });
    // the duplicated-list loop renders slice(0, 10) twice
    expect(screen.getAllByTestId('leaderboard-row')).toHaveLength(20);
    expect(screen.getAllByText(/10\. Player10/)).toHaveLength(2); // both loop copies
    expect(screen.queryByText(/Player11/)).not.toBeInTheDocument();
  });

  it('fires restart from Play Again', () => {
    const props = renderGameOver();
    fireEvent.click(screen.getByTestId('play-again'));
    expect(props.onRestart).toHaveBeenCalledTimes(1);
  });
});
