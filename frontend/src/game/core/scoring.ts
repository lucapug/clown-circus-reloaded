import { BALLOON_SCORES, BONUS_JUMPS_FOR_BLUE_ROW, ROW_BONUS_POINTS } from './constants';
import type { BalloonColor } from './types';

// Pure §3.2 scoring translation (issue #7, design decision 1): the ONLY
// scoring implementation in the codebase — the 2025 defect was a tested
// scoring module the engine never imported. All pinned numbers live in
// constants.ts; these functions add no values of their own and touch no
// state. Row-clear detection itself is kernel concern (it emits
// `row-cleared`); this module only translates the event's color to points
// and earned bonus jumps.

export const getBalloonScore = (color: BalloonColor): number => BALLOON_SCORES[color];

export const getRowBonus = (color: BalloonColor): number => ROW_BONUS_POINTS[color];

/** §3.3 earning rule: blue rows grant bonus jumps; other colors grant none. */
export const getBonusJumpsForRowClear = (color: BalloonColor): number =>
  color === 'blue' ? BONUS_JUMPS_FOR_BLUE_ROW : 0;
