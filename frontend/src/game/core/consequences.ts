import { BONUS_JUMPS_ON_DEATH, EDGE_LANDING_BONUS, JUMP_STREAK_GOAL, LIVES_ON_DEATH, LIVES_ON_LEVEL_UP } from './constants';
import { getBalloonScore, getRowBonus } from './scoring';
import type { ConsequenceReducer } from './types';

// The shipped ConsequenceReducer (issue #7, design decision 3): a PURE fold
// over the tick's events IN EMISSION ORDER, returning a new GameState. It
// never mutates `state` or `events`, and it CONSUMES the kernel's events —
// detection (row-clear, death, level-up) is never reimplemented here (D2),
// which is what keeps this the single scoring path (§3.2).
//
// Per event: balloon-popped → pop score; row-cleared → row bonus only (since
// #24 rows grant NO jumps — earning is §3.3 v2); landed-edge → +10
// (board-bounced scores nothing); launched → §3.3 v2 EARNING (issue #24): a
// `via:'chain'` launch is one completed launch cycle and advances the streak,
// and reaching JUMP_STREAK_GOAL grants +1 bonusJumps and resets the streak —
// `via:'input'` never counts; death → §3.3 CONSUMPTION (2026 design decision
// A, owner 2026-10-15): one bonus jump spent when any remain, else −1 life —
// per-event, in fold order, so a jump earned earlier in the same tick is
// spendable — AND the #24 streak reset, in both Option-A branches;
// level-completed → +1 life, streak untouched (a deathless rally spans
// levels); board-bounced / game-over → no-op.
//
// The streak is folded from `stats.streak ?? 0` and ALWAYS emitted as a
// number in the returned stats (normalized after any real fold); the fold is
// its only writer, so nullConsequences and fresh initial state keep it
// absent and the golden fixtures stay byte-identical.
export const createConsequences = (): ConsequenceReducer => (state, events) => {
  let score = state.stats.score;
  let lives = state.stats.lives;
  let bonusJumps = state.stats.bonusJumps;
  let streak = state.stats.streak ?? 0;

  for (const event of events) {
    switch (event.type) {
      case 'balloon-popped':
        score += getBalloonScore(event.color);
        break;
      case 'row-cleared':
        score += getRowBonus(event.color);
        break;
      case 'landed-edge':
        score += EDGE_LANDING_BONUS;
        break;
      case 'launched':
        // §3.3 v2 EARNING (issue #24): the streak counts completed launch
        // cycles — a chain launch is the engine's LAST event of the tick
        // (safe edge landing → the other seated clown launches), so
        // landing + chain increments within one tick. Input launches
        // (diving board / seat) never count. Reaching the goal grants the
        // jump and resets the streak for the next run.
        if (event.via === 'chain') {
          streak += 1;
          if (streak >= JUMP_STREAK_GOAL) {
            bonusJumps += 1;
            streak = 0;
          }
        }
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
        // #24: any death also resets the launch streak, in BOTH Option-A
        // branches — a crash ends the run toward the next jump.
        if (bonusJumps > 0) {
          bonusJumps -= BONUS_JUMPS_ON_DEATH;
          streak = 0;
        } else {
          lives = Math.max(0, lives - LIVES_ON_DEATH);
          streak = 0;
        }
        break;
      case 'level-completed':
        lives += LIVES_ON_LEVEL_UP;
        break;
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

  return { ...state, stats: { score, lives, bonusJumps, streak } };
};
