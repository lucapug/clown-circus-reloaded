// @vitest-environment jsdom
// Live leaderboard integration (issue #41): the §8 offline-queue behaviors
// verified against the REAL backend. jsdom provides localStorage so
// storage.ts runs completely unmocked; the REAL platform fetch (Node undici)
// talks over 127.0.0.1 to a real uvicorn process. The tests construct
// createHttpLeaderboardService({ baseUrl }) directly — production wiring is
// untouched — and NEVER start servers: the runner starts the backend and
// exports LEADERBOARD_INTEGRATION_URL. Unset (CI, plain `npm run test`) the
// file reports as skipped and the suite stays green; set → real-network run.
//
// Harness (backend on a high port, fresh SQLite per run for deterministic
// row counts, CORS allow-list for the vitest/jsdom origin):
//   cd backend
//   DATABASE_URL="sqlite:////tmp/cr-it-$(date +%s).db" \
//   CORS_ORIGINS="http://localhost:3000,http://127.0.0.1:3000" \
//   uv run uvicorn app.main:app --host 127.0.0.1 --port 8931
//   cd ../frontend && LEADERBOARD_INTEGRATION_URL=http://127.0.0.1:8931 \
//     npx vitest run src/services/__tests__/integration.leaderboard.test.ts
//
// Anti-hang: `vitest run` only (never watch); every test carries a 15 s
// timeout; the fault proxy below is the ONLY thing a test creates and is
// closed unconditionally in afterAll; "backend down" is simulated with the
// connection-refused port http://127.0.0.1:9 — no real server is ever
// stopped.
import net from 'node:net';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { SubmitScoreOutcome } from '../leaderboard';
import { createHttpLeaderboardService } from '../leaderboardHttp';
import { readPendingScores } from '../storage';

const baseUrl = process.env.LEADERBOARD_INTEGRATION_URL; // e.g. http://127.0.0.1:8931

type QueuedOutcome = Extract<SubmitScoreOutcome, { status: 'queued' }>;

