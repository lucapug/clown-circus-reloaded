#!/usr/bin/env bash
# Integration battery in the Compose stack (issue #45).
#
# Flow (PM brief D2): clean slate -> isolated stack (compose project
# `clown-circus-it`, loopback host ports 18000/15432) -> health poll -> the
# frontend live-integration vitest file (LEADERBOARD_INTEGRATION_URL set here,
# no manual env fiddling) -> the FULL backend pytest suite against the stack's
# Postgres (IT_DATABASE_URL) -> guaranteed `down -v` teardown via EXIT trap
# (runs even on failure or Ctrl-C).
#
# Requires: docker, bash, curl, uv, node (see README "Testing").
# Idempotent: the down -v preamble lets back-to-back runs start clean.
# Wall time: ~4-6 min on first run (image build), ~2-4 min warm.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PROJECT="clown-circus-it"
COMPOSE=(compose -p "$PROJECT" -f docker-compose.yml -f ops/docker-compose.test.yml)
APP_URL="http://127.0.0.1:18000"
IT_DB_URL="postgresql://clown:clown@127.0.0.1:15432/clowncircus" # dev-only creds

teardown() {
  echo "[test-integration] teardown: docker ${COMPOSE[*]} down -v"
  docker "${COMPOSE[@]}" down -v
}
trap teardown EXIT

echo "[test-integration] 1/5 clean slate"
docker "${COMPOSE[@]}" down -v >/dev/null 2>&1 || true

echo "[test-integration] 2/5 boot stack (up -d --build)"
docker "${COMPOSE[@]}" up -d --build

echo "[test-integration] 3/5 wait for health at $APP_URL/health (max 120 s)"
healthy=0
for _ in $(seq 1 120); do
  if curl -fsS "$APP_URL/health" >/dev/null 2>&1; then healthy=1; break; fi
  sleep 1
done
if [ "$healthy" -ne 1 ]; then
  echo "[test-integration] FAIL: app never became healthy; last app logs:" >&2
  docker "${COMPOSE[@]}" logs --tail 50 app >&2
  exit 1
fi
echo "[test-integration] health OK"

echo "[test-integration] 4/5 frontend integration file (LEADERBOARD_INTEGRATION_URL=$APP_URL)"
(
  cd frontend
  LEADERBOARD_INTEGRATION_URL="$APP_URL" npx vitest run \
    src/services/__tests__/integration.leaderboard.test.ts
)

echo "[test-integration] 5/5 backend suite vs Postgres (IT_DATABASE_URL=$IT_DB_URL)"
(
  cd backend
  IT_DATABASE_URL="$IT_DB_URL" uv run pytest
)

echo "[test-integration] all green"
