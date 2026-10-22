import { defineConfig } from '@playwright/test';

// Issue #46: the E2E runs against a Vite DEV server on :4300 (never :5173,
// never `vite preview`) because the `window.__game` hooks are DEV-gated AT
// THE CALL SITE (useGameLoop) — a production build eliminates them. The
// backend is the REAL leaderboard API (#41) from the isolated compose test
// stack (#45 mechanics: project clown-circus-e2e, loopback ports 18000/15432,
// CORS for :4300 via ops/docker-compose.e2e.yml) — booted by globalSetup,
// torn down with `down -v` by globalTeardown (fresh DB every run).
export default defineConfig({
  testDir: './e2e',
  retries: 1, // flake budget: one retry, one scenario (plan risk row)
  workers: 1,
  fullyParallel: false,
  use: {
    baseURL: 'http://127.0.0.1:4300',
  },
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  webServer: {
    // --host 127.0.0.1: vite's default 'localhost' binding resolves to ::1
    // on some macOS setups, which the 127.0.0.1 url/baseURL below can never
    // reach (a real 60 s webServer timeout, observed). Pin the interface.
    command: 'npm run dev -- --port 4300 --strictPort --host 127.0.0.1',
    url: 'http://127.0.0.1:4300',
    reuseExistingServer: !process.env.CI,
    env: {
      VITE_USE_MOCK_LEADERBOARD: '0', // real backend, not the #41 dev mock
      VITE_API_BASE_URL: 'http://127.0.0.1:18000',
    },
  },
});
