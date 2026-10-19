# Plan — Clown Circus Reloaded

**Status:** Agreed (2026-10-15). Revision history: rev 0 draft → rev 1 feasibility-reviewed → agreed after the `bonusJumps` evidence review (§3) → **rev 2 (2026-10-17): aligned to the FINAL 2026 rubric** — §4 rewritten (12 criteria / 24 pts / pass 10), D11 added, M5 re-tiered MUST, C1 cut list revised, M1/#4 upgraded to minimal active instrumentation, M6/M7 updated. Plan approval does not replace the owner's review and approval of the product specification.
**Plan date:** 2026-10-15.
**Inputs:** [`2025-baseline-vs-2026-opportunities.md`](2025-baseline-vs-2026-opportunities.md) (discovery report), [`process.md`](process.md), [`diary.md`](diary.md), the interactive planning session of 2026-10-15, and a live re-check of the 2026 rubric (`DataTalksClub/ai-dev-tools-zoomcamp/project/README.md`, accessed 2026-10-15).
**Next refinement:** this plan feeds the product specification (`product-spec.md`) and the groomed GitHub-issues backlog; it does not replace them.

---

## 1. Goals, constraints, and success criteria

**Dual goal** (from `process.md`): (1) a capstone that scores well against the 2026 rubric; (2) practical, learn-by-doing proficiency in the course's AI-native engineering practices, evaluated honestly rather than adopted blindly.

**Rubric facts (FINAL version, verified 2026-10-17):** 12 criteria, max **24** points, **pass at 10** ("You do not have to score full marks on every criterion"). Operations carry 5 points (Observability 2 + Alerting 1 + On-Call Agent 2); CI/CD is 0–3 (top level = CD to dev + manual prod deploy); documentation of spec + agent team + context carries 6 points. Peer review of 3 projects is mandatory. Deadlines live on the course platform (owner-stated first submission: 2026-10-26).

**Constraints:**

- **First submission deadline: 2026-10-26** (11 days from planning). The milestone plan works backwards from it.
- **Second attempt: ~2–3 weeks later** (mid-November) — the improvement window: peer feedback, deferred experiments, polish. Finishing the first submission early may open a second peer-reviewed project (upside, not planned).
- **Human time: ~4–6 h/day**, mostly supervision, review, decisions, and learning — not hands-on coding. Human review is the bottleneck, not agent execution.
- **Budget: €0** for infrastructure (Render free, Neon free Postgres, GHCR, Grafana Cloud free).

**Success looks like:** a deployed, playable, tested reimplementation of the 2025 game with its documented defects resolved; a complete rubric submission (including the Agent Extension Pack and Security/Audit/DevOps evidence); and a diary that evaluates every methodology experiment with results, not intentions.

## 2. Decision log (agreed in planning, 2026-10-15)

