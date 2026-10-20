import type { JsonSession } from './types';

// DEV export affordance (issue #30): blob download of a session as
// `clown-session-<id>.json`, reachable only through the __game console
// surface. Never touches the localStorage ring.

export const sessionFilename = (session: JsonSession): string =>
  `clown-session-${session.header.sessionId}.json`;

/** Trigger the browser download; returns the generated filename. */
export const downloadSession = (session: JsonSession): string => {
  const filename = sessionFilename(session);
  const blob = new Blob([JSON.stringify(session, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  return filename;
};
