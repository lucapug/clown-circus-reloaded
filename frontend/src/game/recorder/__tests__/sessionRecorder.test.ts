// @vitest-environment jsdom
// Session recorder unit tests (issue #30, test plan 1 + 5): fake tick
// sources — plain tick numbers, no game loop. Covers the envelope shape and
// versioning, the pre-start null export, idempotent terminal stamping,
// marker ordering, and the version-bound header.
import { beforeEach, describe, expect, it } from 'vitest';
import { createSessionRecorder } from '../sessionRecorder';
import { readSessions } from '../sessionStore';
import type { SnapshotDigest } from '../types';

beforeEach(() => localStorage.clear());

const digest = (over: Partial<SnapshotDigest> = {}): SnapshotDigest => ({
  phase: 'playing',
  level: 1,
  currentJumpVelocity: -14,
  stats: { score: 10, lives: 2, bonusJumps: 1 },
  seesaw: { x: 400.5, tilt: 'left' },
  clowns: [
    {
      x: 370,
      y: 496,
      vx: 0,
      vy: 0,
      isFlying: false,
      isOnSeesaw: true,
      seesawSide: 'left',
      isOnDivingBoard: false,
      divingBoardIndex: null,
    },
  ],
  balloonsPopped: 3,
  balloonBits: '111' + '0'.repeat(53),
  ...over,
});

describe('createSessionRecorder (issue #30)', () => {
  it('exports null before start()', () => {
    const recorder = createSessionRecorder({ appVersion: 'test-sha' });
    expect(recorder.export()).toBeNull();
  });

  it('record* calls before start() are ignored and never throw', () => {
    const recorder = createSessionRecorder({ appVersion: 'test-sha' });
    recorder.recordInput(1, { type: 'launch' });
    recorder.recordEvents(1, [{ type: 'game-over' }]);
    recorder.recordSnapshot(1, digest());
    recorder.marker(1);
    recorder.recordTerminal(1, digest());
    expect(recorder.export()).toBeNull();
    expect(readSessions()).toEqual([]); // never wrote the ring either
  });

  it('stamps the normative envelope: format, formatVersion, header, empty arrays', () => {
    const recorder = createSessionRecorder({ appVersion: 'test-sha' });
    recorder.start(42);
    const session = recorder.export();
    expect(session).not.toBeNull();
    expect(session!.format).toBe('clown-session');
    expect(session!.formatVersion).toBe(1);
    expect(session!.header.seed).toBe(42);
    expect(session!.header.appGitSha).toBe('test-sha');
    expect(session!.inputs).toEqual([]);
    expect(session!.events).toEqual([]);
    expect(session!.snapshots).toEqual([]);
    expect(session!.markers).toEqual([]);
    expect(session!.terminal).toBeNull();
  });

  it('the header is version-bound: appGitSha, ISO startedAt, v4 sessionId, recorded seed', () => {
    const first = createSessionRecorder({ appVersion: 'test-sha' });
    first.start(7);
    const session = first.export()!;
    expect(session.header.appGitSha).toBe('test-sha');
    expect(Number.isFinite(new Date(session.header.startedAt).getTime())).toBe(true);
    expect(session.header.sessionId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);

    const second = createSessionRecorder({ appVersion: 'test-sha' });
    second.start(7);
    expect(second.export()!.header.sessionId).not.toBe(session.header.sessionId);
    expect(second.export()!.header.seed).toBe(7);
  });

  it('records inputs, events and snapshots in arrival order with their ticks', () => {
    const recorder = createSessionRecorder({ appVersion: 'test-sha' });
    recorder.start(42);
    recorder.recordInput(1, { type: 'launch' });
    recorder.recordInput(1, { type: 'move-seesaw', x: 400 });
    recorder.recordInput(61, { type: 'launch' });
    recorder.recordEvents(1, [{ type: 'launched', clownIndex: 0, via: 'input', vx: 3, vy: 2 }]);
    recorder.recordSnapshot(600, digest({ level: 2 }));
    const session = recorder.export()!;
    expect(session.inputs).toEqual([
      { tick: 1, input: { type: 'launch' } },
      { tick: 1, input: { type: 'move-seesaw', x: 400 } },
      { tick: 61, input: { type: 'launch' } },
    ]);
    expect(session.events).toEqual([
      { tick: 1, events: [{ type: 'launched', clownIndex: 0, via: 'input', vx: 3, vy: 2 }] },
    ]);
    expect(session.snapshots).toEqual([{ tick: 600, digest: digest({ level: 2 }) }]);
  });

  it('keeps M-key markers in press order', () => {
    const recorder = createSessionRecorder({ appVersion: 'test-sha' });
    recorder.start(42);
    recorder.marker(300);
    recorder.marker(950);
    expect(recorder.export()!.markers).toEqual([
      { tick: 300, marker: true },
      { tick: 950, marker: true },
    ]);
  });

  it('recordTerminal is idempotent and writes the ring exactly once', () => {
    const recorder = createSessionRecorder({ appVersion: 'test-sha' });
    recorder.start(42);
    recorder.recordTerminal(1300, digest({ phase: 'gameover' }));
    expect(recorder.export()!.terminal).toEqual({ tick: 1300, digest: digest({ phase: 'gameover' }) });
    recorder.recordTerminal(1400, digest({ phase: 'gameover', level: 9 }));
    expect(recorder.export()!.terminal).toEqual({ tick: 1300, digest: digest({ phase: 'gameover' }) });
    expect(readSessions()).toHaveLength(1); // the single ring write point
    expect(readSessions()[0].header.seed).toBe(42);
  });

  it('a fresh start() replaces the in-memory session without touching the ring', () => {
    const recorder = createSessionRecorder({ appVersion: 'test-sha' });
    recorder.start(1);
    recorder.marker(5);
    recorder.start(2);
    const session = recorder.export()!;
    expect(session.header.seed).toBe(2);
    expect(session.markers).toEqual([]);
    expect(readSessions()).toEqual([]); // unfinished sessions never enter the ring
  });
});
