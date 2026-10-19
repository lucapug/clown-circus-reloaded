// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { GameHUD } from '../GameHUD';

afterEach(cleanup);

describe('GameHUD (issue #9 DoD a)', () => {
  it('zero-pads the score to 6 digits', () => {
    render(<GameHUD score={50} lives={3} bonusJumps={2} />);
    expect(screen.getByTestId('hud-score')).toHaveTextContent('000050');
  });

  it('renders the Jumps label and value unconditionally, even at 0', () => {
    render(<GameHUD score={0} lives={3} bonusJumps={0} />);
    expect(screen.getByText('Jumps')).toBeInTheDocument();
    expect(screen.getByTestId('hud-jumps')).toHaveTextContent('0');
  });

  it('renders at least 3 pips with filled = lives when below 3', () => {
    render(<GameHUD score={0} lives={2} bonusJumps={4} />);
    const pips = screen.getAllByTestId('life-pip');
    expect(pips).toHaveLength(3);
    expect(pips.filter((pip) => pip.dataset.filled === 'true')).toHaveLength(2);
  });

  it('renders exactly 3 pips, all filled, at 3 lives', () => {
    render(<GameHUD score={0} lives={3} bonusJumps={0} />);
    const pips = screen.getAllByTestId('life-pip');
    expect(pips).toHaveLength(3);
    expect(pips.filter((pip) => pip.dataset.filled === 'true')).toHaveLength(3);
  });

  it('shows a 4th filled pip when a 4th life is earned (dynamic pips)', () => {
    render(<GameHUD score={0} lives={4} bonusJumps={0} />);
    const pips = screen.getAllByTestId('life-pip');
    expect(pips).toHaveLength(4);
    expect(pips.filter((pip) => pip.dataset.filled === 'true')).toHaveLength(4);
  });

  it('renders one pip per life beyond 3 (5 lives → 5 filled pips)', () => {
    render(<GameHUD score={0} lives={5} bonusJumps={0} />);
    const pips = screen.getAllByTestId('life-pip');
    expect(pips).toHaveLength(5);
    expect(pips.filter((pip) => pip.dataset.filled === 'true')).toHaveLength(5);
  });

  it('renders zero filled pips at 0 lives', () => {
    render(<GameHUD score={0} lives={0} bonusJumps={0} />);
    const pips = screen.getAllByTestId('life-pip');
    expect(pips.filter((pip) => pip.dataset.filled === 'true')).toHaveLength(0);
  });
});
