// Playwright globalSetup (issue #46): boot the isolated compose API/DB stack
// (project clown-circus-e2e, loopback ports 18000/15432 — the #45 mechanics,
// never the owner's dev stack on 8000/5432) and poll /health (max 120 s).
// The webServer (Vite dev on :4300) starts AFTER globalSetup. globalTeardown
// runs `down -v`, so every run starts from an empty DB and teardown is
// guaranteed — the same pattern as ops/test-integration.sh.
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const COMPOSE = [
  'compose',
  '-p',
  'clown-circus-e2e',
  '-f',
  'docker-compose.yml',
  '-f',
  'ops/docker-compose.test.yml',
  '-f',
  'ops/docker-compose.e2e.yml',
] as const;
const APP_URL = 'http://127.0.0.1:18000';

function compose(action: string, args: readonly string[] = []): void {
  execFileSync('docker', [...COMPOSE, action, ...args], { cwd: REPO_ROOT, stdio: 'inherit' });
}

export default async function globalSetup(): Promise<void> {
  // Idempotent clean slate: a stale `clown-circus-e2e` stack (e.g. from a
  // killed run) would otherwise be reused with its old DB volume.
  try {
    compose('down', ['-v']);
  } catch {
    // nothing to tear down on a fresh machine
  }

  compose('up', ['-d']); // cold first run builds the image here (minutes)

  const deadline = Date.now() + 120_000;
  for (;;) {
    try {
      const res = await fetch(`${APP_URL}/health`);
      if (res.ok) {
        console.log(`[e2e] compose stack healthy at ${APP_URL}`);
        return;
      }
    } catch {
      // not up yet — keep polling
    }
    if (Date.now() > deadline) {
      console.error(`[e2e] FAIL: app never became healthy; last app logs:`);
      compose('logs', ['--tail', '50', 'app']);
      throw new Error(`[e2e] compose app unhealthy after 120 s at ${APP_URL}/health`);
    }
    await new Promise((r) => setTimeout(r, 1_000));
  }
}
