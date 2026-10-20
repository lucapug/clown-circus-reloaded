// @vitest-environment jsdom
// Session ring tests (issue #30, test plan 4): the localStorage schema is the
// testable core — exact versioned key, cap-20 FIFO evict-oldest, corrupt-JSON
// resilience and the quota evict-and-retry that must never throw into the
// game loop. jsdom provides localStorage; the storage.ts precedents apply.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { appendSession, readSessions } from '../sessionStore';
import { SESSIONS_CAP, SESSIONS_KEY } from '../types';
import type { JsonSession } from '../types';

beforeEach(() => localStorage.clear());

let sessionCounter = 0;
const session = (seed: number): JsonSession => ({
  format: 'clown-session',
  formatVersion: 1,
  header: { sessionId: `id-${++sessionCounter}-${seed}`, startedAt: '2026-10-20T00:00:00.000Z', appGitSha: 'sha', seed },
  inputs: [],
  events: [],
  snapshots: [],
  markers: [],
  terminal: { tick: 600, digest: {
    phase: 'gameover',
    level: 1,
    currentJumpVelocity: -14,
    stats: { score: 0, lives: 0, bonusJumps: 0 },
    seesaw: { x: 400, tilt: 'center' },
    clowns: [],
    balloonsPopped: 0,
    balloonBits: '0'.repeat(56),
  } },
});

describe('session ring (clown-circus:sessions:v1)', () => {
  it('reads [] from empty storage', () => {
    expect(readSessions()).toEqual([]);
  });

  it('round-trips through the exact versioned key', () => {
    appendSession(session(1));
    expect(localStorage.getItem(SESSIONS_KEY)).toContain('id-1-1');
    expect(readSessions()).toHaveLength(1);
    expect(readSessions()[0].header.seed).toBe(1);
  });

  it('evicts the oldest session beyond the cap of 20 (FIFO)', () => {
    for (let i = 0; i < SESSIONS_CAP; i++) appendSession(session(i));
    expect(readSessions()).toHaveLength(SESSIONS_CAP);
    appendSession(session(999));
    const ring = readSessions();
    expect(ring).toHaveLength(SESSIONS_CAP);
    expect(ring[0].header.seed).toBe(1); // id-0 evicted, seed 1 now oldest
    expect(ring.map((s) => s.header.seed)).not.toContain(0);
    expect(ring[ring.length - 1].header.seed).toBe(999);
  });

  it('treats corrupt ring JSON as empty and never throws', () => {
    localStorage.setItem(SESSIONS_KEY, '{not json at all');
    expect(readSessions()).toEqual([]);
    localStorage.setItem(SESSIONS_KEY, JSON.stringify({ oops: 'wrong shape' }));
    expect(readSessions()).toEqual([]);
  });

  it('on QuotaExceededError evicts the oldest and retries until the write fits', () => {
    for (let i = 0; i < 3; i++) appendSession(session(i));
    expect(readSessions()).toHaveLength(3);

    const realSetItem = Storage.prototype.setItem;
    // jsdom method lookups only see the prototype, so the quota fault is
    // injected there: reject any payload longer than the seeded ring (the
    // 4th session must not fit until the two oldest are evicted).
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key: string, value: string) {
      if (JSON.parse(value).length > 2) throw new DOMException('quota', 'QuotaExceededError');
      return realSetItem.call(this, key, value);
    });

    appendSession(session(3)); // would make 4 > the mocked capacity

    const ring = readSessions();
    expect(ring.map((s) => s.header.seed)).toEqual([2, 3]); // oldest two evicted, newest kept
    spy.mockRestore();
  });

  it('gives up silently when even the empty ring cannot be written (never throws)', () => {
    appendSession(session(1));
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function () {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    expect(() => appendSession(session(2))).not.toThrow();
    expect(readSessions()).toHaveLength(1); // the pre-existing ring is untouched
    expect(readSessions()[0].header.seed).toBe(1);
    spy.mockRestore();
  });
});
