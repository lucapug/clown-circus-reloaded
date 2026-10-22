#!/usr/bin/env bash
# cd-dry-run.sh — mock rehearsal of the cd-dev.yml deploy path (issues #47/#52).
#
# Exercises the SAME shell logic as .github/workflows/cd-dev.yml against an
# inline mock server (python3 stdlib http.server) emulating the Render API
# (GET /owners, PATCH service, GET/PUT env-vars, POST deploy, GET deploy ->
# live) and the dev /health endpoint. No network, no credentials: the "API
# key" is the literal dummy `dry-run` and is never validated.
#
# Checks (issue #47 DoD B; #50; #52):
#   (i)    the constructed immutable tag matches
#          ^20[0-9]{6}-[0-9]{6}-[0-9a-f]{7}$ (UTC clock — `date -u` is used
#          verbatim, same line as the workflow);
#   (ii)   the env-vars PUT body carries the exact
#          `deployment.environment.name=dev,service.version=<shortsha>`
#          string, with the SAME shortsha as the immutable-tag suffix
#          (issue #52: service.version moved from the PATCH to the
#          env-vars endpoint);
#   (iii)  the deploy poll loop terminates on `live`, and the health assert
#          passes on the exact body {"status":"ok"} and FAILS on the mutated
#          bodies (trailing space, HTTP 503) — the mutation checks proving
#          the assert is exact-byte;
#   (iv)   the push-ghcr "Build tag list" construct (issue #50 fix) writes
#          the EOF-delimited multiline form into a mock GITHUB_OUTPUT file,
#          and the runner-equivalent parse yields the immutable tag plus the
#          moving `main` tag exactly when mainonly=yes;
#   (#52a) the service PATCH body has EXACTLY image.ownerId + image.imagePath
#          (right values) and NO other top-level or image sub-fields —
#          `envVars` is not a servicePATCH field;
#   (#52b) the env-vars PUT preserves every unrelated key byte-for-byte
#          (DATABASE_URL above all) and updates ONLY OTEL_RESOURCE_ATTRIBUTES;
#          with OTEL absent from the source list it is ADDED (scenario B);
#   (#52c) a mocked HTTP 400 makes the api helper exit non-zero WITH the
#          response body printed (scenario C) — no `-f`-and-swallow.
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
RUNNER_TEMP="$STATE"       # workflow steps write their scratch here

FAILED=0
pass() { echo "PASS: $*"; }
fail() { echo "FAIL: $*"; FAILED=1; }

# ---------------------------------------------------------------------------
# Mock server: stdlib-only, records received bodies, scenario via files.
# Mode files: patch_mode=400 (PATCH returns 400), env_mode=no_otel (source
# list has no OTEL_RESOURCE_ATTRIBUTES — the add-if-absent branch).
# ---------------------------------------------------------------------------
cat > "$STATE/render-mock.py" <<'PY'
import http.server
import json
import socketserver
import sys
from pathlib import Path
from urllib.parse import urlparse, parse_qs

state_dir = Path(sys.argv[1])
deploy_gets = {"n": 0}

OWNER = {"id": "usr-dry-run-owner", "name": "dry-run", "email": "owner@example.invalid"}

# Single source of truth for the sample env list; the bash checks below read
# this same file, so preservation is asserted against the exact served bytes.
SOURCE = json.loads((state_dir / "env-vars-source.json").read_text())


def wrap(items):
    """Render list shape: [{"cursor": ..., "envVar": {key, value}}, ...]."""
    return [{"cursor": f"cur-{i}", "envVar": kv.copy()} for i, kv in enumerate(items)]


