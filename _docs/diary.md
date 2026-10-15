# Project Diary — Clown Circus Reloaded

This diary records the evolution of Clown Circus Reloaded, from the initial setup through the development process, documenting key activities, AI tool usage, decisions, experiments, and lessons learned.

## 2026-10-13 — Project initialization

### Repository setup

I manually created a new private GitHub repository for Clown Circus Reloaded and drafted the initial `README.md`. At this stage, the README contained only the project's idea, motivation, and the intention to revisit my 2025 capstone using the more mature AI-assisted software engineering practices covered by the second edition of the AI Dev Tools Zoomcamp.

The goal is not simply to rebuild the same game, but to investigate how the development process can evolve when revisiting an existing project with a more advanced AI engineering toolbox.

### Course knowledge base

Before starting implementation or delegating work to an AI coding agent, I created `docs/course_KB/` to collect the course materials and related reference documents.

This knowledge base is intended to provide the AI agent with a grounded source of context about the course's methodologies, concepts, and project requirements. The original materials will serve as references throughout the project rather than being replaced by summaries generated in advance.

### Next step

Before making architectural or implementation decisions, I will ask ZCode to analyze the original 2025 repository and the course knowledge base. The objective is to reconstruct the existing product, architecture, and AI-assisted development workflow, then compare them with the opportunities offered by the 2026 course.

This initial discovery phase should produce a documented baseline and identify open questions without modifying the application code or committing to a new architecture.

## 2026-10-13 — Discovery phase (executed by ZCode)

### Task delegated

Following the plan above, I delegated the discovery to **ZCode**, the AI coding agent driving this project, with an analysis-only mandate:

