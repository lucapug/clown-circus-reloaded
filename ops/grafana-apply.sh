#!/usr/bin/env bash
# grafana-apply.sh — dashboards/alerting-as-code pipeline for Grafana Cloud
# (issues #58 dashboards, #59 alerting).
#
# Subcommands:
#   apply      (default) push ops/grafana/*-dashboard.json to
#              ${GRAFANA_URL}/api/dashboards/db with overwrite:true —
#              create-or-update by fixed uid, so re-running is idempotent
#              (never duplicates dashboards). Reads GRAFANA_URL (repo
#              variable) and GRAFANA_SA_TOKEN (GitHub secret) from env
#              ONLY; fails loudly if either is absent. A Grafana service-account
#              token is required; local use: export both, or run via
#              `gh workflow run grafana-apply.yml` (post-merge).
#   apply-alert provision the #59 alerting: folder `ccr-alerts`, contact
#              point `ccr-owner-email` (email to $ALERT_EMAIL — repo
#              variable ALERT_EMAIL, the one owner-confirmed recipient),
#              and alert rule `ccr-5xx-user-impact` — create-or-update by
#              uid via the alerting provisioning API, idempotent. Same env
#              requirements as `apply` PLUS ALERT_EMAIL (loud guard, this
#              subcommand only). Provisioning JSON shapes are stated-not-
#              invented (#59 brief): the first real apply settles field-level
#              shapes — HTTP 400 messages are the oracle.
#   validate   offline, no token: JSON sanity + structural jq checks + the
#              no-customer-data greps + a localhost mock-server round-trip
#              (success AND 401/500 error paths) of the real `apply` and
#              `apply-alert` paths.
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
# Usage: ops/grafana-apply.sh [validate|apply|apply-alert]
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

# --- alerting constants (#59; frozen semantics, shapes settle on first apply)
ALERT_RULE_UID="ccr-5xx-user-impact"                 # rule uid (create-or-update key)
ALERT_FOLDER_UID="ccr-alerts"                        # folder uid holding the rule
CONTACT_POINT_UID="ccr-owner-email"                  # contact point uid (email -> $ALERT_EMAIL)

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

# ---------------------------------------------------------------------------
# api_status() — same wire pattern as api() but NON-fatal: records the HTTP
# status in API_STATUS and the payload in API_PAYLOAD so apply-alert can
# branch on 404 (the create-or-update-by-uid probes). It does NOT replace or
# weaken api(): calls expected to succeed still go through the loud api().
# ---------------------------------------------------------------------------
api_status() {
  local method="$1" path="$2" body="${3:-}"
  local args=(-sS -w '\nHTTP_STATUS:%{http_code}' -X "$method" -H "Authorization: Bearer $GRAFANA_SA_TOKEN" -H "Content-Type: application/json")
  if [[ -n "$body" ]]; then args+=(-d "$body"); fi
  local resp
  if ! resp="$(curl "${args[@]}" "${GRAFANA_URL}${path}")"; then
    echo "::error::curl transport failure on $method $path" >&2; exit 1
  fi
  API_STATUS="${resp##*$'\n'}"; API_STATUS="${API_STATUS#HTTP_STATUS:}"
  API_PAYLOAD="${resp%$'\n'*}"
  echo "grafana $method $path -> HTTP $API_STATUS" >&2
}

