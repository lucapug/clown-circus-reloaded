import type { BalloonColor } from './types';

// Typed event surface (issue brief, design decision 1): the pure kernel never
// plays audio, writes stats, or builds UI — it emits these and lets consumers
// (#7 consequences, #11 audio, #10 services) respond. Event array order is
// emission order within the tick; golden fixtures snapshot events too.
export type GameEvent =
  | { type: 'launched'; clownIndex: 0 | 1; via: 'input' | 'chain'; vx: number; vy: number }
  | { type: 'board-bounced'; clownIndex: 0 | 1 }
  | { type: 'balloon-popped'; balloonId: string; row: number; color: BalloonColor; x: number; y: number }
  | { type: 'row-cleared'; row: number; color: BalloonColor }
  | { type: 'level-completed'; newLevel: number }
  // The +10 for an edge landing is #7's consequence of this event.
  | { type: 'landed-edge'; clownIndex: 0 | 1; side: 'left' | 'right' }
  | { type: 'death'; clownIndex: 0 | 1; cause: 'middle' | 'occupied-edge' | 'fall-off' }
  | { type: 'game-over' };

export type BalloonPoppedEvent = Extract<GameEvent, { type: 'balloon-popped' }>;
export type DeathEvent = Extract<GameEvent, { type: 'death' }>;
export type GameOverEvent = Extract<GameEvent, { type: 'game-over' }>;

export const isBalloonPoppedEvent = (event: GameEvent): event is BalloonPoppedEvent =>
  event.type === 'balloon-popped';

export const isDeathEvent = (event: GameEvent): event is DeathEvent => event.type === 'death';

export const isGameOverEvent = (event: GameEvent): event is GameOverEvent => event.type === 'game-over';
