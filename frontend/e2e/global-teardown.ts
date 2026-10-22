// Playwright globalTeardown (issue #46): `down -v` the isolated compose
// stack — the -v removes the DB volume too, guaranteeing a FRESH database
// for the next run (the E2E's leaderboard assertion relies on that: the
// submitted entry cannot be outranked in an empty DB).
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

export default async function globalTeardown(): Promise<void> {
  execFileSync('docker', [...COMPOSE, 'down', '-v'], { cwd: REPO_ROOT, stdio: 'inherit' });
}
