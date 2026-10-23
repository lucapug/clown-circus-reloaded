#!/usr/bin/env bash
# cd-dry-run.sh — mock rehearsal of the cd-dev.yml deploy path (issues
# #47/#52) and the cd-promote.yml / health-monitor.yml paths (issue #48).
#
# Exercises the SAME shell logic as .github/workflows/cd-dev.yml against an
# inline mock server (python3 stdlib http.server) emulating the Render API
# (GET /owners, PATCH service, GET/PUT env-vars, POST deploy, GET deploy ->
# live) and the dev /health endpoint. For #48 the same mock also emulates a
# ghcr.io anonymous exchange (GET /token, GET /v2/.../manifests/<tag> with a
# Docker-Content-Digest header) so the promotion path resolves digests with
# no network. No network, no credentials: the "API key" is the literal
# dummy `dry-run` and is never validated.
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
#          response body printed (scenario C) — no `-f`-and-swallow;
#   (#52-poll) the deploy-status poll tolerates transient API failures as
#          failed ATTEMPTS (helper output shown, counter reset on success)
#          and gives up only on 3 CONSECUTIVE failures, with the last body
#          (scenarios D/E: 2x502 -> live; 3x502 -> give-up).
#
# Issue #48 additions (each new check mutation-proven per the file's
# convention):
#   (#48a) the promote tag-format gate refuses a malformed tag, and a
#          request log kept by the mock proves NO Render call happened;
#   (#48b) the anonymous GHCR digest resolution (token -> manifest ->
#          Docker-Content-Digest, with the full Accept set) works against
#          the mock, and a mocked 404 refuses with "not present in GHCR"
#          BEFORE any Render call;
#   (#48c) an expected_digest MISMATCH refuses BEFORE any Render call
#          (request-log proven) — the #49 digest rule made operational;
#   (#48d) the promote flow (owners -> prod PATCH -> prod env-vars ->
#          POST -> poll -> prod health) patches EXACTLY
#          {image:{ownerId, imagePath}} with the promoted tag as
#          imagePath, sets
#          deployment.environment.name=prod,service.version=<shortsha>
#          (shortsha = promoted tag suffix), preserves every other
#          env var byte-for-byte, and asserts the prod health exact body;
#   (#48e) the promotion workflow pins a 45-attempt poll (15 min cap) and
#          the monitor workflow pins the */15 cron — structural greps of
#          the workflow files (trigger safety, permissions: {}, no `uses:`)
#   (#48f) the monitor check (guard on unset repo variables, then 3x10s
#          retries with the exact-body assert) logs "health ok: <env>
#          (attempt N)" and fails on a mutant body.
#
# Issue #59 addition (orchestrator instruction; mutation-proven as usual):
#   (#59)  the REAL ops/grafana-apply.sh validate passes offline with the
#          new alerting checks (rule JSON, frozen semantics, provisioning
#          mock round-trip), and a MUTATED COPY of alert-rule.json (for: 5m
#          + wrong datasource uid) makes the same validate FAIL — proving
#          the alert checks are not vacuous. The repo tree is never touched
#          (the mutation happens in a temp copy of ops/grafana*).
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
fails = {"n": 0, "plan": ""}   # deploy-status GET failure plan (scenarios F/G)

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

    def _log(self):
        # Request log: the #48 refusal checks assert that a refusal path
        # NEVER touches Render (no /v1/ request after log truncation).
        with (state_dir / "requests.log").open("a") as f:
            f.write(f"{self.command} {self.path}\n")

    def _body(self):
        n = int(self.headers.get("Content-Length") or 0)
        return self.rfile.read(n).decode() if n else ""

    def _send(self, code, body, extra_headers=None):
        data = body.encode()
        self.send_response(code)
        for k, v in (extra_headers or {}).items():
            self.send_header(k, v)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _mode(self, name):
        f = state_dir / name
        return f.read_text().strip() if f.exists() else ""

    def do_PATCH(self):
        self._log()
        if self._mode("patch_mode") == "400":
            self._send(400, json.dumps({
                "message": "PATCH must fail with this body visible",
                "dry_run": True}))
            return
        (state_dir / "patch_body.json").write_text(self._body())
        self._send(200, json.dumps({"id": self._mode("service_id") or "srv-mock"}))

    def do_PUT(self):
        self._log()
        body = self._body()   # read ONCE — a second read would block on the socket
        (state_dir / "put_body.json").write_text(body)
        self._send(200, body)

    def do_POST(self):
        self._log()
        (state_dir / "post_body.json").write_text(self._body())
        self._send(200, json.dumps({"id": "dep-mock-1"}))

    def do_GET(self):
        self._log()
        u = urlparse(self.path)
        # --- ghcr.io mock (issue #48): anonymous token + manifest with the
        # Docker-Content-Digest header the promotion path resolves.
        if u.path == "/token":
            self._send(200, json.dumps({"token": "dry-run-ghcr-token"}))
            return
        if u.path.startswith("/v2/") and "/manifests/" in u.path:
            tag = u.path.rsplit("/", 1)[1]
            if self._mode("ghcr_mode") == "404":
                self._send(404, json.dumps(
                    {"errors": [{"code": "MANIFEST_UNKNOWN", "tag": tag}]}))
                return
            digest = self._mode("ghcr_digest") or "sha256:" + ("ab" * 32)
            self._send(200, json.dumps({
                "schemaVersion": 2,
                "mediaType": "application/vnd.oci.image.index.v1+json",
                "manifests": []}),
                extra_headers={"Docker-Content-Digest": digest})
            return
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
            plan = self._mode("deploy_fail_first")   # first N status GETs -> 502
            if plan != fails["plan"]:
                fails["plan"] = plan
                fails["n"] = 0
            if plan.isdigit() and fails["n"] < int(plan):
                fails["n"] += 1
                self._send(502, json.dumps({
                    "message": f"transient failure {fails['n']} of {plan}"}))
                return
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
GHCR_BASE="http://127.0.0.1:$PORT"          # ghcr.io mock (token + manifests)
IMAGE_REPO="lucapug/clown-circus-reloaded"  # registry path without ghcr.io/
RENDER_PROD_SERVICE_ID="srv-mock-prod"
PROD_HEALTH_URL="http://127.0.0.1:$PORT/health"