def paginate(items, size=2):
    pages = [items[i:i + size] for i in range(0, len(items), size)]
    wrapped = [wrap(p) for p in pages]
    if wrapped:
        wrapped[-1][-1]["cursor"] = None  # ONLY the final page's last cursor is null
    return wrapped


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
        if self._mode("patch_mode") == "400":
            self._send(400, json.dumps({
                "message": "PATCH must fail with this body visible",
                "dry_run": True}))
            return
        (state_dir / "patch_body.json").write_text(self._body())
        self._send(200, json.dumps({"id": self._mode("service_id") or "srv-mock"}))

    def do_PUT(self):
        body = self._body()   # read ONCE — a second read would block on the socket
        (state_dir / "put_body.json").write_text(body)
        self._send(200, body)

    def do_POST(self):
        (state_dir / "post_body.json").write_text(self._body())
        self._send(200, json.dumps({"id": "dep-mock-1"}))

    def do_GET(self):
        u = urlparse(self.path)
        path = u.path[3:] if u.path.startswith("/v1") else u.path  # base carries /v1
        if path == "/health":
            mode = self._mode("health_mode") or "ok"
            if mode == "503":
                self._send(503, '{"detail":"service unavailable"}')
            elif mode == "trailing":
                self._send(200, '{"status":"ok"} ')  # trailing space: mutant
            else:
                self._send(200, '{"status":"ok"}')
            return
        if path == "/owners":
            self._send(200, json.dumps([OWNER]))
            return
        if path.endswith("/env-vars"):
            cursor = (parse_qs(u.query).get("cursor") or [""])[0]
            items = list(SOURCE)
            if self._mode("env_mode") == "no_otel":
                items = [kv for kv in items if kv["key"] != "OTEL_RESOURCE_ATTRIBUTES"]
            pages = paginate(items)
            page_map = {"": pages[0]} if pages else {}
            for i in range(len(pages) - 1):
                page_map[pages[i][-1]["cursor"]] = pages[i + 1]
            self._send(200, json.dumps(page_map.get(cursor, [])))
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

# Sample service env list (single source for mock AND assertions). Contains
# the byte-for-byte-critical DATABASE_URL plus unrelated keys. Fake values.
cat > "$STATE/env-vars-source.json" <<'JSON'
[
  {"key": "DATABASE_URL", "value": "postgres://db.example/clown?sslmode=require"},
  {"key": "OTEL_EXPORTER_OTLP_HEADERS", "value": "authorization=dry-run-not-a-secret"},
  {"key": "OTEL_RESOURCE_ATTRIBUTES", "value": "deployment.environment.name=dev,service.version=0000000-stale"},
  {"key": "RENDER_SERVICE_ID", "value": "srv-mock"}
]
JSON

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
  # Workflow env: DEPLOY_SHA = workflow_run.head_sha || github.sha — the
  # CI-green commit, NOT GITHUB_SHA. Locally any 40-hex placeholder works.
  DEPLOY_SHA="${DEPLOY_SHA:-0123456789abcdef0123456789abcdef01234567}"
  SHORTSHA="${DEPLOY_SHA::7}"
  IMMUTABLE="$(date -u +%Y%m%d-%H%M%S)-${SHORTSHA}"   # e.g. 20261022-141503-1a2b3c4
}

# ---------------------------------------------------------------------------
# push-ghcr-equivalent: Build tag list (identical block to the workflow,
# issue #50) — GITHUB_OUTPUT replaced by a mock file. Actions requires
# key=value (or heredoc) lines in GITHUB_OUTPUT: bare lines abort the step
# with `Invalid format`, hence the `tags<<EOF ... EOF` multiline form.
# ---------------------------------------------------------------------------
GITHUB_OUTPUT_MOCK="$STATE/github_output"
build_tag_list() {
  : > "$GITHUB_OUTPUT_MOCK"
  {
    echo "tags<<EOF"
    echo "${IMAGE_NAME}:${IMMUTABLE}"
    if [[ "${MAINONLY:-no}" == "yes" ]]; then
      echo "${IMAGE_NAME}:main"
    fi
    echo "EOF"
  } >> "$GITHUB_OUTPUT_MOCK"
}

# Runner-equivalent parse of the mock GITHUB_OUTPUT: everything between the
# `tags<<EOF` and `EOF` lines is ONE output named `tags` — this is exactly
# what `steps.tags.outputs.tags` (docker/build-push-action's `tags` input)
# receives.
parse_tags_output() {
  TAGS_OUTPUT="$(awk '/^tags<<EOF$/{f=1;next} /^EOF$/{f=0} f' "$GITHUB_OUTPUT_MOCK")"
}

