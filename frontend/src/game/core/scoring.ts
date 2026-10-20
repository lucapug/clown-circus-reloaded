import { BALLOON_SCORES, ROW_BONUS_POINTS } from './constants';
import type { BalloonColor } from './types';

// Pure §3.2 scoring translation (issue #7, design decision 1): the ONLY
// scoring implementation in the codebase — the 2025 defect was a tested
// scoring module the engine never imported. All pinned numbers live in
// constants.ts; these functions add no values of their own and touch no
// state. Row-clear detection itself is kernel concern (it emits
// `row-cleared`); this module only translates the event's color to points —
// since #24, rows grant NO bonus jumps (earning v2 lives in the
// consequences fold's launch streak).

export const getBalloonScore = (color: BalloonColor): number => BALLOON_SCORES[color];

export const getRowBonus = (color: BalloonColor): number => ROW_BONUS_POINTS[color];