# Repo-relative paths of the workflows under structural check (#48e).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROMOTE_WF="$(cd "$SCRIPT_DIR/.." && pwd)/.github/workflows/cd-promote.yml"
MONITOR_WF="$(cd "$SCRIPT_DIR/.." && pwd)/.github/workflows/health-monitor.yml"

echo "== cd-dry-run: mock Render + mock ghcr.io at 127.0.0.1:$PORT =="
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
  # Optional args (issue #48): patch_service [service_id] [tag] — defaults
  # keep the #47/#52 dev-flow call sites unchanged.
  local service_id="${1:-$RENDER_DEV_SERVICE_ID}" tag="${2:-$IMMUTABLE}"
  BODY="$(jq -n --arg owner "$OWNER_ID" \
    --arg img "${IMAGE_NAME}:${tag}" \
    '{image: {ownerId: $owner, imagePath: $img}}')"
  api PATCH "/services/$service_id" "$BODY" > /dev/null
}

update_env_vars() {
  # Optional args (issue #48): update_env_vars [service_id] [otel_value].
  local service_id="${1:-$RENDER_DEV_SERVICE_ID}"
  local new_otel="${2:-deployment.environment.name=dev,service.version=${SHORTSHA}}"
  local cursor="" page ep current
  : > "$RUNNER_TEMP/env-vars.jsonl"
  while :; do
    ep="/services/$service_id/env-vars?limit=100"
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
  NEW_OTEL="$new_otel"
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
  api PUT "/services/$service_id/env-vars" "$UPDATED" > /dev/null
  echo "  env-vars updated: OTEL_RESOURCE_ATTRIBUTES=$NEW_OTEL (all other keys preserved)"
}

