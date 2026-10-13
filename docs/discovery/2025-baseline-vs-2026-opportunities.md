# Discovery Report — 2025 Baseline vs 2026 Opportunities

**Project:** Clown Circus Reloaded (brownfield reimplementation of Clown Circus Carnival)
**Report date:** 2026-10-13
**Author:** ZCode discovery agent, commissioned by the project diary entry of 2026-10-13 ([`docs/diary.md`](../diary.md))
**Status:** Analysis only. No architectural decisions, no implementation, no changes to existing artifacts.

---

## 1. Executive summary

The 2025 **Clown Circus Carnival** repository is a small but complete AI-assisted capstone: a browser arcade game (React/TypeScript canvas frontend, FastAPI/SQLite leaderboard backend, Docker + Render deployment, 44 automated tests) that was built in roughly **13 days of intensive work (2026-01-02 → 2026-01-14)** by a deliberately designed **multi-AI workflow**: Lovable.dev generated the MVP and owned visuals/sound on a `style` branch, Roo Code (GLM-4.7) owned architecture and API design on a `logic` branch, GitHub Copilot owned implementation and tests, and the human acted as lead, reviewer, and sole merger across **17 pull requests**. This division of labor was documented in branch-aware instruction files (`AGENTS.md`, `frontend/src/AGENTS.md`, Copilot instructions) and partially **enforced in CI** by a guardrails workflow policing branch-merge direction.

The 2026 course's central evolution is not any single tool but the **industrialization of exactly the practices the 2025 project improvised manually**: spec-driven development replaces prompt-only ideation; backlogs with checkable acceptance criteria replace ad-hoc task assignment; PM/Engineer/QA **subagents with isolated contexts and tool restrictions** replace same-context self-review; **hooks** replace politely-asked rules; **loop and graph engineering** replace manual prompt-by-prompt driving; and modules 3–4 add operations depth (dev/prod promotion, observability, AI on-call response, security audits) that the 2025 project never attempted.

The strongest continuities are real: the 2025 project already used AGENTS.md files, CI guardrails, an API-first OpenAPI contract, uv, a single-container deployment, and a Lovable-first frontend — several 2026 modules formalize precisely these habits. The main gaps are equally clear: no product specification or backlog survives in the 2025 repo, no issue tracker was used, testing arrived late (explicitly "to reach full marks in the project rubric"), CI never deployed anything, and there is no observability, security auditing, or agent-extension work. The 2026 rubric (14 criteria, 33 points) explicitly demands the latter two as graded categories that did not exist in the 2025 rubric (12 criteria, 27 points).

---

## 2. Scope, sources, and investigation limitations

### 2.1 Sources inspected

