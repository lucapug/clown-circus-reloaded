// @vitest-environment jsdom
// storage.ts tests (issue #10, TDD step 1): the localStorage schema is the
// testable core this cycle — queue FIFO order, cap-20 evict-oldest,
// corrupt-JSON resilience and unique submission ids. jsdom provides
// localStorage; no network is ever touched here.
import { beforeEach, describe, expect, it } from 'vitest';
import {
  LEADERBOARD_CACHE_KEY,
  PENDING_QUEUE_CAP,
  PENDING_SCORES_KEY,
  enqueuePendingScore,
  newSubmissionId,
  readLeaderboardCache,
  readPendingScores,
  removePendingScore,
  writeLeaderboardCache,
  type PendingScore,
} from '../storage';

beforeEach(() => {
  localStorage.clear();
});

const pending = (submissionId: string, queuedAt = 1000): PendingScore => ({
  submissionId,
  name: 'Ada',
  score: 12345,
  queuedAt,
});

describe('pending-scores queue', () => {
  it('reads [] from empty storage', () => {
    expect(readPendingScores()).toEqual([]);
  });

  it('enqueues FIFO: array order = submission order', () => {
    enqueuePendingScore(pending('id-1', 1000));
    enqueuePendingScore(pending('id-2', 2000));
    const queue = readPendingScores();
    expect(queue.map((e) => e.submissionId)).toEqual(['id-1', 'id-2']);
    expect(queue[1]).toMatchObject({ submissionId: 'id-2', name: 'Ada', score: 12345, queuedAt: 2000 });
  });

  it('round-trips through the exact key', () => {
    enqueuePendingScore(pending('id-1'));
    expect(localStorage.getItem(PENDING_SCORES_KEY)).toContain('id-1');
    expect(readPendingScores()).toHaveLength(1);
  });

  it('removes an entry by submissionId, preserving the rest', () => {
    enqueuePendingScore(pending('id-1', 1000));
    enqueuePendingScore(pending('id-2', 2000));
    enqueuePendingScore(pending('id-3', 3000));
    removePendingScore('id-2');
    expect(readPendingScores().map((e) => e.submissionId)).toEqual(['id-1', 'id-3']);
  });

  it('evicts the oldest entry when the queue overflows the cap of 20 (issue #10 decision)', () => {
    for (let i = 0; i < PENDING_QUEUE_CAP; i++) {
      enqueuePendingScore(pending(`id-${i}`, i));
    }
    expect(readPendingScores()).toHaveLength(PENDING_QUEUE_CAP);
    enqueuePendingScore(pending('id-new', 9999));
    const queue = readPendingScores();
    expect(queue).toHaveLength(PENDING_QUEUE_CAP);
    expect(queue.map((e) => e.submissionId)).not.toContain('id-0'); // oldest evicted
    expect(queue[queue.length - 1].submissionId).toBe('id-new'); // newest kept
  });

  it('treats corrupt queue JSON as empty and never throws', () => {
    localStorage.setItem(PENDING_SCORES_KEY, '{not json at all');
    expect(readPendingScores()).toEqual([]);
    localStorage.setItem(PENDING_SCORES_KEY, JSON.stringify({ oops: 'wrong shape' }));
    expect(readPendingScores()).toEqual([]);
  });
});

describe('leaderboard cache', () => {
  it('returns null when nothing is cached', () => {
    expect(readLeaderboardCache()).toBeNull();
  });

  it('round-trips fetchedAt + entries', () => {
    writeLeaderboardCache({ fetchedAt: 42, entries: [{ rank: 1, name: 'Ada', score: 1, date: '2026-01-01' }] });
    expect(localStorage.getItem(LEADERBOARD_CACHE_KEY)).toContain('Ada');
    expect(readLeaderboardCache()).toEqual({
      fetchedAt: 42,
      entries: [{ rank: 1, name: 'Ada', score: 1, date: '2026-01-01' }],
    });
  });

  it('treats corrupt cache JSON as absent and never throws', () => {
    localStorage.setItem(LEADERBOARD_CACHE_KEY, ']]] broken');
    expect(readLeaderboardCache()).toBeNull();
  });
});

describe('newSubmissionId (spec §6.2: ids never flow through the seeded RNG)', () => {
  it('yields unique ids across many calls', () => {
    const ids = new Set(Array.from({ length: 50 }, () => newSubmissionId()));
    expect(ids.size).toBe(50);
  });

  it('is stable across the jsdom fallback path (crypto.randomUUID stripped)', () => {
    const original = globalThis.crypto.randomUUID;
    // Feature-detection must survive a runtime without randomUUID (jsdom-proof
    // fallback via getRandomValues-built v4).
    delete (globalThis.crypto as { randomUUID?: Crypto['randomUUID'] }).randomUUID;
    try {
      const ids = new Set(Array.from({ length: 50 }, () => newSubmissionId()));
      expect(ids.size).toBe(50);
    } finally {
      Object.defineProperty(globalThis.crypto, 'randomUUID', { value: original, writable: true });
    }
  });
});