- Reconstruct the 2025 **Clown Circus Carnival** baseline (product, architecture, testing, deployment) from the repository at [lucapug/clown-circus-carnival](https://github.com/lucapug/clown-circus-carnival) — code, all three branches (`main`, `logic`, `style`), full commit history and authorship, the 17 pull requests, and the governance documents.
- Reconstruct the **2025 AI-assisted development workflow**: which tools did what, boundaries, human orchestration, and guardrails — explicitly treating it as an existing AI-engineering experiment rather than a conventionally built app.
- Analyze the **2026 course knowledge base** in `docs/course_KB/` (course overview, module 1–5 companion articles, the "Use Claude Code Like a Pro" webinar worksheet, project requirements, and the online rubric), preserving the course's own terminology.
- Compare the 2025 baseline with the 2026 opportunities, labeling facts, interpretations, and unknowns — **without** making architectural decisions, committing to a stack, or modifying any existing file.

### Outcome

ZCode delivered the report at [`_docs/2025-baseline-vs-2026-opportunities.md`](2025-baseline-vs-2026-opportunities.md). It was the only file created during this phase. Key findings:

- **The 2025 project was a real multi-agent experiment.** Lovable.dev generated the MVP and owned visuals/sound on the `style` branch, Roo Code (GLM-4.7) owned architecture and API design on `logic`, GitHub Copilot owned implementation and tests, and the human acted as lead and sole merger across 17 PRs. The division of labor was documented in `AGENTS.md` files and branch-aware Copilot instructions, and partially enforced by a CI guardrails workflow policing branch-merge direction.
- **Its structural gaps were unplanned work and unverified gameplay.** No product spec, no backlog, zero GitHub issues; the 44 tests arrived on day 11 of 13 explicitly "to reach full marks in the project rubric"; the game itself was verified only by playing it, and the final three PRs were still logic bug fixes. ZCode also confirmed a dead-end feature (`bonusJumps` displayed but never consumed) and an unimplemented ADR promise (localStorage fallback).
- **The 2026 course's through-line is making those improvisations structural:** specs and checkable acceptance criteria, groomed issue backlogs, loop/graph orchestration, subagents with isolated contexts and tool walls, hooks as un-bypassable gates, skills/MCP/plugins, E2E automation, CI/CD with health validation, OpenTelemetry observability, AI on-call response, and security audits. The 2026 rubric (14 criteria, 33 points) adds two graded categories with no 2025 counterpart: **Agent Extension Pack** and **Security, Audit, and DevOps Hardening**.
- **Real continuities exist:** AGENTS.md instructions, CI guardrails, OpenAPI-first design, Lovable-first frontend generation, single-container deployment, SQLite→Postgres, and uv were all already present in 2025.

### Limitations recorded

The deployed 2025 app on Render is offline (no runtime verification possible); the webinar's slides and starter project are missing from the KB; the original Lovable/Roo/Copilot prompts do not survive in Git; the 2026 rubric is still marked as a draft online.

### Next step

Review the report's open questions and next-phase topics (product scope, spec artifact, verification strategy for a canvas game, orchestration and delivery models), then decide the scope and process for the reimplementation before any code is written.

## 2026-10-15 — Planning phase: interactive decisions, feasibility review, plan agreed (executed by ZCode)

### What and why

Following the course's Module 1 methodology — brainstorm with an assistant that asks **one question at a time**, then save the result as `plan.md` (*Alexey On Data — AI-Native Development: Specifications, Loop and Graph Engineering*, Module 1 companion article, `docs/course_KB/02…Specifications%2C%20Loop%20and%20Graph%20Engineering.pdf`, via discovery report §6) — we resolved the planning topics and produced [`_docs/plan.md`](plan.md).

### How — decisions (D1–D10 in the plan's decision log)

Ten focused questions, one at a time: product scope (**parity + fix documented defects**); backlog (**GitHub Issues**, groomed four-section format with `Depends on:` links); orchestration (**full PM → engineer → QA(+reviewer) graph, always-on**, chosen knowingly as overkill-for-learning with token-cost measurement); frontend (**fully in-harness, preserving Module 2's frontend-first → mocked services → API contract → backend flow**; Lovable dropped as already experienced in 2025); verification (full pyramid, early CI, deterministic game core, **targeted TDD**); deployment (**Render + Neon + GHCR** at €0, AWS consciously scoped out for cost — itself the course-anticipated "ask your AI for a cheaper deployment" decision); observability (**OTel + Grafana Cloud free**); **AI on-call drill** (real, dev-only, tiered fallback); security (**report early, gate on high**); pacing (**deadline-driven**: first submission 2026-10-26, ~4–6 h/day supervisory time, second attempt mid-November).

### Feasibility review (owner-requested, before approval)

The owner asked for a deadline-credibility review before approving. I re-checked the **live 2026 rubric** rather than trusting the report: 14 criteria, **max 30 points** (the report's "33" was stale), points depending on **peer review** participation, and `docs/agent-extension-pack.md` + `docs/permissions.md` among expected contents. Findings and targeted changes (plan §10): observability is **not** a rubric line item (re-tiered as paced experiment; onboarding moved to M5); CI/CD criterion #11 requires **deploy-on-green** (protected); M2 re-sized into ~6 session-issues against review-flood risk; rework cap and QA-verdict-first review added; checkpoints **C1 (Oct 21 EOD, ordered cut list + STOP-and-rescope)** and **C2 (Oct 23 EOD, CD fallback)** added. The smallest reliable end-to-end core was identified and mapped criterion-by-criterion (plan §4).

### `bonusJumps` forensics (owner-conditioned approval)

The owner approved the plan conditioned on evidence-based handling of the dead 2025 feature. Method: cloned the baseline pinned at `0d365e69a66245c29b9de258e23af1a612dd99c0` (main HEAD), grepped code and docs on all branches, and walked `git log -S bonusJumps --all`. **Result:** earning rule confirmed (blue-row clear → +1; HUD label "Jumps"), but **no consumption logic ever existed in any commit on any branch** — the feature was born dead in the Lovable MVP. Original intent inconclusive → flagged as an open question for the owner's decision at product-spec review (recommendation attached there), instead of silently introducing a gameplay rule. Recorded in plan §3.

### Outcome

Plan marked **Agreed** and committed with this entry. Plan approval explicitly does **not** replace the owner's review and approval of the product specification.

### Lessons

- Re-checking primary sources changed the plan: the live rubric (30 pts, peer-review dependency) materially re-tiered observability and protected CD — summaries (including a good discovery report) drift.
- The course's "one question at a time" brainstorm format worked well for surfacing trade-offs; the feasibility pass the owner forced was where the plan became deadline-credible.
- Git history (`git log -S`) is cheap, decisive evidence for "was this ever intended?" questions.

### Next

M0: extract `product-spec.md` from the pinned baseline (agent-drafted, owner-approved, including the `bonusJumps` decision), scaffold context docs and rubric-aligned directories, create and groom the first issues. M1 (walking skeleton + CI + dev deploy) begins immediately after spec approval.

## 2026-10-15 — M0 completed: spec verified, approved (rev 3); backlog groomed (#1–#11)

### What and why

The owner reviewed the draft `product-spec.md` and requested verification of two high-risk areas before approval; both were checked against the pinned baseline (`0d365e6`), the spec revised, and all open decisions approved.

### Verification findings (owner-requested)

1. **Physics / fixed timestep.** Evidence: the 2025 loop is driven purely by `requestAnimationFrame` with no delta-time (`useGameEngine.ts:153–165,394`; `Date.now()` feeds only floating-text IDs). New baseline fact: **2025 game speed was display-refresh-dependent** (2× on 120 Hz) — missed by the discovery report. Resolution: one logic tick = exactly 1/60 s, constants unchanged, pinned tick order (semi-implicit Euler first), recorded as an **explicit deviation**; golden-tick / same-seed / 60-vs-120 Hz tests specified.
2. **Offline submissions.** The draft queue ("remove on success") duplicated rows when the server persisted but the response was lost. Resolution: `submissionId` (UUIDv4) idempotency key with unique constraint; identical-payload retry → stored record `201`; **same ID with different payload → `409`, no mutation** (owner-required semantics, now tested by criteria).

**Bonus baseline fact:** `utils/scoring.ts` (the module 2025's tests tested) was **never imported by the engine** — the engine reimplemented scoring inline with duplicated constants. 2026 requires the shared module as single source of truth with **live-path tests** through the core.

### Owner decisions (all approved 2026-10-15)

60 Hz tick canonicalization; `submissionId` contract incl. 409-on-mismatch; `bonusJumps` **option A** (one bonus jump absorbs one life loss; death-reset rules otherwise unchanged), recorded as an explicit **2026 design decision**, not inferred 2025 intent.

### Outcome

`product-spec.md` committed at revision 3 (approved). Backlog created on GitHub: **#1–#11**, groomed in the course's four-section format with `Depends on:` links and acceptance criteria traced to spec sections — M1: scaffold (#1), CI (#2), Docker/Compose (#3), OTel scaffold (#4), dev deploy Render+Neon (#5); M2: deterministic core (#6), scoring/lives (#7), progression + bonusJumps (#8), shell/screens (#9), services + offline queue (#10), audio (#11). Two creation passes were needed to fix dependency references (first hardcoded, then a literal template variable) — all eleven verified correct afterwards.

### Lessons

- A verification round before committing a spec caught a real API-design race and a per-frame wording ambiguity — cheap insurance against downstream rework.
- Script-generated issue bodies need an explicit cross-reference verification pass; both failure modes (hardcoded numbers drifting, unexpanded template variables) were caught only by checking the rendered result.

### Next

M1 begins under full-graph orchestration (plan D3) starting from #1; the human review rhythm and per-issue token measurement start with the first PR.

## 2026-10-15 — First full graph cycle (issue #1, PR #12): QA PASS, REVIEW APPROVE, merge pending owner

### What and why

First execution of the always-on orchestration graph (plan D3) over issue #1 (monorepo scaffold): PM brief → engineer → QA + reviewer in parallel → FAIL edge back to engineer → final verdicts. Lifecycle enforced by the orchestrator (main session): engineer never closes; QA never fixes; human merges. Course sources: *Alexey On Data — AI-Native Development: Specifications, Loop and Graph Engineering* (KB 02) for the graph topology; *Use Claude Code Like a Pro* webinar worksheet (KB 07) for the /task pattern and the parallel, independent QA+reviewer readers.

### How — phases, verdicts, artifacts

- **PM** — implementation brief commented on [#1](https://github.com/lucapug/clown-circus-reloaded/issues/1#issuecomment-6193837761): registry-verified versions, file tree, DoD mapped 1:1 to acceptance criteria, guardrails.
- **Orchestrator decision (owner-ratified)** — 2025 parity means component/architecture parity, not exact pins; latest-stable FastAPI 0.143.x. Side finding: FastAPI ≥0.142 native OTel (opt-in via env in 0.143) recorded on [#4](https://github.com/lucapug/clown-circus-reloaded/issues/4#issuecomment-6194530724) for its future PM brief.
- **Engineer** — [PR #12](https://github.com/lucapug/clown-circus-reloaded/pull/12): 5 commits, ~306 hand-written insertions; Vite 5 + React 18 + TS 5.6 + Tailwind 3.4 frontend (clean identity), FastAPI 0.143.2 backend (app factory, `/health` → `{"status":"ok"}`), root scripts/.gitignore/.nvmrc, AGENTS.md commands.
- **QA (independent re-run)** — [VERDICT: PASS](https://github.com/lucapug/clown-circus-reloaded/pull/12#issuecomment-6195420311): every §3 check re-executed from fresh checkout, all green; guardrails verified (no cross-issue scope; only AGENTS.md among pre-existing files changed).
- **Reviewer** — REQUEST_CHANGES with one [minor]: `frontend/README.md` (50 lines of Vite template prose) violated the brief's no-new-docs guardrail and was undisclosed in a PR claiming "Deviations: None". FAIL edge exercised: fix routed back to the engineer (rework loop 1 of max 2 per plan §7) — commit `c15e847` removed the file and the PR body now discloses the deviation. Final [REVIEW: APPROVE](https://github.com/lucapug/clown-circus-reloaded/pull/12#issuecomment-6195846575).

### Token ledger (subagent tokens, as reported by the harness)

PM 278,240 · engineer stall (attempt 1, no usage reported) · engineer escalation pass 683,584 · engineer implementation 3,151,203 · engineer rework 520,003 · QA 1,499,404 · reviewer 320,609 · reviewer close-out 216,010 → **≈ 6.67M measurable subagent tokens** for one ~300-line scaffold issue, plus unmeasured main-session cost. The course's own warning (KB 02: the graph "takes significantly more time and tokens… often a simple prompt or loop is enough") is confirmed in our own data.

### Incidents and standing fixes

1. Engineer stall on an interactive `npm create`/`npx` prompt (10-min inactivity kill, zero side effects) → anti-hang rules are now standing engineer-prompt content (`--yes`, `< /dev/null`, background servers with PID kill).
2. Engineer spent a full pass on version analysis instead of implementing — though it produced the OTel finding and the parity ratification → after any ratification, engineer prompts now say "execute only, no further research".
3. The `Explore` subagent type failed to start (model unavailable on this account) → reviewer ran as `general-purpose` with an instruction-level tool wall. Structural walls for read-only roles are not available in this harness today; the M6 extension-pack hooks are where structural enforcement can land. Recorded as a harness limitation, honestly.
4. QA found and killed an orphaned uvicorn holding :8000 (disclosed in its verdict).

### Lessons

- The graph earned its keep on correctness (caught template residue the engineer missed; forced honest PR disclosure) but at heavy token cost — per-issue-type evaluation continues over the next cycles, exactly the data D3's "overkill-for-learning" choice was designed to produce.
- Independent re-verification (QA re-running everything) is cheap insurance relative to trusting PR bodies.
- Sequencing note discovered while routing: #2's CI includes a Docker-build job that needs #3's Dockerfile — run #3 before #2 despite both depending only on #1 in the DAG.

### Next

Owner reviews and merges PR #12 (the only remaining act of this cycle; #1 auto-closes via "Closes #1"). After merge: remove the `in-progress` label, start the #3 cycle, then #2.