# ---------------------------------------------------------------------------
# deploy-dev-equivalent steps (same logic as the workflow, issue #52):
# every call via the api() helper — status captured with
# `-w '\nHTTP_STATUS:%{http_code}'`, non-2xx fails LOUDLY with the body
# printed (never `curl -f` with swallowed output).
# ---------------------------------------------------------------------------
api() {
  local method="$1" path="$2" body="${3:-}"
  local args=(-sS -w '\nHTTP_STATUS:%{http_code}' -X "$method" -H "Authorization: Bearer $RENDER_API_KEY" -H "Content-Type: application/json")
  if [[ -n "$body" ]]; then args+=(-d "$body"); fi
  local resp status payload
  if ! resp="$(curl "${args[@]}" "${RENDER_API_BASE}${path}")"; then
    echo "::error::curl transport failure on $method $path" >&2; exit 1
  fi
  status="${resp##*$'\n'}"; status="${status#HTTP_STATUS:}"
  payload="${resp%$'\n'*}"
  echo "render $method $path -> HTTP $status" >&2
  if [[ ! "$status" =~ ^2[0-9][0-9]$ ]]; then
    echo "::error::Render API $method $path failed (HTTP $status) — response body follows:" >&2
    printf '%s\n' "$payload" >&2
    exit 1
  fi
  printf '%s\n' "$payload"
}

fetch_owner_id() {
  OWNERS_JSON="$(api GET /owners)"
  local n
  n="$(echo "$OWNERS_JSON" | jq 'length')"
  if [[ "$n" -ne 1 ]]; then
    echo "::error::expected exactly 1 owner (one-workspace account), got $n:" >&2
    echo "$OWNERS_JSON" | jq -r '.[] | "  \(.id) — \(.name // .email // "?")"' >&2
    exit 1
  fi
  OWNER_ID="$(echo "$OWNERS_JSON" | jq -r '.[0].id')"
}

patch_service() {
  BODY="$(jq -n --arg owner "$OWNER_ID" \
    --arg img "${IMAGE_NAME}:${IMMUTABLE}" \
    '{image: {ownerId: $owner, imagePath: $img}}')"
  api PATCH "/services/$RENDER_DEV_SERVICE_ID" "$BODY" > /dev/null
}

update_env_vars() {
  local cursor="" page ep current
  : > "$RUNNER_TEMP/env-vars.jsonl"
  while :; do
    ep="/services/$RENDER_DEV_SERVICE_ID/env-vars?limit=100"
    if [[ -n "$cursor" ]]; then
      ep="${ep}&cursor=$(jq -rn --arg c "$cursor" '$c|@uri')"
    fi
    page="$(api GET "$ep")"
    echo "$page" | jq -c '.[].envVar' >> "$RUNNER_TEMP/env-vars.jsonl"
    cursor="$(echo "$page" | jq -r '.[-1].cursor // empty')"
    if [[ -z "$cursor" ]]; then break; fi
  done
  current="$(jq -s '.' "$RUNNER_TEMP/env-vars.jsonl")"   # one flat [{key,value}, ...]
  echo "  fetched env var keys: $(echo "$current" | jq -r 'map(.key) | join(", ")')"
  NEW_OTEL="deployment.environment.name=dev,service.version=${SHORTSHA}"
  UPDATED="$(echo "$current" | jq --arg k OTEL_RESOURCE_ATTRIBUTES --arg v "$NEW_OTEL" '
    if any(.[]; .key == $k)
    then map(if .key == $k then .value = $v else . end)
    else . + [{"key": $k, "value": $v}] end')"
  if ! echo "$UPDATED" | jq -e --arg v "$NEW_OTEL" '
    (any(.[]; .key == "DATABASE_URL")) and
    (any(.[]; .key == "OTEL_RESOURCE_ATTRIBUTES" and .value == $v))' > /dev/null; then
    echo "::error::env-vars PUT body failed post-conditions (DATABASE_URL present + new OTEL value)" >&2
    echo "keys in PUT body: $(echo "$UPDATED" | jq -r 'map(.key) | join(", ")')" >&2
    exit 1
  fi
  api PUT "/services/$RENDER_DEV_SERVICE_ID/env-vars" "$UPDATED" > /dev/null
  echo "  env-vars updated: OTEL_RESOURCE_ATTRIBUTES=$NEW_OTEL (all other keys preserved)"
}

