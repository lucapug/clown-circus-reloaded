// Default service wiring (issue #10): VITE_USE_MOCK_LEADERBOARD=1 selects the
// zero-backend mock (plan D4 dev mode, set in .env.development); anything
// else takes the §7-speaking HTTP service. Build/preview stay on the HTTP
// path since only .env.development defines the flag.
import { createHttpLeaderboardService } from './leaderboardHttp';
import { createMockLeaderboardService } from './leaderboardMock';
import type { LeaderboardService } from './leaderboard';

// Public surface: the boundary types live in leaderboard.ts; screens may
// import them from either module path.
export type {
  DrainResult,
  LeaderboardEntry,
  LeaderboardService,
  LeaderboardSnapshot,
  SubmitScoreOutcome,
} from './leaderboard';
export { createHttpLeaderboardService, createMockLeaderboardService };

export const createDefaultLeaderboardService = (): LeaderboardService =>
  import.meta.env.VITE_USE_MOCK_LEADERBOARD === '1'
    ? createMockLeaderboardService()
    : createHttpLeaderboardService();
