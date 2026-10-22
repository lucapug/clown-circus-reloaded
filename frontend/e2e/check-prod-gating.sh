#!/usr/bin/env bash
# Production-gating re-pin (issue #46 AC). The E2E debug surface must NOT
# exist in the built bundle: the hooks are DEV-gated AT THE CALL SITE
# (useGameLoop, import.meta.env.DEV), so `vite build` statically eliminates
# the debugHooks module — a clean production build greps ZERO occurrences of
# the hook identifiers in frontend/dist/assets. This is compile-time
# elimination proof (the #9 grep idea), stronger than a runtime flag test.
#
# Wired as the frontend script:  npm run test:prod-gating
# (= `npm run build && bash e2e/check-prod-gating.sh`).
set -euo pipefail

FRONTEND="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ASSETS="$FRONTEND/dist/assets"

if [ ! -d "$ASSETS" ]; then
  echo "[prod-gating] FAIL: $ASSETS missing — run \`npm run build\` first" >&2
  exit 1
fi

if grep -REq "__game|advanceTicks" "$ASSETS"; then
  echo "[prod-gating] FAIL: hook identifiers found in the production bundle:" >&2
  grep -REo "__game|advanceTicks" "$ASSETS" | head -20 >&2
  exit 1
fi

echo "[prod-gating] OK: no __game/advanceTicks identifiers in dist/assets"
