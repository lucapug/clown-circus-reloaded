// Zero-backend mock leaderboard service (issue #10, plan D4): `npm run dev`
// stays fully developable with no M3 server. Mirrors the §7 validation so
// the rejection path is visible in dev; keeps a small in-memory arcade board
// sorted score-desc with re-ranked rows. With `offline: true` submits route
// through the SAME storage.ts queue the HTTP service uses, so offline dev
// exercises the real enqueue → reload → drain sync path end to end.
import type {
  DrainResult,
  LeaderboardEntry,
  LeaderboardService,
  LeaderboardSnapshot,
  SubmitScoreOutcome,
} from './leaderboard';
import { enqueuePendingScore, newSubmissionId, readPendingScores, removePendingScore } from './storage';

export interface MockLeaderboardOptions {
  /** Replace the default canned board (tests). */
  cannedEntries?: LeaderboardEntry[];
  /** true → submits enqueue to storage and report 'queued' (dev offline mode). */
  offline?: boolean;
}

/** §7 mirrored: name `^[a-zA-Z0-9 ]+$`, 1–10 chars; score an int ≥ 0. */
const isValidSubmission = (name: string, score: number): boolean =>
  /^[a-zA-Z0-9 ]+$/.test(name) && name.length >= 1 && name.length <= 10 && Number.isInteger(score) && score >= 0;

const rejected: SubmitScoreOutcome = { status: 'rejected', reason: 'validation', httpStatus: 422 };

const defaultCannedEntries = (): LeaderboardEntry[] => {
  const rows: Array<[string, number]> = [
    ['PIXEL PETE', 15000],
    ['QUARTZ', 11800],
    ['MIDWAY KID', 8450],
    ['EXIDY FAN', 5600],
    ['ROOKIE CLOWN', 2300],
  ];
  return rows.map(([name, score], i) => ({ rank: i + 1, name, score, date: '2026-01-01' }));
};

/** Score-desc, then 1-based ranks (the §7 board invariant). */
const resortAndRerank = (entries: LeaderboardEntry[]): LeaderboardEntry[] =>
  [...entries]
    .sort((a, b) => b.score - a.score)
    .map((e, i) => ({ ...e, rank: i + 1 }));

export const createMockLeaderboardService = (opts: MockLeaderboardOptions = {}): LeaderboardService => {
  const offline = opts.offline ?? false;
  let board: LeaderboardEntry[] = resortAndRerank(opts.cannedEntries ?? defaultCannedEntries());
  const limitDefault = 10;

  const fetchLeaderboard = async (limit: number = limitDefault): Promise<LeaderboardSnapshot> => ({
    entries: board.slice(0, limit),
    source: 'live',
  });

  const submitScore = async (name: string, score: number): Promise<SubmitScoreOutcome> => {
    if (!isValidSubmission(name, score)) return rejected;
    const submissionId = newSubmissionId();
    if (offline) {
      // Same queue the HTTP service uses: a later non-offline instance drains it.
      enqueuePendingScore({ submissionId, name, score, queuedAt: Date.now() });
      return { status: 'queued', submissionId };
    }
    board = resortAndRerank([...board, { rank: 0, name, score, date: new Date().toISOString().slice(0, 10) }]);
    return { status: 'saved', submissionId };
  };

  const drainPendingSubmissions = async (): Promise<DrainResult> => {
    const queue = readPendingScores();
    if (offline) return { synced: 0, dropped: 0, stillQueued: queue.length };
    let synced = 0;
    for (const entry of queue) {
      board = resortAndRerank([...board, { rank: 0, name: entry.name, score: entry.score, date: new Date().toISOString().slice(0, 10) }]);
      removePendingScore(entry.submissionId);
      synced++;
    }
    return { synced, dropped: 0, stillQueued: readPendingScores().length };
  };

  return { fetchLeaderboard, submitScore, drainPendingSubmissions };
};
