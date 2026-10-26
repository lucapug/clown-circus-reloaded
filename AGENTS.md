# AGENTS.md

## Project Context

Clown Circus Reloaded is a brownfield reimplementation of [Clown Circus Carnival](https://github.com/lucapug/clown-circus-carnival), my 2025 AI Dev Tools Zoomcamp capstone.

The original repository and the discovery report provide the baseline for understanding the existing game, architecture, and AI-assisted development workflow.

See `_docs/2025-baseline-vs-2026-opportunities.md` before making significant planning or architectural decisions.

## Development Commands

Use `uv` for Python dependency management and `npm` for JavaScript. Useful commands:

Root:

- `npm install` — install root dev dependencies (`concurrently`)
- `npm run dev` — start frontend and backend dev servers together
- `npm run dev:frontend` — start the Vite dev server only
- `npm run dev:backend` — start uvicorn with reload only
- `npm run build` — type-check and build the frontend (`tsc && vite build`)

Frontend (`cd frontend`):

- `npm install`
- `npm run dev` — Vite dev server on http://localhost:5173
- `npm run build` — production build into `frontend/dist/`

**Leaderboard service modes (issue #41):** `VITE_USE_MOCK_LEADERBOARD=1` (set only in `frontend/.env.development`) serves the zero-backend mock — `npm run dev` works with no server; anything else uses the HTTP service. Build/preview and the Compose image default to same-origin `''` (the backend on :8000 serves the bundle). **Live dev:** run the backend (`cd backend && uv run uvicorn app.main:app` — default CORS already allows the :5173 origins) and create `frontend/.env.development.local` (gitignored) with `VITE_USE_MOCK_LEADERBOARD=0` and `VITE_API_BASE_URL=http://127.0.0.1:8000`. `vite.config.ts` has no dev proxy, so same-origin dev fetches would 404 — the explicit base URL is the supported live-dev path.

Backend (`cd backend`):

- `uv sync` — install backend dependencies into `backend/.venv`
- `uv add <PACKAGE-NAME>`
- `uv run uvicorn app.main:app` — serve the API on http://127.0.0.1:8000
- `uv run pytest`
- `uv run python <PYTHON-FILE>`

## Testing

Two commands, from the repo root (prerequisites: Node per `.nvmrc`, `uv`, Docker, bash, curl). **Docker must be running:** on the owner's Mac, Docker Desktop is started manually on demand (not at login) — start it before `test:integration` / `test:e2e`; with the daemon down those checks are reported BLOCKED, never inferred.

- `npm test` — **the unit command.** Runs both unit suites concurrently (`concurrently --kill-others-on-fail`): frontend vitest (`252 passed | 6 skipped` — 5 skips from the env-gated live-integration file plus 1 pre-existing env-gated `replayTrace.cli.test.ts` skip) and backend pytest (`49 passed`). Expected duration: < ~2 min. Both suites are hermetic (jsdom/localStorage mocks; per-test file-based SQLite in `tmp_path`). These gate CI.
- `npm run test:integration` — **the integration command.** Boots the real stack in the isolated Compose project `clown-circus-it` (host ports bound to loopback only: `127.0.0.1:18000` app, `127.0.0.1:15432` Postgres — the dev ports 8000/5173/5432 are never touched), polls `/health`, runs the frontend live-integration battery (`integration.leaderboard.test.ts`, 5 tests) with `LEADERBOARD_INTEGRATION_URL` set by the script itself, then runs the full backend suite (`49 passed`) against the Compose Postgres via `IT_DATABASE_URL`, and tears the stack and its volume down (`down -v` in an EXIT trap, even on failure). Expected duration: ~4–6 min on first run (image build), ~2–4 min warm. Never export `IT_DATABASE_URL` in your shell: the conftest guard refuses non-loopback hosts unless `IT_ALLOW_REMOTE=1` is set. A first-run image build can fail on a registry timeout (`DeadlineExceeded` fetching `ghcr.io/astral-sh/uv` metadata, seen 2026-10-26): pre-pull the Dockerfile base images and re-run.

What "unit vs integration" means here: unit = real service/logic with fake I/O boundaries (mock fetch, SQLite temp files), fast and hermetic; integration = real HTTP over `127.0.0.1` to the real uvicorn/Postgres stack, exercising the #41 env-gated behaviors (§8 offline-queue semantics, lost-response proxy) and Postgres parity for the backend suite — the same 49 tests pass on SQLite (unit default) and Postgres, which is the schema/constraint parity check. CI stays at its current 6-job structure (decision recorded in #45): the integration battery is documented-local-only. Internals: `ops/test-integration.sh`, `ops/docker-compose.test.yml`.

**E2E (issue #46, local-only — no CI job):** `cd frontend && npm run test:e2e` runs the single Playwright happy path (load → play via hooks → game over → submit → leaderboard). One-time setup: `npx playwright install chromium` (Linux/CI: `npx playwright install --with-deps chromium`). The config boots the compose test stack (`clown-circus-e2e`, loopback-only `:18000`/`:15432`, CORS for :4300 via `ops/docker-compose.e2e.yml`) in `globalSetup` and tears it down with `down -v` in `globalTeardown` (fresh DB every run), and serves the Vite **dev** server on **:4300** with `VITE_USE_MOCK_LEADERBOARD=0` + `VITE_API_BASE_URL=http://127.0.0.1:18000` — a DEV build is mandatory because the `window.__game` hooks are DEV-gated and absent from production bundles; never :5173, never `vite preview`. The test drives the game through the hooks (`reset(42)` → `advanceTicks` → `inject` lives 0 → forced game-over), submits a unique per-run name, and asserts the entry on the leaderboard via the real API. Flake budget (plan risk row): one scenario, `retries: 1`, `workers: 1`, no visual assertions; a mechanism check only — gameplay acceptance stays with recorded sessions (qa.md). Warm runs finish in well under a minute; the first-ever run also builds the compose image (minutes). Production gating: `npm run test:prod-gating` rebuilds and greps `dist/assets` for `__game|advanceTicks` — zero matches. Internals: `frontend/playwright.config.ts`, `frontend/e2e/`.

Regularly commit code to Git.

Add verified commands for other components as the project evolves.

## Project Documents

- `_docs/process.md` — working principles and development methodology. Consult before planning or significant development work.
- `_docs/plan.md` — agreed project plan: decisions, rubric mapping, milestones, checkpoints.
- `_docs/backlog.md` — read-only Mermaid map of the issue dependency DAG. GitHub Issues are the canonical backlog; update the map when issues change.
- `_docs/diary.md` — chronological record of activities, decisions, verification, and lessons learned. Update at significant milestones.
- `_docs/2025-baseline-vs-2026-opportunities.md` — discovery findings and development opportunities.
- `docs/course_KB/` — original course materials and reference documents. Consult relevant sources when applying course methodologies.

## Working Principles

- Follow `_docs/process.md` throughout the project.
- Explain significant decisions, alternatives, and trade-offs.
- Distinguish completed work from proposals and planned work.
- Connect relevant engineering practices to the course sources, citing full titles and relevant sections.
- Keep project documentation and the diary consistent with actual work and decisions.