// The §7-speaking HTTP leaderboard service (issue #10). Defaults per the
// brief: same-origin base URL (the 2025 pattern) via VITE_API_BASE_URL,
// the platform fetch, and a 10 s timeout through AbortController. All I/O is
// injectable for tests; storage.ts holds the write-behind queue this service
// drains.
import type {
  DrainResult,
  LeaderboardEntry,
  LeaderboardService,
  LeaderboardSnapshot,
  SubmitScoreOutcome,
} from './leaderboard';
import {
  enqueuePendingScore,
  newSubmissionId,
  readLeaderboardCache,
  readPendingScores,
  removePendingScore,
  writeLeaderboardCache,
} from './storage';

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export interface HttpLeaderboardOptions {
  /** Same-origin by default (VITE_API_BASE_URL ?? ''), the 2025 deployment pattern. */
  baseUrl?: string;
  /** Injectable fetch for tests — the unit-level "server" this cycle. */
  fetchImpl?: FetchLike;
  /** Abort timeout in ms; 10 s default. */
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_LIMIT = 10;

const isDefinitive4xx = (status: number): boolean => status >= 400 && status < 500;

const classify4xx = (status: number): SubmitScoreOutcome => {
  if (status === 422) return { status: 'rejected', reason: 'validation', httpStatus: status };
  if (status === 409) return { status: 'rejected', reason: 'conflict', httpStatus: status };
  return { status: 'rejected', reason: 'other', httpStatus: status };
};

/** Accepts a bare ranked array or an { entries: [...] } wrapper. */
const normalizeEntries = (body: unknown): LeaderboardEntry[] => {
  const list: unknown = Array.isArray(body) ? body : (body as { entries?: unknown })?.entries;
  if (!Array.isArray(list)) return [];
  return list.map((raw, i) => {
    const e = (raw ?? {}) as Partial<LeaderboardEntry>;
    return {
      rank: typeof e.rank === 'number' ? e.rank : i + 1,
      name: typeof e.name === 'string' ? e.name : '',
      score: typeof e.score === 'number' ? e.score : 0,
      date: typeof e.date === 'string' ? e.date : '',
    };
  });
};

export const createHttpLeaderboardService = (opts: HttpLeaderboardOptions = {}): LeaderboardService => {
  const baseUrl = opts.baseUrl ?? import.meta.env.VITE_API_BASE_URL ?? '';
  const fetchImpl: FetchLike = opts.fetchImpl ?? ((url, init) => fetch(url, init));
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  // POST/GET with an abort timeout; network errors and AbortErrors both
  // propagate to the caller for classification (they mean "not definitive").
  const request = async (url: string, init: RequestInit): Promise<Response> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetchImpl(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  };

  const postScore = async (name: string, score: number, submissionId: string): Promise<Response> =>
    request(`${baseUrl}/scores`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, score, submissionId }),
    });

  const submitScore = async (name: string, score: number): Promise<SubmitScoreOutcome> => {
    // Write-behind (the 2025 defect's real fix): enqueue BEFORE the POST so a
    // crash/lost response still leaves the entry safe; a definitive result
    // removes it.
    const submissionId = newSubmissionId();
    // Storage itself can fail (quota exceeded, private mode). Each storage
    // call is guarded: if the enqueue throws we still POST and let the POST
    // result decide — worst case the score saves without queue persistence,
    // which is honest (the player sees the true outcome, never a silent
    // unhandled rejection).
    try {
      enqueuePendingScore({ submissionId, name, score, queuedAt: Date.now() });
    } catch {
      // storage unavailable: continue unqueued
    }
    try {
      const res = await postScore(name, score, submissionId);
      if (res.ok) {
        try {
          removePendingScore(submissionId);
        } catch {
          // best-effort cleanup; the save itself succeeded
        }
        return { status: 'saved', submissionId };
      }
      if (isDefinitive4xx(res.status)) {
        try {
          removePendingScore(submissionId);
        } catch {
          // best-effort cleanup; the rejection itself is definitive
        }
        return classify4xx(res.status);
      }
      return { status: 'queued', submissionId }; // 5xx: not definitive, stays queued
    } catch {
      return { status: 'queued', submissionId }; // network error / timeout
    }
  };

  const fetchLeaderboard = async (limit: number = DEFAULT_LIMIT): Promise<LeaderboardSnapshot> => {
    try {
      const res = await request(`${baseUrl}/leaderboard?limit=${limit}`, { method: 'GET' });
      if (!res.ok) throw new Error(`leaderboard GET failed: ${res.status}`);
      const entries = normalizeEntries(await res.json());
      writeLeaderboardCache({ fetchedAt: Date.now(), entries });
      return { entries, source: 'live' };
    } catch {
      // §8.1 fallback: last successful fetch (empty when nothing cached; a
      // corrupt cache reads as absent — storage.ts never throws).
      const cached = readLeaderboardCache();
      return { entries: cached?.entries ?? [], source: 'cached' };
    }
  };

  const drainPendingSubmissions = async (): Promise<DrainResult> => {
    let synced = 0;
    let dropped = 0;
    // FIFO over the queue snapshot; each retry re-POSTs the STORED
    // submissionId (§7 idempotency key). The first network error, timeout or
    // 5xx stops the drain — the rest stay queued in order for next time.
    for (const entry of readPendingScores()) {
      try {
        const res = await postScore(entry.name, entry.score, entry.submissionId);
        if (res.ok) {
          removePendingScore(entry.submissionId);
          synced++;
        } else if (isDefinitive4xx(res.status)) {
          removePendingScore(entry.submissionId);
          dropped++;
        } else {
          break; // 5xx: stop, keep everything still queued
        }
      } catch {
        break; // network error / timeout: stop, keep the rest queued
      }
    }
    return { synced, dropped, stillQueued: readPendingScores().length };
  };

  return { fetchLeaderboard, submitScore, drainPendingSubmissions };
};