**2025 repository** — [lucapug/clown-circus-carnival](https://github.com/lucapug/clown-circus-carnival), inspected read-only via a temporary clone (all branches: `main`, `logic`, `style`; full history; PR list via GitHub API; repo metadata). Key files examined: `AGENTS.md`, `frontend/src/AGENTS.md`, `docs/ai-usage.md`, `.github/instructions/copilot-instructions.instructions.md`, `.github/workflows/{ci,guardrails}.yml`, `docs/architecture/{backend-design,openapi-spec,api-integration}.md`, `docs/decisions/backend-api.md`, `TESTING.md`, `TEST_COMMANDS.md`, `CI_IMPLEMENTATION.md`, `Dockerfile`, `docker-compose.yml`, `render.yaml`, root and frontend `package.json`, the full backend (`backend/app/*`, `backend/tests/test_api.py`), and the game code (`frontend/src/hooks/useGameEngine.ts`, `frontend/src/types/game.ts`, `frontend/src/utils/scoring.ts`, `frontend/src/components/game/*.tsx`, `frontend/src/lib/api.ts`).

**2026 course knowledge base** — [`docs/course_KB/`](../course_KB/) in this repository:

| File | Content |
|---|---|
| [`01…Zoomcamp 2026 Starts Today.pdf`](../course_KB/01Alexey%20On%20Data%20-%20AI%20Dev%20Tools%20Zoomcamp%202026%20Starts%20Today.pdf) | Course overview: 5 modules, cohort logistics, final-project requirements summary |
| [`02…Specifications, Loop and Graph Engineering.pdf`](../course_KB/02Alexey%20On%20Data%20-%20AI-Native%20Development_%20Specifications%2C%20Loop%20and%20Graph%20Engineering.pdf) | Module 1 companion article (spec-driven dev, context/loop/graph engineering, PM/SWE/QA roles, orchestrator) |
| [`03…Build and Ship a Full-Stack App….pdf`](../course_KB/03Alexey%20On%20Data%20-%20Build%20and%20Ship%20a%20Full-Stack%20App%20with%20AI%20Coding%20Assistants.pdf) | Module 2 companion article (frontend-first, OpenAPI contract, FastAPI backend, SQLite persistence) |
| [`04…Reusable Skills and Specialized Subagents.pdf`](../course_KB/04Alexey%20On%20Data%20-%20Coding%20Agent%20Building%20Blocks_%20Reusable%20Skills%20and%20Specialized%20Subagents.pdf) | Module 5 companion article (skills, subagents, orchestration, worktrees, parallelism) |
| [`05…Deploy a Full-Stack App….pdf`](../course_KB/05Alexey%20On%20Data%20-%20Deploy%20a%20Full-Stack%20App%20with%20AI%20Coding%20Assistants.pdf) | Module 3 companion article (containerization, Postgres, integration/E2E tests, AWS, CI/CD with OIDC) |
| [`06…DevOps and Observability….pdf`](../course_KB/06Alexey%20On%20Data%20-%20DevOps%20and%20Observability%20for%20an%20AI-Built%20App.pdf) | Module 4 companion article (dev/prod, registry-pinned images, OpenTelemetry, alerts, AI on-call) |
| [`07use-claude-code-like-a-pro-webinar/`](../course_KB/07use-claude-code-like-a-pro-webinar/) | External webinar (README + full worksheet): ADLC, layered context, subagent team, hooks, `/task`, `/loop`, MCP, plugins, token-usage tooling |
| [`project_requirements.html`](../course_KB/project_requirements.html) | Local snapshot of the DataTalks.Club docs "Project" page |
| [`project_rubric_2026.url`](../course_KB/project_rubric_2026.url) | Internet shortcut → course repo `project/` folder |

**Online sources resolved during this discovery:**

- `.url` target [github.com/DataTalksClub/ai-dev-tools-zoomcamp/tree/main/project](https://github.com/DataTalksClub/ai-dev-tools-zoomcamp/tree/main/project) — **accessed**; contains the (draft) 2026 project README with the 14-criterion / 33-point rubric and expected repository contents.
- Archived 2025 project page [cohorts/2025/project](https://github.com/DataTalksClub/ai-dev-tools-zoomcamp/tree/main/cohorts/2025/project) — **accessed**; 12-criterion / 27-point rubric, for comparison.
- Live docs page of the local HTML snapshot ([datatalks.club/docs/courses/ai-dev-tools-zoomcamp/project/](https://datatalks.club/docs/courses/ai-dev-tools-zoomcamp/project/), redirects to `datatalksclub.github.io`) — **accessed**; content matches the local snapshot in substance. No discrepancy found.
- 2025 production deployment `https://circus-app.onrender.com` — **timed out on all endpoints (health, root, leaderboard)** on 2026-10-13. The app is offline; consistent with a free-tier Render service months after the cohort. Runtime verification of 2025 behavior is therefore impossible; the code and tests are the only behavioral reference.

### 2.2 Missing or inaccessible material

- The webinar folder's README references `slides/index.html` and a `starter` project ("starter project with all the agents, hooks etc."). **Neither exists in `docs/course_KB/07…/`** — only `README.md` and `worksheet.md` are present. The subagent/hook/skill definitions quoted in the worksheet could not be cross-checked against the starter code.
- The course module folders, recordings, and the four homework submissions mentioned in this repo's README were **not part of this discovery** (not in the KB, and out of scope).
- 2025-era artifacts that never existed in the repo cannot be recovered: Lovable prompt history, Roo Code / Copilot session transcripts, peer-review feedback on the 2025 capstone.

### 2.3 Method and labeling

The 2025 repository was reconstructed from committed code, documentation, branch structure, commit metadata (authors, dates, prefixes), and the PR list. Statements below are labeled: **[F]** fact (directly evidenced), **[I]** interpretation (reasonable inference, flagged as such), **[U]** unknown. Course-derived statements cite the KB file they come from; anything else is my analysis.

---

## 3. Product reconstruction (2025)

### 3.1 Concept

**[F]** A modern web remake of the arcade games *Circus* (Exidy, 1977) and *Clowns* (Midway, 1978) — a "clown-and-balloons" seesaw game — wrapped in a full-stack web application with a shared, persistent leaderboard ([README](https://github.com/lucapug/clown-circus-carnival), [`docs/ai-usage.md`](https://github.com/lucapug/clown-circus-carnival/blob/main/docs/ai-usage.md)).

### 3.2 Mechanics and rules (from code)

All facts below are read from [`frontend/src/hooks/useGameEngine.ts`](https://github.com/lucapug/clown-circus-carnival/blob/main/frontend/src/hooks/useGameEngine.ts) and [`frontend/src/types/game.ts`](https://github.com/lucapug/clown-circus-carnival/blob/main/frontend/src/types/game.ts):

- **Playfield:** 800×600 canvas. A seesaw at the bottom is moved by the **mouse**; the clown is launched by **click or SPACE** (controls confirmed in [`CircusGame.tsx`](https://github.com/lucapug/clown-circus-carnival/blob/main/frontend/src/components/game/CircusGame.tsx) and its footer text).
- **Balloon grid:** 4 rows × 14 balloons. Rows are colored bottom→top `yellow, green, green, blue` with per-balloon points 20 / 50 / 50 / 100; row-clear bonuses 200 / 500 / 500 / 1000. **Only a blue-row clear grants a bonus jump.**
- **Clown lifecycle:** two clowns exist — one on the seesaw, one on a side diving board. Launching sends a clown flying under gravity with randomized horizontal velocity; the clown pops any balloon it touches, bounces off side walls (0.8 damping) and off the four mid-screen **diving boards, which act as trampolines** (0.9 damping).
- **Seesaw landing zones:** landing on a seesaw **edge** scores 10 points and launches the clown sitting on the other side; landing on the **middle**, on an **occupied edge**, or **falling off screen** costs a life ("SPLAT!").
- **Lives and levels:** start with 3; each level clear (all balloons popped) regenerates the grid, awards +1 life, and increases the horizontal-velocity multiplier by 25% per level.
- **Progressive difficulty:** launch velocity strengthens from −14 toward −17 in 0.2 increments per successful bounce, resetting on death.
- **Meta-game:** HUD (score, lives, bonus jumps); start screen and game-over screen both show the leaderboard; on game over the player enters a name (≤10 chars) and submits the score to the backend.
- **Audio:** all sounds are synthesized at runtime with Web Audio API oscillators — no audio assets ([`useAudio.ts`](https://github.com/lucapug/clown-circus-carnival/blob/main/frontend/src/hooks/useAudio.ts)). The game-over jingle is a sequenced Chopin Funeral March (PR #2, "Style: improve Game Over jingle (Chopin Funeral March)").

### 3.3 User-facing behavior, documentation, demos, tests

- **[F]** Documentation: an extensive README (goals, AI workflow, architecture, dev/setup, testing, CI, API reference, deployment, troubleshooting), backend README, architecture docs, one ADR, and three process docs (`TESTING.md`, `TEST_COMMANDS.md`, `CI_IMPLEMENTATION.md`).
- **[F]** Tests as behavior evidence: 22 Vitest tests over pure scoring/state logic and 22 pytest API tests (validation, ordering, limits, integration) — detailed in [`TESTING.md`](https://github.com/lucapug/clown-circus-carnival/blob/main/TESTING.md).
- **[F]** No screenshots, demo video, or playable deployment survive in the repo; the Render URL in the README is dead (verified above).

### 3.4 Limitations, bugs, incomplete features **[I unless noted]**

- **`bonusJumps` is a dead-end mechanic [F]:** it is incremented on blue-row clears and displayed in the HUD (`GameHUD.tsx`), but **no code ever consumes it** (verified by grep across `frontend/src`). The advertised mechanic does nothing.
- **Documented-as-unfinished [F]:** README "Current status" lists "Gameplay refinement and logic improvements (in progress)"; the final three merges (PRs #15–#17, 2026-01-14) are all game-logic bug fixes ("game logic fixes", "fix game logic bug", "fix bug in new level"), i.e. logic bugs were still being found on the last day of the cohort. The specific defects these commits fixed are not described anywhere [U].
- **ADR promise not kept [F]:** the ADR says the frontend should "implement fallback to localStorage if API is unavailable", but `CircusGame.tsx` merely logs fetch errors and leaves an empty leaderboard — no fallback exists.
- **Template residue [F]:** `frontend/index.html` still has `<title>Lovable App</title>`; `frontend/package.json` name is `vite_react_shadcn_ts`; ~40 unused shadcn/ui components and their dependencies ship with the app (Lovable template surface).
- **Input model [F]:** mouse + keyboard only; no touch handling — the game is effectively desktop-only.
- **Physics-loop coupling [I]:** the game loop drives React `setState` per animation frame and mutates velocity via the map over clowns; this is workable for the MVP but concentrates all rules in one ~500-line hook, which is consistent with where the late bugs clustered.

---

## 4. Architecture and implementation baseline (2025)

### 4.1 Stack and structure **[F]**

- **Frontend** (`/frontend`): React 18 + TypeScript + Vite 5, Tailwind CSS, shadcn/ui; canvas-2D rendering in `GameCanvas.tsx`; game state in the `useGameEngine` hook (React state + `requestAnimationFrame`); pure scoring logic extracted to `utils/scoring.ts` (explicitly "No side effects… for testing"); API access via a tiny env-driven base-URL helper (`lib/api.ts`) plus `fetch` calls in `CircusGame.tsx`.
- **Backend** (`/backend`): Python 3.11 + FastAPI + Pydantic v2 + SQLAlchemy; app factory (`create_app`); configurable engine (`DATABASE_URL` → Postgres, else SQLite file); single `scores` table with a descending score index.
- **API** (contract in [`docs/architecture/openapi-spec.md`](https://github.com/lucapug/clown-circus-carnival/blob/main/docs/architecture/openapi-spec.md), implemented in [`backend/app/main.py`](https://github.com/lucapug/clown-circus-carnival/blob/main/backend/app/main.py)):
  - `GET /health` → `{"status": "ok"}`
  - `POST /scores` → 201; `name` 1–10 chars alphanumeric+spaces (regex), `score` ≥ 0
  - `GET /leaderboard?limit=1..100` (default 10) → ranked entries, score-desc, `created_at`-asc tie-break
  - Auto-generated OpenAPI/Swagger at `/docs`
- **Serving model:** in containerized deployment the FastAPI app serves the built frontend from `frontend/dist` with an SPA fallback — single container, single origin.

### 4.2 Build, deployment, CI/CD **[F]**

- **Local dev:** root `npm run dev` (concurrently: Vite + uvicorn); backend via `uv` (`uv sync`, `uv run uvicorn`).
- **Containers:** multi-stage `Dockerfile` (Node build stage → Python/uv runtime with frontend dist copied in); `docker-compose.yml` with Postgres 15 + backend + a dev frontend container and healthcheck.
- **Cloud:** `render.yaml` — one Docker web service (`circus-app`, free tier, `/health` health check) + free managed Postgres. **[I]** The README's Render section still describes an earlier three-service blueprint (`circus-frontend` static site + `circus-backend` + `circus_db`); commit `3db8992` "refactor: simplify Render config to single-container deployment" explains the drift — documentation lagged the refactor.
- **CI (`.github/workflows/ci.yml`):** on push/PR to `main`/`logic`/`style` — frontend Vitest (Node 22), backend pytest (Python 3.11 via uv), plus a Docker build sanity job. **No CD**: nothing deploys automatically; Render deployment was manual. **[F]**
- **Guardrails (`.github/workflows/guardrails.yml`):** on PRs — structural checks (required files/dirs exist), **hard rules** on merge direction (main never into feature branches; `style` ⇄ `logic` forbidden), **soft warning** if the `style` branch touches game-logic files. **[F]**

### 4.3 Testing strategy **[F]**

44 tests, all passing per `TESTING.md`: 22 frontend (pure logic only — no UI/canvas tests) and 22 backend (in-memory SQLite, per-test fresh DB). There are no frontend↔backend seam tests, no E2E tests, no visual/behavioral tests of gameplay. Tests were added on 2026-01-13, eleven days into the thirteen-day build (commits `d8be982`, `0100cc2`), and `TESTING.md` states the goal openly: "the automated tests added **to reach full marks in the project rubric**".

### 4.4 Constraints and insufficiencies in the evidence

- **[U]** Runtime qualities (performance, real-device behavior, audio latency) are unevidenced — the deployment is gone and no recordings survive.
- **[U]** The Postgres path was exercised only via Docker Compose/Render config; no Postgres-specific tests exist.
- **[I]** The hand-written `openapi-spec.md` and FastAPI's generated spec were kept in sync manually; drift between them was policed only by review.

---

## 5. The 2025 AI-assisted development workflow (reconstruction)

### 5.1 Documented division of labor **[F]**

From [`AGENTS.md`](https://github.com/lucapug/clown-circus-carnival/blob/main/AGENTS.md), [`frontend/src/AGENTS.md`](https://github.com/lucapug/clown-circus-carnival/blob/main/frontend/src/AGENTS.md), [`docs/ai-usage.md`](https://github.com/lucapug/clown-circus-carnival/blob/main/docs/ai-usage.md), and [`.github/instructions/copilot-instructions.instructions.md`](https://github.com/lucapug/clown-circus-carnival/blob/main/.github/instructions/copilot-instructions.instructions.md):

| Tool / role | Responsibility | Branch | Evidence in history |
|---|---|---|---|
| **Lovable.dev** | AI-generated MVP; then UI styling, animations, sound refinement only | `style` | 38 commits by `gpt-engineer-app[bot]` + 1 `Lovable` template commit; terse "Changes" sync commits alongside descriptive ones ("Implement Circus Clowns MVP", "Add rainbow circus visuals", "Improve game over sound") |
| **Roo Code (GLM-4.7)** | Architectural reasoning, backend/API design, refactoring proposals, documentation | `logic` | commits prefixed `roo:` (e.g. `314b08a` "roo: architectural docs backend api specs") |
| **GitHub Copilot** | Code-level implementation, incremental changes, tests; on `main` a "documentation steward" | `logic`, `main` | commits prefixed `Copilot:` (backend scaffold → data layer → routes → API tests) and `GH Writer Assistant:` (docs on main) |
| **Human (project lead)** | Governance, review, integration, all merges | all | commits prefixed `lead:` ("added rules about exchanges between branches"), all 17 PR merges authored by the human |

The boundary discipline was explicit: the frontend `AGENTS.md` tells assistants what they are **NOT** responsible for (visuals vs logic), requires reading `/docs/` before any change, requires behavioral changes to be recorded in `docs/decisions/`, and states "If documentation and existing code conflict, documentation takes precedence." The Copilot instructions are branch-aware (different allowed actions per branch) and encode the human-in-the-loop rule: "Copilot is an assistant, not an autonomous agent… All commits must be explicitly approved by the human project lead."

### 5.2 Human orchestration **[F]**

All integration flowed through **17 PRs** into `main` (16 from `logic`, 2 from `style` — one PR was `main`→`logic`, see 5.4). The commit timeline shows phase-based orchestration: MVP via Lovable (Jan 2–3) → governance/docs scaffolding (Jan 5–6) → backend by Copilot in incremental commits (Jan 8–9) → repo restructuring, containerization, deployment (Jan 10) → style polish (Jan 11) → CI + tests + docs (Jan 13) → bug fixes (Jan 14).

### 5.3 Guardrails and instructions **[F]**

Three layers existed: (1) markdown instructions (`AGENTS.md` ×2, branch-aware Copilot instructions, `docs/ai-usage.md`); (2) documented merge rules ("main must not merge into feature branches; style and logic must not merge into each other"); (3) CI enforcement of those rules in `guardrails.yml`, plus a soft warning when style touched logic files. The 2025 project also mandated isolated environments (Codespaces or `uv`) for AI assistants.

### 5.4 Anomalies and frictions (evidence vs rules) **[F with I]**

- **PR #9 merged `main` → `logic`** on 2026-01-10 — exactly what the documented rules forbid — followed the next day by commit `ff8f7d6` "lead: added rules about exchanges between branches". **[I]** Reading the sequence, the rule was codified (and later CI-enforced) *after* the friction it addresses actually occurred: governance emerged reactively.
- **Repo creation date (2026-01-03, GitHub API) predates nothing, yet the template commit is dated 2025-01-01.** **[U]** The most plausible explanation is a misdated Lovable template import (the project appears to have been dormant for a year between template and MVP), but this cannot be confirmed from the repository alone.
- **No issue tracker, no backlog artifact, no product spec** ever entered the repo; planning lived in the Lovable chat and in the human's head. The 2025 README's own "AI-assisted development workflow" section is the closest thing to a process document. **[F]**
- **Testing was an afterthought driven by the rubric** (`TESTING.md`'s own words), arriving after deployment rather than gating it. **[F]**
- The 2025 rubric's AI criterion ("AI system development (tools, workflow, MCP)") awarded top marks for MCP use; **no MCP artifact exists anywhere in the 2025 repository**. **[F/U]** Whether MCP was used outside the repo, or the criterion was simply not fully met, is unknown.

### 5.5 What the 2025 workflow got right **[I]**

Non-overlapping tool responsibilities mapped to branches; instructions-as-documentation under version control; CI-enforced structural guardrails; documentation-over-code precedence; explicit human approval gates; PR-based review of all AI output. In modern course vocabulary, the 2025 project had role separation, project instructions, and structural guardrails — it was a genuine multi-agent (multi-tool) experiment with a human orchestrator, not a single-chat Copilot project.

### 5.6 What remained manual **[F/I]**

Task creation and assignment, sequencing, context provisioning per session, verification of gameplay (manual play), merging, and deployment. Nothing ran unattended; there were no loops, no subagent isolation within one harness (each tool was its own silo instead), no hooks, and no automated acceptance checking beyond the late test suites.

---

## 6. Relevant 2026 course practices (by module)

Terminology below preserves the source materials' framing. All statements in this section are course-derived, cited to KB files; anything beyond them is mine and marked.

### Module 1 — AI-Native Developer Workflow (KB 02)

- **Spec-driven development:** brainstorm the idea with a chat assistant ("ask me one question at a time"), save `plan.md`, commit early and often; the article's cautionary example is a one-prompt app that "works perfectly, but that's far from what I needed."
- **Backlog and issues:** decompose the spec into tasks "small enough to finish in one session, independent enough to hand to someone who has not read the others"; move to GitHub issues, which become "the canonical tasks and the only active backlog."
- **Context engineering:** `AGENTS.md` as always-on context (commands + rules), `CLAUDE.md` containing a single `@AGENTS.md` pointer for tool-agnosticism, plus linked living documents loaded only when relevant (`_docs/process.md`, `testing-guidelines.md`, `design-system.md`, `api.md`). Framed as the contrast to prompt engineering: control "what agents know when they start a new session."
- **Grooming (PM agent):** rewrite each task into four sections — Goal, Acceptance criteria ("checkable by looking at the result"), Out of scope (with follow-up issues), Constraints; "an engineer who has never spoken to you could implement it from the issue."
- **Loop engineering:** `/goal`-style harness loops with **checkable stop conditions** ("all issues are groomed", "all tests pass" — not "make the code better"); the harness, not the human, resumes the agent.
- **Graph engineering:** PM → SWE → QA as a graph with a FAIL edge back to the engineer; an **orchestrator** (the main session) enforces the lifecycle and its rules (engineer never closes the issue; QA never fixes; orchestrator closes only after QA PASS). The course explicitly warns this "takes significantly more time and tokens… often a simple prompt or loop is enough."
- Four levels named: prompt → context → loop → graph engineering.

### Module 2 — Build and Ship a Full-Stack App (KB 03)

- **Frontend-first with a mocked service layer:** generate the frontend (Lovable named explicitly, as in 2025) with the instruction "centralize every backend call in one services layer, and create a mock implementation."
- **OpenAPI as the contract:** derive `openapi.yaml` *from the frontend's service layer*, then implement the backend against it ("the backend gets a precise target instead of being inferred from frontend code").
- **Mock-first backend:** in-memory store first, then replace with SQLite + SQLAlchemy, explicitly requesting database-agnostic code so Postgres can come later.
- **Step-by-step approach:** each step ends with something runnable and manually verified; a Makefile for runnability; AGENTS.md grown alongside.

### Module 3 — Test, Containerize, Deploy (KB 05)

- **Single-container pattern:** backend serves the built frontend (exactly the 2025 end-state); named Docker volume for SQLite data.
- **SQLite → Postgres** via the SQLAlchemy foundation laid in module 2; Docker Compose with a healthcheck-gated app.
- **Integration tests against Compose** and **Playwright end-to-end tests** (the "two-session test" — a scripted multi-client verification made automatic).
- **Deployment:** AWS via CloudFormation this year; the article notes "**Last year we deployed to Render**" — a direct bridge to the 2025 baseline.
- **CI/CD:** GitHub Actions running unit/integration/E2E tests in parallel, building containers, deploying via a **GitHub OIDC role** (no long-lived admin credentials), and **validating the deploy via the health endpoint**.

### Module 4 — DevOps and Observability (KB 06)

- **Dev + prod environments** with a **manual promotion** workflow; infrastructure-as-code reuse.
- **Build/deploy split** through a container registry (ECR) with immutable tags (`YYYYMMDD-HHMMSS-shortsha`) so promotion ships the *identical* tested image; building on the instance named as an anti-pattern.
- **Observability:** OpenTelemetry instrumentation (metrics/logs/traces over OTLP, auto-instrumentation for FastAPI), an OTel Collector feeding Prometheus/Loki/Tempo/Grafana as a separate Compose stack, application-specific metrics, Grafana dashboards filterable by environment and version.
- **Alerting:** "an actionable alert… use a threshold and duration that represent real user impact," including service, environment, version, owner, dashboard URL.
- **AI as on-call engineer:** a script polls the alert API and starts a headless coding-agent session with the prompt "Investigate the root cause… make the smallest correction… If the alert is a false positive, explain why and do not change the code"; tested by asking an agent to **introduce a realistic bug** that passes existing tests.
- **Hardening guidance:** rollbacks, managed databases, tested backups, private subnets, and recurring **security audits** by strong models ("Ask Fable or GPT-5.6-Sol Max (better both)… Do it multiple times").

### Module 5 — Coding Agent Building Blocks (KB 04)

- **Skills:** "a structured set of instructions for a repeatable procedure"; Agent Skills convention (frontmatter `name`/`description`, `.agents/skills/<NAME>/SKILL.md`); auto-discovery vs pointing at a plain markdown file; global vs project scope; authored *after* correcting an agent ("save this as a skill… keep all the corrections I made in mind").
- **Subagents:** isolated context per task; **context rot** and self-review bias as the motivations ("if the agent implemented a feature, you shouldn't ask the agent to test it in the same window"); discoverable definitions in `.agents/agents/<NAME>.md`.
- **Orchestration + parallelism:** main session as orchestrator; **git worktrees** per task with "up to five agents in parallel," file ownership, one-at-a-time merges, optional conflict-resolver agent.

### Webinar — "Use Claude Code Like a Pro" (KB 07)

- **ADLC** ("a development lifecycle where agents do the work across the phases, and your job is designing the phases and the gates between them") with an explicit failure-mode→defense table: confident hallucination → layered context; premature satisfaction → a QA agent that cannot write; sycophancy → fresh context; context rot → isolation and path-scoped rules; reward hacking → **hooks it cannot bypass**.
- **Layered context:** `CLAUDE.md` under 40 lines (always-true facts only), `.claude/rules/` with path-scoped frontmatter.
- **Subagent team:** pm / engineer / qa / reviewer; QA and reviewer have **no write tools** (tool walls, "in a prompt it's a request, here it's a wall"); per-subagent model selection (`model: haiku` for QA); QA and reviewer run **in parallel, independently** ("two readers who agree separately are worth more than two who agree in sequence").
- **Hooks as enforcement:** PreToolUse dependency guard, PostToolUse test run, Stop require-green ("A rule in CLAUDE.md is a request. A hook is enforcement.").
- **`/task` and `/loop`:** one skill runs one issue through PM → engineer → QA+reviewer in a dedicated **worktree** with a PR as the handoff; `/loop` works the whole backlog respecting "Depends on:" links, running up to 3 tasks in parallel, stopping on cycles or stuck PRs. Noted caveat: for small projects, single-session per issue may beat the full machinery.
- **MCP:** GitHub MCP server moves backlog state into the issue tracker ("A task is done when its issue closes").
- **Token economics:** ccusage (cost visibility), rtk (output filtering proxy), headroom and caveman (compression), with the honest note "use your own judgement… experiment."
- **Packaging:** plugins/marketplace so the whole "Agentic OS" is reusable in the next repo.

### Project requirements and rubric (local HTML + online repo)

- The docs page (local snapshot, verified current) requires: frontend, backend, API contract, persistent storage, automated tests, containerization, CI/CD, public deployment, documentation of spec/architecture/setup/tests/deployment, an explanation of AI usage (context, delegation, review, verification), plus "the agent capabilities, operations, and security work required by the current rubric."
- The **2026 draft rubric** (14 criteria, 33 points) adds, relative to 2025: an **Agent Extension Pack** ("instructions, a reusable workflow, a subagent, an MCP tool/server, a hook/guardrail, and permission notes") and **Security, Audit, and DevOps Hardening** ("PR audit output, deterministic scan findings, agent security notes, operational diagnosis, and an AI tool/data policy"); expected repo layout includes `agent-capabilities/`, `agent-hooks/`, `mcp-server/`, `plugins/` or `custom-agent/`, `security/`, `ops/`, and `product-spec.md`.
- The **archived 2025 rubric** (12 criteria, 27 points) graded the same engineering core (frontend 3 pts, backend 3 pts, rest 2) with an AI criterion of "AI system development (tools, workflow, MCP)".

---

## 7. Evidence-based comparison: 2025 vs 2026

| Area | 2025 baseline (evidence) | 2026 practice or opportunity (course) | Evidence and interpretation |
|---|---|---|---|
| **Product and specifications** | No product spec, backlog, or issue list anywhere in the repo **[F]**; the "specification" was the Lovable prompt chain and the README written after the fact **[I]**. | Spec-driven development: brainstormed `plan.md`/`product-spec.md`, backlog decomposition, GitHub issues as canonical backlog, grooming with checkable acceptance criteria (KB 02; rubric expects `product-spec.md`). | The 2025 gap is structural: nothing checkable existed to verify "the game is done/correct" except the human playing it. The 2026 rubric grades this explicitly. For a reimplementation with a *known* reference game, writing the spec means codifying 2025 behavior (incl. its bugs — see §3.4) into acceptance criteria. **[I]** |
| **Context and project knowledge** | `AGENTS.md` (root + frontend), branch-aware Copilot instructions, `docs/ai-usage.md`; rule "documentation takes precedence"; assistants must read `/docs/` first **[F]**. | Context engineering: `AGENTS.md` + `CLAUDE.md` pointer, layered living docs (`process.md`, `testing-guidelines.md`, `design-system.md`, `api.md`) loaded only when relevant; webinar adds path-scoped rules and <40-line always-on files (KB 02, KB 07). | Strong continuity — 2025 already had tool-facing project instructions in-repo. The 2026 delta is *layering* (load only what's relevant) and *design-system* context to stop UI drift across sessions, directly relevant given the 2025 style/logic split. **[I]** |
| **Task planning and decomposition** | Human-orchestrated phases; commit prefixes (`roo:`, `Copilot:`, `lead:`) as the de-facto task log; zero GitHub issues; sequencing implicit in PR order **[F]**. | Backlogs with dependencies ("Depends on:" as issue links), dependency graphs/layers, `/goal` loops with checkable stop conditions, orchestrator lifecycles, `/loop` working the backlog up to N parallel tasks (KB 02, KB 04, KB 07). | 2025 planning was fully manual and invisible; course practices make it an artifact the harness can drive and the human can audit. The webinar's own caveat (small projects may not need the full machinery) applies to a game of this size. **[I]** |
| **Agent/tool orchestration** | Three siloed AI tools with non-overlapping charters on separate branches (`style`/`logic`); human as sole orchestrator/merger; guardrails CI enforcing branch discipline **[F]**. | Subagents inside one harness with isolated contexts and tool walls (QA/reviewer cannot edit), parallel independent review, orchestrator main session, git worktrees for parallel tasks, MCP for external systems (GitHub issues), plugins to package the setup (KB 04, KB 07). | Conceptually the 2025 role separation (architect/implementer/stylist + human integrator) prefigures the 2026 PM/SWE/QA topology; the difference is *enforcement and isolation* — 2025 roles were requests in markdown and discipline in Git, 2026 roles are structural (separate contexts, revoked tools, hooks) **[I]**. The PR #9 rule violation shows markdown rules alone were not enough. |
| **Verification and quality** | 44 tests (22 front pure-logic, 22 back API), added late explicitly for rubric marks; CI runs tests + docker build; guardrails workflow; human review of every PR; manual play as the only gameplay verification **[F]**. | QA-agent verdicts against acceptance criteria; hooks enforcing tests on every edit and blocking session-end on red; integration tests against Compose; Playwright E2E automating the manual multi-window check; recurring security audits; bug-introduction as an on-call drill (KB 05, KB 06, KB 07). | Continuity: CI + tests existed in 2025. Gaps: nothing tested the *game* (canvas, physics, UX) — precisely where the late bugs lived; nothing verified deployments post-merge; no E2E. The 2026 pattern "make the manual verification scriptable" maps directly onto 2025's manual play-testing. **[I]** |
| **Delivery and operations** | Dockerfile + Compose; Render single-container + managed Postgres; manual deployment; CI without CD; `/health` endpoint existed; deployment now offline; no metrics/logs/traces/alerts **[F]**. | Dev/prod split with manual promotion; registry-pinned immutable images; CI/CD via OIDC with health-check validation; OpenTelemetry + Prometheus/Loki/Tempo/Grafana; actionable alerts; AI on-call responder with bounded, read-only evidence; rollback/security hardening (KB 05, KB 06). | The 2025 project reached "deployed once, manually." Everything after the deploy command exits — the entire Module 4 surface — is absent from the baseline. Note the course's own continuity: 2025 cohort deployed to Render, 2026 course switches to AWS while calling the pattern tool-agnostic. **[F+I]** |

### Continuities (already present in 2025)

AGENTS.md-style project instructions; multi-AI role separation with a human orchestrator; branch-based responsibility boundaries with CI guardrails; API-first with an OpenAPI contract; Lovable-first frontend generation; SQLite→Postgres via SQLAlchemy; uv; single-container serving; PR-gated integration; test suites + CI. **[F]**

### Potential advances offered by the 2026 course

Written specs and checkable acceptance criteria; issue-tracker backlogs with dependencies; grooming; loop/graph orchestration; subagents with fresh contexts and tool restrictions; hooks as un-bypassable gates; skills for repeatable procedures; MCP integrations; E2E tests; CI/CD with health validation; dev/prod promotion with immutable images; observability and alerting; AI on-call response; recurring security audits; token-cost awareness. **[course-derived]**

### Uncertainties requiring further investigation

- Exact prompts/context given to Lovable, Roo Code, and Copilot in 2025 (only outcomes are in Git) **[U]**.
- Which specific gameplay bugs the final PRs (#15–#17) fixed, and what "gameplay refinement" was imagined but never done **[U]**.
- Whether MCP was used at all in 2025 despite the rubric incentive **[U]**.
- The 2025 repo's misdated template commit (2025-01-01 vs repo creation 2026-01-03) **[U]**.
- Whether any leaderboard data worth migrating survived the offline Render instance **[U]**.
- The 2026 rubric is marked **draft** online ("may change before the cohort begins") — final criteria should be re-checked before scoping the capstone **[F]**.

### Potentially transferable practices (candidates only — no adoption decision)

Spec-first reconstruction of the 2025 game as acceptance criteria; layered context documents; grooming before implementation; QA-verdict verification; worktree isolation; hooks for hard gates; skills for repeated workflows (e.g., release, incident response); E2E automation of gameplay smoke checks; health-validated CD; observability with app-specific metrics (e.g., scores submitted, games played); on-call agent pattern; security audit routine; token-usage measurement. Each is *supported by the course materials* but none is yet assessed for fit to this project's scale and goals.

---

## 8. Key findings, open questions

1. **The 2025 project was a real multi-agent engineering experiment** — not a single-assistant build. Its workflow documentation (AGENTS.md files, branch-aware Copilot charters, CI guardrails) is unusually complete for a capstone and is the strongest baseline asset for the reimplementation. **[F]**
2. **Its two structural weaknesses were unplanned work and unverified gameplay**: no spec/backlog/issue artifacts, and no automated check of the game itself; both correlate with the observed outcomes (reactive governance after PR #9; logic bug fixes on the final day; a dead `bonusJumps` feature; an ADR promise — localStorage fallback — never implemented). **[F+I]**
3. **The 2026 course's through-line is making the 2025 improvisations structural**: roles become subagents with tool walls, rules become hooks, plans become groomed issues, manual verification becomes E2E, deployment becomes CI/CD with health checks, and operations become observable with an AI responder. **[course-derived]**
4. **The 2026 rubric requires two graded categories with no 2025 counterpart** (Agent Extension Pack; Security/Audit/DevOps hardening) and renames the AI criterion to "AI-Assisted Development Workflow." Any reimplementation scope must include them to satisfy the capstone. **[F]**
5. **The reference implementation is code-only now**: the deployed 2025 app is offline; behavior must be reconstructed from code, tests, and docs — which makes a written, checkable product spec both a course practice *and* a preservation necessity. **[F+I]**

---

## 9. Preliminary topics for the next phase (no solutions selected)

1. **Product scope:** parity with 2025 vs. evolution (which known defects to fix — e.g., `bonusJumps`, localStorage fallback, mobile input — and which behaviors to preserve as-is).
2. **Specification artifact:** how to write the product spec / acceptance criteria from the 2025 code, and where it lives (`product-spec.md` per rubric expectations).
3. **Context architecture:** AGENTS.md layout, layered docs (process, testing guidelines, design system, API), rules layering per the course's context-engineering pattern.
4. **Planning model:** backlog + issue tracker + dependency graph vs. lighter approaches; the course itself notes full graph orchestration may be overkill for small projects.
5. **Verification strategy for a canvas game:** what is automatable (scoring logic, API, E2E smoke of load/play/submit) vs. what stays manual; whether Playwright fits the game loop.
6. **Orchestration model:** which roles (PM/engineer/QA/reviewer) as subagents vs. single-session work; worktrees and parallelism; hook-based gates.
7. **Reuse packaging:** skills/plugins worth extracting (the webinar's "Agentic OS" idea) vs. project-local simplicity.
8. **Delivery and operations scope:** deployment target (Render again vs. the 2026 AWS pattern), dev/prod split, registry-pinned images, health-validated CD.
9. **Observability scope:** which app-specific metrics (games played, scores submitted, errors) justify the OTel/Grafana stack.
10. **Security work:** audit cadence and tooling per the rubric's "deterministic scan findings" and "AI tool/data policy."
11. **Baseline preservation:** keeping the 2025 code runnable/compareable during the rebuild, and whether any production data migration is possible/needed.
12. **Diary methodology:** how to link each engineering decision to course materials, per this repo's stated dual goal (capstone + methodology evaluation).

---

*End of report. No implementation, refactoring, or architectural commitment is made herein. Next action belongs to the project owner.*