post_deploy() {
  # Optional args (issue #48): post_deploy [service_id] [tag].
  local service_id="${1:-$RENDER_DEV_SERVICE_ID}" tag="${2:-$IMMUTABLE}"
  BODY="$(jq -n --arg img "${IMAGE_NAME}:${tag}" '{imageUrl:$img}')"
  RESP="$(api POST "/services/$service_id/deploys" "$BODY")"
  DEPLOY_ID="$(echo "$RESP" | jq -r '.id')"
}

poll_deploy() {
  # Optional arg (issue #48): poll_deploy [service_id].
  local service_id="${1:-$RENDER_DEV_SERVICE_ID}"
  local i status resp consecutive=0 api_err
  # Same failure semantics as the workflow poll step: an api() failure
  # (transport or non-2xx) fails the ATTEMPT only — helper output is kept
  # and shown, a success resets the counter, 3 CONSECUTIVE failures give up.
  api_err="$RUNNER_TEMP/poll-api.err"
  for i in $(seq 1 "$POLL_ATTEMPTS"); do
    if resp="$(api GET "/services/$service_id/deploys/$DEPLOY_ID" 2>"$api_err")"; then
      consecutive=0
      status="$(echo "$resp" | jq -r '.status')"
      echo "  poll $i/$POLL_ATTEMPTS: ${status:-<no status>}"
      case "$status" in
        live) echo "  deploy is live"; return 0 ;;
        build_failed|update_failed|canceled|deactivated)
          echo "  deploy ended with status: $status"; return 1 ;;
      esac
    else
      consecutive=$((consecutive + 1))
      echo "  poll $i/$POLL_ATTEMPTS: API call failed (consecutive $consecutive/3) — helper output:"
      cat "$api_err"
      if [[ "$consecutive" -ge 3 ]]; then
        echo "  deploy poll gave up after 3 consecutive API failures — last response:"
        cat "$api_err"
        return 1
      fi
    fi
    sleep "$POLL_INTERVAL"
  done
  echo "  deploy poll timed out"; return 1
}

