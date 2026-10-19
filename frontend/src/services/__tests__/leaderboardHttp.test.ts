// @vitest-environment jsdom
// leaderboardHttp.ts tests (issue #10, TDD step 2): the §7-speaking HTTP
// implementation, unit-tested against an injected fetch stub — no network.
//
// Lost-response simulation, stated plainly: the stub records/registers the
// POST body (the "server" persisted it) and then throws
// `TypeError('Failed to fetch')` mid-flight, so the client never saw an
// acknowledgement. Case 1 is this cycle's unit-level §8.2 exactly-one-row
// evidence: the retry reuses the stored submissionId, which is what makes a
// double row impossible once a real §7 server exists. Live-server
// integration is explicitly M3/M4 work, not claimable here.
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import {
  createHttpLeaderboardService,
  type FetchLike,
} from '../leaderboardHttp';
import { PENDING_SCORES_KEY, readPendingScores } from '../storage';
import type { LeaderboardEntry } from '../leaderboard';

beforeEach(() => {
  localStorage.clear();
});

type Db = Map<string, { name: string; score: number }>;

const jsonResponse = (status: number, body: unknown = {}) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

const entry = (i: number): LeaderboardEntry => ({ rank: i + 1, name: `P${i + 1}`, score: 100 - i, date: '2026-01-01' });

const requestBody = (init?: RequestInit): { name: string; score: number; submissionId: string } =>
  JSON.parse(String(init?.body));

/** Stub whose POST persists into the "DB", then dies mid-flight (lost response). */
const lostResponseStub = (db: Db): Mock<FetchLike> =>
  vi.fn(async (_url: string, init?: RequestInit) => {
    const body = requestBody(init);
    db.set(body.submissionId, { name: body.name, score: body.score });
    throw new TypeError('Failed to fetch');
  });

/** Healthy §7 server: 201 on new submissions, idempotent 201 replay on the same id, 409 on payload conflict. */
const healthyStub = (db: Db, leaderboard: LeaderboardEntry[] = []): Mock<FetchLike> =>
  vi.fn(async (url: string, init?: RequestInit) => {
    if (String(url).includes('/leaderboard')) return jsonResponse(200, leaderboard);
    const body = requestBody(init);
    const existing = db.get(body.submissionId);
    if (existing) {
      if (existing.name !== body.name || existing.score !== body.score) return jsonResponse(409, {});
      return jsonResponse(201, { replayed: true });
    }
    db.set(body.submissionId, { name: body.name, score: body.score });
    return jsonResponse(201, {});
  });

const postCalls = (stub: Mock<FetchLike>) =>
  stub.mock.calls.filter(([url]) => !String(url).includes('/leaderboard'));

