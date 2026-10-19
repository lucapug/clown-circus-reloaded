// @vitest-environment jsdom
// leaderboardMock.ts tests (issue #10, case group 7): the zero-backend dev
// service (plan D4). Mirrors §7 validation so the rejection path is
// dev-visible, keeps an in-memory arcade board sorted score-desc with
// re-ranked rows, and routes offline submits through the SAME storage.ts
// queue the HTTP service uses — so offline dev exercises the real sync path.
import { beforeEach, describe, expect, it } from 'vitest';
import { createMockLeaderboardService } from '../leaderboardMock';
import { readPendingScores } from '../storage';

beforeEach(() => {
  localStorage.clear();
});

describe('mock leaderboard board', () => {
  it('ships 5 arcade-style canned rows, sorted score-desc with 1-based ranks', async () => {
    const service = createMockLeaderboardService();
    const snapshot = await service.fetchLeaderboard();

    expect(snapshot.source).toBe('live');
    expect(snapshot.entries).toHaveLength(5);
    expect(snapshot.entries.map((e) => e.rank)).toEqual([1, 2, 3, 4, 5]);
    const scores = snapshot.entries.map((e) => e.score);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
    expect(snapshot.entries.every((e) => e.name.length > 0)).toBe(true);
  });

  it('respects the limit param', async () => {
    const service = createMockLeaderboardService();
    expect((await service.fetchLeaderboard(2)).entries).toHaveLength(2);
  });
});

describe('mock §7 validation (mirrored so rejection is dev-visible)', () => {
  it.each([
    ['bad name!!!', 10], // illegal characters
    ['', 10], // empty
    ['abcdefghijkl', 10], // > 10 chars
    ['Ada', -1], // negative score
    ['Ada', 1.5], // non-integer score
  ])('name=%j score=%j → rejected/validation (422), never queued', async (name, score) => {
    const service = createMockLeaderboardService({ offline: true });
    const outcome = await service.submitScore(name as string, score as number);
    expect(outcome).toEqual({ status: 'rejected', reason: 'validation', httpStatus: 422 });
    expect(readPendingScores()).toEqual([]);
  });

  it('accepts alphanumeric + spaces, 1–10 chars, int ≥ 0', async () => {
    const service = createMockLeaderboardService();
    const outcome = await service.submitScore('ADA LOVE', 0);
    expect(outcome).toMatchObject({ status: 'saved' });
  });
});

describe('mock submits', () => {
  it('online: saved, inserted into the board, resorted score-desc and re-ranked', async () => {
    const service = createMockLeaderboardService();
    const before = (await service.fetchLeaderboard()).entries;
    const topScore = before[0].score;

    const outcome = await service.submitScore('Zed', topScore + 500);
    expect(outcome.status).toBe('saved');

    const after = (await service.fetchLeaderboard()).entries;
    expect(after[0]).toMatchObject({ rank: 1, name: 'Zed' });
    expect(after[1].name).toBe(before[0].name); // pushed down, not lost
    expect(after.map((e) => e.rank)).toEqual(after.map((_, i) => i + 1));
    expect(readPendingScores()).toEqual([]);
  });

  it('offline:true → queued through the SAME storage queue; a non-offline instance drains it into the board', async () => {
    const offline = createMockLeaderboardService({ offline: true });
    const outcome = await offline.submitScore('Ada', 777);
    expect(outcome).toMatchObject({ status: 'queued' });
    const queued = readPendingScores();
    expect(queued).toHaveLength(1);
    expect(queued[0]).toMatchObject({ name: 'Ada', score: 777 });

    // "Reload" into connectivity: drain syncs the queued row into the board.
    const online = createMockLeaderboardService();
    const drain = await online.drainPendingSubmissions();
    expect(drain).toEqual({ synced: 1, dropped: 0, stillQueued: 0 });
    expect(readPendingScores()).toEqual([]);
    const board = (await online.fetchLeaderboard()).entries;
    expect(board.find((e) => e.name === 'Ada')?.score).toBe(777);
  });

  it('offline drain keeps entries queued (still no connectivity)', async () => {
    await createMockLeaderboardService({ offline: true }).submitScore('Ada', 1);
    const drain = await createMockLeaderboardService({ offline: true }).drainPendingSubmissions();
    expect(drain).toEqual({ synced: 0, dropped: 0, stillQueued: 1 });
    expect(readPendingScores()).toHaveLength(1);
  });
});