| # | Decision | Rationale / notes |
|---|---|---|
| D1 | **Scope: parity + fix documented defects** | Same game; the known 2025 defects (dead `bonusJumps`, missing localStorage fallback, template residue) are resolved via explicit per-defect decisions recorded as deltas in the spec. Desktop input stays (mobile is deferred). |
| D2 | **Backlog: GitHub Issues as canonical** | Groomed four-section issues (Goal / Acceptance criteria / Out of scope / Constraints) with `Depends on:` links. Fixes 2025's zero-issues gap; enables loop/MCP experiments. |
| D3 | **Orchestration: full graph, always-on** | Every groomed issue flows PM → engineer → QA (+reviewer) with the main session as orchestrator and the human as approver/merger. Chosen knowingly as overkill-for-learning: the diary records where it cost more than it returned. Token usage measured from day 1; compression tools only as a later bounded trial if cost demands. The only permitted deviation is the checkpoint-C1 fallback (§6), taken as an explicit dated decision. |
| D4 | **Frontend: fully in-harness, Module 2 workflow preserved** | ZCode graph builds the frontend first — frontend-first → centralized services layer + mock implementations → API contract → backend against contract. Lovable dropped deliberately (experienced in 2025). 2025 repo informs behavior/visuals, not generation. |
| D5 | **Verification: full pyramid, early CI, deterministic core; targeted TDD** | Unit (pure logic) + API + integration (Compose) + Playwright E2E; CI gates every PR from day 1. TDD mandatory for game-logic modules and backend API; UI/canvas test-after. Game core is pure, seeded-RNG, fixed-timestep modules with a thin rendering shell — making gameplay acceptance criteria checkable. Manual play retained for feel/visuals/audio only. |
| D6 | **Deployment: Render (free) + Neon (free Postgres) + GHCR immutable images** | Zero cost. Stateless container from a GHCR image (`YYYYMMDD-HHMMSS-shortsha` tags) deployed via API from GitHub Actions; health-validated CD; dev + prod services with manual promotion of the identical image. AWS layer (CloudFormation/ECR/OIDC) consciously scoped out (cost rationale, per course guidance to ask the AI for cheaper deployment). Cold start accepted as cosmetic; scheduled `/health` monitoring doubles as uptime check and keeps the service mostly warm. |
| D7 | **Observability: OTel instrumentation + Grafana Cloud free** | FastAPI auto-instrumentation early (it is cheap); OTLP to Grafana Cloud in dev and prod. The *local* Collector/Prometheus/Loki/Tempo/Grafana Compose stack is COULD (redundant with Grafana Cloud for our loop; kept as offline-dev option). App-specific metrics, env/version dashboards, actionable alerts — see tiering in §6. Note: observability is **not** a rubric line item; it feeds #13 (operational diagnosis) and doc quality, so its depth is a paced experiment, not day-one infrastructure. |
| D8 | **AI on-call drill: real, in dev only — tiered fallback** | Tier 1 (target): agent injects a test-passing bug into dev, real alert fires, on-call agent diagnoses, smallest fix as a PR, human reviews; incident report in the diary. Tier 2 (C1 fallback): ops-triggered incident (service stop/latency) with the same on-call agent loop — still real telemetry and a real diagnosis output. Tier 3: scripted/paper diagnosis. Any tier satisfies rubric #13's "operational diagnosis output"; only tier 1 involves deliberate bug injection, and production is never touched. |
| D9 | **Security: report early, gate on high** | `pip-audit`, `npm audit`, `gitleaks` in CI from the first increment (trivy on the image is COULD once images stabilize); findings always archived; CI fails on high-severity runtime findings or any secret leak. Recurring AI audits at milestones (in-harness read-only subagent; external strong model when available); AI tool/data policy; agent security notes. |
| D10 | **Pacing: deadline-driven, 4–6 h/day supervisory** | Milestones work backwards from 2026-10-26 with two explicit checkpoints (§6) and an ordered cut list. |
| D11 | **Repository visibility: private during development, public at submission** | Owner decision (2026-10-17, per prior-capstone practice). The final rubric's Product Specification criterion requires a *publicly accessible* task tracker with acceptance criteria and agent-usage evidence — our groomed GitHub Issues + [`docs/agent-work-evidence.md`](../docs/agent-work-evidence.md) satisfy it once public. M7 task: flip visibility immediately before submission and pin the SHA. |

**Standing proposals adopted unless amended at review:** stack unchanged from 2025 (React 18 + TS + Vite + Tailwind frontend; FastAPI + Pydantic v2 + SQLAlchemy backend; SQLite locally, Neon Postgres in cloud); `frontend/` + `backend/` monorepo; 2025 repo accessed by clone-on-demand with the inspected SHA pinned in the spec; layered context docs grown under `_docs/` as their subjects appear; no `CLAUDE.md` pointer (harness adaptation — `AGENTS.md` is native here); `product-spec.md` at repo root per rubric.

## 3. Product definition (summary — the spec is authoritative)