post_deploy() {
  BODY="$(jq -n --arg img "${IMAGE_NAME}:${IMMUTABLE}" '{imageUrl:$img}')"
  RESP="$(api POST "/services/$RENDER_DEV_SERVICE_ID/deploys" "$BODY")"
  DEPLOY_ID="$(echo "$RESP" | jq -r '.id')"
}

poll_deploy() {
  local i status resp
  for i in $(seq 1 "$POLL_ATTEMPTS"); do
    resp="$(api GET "/services/$RENDER_DEV_SERVICE_ID/deploys/$DEPLOY_ID")"
    status="$(echo "$resp" | jq -r '.status')"
    echo "  poll $i/$POLL_ATTEMPTS: ${status:-<no status>}"
    case "$status" in
      live) echo "  deploy is live"; return 0 ;;
      build_failed|update_failed|canceled|deactivated)
        echo "  deploy ended with status: $status"; return 1 ;;
    esac
    sleep "$POLL_INTERVAL"
  done
  echo "  deploy poll timed out"; return 1
}

health_assert() {
  local i resp status body last=""
  for i in $(seq 1 "$HEALTH_ATTEMPTS"); do
    resp="$(curl -sS -w '\nHTTP_STATUS:%{http_code}' --max-time 10 "$DEV_HEALTH_URL" 2>/dev/null || true)"
    status="${resp##*$'\n'}"; status="${status#HTTP_STATUS:}"
    body="${resp%$'\n'*}"
    if [[ "$status" == "200" && "$body" == '{"status":"ok"}' ]]; then
      echo "  health ok (attempt $i)"; return 0
    fi
    last="HTTP ${status:-<transport failure>} body: $body"
    sleep "$HEALTH_INTERVAL"
  done
  echo "  health validation failed — last observed: $last"; return 1
}

# ---------------------------------------------------------------------------
# Run the rehearsal
# ---------------------------------------------------------------------------
echo "-- scenario A: happy path (owner -> PATCH image -> env-vars -> deploy -> live)"
POLL_ATTEMPTS=10 POLL_INTERVAL=1

construct_tags
echo "immutable tag: $IMMUTABLE"
echo "shortsha:      $SHORTSHA"
if [[ "$IMMUTABLE" =~ ^20[0-9]{6}-[0-9]{6}-[0-9a-f]{7}$ ]]; then
  pass "immutable tag matches ^20[0-9]{6}-[0-9]{6}-[0-9a-f]{7}\$ (date -u UTC clock)"
else
  fail "immutable tag malformed: $IMMUTABLE"
fi

MAINONLY=no build_tag_list; parse_tags_output
echo "tags output (mainonly=no): $TAGS_OUTPUT"
if [[ "$TAGS_OUTPUT" == "${IMAGE_NAME}:${IMMUTABLE}" ]]; then
  pass "mainonly=no: tags output is exactly the immutable tag (single line)"
else
  fail "mainonly=no: tags output malformed: '$TAGS_OUTPUT'"
fi

MAINONLY=yes build_tag_list; parse_tags_output
echo "tags output (mainonly=yes):"
echo "$TAGS_OUTPUT" | sed 's/^/  /'
if [[ "$TAGS_OUTPUT" == "${IMAGE_NAME}:${IMMUTABLE}"$'\n'"${IMAGE_NAME}:main" ]]; then
  pass "mainonly=yes: tags output carries immutable + moving main (two lines)"
else
  fail "mainonly=yes: tags output malformed: '$TAGS_OUTPUT'"
fi

fetch_owner_id
if [[ "${OWNER_ID:-}" == "usr-dry-run-owner" ]]; then
  pass "owners GET: single owner id extracted ($OWNER_ID)"
else
  fail "owners GET: owner id not extracted correctly ('${OWNER_ID:-<empty>}')"
fi

