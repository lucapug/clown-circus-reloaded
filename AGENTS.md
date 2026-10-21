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