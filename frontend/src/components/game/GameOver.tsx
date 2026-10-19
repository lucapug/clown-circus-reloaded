import { useState } from 'react';
import type { LeaderboardEntry } from '../../services/leaderboard';
import { PixelButton, PixelInput } from './ui';

interface GameOverProps {
  score: number;
  onRestart: () => void;
  /** Save flow (issue #9 decision 3): submit the TRIMMED name, then the caller refetches the leaderboard. */
  onSaveScore: (name: string, score: number) => Promise<void> | void;
  leaderboard: LeaderboardEntry[];
}

// Baseline GameOver, verbatim layout: GAME OVER, 6-digit final score, name
// input truncated at 10 chars, save disabled until non-empty, "Score Saved!"
// after the save flow resolves, the duplicated-list 14.4s scroll loop over
// the top 10, "No scores yet" when empty, Play Again.
export const GameOver = ({ score, onRestart, onSaveScore, leaderboard }: GameOverProps) => {
  const [name, setName] = useState('');
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    await onSaveScore(trimmed, score);
    setSaved(true);
  };

  return (
    <div className="absolute inset-0 bg-background/90 flex items-center justify-center z-10">
      <div className="bg-card p-8 rounded-lg arcade-border text-center max-w-md w-full mx-4">
        <h2 className="text-3xl font-bold text-destructive arcade-text mb-4 pixel-font animate-pulse-glow">
          GAME OVER
        </h2>

        <div className="mb-6">
          <div className="text-muted-foreground text-sm uppercase tracking-wider">Final Score</div>
          <div data-testid="final-score" className="text-4xl font-bold text-primary arcade-text pixel-font">
            {score.toString().padStart(6, '0')}
          </div>
        </div>

        {!saved ? (
          <div className="mb-6 space-y-3">
            <PixelInput
              type="text"
              placeholder="Enter your name"
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 10))}
              maxLength={10}
              data-testid="player-name"
              className="text-center text-foreground pixel-font"
            />
            <PixelButton onClick={handleSave} disabled={!name.trim()} data-testid="save-score" className="w-full pixel-font">
              Save Score
            </PixelButton>
          </div>
        ) : (
          <div className="mb-6 text-accent pixel-font">Score Saved!</div>
        )}

        <div className="mb-6">
          <h3 className="text-lg font-bold text-accent mb-3 pixel-font">Leaderboard</h3>
          <div data-testid="leaderboard-scroll" className="h-40 overflow-hidden relative">
            {leaderboard.length > 0 ? (
              <div className="animate-scroll-up">
                {/* First set of entries */}
                {leaderboard.slice(0, 10).map((entry, i) => (
                  <div
                    key={`a-${i}`}
                    data-testid="leaderboard-row"
                    className={`flex justify-between px-3 py-1 rounded mb-2 ${
                      i === 0 ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    <span className="pixel-font text-sm">
                      {i + 1}. {entry.name}
                    </span>
                    <span className="pixel-font text-sm">{entry.score}</span>
                  </div>
                ))}
                {/* Spacer for gap between end and restart */}
                <div className="h-12" />
                {/* Second set for seamless loop */}
                {leaderboard.slice(0, 10).map((entry, i) => (
                  <div
                    key={`b-${i}`}
                    data-testid="leaderboard-row"
                    className={`flex justify-between px-3 py-1 rounded mb-2 ${
                      i === 0 ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    <span className="pixel-font text-sm">
                      {i + 1}. {entry.name}
                    </span>
                    <span className="pixel-font text-sm">{entry.score}</span>
                  </div>
                ))}
                {/* Spacer for gap */}
                <div className="h-12" />
              </div>
            ) : (
              <div className="text-muted-foreground text-sm text-center">No scores yet</div>
            )}
          </div>
        </div>

        <PixelButton onClick={onRestart} data-testid="play-again" className="w-full h-12 pixel-font animate-pulse-glow">
          Play Again
        </PixelButton>
      </div>
    </div>
  );
};
