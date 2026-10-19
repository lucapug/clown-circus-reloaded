import { BONUS_JUMPS_ON_DEATH, EDGE_LANDING_BONUS, LIVES_ON_DEATH, LIVES_ON_LEVEL_UP } from './constants';
import { getBalloonScore, getBonusJumpsForRowClear, getRowBonus } from './scoring';
import type { ConsequenceReducer } from './types';

// The shipped ConsequenceReducer (issue #7, design decision 3): a PURE fold
// over the tick's events IN EMISSION ORDER, returning a new GameState. It
// never mutates `state` or `events`, and it CONSUMES the kernel's events —
// detection (row-clear, death, level-up) is never reimplemented here (D2),
// which is what keeps this the single scoring path (§3.2).
//
// Per event: balloon-popped → pop score; row-cleared → row bonus and, blue
// only, one earned bonus jump (§3.3 EARNING); landed-edge → +10 (board-bounced
// scores nothing); death → §3.3 CONSUMPTION (2026 design decision A, owner
// 2026-10-15): one bonus jump spent when any remain, else −1 life — per-event,
// in fold order, so a jump earned earlier in the same tick is spendable;
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
        // §3.3 CONSUMPTION (2026 design decision A — an explicit owner
        // decision of 2026-10-15, NOT inferred 2025 intent): a death spends
        // one bonus jump when any remain, taking a life only at bonusJumps 0.
        // Evaluated against the RUNNING counters, so two deaths in one tick
        // each consume independently, in emission order.
        // The life decrement is floored at 0 (issue #27, fuzz-minimized seed
        // 22): a same-tick double death at lives 1 folded 1 → 0 → −1, but the
        // spec (§3.5) never contemplates negative lives — game-over fires at
        // 0 and the state must hold exactly that. Clamped per decrement, so
        // the second same-tick death lands on 0, never below.
        if (bonusJumps > 0) {
          bonusJumps -= BONUS_JUMPS_ON_DEATH;
        } else {
          lives = Math.max(0, lives - LIVES_ON_DEATH);
        }
        break;
      case 'level-completed':
        lives += LIVES_ON_LEVEL_UP;
        break;
      case 'launched':
      case 'board-bounced':
      case 'game-over':
        break;
      default: {
        // Exhaustiveness guard (reviewer note on PR #18): a GameEvent variant
        // this fold does not handle is a compile error here, never a silent
        // no-op at runtime.
        const _exhaustive: never = event;
        throw new Error(`unhandled GameEvent: ${String(_exhaustive)}`);
      }
    }
  }

  return { ...state, stats: { score, lives, bonusJumps } };
};
