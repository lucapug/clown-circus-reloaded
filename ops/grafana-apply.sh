#!/usr/bin/env bash
# grafana-apply.sh — dashboards-as-code pipeline for Grafana Cloud (issue #58).
#
# Subcommands:
#   apply      (default) push ops/grafana/*.json to ${GRAFANA_URL}/api/dashboards/db
#              with overwrite:true — create-or-update by fixed uid, so re-running
#              is idempotent (never duplicates dashboards). Reads GRAFANA_URL
#              (repo variable) and GRAFANA_SA_TOKEN (GitHub secret) from env
#              ONLY; fails loudly if either is absent. A Grafana service-account
#              token is required; local use: export both, or run via
#              `gh workflow run grafana-apply.yml` (post-merge).
#   validate   offline, no token: JSON sanity + structural jq checks + the
#              no-customer-data greps + a localhost mock-server round-trip
#              (success AND 401/500 error paths) of the real `apply` path.
#              This is the full automatable boundary — real rendering is only
#              verifiable in the Grafana UI (owner check, M6 evidence).
#
# Stated-not-invented constants (brief: parameterized, NOT invented; the first
# real apply settles them — each is a one-constant fix here plus the JSONs):
#   METRIC_HTTP — OTel auto-instrumentation HTTP histogram stem. fastapi
#                 [opentelemetry]>=0.143.2 pulls unpinned OTel, so the
#                 lockfile/runtime decides; older generation is
#                 http_server_duration_*. Verify via Grafana Explore or
#                 GET /api/datasources/proxy/uid/grafanacloud-prom/api/v1/label/__name__/values.
#   DS_PROM/DS_LOGS/DS_TRACES — Grafana Cloud stacks provision fixed well-known
#                 datasource UIDs; `apply` prints `GET /api/datasources | .[].uid`
#                 every run so a mismatch is visible immediately.
#   TRACEQL_ENV — Tempo TraceQL attribute form for the CD-injected env label
#                 (OTEL_RESOURCE_ATTRIBUTES deployment.environment.name). If the
#                 form differs only the Recent-traces panel empties; metrics and
#                 logs panels are unaffected.
#
# The api() helper is the #52 lesson embodied: status captured with
# `-w '\nHTTP_STATUS:%{http_code}'`, non-2xx prints the response body and exits
# 1 — never `curl -f` with swallowed output. Do not "fix" that behavior.
#
# Usage: ops/grafana-apply.sh [validate|apply]
# Exit 0 only if the requested subcommand succeeds.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SELF="${SCRIPT_DIR}/$(basename "${BASH_SOURCE[0]}")"
GRAFANA_DIR="${SCRIPT_DIR}/grafana"

# --- stated-not-invented constants (see header) -----------------------------
METRIC_HTTP="http_server_request_duration_seconds"   # histogram stem (_count/_bucket suffixes)
DS_PROM="grafanacloud-prom"                          # Prometheus datasource uid
DS_LOGS="grafanacloud-logs"                          # Loki datasource uid
DS_TRACES="grafanacloud-traces"                      # Tempo datasource uid
TRACEQL_ENV='resource.deployment.environment.name'   # TraceQL env attribute form

FAILED=0
pass() { echo "PASS: $*"; }
fail() { echo "FAIL: $*"; FAILED=1; }

# ---------------------------------------------------------------------------
# api() — verbatim cd-dev.yml L187-204 pattern, swapped base URL/auth.
# ---------------------------------------------------------------------------
api() {
  local method="$1" path="$2" body="${3:-}"
  local args=(-sS -w '\nHTTP_STATUS:%{http_code}' -X "$method" -H "Authorization: Bearer $GRAFANA_SA_TOKEN" -H "Content-Type: application/json")
  if [[ -n "$body" ]]; then args+=(-d "$body"); fi
  local resp status payload
  if ! resp="$(curl "${args[@]}" "${GRAFANA_URL}${path}")"; then
    echo "::error::curl transport failure on $method $path" >&2; exit 1
  fi
  status="${resp##*$'\n'}"; status="${status#HTTP_STATUS:}"
  payload="${resp%$'\n'*}"
  echo "grafana $method $path -> HTTP $status" >&2
  if [[ ! "$status" =~ ^2[0-9][0-9]$ ]]; then
    echo "::error::Grafana API $method $path failed (HTTP $status) — response body follows:" >&2
    printf '%s\n' "$payload" >&2
    exit 1
  fi
  printf '%s\n' "$payload"
}

