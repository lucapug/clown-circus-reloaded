// Leaderboard service boundary (issues #9 + #10): screens consume this
// interface only. #10 reshapes it deliberately (the #23 review relay bound:
// the #9 signature swallowed submit errors, so "Score Saved!" could lie) —
// submitScore now returns an explicit outcome and fetchLeaderboard reports
// whether rows are live or from the offline cache.
//
// The concrete implementations live in leaderboardHttp.ts (real §7 API),
// leaderboardMock.ts (zero-backend dev mode) and index.ts picks the default.
// Types stay framework-free; per spec §6.2 submission IDs never flow through
// the seeded RNG.

/** One leaderboard row as rendered by the screens (rank is 1-based). */
export interface LeaderboardEntry {
  rank: number;
  name: string;
  score: number;
  date: string;
}

/**
 * Result of a save attempt:
 * - `saved` — definitive 2xx (including the §7 idempotent replay → 201);
 * - `queued` — network error / timeout / 5xx: the entry stays in the
 *   offline queue and will sync on a later drain (e.g. next app start);
 * - `rejected` — definitive 4xx, dropped for good and surfaced to the user.
 */
export type SubmitScoreOutcome =
  | { status: 'saved'; submissionId: string }
  | { status: 'queued'; submissionId: string }
  | { status: 'rejected'; reason: 'validation' | 'conflict' | 'other'; httpStatus: number };

/** Leaderboard payload plus where it came from (live API or offline cache). */
export interface LeaderboardSnapshot {
  entries: LeaderboardEntry[];
  source: 'live' | 'cached';
}

/** Counts reported by a drain of the offline pending-scores queue. */
export interface DrainResult {
  synced: number;
  dropped: number;
  stillQueued: number;
}

export interface LeaderboardService {
  fetchLeaderboard(limit?: number): Promise<LeaderboardSnapshot>;
  submitScore(name: string, score: number): Promise<SubmitScoreOutcome>;
  /** Re-POST every queued submission (FIFO, stored ids); called on app mount. */
  drainPendingSubmissions(): Promise<DrainResult>;
}