- **Behavioral baseline:** the 2025 game as evidenced by code, tests, and docs (discovery report §3): 800×600 canvas seesaw/balloon arcade, 4×14 balloon grid with row points (20/50/50/100) and row-clear bonuses (200/500/500/1000), two-clown lifecycle with wall damping 0.8 and diving-board damping 0.9, seesaw landing rules and lives, level progression (+1 life, +25 % velocity/level), progressive launch velocity (−14 → −17, step 0.2, reset on death), HUD + start/game-over screens with leaderboard, Web-Audio-synthesized sound. **All numeric constants are pinned in the spec** so acceptance criteria are arithmetic, not vibes — this is the main defense against the rework magnet where 2025's late bugs clustered.
- **Testability hooks (spec requirement):** deterministic core (seeded RNG, fixed timestep) plus a minimal debug/test interface for E2E (e.g., state injection / fast-forward) so Playwright scenarios stay fast and stable.
- **Named deltas from 2025 (decided at plan approval / spec review, M0):**
  1. `bonusJumps` — **evidence reviewed 2026-10-15** against the pinned baseline (all branches + full history): the earning rule is confirmed (only a full **blue-row clear** grants `+1`, `scoring.ts:getExtraJumpsForRowClear`; HUD label reads "Jumps"), but **no consumption logic ever existed in any commit on any branch** and no doc states what spending one does — original intent is inconclusive. Decision therefore **flagged for the owner at product-spec review** (recorded there as an open question with a recommendation), per the agreement that no new gameplay rule is introduced silently.
  2. localStorage fallback — implement the ADR-promised offline leaderboard fallback (natural in the mock-first services layer).
  3. Template residue — moot for in-harness generation; the acceptance criterion is "clean scaffold."
- **Out of scope for the first submission:** mobile/touch input, new gameplay features, performance work. Candidates for the second attempt.

## 4. Rubric mapping (FINAL rubric, verified 2026-10-17 — 12 criteria, 24 points, pass 10)

