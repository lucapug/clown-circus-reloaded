# Grafana dashboards/alerting-as-code (issues #58/#59, M5 — Observability)

The key user journey (play → game over → submit score → leaderboard) and the
per-environment deploy views live here as committed Grafana dashboard models,
applied to the Grafana Cloud stack through the HTTP API. Metrics, logs and
traces all flow from the same OTLP pipeline (issue #4) into one cloud stack and
share a trace ID — these dashboards are the UI over that. Issue #59 adds the
one user-impact alert (HTTP 5xx per environment) under the same discipline.

## What each dashboard shows

### `journey-dashboard.json` (uid `ccr-journey`)

| Panel | Type | Intent |
|---|---|---|
| Request rate per endpoint | timeseries | Journey shape per env: `GET /` (play) → `POST /scores` (submit) → `GET /scores` (leaderboard), `rate(...count{deployment_environment_name=~"$env"}[$__rate_interval])` |
| p95 duration per endpoint | timeseries | `histogram_quantile(0.95, ...)` over the same auto-instrumented histogram |
| Error rate per endpoint | timeseries | 5xx share of requests per endpoint |
| Journey logs | logs (Loki) | Structured logs for both envs; the `trace_id` field is clickable |
| Recent traces | trace query (Tempo) | TraceQL search filtered by environment |

### `env-version-dashboard.json` (uid `ccr-env-version`)

- Request rate split `by (deployment_environment_name, service_version)` —
  **every deploy appears as a new line** (a new `service_version` value from
  the CD-injected `OTEL_RESOURCE_ATTRIBUTES`).
- A table of the current `service_version` per environment — dev vs prod
  versions readable at a glance.

Both dashboards carry a multi-select `env` variable (`dev,prod`, default
**All**) — every query splits/filters on `deployment_environment_name`, so dev
and prod series are visible side by side.

## The trace-ID correlation story (the Observability core)

Both environments emit OTLP to the same Grafana Cloud stack; the CD pipeline
injects `OTEL_RESOURCE_ATTRIBUTES=deployment.environment.name=<env>,service.version=<shortsha>`,
so every metric series, log line and trace carries the environment and version.
A request produces a trace ID that appears in **all three signals**: the
Prometheus histogram (per-endpoint rate/latency/errors), the structured Loki
log lines, and the Tempo trace.

On the journey dashboard the link is clickable in both directions that matter:
click a log line's `trace_id` → the internal dataLink (`${__value.raw}` →
TraceQL `queryType: traceql`) opens that exact trace in Tempo; the Recent
traces list links to the trace view the same way. Metrics tell you *that*
something happened, the log line tells you *what*, the trace tells you *why* —
same ID.

## Alerting (`alert-rule.json`, issue #59)

| Object | uid | What it is |
|---|---|---|
| Alert rule | `ccr-5xx-user-impact` | One multi-dimension rule: `sum by (deployment_environment_name) (rate(http_server_request_duration_seconds_count{http_response_status_code=~"5.."}[5m])) > 0`, `for: 2m`, evaluated every 1 m, `noDataState: OK`. One alert **instance per environment** — label `environment={{ $labels.deployment_environment_name }}` and the summary (`5xx on … — user impact`) render per instance. |
| Folder | `ccr-alerts` | Holds the rule; also the notification-policy matcher in the fallback path. |
| Contact point | `ccr-owner-email` | Email to `$ALERT_EMAIL` (repo variable — the one owner-confirmed recipient). Provisioned via the API; routing prefers the rule-level `notification_settings.receiver`, with the policy-tree nested branch (`grafana_folder=ccr-alerts`) as the automatic fallback if Grafana rejects it. |

The threshold lives in a server-side expression node (`__expr__`, `gt 0`) —
equivalent to the issue's `> 0`, and it keeps one instance per env. The runbook
entry for fired alerts is `docs/runbook.md` § "Alert fired → what to do"
(the rule's `runbook_url` annotation anchors exactly there).

## Apply (idempotent)

```bash
# Locally (owner): token never leaves your shell/secrets
export GRAFANA_URL="https://<stack>.grafana.net"
export GRAFANA_SA_TOKEN="<service-account token>"
export ALERT_EMAIL="<owner-confirmed recipient>"   # apply-alert only
ops/grafana-apply.sh apply
ops/grafana-apply.sh apply-alert

# Or via Actions (post-merge; the secret lives in GitHub):
gh workflow run grafana-apply.yml && gh run watch
```

`apply` POSTs each dashboard to `/api/dashboards/db` with `overwrite:true` and
a **fixed `uid`** (`ccr-journey` / `ccr-env-version`) — Grafana create-or-
updates in place, so **re-running never duplicates dashboards** (version
increments, no HTTP 412). Every run first prints
`GET /api/datasources | .[].uid` so a datasource-UID mismatch is visible
immediately.

## Where the token lives

**GitHub secret `GRAFANA_SA_TOKEN` only** (repo variable: `GRAFANA_URL`).
Never in the repo, chat, docs or logs. Locally, export it in your shell only.
The workflow passes both to the script exclusively via `env:` bindings.

## Validation boundary

- **Automatable (engineer/QA, no secret needed):**
  `ops/grafana-apply.sh validate` — JSON sanity, structural jq checks
  (every panel has title + datasource uid; the `${__value.raw}` internal
  Tempo dataLink is present; the `env` variable defaults to both
  environments; datasource UIDs/metric stem/TraceQL form match the constants
  at the top of the script), the **no-customer-data greps** (no literal
  `name|player|user="..."` values — leaderboard names must never enter any
  signal; panels aggregate only status codes/latencies/versions), and a
  **localhost mock round-trip** proving `apply` AND `apply-alert` parse
  success and fail loudly printing status+body on 401/500 (the #52 lesson),
  including the ALERT_EMAIL loud guard.
- **First-real-apply verify pass (stated, not invented):** the constants at
  the top of `ops/grafana-apply.sh` — metric stem
  (`http_server_request_duration_seconds`), datasource UIDs
  (`grafanacloud-prom` / `grafanacloud-logs` / `grafanacloud-traces`), and
  the TraceQL attribute form (`resource.deployment.environment.name`) — are
  each a one-constant fix if the stack differs. The same holds for the
  alerting provisioning JSON shapes (rule/contact-point/policy bodies): the
  first real `apply-alert` run settles field-level shapes; HTTP 400 messages
  are the oracle.
- **Only the owner can verify:** the dashboards rendering real data (M6
  evidence screenshot of `ccr-journey` showing **both** `dev` and `prod`
  series), and the real apply returning two HTTP 200 `status:success`
  responses (post-merge `gh workflow run grafana-apply.yml`).
