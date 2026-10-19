import { useState } from 'react';
import type { LeaderboardEntry, SubmitScoreOutcome } from '../../services/leaderboard';
import { PixelButton, PixelInput } from './ui';

interface GameOverProps {
  score: number;
  onRestart: () => void;
  /**
   * Save flow (#9 decision 3, reshaped by #10 per the #23 review relay):
   * submit the TRIMMED name and surface the outcome — the caller refetches
   * the leaderboard. Every outcome renders honestly; a 4xx never shows
   * "Saved".
   */
  onSaveScore: (name: string, score: number) => Promise<SubmitScoreOutcome>;
  leaderboard: LeaderboardEntry[];
}

// Baseline GameOver layout: GAME OVER, 6-digit final score, name input
// truncated at 10 chars, save disabled until non-empty, then the honest
// #10 outcome message, the duplicated-list 14.4s scroll loop over the top
// 10, "No scores yet" when empty, Play Again.
export const GameOver = ({ score, onRestart, onSaveScore, leaderboard }: GameOverProps) => {
  const [name, setName] = useState('');
  const [outcome, setOutcome] = useState<SubmitScoreOutcome | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      setOutcome(await onSaveScore(trimmed, score));
    } finally {
      setSaving(false);
    }
  };

  const saveMessage = (o: SubmitScoreOutcome) => {
    if (o.status === 'saved') return <div className="mb-6 text-accent pixel-font">Score Saved!</div>;
    if (o.status === 'queued')
      return (
        <div data-testid="save-queued" className="mb-6 text-accent pixel-font">
          Saved offline — will sync
        </div>
      );
    return (
      <div data-testid="save-rejected" className="mb-6 text-destructive pixel-font">
        {o.reason === 'validation'
          ? 'Could not save: invalid name or score'
          : o.reason === 'conflict'
            ? 'Could not save: sync conflict'
            : 'Could not save: request rejected'}
      </div>
    );
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

        {!outcome ? (
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
            <PixelButton
              onClick={handleSave}
              disabled={!name.trim() || saving}
              data-testid="save-score"
              className="w-full pixel-font"
            >
              {saving ? 'Saving…' : 'Save Score'}
            </PixelButton>
          </div>
        ) : (
          saveMessage(outcome)
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
