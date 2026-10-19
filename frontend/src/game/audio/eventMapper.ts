// Pure mapping from the kernel's typed event inventory (core/events.ts) to
// AudioService calls — issue #11 decision 3, faithful to the baseline
// useGameEngine.ts@0d365e6 call sites. Zero React imports, so the table is
// unit-testable in isolation. Chain launches stay SILENT: the baseline chain
// launch had no sound of its own and the same tick's landed-edge bounce is
// the audible feedback (mapping both would double-fire bounce in one tick).
import type { GameEvent } from '../core';
import type { AudioService } from './audioService';

export type AudioEventMapper = (events: GameEvent[]) => void;

export const createAudioEventMapper =
  (audio: AudioService): AudioEventMapper =>
  (events: GameEvent[]): void => {
    for (const event of events) {
      switch (event.type) {
        case 'balloon-popped':
          audio.pop();
          break;
        case 'row-cleared': // useGameEngine.ts@0d365e6:141
        case 'level-completed': // LEVEL UP used the same arpeggio (:238)
          audio.bonus();
          break;
        case 'landed-edge': // :291
        case 'board-bounced': // :192
          audio.bounce();
          break;
        case 'launched':
          if (event.via === 'input') audio.bounce(); // launchClown :469
          break;
        case 'death': // ALL causes: middle / occupied-edge / fall-off (:279/:317/:333)
          audio.death();
          break;
        case 'game-over': // :365–366
          audio.gameOverJingle();
          break;
      }
    }
  };