describe('submitScore classification (write-behind: enqueue happens before the POST)', () => {
  it('POSTs {name, score, submissionId} to {base}/scores and returns saved on 2xx, removing the pending entry', async () => {
    const stub = healthyStub(new Map());
    const service = createHttpLeaderboardService({ baseUrl: '/api', fetchImpl: stub });
    const outcome = await service.submitScore('Ada', 12345);

    expect(outcome).toMatchObject({ status: 'saved' });
    const [url, init] = postCalls(stub)[0];
    expect(url).toBe('/api/scores');
    expect(requestBody(init)).toMatchObject({ name: 'Ada', score: 12345 });
    expect((init?.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    expect((outcome as { submissionId: string }).submissionId).toBe(requestBody(init).submissionId);
    expect(readPendingScores()).toEqual([]);
  });

  it('network error mid-flight → queued; queue holds the entry with the same id (case 1, act I)', async () => {
    const db: Db = new Map();
    const service = createHttpLeaderboardService({ fetchImpl: lostResponseStub(db) });
    const outcome = await service.submitScore('Ada', 12345);

    expect(outcome).toMatchObject({ status: 'queued' });
    const queue = readPendingScores();
    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({ name: 'Ada', score: 12345, submissionId: (outcome as { submissionId: string }).submissionId });
    expect(db.has((outcome as { submissionId: string }).submissionId)).toBe(true); // the "server" got it
  });

  it('422 → rejected/validation, entry dropped immediately, never retried (case 3)', async () => {
    const stub = vi.fn(async () => jsonResponse(422, { detail: 'invalid' }));
    const service = createHttpLeaderboardService({ fetchImpl: stub });
    const outcome = await service.submitScore('bad name!!!', 1);

    expect(outcome).toEqual({ status: 'rejected', reason: 'validation', httpStatus: 422 });
    expect(readPendingScores()).toEqual([]);
    await service.drainPendingSubmissions(); // nothing left to retry
    expect(postCalls(stub)).toHaveLength(1); // no second POST for it
  });

  it('409 on submit → rejected/conflict; any other 4xx → rejected/other; both definitive (removed)', async () => {
    const conflict = createHttpLeaderboardService({ fetchImpl: vi.fn(async () => jsonResponse(409)) });
    expect(await conflict.submitScore('Ada', 5)).toEqual({ status: 'rejected', reason: 'conflict', httpStatus: 409 });

    const other = createHttpLeaderboardService({ fetchImpl: vi.fn(async () => jsonResponse(400)) });
    expect(await other.submitScore('Ada', 5)).toEqual({ status: 'rejected', reason: 'other', httpStatus: 400 });

    expect(readPendingScores()).toEqual([]);
  });

  it('5xx → queued and stays queued', async () => {
    const service = createHttpLeaderboardService({ fetchImpl: vi.fn(async () => jsonResponse(503)) });
    const outcome = await service.submitScore('Ada', 5);
    expect(outcome).toMatchObject({ status: 'queued' });
    expect(readPendingScores()).toHaveLength(1);
  });

  it('timeout (stub hangs until abort, tiny timeoutMs) → queued (case 4)', async () => {
    const hanging: FetchLike = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        }),
    );
    const service = createHttpLeaderboardService({ fetchImpl: hanging, timeoutMs: 20 });
    const outcome = await service.submitScore('Ada', 5);
    expect(outcome).toMatchObject({ status: 'queued' });
    expect(readPendingScores()).toHaveLength(1);
  });

  it('a storage throw during enqueue is guarded: defined outcome, no unhandled rejection, queue consistent', async () => {
    // Reviewer finding (PR #25, comment 6272623636): quota-exceeded/private-
    // mode setItem used to escape submitScore as an unhandled rejection.
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });
    try {
      const service = createHttpLeaderboardService({
        fetchImpl: vi.fn(async () => {
          throw new TypeError('Failed to fetch');
        }),
      });
      // A typed outcome must resolve (not reject) even with storage broken.
      await expect(service.submitScore('Ada', 5)).resolves.toMatchObject({ status: 'queued' });
      expect(readPendingScores()).toEqual([]); // nothing persisted, no crash
    } finally {
      setItem.mockRestore();
    }
  });
});

describe('case 1 — lost response, reload, healthy drain: exactly one row (§8.2, unit level)', () => {
  it('the same submissionId is reused on the retry; the "DB" keeps exactly one row for it', async () => {
    const db: Db = new Map();
    const offline = createHttpLeaderboardService({ fetchImpl: lostResponseStub(db) });
    const outcome = await offline.submitScore('Ada', 12345);
    const submissionId = (outcome as { submissionId: string }).submissionId;

    // "Reload": brand-new service instance, same localStorage, healthy server.
    const retryStub = healthyStub(db);
    const fresh = createHttpLeaderboardService({ fetchImpl: retryStub });
    const drain = await fresh.drainPendingSubmissions();

    expect(drain).toEqual({ synced: 1, dropped: 0, stillQueued: 0 });
    expect(readPendingScores()).toEqual([]);
    expect(requestBody(postCalls(retryStub)[0][1]).submissionId).toBe(submissionId);
    const rows = [...db.entries()].filter(([id]) => id === submissionId);
    expect(rows).toHaveLength(1); // exactly one row — a double row is impossible once a real §7 server exists
    expect(db.size).toBe(1);
  });
});

describe('case 2 — same submissionId, different payload on retry → 409 → dropped, surfaced', () => {
  it('drain reports dropped and the queue is empty afterwards', async () => {
    const db: Db = new Map();
    const offline = createHttpLeaderboardService({ fetchImpl: lostResponseStub(db) });
    const outcome = await offline.submitScore('Ada', 100);
    const submissionId = (outcome as { submissionId: string }).submissionId;

    // Payload diverges for the same id before the retry (the 409 trigger).
    const queue = readPendingScores();
    queue[0] = { ...queue[0], score: 999 };
    localStorage.setItem(PENDING_SCORES_KEY, JSON.stringify(queue));

    const fresh = createHttpLeaderboardService({ fetchImpl: healthyStub(db) });
    const drain = await fresh.drainPendingSubmissions();
    expect(drain).toEqual({ synced: 0, dropped: 1, stillQueued: 0 });
    expect(readPendingScores()).toEqual([]);
    expect(db.has(submissionId)).toBe(true); // original row untouched
  });
});

