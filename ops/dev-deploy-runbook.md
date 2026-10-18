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
- **M4 future work (context, not scope):** M4 adds GHCR immutable image tags,
  API-triggered deploys, and a prod service. When that CD lands, the CI
  concurrency group must be **split** so deploy jobs don't serialize with
  test jobs (reviewer finding from cycles #4/#2).

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
