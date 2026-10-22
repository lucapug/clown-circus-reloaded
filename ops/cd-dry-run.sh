#!/usr/bin/env bash
# cd-dry-run.sh — mock rehearsal of the cd-dev.yml deploy path (issue #47, QA DoD B).
#
# Exercises the SAME shell logic as .github/workflows/cd-dev.yml against an
# inline mock server (python3 stdlib http.server) emulating the Render API
# (PATCH service / POST deploy / GET deploy -> live) and the dev /health
# endpoint. No network, no credentials: the "API key" is the literal dummy
# `dry-run` and is never validated.
#
# Checks (issue #47 DoD B):
#   (i)   the constructed immutable tag matches ^20[0-9]{6}-[0-9]{6}-[0-9a-f]{7}$
#         (UTC clock — `date -u` is used verbatim, same line as the workflow);
#   (ii)  the PATCH body received by the (mock) service contains the exact
#         `deployment.environment.name=dev,service.version=<shortsha>` string,
#         with the SAME shortsha as the immutable-tag suffix;
#   (iii) the deploy poll loop terminates on `live`, and the health assert
#         passes on the exact body {"status":"ok"} and FAILS on the mutated
#         bodies (trailing space, HTTP 503) — the mutation check proving the
#         assert is exact-byte.
#
# Retries/timings default to the workflow's values but are tunable so the
# rehearsal runs in seconds: POLL_ATTEMPTS/POLL_INTERVAL/HEALTH_ATTEMPTS/
# HEALTH_INTERVAL (the workflow pins 30x20s for both loops).
#
# Usage: bash ops/cd-dry-run.sh
# Exit 0 only if every check passes.

set -euo pipefail

STATE="$(mktemp -d /tmp/cd-dry-run.XXXXXX)"
MOCK_PID=""

cleanup() {
  if [[ -n "$MOCK_PID" ]]; then
    kill "$MOCK_PID" 2>/dev/null || true
    wait "$MOCK_PID" 2>/dev/null || true   # absorb the job-control notice
  fi
  rm -rf "$STATE"
}
trap cleanup EXIT

# Defaults matching the workflow; the script tightens them below for speed.
POLL_ATTEMPTS="${POLL_ATTEMPTS:-30}"
POLL_INTERVAL="${POLL_INTERVAL:-20}"
HEALTH_ATTEMPTS="${HEALTH_ATTEMPTS:-30}"
HEALTH_INTERVAL="${HEALTH_INTERVAL:-20}"

IMAGE_NAME="ghcr.io/lucapug/clown-circus-reloaded"
RENDER_API_KEY="dry-run"   # dummy, proves header plumbing only
RENDER_DEV_SERVICE_ID="srv-mock"

FAILED=0
pass() { echo "PASS: $*"; }
fail() { echo "FAIL: $*"; FAILED=1; }

# ---------------------------------------------------------------------------
# Mock server: stdlib-only, records received bodies, scenario via files.
# ---------------------------------------------------------------------------
cat > "$STATE/render-mock.py" <<'PY'
import http.server
import json
import socketserver
import sys
from pathlib import Path

state_dir = Path(sys.argv[1])
deploy_gets = {"n": 0}


class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def _body(self):
        n = int(self.headers.get("Content-Length") or 0)
        return self.rfile.read(n).decode() if n else ""

    def _send(self, code, body):
        data = body.encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _mode(self, name):
        f = state_dir / name
        return f.read_text().strip() if f.exists() else ""

    def do_PATCH(self):
        (state_dir / "patch_body.json").write_text(self._body())
        self._send(200, json.dumps({"id": self._mode("service_id") or "srv-mock"}))

    def do_POST(self):
        (state_dir / "post_body.json").write_text(self._body())
        self._send(200, json.dumps({"id": "dep-mock-1"}))

    def do_GET(self):
        if self.path == "/health":
            mode = self._mode("health_mode") or "ok"
            if mode == "503":
                self._send(503, '{"detail":"service unavailable"}')
            elif mode == "trailing":
                self._send(200, '{"status":"ok"} ')  # trailing space: mutant
            else:
                self._send(200, '{"status":"ok"}')
            return
        if "/deploys/dep-mock-1" in self.path:
            deploy_gets["n"] += 1
            status = "build_in_progress" if deploy_gets["n"] == 1 else "live"
            self._send(200, json.dumps({"id": "dep-mock-1", "status": status}))
            return
        self._send(404, "not found")


socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("127.0.0.1", 0), Handler) as httpd:
    (state_dir / "port").write_text(str(httpd.server_address[1]))
    httpd.serve_forever()
PY

python3 "$STATE/render-mock.py" "$STATE" &
MOCK_PID=$!

# Bounded readiness wait (max ~10 s), per anti-hang rules.
READY=0
for _ in $(seq 1 100); do
  if [[ -f "$STATE/port" ]] && kill -0 "$MOCK_PID" 2>/dev/null; then READY=1; break; fi
  sleep 0.1
done
if [[ "$READY" != 1 ]]; then echo "FAIL: mock server did not start"; exit 1; fi
PORT="$(cat "$STATE/port")"
RENDER_API_BASE="http://127.0.0.1:$PORT/v1"
DEV_HEALTH_URL="http://127.0.0.1:$PORT/health"

echo "== cd-dry-run: mock Render at 127.0.0.1:$PORT =="
echo ""

# ---------------------------------------------------------------------------
# meta-equivalent: tag construction (identical lines to the workflow)
# ---------------------------------------------------------------------------
construct_tags() {
  GITHUB_SHA="${GITHUB_SHA:-0123456789abcdef0123456789abcdef01234567}"
  SHORTSHA="${GITHUB_SHA::7}"
  IMMUTABLE="$(date -u +%Y%m%d-%H%M%S)-${SHORTSHA}"   # e.g. 20261022-141503-1a2b3c4
}

