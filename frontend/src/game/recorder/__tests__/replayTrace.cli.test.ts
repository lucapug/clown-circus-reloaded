import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { replaySession } from '../replay';
import type { JsonSession } from '../types';

// The `npm run replay` runner (issue #30): loads a downloaded
// clown-session-<id>.json, replays it through the untouched core and prints
// the verdict. Env-gated: when REPLAY_TRACE is unset (CI, plain suites) the
// case skips and stays green.
// Usage: cd frontend && REPLAY_TRACE=/tmp/clown-session-<id>.json npm run replay
const tracePath = process.env.REPLAY_TRACE;

describe('REPLAY_TRACE runner (env-gated; backs npm run replay)', () => {
  (tracePath ? it : it.skip)(`replays the trace at $REPLAY_TRACE`, () => {
    const session = JSON.parse(readFileSync(tracePath!, 'utf8')) as JsonSession;
    console.info(
      `[replay] trace ${session.header.sessionId} · seed ${session.header.seed} · appGitSha ${session.header.appGitSha} · ${session.inputs.length} inputs · ${session.snapshots.length} snapshots`,
    );
    const result = replaySession(session);
    if (result.status === 'diverged') {
      console.info(
        `[replay] first divergence at tick ${result.firstDivergence.tick} (${result.firstDivergence.field}: expected ${JSON.stringify(result.firstDivergence.expected)}, got ${JSON.stringify(result.firstDivergence.actual)})`,
      );
    } else {
      console.info(`[replay] status=${result.status}`);
    }
    expect(result.status).toBe('ok');
  });
});
