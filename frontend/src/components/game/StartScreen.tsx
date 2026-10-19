import type { LeaderboardEntry } from '../../services/leaderboard';
import { PixelButton } from './ui';

interface StartScreenProps {
  onStart: () => void;
  leaderboard: LeaderboardEntry[];
  /** #10: true when the snapshot came from the offline cache, not the API. */
  offline?: boolean;
}

// Baseline StartScreen copy and layout, verbatim (2025 parity): per-letter
// rainbow bouncing titles, HOW TO PLAY, SCORING legend, HIGH SCORES top-3
// only when entries exist, START GAME, "Click or press SPACE to begin".
// #10 adds the one sanctioned line: an offline badge beside HIGH SCORES
// (only when cached entries exist; offline-and-empty keeps the hidden block).
export const StartScreen = ({ onStart, leaderboard, offline = false }: StartScreenProps) => {
  return (
    <div className="absolute inset-0 bg-background/95 flex items-center justify-center z-10">
      <div className="text-center max-w-lg mx-4">
        <h1 className="font-bold mb-2 pixel-font flex justify-center items-baseline">
          {'CIRCUS'.split('').map((char, index) => {
            // Depth effect: center chars (R=2, C=3) are largest
            const sizes = ['text-4xl', 'text-5xl', 'text-6xl', 'text-6xl', 'text-5xl', 'text-4xl'];
            // Rainbow colors for each character
            const colors = [
              'text-red-500',
              'text-orange-500',
              'text-yellow-500',
              'text-green-500',
              'text-blue-500',
              'text-purple-500',
            ];
            return (
              <span
                key={index}
                className={`${sizes[index]} ${colors[index]} inline-block animate-bounce`}
                style={{
                  animationDelay: `${index * 0.1}s`,
                  animationDuration: '1s',
                  textShadow: '2px 2px 4px rgba(0,0,0,0.5)',
                }}
              >
                {char}
              </span>
            );
          })}
        </h1>
        <h2 className="font-bold mb-8 pixel-font flex justify-center items-baseline">
          {'CLOWNS'.split('').map((char, index) => {
            const sizes = ['text-xl', 'text-2xl', 'text-3xl', 'text-3xl', 'text-2xl', 'text-xl'];
            const colors = [
              'text-purple-500',
              'text-blue-500',
              'text-green-500',
              'text-yellow-500',
              'text-orange-500',
              'text-red-500',
            ];
            return (
              <span
                key={index}
                className={`${sizes[index]} ${colors[index]} inline-block animate-bounce`}
                style={{
                  animationDelay: `${index * 0.1 + 0.3}s`,
                  animationDuration: '1s',
                  textShadow: '2px 2px 4px rgba(0,0,0,0.5)',
                }}
              >
                {char}
              </span>
            );
          })}
        </h2>

        <div className="bg-card p-6 rounded-lg arcade-border mb-8">
          <h3 className="text-lg font-bold text-foreground mb-4 pixel-font">HOW TO PLAY</h3>
          <ul className="text-sm text-muted-foreground space-y-2 text-left">
            <li className="flex items-start gap-2">
              <span className="text-primary">→</span>
              <span>Move mouse to control the seesaw</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">→</span>
              <span>Click to launch a clown into the air</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">→</span>
              <span>Pop balloons for points!</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">→</span>
              <span>Catch falling clowns or lose a life</span>
            </li>
          </ul>

          <div className="mt-4 pt-4 border-t border-border">
            <h4 className="text-sm font-bold text-foreground mb-2 pixel-font">SCORING</h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-balloon-yellow"></div>
                <span className="text-muted-foreground">Yellow: 20 pts</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-balloon-green"></div>
                <span className="text-muted-foreground">Green: 50 pts</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-balloon-blue"></div>
                <span className="text-muted-foreground">Blue: 100 pts</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-primary text-lg">★</span>
                <span className="text-muted-foreground">Clear row = Bonus!</span>
              </div>
              {/* Player-facing doc of the §3.3 mechanic (owner request, rework loop 2): blue rows earn a Jump; a Jump absorbs one crash. */}
              <div className="col-span-2 text-muted-foreground mt-1">
                Clear the blue row = +1 Jump · A Jump absorbs one crash
              </div>
            </div>
          </div>
        </div>

        {leaderboard.length > 0 && (
          <div data-testid="high-scores" className="bg-card p-4 rounded-lg arcade-border mb-8">
            <div className="flex items-baseline justify-between mb-2">
              <h3 className="text-sm font-bold text-accent pixel-font">HIGH SCORES</h3>
              {offline && (
                <span data-testid="offline-indicator" className="text-xs text-muted-foreground">
                  Offline — showing saved scores
                </span>
              )}
            </div>
            <div className="space-y-1">
              {leaderboard.slice(0, 3).map((entry, i) => (
                <div key={i} data-testid="high-score-row" className="flex justify-between text-sm">
                  <span className={i === 0 ? 'text-primary' : 'text-muted-foreground'}>{entry.name}</span>
                  <span className={i === 0 ? 'text-primary' : 'text-muted-foreground'}>{entry.score}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <PixelButton onClick={onStart} className="text-lg h-14 px-12 pixel-font animate-pulse-glow">
          START GAME
        </PixelButton>

        <p className="text-xs text-muted-foreground mt-4">Click or press SPACE to begin</p>
      </div>
    </div>
  );
};
