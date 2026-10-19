import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  BALLOON_SCORES,
  EDGE_LANDING_BONUS,
  ROW_BONUS_POINTS,
  SEESAW_Y,
} from '../../game/core';
import type { GameEvent, GameState } from '../../game/core';

// Presentation-owned floating texts (issue #9, decision 4): derived from the
// tick's events in the shell, never stored in GameState. IDs come from a
// module counter — never the game RNG (spec §6.2: submission/UI identifiers
// must not consume the deterministic stream). Lifetime 1000 ms; the loop
// prunes every frame.
export interface FloatingText {
  id: number;
  text: string;
  x: number;
  y: number;
  createdAt: number;
}

export const FLOATING_TEXT_LIFETIME_MS = 1000;

let textIdCounter = 0;
const nextFloatingTextId = (): number => ++textIdCounter;

/**
 * Event → text mapper. Spawn points per the #9 brief (from the baseline
 * useGameEngine.ts@0d365e6): balloon pops at the balloon, row bonus and
 * level-up at the arena center-ish, +10 at the snapped seat (post-tick
 * clown), SPLAT! keyed on the death cause. Every `death` event maps to
 * "SPLAT!" — never suppressed when a bonus jump was absorbed (the dropping
 * Jumps counter is the visible consumption signal, spec §3.3).
 */
export const textsFromEvents = (events: readonly GameEvent[], state: Readonly<GameState>): FloatingText[] => {
  const now = Date.now();
  const texts: FloatingText[] = [];
  for (const event of events) {
    switch (event.type) {
      case 'balloon-popped':
        texts.push({
          id: nextFloatingTextId(),
          text: `+${BALLOON_SCORES[event.color]}`,
          x: event.x,
          y: event.y,
          createdAt: now,
        });
        break;
      case 'row-cleared':
        texts.push({
          id: nextFloatingTextId(),
          text: `+${ROW_BONUS_POINTS[event.color]} ROW BONUS!`,
          x: ARENA_WIDTH / 2,
          y: 200,
          createdAt: now,
        });
        break;
      case 'landed-edge': {
        const clown = state.clowns[event.clownIndex];
        texts.push({ id: nextFloatingTextId(), text: `+${EDGE_LANDING_BONUS}`, x: clown.x, y: clown.y, createdAt: now });
        break;
      }
      case 'death':
        texts.push({
          id: nextFloatingTextId(),
          text: 'SPLAT!',
          x: state.seesaw.x,
          y: event.cause === 'fall-off' ? ARENA_HEIGHT - 50 : SEESAW_Y - 30,
          createdAt: now,
        });
        break;
      case 'level-completed':
        texts.push({
          id: nextFloatingTextId(),
          text: 'LEVEL UP!',
          x: ARENA_WIDTH / 2,
          y: ARENA_HEIGHT / 2,
          createdAt: now,
        });
        break;
      case 'launched':
      case 'board-bounced':
      case 'game-over':
        // game-over: the overlay takes over — no text (per the brief's table).
        break;
    }
  }
  return texts;
};

/** 1 s lifetime prune, called every frame by the loop. */
export const pruneTexts = (texts: readonly FloatingText[], now: number): FloatingText[] =>
  texts.filter((t) => now - t.createdAt < FLOATING_TEXT_LIFETIME_MS);