# ---------------------------------------------------------------------------
# deploy-dev-equivalent steps (same logic as the workflow)
# ---------------------------------------------------------------------------
patch_service() {
  OTEL="deployment.environment.name=dev,service.version=${SHORTSHA}"
  BODY=$(jq -n --arg img "${IMAGE_NAME}:${IMMUTABLE}" --arg otel "$OTEL" \
    '{image:{imagePath:$img},envVars:[{key:"OTEL_RESOURCE_ATTRIBUTES",value:$otel}]}')
  curl -fsS -X PATCH \
    -H "Authorization: Bearer $RENDER_API_KEY" \
    -H "Content-Type: application/json" \
    -d "$BODY" \
    "${RENDER_API_BASE}/services/$RENDER_DEV_SERVICE_ID" > /dev/null
}

post_deploy() {
  RESP=$(curl -fsS -X POST \
    -H "Authorization: Bearer $RENDER_API_KEY" \
    -H "Content-Type: application/json" \
    -d "$(jq -n --arg img "${IMAGE_NAME}:${IMMUTABLE}" '{imageUrl:$img}')" \
    "${RENDER_API_BASE}/services/$RENDER_DEV_SERVICE_ID/deploys")
  DEPLOY_ID=$(echo "$RESP" | jq -r '.id')
}

poll_deploy() {
  for i in $(seq 1 "$POLL_ATTEMPTS"); do
    STATUS=$(curl -fsS -H "Authorization: Bearer $RENDER_API_KEY" \
      "${RENDER_API_BASE}/services/$RENDER_DEV_SERVICE_ID/deploys/$DEPLOY_ID" \
      | jq -r '.status' 2>/dev/null || true)
    echo "  poll $i/$POLL_ATTEMPTS: ${STATUS:-<no response>}"
    case "$STATUS" in
      live) echo "  deploy is live"; return 0 ;;
      build_failed|update_failed|canceled|deactivated)
        echo "  deploy ended with status: $STATUS"; return 1 ;;
    esac
    sleep "$POLL_INTERVAL"
  done
  echo "  deploy poll timed out"; return 1
}

health_assert() {
  for i in $(seq 1 "$HEALTH_ATTEMPTS"); do
    body=$(curl -fsS --max-time 10 "$DEV_HEALTH_URL" || true)
    if [[ "$body" == '{"status":"ok"}' ]]; then echo "  health ok (attempt $i)"; return 0; fi
    sleep "$HEALTH_INTERVAL"
  done
  echo "  health validation failed"; return 1
}

# ---------------------------------------------------------------------------
# Run the rehearsal
# ---------------------------------------------------------------------------
echo "-- scenario A: happy path (deploy to live, health ok)"
POLL_ATTEMPTS=10 POLL_INTERVAL=1

construct_tags
echo "immutable tag: $IMMUTABLE"
echo "shortsha:      $SHORTSHA"
if [[ "$IMMUTABLE" =~ ^20[0-9]{6}-[0-9]{6}-[0-9a-f]{7}$ ]]; then
  pass "immutable tag matches ^20[0-9]{6}-[0-9]{6}-[0-9a-f]{7}\$ (date -u UTC clock)"
else
  fail "immutable tag malformed: $IMMUTABLE"
fi

patch_service
echo "PATCH body: $(cat "$STATE/patch_body.json")"
if grep -qF "deployment.environment.name=dev,service.version=$SHORTSHA" "$STATE/patch_body.json"; then
  pass "PATCH body carries exact OTEL string with the tag's own shortsha ($SHORTSHA)"
else
  fail "PATCH body missing exact 'deployment.environment.name=dev,service.version=$SHORTSHA'"
fi
if grep -qF "${IMAGE_NAME}:${IMMUTABLE}" "$STATE/patch_body.json"; then
  pass "PATCH body deploys the exact immutable image"
else
  fail "PATCH body does not reference $IMAGE_NAME:$IMMUTABLE"
fi

post_deploy
if [[ -n "${DEPLOY_ID:-}" ]]; then
  pass "POST deploy returned id: $DEPLOY_ID"
else
  fail "POST deploy returned no id"
fi

if poll_deploy; then
  pass "deploy poll terminated on 'live' (first GET returns build_in_progress)"
else
  fail "deploy poll did not reach 'live'"
fi

echo "health_mode=ok"
if health_assert; then
  pass "health assert passed on exact body {\"status\":\"ok\"}"
else
  fail "health assert failed on the exact-ok body"
fi

echo ""
echo "-- scenario B: mutation — trailing space body"
echo "health_mode=trailing"
printf 'trailing' > "$STATE/health_mode"
if ( HEALTH_ATTEMPTS=2; HEALTH_INTERVAL=1; health_assert ); then
  fail "health assert PASSED on '{\"status\":\"ok\"} ' (trailing space) — assert is not exact"
else
  pass "health assert correctly FAILED on trailing-space body"
fi

echo ""
echo "-- scenario C: mutation — HTTP 503"
echo "health_mode=503"
printf '503' > "$STATE/health_mode"
if ( HEALTH_ATTEMPTS=2; HEALTH_INTERVAL=1; health_assert ); then
  fail "health assert PASSED on HTTP 503 — assert is not exact"
else
  pass "health assert correctly FAILED on HTTP 503"
fi

echo ""
if [[ "$FAILED" == 0 ]]; then
  echo "== cd-dry-run: ALL CHECKS PASSED =="
  exit 0
else
  echo "== cd-dry-run: FAILURES PRESENT =="
  exit 1
fi
