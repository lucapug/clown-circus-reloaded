[![CI](https://github.com/lucapug/clown-circus-reloaded/actions/workflows/ci.yml/badge.svg)](https://github.com/lucapug/clown-circus-reloaded/actions/workflows/ci.yml)
# Clown Circus Reloaded

**Clown Circus Reloaded** is a brownfield reimplementation of [Clown Circus Carnival](https://github.com/lucapug/clown-circus-carnival), my 2025 capstone project for the first edition of the AI Dev Tools Zoomcamp.

The original game was already an experiment in AI-assisted development, using manually orchestrated LLMs with distinct roles, responsibilities, and boundaries.

One year later, the second edition of the course offers a more mature toolbox for AI-native software engineering. Having studied the course materials and completed all four homework assignments, I want to build on that experience by applying and connecting these practices in a complete project of my own.

The 2025 implementation will serve as a reference and baseline. The game may evolve, with bugs fixed, architectural choices revisited, and new features introduced.

**The project combines two goals:** delivering a successful capstone that meets the course requirements and evaluation rubric, and deepening my practical understanding of AI-native software engineering by applying and evaluating the methodologies presented in the course.

A project diary will document the development process, linking significant engineering decisions and applied techniques to the relevant course materials.

## Run with Docker Compose

Requires [Docker](https://docs.docker.com/get-docker/). This builds the frontend, starts PostgreSQL 15, and serves the API plus the built frontend from a single container on <http://localhost:8000>:

```bash
docker compose up -d --build
curl http://localhost:8000/health   # -> {"status":"ok"}
```

- The app serves the built frontend with an SPA fallback; the API docs are at <http://localhost:8000/docs>.
- The `db` service uses dev-only credentials (`clown:clown`, database `clowncircus`); data persists in the `clowncircus-db` named volume.
- Without `DATABASE_URL` set, the app defaults to a local (ephemeral inside the container) SQLite database.
- Stop and remove everything, including the database volume: `docker compose down -v`

## Testing

From the repo root (requires Node per `frontend/.nvmrc`, `uv`, Docker, bash, curl):

- **`npm test`** — all unit suites in one command (frontend vitest `252 passed | 6 skipped` + backend pytest `49 passed`), hermetic and fast (< ~2 min). This is what CI gates.
- **`npm run test:integration`** — the integration battery against the real stack: boots an isolated Compose project (`clown-circus-it`, loopback-only ports 18000/15432), waits for `/health`, runs the live frontend leaderboard integration tests, runs the full backend suite against the Compose Postgres, then tears everything down — even on failure. ~4–6 min on the first run (image build), ~2–4 min after.

Unit tests use mocked I/O boundaries and per-test SQLite temp files; integration tests exercise real HTTP against the real uvicorn + Postgres stack and prove backend-suite parity on both engines. See AGENTS.md ("Testing") for the full write-up.

## Local development

`cd frontend && npm install && npm run dev` works with zero backend (the leaderboard mock is on in `.env.development`). To play against the live API, run the backend and point Vite at it via a gitignored `frontend/.env.development.local` with `VITE_USE_MOCK_LEADERBOARD=0` and `VITE_API_BASE_URL=http://127.0.0.1:8000` — the normative write-up lives in AGENTS.md ("Leaderboard service modes").