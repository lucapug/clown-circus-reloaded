# Runbook — operational procedures

## Alert fired → what to do

The one provisioned alert (uid `ccr-5xx-user-impact`, folder `ccr-alerts`,
rule group `ccr-user-impact`) watches **HTTP 5xx per environment** — direct
user impact: a fired instance means real requests are failing for real
players (e.g. a broken `POST /scores` submission).

**What it watches.** `sum by (deployment_environment_name)
(rate(http_server_request_duration_seconds_count{http_response_status_code=~"5.."}[5m])) > 0`
evaluated every 1 m by Grafana on the `grafanacloud-prom` datasource, with
`for: 2m` (a sustained 5xx rate, not a blip) and `noDataState: OK` (no data
is never paged). One rule, one alert **instance per environment** — the
label `environment` and the summary (`5xx on
{{ $labels.deployment_environment_name }} — user impact`) render per
instance, so a dev-only drill pages/fires exactly the `environment=dev`
instance and prod is untouched.

**First steps (≤ 5 minutes).**

1. Read the instance label/summary: **which** environment (`dev`/`prod`).
2. Open the journey dashboard (`ccr-journey`) filtered to that env — the
   *Error rate per endpoint* panel shows **which** route is failing.
3. Grafana Explore → that env's recent traces/logs for the failing route
   (the log lines carry the `trace_id`; one click opens the trace).
4. Reproduce: `curl -s -o /dev/null -w '%{http_code}\n'
   https://<env-host>/<failing-route>` and watch the backend logs.
5. If the failing request came from the #60 drill: look for the
   `// DRILL #60` marker in the recent commit/deploy notes — a drill injects
   a REAL defect (`POST /scores` → 500) on dev on purpose; skip triage and
   let it run (see below).

**Fire-and-clear proof protocol (issue #59; orchestrator/owner, DEV ONLY).**
The dev instance firing/clearing is the issue's acceptance evidence:

1. `gh workflow run grafana-apply.yml && gh run watch` — `apply` + `apply-alert` both 2xx; a second run is a no-op (same uids).
2. Enable the probe on the Render **dev** service only: add
   `DRILL_PROBE_5XX=1` via the env-vars bulk endpoint (the one cd-dev uses)
   → redeploy dev. The probe route is `GET /__probe/5xx`
   (`# PROBE #59` in `backend/app/main.py`); it reads the env per request
   and answers 500 only when the gate is `1`, 404 otherwise.
3. **Fire**: sustain `for i in $(seq 1 60); do curl -s -o /dev/null -w
   '%{http_code}\n' "https://<dev-host>/__probe/5xx"; sleep 10; done` — long
   enough to cover the 5 m rate window + `for: 2m`. Evidence: the
   `environment=dev` instance reaches **Alerting** in the Grafana UI
   (screenshot) and the owner receives the notification email
   (contact point `ccr-owner-email`).
4. **Clear**: remove `DRILL_PROBE_5XX` → redeploy → the instance returns to
   **Normal** within ~5 m + the `for` drain (screenshot / resolution
   notification).

**Probe vs real defect.** The probe is a controlled trigger for the #59
proof and #60 rehearsals only — it is not a defect and its 500s touch no
data. A #60 drill, in contrast, injects a real defect (breaking
`POST /scores`) to exercise the full triage path. A fired `environment=dev`
instance during a drill window is expected; check the `// DRILL #60` marker
before triaging.

**Probe removal.** Per decision D2 (PM brief #59): the probe merges gated
OFF in the #59 PR, proves fire+clear post-merge on dev, and is then deleted
by a tiny labelled PR (`// PROBE #59` marker greps to zero). It must never
appear in prod env vars or in `.github/workflows/cd-promote.yml`.

**Clear criteria.** The alert resolves itself when the 5xx rate returns to
0 for the drain period — no manual ack needed in Grafana. If the underlying
defect is fixed, verify with the *Error rate per endpoint* panel returning
to 0 and the instance flipping to Normal.
