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
