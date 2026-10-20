import { createConsequences, createInitialState, createRng, step } from '../core';
import type { GameInput, GameState } from '../core';
import { projectSnapshot } from './snapshot';
import type { JsonSession, ReplayResult } from './types';

// Deterministic replay (issue #30): header.seed + recorded inputs through
// the UNTOUCHED core barrel, compared by exact deep equality of projected
// digests — no float tolerance, both sides run the same IEEE-754 ops and
// JSON doubles round-trip losslessly. Events are evidence only; replay never
// consumes them. Pure: no DOM, no storage, no module state.

interface FieldDiff {
  field: string;
  expected: unknown;
  actual: unknown;
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Small recursive diff over the digest shape — the FIRST differing field path wins. */
const firstDiff = (path: string, expected: unknown, actual: unknown): FieldDiff | null => {
  if (expected === actual) return null;
  if (Array.isArray(expected) && Array.isArray(actual)) {
    if (expected.length !== actual.length) {
      return { field: `${path}.length`, expected: expected.length, actual: actual.length };
    }
    for (let i = 0; i < expected.length; i++) {
      const diff = firstDiff(`${path}[${i}]`, expected[i], actual[i]);
      if (diff) return diff;
    }
    return null;
  }
  if (isPlainObject(expected) && isPlainObject(actual)) {
    for (const key of Object.keys(expected)) {
      const diff = firstDiff(path ? `${path}.${key}` : key, expected[key], actual[key]);
      if (diff) return diff;
    }
    return null;
  }
  return { field: path, expected, actual };
};

/**
 * Re-run a recorded trace through the core. Version check first (bypassable
 * with { force: true }), then one `step()` per tick up to the last checkpoint
 * (last snapshot, or the terminal tick — inputs after it cannot affect any
 * comparison), deep-comparing the projection at every recorded snapshot tick
 * and at the terminal tick.
 */
export const replaySession = (session: JsonSession, { force }: { force?: boolean } = {}): ReplayResult => {
  const localSha = __APP_GIT_SHA__;
  if (!force && session.header.appGitSha !== localSha) {
    return { status: 'version-mismatch', traceSha: session.header.appGitSha, localSha };
  }

  const checkpointTicks = [
    ...session.snapshots.map((s) => s.tick),
    ...(session.terminal ? [session.terminal.tick] : []),
  ];
  const lastTick = checkpointTicks.length > 0 ? Math.max(...checkpointTicks) : 0;

  const inputsByTick = new Map<number, GameInput[]>();
  for (const { tick, input } of session.inputs) {
    const atTick = inputsByTick.get(tick);
    if (atTick) atTick.push(input);
    else inputsByTick.set(tick, [input]);
  }
  const digestAt = new Map(session.snapshots.map((s) => [s.tick, s.digest]));

  let state: GameState = { ...createInitialState(), phase: 'playing' };
  const rng = createRng(session.header.seed);
  const consequences = createConsequences();
  let snapshotsMatched = 0;

  for (let tick = 1; tick <= lastTick; tick++) {
    const result = step(state, inputsByTick.get(tick) ?? [], rng, consequences);
    state = result.state;

    const expectedDigest = digestAt.get(tick);
    if (expectedDigest !== undefined) {
      const diff = firstDiff('', expectedDigest, projectSnapshot(state));
      if (diff) {
        return {
          status: 'diverged',
          firstDivergence: { tick, field: diff.field, expected: diff.expected, actual: diff.actual },
        };
      }
      snapshotsMatched++;
    }
    if (session.terminal && session.terminal.tick === tick) {
      const diff = firstDiff('', session.terminal.digest, projectSnapshot(state));
      if (diff) {
        return {
          status: 'diverged',
          firstDivergence: { tick, field: diff.field, expected: diff.expected, actual: diff.actual },
        };
      }
    }
  }

  return { status: 'ok', ticksReplayed: lastTick, snapshotsMatched };
};