loud_api_failure() {
  # The api()-style loud failure for api_status callers: status + body, exit 1.
  echo "::error::Grafana API $1 failed (HTTP $API_STATUS) — response body follows:" >&2
  printf '%s\n' "$API_PAYLOAD" >&2
  exit 1
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
  # Narrowed to *-dashboard.json (#59): alert-rule.json lives in the same dir
  # but is NOT a dashboard — it ships through `apply-alert` below.
  for f in "$GRAFANA_DIR"/*-dashboard.json; do
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
# apply-alert — #59 alerting provisioning (folder, contact point, rule).
# Same loud-failure semantics as apply; create-or-update BY UID everywhere.
# ---------------------------------------------------------------------------
ensure_alert_folder() {
  api_status GET "/api/v1/provisioning/folders/$ALERT_FOLDER_UID"
  if [[ "$API_STATUS" == "404" ]]; then
    api POST /api/v1/provisioning/folders \
      "$(jq -nc --arg u "$ALERT_FOLDER_UID" '{uid:$u, title:$u}')" > /dev/null
    echo "folder $ALERT_FOLDER_UID created"
  elif [[ "$API_STATUS" =~ ^2 ]]; then
    echo "folder $ALERT_FOLDER_UID exists"
  else
    loud_api_failure "GET /api/v1/provisioning/folders/$ALERT_FOLDER_UID"
  fi
}

upsert_contact_point() {
  # Shape stated-not-invented (#59 brief): the email recipient is the ONE
  # owner input (repo variable ALERT_EMAIL); the first real apply settles
  # the settings key if Grafana expects a different form.
  local body
  body="$(jq -nc --arg uid "$CONTACT_POINT_UID" --arg email "$ALERT_EMAIL" \
    '{uid:$uid, name:$uid, type:"email", settings:{addresses:[$email]}}')"
  api_status PUT "/api/v1/provisioning/contact-points/$CONTACT_POINT_UID" "$body"
  if [[ "$API_STATUS" == "404" ]]; then
    api POST /api/v1/provisioning/contact-points "$body" > /dev/null
    echo "contact point $CONTACT_POINT_UID created (email: $ALERT_EMAIL)"
  elif [[ "$API_STATUS" =~ ^2 ]]; then
    echo "contact point $CONTACT_POINT_UID updated (email: $ALERT_EMAIL)"
  else
    loud_api_failure "PUT /api/v1/provisioning/contact-points/$CONTACT_POINT_UID"
  fi
}

apply_policy_fallback() {
  # Only reached when Grafana rejects rule-level notification_settings with a
  # 400 naming it: add ONE nested branch (grafana_folder=ccr-alerts -> contact
  # point) to the policy tree. Idempotent; the global/default receiver is
  # never touched.
  local tree newtree
  tree="$(api GET /api/v1/provisioning/policies)"
  newtree="$(echo "$tree" | jq --arg r "$CONTACT_POINT_UID" --arg f "$ALERT_FOLDER_UID" '
    .policies = ((.policies // []) + (if any(.policies // [];
        any((.object_matchers // [])[]; .[0] == "grafana_folder" and .[2] == $f))
      then [] else [{"receiver": $r, "object_matchers": [["grafana_folder", "=", $f]]}] end))')"
  api PUT /api/v1/provisioning/policies "$newtree" > /dev/null
  echo "notification policy: nested branch grafana_folder=$ALERT_FOLDER_UID -> $CONTACT_POINT_UID (default receiver untouched)"
}

upsert_alert_rule() {
  local full no_policy
  full="$(jq -c . "$GRAFANA_DIR/alert-rule.json")"   # minified, byte-faithful semantics
  no_policy="$(jq -c 'del(.notification_settings)' "$GRAFANA_DIR/alert-rule.json")"
  api_status PUT "/api/v1/provisioning/alert-rules/$ALERT_RULE_UID" "$full"
  if [[ "$API_STATUS" == "404" ]]; then
    api POST /api/v1/provisioning/alert-rules "$full" > /dev/null
    echo "alert rule $ALERT_RULE_UID created (rule-level receiver $CONTACT_POINT_UID)"
  elif [[ "$API_STATUS" =~ ^2 ]]; then
    echo "alert rule $ALERT_RULE_UID updated (rule-level receiver $CONTACT_POINT_UID)"
  elif [[ "$API_STATUS" == "400" ]] && grep -qi 'notification_settings' <<< "$API_PAYLOAD"; then
    echo "::warning::rule-level notification_settings rejected (HTTP 400) — falling back to the notification policy tree" >&2
    apply_policy_fallback
    api PUT "/api/v1/provisioning/alert-rules/$ALERT_RULE_UID" "$no_policy" > /dev/null
    echo "alert rule $ALERT_RULE_UID applied (policy-tree routing; no rule-level receiver)"
  else
    loud_api_failure "PUT /api/v1/provisioning/alert-rules/$ALERT_RULE_UID"
  fi
}

cmd_apply_alert() {
  if ! require_env; then
    echo "apply-alert aborted: missing environment (see ::error:: lines above)" >&2
    exit 1
  fi
  # Loud guard BEFORE any network call: the recipient is repo-variable
  # ALERT_EMAIL (owner-confirmed). Guard applies to this subcommand only.
  if [[ -z "${ALERT_EMAIL:-}" ]]; then
    echo "::error::ALERT_EMAIL is not set — the contact point needs the owner-confirmed recipient (GitHub repo variable ALERT_EMAIL; locally: export ALERT_EMAIL=owner@example.invalid)" >&2
    exit 1
  fi
  ensure_alert_folder
  upsert_contact_point
  upsert_alert_rule
  echo "apply-alert complete (idempotent: fixed uids — re-running updates in place, never duplicates)"
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
        if self.path == "/api/v1/provisioning/folders/ccr-alerts":
            if self._mode401500(self._mode()):
                return
            if (state / "folder_created").exists():
                self._send(200, {"uid": "ccr-alerts", "title": "ccr-alerts"})
            else:
                self._send(404, {"message": "folder not found (mock 404 body)"})
            return
        if self.path == "/api/v1/provisioning/policies":
            if self._mode401500(self._mode()):
                return
            self._send(200, {"apiVersion": 1, "policies": [
                {"receiver": "grafana-default-email"}]})
            return
        self._send(404, {"message": "not found"})

    def _record(self, body):
        with (state / "provisioning_bodies.jsonl").open("a") as fh:
            fh.write(f"{self.method} {self.path} {body}\n")

    def _mode401500(self, mode):
        # Sends the error and returns True when the mode asks for it.
        if mode in ("401", "500"):
            msg = ("invalid token (mock 401 body)" if mode == "401"
                   else "internal error (mock 500 body)")
            self._send(int(mode), {"message": msg})
            return True
        return False

    def do_POST(self):
        self.method = "POST"
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
        n = int(self.headers.get("Content-Length") or 0)
        body = self.rfile.read(n).decode() if n else "{}"
        self._record(body)
        if self._mode401500(self._mode()):
            return
        if self.path == "/api/v1/provisioning/folders":
            (state / "folder_created").write_text("1")
            self._send(200, {"uid": "ccr-alerts", "title": "ccr-alerts"})
            return
        if self.path == "/api/v1/provisioning/contact-points":
            (state / "cp_created").write_text("1")
            self._send(201, {"uid": json.loads(body).get("uid", "?"),
                             "message": "contact point created (mock)"})
            return
        if self.path == "/api/v1/provisioning/alert-rules":
            (state / "rule_created").write_text("1")
            self._send(201, {"uid": json.loads(body).get("uid", "?")})
            return
        self._send(404, {"message": "not found"})

    def do_PUT(self):
        self.method = "PUT"
        n = int(self.headers.get("Content-Length") or 0)
        body = self.rfile.read(n).decode() if n else "{}"
        self._record(body)
        if self._mode401500(self._mode()):
            return
        if self.path == "/api/v1/provisioning/contact-points/ccr-owner-email":
            if not (state / "cp_created").exists():
                self._send(404, {"message": "contact point not found (mock 404 body)"})
            else:
                self._send(200, {"uid": "ccr-owner-email",
                                 "message": "contact point updated (mock)"})
            return
        if self.path == "/api/v1/provisioning/alert-rules/ccr-5xx-user-impact":
            if not (state / "rule_created").exists():
                self._send(404, {"message": "alert rule not found (mock 404 body)"})
            else:
                self._send(200, {"uid": "ccr-5xx-user-impact"})
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

# run_apply_alert_against_mock — same for `apply-alert` (#59), with the
# recipient env the contact-point guard requires.
run_apply_alert_against_mock() {
  APPLY_ALERT_OUT="$(GRAFANA_URL="$MOCK_URL" GRAFANA_SA_TOKEN="dry-run-dummy-not-a-secret" \
    ALERT_EMAIL="owner@example.invalid" \
    bash "$SELF" apply-alert 2>&1)" && APPLY_ALERT_RC=0 || APPLY_ALERT_RC=$?
}

cmd_validate() {
  trap cleanup EXIT
  local f err

  echo "== grafana-apply validate (offline) =="
  err="$(mktemp /tmp/grafana-apply-validate.XXXXXX)"

  # -- 1. JSON sanity (python) ----------------------------------------------
  # Narrowed to *-dashboard.json (#59): the alert rule has its own sanity
  # block below (different shape — no panels).
  for f in "$GRAFANA_DIR"/*-dashboard.json; do
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

  # -- 1b. alert rule sanity (#59): frozen semantics only --------------------
  if python3 -c "
import json, sys
d = json.load(open(sys.argv[1]))
assert d['uid'] == 'ccr-5xx-user-impact', d.get('uid')
assert d['title'] == 'HTTP 5xx — user impact (CCR)', d.get('title')
assert d['folderUid'] == 'ccr-alerts', d.get('folderUid')
assert d['ruleGroup'] == 'ccr-user-impact', d.get('ruleGroup')
assert d['for'] == '2m', d.get('for')
assert d['noDataState'] == 'OK', d.get('noDataState')
assert d['execErrState'] == 'Error', d.get('execErrState')
assert isinstance(d['data'], list) and len(d['data']) == 2, d.get('data')
assert d['notification_settings']['receiver'] == 'ccr-owner-email', d.get('notification_settings')
" "$GRAFANA_DIR/alert-rule.json" 2> "$err"; then
    pass "alert sane: uid ccr-5xx-user-impact, folder ccr-alerts, for=2m, noDataState=OK, 2 query nodes, rule-level receiver ccr-owner-email"
  else
    fail "alert insane: $(cat "$err")"
  fi

  # -- 2. jq structural checks ----------------------------------------------
  # Narrowed to *-dashboard.json (#59) — the alert rule has no panels.
  for f in "$GRAFANA_DIR"/*-dashboard.json; do
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
  # both-environments check: dashboard-only (#59) — the alert rule's env
  # naming is asserted per-instance in its own block below.
  for f in "$GRAFANA_DIR"/*-dashboard.json; do
    if jq -e '[.templating.list[] | select(.name == "env")]
      | length == 1 and .[0].query == "dev,prod" and .[0].includeAll == true and .[0].multi == true' "$f" > /dev/null \
      && jq -e 'all(.panels[]; all(.targets[]; ((.expr // .query // "") | test("deployment[._]environment[._]name"))))' "$f" > /dev/null; then
      pass "both-environments: $(basename "$f") env var is multi dev+prod (includeAll) and every target filters deployment_environment_name"
    else
      fail "both-environments: $(basename "$f") env variable or target filters wrong"
    fi
  done

  # constants are load-bearing: dashboards must use exactly these
  # (dashboard-only glob, #59: the alert rule's refs have their own check)
  if jq -e --arg p "$DS_PROM" --arg l "$DS_LOGS" --arg t "$DS_TRACES" '
    ([((.. | objects | .datasource // empty) | .uid // empty),
      (.. | objects | .datasourceUid // empty)]
     | map(select(length > 0)) | unique) - [$p, $l, $t] | length == 0' \
    "$GRAFANA_DIR"/*-dashboard.json > /dev/null; then
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

  # -- 2c. alert rule semantics (#59) — the frozen parts ----------------------
  ALERT_JSON="$GRAFANA_DIR/alert-rule.json"
  if [[ -f "$ALERT_JSON" ]]; then
    # datasource refs: the pinned Prometheus datasource + the server-side
    # expression node (__expr__) — nothing else.
    if jq -e --arg p "$DS_PROM" '
      [.data[].datasourceUid] == [$p, "__expr__"]' "$ALERT_JSON" > /dev/null; then
      pass "alert constants: rule datasources are exactly [$DS_PROM, __expr__]"
    else
      fail "alert constants: rule datasource refs wrong (expected [$DS_PROM, __expr__])"
    fi
    # the query: per-env 5xx rate on the pinned metric stem, threshold >0 in
    # the expression node (≡ the issue's `> 0` expression).
    if jq -e --arg m "${METRIC_HTTP}_count" '
      (.data[0].model.expr | startswith("sum by (deployment_environment_name) (rate("))
      and (.data[0].model.expr | contains($m))
      and (.data[0].model.expr | contains("http_response_status_code=~\"5..\"}[5m]))"))
      and (.data[0].model.expr | contains("deployment_environment_name"))
      and .data[0].model.instant == true
      and .data[0].relativeTimeRange.from == 300
      and .data[0].relativeTimeRange.to == 0
      and .data[1].model.type == "threshold"
      and .data[1].model.expression == "A"
      and .data[1].model.conditions[0].evaluator.type == "gt"
      and .data[1].model.conditions[0].evaluator.params == [0]' "$ALERT_JSON" > /dev/null; then
      pass "alert semantics: sum by (deployment_environment_name)(rate(${METRIC_HTTP}_count{http_response_status_code=~\"5..\"}[5m])) > 0"
    else
      fail "alert semantics: the 5xx rate query / threshold>0 node is wrong"
    fi
    # env naming + summary + runbook anchor: the AC's per-instance rendering.
    if jq -e '
      .labels.environment == "{{ $labels.deployment_environment_name }}"
      and .labels.team == "ccr"
      and (.annotations.summary == "5xx on {{ $labels.deployment_environment_name }} — user impact")
      and (.annotations.runbook_url | endswith("docs/runbook.md#alert-fired--what-to-do"))' "$ALERT_JSON" > /dev/null; then
      pass "alert naming: label environment + summary template the per-instance env; runbook_url anchors docs/runbook.md#alert-fired--what-to-do"
    else
      fail "alert naming: environment templating in labels/summary or the runbook_url anchor is wrong"
    fi
    if grep -qF "${METRIC_HTTP}_count" "$ALERT_JSON" && grep -qF "$DS_PROM" "$ALERT_JSON"; then
      pass "alert constants: metric stem ${METRIC_HTTP}_count + datasource $DS_PROM present in alert-rule.json"
    else
      fail "alert constants: metric stem or Prometheus datasource missing from alert-rule.json"
    fi
  else
    fail "alert file: $ALERT_JSON missing"
  fi

  # -- 3. no-customer-data greps --------------------------------------------
  # (glob *.json deliberately UN-narrowed, #59: alert-rule.json is covered too
  # — aggregated counts only, the summary/labels carry env names, never users)
  if jq -r '.. | strings' "$GRAFANA_DIR"/*.json | grep -En '(^|[^_[:alnum:]])(name|player|user)="[^"]+"'; then
    fail "no-customer-data: a quoted literal name/player/user value appears above (leaderboard names must never enter dashboards or alerts)"
  else
    pass "no-customer-data: zero quoted name/player/user literals across all dashboard+alert strings"
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

    # -- apply-alert round-trip (#59): success + 401/500 loud paths ----------
    echo "-- mock apply-alert round-trip (provisioning endpoints: folder, contact point, rule)"
    rm -f "$MOCK_STATE/provisioning_bodies.jsonl"
    run_apply_alert_against_mock
    if [[ "$APPLY_ALERT_RC" == 0 ]] \
      && grep -qF 'folder ccr-alerts created' <<< "$APPLY_ALERT_OUT" \
      && grep -qF 'contact point ccr-owner-email created (email: owner@example.invalid)' <<< "$APPLY_ALERT_OUT" \
      && grep -qF 'alert rule ccr-5xx-user-impact created (rule-level receiver ccr-owner-email)' <<< "$APPLY_ALERT_OUT"; then
      pass "mock apply-alert (200/201): folder + contact point + rule provisioned by uid"
    else
      fail "mock apply-alert (200/201): unexpected — rc=$APPLY_ALERT_RC, output:"$'\n'"$APPLY_ALERT_OUT"
    fi
    if [[ -f "$MOCK_STATE/provisioning_bodies.jsonl" ]] \
      && jq -Rse 'split("\n") | map(select(length > 0)
        | capture("^(?<method>PUT|POST) (?<path>/api/v1/provisioning/[^ ]*) (?<body>.*)$"))
        | (length == 5   # folder POST + PUT-404/POST pair for cp and rule
        and any(.[]; .path == "/api/v1/provisioning/folders"
          and ((.body | fromjson) == {"uid": "ccr-alerts", "title": "ccr-alerts"}))
        and any(.[]; .path == "/api/v1/provisioning/contact-points/ccr-owner-email"
          and ((.body | fromjson) | (.uid == "ccr-owner-email" and .type == "email"
                and .settings.addresses == ["owner@example.invalid"])))
        and any(.[]; .path == "/api/v1/provisioning/alert-rules/ccr-5xx-user-impact"
          and ((.body | fromjson) | (.uid == "ccr-5xx-user-impact" and .folderUid == "ccr-alerts"
                and .["for"] == "2m" and .noDataState == "OK"
                and .notification_settings.receiver == "ccr-owner-email"))))' \
      "$MOCK_STATE/provisioning_bodies.jsonl" > /dev/null; then
      pass "mock apply-alert: provisioning bodies carry the fixed uids, the owner email, for=2m + noDataState=OK + rule-level receiver"
    else
      fail "mock apply-alert: recorded provisioning bodies malformed"
    fi
    # second success run: the mock now answers 200 to the PUT probes (uid exists)
    run_apply_alert_against_mock
    if [[ "$APPLY_ALERT_RC" == 0 ]] \
      && grep -qF 'folder ccr-alerts exists' <<< "$APPLY_ALERT_OUT" \
      && grep -qF 'contact point ccr-owner-email updated' <<< "$APPLY_ALERT_OUT" \
      && grep -qF 'alert rule ccr-5xx-user-impact updated' <<< "$APPLY_ALERT_OUT"; then
      pass "mock apply-alert (re-run): idempotent — existing uids PUT-updated in place, nothing duplicated"
    else
      fail "mock apply-alert (re-run): not idempotent — rc=$APPLY_ALERT_RC, output:"$'\n'"$APPLY_ALERT_OUT"
    fi

    printf '401' > "$MOCK_STATE/db_mode"
    run_apply_alert_against_mock
    if [[ "$APPLY_ALERT_RC" != 0 ]] \
      && grep -qF 'HTTP 401' <<< "$APPLY_ALERT_OUT" \
      && grep -qF 'invalid token (mock 401 body)' <<< "$APPLY_ALERT_OUT"; then
      pass "mock apply-alert (401): helper exits non-zero AND prints status + response body"
    else
      fail "mock apply-alert (401): did not fail loudly with the body — rc=$APPLY_ALERT_RC, output:"$'\n'"$APPLY_ALERT_OUT"
    fi

    printf '500' > "$MOCK_STATE/db_mode"
    run_apply_alert_against_mock
    if [[ "$APPLY_ALERT_RC" != 0 ]] \
      && grep -qF 'HTTP 500' <<< "$APPLY_ALERT_OUT" \
      && grep -qF 'internal error (mock 500 body)' <<< "$APPLY_ALERT_OUT"; then
      pass "mock apply-alert (500): helper exits non-zero AND prints status + response body"
    else
      fail "mock apply-alert (500): did not fail loudly with the body — rc=$APPLY_ALERT_RC, output:"$'\n'"$APPLY_ALERT_OUT"
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

  # -- loud guard (#59): apply-alert without ALERT_EMAIL -----------------------
  AGUARD_OUT="$(env -u ALERT_EMAIL GRAFANA_URL="$MOCK_URL" GRAFANA_SA_TOKEN="dry-run-dummy-not-a-secret" \
    bash "$SELF" apply-alert 2>&1)" && AGUARD_RC=0 || AGUARD_RC=$?
  if [[ "$AGUARD_RC" != 0 ]] \
    && grep -q 'ALERT_EMAIL is not set' <<< "$AGUARD_OUT"; then
    pass "guard: apply-alert without ALERT_EMAIL fails loudly (owner-confirmed recipient required, this subcommand only)"
  else
    fail "guard: apply-alert ran without ALERT_EMAIL (rc=$AGUARD_RC) — loud guard missing"
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
  apply-alert) cmd_apply_alert ;;
  validate) cmd_validate ;;
  *) echo "usage: $0 [validate|apply|apply-alert]" >&2; exit 2 ;;
esac
