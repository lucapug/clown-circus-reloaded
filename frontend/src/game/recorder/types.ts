import type { GameEvent, GameInput, GamePhase, SeesawTilt } from '../core';

// The normative #30 session envelope and its supporting types. Pure data —
// every value here must survive a JSON round-trip losslessly (exact replay
// compares projected digests with ===/deep equality, no float tolerance:
// both sides run the same IEEE-754 ops and JSON doubles round-trip exactly).

export const SESSION_FORMAT = 'clown-session';
export const SESSION_FORMAT_VERSION = 1;

// Issue-mandated ring key and cap (services/storage.ts precedents, replicated
// locally — services/ must not change).
export const SESSIONS_KEY = 'clown-circus:sessions:v1';
export const SESSIONS_CAP = 20;

/**
 * The compact per-600-ticks state fingerprint — the ONE projection, used by
 * the recorder, replay and tests alike (projectSnapshot in snapshot.ts).
 */
export interface SnapshotDigest {
  phase: GamePhase;
  level: number;
  currentJumpVelocity: number;
  stats: { score: number; lives: number; bonusJumps: number };
  seesaw: { x: number; tilt: SeesawTilt };
  /** In balloons/clowns array order — the projection preserves it exactly. */
  clowns: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    isFlying: boolean;
    isOnSeesaw: boolean;
    seesawSide: 'left' | 'right';
    isOnDivingBoard: boolean;
    divingBoardIndex: 0 | 1 | 2 | 3 | null;
  }[];
  balloonsPopped: number;
  /** '1' popped / '0' intact, in balloons array order (56 chars at 4×14). */
  balloonBits: string;
}

/** Version-bound trace header: replay validates appGitSha before stepping. */
export interface SessionHeader {
  sessionId: string;
  startedAt: string;
  appGitSha: string;
  seed: number;
}

/** The tick whose step-0 boundary CONSUMED the input (replay-critical). */
export interface RecordedInput {
  tick: number;
  input: GameInput;
}

/** The frame's FIRST executed tick; a multi-tick frame attributes all its events there. */
export interface RecordedEvents {
  tick: number;
  events: GameEvent[];
}

export interface RecordedSnapshot {
  tick: number;
  digest: SnapshotDigest;
}

/** M-key marker pressed by the owner to flag a suspicious moment. */
export interface RecordedMarker {
  tick: number;
  marker: true;
}

export interface TerminalSnapshot {
  tick: number;
  digest: SnapshotDigest;
}

/** The JSON-safe per-game trace (normative §3 envelope). */
export interface JsonSession {
  format: typeof SESSION_FORMAT;
  formatVersion: typeof SESSION_FORMAT_VERSION;
  header: SessionHeader;
  inputs: RecordedInput[];
  events: RecordedEvents[];
  snapshots: RecordedSnapshot[];
  markers: RecordedMarker[];
  terminal: TerminalSnapshot | null;
}

export type ReplayResult =
  | { status: 'ok'; ticksReplayed: number; snapshotsMatched: number }
  | { status: 'version-mismatch'; traceSha: string; localSha: string }
  | { status: 'diverged'; firstDivergence: { tick: number; field: string; expected: unknown; actual: unknown } };
