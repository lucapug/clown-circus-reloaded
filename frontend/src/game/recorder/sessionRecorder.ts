import type { GameEvent, GameInput } from '../core';
import { appendSession } from './sessionStore';
import { SESSION_FORMAT, SESSION_FORMAT_VERSION } from './types';
import type { JsonSession, SnapshotDigest } from './types';

// In-memory session recorder (issue #30). All methods are no-throw and hold
// nothing but plain JSON-safe data; the ONLY persistent write is the
// recordTerminal ring append. In production no recorder is ever constructed
// (DEV-gated at the call sites), so this module tree-shakes out of the
// bundle. Recording targets ORGANIC play: __game.advanceTicks/inject bypass
// the loop's seams and invalidate an active trace (documented limitation,
// no fix this cycle).

export interface SessionRecorder {
  /** Begin a fresh session with the game's EFFECTIVE seed (never undefined). */
  start(seed: number): void;
  recordInput(tick: number, input: GameInput): void;
  recordEvents(tick: number, events: GameEvent[]): void;
  recordSnapshot(tick: number, digest: SnapshotDigest): void;
  marker(tick: number): void;
  /** Stamp game over once and finalize into the localStorage ring. */
  recordTerminal(tick: number, digest: SnapshotDigest): void;
  /** The current/last session, or null before start(). */
  export(): JsonSession | null;
}

/**
 * jsdom-safe RFC 4122 v4 id — the services/storage.ts:newSubmissionId
 * algorithm deliberately copied locally (services/ must not change; jsdom's
 * Crypto lacks randomUUID). Never routed through the seeded game RNG.
 */
const newSessionId = (): string => {
  const c = globalThis.crypto;
  if (typeof c.randomUUID === 'function') return c.randomUUID();
  const bytes = c.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10xx
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

export const createSessionRecorder = ({ appVersion }: { appVersion: string }): SessionRecorder => {
  let session: JsonSession | null = null;

  return {
    start(seed) {
      session = {
        format: SESSION_FORMAT,
        formatVersion: SESSION_FORMAT_VERSION,
        header: {
          sessionId: newSessionId(),
          startedAt: new Date().toISOString(),
          appGitSha: appVersion,
          seed,
        },
        inputs: [],
        events: [],
        snapshots: [],
        markers: [],
        terminal: null,
      };
    },
    recordInput(tick, input) {
      if (!session) return;
      session.inputs.push({ tick, input });
    },
    recordEvents(tick, events) {
      if (!session || events.length === 0) return;
      session.events.push({ tick, events: [...events] });
    },
    recordSnapshot(tick, digest) {
      if (!session) return;
      session.snapshots.push({ tick, digest });
    },
    marker(tick) {
      if (!session) return;
      session.markers.push({ tick, marker: true });
    },
    recordTerminal(tick, digest) {
      if (!session || session.terminal) return; // idempotent: repeat frames ignored
      session.terminal = { tick, digest };
      appendSession(session); // the single ring write; never throws
    },
    export: () => session,
  };
};
