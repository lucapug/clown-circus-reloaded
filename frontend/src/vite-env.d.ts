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