require_env() {
  local missing=0
  if [[ -z "${GRAFANA_URL:-}" ]]; then
    echo "::error::GRAFANA_URL is not set — repo variable GRAFANA_URL (e.g. https://<stack>.grafana.net); locally: export GRAFANA_URL=..." >&2
    missing=1
  fi
  if [[ -z "${GRAFANA_SA_TOKEN:-}" ]]; then
    echo "::error::GRAFANA_SA_TOKEN is not set — GitHub secret GRAFANA_SA_TOKEN (Grafana service-account token; lives ONLY in GitHub secrets, never in the repo); locally: export GRAFANA_SA_TOKEN=..., or run via: gh workflow run grafana-apply.yml" >&2
    missing=1
  fi
  return "$missing"
}

cmd_apply() {
  if ! require_env; then
    echo "apply aborted: missing environment (see ::error:: lines above)" >&2
    exit 1
  fi
  # Datasource-UID sanity: printed on EVERY run so a UID-constant mismatch is
  # visible immediately (brief: correcting the three constants is the only fix).
  local ds uids
  ds="$(api GET /api/datasources)"
  uids="$(echo "$ds" | jq -r '.[].uid' | tr '\n' ' ')"
  echo "Grafana datasources (sanity): $uids"
  if ! echo "$ds" | jq -e --arg p "$DS_PROM" --arg l "$DS_LOGS" --arg t "$DS_TRACES" \
    'any(.[]; .uid == $p or .uid == $l or .uid == $t)' > /dev/null; then
    echo "::warning::none of the pinned datasource UIDs ($DS_PROM, $DS_LOGS, $DS_TRACES) appear in GET /api/datasources — if the constants at the top of this script are stale, correct them in one commit" >&2
  fi
  local f uid st ver
  for f in "$GRAFANA_DIR"/*.json; do
    BODY="$(jq -n --slurpfile d "$f" --arg msg "#58 re-apply $(date -u +%FT%TZ)" \
      '{dashboard:$d[0], overwrite:true, message:$msg}')"
    RESP="$(api POST /api/dashboards/db "$BODY")"
    uid="$(echo "$RESP" | jq -r '.uid // "?"')"
    st="$(echo "$RESP" | jq -r '.status // "?"')"
    ver="$(echo "$RESP" | jq -r '.version // "?"')"
    echo "applied $(basename "$f"): uid=$uid status=$st version=$ver"
  done
  echo "apply complete (idempotent: fixed uids + overwrite:true — re-running never duplicates)"
}

# ---------------------------------------------------------------------------
# validate — offline; no token required.
# ---------------------------------------------------------------------------
mock_start() {
  # Stdlib mock of the Grafana HTTP API (cd-dry-run.sh pattern): records the
  # wrapped apply bodies; db_mode file selects 401/500 for the error paths.
  MOCK_STATE="$(mktemp -d /tmp/grafana-apply.XXXXXX)"
  cat > "$MOCK_STATE/grafana-mock.py" <<'PY'
import http.server
import json
import socketserver
import sys
from pathlib import Path

state = Path(sys.argv[1])


class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def _send(self, code, obj):
        data = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _mode(self):
        f = state / "db_mode"
        return f.read_text().strip() if f.exists() else ""

    def do_GET(self):
        if self.path == "/api/datasources":
            self._send(200, [
                {"uid": "grafanacloud-prom", "name": "grafanacloud-prom", "type": "prometheus"},
                {"uid": "grafanacloud-logs", "name": "grafanacloud-logs", "type": "loki"},
                {"uid": "grafanacloud-traces", "name": "grafanacloud-traces", "type": "tempo"}])
            return
        self._send(404, {"message": "not found"})

    def do_POST(self):
        if self.path == "/api/dashboards/db":
            n = int(self.headers.get("Content-Length") or 0)
            body = self.rfile.read(n).decode() if n else "{}"
            with (state / "apply_bodies.jsonl").open("a") as fh:
                fh.write(body + "\n")
            mode = self._mode()
            if mode == "401":
                self._send(401, {"message": "invalid token (mock 401 body)"})
            elif mode == "500":
                self._send(500, {"message": "internal error (mock 500 body)"})
            else:
                uid = json.loads(body).get("dashboard", {}).get("uid", "?")
                self._send(200, {"status": "success", "uid": uid, "version": 7, "id": 42})
            return
        self._send(404, {"message": "not found"})


socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("127.0.0.1", 0), Handler) as httpd:
    (state / "port").write_text(str(httpd.server_address[1]))
    httpd.serve_forever()
PY
  python3 "$MOCK_STATE/grafana-mock.py" "$MOCK_STATE" &
  MOCK_PID=$!
  local i
  for i in $(seq 1 100); do
    if [[ -f "$MOCK_STATE/port" ]] && kill -0 "$MOCK_PID" 2>/dev/null; then return 0; fi
    sleep 0.1
  done
  echo "FAIL: mock Grafana server did not start"; FAILED=1; return 1
}

MOCK_PID=""
MOCK_STATE=""
cleanup() {
  if [[ -n "$MOCK_PID" ]]; then
    kill "$MOCK_PID" 2>/dev/null || true
    wait "$MOCK_PID" 2>/dev/null || true
  fi
  if [[ -n "$MOCK_STATE" ]]; then rm -rf "$MOCK_STATE"; fi
}

# run_apply_against_mock — runs the REAL `apply` subcommand against the mock;
# output in APPLY_OUT, exit code in APPLY_RC.
run_apply_against_mock() {
  APPLY_OUT="$(GRAFANA_URL="$MOCK_URL" GRAFANA_SA_TOKEN="dry-run-dummy-not-a-secret" \
    bash "$SELF" apply 2>&1)" && APPLY_RC=0 || APPLY_RC=$?
}

cmd_validate() {
  trap cleanup EXIT
  local f err

  echo "== grafana-apply validate (offline) =="
  err="$(mktemp /tmp/grafana-apply-validate.XXXXXX)"

  # -- 1. JSON sanity (python) ----------------------------------------------
  for f in "$GRAFANA_DIR"/*.json; do
    if python3 -c "
import json, sys
d = json.load(open(sys.argv[1]))
assert d['uid'] in ('ccr-journey', 'ccr-env-version'), d.get('uid')
assert d['title'], d.get('title')
assert isinstance(d['panels'], list) and d['panels']
" "$f" 2> "$err"; then
      pass "json sane: $(basename "$f") (whitelisted uid, title, non-empty panels)"
    else
      fail "json insane: $(basename "$f") — $(cat "$err")"
    fi
  done

  # -- 2. jq structural checks ----------------------------------------------
  for f in "$GRAFANA_DIR"/*.json; do
    if jq -e '(.panels | length) > 0
      and all(.panels[]; ((.title // "") | length) > 0)
      and all(.panels[]; ((.datasource.uid // "") | length) > 0)' "$f" > /dev/null; then
      pass "structure: every panel of $(basename "$f") has title + datasource.uid"
    else
      fail "structure: a panel in $(basename "$f") lacks title or datasource.uid"
    fi
  done

  # trace-ID dataLink (the criterion's core): logs trace_id AND the trace list
  # both carry the pinned internal link to Tempo.
  if jq -e --arg raw '${__value.raw}' --arg tempo "$DS_TRACES" '
    ([.. | objects | (.internal // empty)
      | select(.datasourceUid == $tempo and .queryType == "traceql" and .query == $raw)] | length) >= 2' \
    "$GRAFANA_DIR/journey-dashboard.json" > /dev/null; then
    pass "trace-ID dataLink: journey dashboard carries the internal \${__value.raw} traceql link to $DS_TRACES (logs trace_id + trace list)"
  else
    fail "trace-ID dataLink: journey dashboard lost the internal \${__value.raw} traceql link to $DS_TRACES"
  fi

  # env variable defaults to BOTH environments (AC: both dev and prod visible).
  # Targets filter on the env label in either surface form: Prometheus/Loki
  # labels use underscores (deployment_environment_name), TraceQL keeps the
  # resource-attribute dots (deployment.environment.name).
  for f in "$GRAFANA_DIR"/*.json; do
    if jq -e '[.templating.list[] | select(.name == "env")]
      | length == 1 and .[0].query == "dev,prod" and .[0].includeAll == true and .[0].multi == true' "$f" > /dev/null \
      && jq -e 'all(.panels[]; all(.targets[]; ((.expr // .query // "") | test("deployment[._]environment[._]name"))))' "$f" > /dev/null; then
      pass "both-environments: $(basename "$f") env var is multi dev+prod (includeAll) and every target filters deployment_environment_name"
    else
      fail "both-environments: $(basename "$f") env variable or target filters wrong"
    fi
  done

  # constants are load-bearing: dashboards must use exactly these
  if jq -e --arg p "$DS_PROM" --arg l "$DS_LOGS" --arg t "$DS_TRACES" '
    ([((.. | objects | .datasource // empty) | .uid // empty),
      (.. | objects | .datasourceUid // empty)]
     | map(select(length > 0)) | unique) - [$p, $l, $t] | length == 0' \
    "$GRAFANA_DIR"/*.json > /dev/null; then
    pass "constants: every datasource reference is one of $DS_PROM/$DS_LOGS/$DS_TRACES"
  else
    fail "constants: a datasource uid outside $DS_PROM/$DS_LOGS/$DS_TRACES appears in the dashboards"
  fi
  if grep -qF "${METRIC_HTTP}_count" "$GRAFANA_DIR/journey-dashboard.json" \
    && grep -qF "${METRIC_HTTP}_bucket" "$GRAFANA_DIR/journey-dashboard.json" \
    && grep -qF "${METRIC_HTTP}_count" "$GRAFANA_DIR/env-version-dashboard.json"; then
    pass "constants: metric stem $METRIC_HTTP used consistently (histogram _count/_bucket)"
  else
    fail "constants: metric stem $METRIC_HTTP missing from a dashboard"
  fi
  if grep -qF "$TRACEQL_ENV" "$GRAFANA_DIR/journey-dashboard.json"; then
    pass "constants: TraceQL env attribute $TRACEQL_ENV present in the traces panel"
  else
    fail "constants: TraceQL env attribute $TRACEQL_ENV missing from the traces panel"
  fi

  # -- 3. no-customer-data greps --------------------------------------------
  if jq -r '.. | strings' "$GRAFANA_DIR"/*.json | grep -En '(^|[^_[:alnum:]])(name|player|user)="[^"]+"'; then
    fail "no-customer-data: a quoted literal name/player/user value appears above (leaderboard names must never enter dashboards)"
  else
    pass "no-customer-data: zero quoted name/player/user literals across all dashboard strings"
  fi
  if grep -Rn ZZVULNNAME "$GRAFANA_DIR"; then
    fail "no-customer-data: the #4 sentinel ZZVULNNAME appears in ops/grafana/"
  else
    pass "no-customer-data: #4 sentinel ZZVULNNAME absent from ops/grafana/"
  fi

  # -- 4. mock round-trip (success + 401/500 error paths) --------------------
  echo "-- mock round-trip at 127.0.0.1 (proves apply parses success and fails LOUDLY on errors — #52)"
  if mock_start; then
    MOCK_URL="http://127.0.0.1:$(cat "$MOCK_STATE/port")"

    # success path: both dashboards POSTed with the exact wrap shape
    rm -f "$MOCK_STATE/apply_bodies.jsonl"
    run_apply_against_mock
    if [[ "$APPLY_RC" == 0 ]] \
      && grep -qF 'uid=ccr-journey status=success' <<< "$APPLY_OUT" \
      && grep -qF 'uid=ccr-env-version status=success' <<< "$APPLY_OUT"; then
      pass "mock apply (200): both dashboards parsed — uid + status=success + version printed"
    else
      fail "mock apply (200): unexpected — rc=$APPLY_RC, output:"$'\n'"$APPLY_OUT"
    fi
    if [[ -f "$MOCK_STATE/apply_bodies.jsonl" ]] \
      && jq -se 'length == 2 and all(.[]; (keys | sort) == ["dashboard", "message", "overwrite"]
        and .overwrite == true
        and (.dashboard.uid == "ccr-journey" or .dashboard.uid == "ccr-env-version")
        and (.dashboard | has("panels")))' \
      "$MOCK_STATE/apply_bodies.jsonl" > /dev/null; then
      pass "mock apply (200): POST bodies are exactly {dashboard, overwrite:true, message} with the fixed uids"
    else
      fail "mock apply (200): wrapped POST bodies malformed"
    fi

    # error paths: non-2xx must exit non-zero WITH status + body printed (#52)
    printf '401' > "$MOCK_STATE/db_mode"
    run_apply_against_mock
    if [[ "$APPLY_RC" != 0 ]] \
      && grep -qF 'HTTP 401' <<< "$APPLY_OUT" \
      && grep -qF 'invalid token (mock 401 body)' <<< "$APPLY_OUT"; then
      pass "mock apply (401): helper exits non-zero AND prints status + response body"
    else
      fail "mock apply (401): did not fail loudly with the body — rc=$APPLY_RC, output:"$'\n'"$APPLY_OUT"
    fi

    printf '500' > "$MOCK_STATE/db_mode"
    run_apply_against_mock
    if [[ "$APPLY_RC" != 0 ]] \
      && grep -qF 'HTTP 500' <<< "$APPLY_OUT" \
      && grep -qF 'internal error (mock 500 body)' <<< "$APPLY_OUT"; then
      pass "mock apply (500): helper exits non-zero AND prints status + response body"
    else
      fail "mock apply (500): did not fail loudly with the body — rc=$APPLY_RC, output:"$'\n'"$APPLY_OUT"
    fi
    rm -f "$MOCK_STATE/db_mode"
  fi

  # -- loud guard: apply without env is itself a smoke check ------------------
  GUARD_OUT="$(env -u GRAFANA_URL -u GRAFANA_SA_TOKEN bash "$SELF" apply 2>&1)" && GUARD_RC=0 || GUARD_RC=$?
  if [[ "$GUARD_RC" != 0 ]] \
    && grep -q 'GRAFANA_URL is not set' <<< "$GUARD_OUT" \
    && grep -q 'GRAFANA_SA_TOKEN is not set' <<< "$GUARD_OUT"; then
    pass "guard: apply without GRAFANA_URL/GRAFANA_SA_TOKEN fails loudly before any network call"
  else
    fail "guard: apply ran without environment (rc=$GUARD_RC) — loud guard missing"
  fi

  rm -f "$err"
  echo ""
  if [[ "$FAILED" == 0 ]]; then
    echo "== grafana-apply validate: ALL CHECKS PASSED =="
    exit 0
  else
    echo "== grafana-apply validate: FAILURES PRESENT =="
    exit 1
  fi
}

case "${1:-apply}" in
  apply) cmd_apply ;;
  validate) cmd_validate ;;
  *) echo "usage: $0 [validate|apply]" >&2; exit 2 ;;
esac