health_assert() {
  # Optional arg (issue #48): health_assert [url].
  local url="${1:-$DEV_HEALTH_URL}"
  local i resp status body last=""
  for i in $(seq 1 "$HEALTH_ATTEMPTS"); do
    resp="$(curl -sS -w '\nHTTP_STATUS:%{http_code}' --max-time 10 "$url" 2>/dev/null || true)"
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
# Issue #48: promotion-path equivalents (same logic as cd-promote.yml)
# ---------------------------------------------------------------------------
promote_tag_gate() {
  # Step-1 equivalent: fail fast on a malformed tag, BEFORE any network call.
  local tag="$1"
  if [[ ! "$tag" =~ ^[0-9]{8}-[0-9]{6}-[0-9a-f]{7}$ ]]; then
    echo "::error::tag '$tag' does not match YYYYMMDD-HHMMSS-<shortsha> — refusing to promote" >&2
    return 1
  fi
}

resolve_digest() {
  # Step-2 equivalent: anonymous token -> manifest (full Accept set) ->
  # Docker-Content-Digest header. Sets RESOLVED_DIGEST on success.
  local tag="$1" token resp status digest accept
  token="$(curl -sS "${GHCR_BASE}/token?scope=repository:${IMAGE_REPO}:pull" | jq -r '.token')"
  if [[ -z "$token" || "$token" == "null" ]]; then
    echo "::error::could not obtain anonymous GHCR pull token" >&2; return 1
  fi
  # The Accept set MUST include the OCI-index and Docker manifest-list
  # types so Docker-Content-Digest equals the TOP-LEVEL index digest.
  accept='application/vnd.docker.distribution.manifest.v2+json, application/vnd.docker.distribution.manifest.list.v2+json, application/vnd.oci.image.manifest.v1+json, application/vnd.oci.image.index.v1+json'
  resp="$(curl -sS -D "$RUNNER_TEMP/manifest-headers.txt" -o "$RUNNER_TEMP/manifest-body.json" \
    -w '\nHTTP_STATUS:%{http_code}' \
    -H "Authorization: Bearer $token" -H "Accept: $accept" \
    "${GHCR_BASE}/v2/${IMAGE_REPO}/manifests/${tag}")"
  status="${resp##*$'\n'}"; status="${status#HTTP_STATUS:}"
  if [[ "$status" == "404" ]]; then
    echo "::error::tag ${tag} not present in GHCR — refusing to promote" >&2
    return 1
  fi
  if [[ ! "$status" =~ ^2[0-9][0-9]$ ]]; then
    echo "::error::GHCR manifest request for ${tag} failed (HTTP ${status})" >&2
    cat "$RUNNER_TEMP/manifest-body.json" >&2
    return 1
  fi
  digest="$(grep -i '^docker-content-digest:' "$RUNNER_TEMP/manifest-headers.txt" | tail -1 | tr -d '\r' | awk '{print $2}')"
  if [[ -z "$digest" ]]; then
    echo "::error::GHCR response carried no Docker-Content-Digest header — cannot establish promotion identity" >&2
    return 1
  fi
  RESOLVED_DIGEST="$digest"
}

promote_expected_digest_gate() {
  # Step-3 equivalent: normalize (trim + strip sha256: prefix) and compare;
  # a mismatch refuses BEFORE any Render call.
  local expected resolved
  expected="$(echo "${1:-}" | tr -d '[:space:]')"
  expected="${expected#sha256:}"
  resolved="${RESOLVED_DIGEST#sha256:}"
  if [[ "$expected" != "$resolved" ]]; then
    echo "::error::expected_digest mismatch — refusing to promote BEFORE touching Render" >&2
    echo "  expected: sha256:${expected}" >&2
    echo "  resolved: ${RESOLVED_DIGEST}" >&2
    return 1
  fi
}

no_render_calls_since() {
  # True when the mock request log holds no Render (/v1/) call — the
  # refusal paths must never touch Render.
  ! grep -qE '^(GET|PATCH|PUT|POST) /v1/' "$STATE/requests.log"
}

# ---------------------------------------------------------------------------
# Issue #48: monitor equivalents (same logic as health-monitor.yml)
# ---------------------------------------------------------------------------
MONITOR_INTERVAL="${MONITOR_INTERVAL:-10}"

monitor_guard() {
  # Guard equivalent: an unset repo variable is a visible misconfiguration.
  local failed=0
  if [[ -z "${1:-}" ]]; then echo "::error::repo variable DEV_HEALTH_URL is not set" >&2; failed=1; fi
  if [[ -z "${2:-}" ]]; then echo "::error::repo variable PROD_HEALTH_URL is not set" >&2; failed=1; fi
  return "$failed"
}

monitor_check() {
  # check <name> <url>: 3 attempts, sleep 10 between; success = HTTP 200
  # AND the EXACT body {"status":"ok"} (no jq).
  local name="$1" url="$2" i resp status body last=""
  for i in $(seq 1 3); do
    resp="$(curl -sS -w '\nHTTP_STATUS:%{http_code}' --max-time 10 "$url" 2>/dev/null || true)"
    status="${resp##*$'\n'}"; status="${status#HTTP_STATUS:}"
    body="${resp%$'\n'*}"
    if [[ "$status" == "200" && "$body" == '{"status":"ok"}' ]]; then
      echo "health ok: ${name} (attempt ${i})"
      return 0
    fi
    last="HTTP ${status:-<transport failure>} body: ${body}"
    sleep "$MONITOR_INTERVAL"
  done
  echo "::error::health check failed: ${name} (${url}) — last observed: ${last}"
  return 1
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
echo "-- scenario D: mutation — deploy-status GET fails twice, then recovers"
printf '2' > "$STATE/deploy_fail_first"
if ( POLL_ATTEMPTS=10; POLL_INTERVAL=1; DEPLOY_ID=dep-mock-1; poll_deploy ) > "$STATE/poll_tol.out" 2>&1; then
  if grep -qF 'consecutive 2/3' "$STATE/poll_tol.out"; then
    pass "#52-poll 2 transient 502s tolerated (consecutive counter reset on success); deploy reached live"
  else
    fail "#52-poll poll succeeded but the transient-failure path was not exercised"
  fi
else
  fail "#52-poll poll_deploy gave up on 2 transient API failures — tolerance not mirrored"
fi
rm -f "$STATE/deploy_fail_first"

echo ""
echo "-- scenario E: mutation — 3 consecutive deploy-status failures"
printf '3' > "$STATE/deploy_fail_first"
if ( POLL_ATTEMPTS=10; POLL_INTERVAL=1; DEPLOY_ID=dep-mock-1; poll_deploy ) > "$STATE/poll_giveup.out" 2>&1; then
  fail "#52-poll poll_deploy PASSED despite 3 consecutive API failures — cap missing"
else
  if grep -qF 'transient failure 3 of 3' "$STATE/poll_giveup.out" && grep -qF 'gave up after 3 consecutive' "$STATE/poll_giveup.out"; then
    pass "#52-poll 3 consecutive failures give up non-zero WITH the last response body"
  else
    fail "#52-poll gave up but the last response body / give-up line was not printed"
  fi
fi
rm -f "$STATE/deploy_fail_first"

echo ""
echo "-- scenario F: mutation — trailing space body"
echo "health_mode=trailing"
printf 'trailing' > "$STATE/health_mode"
if ( HEALTH_ATTEMPTS=2; HEALTH_INTERVAL=1; health_assert ); then
  fail "health assert PASSED on '{\"status\":\"ok\"} ' (trailing space) — assert is not exact"
else
  pass "health assert correctly FAILED on trailing-space body"
fi

echo ""
echo "-- scenario G: mutation — HTTP 503"
echo "health_mode=503"
printf '503' > "$STATE/health_mode"
if ( HEALTH_ATTEMPTS=2; HEALTH_INTERVAL=1; health_assert ); then
  fail "health assert PASSED on HTTP 503 — assert is not exact"
else
  pass "health assert correctly FAILED on HTTP 503"
fi
rm -f "$STATE/health_mode"

# ---------------------------------------------------------------------------
# Issue #48: promotion + monitor rehearsal
# ---------------------------------------------------------------------------
echo ""
echo "-- scenario H: structural — promote/monitor workflow safety (#48e)"
if [[ ! -f "$PROMOTE_WF" || ! -f "$MONITOR_WF" ]]; then
  fail "#48e workflow file missing ($PROMOTE_WF / $MONITOR_WF)"
else
  if grep -nqE '^\s+(push|workflow_run|schedule):' "$PROMOTE_WF"; then
    fail "#48e cd-promote.yml has an auto trigger (push/workflow_run/schedule) — nothing may auto-deploy prod"
  else
    pass "#48e cd-promote.yml has NO auto trigger (workflow_dispatch ONLY — nothing auto-deploys prod)"
  fi
  if grep -nq 'workflow_dispatch:' "$PROMOTE_WF"; then
    pass "#48e cd-promote.yml carries the workflow_dispatch trigger"
  else
    fail "#48e cd-promote.yml lost workflow_dispatch"
  fi
  if grep -nq 'group: cd-promote-prod' "$PROMOTE_WF" \
    && grep -nq 'cancel-in-progress: false' "$PROMOTE_WF"; then
    pass "#48e cd-promote.yml queues under cd-promote-prod with cancel-in-progress: false"
  else
    fail "#48e cd-promote.yml concurrency group/queueing missing"
  fi
  if grep -nq 'seq 1 45' "$PROMOTE_WF" && grep -nq '15 min cap' "$PROMOTE_WF"; then
    pass "#48e cd-promote.yml pins the 45-attempt poll (45 x 20 s = 15 min cap for the first repo->image switch)"
  else
    fail "#48e cd-promote.yml poll is not 45 attempts x 20 s (15 min cap)"
  fi
  if grep -nq 'application/vnd.oci.image.index.v1+json' "$PROMOTE_WF" \
    && grep -nq 'application/vnd.docker.distribution.manifest.list.v2+json' "$PROMOTE_WF"; then
    pass "#48e cd-promote.yml Accept set includes OCI-index + Docker manifest-list (top-level index digest resolved)"
  else
    fail "#48e cd-promote.yml Accept set is too narrow — digests would spuriously mismatch"
  fi
  if grep -nq "cron: '\*/15 \* \* \* \*'" "$MONITOR_WF" && grep -nq 'workflow_dispatch:' "$MONITOR_WF"; then
    pass "#48e health-monitor.yml triggers are schedule */15 + workflow_dispatch only"
  else
    fail "#48e health-monitor.yml triggers wrong (need cron */15 + workflow_dispatch)"
  fi
  if grep -nq 'permissions: {}' "$MONITOR_WF"; then
    pass "#48e health-monitor.yml has permissions: {} (read-none)"
  else
    fail "#48e health-monitor.yml permissions is not {}"
  fi
  if grep -nqE '^\s*(uses|secrets\.)' "$PROMOTE_WF" || grep -nqE '^\s*(uses|secrets\.)' "$MONITOR_WF"; then
    fail "#48e a new workflow uses a third-party action or a secret (zero uses:, RENDER_API_KEY only — grep is line-anchored)"
  else
    pass "#48e no uses:/secrets lines at step level in either new workflow (pure curl+jq; RENDER_API_KEY is indented under env:)"
  fi
fi

echo ""
echo "-- scenario I: promote happy path — resolve -> gate -> Render sequence -> prod health (#48d)"
PROMOTE_TAG="20261022-102048-84d7ba4"   # the brief's example tag
PROMOTE_SHORTSHA="${PROMOTE_TAG##*-}"
if resolve_digest "$PROMOTE_TAG" \
  && promote_expected_digest_gate "  ${RESOLVED_DIGEST}" ; then   # leading spaces prove normalization
  pass "#48d GHCR anonymous resolution returned ${RESOLVED_DIGEST}; expected_digest gate accepted it (normalized, sha256: prefix tolerated)"
else
  fail "#48d GHCR anonymous resolution or expected_digest gate failed on the happy path"
fi
: > "$STATE/requests.log"   # count only promote-flow Render calls from here
if fetch_owner_id \
  && patch_service "$RENDER_PROD_SERVICE_ID" "$PROMOTE_TAG" \
  && update_env_vars "$RENDER_PROD_SERVICE_ID" "deployment.environment.name=prod,service.version=${PROMOTE_SHORTSHA}" \
  && post_deploy "$RENDER_PROD_SERVICE_ID" "$PROMOTE_TAG" \
  && ( POLL_ATTEMPTS=10; POLL_INTERVAL=1; poll_deploy "$RENDER_PROD_SERVICE_ID" ) \
  && ( HEALTH_ATTEMPTS=2; HEALTH_INTERVAL=1; health_assert "$PROD_HEALTH_URL" ); then
  if jq -e --arg owner "$OWNER_ID" --arg img "${IMAGE_NAME}:${PROMOTE_TAG}" \
    'keys == ["image"]
     and (.image | keys | sort) == ["imagePath", "ownerId"]
     and .image.ownerId == $owner and .image.imagePath == $img' \
    "$STATE/patch_body.json" > /dev/null \
    && grep -qF "deployment.environment.name=prod,service.version=${PROMOTE_SHORTSHA}" "$STATE/put_body.json" \
    && jq -e --slurpfile src "$STATE/env-vars-source.json" --arg v "deployment.environment.name=prod,service.version=${PROMOTE_SHORTSHA}" \
      '([.[].key] | sort) == ([$src[0][].key] | sort)
       and (any(.[]; .key == "OTEL_RESOURCE_ATTRIBUTES" and .value == $v))
       and (all(.[]; .key == "OTEL_RESOURCE_ATTRIBUTES"
            or (. as $e | any($src[0][]; .key == $e.key and .value == $e.value))))' \
      "$STATE/put_body.json" > /dev/null; then
    pass "#48d promote flow: prod PATCH exactly {image:{ownerId,imagePath:<promoted tag>}}, env-vars updated ONLY to prod OTEL (others byte-for-byte), deploy live, prod health exact-body ok"
  else
    fail "#48d promote flow bodies wrong (PATCH shape / OTEL value / preservation)"
  fi
else
  fail "#48d promote happy path failed (owner/PATCH/env-vars/deploy/poll/health)"
fi

echo ""
echo "-- scenario J: mutation — malformed tag refuses BEFORE any call (#48a)"
: > "$STATE/requests.log"
JOUT="$STATE/tag-gate.out"
if ( promote_tag_gate "20261022-102048-NOPE" ) > "$JOUT" 2>&1; then
  fail "#48a tag-format gate PASSED a malformed tag"
else
  if grep -q 'refusing to promote' "$JOUT" && no_render_calls_since; then
    pass "#48a malformed tag refused ('refusing to promote') with zero Render calls"
  else
    fail "#48a tag gate refused without its message or after touching Render: $(cat "$JOUT")"
  fi
fi

echo ""
echo "-- scenario K: mutation — GHCR 404 refuses BEFORE any Render call (#48b)"
printf '404' > "$STATE/ghcr_mode"
: > "$STATE/requests.log"
KOUT="$STATE/resolve404.out"
if ( resolve_digest "$PROMOTE_TAG" ) > "$KOUT" 2>&1; then
  fail "#48b resolve_digest PASSED on a mocked 404"
else
  if grep -q 'not present in GHCR' "$KOUT" && no_render_calls_since; then
    pass "#48b GHCR-404 refused ('not present in GHCR') with zero Render calls"
  else
    fail "#48b GHCR-404 refusal missing its message or Render was touched: $(cat "$KOUT")"
  fi
fi
rm -f "$STATE/ghcr_mode"

echo ""
echo "-- scenario L: mutation — expected_digest mismatch refuses BEFORE any Render call (#48c)"
: > "$STATE/requests.log"
if resolve_digest "$PROMOTE_TAG" && ( promote_expected_digest_gate "sha256:deadbeef" ); then
  fail "#48c expected_digest gate PASSED on a wrong digest"
else
  if [[ "${RESOLVED_DIGEST:-}" == "sha256:$(printf 'ab%.0s' {1..32})" ]] && no_render_calls_since; then
    pass "#48c digest mismatch refused with zero Render calls (resolved ${RESOLVED_DIGEST})"
  else
    fail "#48c mismatch refusal did not behave (no Render calls / wrong resolved digest)"
  fi
fi

echo ""
echo "-- scenario M: mutation — prod health exact-body (trailing space) on the promote path"
printf 'trailing' > "$STATE/health_mode"
if ( HEALTH_ATTEMPTS=2; HEALTH_INTERVAL=1; health_assert "$PROD_HEALTH_URL" ); then
  fail "#48d prod health assert PASSED on a trailing-space body — assert is not exact"
else
  pass "#48d prod health assert correctly FAILED on a trailing-space body"
fi
rm -f "$STATE/health_mode"

echo ""
echo "-- scenario N: monitor rehearsal — guard + 3x10s checks (#48f)"
MONITOR_INTERVAL=0
if monitor_guard "$DEV_HEALTH_URL" "$PROD_HEALTH_URL"; then
  pass "#48f monitor guard accepts two set URLs"
else
  fail "#48f monitor guard rejected set URLs"
fi
MOUT="$STATE/monitor.out"
if monitor_check dev "$DEV_HEALTH_URL" > "$MOUT" 2>&1 \
  && monitor_check prod "$PROD_HEALTH_URL" >> "$MOUT" 2>&1 \
  && grep -q 'health ok: dev (attempt 1)' "$MOUT" \
  && grep -q 'health ok: prod (attempt 1)' "$MOUT"; then
  pass "#48f monitor checks logged 'health ok: dev/prod (attempt N)' on the exact-ok body"
else
  fail "#48f monitor checks failed on the exact-ok body: $(cat "$MOUT")"
fi
printf 'trailing' > "$STATE/health_mode"
if ( monitor_check prod "$PROD_HEALTH_URL" ); then
  fail "#48f monitor check PASSED on a trailing-space body — assert is not exact"
else
  pass "#48f monitor check correctly FAILED on a trailing-space body (3x10s budget)"
fi
rm -f "$STATE/health_mode"
MGUARD_OUT="$STATE/monitor-guard.out"
if monitor_guard "" "$PROD_HEALTH_URL" > "$MGUARD_OUT" 2>&1; then
  fail "#48f monitor guard PASSED with an unset DEV_HEALTH_URL"
else
  if grep -q 'repo variable DEV_HEALTH_URL is not set' "$MGUARD_OUT"; then
    pass "#48f monitor guard fails visibly on the unset variable (::error::repo variable … is not set)"
  else
    fail "#48f monitor guard failed without the visible misconfiguration message"
  fi
fi

echo ""
echo "-- scenario O: grafana-apply.sh validate incl. #59 alert checks (real script, temp copy)"
GRAFANA_TMP="$(mktemp -d /tmp/cd-dry-run-grafana.XXXXXX)"
cp "$SCRIPT_DIR/grafana-apply.sh" "$GRAFANA_TMP/"
cp -R "$SCRIPT_DIR/grafana" "$GRAFANA_TMP/grafana"
GVOUT="$GRAFANA_TMP/validate.out"
if ( cd "$GRAFANA_TMP" && bash "$GRAFANA_TMP/grafana-apply.sh" validate ) > "$GVOUT" 2>&1 \
  && grep -q 'ALL CHECKS PASSED' "$GVOUT" \
  && grep -q 'alert sane: uid ccr-5xx-user-impact' "$GVOUT" \
  && grep -q 'alert semantics' "$GVOUT" \
  && grep -q 'mock apply-alert (200/201)' "$GVOUT"; then
  pass "#59 grafana-apply validate passes with the alert checks + apply-alert mock round-trip ($(grep -c '^PASS:' "$GVOUT") PASS)"
else
  fail "#59 grafana-apply validate failed: $(tail -5 "$GVOUT")"
fi
# mutation: break the frozen semantics in the COPY only — for: 2m -> 5m and
# the pinned datasource uid -> a wrong one. The SAME validate must now fail
# on exactly the alert checks (non-vacuity proof).
sed -i.bak -e 's/"for": "2m"/"for": "5m"/' -e 's/grafanacloud-prom/grafanacloud-mutated/' \
  "$GRAFANA_TMP/grafana/alert-rule.json"
if ( cd "$GRAFANA_TMP" && bash "$GRAFANA_TMP/grafana-apply.sh" validate ) > "$GVOUT" 2>&1; then
  fail "#59 mutated alert-rule.json still passed validate — the alert checks are vacuous"
else
  if grep -q 'FAILURES PRESENT' "$GVOUT" \
    && grep -q "FAIL: alert insane" "$GVOUT" \
    && grep -q "AssertionError: 5m" "$GVOUT" \
    && grep -q 'FAIL: alert constants: rule datasource refs wrong' "$GVOUT"; then
    pass "#59 mutated copy: validate FAILS on exactly the alert checks (for/datasource refs), dashboards checks unaffected"
  else
    fail "#59 mutated copy failed but without the expected alert-check messages: $(grep '^FAIL:' "$GVOUT" | head -5)"
  fi
fi
rm -rf "$GRAFANA_TMP"

echo ""
if [[ "$FAILED" == 0 ]]; then
  echo "== cd-dry-run: ALL CHECKS PASSED =="
  exit 0
else
  echo "== cd-dry-run: FAILURES PRESENT =="
  exit 1
fi
