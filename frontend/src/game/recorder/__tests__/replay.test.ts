import { describe, expect, it } from 'vitest';
import {
  advance,
  createConsequences,
  createInitialState,
  createRng,
  type GameInput,
  type Simulation,
} from '../../core';
import { replaySession } from '../replay';
import { createSessionRecorder } from '../sessionRecorder';
import { projectSnapshot } from '../snapshot';
import type { JsonSession } from '../types';

// THE in-code proof of the exact-replay AC (issue #30, test plan 2): drive
// the REAL core for ≥ 1300 ticks through advance() — the same driver the
// game loop uses — with the loop's frame-level recording conventions, then
// export (through a JSON round-trip, proving losslessness) and replay.
// Frames are 1 s → 60 ticks each, so this also exercises multi-tick frame
// attribution (inputs/events stamped at the frame's first executed tick).

const FRAMES = 25; // 25 × 60 = 1500 ticks — crosses the 600 and 1200 boundaries
const FRAME_SECONDS = 1;

// Organic-style play: launches every 23rd logical tick and move-seesaw every
// 7th, generated per LOGICAL tick and queued into the pending queue the way
// real user events arrive between frames.
const inputsForLogicalTick = (tick: number): GameInput[] => {
  const inputs: GameInput[] = [];
  if (tick % 23 === 0) inputs.push({ type: 'launch' });
  if (tick % 7 === 0) inputs.push({ type: 'move-seesaw', x: 400 + ((tick * 37) % 280) - 140 });
  return inputs;
};

const recordSession = (): JsonSession => {
  const sim: Simulation = { state: { ...createInitialState(), phase: 'playing' }, accumulator: 0 };
  const rng = createRng(42);
  const recorder = createSessionRecorder({ appVersion: __APP_GIT_SHA__ });
  recorder.start(42);

  let tick = 0;
  let terminalStamped = false;
  for (let frame = 0; frame < FRAMES; frame++) {
    const firstTick = tick + 1;
    const pending: GameInput[] = [];
    for (let t = firstTick; t < firstTick + FRAME_SECONDS * 60; t++) pending.push(...inputsForLogicalTick(t));
    const taken = pending.splice(0);

    const result = advance(sim, FRAME_SECONDS, rng, createConsequences(), taken);
    tick += result.ticks;

    // The loop's exact recording conventions (useGameLoop onFrame); the
    // snapshot predicate is the normative §3 boundary crossing:
    // floor(end/600) > floor(prev/600).
    if (result.ticks > 0) for (const input of taken) recorder.recordInput(firstTick, input);
    if (result.events.length > 0) recorder.recordEvents(firstTick, result.events);
    if (result.ticks > 0 && Math.floor(tick / 600) > Math.floor((firstTick - 1) / 600)) {
      recorder.recordSnapshot(tick, projectSnapshot(result.state));
    }
    if (result.state.phase === 'gameover' && !terminalStamped) {
      recorder.recordTerminal(tick, projectSnapshot(result.state));
      terminalStamped = true;
    }
  }

  expect(tick).toBeGreaterThanOrEqual(1300);
  const session = recorder.export();
  expect(session).not.toBeNull();
  // The exported trace must survive a real JSON round-trip losslessly.
  return JSON.parse(JSON.stringify(session)) as JsonSession;
};

describe('exact-replay round-trip (issue #30 AC 1)', () => {
  it('records ≥ 1300 real ticks crossing two 600-tick snapshot boundaries', () => {
    const session = recordSession();
    expect(session.format).toBe('clown-session');
    expect(session.formatVersion).toBe(1);
    expect(session.inputs.length).toBeGreaterThan(0);
    expect(session.events.length).toBeGreaterThan(0);
    expect(session.snapshots.map((s) => s.tick)).toEqual([600, 1200]);
    expect(session.markers).toEqual([]);
  });

  it('replays the exported trace to status ok with matching snapshots', () => {
    const session = recordSession();
    const result = replaySession(session);
    const lastCheckpoint = Math.max(session.snapshots[session.snapshots.length - 1].tick, session.terminal?.tick ?? 0);
    expect(result).toEqual({
      status: 'ok',
      ticksReplayed: lastCheckpoint,
      snapshotsMatched: session.snapshots.length,
    });
  });

  it('a tampered input diverges at the first comparison where it matters', () => {
    const session = recordSession();
    const tampered: JsonSession = JSON.parse(JSON.stringify(session));
    // The last input batch consumed at or before the terminal frame (or the
    // first comparison when the session never ends): this session dies long
    // before tick 600, the core freezes at game over, and only PRE-freeze
    // inputs can matter — this batch's last move-seesaw is the final value
    // the frozen state carries into every comparison.
    const batchTicks = [...new Set(tampered.inputs.map((r) => r.tick))].sort((a, b) => a - b);
    const horizon = tampered.terminal ? tampered.terminal.tick : tampered.snapshots[0].tick;
    const batch = [...batchTicks].reverse().find((t) => t <= horizon)!;
    const moves = tampered.inputs.filter((r) => r.tick === batch && r.input.type === 'move-seesaw');
    const target = moves[moves.length - 1];
    (target.input as { type: 'move-seesaw'; x: number }).x += 1;

    const result = replaySession(tampered);
    expect(result.status).toBe('diverged');
    if (result.status === 'diverged') {
      // the first checkpoint at or after the tampered batch
      const comparisons = [
        ...tampered.snapshots.map((s) => s.tick),
        ...(tampered.terminal ? [tampered.terminal.tick] : []),
      ].sort((a, b) => a - b);
      expect(result.firstDivergence.tick).toBe(comparisons.find((c) => c >= batch)!);
      expect(typeof result.firstDivergence.field).toBe('string');
    }
  });

  it('a foreign-trace sha is refused as version-mismatch unless forced', () => {
    const session = recordSession();
    const foreign: JsonSession = { ...session, header: { ...session.header, appGitSha: 'deadbeef' } };
    expect(replaySession(foreign)).toEqual({
      status: 'version-mismatch',
      traceSha: 'deadbeef',
      localSha: __APP_GIT_SHA__,
    });
    expect(replaySession(foreign, { force: true }).status).toBe('ok');
  });

  it('a checkpoint-less session replays zero ticks', () => {
    const session = recordSession();
    const empty: JsonSession = { ...session, snapshots: [], terminal: null };
    expect(replaySession(empty)).toEqual({ status: 'ok', ticksReplayed: 0, snapshotsMatched: 0 });
  });
});
