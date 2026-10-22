# Dev-Deploy Runbook — Render + Neon (issue #5, M1)

How to recreate the current dev deployment of Clown Circus Reloaded from
scratch, with no context beyond this document. The deployment described here
is **live** (owner-executed on 2026-10-18); this runbook makes it
reproducible. It documents the platform settings functionally — names,
fields, and placeholders only. **No secret value ever appears in this repo.**

## Prerequisites

- A [Render](https://render.com) account — free tier is sufficient.
- A [Neon](https://neon.tech) account — free plan is sufficient.
- GitHub access to the private repository `lucapug/clown-circus-reloaded`.
  Render requests repo access when the service is created (step 3); approve
  it from the GitHub account that owns the repo.

## Step 1 — Neon: create the Postgres project

1. Sign in to Neon and create a new project named `clown-circus-reloaded`
   (free plan defaults are fine).
2. From the project **Dashboard**, click **Connect** and copy the **pooled**
   connection string (it includes `sslmode=require`).
3. Treat the string as a secret: it lives in the Render environment settings
   (step 2) and the Neon dashboard only. It must never be committed to the
   repo, pasted into prompts, or written into this runbook. In commands and
   docs use the placeholder `<neon-pooled-connection-string>`.

No database layer consumes the URL yet (M3): at this stage integration is
configuration-level only (see "Behavior notes").

## Step 2 — Render: create the Web Service

1. In the Render dashboard, **New → Web Service**, connect the private GitHub
   repo when prompted.
2. Configure the service with these settings:

   | Field | Value |
   | --- | --- |
   | Runtime | **Docker** (repo-root `Dockerfile`, default path) |
   | Branch | `main` |
   | Region | **Frankfurt** |
   | Instance type | **Free** |
   | Docker command | **empty** — the image `CMD` runs: `uvicorn app.main:app --host 0.0.0.0 --port 8000` |
   | Health check path | `/health` |
   | Auto-deploy | **on** (deploys on every push to `main`) |

3. Under **Environment**, add one variable:
   - `DATABASE_URL` = `<neon-pooled-connection-string>` (the pooled string
     from step 1), marked **secret**.
4. Create the service. The first build runs the two-stage repo-root
   `Dockerfile` (node:22-alpine frontend build → python:3.11-slim-bookworm
   runtime with uv 0.9.30, `EXPOSE 8000`) and starts the container.

The service URL is `https://clown-circus-reloaded.onrender.com`.

## Behavior notes

- The backend reads `DATABASE_URL` via `backend/app/config.py`: when set it
  is used verbatim; a `postgres`/`postgresql` scheme makes the startup log
  read `database backend: postgres`. The log line carries only that coarse
  label — no credential fragments.
- Free tier: the service sleeps after ~15 minutes idle. The first request
  wakes it; expect roughly a minute of cold start. The 750 free
  instance-hours/month cover a single always-on free service.
- Cold start latency is accepted as cosmetic (plan §2, decision D6).
- **CD (live workflow, issue #47):** GHCR immutable image tags and
  API-triggered deploys to this dev service are automated — see "Continuous
  deployment (#47)" below. The earlier note (cycles #4/#2 reviewer finding)
  that the CI concurrency group "must be **split**" is **superseded**: the CD
  workflow runs in its own disjoint concurrency group (`cd-dev-main`,
  `cancel-in-progress: false`), so a new CI run can never cancel an in-flight
  deploy and `.github/workflows/ci.yml` is unchanged. Prod promotion and
  monitoring remain #48 (M5).

## Continuous deployment (#47)

Merging to `main` deploys automatically. One workflow does it:
`.github/workflows/cd-dev.yml` (name `CD dev`). The flow in words:

```
push main → CI green → workflow_run (CI completed, branches [main])
  → meta job builds tags (UTC clock + short sha)
  → push-ghcr: build ONCE, push ghcr.io/lucapug/clown-circus-reloaded
      :<YYYYMMDD-HHMMSS-<shortsha>>  (immutable)  +  :main  (moving)
  → deploy-dev: GET /owners → ownerId
      → PATCH service  {image:{ownerId, imagePath}}          (image switch)
      → GET/PUT /env-vars  (OTEL service.version=<shortsha>; all other
        vars — DATABASE_URL above all — preserved byte-for-byte)
      → POST /deploys → poll to "live" (30 x 20 s cap) → poll GET /health
        until the EXACT body {"status":"ok"} (30 x 20 s cap)
  → green; any validation failure goes red
```

### Render API semantics (as implemented for issue #52)

Recorded here because the first configured CD run (2026-10-22) failed with a
Render **HTTP 400** whose error body the old workflow swallowed. These are
the "stated, not invented" facts, verified against `api-docs.render.com`
before the fix:

- **`envVars` is NOT a servicePATCH field.** It exists only on service
  creation. Existing env vars are managed by the bulk endpoint
  `PUT /v1/services/{serviceId}/env-vars`, which REPLACES the whole list —
  so the workflow GETs the current list first and PUTs it back with exactly
  one change (`OTEL_RESOURCE_ATTRIBUTES` gains
  `service.version=<shortsha>`).
- **The GET list shape is wrapped and cursor-paginated:** items are
  `{"cursor": …, "envVar": {"key": …, "value": …}}`; pass the last item's
  `cursor` as the `cursor` query parameter until it comes back null. The
  workflow reduces pages to a plain `[{key, value}]` array with jq.
- **The servicePATCH `image` object requires BOTH `ownerId` and
  `imagePath`**, and the `ownerId` must match the service's owner
  (workspace). The workflow fetches it at run time from `GET /v1/owners`
  with the API key and takes the single returned owner — no new
  secrets/variables needed. If the account ever gains a second owner
  (team), the step fails loudly listing them.
- **The GHCR package must be PUBLIC** — Render pulls it with no registry
  credential configured (deliberate recommendation). A private package
  would additionally need a Render registry credential.
- **Ordering: PATCH image → PUT env-vars → POST deploy → poll `live` →
  `/health`.** Render serializes deploys per service; the PATCH and the
  env-vars PUT can enqueue intermediate auto-deploys, and the later explicit
  POST **supersedes** them (they are canceled). Only the final explicit
  deploy — carrying both the new image and the new environment — must reach
  `live`.
- **Error visibility:** every call uses
  `curl -sS -w '\nHTTP_STATUS:%{http_code}'` into a variable; the status is
  logged WITH Render's response body in the log — no `-f`-and-swallow
  anywhere (that is what turned the first 400 into a mystery). A non-2xx
  fails the step immediately in every step except the deploy-status poll:
  there, a transient api failure (transport or non-2xx) fails only the
  ATTEMPT with the helper's status+body printed (a successful call resets
  the counter), and the step gives up RED on 3 CONSECUTIVE failures or the
  10-min cap; terminal deploy statuses
  (`build_failed`/`update_failed`/`canceled`/`deactivated`) fail it
  immediately. On success paths only env var KEY NAMES are printed — never
  values (`DATABASE_URL` included).

The tag format is deterministic: `YYYYMMDD-HHMMSS-<shortsha>` from the UTC
clock and the `main` commit sha (example: `20261022-141503-1a2b3c4`). The
image digest is printed in both jobs' summaries. The CD workflow uses the
disjoint concurrency group `cd-dev-main` with `cancel-in-progress: false`, so
CI runs can never cancel a running deploy and back-to-back merges queue
(the surplus beyond 1 queued run is dropped — the next push re-triggers).
`ci.yml` is untouched.

### Owner one-time setup (before the first configured deploy)

1. **Render API key**: Render **Account Settings → API Keys → Create API
   Key**. Free tier has no finer scopes — the key is full-account (stated;
   treat it accordingly). Load it as a GitHub secret:
   `gh secret set RENDER_API_KEY` (paste the key when prompted). Never put
   the value anywhere else.
2. **Dev service ID**: find it in the Render dashboard URL of the dev
   service (`srv-…`), then set it as a repo VARIABLE (not a secret — a
   service ID is not credential-like):
   `gh variable set RENDER_DEV_SERVICE_ID --body "srv-…"`.
3. **Flip the dev service from repo-build to image deploys — ONLY AFTER the
   first package exists** (one green `push-ghcr` run on `main`; trigger one
   with `gh workflow run cd-dev.yml --ref main`). In the Render dashboard:
   dev service **Edit → Image source**, set the image URL
   `ghcr.io/lucapug/clown-circus-reloaded:main`, remove the repo/Dockerfile
   source. No registry credentials are needed in Render once the package is
   public (next step). Until this flip, deploys PATCH+POST against the old
   repo-build service and Render deploys from the repo again — which is why
   the flip must follow the first push-ghcr run.
4. **GHCR package visibility → Public**: GitHub → Packages →
   `clown-circus-reloaded` → Package settings → Change visibility → Public
   (recommendation per the issue and the 2026-10-21 owner notes; a private
   package would additionally need a Render registry credential).

### Rollback (one action, two equivalent forms)

Redeploy the previous immutable tag:

- **Click path**: Render dashboard → dev service → **Deploys** → select the
  previous immutable deploy → **Redeploy** (with the image-tag dropdown when
  the service is image-backed).
- **API path**: `PATCH` the service with
  `{"image":{"ownerId":"<owner id from GET /v1/owners>","imagePath":"<previous YYYYMMDD-HHMMSS-<shortsha> tag>"}}`
  (both fields are required — see "Render API semantics" above), then
  `POST /v1/services/<service-id>/deploys` — exactly the workflow's own
  calls. Find previous tags via
  `gh api /users/lucapug/packages/container/clown-circus-reloaded/versions`
  or the `push-ghcr` job summaries.

Rolling back `service.version` is NOT part of the rollback drill: a stale
short sha may appear in metrics after a rollback — accepted for dev.

**GHCR tags are MUTABLE.** The `YYYYMMDD-HHMMSS-<shortsha>` tag is
unique-by-convention only: a re-run of the same commit started in the same
UTC second rebuilds and re-points the same tag. The future prod promotion
(#48) must therefore reference the image **digest** (`sha256:…`, printed in
every `push-ghcr`/`deploy-dev` job summary), never the tag alone.

### Render value-field lessons (from the 2026-10-21 Grafana work)

- **No quotes in Render value fields** — values are stored literally; the
  Grafana snippet form `export VAR="…"` is shell syntax and the quotes become
  data (the `Authorization` header incident class). The workflow constructs
  `OTEL_RESOURCE_ATTRIBUTES` without quotes for this reason.
- **URL-encode Python snippets** when adapting the `OTEL_EXPORTER_OTLP_HEADERS`
  incident class — percent-encoding in the snippet is data the SDK parses.

### Local rehearsal (no Render credentials needed)

`bash ops/cd-dry-run.sh` replays the deploy path against an inline mock
Render API: it checks the immutable-tag format, the exact
`service.version` string in the env-vars PUT body (matching the tag
suffix), the poll-to-`live` loop, and proves the health assert is
exact-byte (it must FAIL on a trailing-space body and on HTTP 503). For
issue #52 it also mocks `GET /owners`, the wrapped cursor-paginated
env-vars list (with a `DATABASE_URL` entry), and the service PATCH, and
asserts: the PATCH body is EXACTLY `{image:{ownerId, imagePath}}` and
nothing else; the env-vars PUT preserves every unrelated key byte-for-byte
while updating ONLY `OTEL_RESOURCE_ATTRIBUTES` (and ADDS it when absent);
and a mocked HTTP 400 makes the api helper exit non-zero WITH the response
body printed. Each of the three #52 checks is mutation-proven — breaking
the PATCH shape, corrupting an unrelated value, or swallowing the error
body flips exactly that check red.

## Rubric note

The live URL `https://clown-circus-reloaded.onrender.com` with a health-validated
endpoint is the evidence for plan §4 criterion 8 (Deployment: public URL,
health-validated). The repository stays private during development and goes
public only at submission (plan §2, decision D11).

## Verification

Run from the repo root.

**AC1 — public URL responds 200:**

```sh
curl -sS -w '\nHTTP %{http_code}\n' https://clown-circus-reloaded.onrender.com/health
```

Expected output:

```
{"status":"ok"}
HTTP 200
```

If the service was idle, the first attempt may take ~1 minute to wake it.

**AC2 — credentials only in platform secrets:**

```sh
grep -rEn 'postgres(ql)?://[^[:space:]]*:[^[:space:]]*@' ops/
```

Expected output: no matches (grep exits 1, prints nothing). The runbook
contains the name `DATABASE_URL` and placeholders only.

Cross-check: in the Render dashboard, the service **Logs** tab at startup
shows the line `database backend: postgres` with no credential fragments.

**AC3 — the runbook exists and is self-contained:**

```sh
test -f ops/dev-deploy-runbook.md
```

Expected: exits 0. A reader with no other context can recreate the deployment
from this document alone: every Render field above matches the agreed
settings, and every command in this section, run verbatim, produces the
stated output.