describe('drainPendingSubmissions', () => {
  it('drains FIFO with the STORED submissionIds; first network failure stops the drain, order preserved', async () => {
    const db: Db = new Map();
    const offline = createHttpLeaderboardService({ fetchImpl: lostResponseStub(db) });
    await offline.submitScore('A', 1);
    await offline.submitScore('B', 2);
    await offline.submitScore('C', 3);
    expect(readPendingScores().map((e) => e.name)).toEqual(['A', 'B', 'C']);

    // Healthy for the first entry, dies again mid-flight for the second.
    let calls = 0;
    const flaky = vi.fn(async (_url: string, init?: RequestInit) => {
      calls++;
      if (calls === 1) return jsonResponse(201);
      const body = requestBody(init);
      db.set(body.submissionId, { name: body.name, score: body.score });
      throw new TypeError('Failed to fetch');
    });
    const fresh = createHttpLeaderboardService({ fetchImpl: flaky });
    const drain = await fresh.drainPendingSubmissions();

    expect(drain).toEqual({ synced: 1, dropped: 0, stillQueued: 2 });
    expect(readPendingScores().map((e) => e.name)).toEqual(['B', 'C']); // order preserved
    expect(postCalls(flaky)).toHaveLength(2); // never reached C
  });

  it('a definitive 4xx during drain removes the entry and counts it as dropped', async () => {
    const offline = createHttpLeaderboardService({ fetchImpl: lostResponseStub(new Map()) });
    await offline.submitScore('Ada', 1);
    const fresh = createHttpLeaderboardService({
      fetchImpl: vi.fn(async () => jsonResponse(422)),
    });
    const drain = await fresh.drainPendingSubmissions();
    expect(drain).toEqual({ synced: 0, dropped: 1, stillQueued: 0 });
    expect(readPendingScores()).toEqual([]);
  });

  it('a 5xx during drain stops draining; the rest stay queued', async () => {
    const offline = createHttpLeaderboardService({ fetchImpl: lostResponseStub(new Map()) });
    await offline.submitScore('A', 1);
    await offline.submitScore('B', 2);
    let calls = 0;
    const fresh = createHttpLeaderboardService({
      fetchImpl: vi.fn(async () => {
        calls++;
        return jsonResponse(calls === 1 ? 500 : 201);
      }),
    });
    const drain = await fresh.drainPendingSubmissions();
    expect(drain).toEqual({ synced: 0, dropped: 0, stillQueued: 2 });
    expect(calls).toBe(1);
  });
});

describe('fetchLeaderboard (§8.1: live success caches; failure falls back to the cache)', () => {
  it('GETs {base}/leaderboard?limit= and returns {source: live}, writing the cache', async () => {
    const stub = healthyStub(new Map(), [entry(0), entry(1)]);
    const service = createHttpLeaderboardService({ baseUrl: '/api', fetchImpl: stub });
    const snapshot = await service.fetchLeaderboard(5);

    const [getUrl] = stub.mock.calls.find(([url]) => String(url).includes('/leaderboard'))!;
    expect(getUrl).toBe('/api/leaderboard?limit=5');
    expect(snapshot).toEqual({ entries: [entry(0), entry(1)], source: 'live' });
    expect(readPendingScores()).toEqual([]);
    expect(localStorage.getItem('clown-circus:leaderboard-cache:v1')).toContain('P1');
  });

  it('GET failure → cached entries with {source: cached}; empty array when nothing cached (case 5)', async () => {
    const service = createHttpLeaderboardService({ fetchImpl: vi.fn(async () => { throw new TypeError('Failed to fetch'); }) });
    expect(await service.fetchLeaderboard()).toEqual({ entries: [], source: 'cached' });

    const warm = createHttpLeaderboardService({ fetchImpl: healthyStub(new Map(), [entry(0)]) });
    await warm.fetchLeaderboard();
    const offline = createHttpLeaderboardService({
      fetchImpl: vi.fn(async () => jsonResponse(500)),
    });
    const snapshot = await offline.fetchLeaderboard();
    expect(snapshot.source).toBe('cached');
    expect(snapshot.entries).toHaveLength(1);
  });

  it('corrupt cache JSON → empty entries, no throw (case 5)', async () => {
    localStorage.setItem('clown-circus:leaderboard-cache:v1', '{oops');
    const service = createHttpLeaderboardService({ fetchImpl: vi.fn(async () => { throw new TypeError('Failed to fetch'); }) });
    await expect(service.fetchLeaderboard()).resolves.toEqual({ entries: [], source: 'cached' });
  });

  it('accepts both {entries: [...]} and bare-array response bodies', async () => {
    const wrapped = createHttpLeaderboardService({
      fetchImpl: vi.fn(async () => jsonResponse(200, { entries: [entry(0)] })),
    });
    expect(await wrapped.fetchLeaderboard()).toEqual({ entries: [entry(0)], source: 'live' });

    const bare = createHttpLeaderboardService({
      fetchImpl: vi.fn(async () => jsonResponse(200, [entry(0), entry(1)])),
    });
    expect(await bare.fetchLeaderboard()).toEqual({ entries: [entry(0), entry(1)], source: 'live' });
  });
});
