import { SESSIONS_CAP, SESSIONS_KEY } from './types';
import type { JsonSession } from './types';

// localStorage ring for FINALIZED sessions (issue #30). The services/
// storage.ts precedents are replicated, not imported, so services/ stays
// untouched: versioned key, JSON-safe never-throw reads, cap-20 FIFO evict.
// The single write point is recorder.recordTerminal; export/download never
// touch the ring. A full or broken localStorage must never break gameplay.

/** Read the ring; [] when absent, corrupt or unavailable (never throws). */
export const readSessions = (): JsonSession[] => {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as JsonSession[]) : [];
  } catch {
    return [];
  }
};

const isQuotaError = (error: unknown): boolean =>
  error instanceof DOMException &&
  (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED');

const writeRing = (sessions: JsonSession[]): void => {
  const capped = sessions.slice(-SESSIONS_CAP);
  try {
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(capped));
  } catch (error) {
    if (!isQuotaError(error)) return; // give up silently
    // Quota pressure: evict the oldest and retry, down to zero, then give up.
    for (let evict = 1; evict <= capped.length; evict++) {
      try {
        localStorage.setItem(SESSIONS_KEY, JSON.stringify(capped.slice(evict)));
        return;
      } catch {
        // keep dropping
      }
    }
  }
};

/** Append a finalized session (FIFO), capped at 20; never throws. */
export const appendSession = (session: JsonSession): void => {
  writeRing([...readSessions(), session]);
};
