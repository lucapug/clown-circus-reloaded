import { EDGE_LANDING_BONUS, LIVES_ON_DEATH, LIVES_ON_LEVEL_UP } from './constants';
import type { GameEvent } from './events';
import { getBalloonScore, getBonusJumpsForRowClear, getRowBonus } from './scoring';
import type { ConsequenceReducer, GameState } from './types';

// The shipped ConsequenceReducer (issue #7, design decision 3): a PURE fold
// over the tick's events IN EMISSION ORDER, returning a new GameState. It
// never mutates `state` or `events`, and it CONSUMES the kernel's events —
// detection (row-clear, death, level-up) is never reimplemented here (D2),
// which is what keeps this the single scoring path (§3.2).
//
// Per event: balloon-popped → pop score; row-cleared → row bonus and, blue
// only, one earned bonus jump (§3.3 EARNING — the counter merely accrues,
// consumption is #8); landed-edge → +10 (board-bounced scores nothing);
// death → −1 life, unconditional in this issue (#8 will spend bonusJumps);
// level-completed → +1 life (level+1 and grid regeneration are already the
// kernel's, same tick); launched / board-bounced / game-over → no-op.
export const createConsequences = (): ConsequenceReducer => (state, events) => {
  let score = state.stats.score;
  let lives = state.stats.lives;
  let bonusJumps = state.stats.bonusJumps;

  for (const event of events) {
    switch (event.type) {
      case 'balloon-popped':
        score += getBalloonScore(event.color);
        break;
      case 'row-cleared':
        score += getRowBonus(event.color);
        bonusJumps += getBonusJumpsForRowClear(event.color);
        break;
      case 'landed-edge':
        score += EDGE_LANDING_BONUS;
        break;
      case 'death':
        lives -= LIVES_ON_DEATH;
        break;
      case 'level-completed':
        lives += LIVES_ON_LEVEL_UP;
        break;
      case 'launched':
      case 'board-bounced':
      case 'game-over':
        break;
    }
  }

  return { ...state, stats: { score, lives, bonusJumps } };
};
