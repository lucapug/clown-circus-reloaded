import { useCallback, useEffect, useState } from 'react';
import { useGameLoop } from '../../game/useGameLoop';
import type { GameLoopApi } from '../../game/useGameLoop';
import {
  createStubLeaderboardService,
  type LeaderboardEntry,
  type LeaderboardService,
} from '../../services/leaderboard';
import { GameCanvas } from './GameCanvas';
import { GameHUD } from './GameHUD';
import { GameOver } from './GameOver';
import { StartScreen } from './StartScreen';

// Testability seam (issue #9, decision 5): `loop` and `service` default to
// the real useGameLoop() and the stub leaderboard service; flow tests inject
// a fake loop and a mock service instead.
export interface CircusGameProps {
  loop?: GameLoopApi;
  service?: LeaderboardService;
}

export const CircusGame = (props: CircusGameProps) => {
  // Hooks can't be conditional, so the injected-loop path renders a pure
  // inner component while the live path owns the real loop.
  if (props.loop) return <CircusGameInner loop={props.loop} service={props.service} />;
  return <CircusGameLive service={props.service} />;
};

const CircusGameLive = ({ service }: { service?: LeaderboardService }) => {
  const loop = useGameLoop();
  return <CircusGameInner loop={loop} service={service} />;
};

const CircusGameInner = ({ loop, service }: { loop: GameLoopApi; service?: LeaderboardService }) => {
  const [leaderboardService] = useState<LeaderboardService>(() => service ?? createStubLeaderboardService());
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const { frame, start, queueInput } = loop;
  const phase = frame.state.phase;

  useEffect(() => {
    let cancelled = false;
    leaderboardService
      .fetchLeaderboard()
      .then((entries) => {
        if (!cancelled) setLeaderboard(entries);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [leaderboardService]);

  // The #9 save flow over the service boundary: submit the (already
  // trimmed) name, then refresh the list (#10 replaces the stub).
  const saveScore = useCallback(
    async (name: string, score: number) => {
      try {
        await leaderboardService.submitScore(name, score);
        setLeaderboard(await leaderboardService.fetchLeaderboard());
      } catch (error) {
        console.error('Failed to save score:', error);
      }
    },
    [leaderboardService],
  );

  // Baseline routing (CircusGame.tsx@0d365e6:58–72): SPACE is intercepted in
  // every phase — idle → start, playing → queue a launch, gameover → ignore
  // (Play Again button only, 2025 parity).
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      e.preventDefault();
      if (phase === 'idle') {
        start();
      } else if (phase === 'playing') {
        queueInput({ type: 'launch' });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [phase, start, queueInput]);

  return (
    <div className="flex flex-col items-center gap-4 p-4 min-h-screen">
      <GameHUD score={frame.state.stats.score} lives={frame.state.stats.lives} bonusJumps={frame.state.stats.bonusJumps} />

      <div className="relative">
        <GameCanvas
          state={frame.state}
          floatingTexts={frame.floatingTexts}
          onMouseMove={(x) => queueInput({ type: 'move-seesaw', x })}
          onClick={() => {
            if (phase === 'playing') queueInput({ type: 'launch' });
          }}
        />

        {phase === 'idle' && <StartScreen onStart={() => start()} leaderboard={leaderboard} />}

        {phase === 'gameover' && (
          <GameOver
            score={frame.state.stats.score}
            onRestart={() => start()}
            onSaveScore={saveScore}
            leaderboard={leaderboard}
          />
        )}
      </div>

      <footer className="text-center text-xs text-muted-foreground mt-4">
        <p>Move mouse to control seesaw • Click or SPACE to launch clown</p>
        <p className="mt-1">Inspired by Circus (Exidy, 1977) &amp; Clowns (Midway, 1978)</p>
      </footer>
    </div>
  );
};
