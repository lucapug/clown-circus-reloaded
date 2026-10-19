// localStorage persistence for the leaderboard (issue #10, decisions):
// - `clown-circus:leaderboard-cache:v1` → { fetchedAt, entries } (§8.1 offline cache)
// - `clown-circus:pending-scores:v1` → PendingScore[] (write-behind queue,
//   array order = FIFO). submitScore enqueues BEFORE the POST and removes on
//   a definitive 2xx/4xx — that write-behind is what makes the queue
//   crash-safe (the 2025 defect's real fix).
// Pure helpers over localStorage: corrupt/unparsable JSON is treated as
// empty and never throws; the queue is capped at 20, evicting the oldest.
import type { LeaderboardEntry } from './leaderboard';

export const LEADERBOARD_CACHE_KEY = 'clown-circus:leaderboard-cache:v1';
export const PENDING_SCORES_KEY = 'clown-circus:pending-scores:v1';

export const PENDING_QUEUE_CAP = 20;

/** One unsynced score sitting in the offline queue. */
export interface PendingScore {
  submissionId: string;
  name: string;
  score: number;
  queuedAt: number;
}

/** §8.1 offline cache: last successful GET + when it happened. */
export interface LeaderboardCache {
  fetchedAt: number;
  entries: LeaderboardEntry[];
}

/** Read the pending queue; [] when absent or corrupt (never throws). */
export const readPendingScores = (): PendingScore[] => {
  try {
    const raw = localStorage.getItem(PENDING_SCORES_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is PendingScore =>
        typeof e === 'object' &&
        e !== null &&
        typeof (e as PendingScore).submissionId === 'string' &&
        typeof (e as PendingScore).name === 'string' &&
        typeof (e as PendingScore).score === 'number' &&
        typeof (e as PendingScore).queuedAt === 'number',
    );
  } catch {
    return [];
  }
};

const writePendingScores = (queue: PendingScore[]): void => {
  localStorage.setItem(PENDING_SCORES_KEY, JSON.stringify(queue));
};

/** Append to the queue (FIFO), then enforce the cap by evicting the oldest. */
export const enqueuePendingScore = (entry: PendingScore): void => {
  const queue = [...readPendingScores(), entry];
  writePendingScores(queue.slice(-PENDING_QUEUE_CAP));
};

/** Drop one queued submission by id (used after a definitive 2xx/4xx). */
export const removePendingScore = (submissionId: string): void => {
  writePendingScores(readPendingScores().filter((e) => e.submissionId !== submissionId));
};

/** Read the §8.1 offline cache; null when absent or corrupt (never throws). */
export const readLeaderboardCache = (): LeaderboardCache | null => {
  try {
    const raw = localStorage.getItem(LEADERBOARD_CACHE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const { fetchedAt, entries } = parsed as Partial<LeaderboardCache>;
    if (typeof fetchedAt !== 'number' || !Array.isArray(entries)) return null;
    return { fetchedAt, entries };
  } catch {
    return null;
  }
};

/** Overwrite the §8.1 offline cache after a successful GET. */
export const writeLeaderboardCache = (cache: LeaderboardCache): void => {
  localStorage.setItem(LEADERBOARD_CACHE_KEY, JSON.stringify(cache));
};

/**
 * Fresh id for a score submission. crypto.randomUUID when the platform has
 * it, otherwise a getRandomValues-built RFC 4122 v4 — jsdom-proof (jsdom's
 * Crypto lacks randomUUID) and never routed through the seeded game RNG.
 */
export const newSubmissionId = (): string => {
  const c = globalThis.crypto;
  if (typeof c.randomUUID === 'function') return c.randomUUID();
  const bytes = c.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10xx
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};
