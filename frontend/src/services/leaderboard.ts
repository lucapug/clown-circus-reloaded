// Leaderboard service boundary (issue #9, decision 3): screens consume this
// interface only — #9 ships the stub so the game renders and the save flow
// completes with an empty list. The real implementation (API mocks + a
// localStorage write-behind queue) is issue #10's contract; this interface
// must not be reshaped when #10 lands.

/** One leaderboard row as rendered by the screens (rank is 1-based). */
export interface LeaderboardEntry {
  rank: number;
  name: string;
  score: number;
  date: string;
}

export interface LeaderboardService {
  fetchLeaderboard(limit?: number): Promise<LeaderboardEntry[]>;
  submitScore(name: string, score: number): Promise<void>;
}

/**
 * #9's no-op service: the leaderboard is always empty and saving resolves
 * without effect ("No scores yet" / "Score Saved!" flows stay exercisable).
 */
export const createStubLeaderboardService = (): LeaderboardService => ({
  fetchLeaderboard: async () => [],
  submitScore: async () => {},
});