| # | Criterion (max) | Covered by | Tier |
|---|---|---|---|
| 1 | Problem description (2) | README + `product-spec.md` | MUST |
| 2 | Product specification (2) | `product-spec.md` + GitHub Issues (AC per task, agent-usage evidence per [`docs/agent-work-evidence.md`](../docs/agent-work-evidence.md)); tracker becomes publicly accessible at submission (D11) | MUST |
| 3 | Agent team specification (2) | `.agents/agents/*.md` role files + graph lifecycle; `process.md` §8; `docs/agent-work-evidence.md` | MUST |
| 4 | Context management (2) | `AGENTS.md` → modular `_docs/*` (process, plan, backlog, tuning) | MUST |
| 5 | Application (2) | Full-stack end-to-end (M2–M4); runs locally with a single command (`npm run dev`, `docker compose up`) | MUST |
| 6 | Testing (2) | Unit + integration suites, single command, green (M2–M4; E2E extra) | MUST |
| 7 | Containerization (2) | #3 done — Compose runs the full system incl. DB, single command | MUST ✅ |
| 8 | Deployment (2) | #5 — public URL, health-validated | MUST |
| 9 | CI/CD (3) | CI on PRs (#2) + CD to dev + manual prod promotion (D6 architecture = the 3-point level) | MUST |
| 10 | Observability (2) | M5: key user journey with metrics + traces + structured logs sharing a trace ID; **no customer data or credentials in any signal**; collected and viewable (Grafana Cloud) | MUST |
| 11 | Alerting on user impact (1) | M5: ≥1 actionable alert on a user-impact symptom | MUST |
| 12 | On-call agent (2) | M5: on-call agent wakes on alert and fixes (D8 tier 1, dev only) | MUST |

Security layer (scanners, audits, tool/data policy) is retained at planned scale as good engineering and feeds "no credentials in telemetry" — **explicitly non-graded** in the final rubric. Quality of frontend/backend/API/DB still feeds criterion 5 and the overall submission, but is no longer separately graded.

## 5. Architecture (target, reached incrementally)

- **Monorepo:** `frontend/` (React 18 + TS + Vite + Tailwind), `backend/` (FastAPI + Pydantic v2 + SQLAlchemy). Single container in deployment: backend serves `frontend/dist` with SPA fallback (course single-container pattern; 2025 end-state). `openapi.yaml` and `docker-compose.yml` at repo root (rubric-expected contents).
- **Game core:** pure TypeScript modules — physics, collision, scoring, lives/levels — deterministic (seeded RNG, fixed timestep), no React/canvas imports; React renders a thin shell.
- **Frontend-first flow:** UI + centralized services layer with mock implementations first; OpenAPI contract derived from the services layer; backend implemented against the contract. Contract-drift CI automation is COULD; the MUST is a committed `openapi.yaml` kept in sync at review.
- **Data:** SQLite for local dev/test; Neon Postgres in cloud via `DATABASE_URL`; one Neon project, separate dev/prod databases (satisfies #7 "multi-environment support").
- **Environments:** local (Compose: app + Postgres), dev (Render + Neon + OTel → Grafana Cloud), prod (Render + Neon + OTel → Grafana Cloud). Promotion = deploy the same immutable GHCR tag to prod after dev passes health validation.

## 6. Milestones, checkpoints, and cut list

The groomed backlog and its dependency DAG are diagrammed in [`backlog.md`](backlog.md) (read-only view; GitHub Issues remain canonical, D2).

MoSCoW: **MUST** = rubric-critical; **SHOULD** = high value with defined fallback; **COULD** = cut without endangering submission; **WONT(v1)** = deferred to the second attempt by decision.

| ID | Dates | Milestone | Tiering |
|---|---|---|---|
| M0 | Oct 15–16 | **Planning artifacts.** Agree + commit this plan; diary entry. Re-check rubric. Agent extracts product spec from pinned 2025 SHA → `product-spec.md` (human-approved; constants pinned; testability hooks; `bonusJumps` decision). Scaffold context docs and rubric-aligned dirs. Create + groom M1/M2 issues with dependencies. | MUST. Spec approval gates all implementation; one focused review pass, not perfectionism — the spec is living, later changes go through issues. |
| M1 | Oct 16–17 | **Walking skeleton + early pipeline.** Monorepo scaffold; CI on first PR (lint, unit tests, Docker build, `pip-audit`/`npm audit` report, gitleaks gate); Dockerfile; `/health`; `docker-compose.yml`; dev deploy to Render + Neon; **minimal OTel instrumentation + export in #4** (active, not dormant — final-rubric alignment 2026-10-17: trace-ID correlation capability + no-customer-data constraint now; dashboards/alerts stay M5). | MUST. NOT in M1: Grafana Cloud onboarding, dashboards, health-monitor workflow, trivy. |
| M2 | Oct 18–20 | **Game core + frontend-first.** ~6 session-sized graph issues: (1) physics/collision, (2) scoring + lives/levels, (3) level/difficulty progression + `bonusJumps` delta, (4) canvas shell + HUD + screens, (5) services layer + mocks + localStorage fallback, (6) audio. TDD on 1–3; test-after on 4–6. | MUST. Issue batching is deliberate: review load sized to 4–6 h/day. |
| **C1** | **Oct 21 EOD** | **Checkpoint 1** (criteria and cut list below). | Gate. |
| M3 | Oct 21–22 | **Contract + backend.** `openapi.yaml` from services layer; FastAPI + SQLAlchemy + Neon; API test suite; switch services to real backend. | MUST. Contract-drift CI automation COULD. |
| M4 | Oct 22–23 | **Integration, E2E, CD.** Integration tests (Compose, separated from unit); Playwright happy-path E2E (load → play → game over → submit → leaderboard); GHCR immutable tags; deploy-on-green CD to dev; prod service + first manual promotion; scheduled health-monitor workflow. | MUST. Two-session (two-browser) E2E COULD. |
| **C2** | **Oct 23 EOD** | **Checkpoint 2:** CD green on dev with a promotion to prod demonstrated? If not: fall back to documented manual promotion + deploy-on-green demonstrated on dev only (known ~1-point risk on #11) and keep building. | Gate. |
| M5 | Oct 23–24 | **Ops completion (all MUST after the final-rubric alignment):** Grafana Cloud onboarding (dev + prod); the key user journey instrumented with correlated metrics/traces/logs (builds on #4's early instrumentation); env/version dashboards covering the journey; ≥1 actionable alert; **on-call drill tier 1 in dev** (agent wakes on alert, smallest fix as a PR). Security at planned scale (audit report #1, AI tool/data policy, agent security notes) — good practice, non-graded. Rollback drill (redeploy previous tag) SHOULD — supports the CI/CD rollback path. | ALL ops items MUST (5 graded points). Dashboard depth beyond the journey, >1 alert, extra hardening: COULD. |
| M6 | Oct 24–25 | **Team/context evidence + docs + demo.** `process.md` §8 applied; `docs/agent-work-evidence.md` kept current; permissions/role notes consolidated; README + docs (problem, architecture, setup/run/test/deploy, AI usage); screenshots + short video + live link. (The final rubric dropped the expected-directories list — the pack artifacts stay because they evidence Agent Team + Context Management, 4 graded points.) | MUST. Demo artifacts explicitly not optional — 2025 shipped none and lost its evidence. |
| M7 | Oct 25–26 | **Buffer + submission.** Rubric self-assessment against the final 12 criteria; fix gaps; final promotion; **D11: flip repo public + pin SHA**; submit. Scope freeze after Oct 25 EOD. | MUST. Buffer absorbs M2–M4 slippage. |

**C1 criteria (all must hold):** game playable on local or dev deploy with core-logic tests green; spec deltas closed; CI green on `main` for the last ≥3 PRs; your review load averaging ≤6 h/day; no issue needing >1.5 sessions.

**C1 ordered cut list (revised 2026-10-17 for the final rubric — ops items are graded and no longer cuttable; execute as needed, each cut as a dated diary decision):**
1. Two-session E2E → WONT(v1) (happy path satisfies the Testing criterion).
2. trivy, contract-drift automation, local observability stack → WONT(v1).
3. Dashboard/alert depth beyond the key journey and the required alert → WONT(v1).
4. Rollback drill → paper walkthrough instead of live redeploy (CI/CD rollback path stays documented).
5. Graph fallback (last resort, preserves D3's spirit under deadline): docs/chore issues run single-session; logic/backend/ops issues keep the full graph.

**C1 STOP-and-rescope branch:** if the core loop is not playable by Oct 21 EOD — freeze physics fidelity to "playable parity" (core loop complete; fine physics nuance to the second attempt) and protect M3–M7 unchanged, because backend, CD, pack, and docs are irreplaceable for the rubric while physics nuance is recoverable.

**Deferred to the second attempt (WONT v1 unless ahead of schedule):** `/loop` over the backlog; parallel worktrees; token-compression trial; second external security reviewer; custom MCP mini-server; mobile/touch input; gameplay progression additions — **birds/trajectory mechanic and level combinations** (owner decision 2026-10-19, after evaluating the progression concept against the deadline: new entity + physics + rendering on the parity-critical core, zero rubric value, competes with the 5-point ops milestone); performance work; extended E2E; deeper dashboards; peer-feedback integration. **Owner gameplay items for version 2 (2026-10-19, verified 2025-parity confirmed):** level-up pause/celebration (2025 has none — confirmed identical to 2026); trampoline "skating" edge case (board bounce damps vy only, vx persists → micro-bounce + slide until the board ends; decide fix-vs-feature); clown sprite rotation during flight (no rototranslation in either version). **Conditional M2 addition:** entry-height randomization from level 4, 50/50 seeded (issue #20) — runs only after #11 if #9/#10 are on schedule; defer without compressing gates (owner-mandated).

## 7. Review-load and rework controls

- Issues sized to one reviewable session; target ≤ ~400 changed lines per PR; orchestrator attaches a QA verdict + diff summary to every PR so human review starts from the verdict, not the raw diff.
- Rework cap: after 2 consecutive QA-FAIL loops on one issue, escalate to the human instead of agent ping-pong.
- Physics parity defended by pinned constants in the spec (§3) rather than by rework cycles.
- Token usage measured per issue from day 1 (D3); compression tools only as a bounded later trial.

## 8. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Deadline slip (11 days, review-bound human) | §6 MoSCoW + C1/C2 gates + ordered cut list + M7 buffer + §7 controls. |
| Full-graph token/time cost | Measure from day 1; C1 fallback is the only permitted deviation from D3, taken explicitly. |
| Rubric still draft | Re-check at M0 and M7 (live version already re-verified 2026-10-15: 30 points, peer-review-dependent). |
| Render/Neon free-tier surprises | Cold start accepted (cosmetic; health monitor keeps warm); Neon storage ample; no 2025 data to migrate (instance offline). |
| Spec extraction errors | Human approval gate at M0; acceptance criteria traced to 2025 code/tests; deltas explicit. |
| E2E flakiness on a canvas game | Deterministic core + testability hooks (spec requirement); flake budget capped, fall back to fewer scenarios. |
| Observability setup sinkhole | Instrumentation early, onboarding at M5 only, local stack COULD, depth gated by C1 state. |

## 9. Diary and evaluation methodology

Per `process.md` §4/§7: at each milestone and each experiment, record what/why, how, course connection (full title + KB path + section), lessons, next. Distinguish completed work from proposals. The 2025-vs-2026 comparison lens runs through all entries. Never record intentions as accomplishments.

## 10. Changes from revision 0 (feasibility review, 2026-10-15)

1. Rubric re-verified live: 14 criteria / 30 points (not 33); peer-review dependency noted; §4 rubric-mapping table added; `docs/agent-extension-pack.md` and `docs/permissions.md` added to M6.
2. Observability re-tiered: instrumentation stays early; Grafana Cloud onboarding, dashboards, and alerts moved from M1 to M5; local Compose observability stack demoted to COULD (not a rubric line item).
3. M2 re-sized into ~6 batched session-issues (review-flood defense); §7 review-load and rework controls added; spec pins numeric constants and testability hooks.
4. trivy and contract-drift CI automation demoted to COULD; two-session E2E demoted to COULD.
5. D8 drill tiered (real injection → ops-triggered → paper) with C1 deciding the tier.
6. Checkpoints C1 (Oct 21 EOD, with ordered cut list and STOP-and-rescope branch) and C2 (Oct 23 EOD, CD fallback) added.
7. All agreed decisions (D1–D10) preserved; the only revisited one is D8's drill form, and only as an explicit fallback tier.

## 11. Immediate next actions

1. Review and agree this plan (status flips from *Draft* to *Agreed*; commit plan + diary entry).
2. M0 begins: rubric re-check (done once today; repeat at M7), spec extraction issue, `bonusJumps` decision, backlog creation.

---

*Course sources relied on for this plan (full titles, KB paths): Module 1 — "Alexey On Data - AI-Native Development: Specifications, Loop and Graph Engineering" (`docs/course_KB/02…pdf`); Module 2 — "…Build and Ship a Full-Stack App with AI Coding Assistants" (`03…pdf`); Module 3 — "…Deploy a Full-Stack App with AI Coding Assistants" (`05…pdf`); Module 4 — "…DevOps and Observability for an AI-Built App" (`06…pdf`); Module 5 — "…Coding Agent Building Blocks: Reusable Skills and Specialized Subagents" (`04…pdf`); webinar — "Use Claude Code Like a Pro" (`07…/worksheet.md`); project requirements/rubric (`project_requirements.html` local snapshot + live `DataTalksClub/ai-dev-tools-zoomcamp/project/README.md`, accessed 2026-10-15). All accessed via the discovery report's summaries; direct-source consultation happens when each practice is designed (per `process.md` §5). The AWS-cost remark is attributed to the user's report of the Module 3 video, which is not in the KB.*