(baseUrl ? describe : describe.skip)('live leaderboard integration (LEADERBOARD_INTEGRATION_URL)', () => {
  const realBaseUrl = baseUrl as string;
  // Connection-refused port: the "backend down" state without stopping any server.
  const DEAD_URL = 'http://127.0.0.1:9';

  // Unique per-run identifiers. Names must satisfy the wire constraint
  // (1–10 chars, ^[a-zA-Z0-9 ]+$): "IT" + 6 base36 time chars + 2 counter
  // chars = 10. Scores are drawn past any human range and unique per submit.
  const runTag = Date.now().toString(36).slice(-6);
  let seq = 0;
  const uniqueName = (): string => `IT${runTag}${(seq++).toString(36).padStart(2, '0')}`;
  const uniqueScore = (): number => 900000 + seq;

  beforeEach(() => {
    localStorage.clear();
  });

  // --- Lost-response fault proxy (AC 3; implementation choice: proxy fault
  // injection — not kill-after-persist, not a test endpoint) ---
  //
  // A raw TCP proxy (node:net) that forwards request bytes upstream and, on
  // the FIRST upstream→proxy response byte, destroys BOTH sockets without
  // ever writing a response byte to the client.
  //
  // Correctness argument: uvicorn writes the 201 only after the row is
  // committed (routes_leaderboard.submit_score → crud.create_or_get), so
  // "first response byte seen" ⇒ "persisted". Client side: the destroyed
  // socket makes fetch reject (TypeError) → leaderboardHttp.ts catch →
  // 'queued'; undici does not retry POSTs, so no double-send. Repeat runs
  // are safe because each run uses a fresh database.
  let proxy: { server: net.Server } | null = null;

  const startLostResponseProxy = (): Promise<number> =>
    new Promise((resolve, reject) => {
      const upstream = new URL(realBaseUrl);
      const server = net.createServer((client) => {
        let upstreamSocket: net.Socket | null = null;
        let faulted = false;
        client.on('data', (chunk: Buffer) => {
          if (faulted) return;
          if (upstreamSocket === null) {
            upstreamSocket = net.connect(Number(upstream.port), upstream.hostname);
            upstreamSocket.on('data', () => {
              // First upstream response byte ⇒ the row is persisted (see the
              // comment above). Cut BOTH sides; nothing is written back.
              faulted = true;
              client.destroy();
              upstreamSocket?.destroy();
            });
            upstreamSocket.on('error', () => client.destroy());
          }
          // Writes issued before the upstream connect completes are buffered
          // by the socket and flushed in arrival order.
          upstreamSocket.write(chunk);
        });
        client.on('error', () => upstreamSocket?.destroy());
      });
      server.on('error', reject);
      // Port 0: the OS assigns an ephemeral port — this suite owns no fixed port.
      server.listen(0, '127.0.0.1', () => {
        proxy = { server };
        const address = server.address();
        const port = typeof address === 'object' && address !== null ? address.port : 0;
        resolve(port);
      });
    });

  afterAll(() => {
    // Unconditional: the fault proxy is the only thing a test creates.
    // No lingering sockets remain to hold the close open: the fault path
    // destroys both sides. (net.Server has no closeAllConnections — that
    // is an http.Server method.)
    proxy?.server.close();
  });

  const fetchLeaderboardRows = async (limit = 100): Promise<Array<{ name: string; score: number }>> => {
    const res = await fetch(`${realBaseUrl}/leaderboard?limit=${limit}`);
    expect(res.ok).toBe(true);
    const body = (await res.json()) as { entries: Array<{ name: string; score: number }> };
    return body.entries;
  };

  it(
    'submit against the live API → saved, queue drained to empty, exactly one leaderboard row',
    async () => {
      const service = createHttpLeaderboardService({ baseUrl: realBaseUrl });
      const name = uniqueName();
      const score = uniqueScore();

      const outcome = await service.submitScore(name, score);
      expect(outcome).toEqual({ status: 'saved', submissionId: expect.any(String) });
      expect(readPendingScores()).toEqual([]);

      const rows = await fetchLeaderboardRows();
      expect(rows.filter((row) => row.name === name && row.score === score)).toHaveLength(1);
    },
    15000,
  );

  it(
    'backend down → queued exactly once, the stored submissionId is in the queue',
    async () => {
      const downService = createHttpLeaderboardService({ baseUrl: DEAD_URL });
      const name = uniqueName();
      const score = uniqueScore();

      const outcome = await downService.submitScore(name, score);
      expect(outcome).toEqual({ status: 'queued', submissionId: expect.any(String) });

      const queue = readPendingScores();
      expect(queue).toHaveLength(1);
      expect(queue[0]).toMatchObject({
        submissionId: (outcome as QueuedOutcome).submissionId,
        name,
        score,
      });
    },
    15000,
  );

  it(
    'recovered backend + fresh instance → drain exactly once; stored-submissionId replay is idempotent (201)',
    async () => {
      // Arrange the outage: one score queued while the backend is unreachable.
      const downService = createHttpLeaderboardService({ baseUrl: DEAD_URL });
      const name = uniqueName();
      const score = uniqueScore();
      const queuedOutcome = await downService.submitScore(name, score);
      expect(queuedOutcome.status).toBe('queued');
      const submissionId = (queuedOutcome as QueuedOutcome).submissionId;
      expect(readPendingScores()).toHaveLength(1);

      // "Reload": a fresh service instance over the same localStorage, now
      // pointed at the real (recovered) backend.
      const service = createHttpLeaderboardService({ baseUrl: realBaseUrl });
      await expect(service.drainPendingSubmissions()).resolves.toEqual({
        synced: 1,
        dropped: 0,
        stillQueued: 0,
      });
      expect(readPendingScores()).toEqual([]);
      // A second drain is a no-op.
      await expect(service.drainPendingSubmissions()).resolves.toEqual({
        synced: 0,
        dropped: 0,
        stillQueued: 0,
      });

      // Exactly one row for that name.
      const rowsAfter = await fetchLeaderboardRows();
      expect(rowsAfter.filter((row) => row.name === name)).toHaveLength(1);

      // Raw replay of the STORED submissionId with the same payload → 201
      // (idempotent) and the row count is unchanged (no double insert).
      const replay = await fetch(`${realBaseUrl}/scores`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, score, submissionId }),
      });
      expect(replay.status).toBe(201);
      const rowsAfterReplay = await fetchLeaderboardRows();
      expect(rowsAfterReplay.filter((row) => row.name === name)).toHaveLength(1);
    },
    15000,
  );

  it(
    'definitive 422 (name > 10 chars) → rejected as validation, dropped, not retried',
    async () => {
      const service = createHttpLeaderboardService({ baseUrl: realBaseUrl });
      const badName = 'X'.repeat(11); // violates the 1–10 char wire constraint

      const outcome = await service.submitScore(badName, 1);
      expect(outcome).toEqual({ status: 'rejected', reason: 'validation', httpStatus: 422 });
      expect(readPendingScores()).toEqual([]);

      const rows = await fetchLeaderboardRows();
      expect(rows.some((row) => row.name === badName)).toBe(false);
    },
    15000,
  );

  it(
    'lost response (server persisted, client never saw the 2xx) → queued, then drain yields exactly one row',
    async () => {
      const proxyPort = await startLostResponseProxy();
      const proxiedService = createHttpLeaderboardService({ baseUrl: `http://127.0.0.1:${proxyPort}` });
      const name = uniqueName();
      const score = uniqueScore();

      // The POST is persisted upstream but the response is destroyed in
      // transit: the client must see a network error → queued.
      const outcome = await proxiedService.submitScore(name, score);
      expect(outcome.status).toBe('queued');
      expect(readPendingScores()).toHaveLength(1);

      // Recovery: drain through the real base URL — exactly one sync.
      const recovered = createHttpLeaderboardService({ baseUrl: realBaseUrl });
      await expect(recovered.drainPendingSubmissions()).resolves.toEqual({
        synced: 1,
        dropped: 0,
        stillQueued: 0,
      });

      // The AC's exactness claim: exactly one leaderboard row.
      const rows = await fetchLeaderboardRows();
      expect(rows.filter((row) => row.name === name && row.score === score)).toHaveLength(1);
    },
    15000,
  );
});
