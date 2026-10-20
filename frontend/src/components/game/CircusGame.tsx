import { useCallback, useEffect, useState } from 'react';
import { createAudioEventMapper, createAudioService, type AudioService } from '../../game/audio';
import { useGameLoop } from '../../game/useGameLoop';
import type { GameLoopApi } from '../../game/useGameLoop';
import { createSessionRecorder } from '../../game/recorder/sessionRecorder';
import type { SessionRecorder } from '../../game/recorder/sessionRecorder';
import {
  createDefaultLeaderboardService,
  type LeaderboardEntry,
  type LeaderboardService,
  type SubmitScoreOutcome,
} from '../../services';
import { GameCanvas } from './GameCanvas';
import { GameHUD } from './GameHUD';
import { GameOver } from './GameOver';
import { StartScreen } from './StartScreen';

// Testability seam (issue #9, decision 5; #10 swaps the stub for the real
// factory; #11 adds the audio service): `loop`, `service` and `audio` default
// to the real useGameLoop(), createDefaultLeaderboardService() and
// createAudioService(); flow tests inject fakes instead.
export interface CircusGameProps {
  loop?: GameLoopApi;
  service?: LeaderboardService;
  audio?: AudioService;
}

export const CircusGame = (props: CircusGameProps) => {
  // Hooks can't be conditional, so the injected-loop path renders a pure
  // inner component while the live path owns the real loop.
  if (props.loop) return <CircusGameInner loop={props.loop} service={props.service} audio={props.audio} />;
  return <CircusGameLive service={props.service} audio={props.audio} />;
};

const CircusGameLive = ({
  service,
  audio: injectedAudio,
}: {
  service?: LeaderboardService;
  audio?: AudioService;
}) => {
  // Live path only (#11 decision 6): the AudioContext is lazy — nothing is
  // created until the first sound, which always descends from SPACE/click.
  const [audio] = useState<AudioService>(() => injectedAudio ?? createAudioService());
  // #30: DEV-gated at the call site (same mechanism as the __game install) —
  // in production the recorder is never constructed and the recorder module
  // is eliminated from the bundle.
  const [recorder] = useState<SessionRecorder | undefined>(() =>
    import.meta.env.DEV ? createSessionRecorder({ appVersion: __APP_GIT_SHA__ }) : undefined,
  );
  const loop = useGameLoop({ onEvents: createAudioEventMapper(audio), recorder });
  const phase = loop.frame.state.phase;

  // #30: the M-key marker — DEV only, playing only. Pressing M flags the
  // exact current tick of a suspicious moment in the active recording.
  useEffect(() => {
    if (!import.meta.env.DEV || !recorder) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyM' && phase === 'playing') recorder.marker(loop.getTick?.() ?? 0);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [recorder, phase, loop]);

  return <CircusGameInner loop={loop} service={service} audio={audio} />;
};

const CircusGameInner = ({
  loop,
  service,
  audio: injectedAudio,
}: {
  loop: GameLoopApi;
  service?: LeaderboardService;
  audio?: AudioService;
}) => {
  const [leaderboardService] = useState<LeaderboardService>(() => service ?? createDefaultLeaderboardService());
  const [audio] = useState<AudioService>(() => injectedAudio ?? createAudioService());
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [offline, setOffline] = useState(false);
  const [droppedCount, setDroppedCount] = useState(0);
  const { frame, start, queueInput } = loop;
  const phase = frame.state.phase;

  // One shared start path for every entry point (#11 decision 2/6) —
  // START GAME button, SPACE-at-idle, Play Again: silence anything in flight
  // (a mid-flight game-over jingle), restart the loop, then bring the
  // ambient pass back.
  const startGame = useCallback(() => {
    audio.stopAll();
    start();
    audio.startBackground();
  }, [audio, start]);

  // #10: drain the offline queue BEFORE fetching, so the refreshed list
  // includes just-synced rows; drops are surfaced once via the sync notice.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const drain = await leaderboardService.drainPendingSubmissions();
        if (!cancelled && drain.dropped > 0) setDroppedCount(drain.dropped);
      } catch {
        // a drain failure must never block the fetch below
      }
      try {
        const snapshot = await leaderboardService.fetchLeaderboard();
        if (cancelled) return;
        setLeaderboard(snapshot.entries);
        setOffline(snapshot.source === 'cached');
      } catch {
        // keep whatever list we have; the service already fell back to cache
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [leaderboardService]);

  // The save flow over the service boundary (#9 + the #23 honesty fix):
  // submit the (already trimmed) name, surface the outcome to GameOver, and
  // refresh the list on a non-definitive-rejected result so just-saved rows
  // (or the fresh cache) show up.
  const saveScore = useCallback(
    async (name: string, score: number): Promise<SubmitScoreOutcome> => {
      const outcome = await leaderboardService.submitScore(name, score);
      if (outcome.status !== 'rejected') {
        const snapshot = await leaderboardService.fetchLeaderboard();
        setLeaderboard(snapshot.entries);
        setOffline(snapshot.source === 'cached');
      }
      return outcome;
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
        startGame();
      } else if (phase === 'playing') {
        queueInput({ type: 'launch' });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [phase, startGame, queueInput]);

  return (
    <div className="flex flex-col items-center gap-4 p-4 min-h-screen">
      <GameHUD score={frame.state.stats.score} lives={frame.state.stats.lives} bonusJumps={frame.state.stats.bonusJumps} streak={frame.state.stats.streak ?? 0} />

      {droppedCount > 0 && (
        <p data-testid="sync-notice" className="text-xs text-destructive pixel-font" role="status">
          {droppedCount} offline score(s) rejected by server
        </p>
      )}

      <div className="relative">
        <GameCanvas
          state={frame.state}
          floatingTexts={frame.floatingTexts}
          onMouseMove={(x) => queueInput({ type: 'move-seesaw', x })}
          onClick={() => {
            if (phase === 'playing') queueInput({ type: 'launch' });
          }}
        />

        {phase === 'idle' && (
          <StartScreen onStart={() => startGame()} leaderboard={leaderboard} offline={offline} />
        )}

        {phase === 'gameover' && (
          <GameOver
            score={frame.state.stats.score}
            onRestart={() => startGame()}
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
