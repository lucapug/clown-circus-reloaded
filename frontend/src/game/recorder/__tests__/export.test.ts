// @vitest-environment jsdom
// Download contract tests (issue #33): the anchor must be clicked exactly
// once while CONNECTED with the right `download` attribute, and the blob URL
// must outlive the click — the browser reads the blob asynchronously after
// click(), so revoking synchronously races that read and intermittently
// interrupts the download. Revocation is deferred by a 10 s grace instead.
// jsdom has no blob URL API, so both URL hooks are stubbed on `URL` itself.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { downloadSession, sessionFilename } from '../export';
import type { JsonSession } from '../types';

const session = (): JsonSession => ({
  format: 'clown-session',
  formatVersion: 1,
  header: { sessionId: 'dl-1', startedAt: '2026-10-20T00:00:00.000Z', appGitSha: 'sha', seed: 7 },
  inputs: [],
  events: [],
  snapshots: [],
  markers: [],
  terminal: null,
});

describe('downloadSession (issue #33 download contract)', () => {
  const createObjectURL = vi.fn<(blob: Blob) => string>(() => 'blob:mock-url');
  const revokeObjectURL = vi.fn<(url: string) => void>(() => {});
  const realCreateObjectURL = URL.createObjectURL;
  const realRevokeObjectURL = URL.revokeObjectURL;
  const clicked: { download: string; href: string; connected: boolean }[] = [];

  beforeEach(() => {
    vi.useFakeTimers();
    URL.createObjectURL = createObjectURL as unknown as typeof URL.createObjectURL;
    URL.revokeObjectURL = revokeObjectURL as unknown as typeof URL.revokeObjectURL;
    createObjectURL.mockClear();
    revokeObjectURL.mockClear();
    clicked.length = 0;
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push({ download: this.download, href: this.href, connected: this.isConnected });
    });
  });

  afterEach(() => {
    URL.createObjectURL = realCreateObjectURL;
    URL.revokeObjectURL = realRevokeObjectURL;
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('clicks a CONNECTED anchor once with the correct download attribute', () => {
    const filename = downloadSession(session());
    expect(filename).toBe(sessionFilename(session()));
    expect(filename).toBe('clown-session-dl-1.json');
    expect(clicked).toEqual([{ download: 'clown-session-dl-1.json', href: 'blob:mock-url', connected: true }]);
  });

  it('does NOT revoke the blob URL synchronously (the interrupting race)', () => {
    downloadSession(session());
    expect(revokeObjectURL).not.toHaveBeenCalled();
  });

  it('revokes the blob URL with the stub URL after the 10 s grace', () => {
    downloadSession(session());
    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(10_000);
    expect(revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });
});