patch_service
echo "PATCH body: $(cat "$STATE/patch_body.json")"
if jq -e --arg owner "$OWNER_ID" --arg img "${IMAGE_NAME}:${IMMUTABLE}" \
  'keys == ["image"]
   and (.image | keys | sort) == ["imagePath", "ownerId"]
   and .image.ownerId == $owner and .image.imagePath == $img' \
  "$STATE/patch_body.json" > /dev/null; then
  pass "#52a PATCH body has EXACTLY image.ownerId + image.imagePath (no other fields, right values)"
else
  fail "#52a PATCH body malformed: must be exactly {image:{ownerId,imagePath}} with right values"
fi

update_env_vars
echo "env-vars PUT body: $(cat "$STATE/put_body.json")"
if grep -qF "deployment.environment.name=dev,service.version=$SHORTSHA" "$STATE/put_body.json"; then
  pass "#52(ii) env-vars PUT body carries exact OTEL string with the tag's own shortsha ($SHORTSHA)"
else
  fail "#52(ii) env-vars PUT body missing exact 'deployment.environment.name=dev,service.version=$SHORTSHA'"
fi
if jq -e --slurpfile src "$STATE/env-vars-source.json" --arg v "deployment.environment.name=dev,service.version=$SHORTSHA" \
  '([.[].key] | sort) == ([$src[0][].key] | sort)
   and (any(.[]; .key == "OTEL_RESOURCE_ATTRIBUTES" and .value == $v))
   and (all(.[]; .key == "OTEL_RESOURCE_ATTRIBUTES"
        or (. as $e | any($src[0][]; .key == $e.key and .value == $e.value))))' \
  "$STATE/put_body.json" > /dev/null; then
  pass "#52b PUT preserves every unrelated key byte-for-byte (DATABASE_URL above all) and updates ONLY OTEL_RESOURCE_ATTRIBUTES"
else
  fail "#52b PUT mutated an unrelated key or lost/failed to update OTEL_RESOURCE_ATTRIBUTES"
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
echo "-- scenario B: mutation — OTEL_RESOURCE_ATTRIBUTES absent from source (add-if-absent)"
printf 'no_otel' > "$STATE/env_mode"
rm -f "$STATE/put_body.json"
if update_env_vars; then
  if jq -e --slurpfile src "$STATE/env-vars-source.json" --arg v "deployment.environment.name=dev,service.version=$SHORTSHA" \
    '([.[].key] | sort) == ["DATABASE_URL","OTEL_EXPORTER_OTLP_HEADERS","OTEL_RESOURCE_ATTRIBUTES","RENDER_SERVICE_ID"]
     and (any(.[]; .key == "OTEL_RESOURCE_ATTRIBUTES" and .value == $v))
     and (all(.[]; .key == "OTEL_RESOURCE_ATTRIBUTES"
          or (. as $e | any($src[0][]; .key == $e.key and .value == $e.value))))' \
    "$STATE/put_body.json" > /dev/null; then
    pass "#52b-mutant OTEL was ABSENT and got ADDED; the 3 source keys preserved byte-for-byte"
  else
    fail "#52b-mutant OTEL not added correctly on the absent-key path"
  fi
else
  fail "#52b-mutant update_env_vars failed on the absent-key path"
fi
rm -f "$STATE/env_mode"

echo ""
echo "-- scenario C: mutation — service PATCH returns HTTP 400"
printf '400' > "$STATE/patch_mode"
if ( patch_service ) > "$STATE/patch_fail.out" 2>&1; then
  fail "#52c patch_service PASSED under mocked HTTP 400 — helper does not fail on non-2xx"
else
  if grep -qF 'PATCH must fail with this body visible' "$STATE/patch_fail.out"; then
    pass "#52c mocked 400: helper exits non-zero AND prints the response body"
  else
    fail "#52c mocked 400: helper failed but the response body was NOT printed"
  fi
fi
rm -f "$STATE/patch_mode"

echo ""
echo "-- scenario D: mutation — trailing space body"
echo "health_mode=trailing"
printf 'trailing' > "$STATE/health_mode"
if ( HEALTH_ATTEMPTS=2; HEALTH_INTERVAL=1; health_assert ); then
  fail "health assert PASSED on '{\"status\":\"ok\"} ' (trailing space) — assert is not exact"
else
  pass "health assert correctly FAILED on trailing-space body"
fi

echo ""
echo "-- scenario E: mutation — HTTP 503"
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
