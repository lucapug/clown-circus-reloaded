/// <reference types="vite/client" />

// Typed import.meta.env vars (issue #10): mock-mode flag and API base URL.
interface ImportMetaEnv {
  /** '1' → mock leaderboard service in dev (.env.development); unset → §7 HTTP service. */
  readonly VITE_USE_MOCK_LEADERBOARD?: string;
  /** Same-origin by default (''); set to the API origin when deployed separately. */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Issue #30: build-time global from the vite define — `git rev-parse HEAD`
// at build/dev-server start. Vitest reuses vite.config.ts, so unit tests
// see it too.
declare const __APP_GIT_SHA__: string;

// Issue #30: this repo ships without @types/node (zero-dependency guardrail),
// so the two node surfaces the recorder touches get minimal ambient types —
// the git-sha probe in vite.config.ts (via a triple-slash reference) and the
// REPLAY_TRACE file reader in replayTrace.cli.test.ts. No runtime code.
declare module 'node:child_process' {
  export function execSync(command: string): { toString(): string };
}
declare module 'node:fs' {
  export function readFileSync(path: string, encoding?: string): string;
}
declare const process: {
  env: Record<string, string | undefined>;
};
