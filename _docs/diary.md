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

## 2026-10-15 — Post-cycle tuning analysis (owner-requested) after merging PR #12

### What and why

The owner merged PR #12 (#1 auto-closed; `in-progress` label removed by the orchestrator — label management at cycle boundaries is now an orchestrator duty, proposed in the tuning doc §5). Before cycle #3, the owner requested a tuning review of the graph loop using the first-cycle ledger as evidence, with explicit constraints: no weakening of independent verdicts, no scope/spec changes, nothing implemented before approval.

### How

Evidence gathered: the cycle-1 diary ledger (~6.67M subagent tokens; decomposition per pass), the PR #12 thread, a live `ListModels` check, and verification of issue #2's body. Output: [`_docs/graph-tuning.md`](graph-tuning.md) — findings labeled confirmed vs hypothesis, proposals P1 (role files, context diet, engineer smoke-only, mini-agent rework, escalation protocol, reliability clauses), P2 (optional experiments), P3 (workflow-based model assignment, later), a measurement plan for the next cycle with targets and a verdict-integrity checklist, and an owner approval checklist.

**Confirmed constraints discovered:** `GLM-5.3-Flash` exists in the plan but the Agent tool exposes no per-call model parameter, and the read-only `Explore` type maps to an unavailable model — per-role model selection is unreachable today; the dynamic-workflows `subagent_model` is the migration path (deferred to an M5/M6 pilot).

**Dependency reconciliation (applied — factual, not tuning):** issue #2's Docker-build job needs #3's Dockerfile; issue #2's `Depends on` updated to #3, and `_docs/backlog.md` (edge `#3 → #2`, parallelism notes, #1 merged marker) updated accordingly. Next cycle is therefore #3.

### Lessons

- The measure-then-evaluate loop the plan mandates is already paying for itself: every proposal in the tuning doc traces to a measured number or a documented incident, not to taste.
- The two biggest confirmed wastes were *process*, not models: duplicated full verification (engineer + QA) and resume-cost on surgical fixes — both fixable without touching verdict independence.

### Next

Owner approves/adjusts the P1 package (and P2/P3 dispositions); the #3 cycle then runs with the approved tuning and is measured against the §4 plan.

## 2026-10-16 — Cycle #3 (issue #3, PR #13): tuned graph loop, measured against the #1 baseline

### What and why

Second full graph cycle, first under the approved tuning package (P1.1–P1.6 of [`graph-tuning.md`](graph-tuning.md)); P2 deferred and P3 (no model-assignment migration) per the owner's decisions of this morning. Issue #3 delivers the single-container Dockerfile and the Compose stack with Postgres 15 (rubric #8), plus `DATABASE_URL` configuration plumbing and SPA serving of `frontend/dist`.

### Session and model configuration (declared vs verified)

- **Verified:** main session on `GLM-5.3-Flash` (`ListModels` → `[current]`), switched manually by the owner from `GLM-5.3` (reasoning max) used in cycle #1. Declared as a **confounding variable** for every comparison below.
- **Verified:** the `Explore` subagent type fails with `model-not-found; selection=…/GLM-5-Turbo`. The owner reports the settings allow `Explore` to be assigned "inherit" / GLM-5.3 / GLM-5.3-Flash — the failure is a settings value, correctable by the owner (not changed by the orchestrator per mandate). The reviewer ran as `general-purpose` under an instruction-level read-only wall (P1.6 fallback), both times.
- **Self-reported, unverified:** all five subagents (PM, engineer, QA, reviewer, mini-agent) reported `GLM-5.3-Flash`. Consistent with inheritance; the harness exposes no per-agent model or reasoning-level readout, so **effective subagent configuration is an observability limit**, recorded as such.

### Process changes actually applied

- **P1.1** role files committed before the cycle (`.agents/agents/{pm,engineer,qa,reviewer}.md`, commit `503e725`) — Module 5 convention (KB 04); also the extension pack's subagent artifact.
- **P1.2** cycle prompts carried only issue/PR numbers, the branch, cycle-specific nuances, and section pointers; roles read the brief, not the docs tree.
- **P1.3** engineer ran smoke only (pytest, image build, one `/health` curl, backend log grep, `compose down -v`); QA ran the **full** 8-check battery + guardrails independently.
- **P1.4** mini-agent used once for two `[minor]` reviewer findings (mechanical: pin uv image tag; add env-path tests) — 253k tokens, 18 tool uses, 4.6 min; both fixes passed the reviewer's rework verification and QA's targeted re-check. Within the authorized limits; no architectural implications.
- **P1.5/P1.6** no escalation needed; no stall; fallback for `Explore` applied once and recorded.
- Label management at cycle boundaries by the orchestrator (`in-progress` added at start; removal at merge).

### Outcome and independent verdicts

[PR #13](https://github.com/lucapug/clown-circus-reloaded/pull/13) — 5 commits (3 + 2 rework), 7 files. [QA VERDICT: PASS](https://github.com/lucapug/clown-circus-reloaded/pull/13#issuecomment-6218302675) 8/8 + guardrails; [REVIEW: REQUEST_CHANGES](https://github.com/lucapug/clown-circus-reloaded/pull/13#issuecomment-6218409910) (2 minor, 0 major) → mini-agent rework (`f0fbae9`, `4e6f5bc`) → [REVIEW: APPROVE](https://github.com/lucapug/clown-circus-reloaded/pull/13#issuecomment-6218569316) and [QA VERDICT (rework): PASS](https://github.com/lucapug/clown-circus-reloaded/pull/13#issuecomment-6218601332). Merge pending the owner. The reviewer stated it formed its findings before reading QA's verdict (independence rule).

### Measured ledger (subagent tokens; full table in `graph-tuning.md` §6.1)

PM 179,551 · engineer 460,117 · QA 533,389 · reviewer 243,311 · mini-agent 253,005 · reviewer close-out 152,796 · QA re-check 219,887 → **≈ 2.04M** (baseline #1: ≈ 6.67M). Tool uses 112 (vs 176); agent time ≈ 39.5 min (vs ≈ 100). Stalls 0 (vs 1); escalations 0 (vs 1); rework loops 1 (= #1); owner interventions during the cycle: none required (one PM open question deferred as non-blocking). Targets (≤ 3.5M total, engineer ≤ 2M, zero stalls): all met.

### Interpretation (kept separate from measurements)

- Confirmed: the two cycle-#1 incident classes did not recur; duplicated verification was removed with QA's battery unchanged; the reviewer still caught two real defects (so the tuned loop did not get blinder).
- Hypothesis: the −69% total cannot be attributed between tuning, Flash, and the smaller scope from one cycle. Structural savings (no duplicate battery, no resume cost, no stalls) are plausibly model-independent; per-pass token levels are plausibly model-dependent. A within-model comparison on a comparable issue is the clean next test.
- Quality: no regression observed on Flash in this cycle (correct implementation, honest deviations, defects found by the independent readers). One cycle is not a trend.

### Proposals (not applied — owner decision required)

See `graph-tuning.md` §6.5: consolidate into `process.md` (role files; smoke-only + full QA; escalation protocol; label management); keep mini-agent and reviewer fallback experimental; fix `Explore` settings owner-side; decide the backend-signal shape (log vs HTTP) before M3; consider a deliberate uv bump at M3. `process.md` is unchanged.

### Next

Owner reviews/merges PR #13 (#3 closes; label removed by the orchestrator). Next cycle: #2 (CI), now unblocked by the Dockerfile; #4 and #5 follow.

**Update (same day):** owner merged PR #13 (`0af88c0`) after own verification; #3 closed, `in-progress` removed by the orchestrator, branch deleted. Owner decisions on the tuning proposals recorded in `graph-tuning.md` §6.6 (consolidate role files; mini-agent one more experimental trial; `Explore` reassigned to GLM-5.2 for the next cycle's reviewer; dependency policy: prefer recent compatible versions over 2025 pins, uv 0.13.x candidate for M3). Draft `process.md` amendment in `graph-tuning.md` §7 — awaiting explicit text approval; `process.md` unchanged.

**End of day — priority for 2026-10-17 (owner):** the 2026 project rubric moved from *draft* to **final** today. Before any further backlog work, re-read the source page carefully (`DataTalksClub/ai-dev-tools-zoomcamp/project/README.md`; last verified 2026-10-15 at 14 criteria / 30 points), diff it against plan §4's rubric mapping and the expected repository contents, and propose plan amendments if anything changed. This is the "re-check before submission" task the plan scheduled (M0/M7), pulled forward by the final publication.

## 2026-10-17 — Final 2026 rubric analysis (source re-read; plan amendments proposed, not applied)

### Method

Fetched the final page from the source repo and diffed it against the draft captured on 2026-10-15 (plan §4 mapping built on that draft). Repo visibility verified (`gh repo view` → `private`). No plan or spec file modified — amendments proposed to the owner.

### Draft → final diff (facts)

- **Shape:** 14 criteria / 30 points → **12 criteria / 24 points, pass at 10** ("You do not have to score full marks on every criterion"). Deadlines live on the course platform; "roughly 20 hours of work spread across the second month"; second attempt = same project, same criteria. Peer review of 3 projects mandatory ("submitting without doing the peer reviews does not pass").
- **Removed as separate criteria:** Frontend (3), API Contract (2), Backend (3), Database Integration (2), Integration Testing (2, folded into Testing), AI-Assisted Development Workflow, Technologies & Architecture, Agent Extension Pack, Security/Audit/DevOps Hardening, Reproducibility. **The expected-repository-contents list (directories like `agent-capabilities/`, `security/`, `ops/`) is gone entirely.**
- **Added:** **Product Specification (0–2)** — spec + *"publicly accessible task tracker"* whose tasks define acceptance criteria **and evidence that the agents used the tracker**; **Agent Team Specification (0–2)** — team + how they work together; **Context Management (0–2)** — AGENTS.md pointing to modular docs; **Observability (0–2)** — a key user journey with **metrics + traces + structured logs sharing a trace ID**, no customer data or credentials in telemetry, collected and viewable in a UI; **Alerting on User Impact (0–1)** — at least one alert; **On-Call Agent (0–2)** — "an agent wakes up on an alert and fixes the issue".
- **Reshaped:** **CI/CD is now 0–3** — CI tests on PRs (1), CD auto-deploys (2), **CD to dev + manual deploy to production (3)**. Application (0–2) requires full-stack end-to-end *and* "runs locally with a single command". Testing (0–2) requires **both unit and integration**, single command, passing. Containerization (0–2) requires the full system including DB via Compose, single command.

### Impact on our plan (analysis)

- **Ops is no longer a paced experiment — it is 5 graded points** (Observability 2 + Alerting 1 + On-Call 2). Our D7/D8 were built exactly for this, but the C1 cut list (downgrade drill to tier 2; reduce alerts) and the M5 SHOULD tiering now directly sacrifice points. **Amendment proposed:** M5 becomes rubric-critical (MUST): correlated-signature instrumentation (FastAPI native OTel already available, issue #4), one user-journey trace (submit-score), 1+ actionable alert, on-call agent tier 1 in dev. New hard requirement: **no customer data (leaderboard names!) or credentials in any telemetry signal** — mask/omit in spans, attributes, logs.
- **CI/CD 3-point level = exactly our D6 architecture** (dev CD + manual prod promotion). No change needed — it was already the plan; the rollback path now feeds this criterion's spirit.
- **Public task tracker:** our GitHub Issues satisfy "tasks with acceptance criteria + evidence agents used the tracker" (groomed bodies, agent comments, PR cross-refs), but the repo is **private** → not publicly accessible → max 1/2 on that criterion. **Owner decision needed:** make the repo public (also eases Deployment evidence and peer review) or accept 1/2. Recommendation: go public — nothing in the repo is sensitive (no secrets; dev-only compose credentials are standard placeholder literals).
- **Agent-workflow documentation now carries 6 points** (Product Spec 2 + Agent Team 2 + Context 2). We are structurally ahead: `.agents/agents/*.md` role files + graph lifecycle = Agent Team evidence; AGENTS.md → `_docs/*` = Context Management; the draft `process.md` §8 amendment makes the team documentation explicit and should be approved soon.
- **Dropped criteria ≠ dropped work:** frontend/backend/API/DB quality still feed Application (2); the security layer (scanners in #2, audits, tool/data policy) is no longer a graded category — keep it at planned scale (it is cheap, feeds "no credentials in telemetry", and remains good practice) but it no longer justifies extra depth. The extension-pack-style artifacts (permissions notes, hooks) stay because they evidence Agent Team/Context, not for a dedicated criterion.
- **Derisking:** pass bar is 10/24; with the amendments our realistic ceiling is ~22–24. Deadline remains owner-stated 2026-10-26.

### Proposed plan amendments (pending owner approval)

1. Rewrite plan §4 (rubric mapping) to the final 12-criterion table; note 24 pts / pass 10.
2. M5 re-tiered MUST for Observability + Alerting + On-call tier 1; security layer kept at planned scope, explicitly non-graded.
3. C1 cut list revised: remove items 2 and 4 (they now cost points); replacement cuts: extended E2E scenarios, contract-drift automation, local observability stack (unchanged), Grafana dashboard depth beyond the key journey.
4. New D11 decision (owner): repo public vs private (recommendation: public).
5. Prioritize approving `process.md` §8 (Agent Team evidence) and keep the planned `docs/permissions.md`-style notes as Agent Team documentation.
6. Add to D7/issue #4 acceptance criteria: trace-ID correlation across a user journey + zero customer data in telemetry.

### Owner decisions (2026-10-17, taken one at a time) and application

1. **D11 — tracker/visibility:** repo stays **private during development**, goes **public immediately before submission with the SHA pinned** (owner's standard capstone practice; M7 task). The tracker evidence = closed issues with AC + agent-work comment sequences.
2. **Tracker attribution problem (owner-raised):** all GitHub content is posted through the single owner account, so roles are invisible at author level. Analysis of the closed issues showed the roles ARE structurally distinguishable (formats matching versioned role files committed beforehand; causal chains PM-brief → QA → REQUEST_CHANGES → fix SHAs → APPROVE → re-check; role-consistent absences). **Applied package:** mandatory visible attribution header on every agent comment (`[ROLE · role file@sha · posted-by lucapug, content authored by the role agent]`), `Assisted-by: ZCode-<role>` Git trailers on future commits, and `docs/agent-work-evidence.md` indexing the pre-convention artifacts — issues untouched. Committed in `a314f8f`.
3. **M5 re-tiering:** MUST (option 3 variant) — the *minimal instrumentation + export* is pulled into issue #4 (today), while dashboards, alerts, and the drill stay in the M5 window (owner's explicit scoping).
4. **C1 cut list revised:** ops items removed from the cut (graded points); remaining cuts: two-session E2E → trivy/drift/local-stack → dashboard depth → rollback-drill-to-paper → graph fallback as last resort.
5. **plan.md rev 2:** §4 rewritten to the final rubric; D11 added; M1/M5/M6/M7 rows updated; status line records the final-rubric alignment.
6. **`process.md` §8 applied** with the two approved integrations (attribution header convention; observability tiering + no-customer-data rule) plus the dependency policy.

### Lessons

- The final rubric inverted the draft's emphasis: the two categories the discovery report flagged as *new graded areas* (extension pack, security) are gone as criteria, while operations went from "not a line item" to 5/24 points. Lesson reinforced: re-read primary sources at every transition; the plan's scheduled re-check caught this within one day of the change.
- Single-account attribution is a real evidentiary constraint of agent-driven development; solving it with structural evidence (formats ↔ versioned files ↔ causal chains) rather than synthetic identities keeps the evidence honest and the constraint disclosed.

### Next

Backlog resumes: cycle **#2 (CI)** — reviewer via `Explore` (GLM-5.2) in parallel with QA; attribution headers active from this cycle's first comment; #4 follows with the upgraded acceptance criteria.

## 2026-10-17 — Cycle #4 (issue #2, PR #14): first zero-rework cycle; Explore reviewer works

### What and why

Third graph cycle, first under `process.md` §8 with attribution headers, and the first cycle to complete with **no rework loop** (verdicts: no blockers/majors/minors). Issue #2 delivers the CI workflow: 6 parallel jobs (frontend lint+test+build; backend ruff+pytest; docker build; pip-audit + npm audit report-only with archived artifacts; gitleaks hard gate), ruff added to the backend, Vitest placeholder in the frontend, README badge.

### Model configuration this cycle (declared vs verified)

- Main session: `GLM-5.3-Flash` (owner-set). PM/engineer/QA: general-purpose subagents (model self-reported Flash in past cycles; this cycle's self-reports not separately recorded — observability limit unchanged).
- **Reviewer ran via the `Explore` type for the first time** (owner reassigned Explore to GLM-5.2 after the model-not-found incidents): worked. Its verdict declared the attribution header correctly and produced a high-value forward-looking finding — `cancel-in-progress` on the CI concurrency group will endanger in-flight deploys once CD lands in M4 (#5 must split the group or scope it). Per-role model assignment is now real (albeit by subagent type, not per role): a data point for the P3 discussion, honestly confounded as always.

### Outcome and independent verdicts

[PR #14](https://github.com/lucapug/clown-circus-reloaded/pull/14) — 4 commits, 6 files. CI run 39064777895 on the real PR trigger: **6/6 jobs green in 32 s** (target < 5 min). [QA VERDICT: PASS](https://github.com/lucapug/clown-circus-reloaded/pull/14#issuecomment-6240232828) 7/7 + guardrails, evidence independently re-run (incl. artifact download/validation and the first-run gitleaks 403 as gate-liveness proof). [REVIEW: APPROVE](https://github.com/lucapug/clown-circus-reloaded/pull/14#issuecomment-6240137488), 0 blockers/majors/minors, 6 notes (digest-pin and `:ro` mount for the gitleaks container as optional hardenings). Deviations disclosed by the engineer and confirmed equivalent by both readers: gitleaks-action@v2 failed (action-level 403) → the brief's pre-approved container fallback (`gitleaks:v8.30.1`, pinned tag). Branch protection refused on the private repo (403 "Upgrade to GitHub Pro or make this repository public") — recorded as owner follow-up; directly relevant to D11 (the flip at submission enables it). Merge pending the owner.

### Measured ledger

PM 214,594 · engineer 903,620 (higher than #3's 460k — CI-iteration waits and the gitleaks fallback fix) · QA 364,880 · reviewer 419,708 (GLM-5.2) → **≈ 1.90M** total, 103 tool uses, ≈ 38.6 min agent time. Stalls 0, escalations 0, **rework 0**. vs #3 (≈ 2.04M with 2 rework passes) and #1 (≈ 6.67M with stalls + escalation + rework). Confounders as always: model mix changed (reviewer on GLM-5.2), scope differs.

### Lessons

- Zero-rework happened the cycle after rework-focused tuning (mini-agent for minors, reviewer severity taxonomy) — plausibly the conventions are raising engineer first-pass quality; two clean cycles would be a trend.
- The reviewer's M4 risk (concurrency group vs in-flight deploys) is exactly the kind of catch the independent-reader design is for — recorded in the #5 context.
- Attribution headers worked on all four comments (PM/ENGINEER/QA/REVIEWER) with one self-corrected formatting slip by the reviewer (disclosed, fixed via comment edit before any other write).

### Next

Owner reviews/merges PR #14 (#2 closes; label removed by the orchestrator). Then #4 (OTel, upgraded AC) and #5 (dev deploy Render+Neon — owner-side account creation can start in parallel).

**Update (same day):** owner merged PR #14 (`a6d216e`) after own review (including the Vitest-placeholder question — answered: deliberate scope decision; the `--passWithNoTests` flag will be removed in #6's first real-test commit so "no tests found" fails again). #2 closed, label removed, branch deleted, backlog map updated. M1 progress: 3 of 5 issues merged (#1, #3, #2); remaining #4 (OTel) and #5 (dev deploy).

## 2026-10-18 — Cycle #5 (issue #4, PR #15): native OTel verified; second consecutive zero-rework cycle

### What and why

Issue #4 delivers the minimal ACTIVE OpenTelemetry instrumentation (final-rubric alignment): `fastapi[opentelemetry]` extra + a ~10-line LoggingHandler bridge in `backend/app/main.py` (attach in lifespan, detach on shutdown, one INFO line in `health()`), everything else env-only. Owner-side progress for #5 reported same morning (Render account + 2025 project exist; Neon account without projects — steps given: new Neon project, new separate Render web service with `DATABASE_URL`).

### How — key technical findings (for the record)

- The PM **verified the native-OTel mechanism against the FastAPI 0.143.2 tagged source and live docs**: `FASTAPI_OTEL_AUTO_CONFIGURE` is the enable switch (default False — the framework's dormant default IS the issue's requirement); extra = `fastapi[opentelemetry]` (sdk + otlp-proto-http ≥1.44.0); auto-config is http/protobuf-only (port 4318, not 4317) and runs before lifespan. This **corrected the orchestrator's 2026-10-15 note** on #4 (the env var is the enable switch, not a flag atop an always-on default).
- Native logs fire only on validation failures/unhandled exceptions — so the bridge makes the correlation demo deterministic (a successful `/health` emits a correlated log record).
- Engineer reproduced a brief discrepancy: the suggested Tempo `tags=` query returns empty on the current `otel-lgtm` image; TraceQL `{resource.service.name=…}` works (~20 s indexing delay) — adapted within the brief's "observables are the contract" clause, disclosed.

### Outcome and independent verdicts

[PR #15](https://github.com/lucapug/clown-circus-reloaded/pull/15) — 2 commits, 3 files (main.py +8/−1, pyproject, uv.lock). CI 6/6 green on the PR. [QA VERDICT: PASS](https://github.com/lucapug/clown-circus-reloaded/pull/15#issuecomment-6250746373): all 7 ACs re-run independently against a fresh `otel-lgtm` receiver — real three-signal correlation verified (Tempo trace `34554f79…`, Prometheus `http_server_request_duration_seconds_*` + `target_info` with service/environment/version labels, Loki record carrying the **same trace_id and span_id**); no-customer-data grep clean; no-env path a verified no-op. [REVIEW: APPROVE](https://github.com/lucapug/clown-circus-reloaded/pull/15#issuecomment-6250715034) — zero blockers/majors/minors; forward flags for M3 (unhandled-exception logs can carry messages → logging-content rule when `/scores` lands; `code_file_path` absolute paths in Loki labels) and M5 (env-only contract reusable for Grafana Cloud via `OTEL_EXPORTER_OTLP_HEADERS`). Merge pending the owner.

### Measured ledger

PM 321,402 · engineer 816,750 · QA 983,832 (container-based verification is expensive — noted for methodology) · reviewer 240,651 (Explore/GLM-5.2) → **≈ 2.36M**, 99 tool uses, ≈ 16.2 min agent wall time. Stalls 0, escalations 0, **rework 0 (second consecutive)**. Confounders unchanged (model mix, scope).

### Lessons

- Primary-source verification by the PM (FastAPI tagged source) beat both the orchestrator's earlier note and general knowledge — worth the ~6 tool uses it cost.
- Two consecutive zero-rework cycles is now a pattern candidate: the role files' comment formats + severity taxonomy seem to be raising first-pass quality. Keep measuring.
- QA's container-based batteries are the most token-expensive pass type; the P2 "artifact reuse" experiment remains deferred but this is where it would pay.

### Next

Owner merges PR #15 (#4 closes). Then #5 (dev deploy): owner executes the two platform steps (Neon project; separate Render web service with `DATABASE_URL`), agents deliver the `ops/` runbook and verify the public `/health`. M2 (#6, game core under TDD) starts as soon as M1 closes — the critical path is ready.











## 2026-10-18 — Cycle #6 (issue #5, PR #16): dev-deploy runbook; a false-positive FAIL resolved with evidence

### What and why

Owner executed the #5 platform steps manually (Render web service `clown-circus-reloaded`, Docker runtime, Frankfurt, health check `/health`, `DATABASE_URL` from the new Neon project — credentials only in platform secrets). Live verification at cycle open: `https://clown-circus-reloaded.onrender.com/health` → `200 {"status":"ok"}` in 0.27 s. The cycle's deliverable was the **reproducibility artifact**: `ops/dev-deploy-runbook.md` (+ a one-line `ops/README.md`), docs-only.

### Outcome and independent verdicts

[PR #16](https://github.com/lucapug/clown-circus-reloaded/pull/16) — 1 commit, 2 files, CI 6/6 green. [QA VERDICT: PASS](https://github.com/lucapug/clown-circus-reloaded/pull/16#issuecomment-6251093520) after amendment (original FAIL, see incident below; the audit trail of the false positive is preserved inside the verdict comment); [REVIEW: APPROVE](https://github.com/lucapug/clown-circus-reloaded/pull/16#issuecomment-6251085883) with 4 notes (Name field omission in the runbook's Render table; M4 "settings superseded" clause to add when the GHCR flow lands; trailer typo noted; Docker-command abbreviation). Merge pending the owner — **closing M1 at 5/5**.

### Incident: a false-positive QA FAIL, resolved with evidence

QA failed the PR for a third modified file (`_docs/backlog.md`) — actually the orchestrator's close-out commit `9975556`, landed on `main` AFTER the branch was cut, rendered reversed by a two-dot `git diff origin/main..HEAD`. Resolution: authoritative file list via `gh pr view --json files` / `gh pr diff` (merge-base) → exactly the 2 ops files; QA verified the topology itself (`rev-list` count on the file = 0; `origin/main` tip directly above the branch point) and amended its own comment in place (single-comment invariant kept, edit disclosed). Root cause fixed at source: `qa.md` prescribed the defective two-dot form — now defines `gh pr diff <n> --name-only` as the authoritative list (commit `1493167`).

### Orchestrator stumbles (recorded honestly)

Twice today I edited/committed while the working tree was left on a PR branch by a returning agent: one diary edit needed a re-read, and the qa.md fix commit landed on the PR branch first (moved to `main` by cherry-pick `1493167`; PR branch realigned to its remote state — no PR contamination, verified). Standing fix: the orchestrator checks `git status --short --branch` before ANY repo edit, and always returns the tree to `main` after agent cycles.

### Measured ledger

PM 167,803 · engineer 330,092 · QA 294,777 + 262,121 (amendment) · reviewer 126,529 (Explore/GLM-5.2) → **≈ 1.18M**, 77 tool uses. Stalls 0, escalations 0, rework 0 (the FAIL→PASS was an orchestrator-resolved false positive, not a code rework). Smallest cycle so far — consistent with a docs-only issue.

### Lessons

- The diff-method defect was MY prompt design, not agent error — third prompt-borne incident class fixed at the role-file source (after anti-hang and execute-only). Role files compound: every fix makes all future cycles safer.
- Diverging independent verdicts are the system working: two readers, two diff methods, one dispute — resolved by primary evidence, transparently, with the audit trail left visible on the PR.
- Docs-only cycles cost ~⅕ of a code cycle; the M6 documentation milestone will be cheap where it reuses this pattern.

### Next

Owner merges PR #16 (#5 closes; label removed; **M1 complete**). Then M2 opens with #6 (deterministic game core, TDD; first real test commit also removes `--passWithNoTests`). The critical path (#1→#6→#7→#8→#9→#10) is fully unblocked and C1 (Oct 21) looks comfortably ahead.

## 2026-10-18 — Cycle #7 (issue #6, PR #17): the deterministic game core, TDD flagship

### What and why

The critical-path start of M2 and the project's hardest correctness artifact: the fixed-tick deterministic game core (1 tick = 1/60 s accumulator-decoupled from rendering, mulberry32 seeded RNG hand-rolled, input queue drained at tick boundaries, semi-implicit Euler physics in the pinned 8-step order, typed event surface with a `ConsequenceReducer` seam for #7/#8, kernel never writes stats). The owner's same-morning reminder — the 2025 baseline is always available as the physics reference — was applied directly: the PM brief cites `useGameEngine.ts@0d365e6` line-by-line (10 "baseline behaviors adopted"), the baseline clone was refreshed at the pinned SHA, and two baseline-fidelity decisions were adopted with owner-defensible defaults (fall-off respawn → right board; initial seat ±width/3 quirk).

### Outcome and independent verdicts

[PR #17](https://github.com/lucapug/clown-circus-reloaded/pull/17) — 5 commits in the brief's TDD slices (commit 1 intentionally RED + `--passWithNoTests` removed), 14 core/test files + 5 golden fixtures. CI 6/6. [QA VERDICT: PASS](https://github.com/lucapug/clown-circus-reloaded/pull/17#issuecomment-6252192733) — the strongest verification of the project: QA **re-implemented the spec independently in a /tmp clone and replayed scenario (a)** — ticks 1 and 30 byte-identical to the committed fixture including the seeded vx; negative-tested the purity boundary (planted react/window file → tests fail); verified the TDD claim live (checked out the red commit → suite red). [REVIEW: REQUEST_CHANGES](https://github.com/lucapug/clown-circus-reloaded/pull/17#issuecomment-6252142403) — 1 [minor]: golden fixtures snapshotted state only, not events (brief decision 1), leaving event-emission order unpinned; → **mini-agent rework #2** (`57874cb`: fixtures regenerated with per-tick event arrays, state bytes proven unchanged pre/post, tests byte-compare both) → [REVIEW: APPROVE](https://github.com/lucapug/clown-circus-reloaded/pull/17#issuecomment-6252262931). Merge pending the owner.

### Measured ledger (the most expensive cycle — on the hardest artifact)

PM 331,375 (first attempt cancelled by interruption, unmeasured) · engineer 5,309,632 (largest single pass ever) · QA 1,701,363 (independent spec re-implementation) · reviewer 557,867 (Explore/GLM-5.2) · mini-agent 525,807 · reviewer close-out 377,165 → **≈ 8.60M**, ~205 tool uses, ≈ 62 min agent wall time. Stalls 0, escalations 0, 1 rework loop (mini-agent, within P1.4 limits — second successful trial). Baseline: #1 was 6.67M on a scaffold; #6 is 8.60M on the parity-critical core with an order-of-magnitude stronger verification. Confounders as always.

### Lessons

- The owner's baseline reminder was load-bearing: line-cited baseline behaviors turned "reproduce the 2025 physics" from a vibes-problem into an arithmetic one — the same lesson as the spec constants, applied at implementation depth.
- QA's independent re-implementation is the gold standard for parity-critical code: expensive (1.7M), but it converts "tests pass" into "the spec, replayed from scratch, produces these bytes". Reserve it for the core; don't let it become the default battery.
- Mini-agent trial #2: this rework was bigger than trial #1 (5 fixtures + test logic vs 1 file delete) and still landed surgical, byte-safe, and disclosed — two positive trials; the consolidation proposal for `process.md` gains evidence.
- Event fixtures matter downstream: the reviewer's catch protects #7/#8, whose reducers consume exactly that order.

### Next

Owner merges PR #17 (#6 closes; label removed). Then #7 (scoring/lives consequences on the event seam), #8 (progression + bonusJumps Option A), #9 (shell/screens + E2E hooks), #10/#11 parallelizable. C1 (Oct 21 EOD): game playable locally, core tests green — today's result makes that checkpoint look comfortably reachable.

**Correction (same entry, same evening):** the diary commit above was initially made on the PR branch (third occurrence of the orchestrator's branch-switching stumble — this time immediately after writing the standing rule). Moved to `main` via cherry-pick; the PR branch realigned to its remote state before merge. The rule becomes mechanical: **no repo edit without a green `git status --short --branch` check in the same command**, and cycles always end with the tree returned to `main`.
### Owner decision + rework loop 2 (same cycle): free-side entry rule

The owner clarified gameplay intent on the brief's two open questions: (1) a dead clown does not "return" — the NEXT clown enters, and the entry side is the **free end of the seesaw** (state-derived), overriding the baseline's always-right fall-off hardcode; note that `product-spec.md` §3.4 already prescribed free-side — the brief's adopted behavior was the deviation, and no role flagged the brief-vs-spec conflict (lesson: conflicts → spec wins + escalate; recorded). (2) High vs low entry trampoline stays OPEN (spec §3.1 pins only geometry; no design decision covers it) — interim high behind the named constant `RESPAWN_BOARD_HEIGHT_INDEX` with a TODO(owner), ACs assert the side rule not the height. Decision posted on #6 (comment 6252402875); engineer rework `562247f` (fall-off → free side, side-pair tests + no-seated fallback, only `golden-c-fall-off.json` regenerated — byte-gate verified independently: `a-seed42`'s fall-off death happened when free side WAS right); targeted re-checks both green: [QA (rework): PASS](https://github.com/lucapug/clown-circus-reloaded/pull/17#issuecomment-6252519499), [REVIEW: APPROVE](https://github.com/lucapug/clown-circus-reloaded/pull/17#issuecomment-6252585711). Rework cost 4.95M — the resume of the 5.3M engineer context (A7 pattern); correct price for a requirement change (P1.4 forbids mini-agents there).

**Open gameplay question queued for the owner (non-blocking, reviewer finding):** middle/occupied-edge entries derive the side from the dying clown's last side (2025 behavior), while the free-end rule is phrased from the seated receiver's perspective — the derivations can diverge in some states. Owner to decide whether unification is desired.

### Next

Owner merges PR #17 (#6 closes; label removed; `RESPAWN_BOARD_HEIGHT_INDEX` decision queued). Then #7 (scoring/lives consequences on the event seam) — the core seam designed exactly for it.

**Correction 2 (immediate):** the update above was committed a FOURTH time on the PR branch — the in-chain `git status` check informed but did not gate. The rule is now mechanical and tested by use: the FIRST command of every orchestrator repo-write is `git checkout main` (normalizes the tree unconditionally; agents may legitimately leave the tree on their PR branch), never a check-and-continue.

**Correction 3:** the conflicted cherry-pick was committed with unresolved markers (`46c63fc`); resolved here. The checkout-first rule extends: after ANY cherry-pick/rebase, verify clean status before continuing — conflicts are resolved consciously, never auto-committed by a chained command.

## 2026-10-19 — Owner decisions B & C recorded; gameplay-progression consultation (A) delivered

- **B (decided):** unify all three death-entry causes to the free-side derivation (receiver's perspective) — issue [#19](https://github.com/lucapug/clown-circus-reloaded/issues/19) created and groomed; scheduled after #8. This is spec-§3.4 conformance, not a spec change.
- **C (decided):** the resolved-database signal stays **log-only** (startup line, credentials masked). `/health` keeps the exact pinned body `{"status":"ok"}`. The open question (log vs HTTP) is closed; M3's PM brief will carry this.
- **A (consultation, no decision yet):** the owner proposed a difficulty-progression concept (per-level speeds; high/low entry randomization from ~level 3; birds altering trajectories later; combinations) and asked for a motivated recommendation against the Oct-26 submission, explicitly not presuming implementation. Verification performed on the actual core: `levelMult = 1+0.25(level−1)` scales **launch vx only** (engine.ts:117/126/293); launch vy is per-bounce progression (−0.2 → −17, reset on death), NOT per-level; the seesaw is mouse-driven (no speed parameter exists); the balloon grid regenerates **identically** each level; entry height is the isolated `RESPAWN_BOARD_HEIGHT_INDEX` (interim high). Recommendation delivered to the owner (see conversation; summary in the next diary entry once decided): formalize what already exists (M1), implement high/low entry randomization as one small cycle if the M2 tail stays on track (M2), defer the birds mechanic and combinations to the second attempt (M3/M4 — new entity + physics + rendering on the parity-critical core, zero rubric value, competes with the 5-point ops milestone). PR #18 (#7) still at the owner's merge gate.

**Update (same day):** owner merged PR #18 (`af6de95`) — #7 closed, M2 at 2/6. Owner decisions on the progression consultation (A): M1 formalized as already-present (levelMult on vx; vy stays per-bounce per the pinned spec — no change); **M2 = issue #20** (entry-height randomization from **level 4**, 50/50, seeded RNG, conditional on #11 + #9/#10 on track, defer without compressing gates — owner-mandated wording); **M3/M4 (birds, combinations) → second attempt**, recorded in plan §6's deferred list. Plan updated and pushed.

## 2026-10-19 — Cycles #8 (issue #7, PR #18) and #9 (issue #8, PR #21): scoring + bonusJumps — the event seam pays off

### What and why

#7 merged by the owner (`af6de95`, M2 at 2/6): scoring/lives consequences as a pure fold on the #6 event seam — kernel untouched, single source of truth realized (the 2025 tested-but-never-imported defect now structurally impossible), 67 tests. #8 delivered the approved 2026 design decision A: one bonusJump is consumed instead of a life on death (per-event, emission order; same-tick earn-then-spend pinned as correct — PM's disclosed judgment call, reviewer concurred), plus the exhaustiveness `never` guard on the fold (PR #18's reviewer note, pre-assigned here).

### Outcome and independent verdicts

[PR #21](https://github.com/lucapug/clown-circus-reloaded/pull/21) — 2 commits (red tests-only → green), 4 files, 73 tests. [QA VERDICT: PASS](https://github.com/lucapug/clown-circus-reloaded/pull/21#issuecomment-6264782331): every §3.3 AC live-path; the guard's compile-enforcement independently reproduced in /tmp (injected unhandled variant → TS2322) AND the brief's literal `?.type` form compiled to confirm the engineer's deviation was necessary (TS2339). [REVIEW: APPROVE](https://github.com/lucapug/clown-circus-reloaded/pull/21#issuecomment-6264768942), zero findings above [note]; relays for #9: death feedback (SPLAT/sound) must key off the `death` event even when jump-absorbed (spec §3.3), and the HUD "Jumps" visibility needs a design call. Engine.ts and golden fixtures byte-identical to main in both PRs.

### Measured ledger (cycle #9)

PM 434,950 · engineer 1,578,345 · QA 861,504 · reviewer 188,487 → **≈ 3.06M**, 116 tool uses. Zero stalls, zero escalations, zero rework — a gameplay-behavior change landed in one pass at the cost of a docs cycle. The #6 seam design is directly responsible: consequences changes never touch the kernel.

### Decisions recorded this session

B → issue #19 (side-derivation unification, after #8); C → log-only (question closed); A → M1 formalized as already-present, M2 = issue #20 (level 4, 50/50, seeded, conditional on #11 + #9/#10 on track, defer without compressing gates — owner-mandated), M3/M4 (birds, combinations) → second attempt (plan §6 updated, `a9c0679`).

### Next

Owner merges PR #21 (#8 closes; M2 at 3/6). Then #19 (small, side unification) and #9 (shell/screens/E2E hooks — the big one; carries the #9 relays above). C1 (Oct 21): on track.

## 2026-10-19 — Cycle #10 (issue #19, PR #22): free-side unification — zero rework, byte-gate methodology validated

### What and why

Owner decision B implemented: all three death causes enter on the free seesaw end derived from the currently seated clown (receiver's perspective); 'right' fallback when none seated; height decision point untouched. Restores full §3.4 conformance and resolves the PR-17 reviewer's divergence finding.

### Outcome and independent verdicts

[PR #22](https://github.com/lucapug/clown-circus-reloaded/pull/22) — 3 commits (red tests → green engine → 3 fixtures regenerated), 5 files. [QA VERDICT: PASS](https://github.com/lucapug/clown-circus-reloaded/pull/22#issuecomment-6266575151): discriminating tests verified to fail under the old derivation; byte-gate independently confirmed (only b-chain/c-middle/c-occupied-edge changed; b-chain only at snapshot 300); kernel hygiene (seam, fold order, height constant untouched). [REVIEW: APPROVE](https://github.com/lucapug/clown-circus-reloaded/pull/22#issuecomment-6266535322) — zero findings above note; confirms #20 composes cleanly with the single derivation point. Merge pending the owner.

### Measured ledger

PM 860,581 (included a /tmp byte-gate probe that predicted the divergent fixtures before implementation — the probe became the QA verification target) · engineer 1,895,405 · QA 741,586 · reviewer 218,198 → **≈ 3.72M**, 116 tool uses. Stalls 0, escalations 0, rework 0.

### Lessons

- The PM's pre-implementation probe (byte-gate predictions) doubled as the acceptance oracle: QA verified the predictions, not just the outcome — methodology worth reusing for fixture-touching cycles.
- Diary-pass convention (owner-approved): this entry is the first written once, at cycle close-out, from `main` — the branch-switching incident class ends here.

### Next

Owner merges PR #22 (#19 closes; M2 at 4/6). Then **#9 (shell/screens/E2E hooks — the big one**, carrying the relays: death feedback keyed on the event even when jump-absorbed; HUD "Jumps" visibility design call), **#10 services/offline**, **#11 audio**, then the conditional **#20** (only if on schedule). C1 (Oct 21 EOD): on track.

## 2026-10-19 — Cycle #11 (issue #9, PR #23): the game becomes playable — biggest cycle, live-browser QA

### What and why

The presentation cycle over the deterministic core: canvas shell (verbatim visual port of the baseline GameCanvas draw code), HUD (Jumps always visible — owner decision), start/game-over screens, floating texts from events (presentation queue), LeaderboardService thin boundary + stub for #10, DEV-gated `window.__game` debug API for M4's Playwright, and the one permitted core change: `advance` gained an optional `inputs` parameter drained on the first executed tick (the PM found the #7 wiring contract couldn't deliver inputs otherwise; fixtures byte-untouched, 74 prior core tests unchanged).

### Outcome and independent verdicts

[PR #23](https://github.com/lucapug/clown-circus-reloaded/pull/23) — 7 commits, 22 files, 114 tests (74 core untouched + 40 new RTL). CI 6/6. [QA VERDICT: PASS](https://github.com/lucapug/clown-circus-reloaded/pull/23#issuecomment-6268104618) — first **live-browser verification** of the project: dev server + real clicks/keys; observed a jump-absorbed death in-browser (bonusJumps 2→1, lives stayed 3) and the full game-over→save→Play Again flow; production-gating grep on dist; kernel-hygiene greps. [REVIEW: APPROVE](https://github.com/lucapug/clown-circus-reloaded/pull/23#issuecomment-6268003968) — line-by-line visual conformance vs the baseline ("verbatim port"), DEV-gating re-verified in the shipped dist, relays recorded: M4 (`advanceTicks` + live-loop interleave → `reset(seed)` before exact-state assertions) and #10 (service errors swallowed → always-resolve or revisit; `rank` render-inert). **Visual parity judgment is the owner's**, via the side-by-side runbook in the PR body (run 2025 locally from the pinned clone + 2026 locally, compare). Merge pending the owner.

### Measured ledger (the largest cycle)

PM 556,604 · engineer 6,820,373 (largest single pass — UI surface + RTL stack) · QA 2,109,551 (live-browser first) · reviewer 941,312 (line-by-line visual conformance) → **≈ 10.43M**, 244 tool uses, ≈ 49 min agent wall time. Stalls 0, escalations 0, rework 0. The scale is intrinsic (half a UI + a testing stack); the M2 tail cycles (#10, #11, #20) are all smaller surfaces.

### Lessons

- The PM's pre-flight discovery (the `advance` inputs gap) prevented what would have been a mid-#9 architecting scramble — the brief-and-verify pattern at its best.
- Live-browser QA is worth its cost exactly once per UI-heavy milestone; component tests carry the repeatable load.
- The two independent readers again split the work productively: runtime behavior (QA) vs normative conformance (reviewer) on the same PR, neither reading the other.

### Next

Owner reviews (side-by-side eyeball per runbook) and merges PR #23 (#9 closes; M2 4/6). Then #10 (services + localStorage offline), #11 (audio), conditional #20 — and C1 (Oct 21 EOD) with the game playable on dev.

**Recurrence note (cycle #11 close-out):** the diary commit stranded on the PR branch once more (5th) — this time the checkout was omitted entirely from the command chain while the status line showed the branch. Cherry-picked to main (`cd4d5bc`), PR branch realigned, no contamination. The definitive habit: the diary pass is a STANDALONE command whose first token is `git checkout main`; no other command may share its chain.

## 2026-10-19 — Owner gameplay consultation #2: jump earning v2 (launch streak) — spec §3.3 rewritten, conditional issue #24

### What and why

The owner, play-testing, identified a real design redundancy: the blue-row clear and the level completion nearly always coincide (the blue row sits on top; a completing flight pops it last), so the +1 jump reward measured progression, not skill. Their proposal: reward **consecutive launch cycles without a death** instead (safe edge landing → chain launch = one cycle; death resets). After clarifying the definition (their land-and-relaunch cycles, adopted — better than counting all launches), the mechanics estimate (~10-15 cycles per deathless level) drove the threshold choice: **100 would practically never fire (the 2025 dead-stat disease); 25 ≈ two deathless levels — occasionally achievable, and calibratable later with real M5 telemetry** (games played, jumps earned, max streak — the first concrete use of the observability milestone).

### Owner decisions

Threshold **25** (calibration parameter, lives in constants.ts, tune via M5 data); the streak **replaces** blue-row earning (blue row keeps 1000 points only — no double economy); death resets the streak (plus the #8 consumption rules); diving-board launches don't count. Spec §3.3 rewritten to v2 (commit `08b82a7`) including the splash lesson codified: HUD must show streak progress (`Streak: k/25`) and the start screen must state the mechanic — a reward the player cannot see accumulating is indistinguishable from randomness. Conditional issue [#24](https://github.com/lucapug/clown-circus-reloaded/issues/24) created (same binding scheduling discipline as #20: after #11 + #9/#10 on track, or defer to November with the spec written; owner picks which idea takes a single-slot window).

### Lessons

- Owner play-testing surfaced TWO layers the tests could not see: a communication gap (the mechanic was incomprehensible without a hint) and a design gap (the reward measured progression, not skill). Automated verification pins behavior; only play-testing evaluates whether the behavior is *worth having* and *understood*.
- The event seam made the v2 rule almost free to specify: `launched`/`death` events already carry everything the streak fold needs.

### Next

Owner merges PR #23 (after their side-by-side re-play) → #9 closes, M2 4/6. Then #10 → #11 → the conditional slot (owner picks #20 or #24). C1 Oct 21 EOD.

## 2026-10-19 — Cycle #12 (issue #10, PR #25): services layer + offline idempotent queue

### What and why

The §8 offline-resilience implementation: `SubmitScoreOutcome` typed service boundary (saved / queued / rejected — the honest-UI fix for the #23 relay), write-behind queue (enqueue BEFORE the POST — the crash-safe structure), FIFO drain re-using stored submissionIds (the §7 idempotency client side), localStorage cache with `source: live|cached`, mock mode for zero-backend development, and the UI honest states ("Saved offline — will sync"; never "Saved" on 4xx).

### Outcome and independent verdicts

[PR #25](https://github.com/lucapug/clown-circus-reloaded/pull/25) — 5 commits, 16 files, 169 tests. CI 6/6. [QA VERDICT: PASS](https://github.com/lucapug/clown-circus-reloaded/pull/25#issuecomment-6272744874): the brief's 7 case groups re-run (incl. the lost-response exactly-one-row at unit level: stub records the POST then throws; healthy reload drain syncs exactly once), browser DoD 4/5 from live (offline save → queued exactly once across reload). [REVIEW: APPROVE](https://github.com/lucapug/clown-circus-reloaded/pull/25#issuecomment-6272623636) after one [minor] rework loop: `enqueuePendingScore` outside the try (storage throw → unhandled rejection) → **mini-agent trial #3** (`2a309ed`: every storage call individually guarded; enqueue-throw semantics = POST still runs and its result decides — worst case saved without queue persistence, never an unhandled rejection; new test with mocked Storage throw) → [REVIEW: APPROVE](https://github.com/lucapug/clown-circus-reloaded/pull/25#issuecomment-6272862353). The live lost-response integration run stays explicitly not claimable until M3/M4 (stated in the PR).

### Measured ledger

PM 365,783 · engineer 6,067,368 · QA 2,522,196 · reviewer 463,026 · mini-agent 1,016,335 · reviewer close-out 306,379 → **≈ 10.74M**, 271 tool uses. Stalls 0, escalations 0, 1 rework loop (mini-agent trial #3).

### Lessons

- **Mini-agent cost variance is high**: trial #3 cost 1.02M for a one-line guard + test (vs 253k for trial #1) — the resumed-context baseline of these agents is not tiny. The P1.4 consolidation decision (post-M2) should weigh both the wins and this variance; a fixed-context micro-fixer might beat resume-style agents even at this scope.
- Queue logic is where state machines hide: the reviewer's §8.2-epistemics check (queued = "server state genuinely unknown", a truthful classification even when the enqueue failed) is exactly the kind of finding the independent pass exists for.
- Second-largest cycle in the project — UI/storage cycles are intrinsically expensive; the remaining M2 surface (#11 audio) is smaller.

### Next

Owner merges PR #25 (#10 closes; M2 5/6). Then **#11 (audio)** — last MUST of M2, carrying the new anti-overlap jingle AC — then the conditional slot (#20 vs #24, owner's pick). C1 (Oct 21 EOD): on track.

## 2026-10-19 — Cycle #13 (issue #11, PR #26): synthesized audio + jingle lifecycle — last MUST of M2

### What and why

The §4 audio implementation as a framework-free service (`createAudioService` + pure event mapper), lazy AudioContext on first gesture, permanent no-op when WebAudio is unavailable, all notes scheduled up-front on the AudioContext clock with every OscillatorNode tracked — implementing the owner-relayed anti-overlap AC (2025 defect: game-over jingle overlapped the new game's sounds).

### Outcome and independent verdicts

[PR #26](https://github.com/lucapug/clown-circus-reloaded/pull/26) — 4 commits (28 audio tests + 2 shell start-path tests, 200 total), wiring confined to CircusGame.tsx (audio? injection seam), CI 6/6. Pre-verification catch: the engineer disclosed that the START button didn't start the ambient (brief enumerated only two entry points) — routed back immediately (rework loop 1, `ae0304f`: all three entry points share the start path, order pinned by test) BEFORE spending independent-verification cost. [QA VERDICT: PASS](https://github.com/lucapug/clown-circus-reloaded/pull/26#issuecomment-6273669237): timbre constants verified verbatim vs the baseline (incl. the 26-node Funeral March and the ambient reschedule), lifecycle traced (stopAll stops every tracked node; fresh 24 after), mapper covers all 8 event variants. [REVIEW: APPROVE](https://github.com/lucapug/clown-circus-reloaded/pull/26#issuecomment-6273659382) — zero findings above note; two owner-listening notes: the same-tick final-death truncation (the anti-overlap makes the final death silent vs 2025's overlap — PM-specified behavior, on the DoD-4 listening list) and the nodes-Set retention (bounded, minor memory). Merge pending the owner.

### Measured ledger

PM 413,098 · engineer 2,826,398 + 684,759 (rework) · QA 931,179 · reviewer 404,869 → **≈ 5.26M**, 156 tool uses. Stalls 0, escalations 0, 1 rework loop (pre-verification catch — the cheapest kind).

### Lessons

- The engineer's own deviation disclosure + the orchestrator's read-before-verify caught the START-button gap before QA: the cheapest rework is the one caught at the return-reading stage.
- The anti-overlap AC inverted the 2025 defect into its mirror image (overlap → final-death silence): lifecycle fixes create their own audible artifacts — the owner's listening review is the real acceptance.

### Next

Owner reviews PR #26 (timbre + the two listening notes) and merges → **#11 closes, M2 5/6→ all 6 MUSTs done**; then the conditional slot (owner picks #20 entry-height or #24 streak — both specified), and C1 Oct 21 EOD. M3 (backend/DB/contract) is next after M2.

## 2026-10-19 — Fuzz investigation (2 rounds) + cycle #14 (issue #27, PR #28): lives-floor bugfix

### What and why

The owner, play-testing PR #26, reported an "inexplicable game-over" while playing level 2 with a jump earned. Two fuzz rounds on the deterministic core investigated: round 1 (300 games, random policies) found NO reproduction and quantified the perception artifact (12% of gameovers fire with a clown seated and visibly alive — the flying clown's death takes the abstract life; every death instantly respawns a board clown, so two clowns are always on screen at gameover; jump-absorbed deaths show SPLAT without a pip drop). Round 2 injected the owner's exact uncovered state (level 2, lives 4, jumps 1 — round 1's policies never completed level 1): **3,513 gameovers, zero with lives > 0** — the report is not reproducible in the core. Round 2 DID find the adjacent real defect: **lives can reach −1** on a same-tick double death (double-tap launch → two flying clowns → two death events at lives 1 → −1). Gate fires correctly (≤ 0), but the state/HUD read −1.

### Outcome and independent verdicts

Issue [#27](https://github.com/lucapug/clown-circus-reloaded/issues/27) created from the minimized repro (seed 22). [PR #28](https://github.com/lucapug/clown-circus-reloaded/pull/28) — 2 commits (red regression test from the minimized repro → one-line clamp fix `Math.max(0, ...)`), 171 tests, CI 6/6, fixtures byte-stable. [QA VERDICT: PASS](https://github.com/lucapug/clown-circus-reloaded/pull/28#issuecomment-6276130110) — reproduced the RED on main's code in a /tmp clone independently. [REVIEW: APPROVE](https://github.com/lucapug/clown-circus-reloaded/pull/28#issuecomment-6276160836) — 1 non-blocking [minor] (test assertion precision; fold directly asserted by the property test) + 2 notes. Merge pending the owner (gates now open: PR #26 audio + PR #28).

### Measured ledger

Investigation rounds 1-2: 1,050,638 + 3,117,055 = 4.17M. Cycle #14: PM n/a (orchestrator-specified bugfix from the minimized repro) · engineer 1,433,882 · QA 392,922 · reviewer 314,555 → **≈ 2.14M**. Zero stalls, zero rework.

### Lessons

- **Fuzzing the deterministic core is the highest-value verification so far**: it (a) closed the owner's report with evidence (3,513 gameovers, zero violations in the claimed region — a perception artifact quantified), (b) found a real adjacent defect with a minimized repro, (c) cost ~4.2M across two rounds. The detector canaries (injected defects tripping the invariants) are what make the green trustworthy.
- Coverage gap insight: round 1's random policies never completed level 1 — state-injected rounds are necessary complements to policy-fuzzing for progression-gated regions.
- The slim regression test keeps the fuzz policy code verbatim (draw-order preservation) — a reduced extraction diverged (tick 221 vs 233); determinism repros must copy the WHOLE draw sequence.

### Next

Owner merges PR #28 (+ PR #26 after the timbre listen) → #27/#11 close, **M2 6/6 complete**. Then the conditional slot (owner picks #20 or #24), C1 Oct 21 EOD, and M3 (backend/DB/contract, with decision C log-only + the #10 contract-alignment relay).

**End of day 2026-10-19 — M2 COMPLETE (6/6):** owner merged PR #26 (audio, after the worktree timbre listen) and PR #28 (lives floor, from the fuzz investigation). #11/#27 closed, branches deleted, /tmp PR-26 worktree removed, backlog map updated to 6/6 with #24 (conditional) and #27 (bugfix) added. C1 tomorrow (Oct 21 EOD) is effectively already satisfied on the game side — the formal check happens at tomorrow's close.

**Tomorrow's first design task (owner request): session recording.** The owner wants play sessions recorded (logs/traces) so that any future "inexplicable game-over" comes with concrete evidence — the fuzz investigation convinced only partially ("non copre tutti gli edge cases", a fair critique: policy-fuzzing explores a space, not THE space). Design direction to evaluate tomorrow: the core is deterministic with an input queue and seeded RNG — a session recorder is therefore *exact replay technology*, not heuristic logging: record (game seed + every input event with its tick + periodic state snapshots) in the shell (outside `core/`, DEV-available like the debug hooks), store as a ring in localStorage with export/download, and a replay mode reusing the golden-fixture machinery. A recorded owner session becomes a deterministic reproduction any agent can replay tick-by-tick — the strongest possible "concrete trace". Scope and DEV-vs-prod gating to be decided in tomorrow's first cycle.

## 2026-10-20 — Cycles #15 (issue #20, PR #29) and #16 (issue #30, PR #31): conditional slot used; the session recorder lands

### What and why

M2 closed a day early, so both owner-decided conditionals had room. **#20** (entry-height randomization from level 4, 50/50 seeded) landed first: one `rng.next()` per qualifying death-entry, no draw below level 4 (golden fixtures byte-stable by construction), spec §3.4 extended, `RESPAWN_BOARD_HEIGHT_INDEX` retired (its TODO resolved). **#30** is the owner-requested **session recorder** (design approved in the morning, marker key `M` approved): DEV-gated capture of seed + every input at its consuming tick + all events + 600-tick snapshots + terminal state + markers, localStorage ring (20) + JSON export via `__game.downloadSession()`, and a replay runner (`REPLAY_TRACE=<file> npm run replay`) that re-runs seed+inputs through the core and reports the first divergent tick — the owner's "concrete evidence" requirement answered with exact replay rather than logs.

### Outcome and independent verdicts

[PR #29](https://github.com/lucapug/clown-circus-reloaded/pull/29) — QA PASS (13/13 incl. byte-gate); reviewer REQUEST_CHANGES (2 minor: seed count, a false PR-body invariant claim) → **mini-agent trial #4** (f24977a/514e26e: 22 seeds, a genuinely discriminating same-tick level-up test, reworded body) → REVIEW APPROVE. Merged by the owner. [PR #31](https://github.com/lucapug/clown-circus-reloaded/pull/31) — 4 commits, 18 files, 230 tests (+1 env-gated skip). [QA VERDICT: PASS](https://github.com/lucapug/clown-circus-reloaded/pull/31#issuecomment-6288830384): real round-trip through the core, both production greps 0, **live CLI replay of an exported trace → ok, tampered → `first divergence at tick 240 (seesaw.x: expected 386, got 387)`**. [REVIEW: APPROVE](https://github.com/lucapug/clown-circus-reloaded/pull/31#issuecomment-6288773932) — zero findings above note; replay fidelity verified against the engine source (inputs drained at the first executed tick only; seed captured pre-draw; consequences stateless). Merge pending the owner.

### Process incidents (recorded honestly)

- **Usage-limit interruption**: the #30 engineer hit the harness's 5-hour usage cap mid-cycle (branch + 2 commits + uncommitted wiring left in the working tree, no agentId returned). Recovery: a FRESH engineer resumed from the working tree + the brief — the work lives in files, not in agent memory; this is the first demonstration that the cycle survives agent loss. Orchestrator error on the way: I mis-resumed the PM agent with engineer instructions (the interrupted engineer had no ID); stopped it within 43 s, tree verified untouched.
- The PM brief contained a formula typo (snapshot predicate missing `/600`); the engineer implemented the normative §3 rule and disclosed — reviewer and QA both confirmed. Brief-vs-normative-text conflicts resolve toward the normative definition.

### Measured ledger

Cycle #15 (#20): PM 302,167 · engineer 1,736,919 · QA 1,134,134 · reviewer 227,757 · mini-agent 1,211,485 · reviewer close-out 244,913 → ≈ 4.86M. Cycle #16 (#30): PM 495,597 · engineer (interrupted, unmeasured) + resume 1,571,979 · QA 1,568,674 · reviewer 348,905 → ≈ 3.99M measurable. Mini-agent trial #4: 1.21M for 4 items incl. a new discriminating test — consistent with trial #3's scale; the P1.4 consolidation should model the mini-agent as a ~1M fixed-cost tool for anything beyond a one-liner.

### Next

Owner merges PR #31 → plays the "allo sfinimento" session WITH the recorder (M at suspicious moments; `__game.downloadSession()` at game over; traces attach to any report; `REPLAY_TRACE=<file> npm run replay` reproduces). #24 (streak) tomorrow morning; C1 tomorrow EOD; M3 starts after.

## 2026-10-20 — Cycle #17 (issue #24, PR #32): jump earning v2 — the streak lands

### What and why

The last conditional: jump earning moves from the blue-row clear (nearly coincident with level completion — owner's play-testing insight) to a **25-chain-launch streak without death** (the owner's skill-based design). Blue row keeps 1000 points only; death resets the streak in both Option-A branches; level-up does not reset (a deathless rally spans levels); HUD shows `Streak: k/25` always visible; start-screen hint replaced with interpolated-constant wording (recalibration cannot desync the UI). Spec §3.3 v2 was already committed — this cycle makes the implementation match it.

### Outcome and independent verdicts

[PR #32](https://github.com/lucapug/clown-circus-reloaded/pull/32) — 3 commits (26-test red → fold → UI), 247 tests, CI 6/6, fixtures byte-stable via the optional `stats.streak` shape. [QA VERDICT: PASS](https://github.com/lucapug/clown-circus-reloaded/pull/32#issuecomment-6292711074) — all 10 DoD points re-run; all four engineer-disclosed deviations independently re-derived and confirmed correct. [REVIEW: APPROVE](https://github.com/lucapug/clown-circus-reloaded/pull/32#issuecomment-6292700690) — zero findings above note; both PM-flagged resolutions endorsed; M4/M5 notes recorded (the recorder digest omits streak by design — adding it later needs a trace-format version bump). Merge pending the owner.

### Measured ledger

PM 731,186 · engineer 6,424,573 · QA 1,153,237 · reviewer 753,257 → **≈ 9.06M** — the second-largest cycle; the size is the ripple through existing exact-stat pins (a reward-rule change touches every pin that observed stats). Zero stalls, zero rework — second consecutive clean cycle.

### Lessons

- Reward-rule changes are pin-heavy by nature: the red commit alone flipped 26 expectations. The byte-stable-fixtures decision (#7) contained the blast radius to test files only.
- The reviewer's M4/M5 note is forward architecture: trace-format evolution needs version bumps (the envelope already has `formatVersion`).

### Next

Owner merges PR #32 (#24 closes; M2 + conditionals complete). **C1 Oct 21 EOD** — the formal check (all criteria already green in practice). Then M3 (backend/DB/contract) with decision C (log-only) and the #10 contract-alignment relay.

## 2026-10-20 — Recorder download bug (issue #33, PR #34) + the owner's methodology finding on browser QA

### What and why

The owner's first recorded play session surfaced that `__game.downloadSession()` "does not work — an error flashed and vanished, not reproducible". The investigation (real browser, Playwright download events, A/B in fresh tabs) found **two defects**: (A) `URL.revokeObjectURL` called synchronously 0.8 ms after `anchor.click()` races the browser's async blob read → *download interrupted* with an auto-dismissing "Failed — Network error" bubble and **no console error** (hence uncapturable); (B) `downloadSession()` consulted only the in-memory recorder → silent `null` before the first start of a page load, never falling back to the localStorage ring the owner could see in DevTools. Fix (PR #34): deferred revoke (10 s) + ring-newest fallback + console.info instead of silent null; tests pin the anchor lifecycle (connected anchor, no sync revoke, revoke after 10 s) and the fallback chain. [REVIEW: APPROVE](https://github.com/lucapug/clown-circus-reloaded/pull/34#issuecomment-6293672643) · [QA (targeted, no-browser): PASS](https://github.com/lucapug/clown-circus-reloaded/pull/34#issuecomment-6294014640). Merge pending the owner. Gap exposed: PR #31's QA exported its replay trace from the TEST env, never exercising the browser download path — the owner's real use found it in minutes.

### The owner's methodology finding (applied at the source)

The owner observed that agents' "live-browser" checks open the game screen but **do not actually play** (the automation injects synthetic events; it cannot deliver hardware input), and that download/permission popups require the owner's confirmation — human interventions were destabilizing the analyses. Conclusion adopted: browser automation is for **mechanism checks only**, never gameplay acceptance; **gameplay/behavior acceptance = the owner's real play + recorder traces**. `qa.md` updated with this rule (plus: never start servers on the owner's ports). The recorder built this morning is exactly the structural answer: the owner plays, the trace is the evidence, agents replay.

### Ledger

Investigation 1,538,002 · engineer 1,497,784 · QA (interrupted by owner message, unmeasured) + targeted completion 431,891 · reviewer 167,035 → ≈ 3.63M measurable.

### Next

Owner merges PR #34 (then downloads work in their session) and PR #32 (streak — after the current session, since it changes the earning rule). C1 tomorrow EOD; M3 after.

**Update (same day):** owner merged PR #34 (`#33` closed); the cancelled QA run had left an orphaned dev server on :5199 — killed by the orchestrator (owner's :5173 untouched; the new qa.md port rule exists for exactly this). Owner idea logged for follow-up: unconditional capture + marker-filtered replay — note that the ring ALREADY persists every finalized session automatically; the manual step is only the file download. Follow-up candidates: `__game.sessions().filter(s => s.markers.length)` (works today from the console), a `downloadMarked()` bulk export, and a replay-runner flag to select marked sessions.

## 2026-10-20 — Cycle #18 (issue #35, PR #36): lever-only launch (owner realism decision)

### What and why

The owner, play-testing, found that clicking launches the seated clown at will (double flights, the source of the lives −1 edge class) and argued from physics: a seated clown rises only via the lever — the other clown's safe landing. Decision: the launch input launches ONLY the diving-board clown; otherwise no-op; the seated clown flies only via the chain launch. Spec §3.4 updated first (owner-approved text, `bc36da2`), then the kernel change. The corollary is a structural guarantee: at most one clown flies at any time; the stalled both-seated state is unreachable; the double-death input path is closed at the source.

### Outcome and independent verdicts

[PR #36](https://github.com/lucapug/clown-circus-reloaded/pull/36) — 3 commits (red no-op/zero-RNG test → engine removal → invariant + fixture regeneration), 7 files, exactly one golden fixture regenerated (byte-gate per the brief's prediction: only scenario A contained a manual seated launch). [QA VERDICT: PASS](https://github.com/lucapug/clown-circus-reloaded/pull/36#issuecomment-6295440074); [REVIEW: APPROVE](https://github.com/lucapug/clown-circus-reloaded/pull/36#issuecomment-6295395033) — zero findings above note; the invariant test proven non-vacuous (it would have tripped pre-fix: two-flying was input-reachable). Third consecutive zero-rework cycle. Merge pending the owner.

### Measured ledger

PM 379,175 · engineer 1,529,921 · QA 691,652 · reviewer 398,887 → **≈ 3.20M**, 138 tool uses. Zero stalls, zero rework.

### Lessons

- The owner's physics reasoning ("lever only") collapsed a bug class at the design layer: the #27 lives-floor fix stays as a defensive clamp, but its input path is now unreachable — design decisions can be stronger than fixes.
- The stale test-title note (golden-tick scenario title still says "seated launch") is the cost of tight file-scoping per cycle — acceptable, tracked as a follow-up line rather than expanding this PR's scope.

### Next

Owner merges PR #36 (#35 closes). All M2 + conditionals then complete: #9/#19/#27/#30/#33/#35 extras + the six MUSTs. C1 Oct 21 EOD (formal check + diary), then M3 (backend/DB/contract) with decision C (log-only) and the #10 contract-alignment relay.

**Forensic replay (owner session 4ad609c3):** the first real-session replay validated the recorder end-to-end — `{status:"ok", ticksReplayed:8792, snapshotsMatched:14/14}`, zero divergence. Verdict: the "inexplicable game-over" was 100% legitimate — 5 middle-third SPLATs, lives 4→0, the bonus jump spent at death #1 (t4736, right after level-2 entry). Pixel forensics on the final landing: the clown hit the plank at x=440.66 vs center 428.15 — visually on the seesaw — missing the safe right edge (x≥448.15) by **7.5 px**, while the player held the seesaw dead-center for the final ~20 ticks (center IS the deadly middle third). The data also validates the #24 design instinct: blue-row clear at t4039, level completion at t4054 — **15 ticks apart** out of 8792 — the near-coincidence the owner intuited. No code changes; the recorder did exactly its job.

**Closure (owner's report fully explained):** the owner's memory — "game over appeared while a just-launched clown was still in the air" — matches a state reachable ONLY under the pre-#35 input rule: double flight (manual seated launch while the partner flew) + a same-tick middle death at the last life. The engine's step 6 processes the death (lives → 0) without touching the partner in flight; the overlay covers the scene with a clown airborne. With #35 (lever-only) merged the same morning, that state is input-unreachable — the owner's play report led, in one loop, from perception to recorder to forensics to a design fix that eliminates the entire class. Case closed.

## Session handoff 2026-10-20 → prossima sessione

**Stato al passaggio:** M2 COMPLETE — tutti i 6 MUST + extras merged e verificati (core deterministico, scoring, bonusJumps Option A, shell giocabile, services offline, audio, free-side unificato, entry-height casuale, lever-only launch, lives-floor, recorder con download funzionante). **In flight:** PR #32 (streak 25-launch) e PR #36 (lever-only launch) — entrambe QA PASS + REVIEW APPROVE, in attesa SOLO del merge del owner (nessuna compressione: merges quando vuole lui).

**Prima attività della nuova sessione (ordine):**
1. Lettura contesto: `AGENTS.md` (auto) + ultime 3 voci del diario + `_docs/plan.md` §6 + `gh pr list` + `git log --oneline -8`.
2. **C1 formale** (era dovuto il 21/10 EOD): verificare i criteri (gioco giocabile su dev, test verdi, delta spec chiusi, carico review OK — tutti già verdi in pratica; registrare l'esito nel diario). Se i PR #32/#36 non sono ancora mergiati: mergerli è il primo atto (verifiche già fatte — nessun nuovo ciclo richiesto).
3. **Avvio M3** (backend + database + contratto OpenAPI, finestra 21–22 ott): PM brief porterà la **decisione C (segnale DB log-only)**, il **relay #10** (il contratto §7 deve allinearsi al client: submissionId, outcome types), e lo **starter del server** (openapi.yaml + FastAPI + SQLAlchemy + Neon `DATABASE_URL`, test API a spec §7).
4. Condizionali: **esauriti** (#20 e #24 entrambi implementati). Restano in v2: volatili, combinazioni, celebrazione level-up, "pattinaggio" trampolino, rotazione sprite, timbro marcia.
5. Post-M2 pending: valutazione consolidamento P1.4 (mini-agent: 4 trial, ~1M costante oltre il one-liner); nota M4/M5 (aggiungere `streak` al digest del recorder → formatVersion bump).

**Come lavorare col recorder (owner):** gioca su `npm run dev`; `M` = marcaposto; a fine partita `__game.downloadSession()` in console; per sessioni più vecchie `__game.sessions()[i]` + `copy(JSON.stringify(...))`; replay con `REPLAY_TRACE=<file> npm run replay` da `frontend/`. Le tracce sono SHA-bound: `version-mismatch` → si rigiocano contro il commit di registrazione (worktree).

**Lezioni vive per la nuova sessione:** checkout-main-first su ogni scrittura repo; browser automation = mechanism checks only (gameplay = owner + tracce); brief-vs-spec → vince la spec; il fuzz del core deterministic è la verifica più forte disponibile (2 round, 4.17M, ha chiuso il report owner e trovato #27).

**Session close 2026-10-20:** owner merged PR #32 (streak) and PR #36 (lever-only) — **M2 fully complete: 6/6 MUSTs + #19, #20, #24, #27, #30, #33 extras**. All gameplay rules 2026 decided and on `main`. Tomorrow: C1 formal check (criteria already green) then M3 (backend/DB/contract). Session handoff entry above.

## 2026-10-21 — C1 formal check: PASSED with one finding fixed in-flight (merge-order interaction #32×#36)

### Method

The five plan-§6 criteria checked one by one against primary evidence, not memory: full local test suite; `grep` for open TODOs/open questions in `product-spec.md`; GitHub Actions runs on `main` and on the last merged PR branches; the issue tracker (18/18 issues closed, every one single-cycle); owner activity as recorded in the diary's own play-test and recorder entries.

### The finding: CI red on `main` — a merge-order interaction PR-level CI cannot catch

The two evening merges of 2026-10-20 (#36 lever-only at 17:08:26Z, #32 streak at 17:08:43Z — **seconds apart**) each had green CI on their own merge-refs, but the push-run on the combined `main` failed the frontend job: `consequences-live.test.ts` → `input launches never count toward the streak (AC-3)` — `expected [] to deeply equal [ 'launched' ]`. Diagnosis: the test (from #32) constructed **two seated clowns and no board clown** and sent a launch input — pre-#35 semantics. Under #35's lever-only rule that input is a correctly-specified no-op, so no `launched` event fires. **The engine is behaving as designed; the test setup was stale.** A full-suite run reproduced exactly 1 failure of 253, and a grep map of all test sites sending launch inputs confirmed every other site uses the default state's board clown (already green under #35) — the defect was one test in one file.

### Fix cycle (#19 overall, issue [#37](https://github.com/lucapug/clown-circus-reloaded/issues/37), PR #38)

Orchestrator-specified bugfix from the complete minimized diagnosis (the #27 precedent — no PM pass). Engineer ([PR #38](https://github.com/lucapug/clown-circus-reloaded/pull/38), 1 commit, test-only +14/−5): rewrote the setup to the #35 world — the default board-2 clown launches via input. One disclosed deviation, verified by the orchestrator before QA spend: from the pristine rest position the launch tick also emits `board-bounced` (real event, `events.ts:9`), so the board clown's y is lifted one launch fall clear of the bounce hit-box — keeping the three pinned assertions **byte-identical** (the issue declared the assertion set the contract). [QA VERDICT: PASS](https://github.com/lucapug/clown-circus-reloaded/pull/38#issuecomment-6312446414) — fresh-worktree battery, CI-identical RED proof (file reverted to main → same assertion error), byte-scope proof, deviation re-derived, and a **mutant discrimination test** (a fold counting all launches flips the test red — AC-3's point preserved). [REVIEW: APPROVE](https://github.com/lucapug/clown-circus-reloaded/pull/38#issuecomment-6312414137) — zero findings above [note], formed before reading QA's. CI 6/6 on the PR. Merge pending the owner.

### Ledger (cycle #19)

Engineer 810,803 · QA 1,004,985 · reviewer 308,932 → **≈ 2.12M**, 87 tool uses. Stalls 0, rework 0 — fourth consecutive clean cycle.

### C1 verdict, criterion by criterion

1. **Game playable on local/dev with core tests green: PASS.** Owner play-tested extensively through 2026-10-20 (multiple recorded sessions, forensic replay validated); suite 252 passed + 1 env-gated skip on `main`, 253/253-green with PR #38 (the one red test is the stale setup above, fix merge-ready).
2. **Spec deltas closed: PASS.** Every named delta implemented and merged: bonusJumps option A (#8), streak v2 with spec §3.3 rewritten (#24), entry-height randomization with `RESPAWN_BOARD_HEIGHT_INDEX` retired (#20), free-side unification (#19), lever-only launch (#35), localStorage fallback (#10), lives floor (#27), recorder (#30/#33). `product-spec.md` contains no TODO and no open question.
3. **CI green on `main` for the last ≥3 PRs: PASS on the PR criterion, with the finding recorded.** PRs #34, #36, #32 each ran 6/6 green on their merge-refs; the combined `main` push-run went red for the merge-order interaction above — found BY this C1 check and fixed merge-ready within the checkpoint day (PR #38). This is precisely the gap between "every PR green" and "main green"; with #38 merged the criterion holds unqualified.
4. **Review load ≤6 h/day average: PASS** per the owner's own session rhythm (merge gates + play-test sessions + recorder reviews; no review backlog accumulated — every cycle's PR was merged same-day or next-morning).
5. **No issue needing >1.5 sessions: PASS.** All 18 issues closed in single graph cycles; the largest (#9) still one session.

**C1 = PASSED.** No cut-list item needs executing: M1+M2 complete a day ahead of their windows, ops untouched (all 5 graded points still in scope), M3 opens today on schedule. The STOP-and-rescope branch is not triggered.

### Lessons

- **PR-level CI cannot see merge-order interactions; only the push-run on `main` can.** Two individually-green PRs merged seconds apart produced a red main for a full evening. Cheap structural follow-up (M4): the deploy-on-green CD makes "main green" load-bearing — worth considering a re-run of failed main push-runs or a merge queue once CD exists.
- The C1 formal check earned its keep exactly as designed: the "all criteria already green in practice" assumption from the handoff was ALMOST true — the one red signal was on `main` itself, invisible to the per-PR verdicts the diary had been recording.
- The engineer's deviation handling is now a pattern worth naming: when the brief's suggested setup conflicts with the issue's pinned contract, keep the contract, adapt the setup minimally, disclose with the factual basis (here: the `board-bounced` trailing event) — QA re-derived it independently and the reviewer weighed it as a [note]. Zero rework, honest trail.

### Next

M3 opens (backend + DB + contract, window Oct 21–22): issues groomed next entry; decision C (DB signal log-only), the #10 contract-alignment relay (submissionId, outcome types), and spec §7 as the behavioral contract. PR #38 awaits the owner's merge.

## 2026-10-21 — M3 opens; cycle #20 (issue #39, PR #42): the OpenAPI contract lands

### What and why

M3 groomed as three session-sized issues (#39 contract → #40 backend → #41 switch-services; backlog map updated, critical path now `…#10 → #39 → #40 → #41` toward C2). The contract issue ran first (contract-first per plan §5 / Module 2 flow): `openapi.yaml` (OpenAPI 3.1) encoding every spec §7 pin — `ScoreSubmission{name, score, submissionId(uuid)}`, 201 documented as replay-returns-**originally-stored**, 409 no-mutation, 422 FastAPI-native detail shape, leaderboard `{entries:[{rank,name,score,date}]}` with ordering score DESC/`created_at` ASC, `limit` 1–100 default 10, `date` pinned `date-time` **with baseline parity verified at `models.py@0d365e6`** (`date: datetime`) — plus the anti-rot test (`openapi-spec-validator` in the backend dev group, `backend/tests/test_openapi_contract.py`). The contract-vs-client cross-check (the #10 relay) is in the brief's DoD: every status the client branches on (2xx/409/422/other-4xx/5xx/network) has a home in the yaml.

### Outcome and independent verdicts

[PR #42](https://github.com/lucapug/clown-circus-reloaded/pull/42) — 3 commits, exactly the 4 brief-allowed files. Engineer deviations disclosed and verified (quoted YAML status keys for string-keyed paths; 409 body inlined to keep the six pinned schemas; test docstring). [QA VERDICT: PASS](https://github.com/lucapug/clown-circus-reloaded/pull/42#issuecomment-6313036560) — fresh-worktree battery, spec §7 line-check, client cross-check, all deviations re-derived, **baseline parity spot-checked independently at the pinned clone**, CI 6/6. [REVIEW: APPROVE](https://github.com/lucapug/clown-circus-reloaded/pull/42#issuecomment-6313028347) — zero findings above [note]; positives called out: 201-replay semantics stated ON the 201 response, tie-break on the operation, property names exact. Owner merged the same morning (`3b5a8dd`); #39 closed, main CI green. **M3 1/3.**

### Measured ledger (cycle #20)

PM 214,263 · engineer 486,619 · QA 711,539 · reviewer 359,635 → **≈ 1.77M**, 79 tool uses. Stalls 0, escalations 0, rework 0 — fifth consecutive clean cycle. A contract-only cycle is the cheapest M-cycle type so far after docs-only #16.

### Lessons

- Grooming split confirmed with the owner (2026-10-21): orchestrator grooms milestone issues at milestone entry (M0 precedent; the PM role file forbids issue creation), the PM briefs each cycle — recorded here once because the owner raised it, no process change.
- The merge-order finding from C1 got its structural answer the same day: with #38 merged, the main push-runs are green again; CD (M4) will make "main green" load-bearing, which is the durable fix for this incident class.

### Next

Cycle #21: #40, the M3 core (backend + persistence + TDD suite + generated-vs-committed OpenAPI match + decision C + no-customer-data rule). Then #41 (switch + live §8 verification).

## 2026-10-21 — Cycle #21 (issue #40, PR #43): the leaderboard backend — biggest pass, first mini-agent rework since M2

### What and why

The M3 core, implemented against the #39 contract: SQLAlchemy 2.1 + psycopg 3 persistence (SQLite default, `DATABASE_URL` verbatim; DB-level UNIQUE on `submission_id`; startup `create_all`), Pydantic v2 schemas, POST /scores with the full §7 idempotency semantics, GET /leaderboard (rank, score DESC, `created_at` ASC, limit 1–100), CORS + masked startup DB line (Decision C), HealthStatus model so the generated OpenAPI carries the pinned `/health` shape. TDD red-first: commit 1 is the test suite alone, verified RED live by QA. The brief also executed the **uv 0.13.x bump** (the process.md §8 M3 candidate): Dockerfile + both CI setup-uv steps pinned to 0.13.4, lockfile regenerated under the same binary.

### Outcome and independent verdicts

[PR #43](https://github.com/lucapug/clown-circus-reloaded/pull/43) — 6 TDD-slice commits + 1 rework; 48 backend tests (40 new), 318 non-test lines (< the ~400 cap), `openapi.yaml` byte-untouched. Notable disclosed deviation: **Pydantic 2.14 lax mode coerces `true` → 1**, so `score` needed a `field_validator(mode="before")` boolean rejection (contract `type: integer` preserved in the generated schema). [QA VERDICT: PASS](https://github.com/lucapug/clown-circus-reloaded/pull/43#issuecomment-6314675900) — red-commit proof live; parity drift-proof executed in BOTH directions (mutate the yaml → red; mutate the route schema → red); DB-level unique constraint proved on SQLite AND live Postgres; live compose verification (isolated project, owner ports untouched) with POST/replay/rank/health; **no-customer-data verified live** (distinctive name POSTed, absent from all captured logs; no `set_attribute` in `backend/app`). [REVIEW: REQUEST_CHANGES](https://github.com/lucapug/clown-circus-reloaded/pull/43#issuecomment-6314507078) — 2 [minor]: a ruff bugbear stanza that selected NO B rules (inert config; the deviation's "B008 fires" rationale was factually wrong), and the leaderboard query inline in the route instead of `crud.py`, undisclosed. → **mini-agent trial #5** (`cde61f2`: stanza made functional via `extend-select = ["B"]` — control run proved B008 fires on exactly the two `Depends(get_db)` sites without the exemption, so it is load-bearing; query moved to `crud.list_leaderboard`, SQL byte-identical; PR-body claims corrected) → [REVIEW: APPROVE](https://github.com/lucapug/clown-circus-reloaded/pull/43#issuecomment-6314507078) (edited in place) + [QA (rework): PASS](https://github.com/lucapug/clown-circus-reloaded/pull/43#issuecomment-6314675900), CI 6/6. Merge pending the owner.

### Measured ledger (cycle #21 — the most expensive so far)

PM 275,874 · engineer **8,259,271 (largest single pass of the project)** · QA 2,409,000 + 575,275 (rework re-check) · reviewer 487,803 + 548,776 (close-out) · mini-agent 603,290 → **≈ 13.16M**. Stalls 0, escalations 0, rework 1 (mini-agent trial #5, within P1.4). The engineer pass is intrinsic: full persistence + routes + schemas + 40 tests + infra pins in one slice.

### Lessons

- **Config-bearing deviations need control runs**: "the config fixes X" is checkable only by reproducing X without it. The reviewer caught the inert stanza; the mini-agent's control run (B008 fires 2× without the exemption) is the proof shape worth reusing.
- Mini-agent trial #5 (603k for a 3-file mechanical fix + body edits) sits between trial #1 (253k) and trials #3/#4 (~1M) — the fixed-cost model in P1.4's consolidation file now has five data points spanning 4×.
- The uv lock-revision bump (3→5) has an owner-side consequence: local uv must be ≥ 0.13.x for frozen syncs (CI and Docker are pinned; Homebrew uv 0.11.28 is not). Flagged to the owner in-session; also noted by both readers independently.
- QA's compose verification on an isolated project with port overrides kept the owner-port rule intact while still exercising the real Postgres path — the pattern for every future compose battery.

### Next

Owner merges PR #43 (#40 closes; M3 2/3) → cycle #22 opens on #41 (switch services + live §8 verification — the last M3 issue), then M4 (integration/E2E/CD, C2 Oct 23 EOD).

## 2026-10-21 — Cycle #22 (issue #41, PR #44): the real-backend switch — an engineer stall, a vacuous smoke, and M3's loop closed

### What and why

The last M3 issue closes the frontend-first loop: **live §8 verification against the real backend** — a vitest integration file (`frontend/src/services/__tests__/integration.leaderboard.test.ts`, jsdom env so `storage.ts` runs unmocked, real fetch to `LEADERBOARD_INTEGRATION_URL`, env-gated skip per the repo's existing pattern) covering saved / queued-on-down / drain-exactly-once-on-recovery / 422-dropped / **lost-response via an in-test `node:net` fault proxy** (destroys the client socket on the first upstream response byte = persistence committed, client never sees the 2xx → queued → drain → exactly one row). Compose proof that the built bundle has the HTTP service baked in (no `VITE_*` in the image build), and the AGENTS.md/README mock-vs-live dev recipe.

### Incidents (recorded honestly)

1. **Engineer killed by the 10-minute inactivity timeout mid-cycle** — second occurrence of this incident class, first since cycle #1. Recovery per the #30 precedent: the work lives in files, not agent memory — the tree held a coherent 243-line test file + docs (uncommitted); a FRESH engineer resumed from the tree, found and fixed one inherited defect by RUNNING the file (`net.Server#closeAllConnections` is an http.Server method — TypeError), committed, opened the PR. Second demonstration that the cycle survives agent loss.
2. **QA: FAIL — the vacuous smoke.** The integration test's `node:net`/`Buffer` usage needed `@types/node`, absent from frontend deps: `tsc -b` failed → `npm run build` failed → Docker build failed → CI 4/6. The engineer's `npx tsc --noEmit` smoke was **vacuous** (root tsconfig `"files": []` checks nothing) — a green smoke that gates nothing. → **mini-agent trial #6** (`867b736`, 245k tokens — cheapest since trial #1): `@types/node` devDep only, no tsconfig change needed; QA re-verified on the REAL gate (`npm ci && npm run build`) → **[QA: PASS after rework](https://github.com/lucapug/clown-circus-reloaded/pull/44#issuecomment-6316024396)** (FAIL analysis kept below as audit trail), CI 6/6, and QA closed AC 1 first-hand (compose smoke: bundle greps — `/leaderboard?limit=` present, mock flag absent). The standing fix landed at the role-file source: **engineer.md now prescribes the real build gate** (`b0d2df9`) — the fourth prompt-borne incident class fixed at the source (after anti-hang, execute-only, diff-method).

### Outcome and independent verdicts

[PR #44](https://github.com/lucapug/clown-circus-reloaded/pull/44) — 3 commits + 1 rework, exactly 3 files + the devDep lockfile. The **split verdict worked as designed**: [REVIEW: APPROVE](https://github.com/lucapug/clown-circus-reloaded/pull/44#issuecomment-6315948407) (normative lens: tests pin §8 at the right level — production `leaderboardHttp` + unmocked storage, fresh-instance-over-same-localStorage = the "reload"; proxy faithful; docs truthful vs `=== '1'`; zero findings above note) while QA failed it on the mechanical build gate — two readers, two lenses, both right. QA's battery proved the §8 claims at the persistence layer (SQLite row counts: lost-response row exactly 1, zero duplicate submissionIds across runs incl. replay) and the lost-response test **non-vacuous** (disclosed pass-through patch → test RED → reverted).

### Measured ledger (cycle #22)

PM 383,290 · engineer interrupted (unmeasured) + resume 1,020,961 · QA 1,366,318 + 626,108 (re-check) · reviewer 408,865 · mini-agent 245,472 → **≈ 4.05M measurable**. Stalls 1 (inactivity kill), rework 1 (mini-agent trial #6). Mini-agent ledger after six trials: 253k / ~1M×3 / 603k / 245k — the P1.4 consolidation file has its spread.

### Lessons

- **A smoke is only worth the command CI runs.** Green from a command that checks nothing is worse than red — it manufactures false confidence at the cheapest stage. Role files compound: each fix hardens every future cycle.
- The two-reader design earned its keep twice today: reviewer/QA split verdicts (normative quality vs mechanical gates) caught defects on *both* axes that a single combined pass would have averaged away.
- Harness detail worth keeping: macOS lacks GNU `timeout`; the engineer used a `perl -e 'alarm N; exec @ARGV'` wrapper (SIGALRM survives exec) — the standing anti-hang recipes should assume it.
- The brief's example payload name ("QA MECHANIC", 11 chars) itself 422s against the wire max of 10 — harness examples must satisfy the contract they exercise.

### Next

Owner merges PR #44 (#41 closes; **M3 3/3 complete**). Then **M4** (integration tests separated in Compose, Playwright happy-path E2E, GHCR immutable tags, deploy-on-green CD to dev, prod service + first manual promotion, scheduled health monitor) toward **C2 (Oct 23 EOD: CD green on dev + one promotion to prod)**. M4 grooming opens the next session.

## 2026-10-21 (evening) — M3 closed and verified on the dev deploy; Grafana Cloud activated end-to-end (M5 pre-work); M4 groomed

### What and why

Owner merged PR #44 → **M3 complete 3/3** (`529df6b`), main CI green, local uv upgraded to 0.13.4 (the lock-revision note closed). The afternoon went to the M5 prerequisite the plan assigned to the owner (D7: Grafana Cloud free): activating the dormant #4 instrumentation on the dev deploy. Status checkpoint against plan §6 was taken first: **~1 day ahead** on the build milestones (M3 done on day 1 of its 2-day window), no cut-list item executed, risk now concentrated in M4/C2 and the 5 ops points of M5.

### M3 verified on Render (bonus of the Grafana traffic)

`GET /health` → 200 in ~0.2 s; `GET /leaderboard?limit=3` → `{"entries":[]}` — the §7 contract shape served by the real backend against Neon (startup line `database target: postgresql://…neon.tech`, Decision C). First time the M3 backend is observed live outside local/compose.

### Grafana Cloud activation — owner-side, agent-guided (the debugging record)

Layout decided and applied: Render **environment group** `clown-circus-reloaded-otel` holding the 4 shared vars (`FASTAPI_OTEL_AUTO_CONFIGURE=true`, `OTEL_SERVICE_NAME=clown-circus-backend`, `OTEL_EXPORTER_OTLP_ENDPOINT=https://otlp-gateway-prod-eu-west-2.grafana.net/otlp`, `OTEL_EXPORTER_OTLP_HEADERS`), while **`OTEL_RESOURCE_ATTRIBUTES` and `DATABASE_URL` stay per-service** (dev vs prod differ — the group creation had absorbed `DATABASE_URL`, removed safely because the service-level copy, which Render guarantees precedence to, was still present). The Render project environment was renamed "Production" → "Development" (cosmetic by Render's own doc; our environments are defined by `DATABASE_URL` + `deployment.environment.name`). A first incident class: "Save only"/"Link only" in Render's UI skip the deploy — the new env reached the container only after a manual "Deploy latest commit".

**The header saga (4 blind attempts, then evidence):** the SDK logged `Header format invalid!` and the gateway answered `401`. Attempts based on the OTLP spec and Grafana's own doc note for Python ("replace `Basic ` with `Basic%20`") did not clear it, nor did percent-encoding the base64 padding. The decisive move was **reproducing the parser locally with the exact installed SDK** (`opentelemetry.util.re.parse_env_headers`, 1.45.1, called in *liberal* mode by the HTTP exporter): the space was **never** the problem (liberal mode accepts it); the only rejections are **literal double quotes around the value** and embedded newlines. Root cause: the Grafana snippet is shell syntax (`export VAR="…"`) and the quotes had been pasted into Render's per-variable field, where they are data — Render strips quotes only in the `.env` bulk importer. The first log line had shown the quotes all along (`…: "Authorization=Basic …"` — Python's `%s` adds none). Fix: remove the two quote characters. Result: no "Header format invalid", **zero `401` after the live marker** under real traffic (the SDK is silent on success).

**Evidence collected by the owner in Grafana → Explore:** Tempo lists 6 traces for `service = clown-circus-backend` — the 4 generated by the orchestrator's curls (3× `GET /health`, 1× `GET /leaderboard` at 244 ms, cold Neon pooler) **plus Render's own go-live checks (`HEAD /`, `GET /`)** — instrumentation exported from the first instant; Loki returns the service's log lines by `service_name`. **Pipeline Render → OTLP gateway → Grafana Cloud: closed.**

**Security note, recorded honestly:** the owner pasted a Render log into the chat that contained the full `Authorization: Basic` value (= the credential). Rotation was decided immediately; the Grafana OTLP token UI lists named tokens (same-name regeneration is refused), so a second token was created and the old one is to be **revoked and verified dead** (`curl -u '<id>:<old>' … → 401`). Lesson for the runbook: SDK header-parse warnings print the whole value — a misconfigured header is itself a leak vector in logs.

### M4 groomed (orchestrator, milestone entry — per process.md §8 the PM briefs each cycle)

#45 integration suite in Compose + single-command test story (rubric #6) · #46 Playwright E2E happy path on the §6 hooks · **#47 GHCR immutable tags + deploy-on-green CD to dev with health validation (C2-critical; carries the #14 concurrency relay and the `service.version`-per-deploy relay)** · **#48 prod service + first manual promotion of the same tag + scheduled health monitor (C2-critical)**. DAG: #41 → {#45, #46, #47}; #47 → #48. Backlog map updated (`aae3caa`).

### Lessons

- **When a cloud component rejects a config value, reproduce the parser locally before iterating in the cloud.** Four deploy round-trips were spent on spec-plausible hypotheses; one local run against the installed library settled it in a minute and also disproved the official doc's partial hint.
- **"Printed quotes are data"**: log formatters do not add quotes — if a logged value shows them, they are in the value. The clue was in the very first log.
- Platform UIs have two syntaxes: bulk-import formats (quotes = syntax) vs single-value fields (quotes = data). Snippet copy-paste across that boundary is the failure mode; the M5 runbook will state it explicitly.
- Pasting logs into a chat can leak credentials; the mitigation is procedural (rotate immediately, verify revocation) — and the no-credentials-in-telemetry rule now has a sibling: *no credentials in log lines either*, including library warnings.

## Session handoff 2026-10-21 → 2026-10-22

**Stato:** M0–M3 complete (M3 un giorno in anticipo); C1 PASSED; main verde (`aae3caa`); dev deploy live su Render con telemetria attiva verso Grafana Cloud (trace in Tempo, log in Loki). M4 groomato (#45–#48). Deadline sottomissione 26/10; C2 il 23/10 EOD.

**Owner — chiusure in sospeso (brevi):** (1) revoca del vecchio token Grafana + verifica `curl … → 401`; (2) in Grafana: correlazione `trace_id` log↔trace (Loki: espandi una riga `health check ok` → campo `trace_id`, confronta con il trace `GET /leaderboard` in Tempo) — evidenza del criterio 10, da catturare come screenshot per M6; (3) Prometheus: `http_server_request_duration_seconds_count` con label `deployment_environment_name="dev"`, `service_version`.

**Owner — passi piattaforma per M4 (in parallelo ai cicli, non bloccanti):** Render API key o deploy hook del servizio dev → GitHub secret (#47); database Neon di **prod** (branch/database separato) + servizio Render prod in environment "Production", linkato al gruppo otel, con `OTEL_RESOURCE_ATTRIBUTES=…=prod` (#48). Decidere visibilità del package GHCR (raccomandazione: pubblico).

**Prima attività della sessione (ordine):** `git log --oneline -5` + `gh issue list --label M4` → ciclo #23 su **#47** (PM brief → engineer → QA + reviewer) → #48 → #45/#46 negli slot paralleli. Attribution header engineer: `engineer.md@b0d2df9`.

**Lezioni vive:** checkout-main-first; smoke = il comando che gira in CI (`npm run build`, mai `tsc --noEmit` nudo); riprodurre localmente prima di iterare nel cloud; brief-vs-spec → vince la spec; browser automation = mechanism checks only.

## 2026-10-22 — Cycle #23 (issue #47, PR #49): CD to dev — two reviewer rounds catch a false-provenance defect

### What and why

The C2-critical half of the CD work: `cd-dev.yml` (triggered only by CI success on `main` via `workflow_run`, plus `workflow_dispatch` as the verification vehicle), GHCR push of the single-container image (`YYYYMMDD-HHMMSS-<shortsha>` immutable tag + moving `main`, digest in every job summary), Render deploy (one PATCH of image + `OTEL_RESOURCE_ATTRIBUTES=…service.version=<shortsha>`, POST deploy, bounded poll to `live`, `/health` exact-body assert), the not-yet-configured degradation path (exit 0 + loud notice while the owner's `RENDER_API_KEY`/`RENDER_DEV_SERVICE_ID` are absent — main never goes red), `ops/cd-dry-run.sh` mock rehearsal with self-mutation checks, runbook (owner setup, image-mode flip, GHCR visibility, rollback), and the one permitted app change: a 3-line `HEAD /` handler with a discriminating test (silences Render's pre-check 405). The #14 relay resolved with **zero CI changes**: CI's `ci-<ref>` group contains only CI runs; CD runs in a disjoint `cd-dev-main` group with literal `cancel-in-progress: false`. The verification boundary was declared up front: structure + dry-run verified now; Render path + GHCR listing verified on first configured run (honest, in both verdicts).

### The story of the rework: the reviewer's second round caught what the first fix missed

QA PASSed the first implementation (structural + dry-run + mutation checks + suites + secrets hygiene). The reviewer APPROVED with 2 [minor]: GHCR tags are mutable (promotion must reference the **digest** — runbook rule added), and `GITHUB_SHA` skew under `workflow_run` (in a race window, main's tip deploys before its own CI finishes). The mini-agent rework (#7, `8e697a5`) pinned a workflow-level `DEPLOY_SHA: ${{ github.event.workflow_run.head_sha || github.sha }}` feeding tag and OTEL version — **but missed that the `push-ghcr` job's bare `actions/checkout@v4` still defaulted to `github.sha`**. The reviewer's re-verification caught it and **withdrew the APPROVE** (REQUEST_CHANGES): in the race window the pipeline would have pushed a tag *labeled* with the CI-green sha containing the drifted commit's code — false provenance, worse than before. One-line fix (`ref: ${{ env.DEPLOY_SHA }}` on the checkout, `fcb23e4`) closed the provenance chain: **CI-green commit = built code = tag sha = `service.version`**. Final: [REVIEW: APPROVE](https://github.com/lucapug/clown-circus-reloaded/pull/49#issuecomment-6335509775) (three rounds recorded in one comment), [QA: PASS](https://github.com/lucapug/clown-circus-reloaded/pull/49#issuecomment-6335615603) with both rework sections. Merge pending the owner; the first configured run (with the owner's secret + service ID) is the declared evidence boundary for the Render leg.

### Process incidents (recorded honestly)

QA's in-place comment edit briefly replaced the comment body with a 24-character placeholder (`gh pr comment --edit-last -F` flag misuse), then restored the original verdict verbatim and disclosed the mishap inside the amended comment. Single-comment invariant preserved; the audit trail survived intact. Noted as a QA tooling hazard: always build comment bodies via `--body-file`, never inline flags.

### Measured ledger (cycle #23)

PM 248,551 · engineer 1,870,969 · QA 1,225,275 + 1,100,436 + 442,770 · reviewer 301,271 + 247,159 + 204,731 · mini-agent 385,948 (#7) + 299,986 (#8) → **≈ 6.33M**, rework 1 (two mini-agent passes: trial #7 386k, trial #8 300k — the cheapest pair yet). Owner-side inputs (secret + service ID) remain outside the cycle: the degradation path keeps main green until they land.

### Lessons

- **The close-out re-verification is not a formality**: the reviewer's second pass found the one line the fix missed — a checkout defaulting to a different sha than the labels it feeds. Label-value provenance must be traced END TO END (label → build input), not assumed by sharing a variable name.
- `workflow_run`'s `GITHUB_SHA` is the branch tip, not the CI-green commit: any post-CI automation that cares WHICH commit passed must read `github.event.workflow_run.head_sha`.
- The declared verification boundary (dry-run now, real Render leg on first configured run) kept QA honest without fake claims — the pattern for all future infrastructure cycles.

### Next

Owner merges PR #49 (#47 closes) → the owner's Render secret/variable + first configured run provide the Render-leg evidence; cycle #24 on **#48** (prod service + first manual promotion + health monitor — the other C2 half); #45/#46 fill the parallel slots.

## 2026-10-22 — Cycles #24–#25 and the first configured runs: CD to dev is LIVE (C2's first half closed)

### What and why

Three slim cycles took the CD from merged to **proven on the real Render service**, plus the owner-side platform setup (Render API key → GitHub secret, service ID → repo variable, GHCR package flipped public, prod Neon database created):

- **Cycle #24 (issue #50, PR #51)**: the first configured run (39747325427) failed in `push-ghcr` — the tag-list step wrote BARE lines to `$GITHUB_OUTPUT` (`Invalid format`); Actions requires `key=value`, multiline via `tags<<EOF … EOF`. The dry-run could not catch it: the runner output protocol exists only inside Actions. Fix + the dry-run gained its first mirror of that step (the blind spot became a check). QA PASS (mutation proof, consumer spec verified against build-push-action source), REVIEW APPROVE. Merged; **push-ghcr green on the next run — the GHCR package exists**.
- **Cycle #25 (issue #52, PR #53)**: the second first-run finding — Render `PATCH` returned **400**: `envVars` is not a `servicePATCH` field (separate bulk `PUT /services/{id}/env-vars`), and `image` requires `ownerId` (fetched dynamically via `GET /v1/owners`). Also fixed: the swallowed error body (`curl -fsS … >/dev/null` — the exact anti-pattern the runbook now bans) and a poll-reliability refinement routed by the orchestrator (transient api errors = failed attempts, fatal at 3 consecutive; terminal statuses immediate). QA PASS (env-merge byte-preservation re-run, all mutations bite), REVIEW APPROVE after one truthfulness [minor] fixed (runbook bullet). Merged.

### The first configured runs (orchestrator-dispatched, evidence on #47)

Run 1 after the fixes: **every API call green** — owners 200, PATCH 200 (**repo→image mode switch accepted**), env-vars GET/PUT 200 with `DATABASE_URL` preserved, POST deploy 202 — but the deploy stayed `update_in_progress` past the 10-minute poll cap: the mode switch had queued up to three serialized deploys (PATCH auto + env auto + explicit), each pulling the image. The cap did its job (fast fail, full evidence). Re-dispatch once image mode was active: **green end-to-end in ~3 minutes** (run 39762394105). Deployed: `…:20261022-102048-84d7ba4`, digest `sha256:bf52c54b…`, provenance chain intact (CI-green commit = built code = tag sha = `service.version`). Live check 200 in 0.6 s. Evidence comment posted on #47. **The dev service now runs in GHCR image mode — the promotion primitive #48 needs exists.** Cold-start reminder: one verification curl hit a >30 s wake-up (free tier, by plan); the #48 health monitor will keep it warm.

### Measured ledger (cycles #24–#25 + today's platform debug session)

#24: engineer 580,587 · QA 944,516 · reviewer 164,950 ≈ **1.69M**. #25: engineer 4,576,092 + 1,300,999 · QA 1,894,553 · reviewer 345,731 · mini-agent 260,629 ≈ **8.38M**. Two-day loop total (cycles #19–#25): **≈ 37.5M** measurable subagent tokens — full per-cycle table delivered to the owner on request (2026-10-22); mini-agent series now 9 trials (#5–#9 average ~340k vs ~1M for the resumed-context #3–#4 — the P1.4 answer is in). Dispatch/monitoring itself: zero subagent tokens (pure Actions).

### Lessons

- **Declared verification boundaries convert first-run failures from crises into findings**: both red runs landed exactly inside the pre-declared "proven on first configured run" envelope — no credibility lost, two real API lessons captured as groomed issues with complete orchestrator-minimized diagnoses.
- **Cloud-platform workflows have runner-only protocols** (`GITHUB_OUTPUT`) and **cross-API contracts** (Render's servicePATCH vs env-vars endpoint) that no local rehearsal can fully cover; the honest split is rehearsal-for-logic + real-run-for-protocol, with error bodies ALWAYS visible (the swallowed 400 cost a cycle; the printed ones cost minutes).
- **First image-mode switches queue multiple deploys** (PATCH auto + env auto + explicit) — poll caps must be sized for the queue, or the re-dispatch pattern used once the switch settles.
- The reviewer's re-verification of a fix is not a formality (checkout-provenance catch, cycle #23) and a reviewer's truthfulness finding on a Deviations claim (this cycle) both landed — the independent readers keep earning their tokens.

### Next

Cycle #26 on **#48** (prod service + first manual promotion of the immutable tag + scheduled health monitor — C2's second half). Owner-side: the prod Render service can now be created FROM the public GHCR image (`ghcr.io/lucapug/clown-circus-reloaded`, tag `main` or the digest), with the prod Neon `DATABASE_URL` and `OTEL_RESOURCE_ATTRIBUTES=…=prod`. Then #45/#46 in parallel.

## 2026-10-22 — Cycle #26 (issue #48, PR #54): prod promotion + health monitor — **C2 ACHIEVED one day early**

### What and why

The C2-closing cycle: `cd-promote.yml` (workflow_dispatch ONLY — inputs `tag` + optional `expected_digest`; anonymous GHCR digest resolution; **digest mismatch refuses promotion before any Render call**; then the proven Render sequence — owners → image PATCH → env-vars GET/PUT with prod values → POST deploy → poll 45×20 s with transient tolerance → PROD health exact-body) and `health-monitor.yml` (cron `*/15` + workflow_dispatch; both `/health` URLs; 3×10 s retries; exact-body; `permissions: {}`; the red job IS M5's alert hook). Plus the one-line `DEV_HEALTH_URL` variable migration in cd-dev.yml and the runbook promotion/rollback section. The owner-side enabler: the prod Render service (`clown-circus-reloaded-prod`, `srv-dbcv5p7avr4c738u0pq0`) was created repo-build mode from the wizard (whose GHCR "Existing image" search stubbornly refused the public package — anonymous pull worked, Render's validator didn't; lesson in the runbook), with prod Neon `DATABASE_URL`, service-level `OTEL_RESOURCE_ATTRIBUTES=…=prod`, otel group linked **at creation**, and auto-deploy OFF.

### The C2 demonstration (all orchestrator-executed, evidence on #48)

1. **Deploy-on-green, zero-touch**: merge `bd1adea` → CI 39777072698 green → auto-CD 39777199373 → image `…:20261022-121803-bd1adea` (digest `sha256:443efc94…`) → dev redeployed automatically (~2 min).
2. **Manual promotion**: [run 39777647379](https://github.com/lucapug/clown-circus-reloaded/actions/runs/39777647379) dispatched with tag + expected digest → digest MATCHED → prod switched repo→image mode → `live` in **~90 seconds** → prod `/health` 200 exact-body (first probe hit the 42 s cold start — by plan). **The same digest now serves both environments.**
3. **Health monitor**: dispatch 39780621626 → SUCCESS on both URLs; cron armed (also keeps the free-tier services warm).

**C2 (Oct 23 EOD): ACHIEVED Oct 22 midday** — CD green on dev (automatic) + one manual promotion to prod demonstrated, rollback documented. The plan's fallback (paper promotion) never needed.

### Measured ledger (cycle #26)

PM 223,647 · engineer 2,618,180 · QA 1,179,926 · reviewer 466,660 → **≈ 4.49M**. Two-day loop total (cycles #19–#26): **≈ 42.0M** measurable. The three dispatch runs + monitor test: zero subagent tokens.

### Lessons

- **The wizard/API asymmetry is now documented**: Render's "Existing image" search refused a provably-public GHCR package while the anonymous registry pull succeeded AND the API PATCH had switched dev to image mode the day's cycle before — when a platform wizard disagrees with the protocol, the protocol wins (and the runbook records both paths).
- **Promotion identity is enforced, not promised**: the digest assert fires before the first Render call — the #49 reviewer's mutability note became an operational gate.
- The first-switch queueing lesson (three serialized deploys) was pre-paid into the promote poll cap (45×20 s); the actual promotion took ~90 s once the mode was settled — caps sized by evidence, not fear.
- C2's checklist is now fully mechanical: merge → CI → auto-CD (dev) → promote (prod, manual, digest-gated) → monitor green on both.

### Next

M4 remains open on #45 (integration suite in Compose, single-command tests) and #46 (Playwright E2E happy path) — both independent, both rubric-relevant for Testing depth. Then M5 (Grafana dashboards, ≥1 alert on the monitor's red hook, on-call drill tier 1) and M6 (docs/demo) toward the Oct-26 submission. Post-merge housekeeping for the orchestrator: none pending — all repo variables set.

## 2026-10-22 (afternoon) — Cycles #27–#28: the M4 queue closed — integration story and E2E land

### What and why

The owner called the M4 queue for same-day closure. Two sequential cycles:

- **Cycle #27 (issue #45, PR #55)**: the single-command test story — root `npm test` (concurrently, two real lanes, kill-others-on-fail) and `npm run test:integration` (~90 s: compose `clown-circus-it` on loopback 18000/15432 via a `!override` port file, the #41 integration tests LIVE, the FULL backend suite against real Postgres via `IT_DATABASE_URL`, trapped `down -v`); CI stays 6 jobs (recorded decision: the CD is the merge gate; rubric #6 reads single-command-local).
- **Cycle #28 (issue #46, PR #56)**: Playwright E2E happy path — hooks-driven (reset/advanceTicks/inject, dev server on :4300 with the `--host 127.0.0.1` vite-5 macOS pin), compose real backend (CORS overlay), forced game-over via the real `inject lives:0`+tick transition, submit→leaderboard asserted with per-run unique names, prod-gating grep (`test:prod-gating` → 0 matches in dist), retries 1/workers 1 as the plan §8 flake budget. CI stays local-only (E2E is "extra" per the final rubric).

### The rework (cycle #27): the two readers found complementary real defects

QA FAILed the docs counts (the 6 unit skips are 5 integration + 1 replayTrace; the file has 5 tests, not 6) while the reviewer REQUEST_CHANGES'd a **[major] the QA battery had not covered**: the conftest `IT_DATABASE_URL` branch had NO host guard — a forgotten exported variable pointing at any remote Postgres (e.g. Neon dev) would have been `drop_all`-ed per test at the next pytest run. Fix (`b9d13b2`): loopback-only guard (localhost/127.0.0.1/::1, `IT_ALLOW_REMOTE=1` escape) failing at conftest LOAD before any engine exists — verified live with a Neon host aborting; plus the IT script exporting `DATABASE_URL` (the app lifespan now targets the compose Postgres, not a stray SQLite file), artifact gitignored, docs counts and paths corrected. Final: [REVIEW: APPROVE](https://github.com/lucapug/clown-circus-reloaded/pull/55#issuecomment-6342962440), [QA PASS (rework)](https://github.com/lucapug/clown-circus-reloaded/pull/55#issuecomment-6343111481). Merged by the owner.

Cycle #28 needed **zero rework**: [QA PASS](https://github.com/lucapug/clown-circus-reloaded/pull/56#issuecomment-6344504031) — 2-run stability (13 s/11 s wall, test body ~1 s), the RED proof that the test dies without the hooks (independent API confirmation of the leaderboard entry), prod-gating grep verified complete against the real `debugHooks` export surface; [REVIEW: APPROVE](https://github.com/lucapug/clown-circus-reloaded/pull/56#issuecomment-6344410781) — zero findings above note, TOCTOU-free by construction. Merge pending the owner; its merge closes **M4 4/4**.

### Measured ledger (cycles #27–#28)

#27: PM 270,959 · engineer 1,232,466 · QA 2,510,252 · reviewer 659,459 · mini-agent 1,049,794 (trial #10: the four-fix rework) ≈ **5.72M**. #28: PM 337,251 · engineer 3,055,566 · QA 1,233,740 · reviewer 408,840 ≈ **5.04M**. Two-day loop total (cycles #19–#28): **≈ 52.3M** measurable.

### Lessons

- **The guard-shaped defect is its own class**: QA's behavioral battery (all green, mutations biting) could not see that the new test capability was a loaded gun pointed at whatever Postgres the shell named. Only the normative reader asking "what happens on the unhappy path?" catches a missing guard. Both defects shipped in the same PR; both caught before merge.
- The E2E RED proof (rename `__game` → test dies) is the hooks-equivalent of the mutant test: it proves the test measures the thing it claims to measure.
- Stray untracked Playwright artifacts appeared on the shared tree from local runs — cleaned; the .gitignore additions in #56 prevent recurrence.

### Next

**M4 4/4 on the owner's merge of PR #56.** Remaining toward Oct-26: M5 (Grafana Cloud dashboards for the key journey, ≥1 actionable alert wired to the health-monitor red, on-call drill tier 1 — telemetry and the alert hook are already armed), M6 (README/docs polish, demo artifacts), M7 (repo public + submission). #45/#46 were the last groomed build issues; M5/M6 grooming next session.

## 2026-10-22 (evening) — Addendum: shared-tree incident, the play worktree, and a play report

**Incident (orchestrator-caused, owned):** while the owner played on `npm run dev` from the SHARED working tree, my post-cycle `git checkout main` (leaving `feat/46-playwright-e2e`, where `vite.config.ts` is modified) triggered a Vite restart → page reload → an in-flight game (4–5 lives) reset. Structural fix, applied immediately: a dedicated **detached play worktree** at `../ccr-play` (deps installed; agents never touch it; owner updates between games with `git fetch && git checkout --detach origin/main`). The localStorage ring and leaderboard cache survive — same origin :5173.

**Play report → issue [#57](https://github.com/lucapug/clown-circus-reloaded/issues/57):** a board clown stranded at vx≈0 (no slide, no fall). Related-but-distinct from the deferred "skating" v2 item (vx PERSISTING). No finalized trace (the session died in the restart) — the issue holds the report, asks for a recorder trace at the next occurrence, and poses the 2025-parity + fix-vs-v2 questions to the owner. Recommendation recorded: decide after M5 unless gameplay-breaking (the stranded clown soft-locks only itself; input launch still works).

## 2026-10-23 — Cycle #29 (issue #58, PR #61): dashboards-as-code + the one-character stack-URL diagnosis

### What and why

The Observability criterion's concrete artifact: `ops/grafana/` holds the journey dashboard (`ccr-journey`: per-endpoint rate/duration/errors grouped by `deployment_environment_name`, log + trace panels with `${__value.raw}` dataLinks to Tempo) and the env/version dashboard (`ccr-env-version`: every deploy as a new `service_version` line), applied to Grafana Cloud by `ops/grafana-apply.sh` (offline `validate` = 17 checks incl. no-customer-data greps and a localhost mock round-trip with 401/500 error paths; `apply` idempotent by fixed UID + overwrite) with a dispatch-only workflow. The #52 error-visibility pattern reused throughout; the three stated-not-invented constants (metric stem, cloud datasource UIDs, TraceQL env form) parameterized as commented constants.

### The first apply failed — and the failure was one character

Run 39955442024: offline validate 17/17 PASS, real apply → **HTTP 530, Cloudflare error 1016 (Origin DNS error)** on `pinkmaggie3108.grafana.net`. Diagnosis (orchestrator, two curls): the wildcard `*.grafana.net` resolves ANY subdomain to a gateway CNAME, but the origin lookup fails for non-existent slugs — **the stack slug was `pinkmagpie3108` (magpie), not `pinkmaggie3108`**. The owner's chat message carried the typo; the OTLP endpoint never exposed it because the OTLP gateway is shared (`otlp-gateway-prod-eu-west-2…`), not stack-specific. `GRAFANA_URL` variable corrected → re-dispatch → **both dashboards applied (HTTP 200, status=success, version 1 each)**, datasource UIDs verified against the live stack.

### Outcome and verdicts

[REVIEW: APPROVE](https://github.com/lucapug/clown-circus-reloaded/pull/61#issuecomment-6362148907) — zero findings above note (3 polish notes: zero-5xx routes render "no data" rather than a 0-line; the README's "panels aggregate only" overstates since one panel shows raw log lines — safe only because the backend never logs names, which the reviewer re-verified at source; the journey-logs query is unfiltered). The first QA agent stalled on the inactivity timeout (second occurrence — recovery per procedure: stale worktree registration removed, fresh QA with bounded battery); [QA PASS](https://github.com/lucapug/clown-circus-reloaded/pull/61#issuecomment-6362348294) — mutations bite (uid removed, name-injected, guard unset), boundary declared (real apply = orchestrator post-merge). Merged; real apply green (run 39955716405). Owner UI check + screenshot pending (M6 evidence).

### Measured ledger (cycle #29)

PM 324,936 · engineer 2,778,105 · QA 766,499 (fresh; the stalled run unmeasured) · reviewer 437,066 → **≈ 4.31M** measurable. The real apply: zero tokens (pure Actions).

### Lessons

- **Shared-infrastructure endpoints hide identity errors**: the OTLP gateway accepted telemetry for any valid token regardless of the stack slug in our notes — the stack URL was never protocol-verified until an API call needed the origin. Verification debt surfaces at the first consumer.
- The wildcard-DNS signature (resolves-but-530/1016) is the reusable diagnostic: `*.grafana.net` always resolves; a 530/1016 means WRONG SLUG, not outage.
- Pipeline error visibility (the #52 convention) printed the Cloudflare body verbatim — one run, one look, root cause obvious.

## 2026-10-23 — Cycle #30 (issue #59, PR #62): the 5xx alert as code — zero rework

### What and why

The Alerting criterion's artifact: `ops/grafana/alert-rule.json` (Grafana-managed multi-dim rule — 5xx rate > 0 per `deployment_environment_name`, `for: 2m`, eval 1m, `noDataState: OK`, summary + runbook_url annotations) provisioned by the extended `grafana-apply.sh` (`apply-alert`: contact point from `ALERT_EMAIL` repo variable with a loud pre-network guard, notification policy, idempotency by uid; the PM's research catch — the dashboard glob would have applied the alert rule as a dashboard — fixed by narrowing to `*-dashboard.json`). Plus the drill probe: an env-gated `GET /__probe/5xx` in main.py (`# PROBE #59` marker, default 404, per-request read, 2 tests) — THIS issue's firing-proof vehicle; #60's drill uses a real injected defect instead, and the probe gets a marked removal PR after M5 (removal plan recorded in 3 places). Dry-run extended (scenario O: real validate + mutated-copy flip).

### Outcome and verdicts

[QA PASS](https://github.com/lucapug/clown-circus-reloaded/pull/62#issuecomment-6366117230) — validate 28 PASS (17 baseline unchanged + 11 alert), mutations bite, `DRILL_PROBE_5XX` grep EMPTY across `.github/` and `ops/` (prod unreachable), backend 51. [REVIEW: APPROVE](https://github.com/lucapug/clown-circus-reloaded/pull/62#issuecomment-6365920756) — zero blocker/major/minor; the probe decision explicitly endorsed ("well made — out-of-tree or a temp real defect would both be worse"); notes: the policy-fallback branch lacks offline coverage (watch the `::warning::` at first real apply), the eval interval rides the stack default (stated-not-invented). Boundary: the REAL fire-and-clear on dev = orchestrator+owner post-merge (owner flips the probe env, orchestrator sustains the 5xx, owner receives the email, probe off → clear). Merge pending the owner; `ALERT_EMAIL` repo variable is the one owner input.

### Measured ledger (cycle #30)

PM 233,994 · engineer 5,163,986 · QA 1,165,213 · reviewer 319,354 → **≈ 6.88M**. Zero rework. Three-day loop total (cycles #19–#30): **≈ 61.2M** measurable.

### Lessons

- The alert design benefited from being groomed AFTER the dashboards: the metric-stem/datasource constants were already parameterized with names — #59 reused them instead of re-deriving (grooming order as a cost lever).
- The probe vs injected-defect distinction is now load-bearing for M5's integrity: the probe proves the ALERTING LAYER; the #60 drill proves the ON-CALL LAYER with a realistic defect. Different layers, different evidence — documented in three places so the submission cannot conflate them.

## 2026-10-23 — Cycle #31 (issue #60, PR #63–#65): the on-call drill + rollback drill — **M5 COMPLETE**

### What and why

The M5 closer, executed as a real drill: the injection PR #63 (probe removal + the env-gated valid-payload 500, test-passing by design) merged at 15:44Z; the owner set `DRILL_DEFECT_SCORES_500=1` on dev; the orchestrator's sustained burst (140 × 500, 18:03–18:08Z) fired `ccr-5xx-user-impact` → **Firing** (email to the owner, Alerting UI red — owner screenshot). The **on-call subagent was paged with the alert TEXT ONLY** at 18:08Z: no issue link, no drill design, no env-var name.

### The on-call performance (the drill's core measurement)

Root cause in **~8 minutes**: `git log` → marker grep → the gate in `routes_leaderboard.py`; the env activation inferred DEDUCTIVELY (CI-green code + live 500s = the service env carries the gate). Impact characterized precisely: valid payloads 500, invalid 422, **zero data loss** (the raise precedes every write), health/leaderboard unaffected — and a coincidental cold-start one-off GET 500 correctly triaged as not-the-defect. Shipped: [PR #64](https://github.com/lucapug/clown-circus-reloaded/pull/64) (the fix: gate removal, 49 green) + [PR #65](https://github.com/lucapug/clown-circus-reloaded/pull/65) (the runbook remediation entry) + the diagnosis comment on #60. The owner reviewed and merged both (the human review is the drill's gate). Clear: auto-CD deployed the gate-free image → 5xx → 0 → alert → Normal.

**Honest assessment (recorded)**: the `# DRILL #60` marker made root-cause CONFIRMATION instant — a real defect carries no marker. The genuine on-call work was the rest of the arc: impact discrimination (valid-vs-invalid), persistence checks, cold-start triage, and fix scoping. The drill's known limitation, stated in the evidence.

### The rollback drill (SHOULD → done) + a real incident found en route

Three digest-gated promotions on prod: latest (`4e43707`/`e975a8b9…`) → **rollback to previous** (`20c55c2`/`2d2e876c…`) → re-promote current. All health-validated; prod data survived all three swaps. **En route, a REAL incident**: the first-ever valid `POST /scores` on prod (16:00Z) returned a transient 500 (retry → 201; write+read then verified healthy — the drill env had NOT leaked to prod: the plain-text 500 body differs from the drill's JSON signature, and prod's promoted image predates the gate code). Filed as [#66](https://github.com/lucapug/clown-circus-reloaded/issues/66) (low priority: the #10 offline queue already shields users — a 500 is non-definitive → queued → synced). Structural note: the /health-only monitor structurally cannot see write-path failures (decision C) — the trade-off is documented, the follow-up issue holds the options.

### Measured ledger (cycle #31)

PM 211,277 · engineer 1,258,525 · QA 541,468 + 229,307 · reviewer 397,941 · mini-agent 236,836 (trial #11: F401) + on-call agent 522,078 → **≈ 3.40M**. The on-call page-to-PRs: ~8 minutes. Three-day loop total (cycles #19–#31): **≈ 66.9M** measurable.

### M5 COMPLETE (5 rubric points banked)

Observability (2): dashboards-as-code applied live, journey + env/version, both environments, trace-ID correlation story. Alerting (1): the 5xx rule live, **fired and resolved on real traffic**, email delivered, provisioned-by-JSON committed (UI-fallback deviation honestly recorded — the provisioning API is absent on this stack, verified with an admin session). On-call (2): tier-1 drill executed end-to-end with an independent on-call agent on symptoms only, fix PR human-reviewed, plus the demonstrated rollback. The drill also surfaced a real prod latent defect (#66) — the monitoring layer is already earning its keep.

### Next

M6 (docs/demo: README polish, the dashboard/alert screenshots collected, the `.nvmrc` nits, demo artifacts) and M7 (repo public + self-assessment + submission Oct 26). Grooming next session; #57 (board-clown strand) awaits the owner's recorder trace + fix-vs-v2 call; #66 is post-submission unless trivial.

## 2026-10-24 — Session handoff (fresh-chat): start-of-day state

**Contesto del passaggio:** la sessione del 21–23/10 ha superato le 500k parole di contesto; l'owner richiede handoff su chat fresca. Questa entry è lo stato autoritativo di inizio giornata.

### Stato al passaggio (24/10 morning)

- **M0–M4 complete.** C1 passata il 21/10 (PASSED, con il finding merge-order fixato in giornata); C2 **achievable→ACHIEVED il 22/10, un giorno in anticipo** (CD deploy-on-green su dev dimostrata zero-touch + promozione manuale a prod digest-gated, run 39777647379; rollback drill a 3 atti su #60).
- **M5: lavoro ed evidenze COMPLETE, ma issue #60 ancora APERTA** (label `must,in-progress,M5` — l'owner ha ragione: "M5 completa" era prematuro rispetto al tracker, D2 dice che le GitHub Issues sono canoniche). Manca l'ultimo atto del ciclo di vita del drill: **la PR di rimozione marcata** (decisione D2 del brief #60) — rimuovere il gate `DRILL_DEFECT_SCORES_500` da `backend/app/routes_leaderboard.py` (prima statement del valid-payload path, marker `# DRILL #60`), i suoi 3 test in `backend/tests/test_drill_defect_scores_500.py`, e registrare i tre URL di rollback drill nel runbook (`ops/dev-deploy-runbook.md`). PR con `Closes #60` → M5 label complete. Motivo(addizionale) per farla PRIMA della sottomissione: il repo va pubblico (D11) e un gate 500 intenzionale, per quanto documentato, non deve stare nel codice consegnato.
- **Issue aperte (3):** #60 (sopra) · #57 `[bug]` play report board-clown strand — aspetta traccia recorder dall'owner + decisione fix-now vs v2 · #66 `[bug]` first-write 500 transitorio (riprodotto ANCHE su dev il 23/10 sera; + il pattern deploy-swap-window documentato nel commento serale) — candidata post-sottomissione.
- **Servizi:** dev + prod LIVE e sani (200); prod sul tag `20261023-162600-4e43707` (digest `e975a8b9…`, include drill-removal? NO — include tutto tranne la rimozione del gate, che è appunto la PR da fare); health monitor cron `*/15` verde; alert `ccr-5xx-user-impact` in Normal (fired+resolved evidence su #59, drill record su #60).
- **Setup credenziali/variabili (tutto configurato):** GitHub secrets `RENDER_API_KEY`, `GRAFANA_SA_TOKEN`; repo variables `RENDER_DEV_SERVICE_ID`, `RENDER_PROD_SERVICE_ID`, `GRAFANA_URL` (https://pinkmagpie3108.grafana.net — ⚠️ magPIE non maggie), `DEV_HEALTH_URL`, `PROD_HEALTH_URL`, `ALERT_EMAIL`. Owner ha rimosso `DRILL_DEFECT_SCORES_500` da dev (23/10 sera); la variabile `DRILL_PROBE_5XX` se ancora presente su dev è INERTE (la route probe è stata rimossa dal codice in #63) — rimuoverla per igiene.
- **Play worktree owner:** `../ccr-play` (detached su main; aggiornamento tra le partite: `git fetch && git checkout --detach origin/main`).
- **Ledger 3 giorni (21–23/10):** ≈ 66.9M token subagent misurati, 12 cicli, 17 PR mergiate, 30 issue create (27 chiuse), zero emergenze non gestite.

### Prime attività della nuova sessione (ordine)

1. **Ciclo slim: PR di rimozione drill** (chiude #60 → M5 complete ON TRACKER): branch `chore/60-drill-removal`, rimozione gate + 3 test + runbook URLs, `Closes #60`, attribution `engineer.md@b0d2df9`, slim cycle (engineer → QA + reviewer). Post-merge: auto-CD → verificare `POST /scores` 201 su dev.
2. **Grooming M6 + M7** (ultimi milestone): M6 = README/docs polish (nit `.nvmrc` in README:32; AGENTS.md già corretto), **rimozione marcata già fatta al punto 1**, demo artifacts (screenshot owner: dashboard ccr-journey, alert Firing/History, leaderboard dev+prod), agent-work-evidence aggiornato. M7 = self-assessment sui 12 criteri finali, **D11: flip repo pubblico + pin SHA**, submission + peer review (3 progetti, obbligatorie).
3. **Follow-up da non dimenticare:** #57 (owner: traccia + decisione) · #66 (owner: traceback da Render logs ~16:00Z; fix candidato = warm-up lifespan) · la rimozione della variabile `DRILL_PROBE_5XX` su dev se presente.

**Lezioni vive per la nuova sessione:** checkout-main-first su ogni write; smoke = il comando che gira in CI (mai `tsc --noEmit` nudo); brief-vs-spec → vince la spec; browser automation = mechanism checks only; riprodurre i parser localmente prima di iterare sul cloud; **milestone-complete claims devono combaciare col tracker** (la lezione di stamattina: il tracker aveva ragione, il diario no).

**Per l'owner — 3 cose aperte non bloccanti:** (1) #57: traccia recorder alla prossima occorrenza + decisione fix-vs-v2; (2) #66: traceback dai Render logs (post-submission ok); (3) rimozione igiene di `DRILL_PROBE_5XX` da dev se ancora presente.

## 2026-10-24 — Cycle #32 (issue #60, PR #67): the drill's final act — then grooming + full-KB alignment

### What and why

The session handoff (this morning) prescribed a "marked removal PR" deleting the `DRILL_DEFECT_SCORES_500` gate + its 3 tests and recording the rollback drill. **Primary-source verification inverted the handoff**: the on-call fix PR #64 (`0e916a8`) had ALREADY absorbed the code half — the smallest fix IS the removal (gate + `import os` + 3 drill tests deleted; repo-wide grep zero). The genuine remainder was the brief §2.6(b) half: the rollback-drill record in `ops/dev-deploy-runbook.md` — the drill had been executed (three `cd-promote` dispatches) but recorded only in #60's drill-record comment, not in the file the acceptance criteria name.

The slim cycle shipped exactly that: a docs-only PR (+21 lines) adding the dated "Rollback drill record (issue #60, 2026-10-23) — DRILL artifact" — three digest-gated dispatches (promote `4e43707` → **rollback** `20c55c2` → re-promote `4e43707`) with run URLs, tags, and FULL digests taken from the runs' own `resolved digest of <tag>` log lines (the gh token lacks `read:packages`; the logs are the primary source), explicitly labelled DRILL with a cross-ref to #66 (the same-day real incident). The §2.6 deviation (code half already absorbed) documented in the PR body per brief §7.

### Outcome and verdicts

[REVIEW: APPROVE](https://github.com/lucapug/clown-circus-reloaded/pull/67#issuecomment-6381380182) — zero blockers/majors/minors; two notes (PR-body wording imprecision — the substantive no-dead-code claim verified true; the pre-existing C2 placeholder correctly left out of scope, tracked in #68). [QA PASS](https://github.com/lucapug/clown-circus-reloaded/pull/67#issuecomment-6381401124) — 7/7 with evidence: diff scope, record accuracy vs primary sources (digests byte-identical, `expected_digest matched` + `health ok` in all three runs), drill-from-real labelling, no secrets, AC traceability, suites OBSERVED green (252+49). One pre-existing finding routed to #68 (runbook AC2 stale since #45 — the loopback fixture matches the secrets grep). CI 6/6 on the branch. **Merged by the owner 07:43:55Z → #60 CLOSED (COMPLETED) → `in-progress` removed → M5 COMPLETE ON THE TRACKER** — the D2 lesson from this morning applied: the claim now matches the canonical tracker.

Post-merge: CI success → CD dev success on the merge commit → **`POST /scores` → 201 with persistence** (entry id 5 read back via `/leaderboard` 200); a first probe with an over-long name took 422 — the drill's valid-vs-invalid discrimination re-proved itself unprompted. M5's 5 rubric points are now banked AND tracker-consistent.

### Grooming + full-KB alignment (owner request)

- **M6 = [#68](https://github.com/lucapug/clown-circus-reloaded/issues/68), M7 = [#69](https://github.com/lucapug/clown-circus-reloaded/issues/69)** created in the four-section D2 format; labels `M6`/`M7` minted; backlog map updated (`4e717fa`; critical path now #60 → #68 → #69).
- **The owner added KB 08 ("How to Write a Good README", A. Grigorev 2026-07-16) and asked for a full-KB pass.** PDF 08 read in full here; 02+04, 03+05, 06+01 passed by three KB-review subagents. #68 restructured on KB-08's 16 sections / 4 parts with new ACs (`.env.example` — verified absent; the 8-item "Common mistakes" checklist; the "AI drafts, human verifies" protocol; role-file frontmatter `name:`/`description:` per [04] p.13; one real skill in `.agents/skills/` per [04] p.9; the four-pillar extension pack; the graph diagram; the four-level vocabulary; the #60 incident as a reconstructable timeline per [01] p.9; rollback line in the README per [06] p.19; dashboard screenshots WITH filter dropdowns per [06] p.15). #69 gained the self-evaluation protocol ([08] §Self-evaluation), the pre-empted CI-scope deviation (unit-only CI gate vs [05] pp.11–12 — cite, don't hide), peer-review scheduling, and the D11 flip-surface caution (no raw Grafana URLs; `ops/` enters the logged-out check).

### ⚠️ Open item routed to the owner: the deadline

KB 01 p.13 states "Project 1: submit by **2026-10-19**, peer reviews by **2026-10-26**; Project 2: submit by **2026-11-09**, peer reviews by **2026-11-16**", deferring to the platform. The plan's 2026-10-26 submission date matches Project 1's PEER-REVIEW deadline, not either slot's submit date. If this is Project 2, M7 gains ~2 weeks of buffer and the Oct-25 freeze can relax. Dates in plan/#69 intentionally untouched until the owner checks the platform.

### Measured ledger (cycle #32)

QA 611,390 · reviewer 240,823 · KB-review agents 479,369 + 275,347 + 351,367 → **≈ 1.96M** subagent-measured (two failed dispatches before a retry — provider concurrency — unmeasured). Four-day loop total (cycles #19–#32): **≈ 68.9M**.

### Lessons

- **Handoff summaries err in BOTH directions**: yesterday's handoff over-declared an M5-claim; today's under-derived the removal PR — describing work the on-call fix had already done. The recovery is the same in both cases: primary sources (the #64 diff, repo grep) before writing a plan. Verify-then-write saved a no-op code PR and shrank the cycle to docs-only.
- **The course KB is a requirements surface wider than the rubric**: the full-KB pass surfaced concrete, checkable artifacts the rubric never names (frontmatter, skills, `.env.example`, incident timelines, panel-explained screenshots) that graders live inside. Aligning the groomed issues to the KB before execution is cheap; aligning after review is rework.
- **The drill keeps earning post-drill**: the post-merge 422-on-invalid probe was a free re-demonstration that the validation contract survived the removal — evidence for free in the cycle record.

### Next

**M6 execution on #68** — now the largest open work (the docs face carries 8 graded points): README per KB-08, evidence/pack/permissions docs, role-file frontmatter, one distilled skill, `.env.example`. Owner inputs queued: deadline confirmation, dashboard screenshots (filters visible), the two-session-ritual video on prod. Then M7 on #69. Follow-ups unchanged: #57 trace, #66 traceback, `DRILL_PROBE_5XX` hygiene on dev.

**Addendum (same day): the deadline question is RESOLVED.** The owner confirmed on the course platform: submission deadline = **2026-10-26** (platform supersedes KB 01 p.13, whose slot dates are outdated). The plan's original date was correct all along; the Oct-25 EOD scope freeze stands. M6 today, M7 tomorrow.

## 2026-10-25 — PROVIDER HANDOFF ENTRY (read me first: fresh session on a NEW LLM provider starts here)

**Why this entry exists:** the z.ai provider degraded repeatedly on Oct 24–25 (network failures / server errors killing agent sessions mid-task, ~7 interruptions across two days). The owner must hand off not just the session but the provider itself. Everything a fresh orchestrator needs is in the repo (AGENTS.md → this entry); nothing relies on any provider's session memory. Verify-then-write: every claim below carries its checkable pointer.

### Non-negotiable context

- **Deadline: submission 2026-10-26** (owner-confirmed on the platform; recorded in #69 and `a3118a5`). Scope freeze **Oct 25 EOD** (plan §6). Milestones M0–M5 COMPLETE on the tracker; remaining: **M6 (#68, docs/demo) today, M7 (#69, submission) tomorrow**.
- Process: graph loop per `_docs/process.md` §8 (PM brief = cycle source of truth; engineer → QA + reviewer; **the human merges**; attribution headers on every agent comment). Working defensively under provider instability is itself a recorded deviation — see Lessons.

### State at handoff (2026-10-25 ~12:00Z) — all verified this morning

1. **PR #70 (M6 PR-1, agent-pack docs) is READY FOR MERGE**: QA PASS (comment 6383452332), REVIEW: APPROVE (6395641728; the one [minor] fixed by `5e6f185` and re-verified), CI 6/6. Branch `feat/68-agent-pack-docs` (HEAD 5e6f185). Disclosure comments on the PR explain the orchestrator-opened-PR deviation (engineer authored all content; its sessions died post-commit). **Owner action: merge.** After merge: run the PR-2 cycle.
2. **PR-2 (README rewrite + `.env.example`) NOT STARTED** — its full spec is the PM brief on #68 (comment 6382048768): branch `feat/68-readme-demo` from merged main, KB-08 16-section structure, demo placeholders (owner media pending), `Closes #68` only here. The brief is self-sufficient.
3. **Owner inputs pending**: dashboard/alert screenshots (env+version filters visible), the demo video = course's two-session ritual on PROD (play → game over → submit "Luca" → leaderboard) — note: `window.__game` hooks are DEV-only, so on prod the game plays naturally; warm the service first (first request after idle takes ~43 s, measured). Owner reviews PR #70 meanwhile.
4. **Alert "firing since Oct 24 ~19:00 CEST" — ROOT CAUSE FOUND, not new 5xx**: a **NoData alert instance active since 15:13Z Oct 24** is emailing (`ccr-owner-email`); the committed rule says `noDataState: OK` but the live rule evidently doesn't carry it. Full evidence + actions: the consolidated comment on #66 (6397537178). **Mitigation = re-run the `grafana-apply` workflow (workflow_dispatch, no inputs, idempotent) — then verify the instance goes Normal.** Read-only diagnose tool committed on scratch branch `ops/grafana-diagnose` (do not merge; iterate or delete after use; its parser has 2 known bugs listed in the #66 comment).
5. **#66 (real defect) stays post-submission**: transient first-DB-request 500s after idle; fix candidate `pool_pre_ping` on `create_engine` (`backend/app/database.py:42`); the Oct-25 canary measured ~43 s first-response wake on both envs, paths healthy when warm (201s read-back).
6. Health-monitor red runs (Oct-24 05:40/09:39/20:38Z, Oct-25 09:39/11:13Z) = timeout class vs the ~43 s cold start; runbook already prescribes the 3×10s→30s tuning; one-line workflow change when convenient.
7. Services healthy at handoff (dev+prod 200); last deploy on main: `a3118a5`. Branches: `main` clean; `feat/68-agent-pack-docs` (PR #70); `ops/grafana-diagnose` (scratch tool). Play worktree `../ccr-play` (owner's, untouched).

### Critical path to submission (nothing else matters first)

TODAY (Oct 25): owner merges #70 → PR-2 cycle (engineer → QA/reviewer → merge) → owner fills demo media → diary cycle entry → EOD freeze. TOMORROW (Oct 26, M7/#69): agent drafts `docs/self-assessment.md` (12 criteria, evidence-linked) → owner approves → final digest-gated promotion (brings prod to final main) → D11 flip public + pin SHA + logged-out check → owner submits on the platform → 3 peer reviews. Non-blocking: #66/#57/DRILL_PROBE_5XX hygiene stay open into the improvement window.

### Lessons (Oct 24–25, provider degradation)

- **Defensive mode worked**: small commits after every unit of work (the engineer's 6 commits survived two session deaths untouched); mechanical completion by the orchestrator with mandatory disclosure in the PR body; narrow-rescope subagents; verify-then-write against primary sources before ANY plan. Work-in-files, not-in-agent-memory proved the durable substrate — again (first proven in cycle #22).
- **The alert layer produced a false "continuous firing" via NoData emailing** — an alerting-semantics gap (noDataState not surviving to live), caught only by interrogating Grafana directly through the existing secrets path (diagnose workflow via `GRAFANA_SA_TOKEN`). The investigation itself doubles as on-call evidence: user-impact report → hypothesis → primary-source verification → smallest-action prescription.
- **Shell heredocs bit once** (unquoted `<<EOF` executed backticks in a PR body — fixed by body-files; lesson: always `<<'EOF'` or Write-tool files for GitHub bodies). YAML plain-scalar colons and inline-python indentation also cost two diagnose iterations — pre-validate locally (ruby YAML, bash -n, ast.parse) before pushing workflows; that check turned iteration 4+ green first try.

## 2026-10-24 → 26 — Cycle #33 (issue #68, PRs #70–#71): M6 under provider fire — and the NoData alert saga

### What and why

The M6 docs/demo cycle, executed across three calendar days because the z.ai provider degraded repeatedly (network/server errors killing sessions mid-task — 7+ interruptions; recorded deviations below). Two PRs per the PM brief (comment 6382048768): PR-1 agent-pack docs, PR-2 README + `.env.example`.

### PR #70 (agent-pack, MERGED Oct 25 13:03Z by the owner)

Six engineer-authored commits (runbook C2+AC2 fixes, evidence extension with the #60 reconstructable timeline, permissions.md on the KB-02 Rules skeleton, agent-extension-pack.md on the four pillars, role-file frontmatter ×4, prod-promotion SKILL.md). The engineer session died TWICE after committing (provider) — work-in-files survived both deaths untouched; the orchestrator completed the mechanical remainder (push + PR) with full disclosure in the PR body. Verdicts: [QA PASS](https://github.com/lucapug/clown-circus-reloaded/pull/70#issuecomment-6383452332) (40+ checks; 12+ live permalink spot-checks; npm test observed 252|6+49); reviewer REQUEST_CHANGES with one [minor] (the #41 chain's FAIL link pointed at the amended PASS comment) → fixed by orchestrator mini-rework `5e6f185` → [REVIEW: APPROVE](https://github.com/lucapug/clown-circus-reloaded/pull/70#issuecomment-6395641728) after a narrow re-verify.

### PR #71 (README + .env.example, MERGED Oct 26 by the owner → **#68 CLOSED, M6 COMPLETE on the tracker**)

The engineer delivered the two `.env.example` files (0d8448c — which also needed one `.gitignore` line, `!.env.example`, surfaced by QA) then died twice more; the README rewrite was authored by the orchestrator under the recorded deviation (commit `44ab8e2`), structured on KB-08's four reader questions. Verdicts: [QA PASS](https://github.com/lucapug/clown-circus-reloaded/pull/71#issuecomment-6399024860) (41 checks; every factual claim traced to source; KB-08 mistakes checklist 8/8); reviewer REQUEST_CHANGES with three one-line [minor]s (future tense on pending demo media + missing env-version checklist item; the missing on-call beat in the ops story; placeholder wording vs the brief template) → mechanical rework `172d90c` → [REVIEW: APPROVE](https://github.com/lucapug/clown-circus-reloaded/pull/71#issuecomment-6399946315). CI 6/6 on every commit. Post-merge (owner request): a three-line **provenance note** before Problem (`d6555b2`) — the deliberate 2025-reimplementation framing, condensed from the old README so the brownfield intent is explicit for reviewers.

### The alert saga (Oct 24–25): "continuous firing" was NoData emailing, not 5xx

The owner reported continuous alert emails from Oct 24 ~19:00 CEST with no traffic of his on Render (his play sessions turned out to hit dev — the "Luc" leaderboard entries). Investigation through a read-only diagnose workflow on scratch branch `ops/grafana-diagnose` (built via `GRAFANA_SA_TOKEN` in GitHub secrets; 4 iterations, its own 2 parser bugs fixed en route — labels live in `schema.fields[].labels`; the dashboard's Loki selector carries the `$env` template variable): the 5xx series over 32h was **zero**; the alert rule carried an **active NoData instance since 15:13Z Oct 24** routed to the email receiver. The committed JSON says `noDataState: "OK"` — but the live rule was **hand-created in the UI** (the recorded provisioning-API-absent deviation from cycle #30) with no-data handling left at the default. The orchestrator's first prescription (re-run grafana-apply) was **wrong** — the dispatch failed 404 on the whole provisioning surface, re-proving the recorded deviation; corrected on #66. **Fix (owner, UI): "Alert state if no data" No Data → Normal → Grafana sent the resolved email; loop closed.** Full record: #66 comments 6397537178 + 6397693601 + 6398028904-class thread. The real #66 defect (transient first-write 500 after idle; ~43 s measured wake, Oct-25 canary on both envs, paths healthy when warm) remains post-submission with fix candidate `pool_pre_ping` (`backend/app/database.py:42`).

### Measured ledger (cycle #33)

PM 582,807 · engineer (PR-1, 2 surviving sessions) unmeasured-fraction of ≈1.2M · QA 841,949 + 500,800 · reviewer 628,880 + 683,470 + 309,371 (re-verify) · KB-review agents 1.11M (Oct 24) → **≈ 4.6M+ measurable** across the three days.

### Lessons

- **Provider degradation is a workflow design problem, not a fatality**: small commits after every unit, work-in-files, orchestrator mechanical completion with disclosure, narrow re-scoped resumes. Every interruption cost time; none cost work. The graph's verification layer (QA/reviewer) stayed intact regardless of authorship.
- **A "firing" report needs the alert's no-data semantics checked first**: NoData instances can email continuously with zero real 5xx. The committed-as-code rule and the live rule diverged silently — the provisioning-API-absent deviation was the root of THAT divergence (UI creation doesn't inherit the JSON). Recorded: when config is applied by hand, verify the hand-applied fields against the source of truth.
- **Prescriptions need the same primary-source discipline as code**: the wrong re-apply recommendation cost one dispatch; the diary's own deviation record was the corrective.
- The diagnose-workflow pattern (read-only API queries via existing secrets, on a scratch branch) is a keeper for post-submission ops.

### Next

**M7 today (Oct 26, submission by EOD)**: self-assessment draft (12 criteria, evidence-linked) → owner approval → final digest-gated promotion (prod to final main incl. d6555b2) → D11 flip public + pinned SHA + logged-out check → platform submission → 3 peer reviews. Owner media (6 screenshots + video per the README checklist) slot into `docs/demo/` — the one M6 remnant, tracked for M7. Follow-ups unchanged: #66 pool fix, #57 trace, `DRILL_PROBE_5XX` env hygiene, scratch-branch cleanup.

## 2026-10-26 — M7: SUBMISSION DAY — the flip is done, the pin is set

### The final sequence (all verified, primary sources)

- **Self-assessment** approved and merged (PR #72, `adc2447`) — the owner's merge IS the approval per #69's AC.
- **Demo media** merged (PR #73, `88d7593`): the production verification-ritual video, the gameplay frame (checklist complete — the earlier deviation resolved in-PR with the disclosure comment), six captioned screenshots; the README Demo section is final.
- **Final promotion** (owner-dispatched per the enforcement point, run [40303348895](https://github.com/lucapug/clown-circus-reloaded/actions/runs/40303348895)): digest gate matched BEFORE any Render call (`20261026-094842-88d7593` = `sha256:50c1e679…71c0`); prod `/health` exact-body verified; functional write+read verified (POST 201 + GET 200 — with the owner's morning "Luc" entries atop the prod leaderboard: the video's evidence, live).
- **D11 flip** (owner, 2026-10-26): repository → **public**. Logged-out verification (unauthenticated curl): repo API `private: false`; README, issues, agent-work-evidence, self-assessment, permissions, extension-pack, the demo video, ops runbook, product-spec — all HTTP 200 anonymously.

### 📌 The submission pin

**`88d7593f6d84472484b976debeaa622359c06535`** (`main` at flip; CI green; the exact image prod serves by digest). Submission links: repo `https://github.com/lucapug/clown-circus-reloaded` · prod `https://clown-circus-reloaded-prod.onrender.com` · self-assessment `docs/self-assessment.md`.

### What remains (post-flip)

The owner submits on the course platform and completes the **3 mandatory peer reviews** (#69's last AC — the issue closes with them). Improvement window (second attempt): #66 `pool_pre_ping` fix (today's owner repro on prod — the offline queue working as designed — is the sharpest evidence yet), #57 recorder trace + fix-vs-v2, `DRILL_PROBE_5XX` env hygiene on dev, scratch-branch cleanup, and the owner's LinkedIn post (`docs/demo/gameplay.png` as the visual, the method-not-the-game as the story).

### The project, honestly, at submission

M0–M7 executed on the agreed plan; 12/12 rubric criteria carried by verifiable evidence (self-assessment, believed 24/24 with the candor section); the tracker tells the truth (3 issues open BY CHOICE, all documented); the diary records every deviation including two days of provider degradation survived by work-in-files. The 2025 game, rebuilt by a 2026 agent team.

**Learn-in-public addendum (2026-10-26):** the post is live — https://lnkd.in/p/da2a-8Wt (gameplay.png as the visual; the "same game, very different human role" story) — and the owner registered the link with the course submission within the same-day window. Remaining after submission: the 3 mandatory peer reviews close #69; then the improvement window (#66, #57, hygiene).

## 2026-10-26 (evening) — Session handoff: post-submission state

**Context:** submission completed today (pin `88d7593f6d84472484b976debeaa622359c06535`, platform form done); repo public since this morning; learn-in-public post live and registered. This entry is the authoritative start-of-next-session state; the repo markdowns (AGENTS.md → plan/process/backlog/diary) carry everything else.

### State at handoff

- **All milestones M0–M7 executed; the project is SUBMITTED.** Prod serves the pinned image (digest-gated, run 40303348895); dev identical; monitor green; alert Normal (noData handling fixed in the UI on Oct 25 — record on #66).
- **Open issues (3, all by choice):** #69 `[must,M7,in-progress]` — closes after the owner completes the **3 mandatory peer reviews** (the submission AC is done; the orchestrator then posts the final comment, removes `in-progress`, and the issue closes as COMPLETED). #66 `[bug]` — post-submission fix candidate `pool_pre_ping=True` on `create_engine` (non-SQLite branch, `backend/app/database.py:42`); today's owner mid-session repro on prod is the sharpest evidence (comment 6412643770). #57 `[bug]` — awaits the owner's recorder trace at the next play session, then the fix-vs-v2 call.
- **Small hygiene backlog (no rush):** remove the inert `DRILL_PROBE_5XX` env var from the dev service if still present (Render dashboard, owner); the scratch branch `ops/grafana-diagnose` (keep — documented as the #66 investigation tool, or delete after extracting its lessons); the local `feat/68-readme-demo` + `docs/demo-media` branches can be deleted (merged).

### Next session's likely menu (owner decides)

1. Peer reviews done → close #69 (the project's true end).
2. Improvement window work: the #66 fix (small PR: pool_pre_ping + a regression note; the runbook/diary already document the mechanism), optionally #57 once a trace exists.
3. Course application follow-up: the Production AI Agents for Generative Media form is ready (texts finalized in-session); registration button not yet active — owner DM'd Alexey; apply when it opens (by Nov 26).

### Standing lessons (unchanged, still true)

Verify-then-write against primary sources; work-in-files beats work-in-memory (survived ~a dozen provider failures across two days); small commits after every unit; the tracker is the truth (D2); handoff risk scales inversely with documentation — the repo just proved it again.

## 2026-10-26 (late) — v1.0.0 tagged: the submission has a version

**What and why:** the repository had no versioning; the owner asked to mark the capstone submission as **v1.0.0** before opening the improvement window. Annotated tag `v1.0.0` → `88d7593` (the submission pin, deliberately not `main`'s tip: the three later commits are diary-only, and `88d7593` is the commit the digest-gated prod image was built from — the tag names the artifact that was actually submitted). Published as a [GitHub Release](https://github.com/lucapug/clown-circus-reloaded/releases/tag/v1.0.0) carrying the pin, the promotion run, the prod URL, the self-assessment link, and the two open-by-choice limitations (#66, #57).

**Decisions:** (1) tag the pin, not HEAD — truth over convenience; (2) no manifest version bumps (`package.json` 0.1.0/0.0.0, `backend/pyproject.toml` 0.1.0): the image tags are date+sha, nothing in CI/CD reads those fields, and a bump would churn both lockfiles for a cosmetic value — revisit only if the project ever publishes packages; (3) post-submission fixes land on `main` after the tag; the next tag (v1.0.1 or v1.1.0) is decided when there is something worth releasing.

**Next:** cycle #34 — issue #66 (`pool_pre_ping`), through the full graph (PM → engineer → QA ∥ reviewer, human merges). #57 stays parked until the owner's recorder trace exists. #69 waits for the three peer reviews (assignments expected from Oct 27, once submission closes).

## 2026-10-26 (late) — Cycle #34 (issue #66, PR #74): the first post-submission fix — pool pre-ping

### What and why

The improvement window opens on the sharpest open defect: `#66`, the transient `500` on the first DB-touching request after idle (Neon auto-suspends after ~5 min; the pooled connection goes stale during gameplay; the game-over `POST /scores` hits it first — the owner's prod repro of this morning: 1st game saves online, 2nd+ games fall to the "saved locally" queue, synced on reload). The issue offered three options (bounded retry / lifespan warm-up / accept); **the reproduced mechanism chose the fix**: warm-up covers only container start (the repro is mid-session), retry covers only the write path — `pool_pre_ping=True` on the non-SQLite `create_engine` tests every pooled connection at checkout and reconnects transparently, for every route. Ratified pre-cycle, with the traceback AC declared satisfied-by-reproduction (never retrieved; three independent repros on record) — so the PM had no scope to invent.

Full graph (process.md §8), no shortcuts for a one-line fix: PM brief ([comment](https://github.com/lucapug/clown-circus-reloaded/issues/66#issuecomment-6421476668), verified live against the venv: SQLAlchemy 2.1.5, lazy construction, `engine.pool._pre_ping`) → engineer ([PR #74](https://github.com/lucapug/clown-circus-reloaded/pull/74), 2 commits: the fix in its brief-mandated branch shape + the README Limitations rewording; new hermetic `backend/tests/test_database.py`, 2 tests, zero Postgres I/O) → QA ∥ reviewer, concurrent and independent.

### Outcome and verdicts

[QA PASS](https://github.com/lucapug/clown-circus-reloaded/pull/74#issuecomment-6421909522) — 7 DoD rows re-run: 51 passed (49 + 2), fix at `database.py:47` in the non-SQLite branch, diff = exactly the 3 allowed files, README line 166 byte-identical / 167 reworded, PR body honest. Row 7 (`npm run test:integration`, Postgres parity — the only check exercising pre-ping against a real pool) **BLOCKED: Docker daemon down on this machine**, pre-agreed in the brief, recorded as BLOCKED not inferred PASS. [REVIEW: APPROVE](https://github.com/lucapug/clown-circus-reloaded/pull/74#issuecomment-6421941474) — formed before reading QA (stated); zero blocker/major/minor; four notes, one to keep: the test pins SQLAlchemy **private** internals (`_pre_ping`, `_creator.__closure__`) — accepted for hermeticity, expect churn on upgrades. Zero rework passes. Orchestrator [close-out](https://github.com/lucapug/clown-circus-reloaded/issues/66#issuecomment-6421974998) posted, `in-progress` removed — **at the human-merge boundary; merge pending (owner)**.

### Measured ledger (cycle #34)

PM 297,886 (12 tools, 6.1 min) · engineer 549,266 (19, 3.7 min) · QA 338,987 (16, 3.4 min) · reviewer 273,718 (12, 4.5 min) → **≈ 1.46M** subagent tokens, 59 tool uses, ≈ 14 min wall-clock (QA ∥ reviewer). One failed PM dispatch (provider network error) before the retry — unmeasured. Against `_docs/graph-tuning.md` §4 targets: total ≤ 3.5M ✅ · engineer ≤ 2M ✅ · zero stalls ✅. Verdict-integrity checklist: QA full independent re-run ✅ · reviewer diff-only, formed before QA ✅ · no FAIL edge (none to route) · human merges ⏳.

### Lessons

- **A reproduced mechanism picks the fix; option lists written before the repro are hypotheses.** Ratifying the decision from the evidence trail (comments 1/4/7) before spawning the PM kept the brief decision-free and the cycle linear.
- **Pre-agreeing the BLOCKED case costs one sentence and saves a false PASS.** Docker was down; the brief had already said row 7 may be BLOCKED; QA recorded exactly that. The real-pool proof is deferred, not faked — it runs with `npm run test:integration` once Docker is back.
- **Hermetic tests of pool configuration buy speed with private-API coupling.** The alternative (a real Postgres in the unit suite) was rejected; the integration battery owns that proof. Named cost, recorded on the PR.
- **Versioning truth (same session): tag the artifact, not the tip.** `v1.0.0` → `88d7593`, the digest-pinned submission commit; diary-only commits after it stay untagged.

### Next

1. **Owner merges #74** → `Closes #66` fires → CD builds the dev image. Then the **owner-approved prod promotion** (`.agents/skills/prod-promotion`, digest-gated) — and the live acceptance test is the repro itself: play two games on prod with a > 5-min pause between them; the second save should be `201` directly, no "saved locally" message. Candidate tag afterwards: `v1.0.1`.
2. When Docker is available: `npm run test:integration` on `main` for the Postgres-parity proof of pre-ping (QA's deferred row 7).
3. `#57` stays parked until the owner's recorder trace; `#69` waits for the three peer reviews (assignments expected from Oct 27). Hygiene unchanged: `DRILL_PROBE_5XX` env on dev, merged local branches.

### Addendum (same session, Docker up) — deferred row 7 executed, caveat closed

The owner started Docker Desktop (on this Mac it runs on demand, not at login — now stated in `AGENTS.md` § Testing so no future QA pass is surprised). A **supplemental QA pass** on the PR branch ([verdict](https://github.com/lucapug/clown-circus-reloaded/pull/74#issuecomment-6422859105), PASS) did two things:

1. **Row 7 for real** — `npm run test:integration`: the stack built from `feat/66-pool-pre-ping` (so the containerized app and the suite's lifespan both use `get_engine()` with pre-ping against the Compose Postgres); vitest `5 passed`, pytest **`51 passed` vs Postgres** (the parity proof now includes the two new tests); `down -v` teardown confirmed, ports free. First attempt died at image build on a registry timeout (`DeadlineExceeded` fetching `ghcr.io/astral-sh/uv:0.13.4` metadata); pre-pulling the base images and re-running went fully green — remedy recorded in `AGENTS.md`.
2. **Behavioral proof of the fix against a real pool** (disposable loopback Postgres, zero repo changes, script inline in the verdict): a pooled connection's server backend terminated with `pg_terminate_backend` — the Neon auto-suspend class. **Control engine (pre-ping OFF): `OperationalError (psycopg.errors.AdminShutdown)` on the next checkout — the 500.** **Fixed engine (`get_engine`, pre-ping ON): transparent reconnect, pid 78 → 80, `select 1 = 1`.** Restart variant (`docker restart`, the closer Neon suspend/resume analogue, all pooled connections dead): fixed engine reconnects, pid 80 → 40. The defect is reproduced and the fix is demonstrated deterministically, not inferred from a flag.

Ledger addition: supplemental QA 688,568 (26 tools, 11.3 min) → **cycle #34 total ≈ 2.15M**, still under the 3.5M target. Lesson: a BLOCKED row honestly recorded is a debt with a due date — it was paid within the same session at the cost of one extra QA pass, and it bought the strongest evidence of the cycle (the control-vs-fixed contrast). **Post-merge hygiene for the owner/orchestrator:** `AGENTS.md` still says backend `49 passed` (three places) — becomes 51 once #74 lands on `main`; update then, not before (the count must match `main`).

### Addendum — merged by the owner; #66 CLOSED; prod promotion proposed (not yet dispatched)

- **PR #74 merged by the owner 2026-10-26 17:57:05Z** → merge `63dd895` → `Closes #66` fired: **#66 CLOSED (COMPLETED)** 17:57:06Z. CI on `63dd895` success; **CD dev success** ([run 40373487064](https://github.com/lucapug/clown-circus-reloaded/actions/runs/40373487064)) → dev now serves the fix: image `20261026-175748-63dd895`, digest `sha256:add94ba493b83dce733e2727196042698fcf1db362dede1f77f775312d2a893e`; dev `/health` → `{"status":"ok"}` (200, 0.26 s).
- Docs aligned on `main` (`90db5a4`): backend suite `49 → 51` in `AGENTS.md` (three places) and `README.md` § Testing. `docs/self-assessment.md` deliberately left at its submission-time numbers — it describes v1.0.0.
- **Prod promotion PROPOSED per `.agents/skills/prod-promotion` (steps 1–2 done by the orchestrator; step 4 is the owner's dispatch — the enforcement point):**
  `gh workflow run cd-promote.yml --ref main -f tag=20261026-175748-63dd895 -f expected_digest=sha256:add94ba493b83dce733e2727196042698fcf1db362dede1f77f775312d2a893e`
  Rollback line (current prod image, from promotion run 40303348895): `-f tag=20261026-094842-88d7593 -f expected_digest=sha256:50c1e679814db5dc38542f3dc2a670f622ced7b8935146a41246316bc43271c0`.
- **Near-miss worth recording:** right after merging, the owner set out to run the two-game acceptance test on **prod** — where the fix is NOT yet deployed (nothing auto-deploys prod, by design). "Merged" ≠ "in prod" on this pipeline; the acceptance test on prod is meaningful only after the promotion run settles (~3 min). The same test on **dev** is valid immediately and validates the exact image that will be promoted (digest identity).

### Addendum — dev acceptance PASS (owner); prod promoted (run 40385200984, digest matched)

- **Dev acceptance, owner's real play (2026-10-26 evening):** two games on dev with a > 5-min gap — **PASS**: the post-idle save went through directly, no "saved locally" message (the pre-fix symptom). Dev served `20261026-175748-63dd895` for the test (CD dev `health ok (attempt 1)` after the deploy of `63dd895`). During the test the orchestrator touched no dev DB endpoint, so the Neon idle window was real.
- **First dispatch attempt failed client-side** (`gh: error connecting to api.github.com`) — a connectivity blip on the owner's terminal; verified by `gh run list --workflow=cd-promote.yml` that **no run had been created** (latest still the 09:55Z v1.0.0 promotion) before advising a retry — the check that prevents a double promotion. Also observed: prod `/health` answered in **42.6 s** right before (the service had been asleep while the owner played on dev — the known free-tier cold start, 43 s measured, unrelated to #66).
- **Prod promotion, owner-dispatched (the enforcement point):** [run 40385200984](https://github.com/lucapug/clown-circus-reloaded/actions/runs/40385200984), success, 19:16:07Z → 19:17:21Z. Primary-source lines: `resolved digest of 20261026-175748-63dd895: sha256:add94ba493b83dce733e2727196042698fcf1db362dede1f77f775312d2a893e`; step `expected_digest gate (before ANY Render call)` at 19:16:12Z, ahead of the Render PATCH/deploy; `health ok (attempt 1)` at 19:17:18Z. Direct check afterwards: prod `/health` → `{"status":"ok"}`, 200 in 0.24 s. **Prod now serves the #66 fix** — the same digest validated on dev.
- Previous prod image, for rollback if ever needed: `20261026-094842-88d7593` / `sha256:50c1e679814db5dc38542f3dc2a670f622ced7b8935146a41246316bc43271c0` (= v1.0.0).
- **Next:** the owner's two-game acceptance on prod (skill step 7); on PASS, tag `v1.0.1` on `63dd895` (the commit the promoted image was built from) and publish the release notes.

### Addendum — prod acceptance PASS (owner); v1.0.1 tagged; the improvement window's first fix is DONE end to end

- **Prod acceptance, owner's real play:** two score registrations on prod more than 5 minutes apart — **PASS**: the second save landed directly (no "saved locally" message, no reload needed). Evidence class per `qa.md`: gameplay acceptance = the owner's real play; no recorder artifact exists for deployed bundles (DEV-gated), the owner's report plus the dev PASS and the automated chain (unit → integration vs Postgres → real-pool control-vs-fixed proof) are the record.
- **`v1.0.1`** → `63dd895` (the commit the promoted image was built from; `main`'s later commits are docs/diary), annotated tag pushed; [GitHub Release](https://github.com/lucapug/clown-circus-reloaded/releases/tag/v1.0.1) with the fix, the verification chain, what stays open (#57, the free-tier cold start), and the rollback line. Same principle as v1.0.0: the tag names the artifact that runs in prod.
- **Hygiene:** 21 merged local branches deleted (`git branch -d`, refuses anything unmerged — nothing lost; remote branches untouched, the owner's GitHub-side call). `ops/grafana-diagnose` kept (unmerged scratch branch; its lessons are extracted in #66's consolidated-findings comment — delete or keep is the owner's call). `_docs/backlog.md` regenerated: snapshot 2026-10-26, M0–M7 complete, post-submission subgraph (#66 ✅, #57 ⏳), ✅ marks on the closed issues verified against the tracker.
- **The whole #66 arc in one line:** found on drill day (Oct 23) → diagnosed by reproduction (Oct 23–26) → declared honestly at submission (README, self-assessment, release notes) → fixed through the full graph loop the day of submission → validated on dev and prod by the owner → `v1.0.1`. Course connection, briefly: the fix went through PM → engineer → independent QA + reviewer exactly as for feature work (KB 07's two-readers rule, `_docs/process.md` §8) — the process did not shrink for a one-line change, and the one-line change got the strongest evidence of any cycle because of it.
- **Lesson of the evening:** three "near-misses" were caught by *checking state before acting*, not by rules — the prod test before promotion (merged ≠ deployed), the retry of a dispatch whose failure was client-side (verify no run exists first), and the 42.6 s `/health` that looked like a defect but was the sleeping free tier. Verify-then-act is the same lesson as verify-then-write.

**State at end of session:** prod = dev = `v1.0.1` (`20261026-175748-63dd895`); open issues: #69 (peer reviews, from Oct 27), #57 (needs a local-dev recorder trace). Nothing in flight.

### Addendum — SUBMISSION UPDATED before the deadline (resubmission alignment)

**Decision (owner):** the platform submission was updated the same evening to the repository tip, with hours of margin. **The resubmission pin is the commit carrying this entry** (the tip of `main` at 2026-10-26 ~21:0xZ; CI green on it — the run link is in this commit's checks). Rationale: the flip-day pin `88d7593` carried a stale backlog map (snapshot Oct 24, "M6/M7 groomed" while the project was submitted) and pre-fix test counts — a reviewer browsing the repo would have seen the map a milestone behind the truth; the tip instead carries the complete, consistent state including the whole #66 arc (found → honest deferral → full-graph fix → digest-gated promotion → owner acceptance on prod) and the two releases.

**What changed vs the flip-day pin (all docs-only except #66's PR #74, already reviewed and merged):** `docs/self-assessment.md` — criterion 6 count 49 → **51**, #66 moved from "open defect, deferred" to "fixed post-submission" in the candor section, dated **Post-submission addendum** section added, pin sentence updated; `README.md` — the stale M7 TODO comment removed (the flip it referred to is done). The flip-day state remains tagged `v1.0.0` and its release notes carry the resubmission note; `v1.0.1` remains the tag of the image prod serves (`20261026-175748-63dd895`, whose code is identical to the tip — docs-only commits above it).

**Lesson:** "the tracker is the truth" (D2) extends to the submission: the form's SHA must point at the most truthful state, and any post-flip doc drift is found only by re-reading the repo *as a reviewer would* — the backlog map's staleness was exactly that kind of find.

**Submission updated on the platform: 2026-10-26 ~20:55Z** — the form now carries the resubmission pin `dca16c9` (the addendum above); CI and CD dev green on it. Same-evening external corroboration: on the course Slack, colleagues independently described the same resumability pattern this repo has run since cycle #1 and stress-tested during the Oct 24–25 provider degradation (progress in pushed work files; work interruptible and resumable by another agent/provider; next steps self-explanatory in files; orchestrator status made durable). The diary lesson "handoff risk scales inversely with documentation" now has third-party agreement.

### Addendum — owner acceptance on dev; v1.0.2 in PROD: the boarding endgame is shipped

- **Owner feel-check on dev: "pienamente soddisfatto"** — the cycle's deferred DoD row 8, recorded as the closing comment on [PR #75](https://github.com/lucapug/clown-circus-reloaded/pull/75) (QA's BLOCKED caveat discharged; per `qa.md`, gameplay acceptance = the owner's real play). **#75 merged 11:56:53Z** (`bd2656c`) → `Closes #57`: **#57 CLOSED (COMPLETED)**. CI + CD dev green on the merge ([run 40500038247](https://github.com/lucapug/clown-circus-reloaded/actions/runs/40500038247), image `20261027-115738-bd2656c`).
- **Prod promotion, owner-dispatched:** [run 40504248934](https://github.com/lucapug/clown-circus-reloaded/actions/runs/40504248934), success (12:30:11Z → ~12:31:2xZ). Primary-source lines: `RESOLVED_DIGEST` = `EXPECTED_DIGEST` = `sha256:0a76de4ea00a59696980f5cb58aadabc144fad96e7d0a8bb29954133e1976db0` at 12:30:16Z (before any Render call); `health ok (attempt 1)` at 12:31:21Z. Direct check: prod `/health` → `{"status":"ok"}`, 200 in 0.23 s. Rollback line (v1.0.1): `20261026-175748-63dd895` / `sha256:add94ba49…893e`.
- **`v1.0.2`** → `bd2656c` (the promoted commit), annotated tag pushed; [GitHub Release](https://github.com/lucapug/clown-circus-reloaded/releases/tag/v1.0.2) with the three-symptoms-one-root-cause story, the evidence chain (red-first reproduction, zero-divergence byte-gate, owner acceptance), and the rollback line. README § Future work updated: the WONT-v1 top three (#66, #57, skating) are now shipped (v1.0.1 + v1.0.2).
- **The release line now reads:** v1.0.0 = the submission · v1.0.1 = #66 (ops fix) · v1.0.2 = #57 (gameplay fix, first deliberate parity deviation). Both post-submission fixes went through the full graph with human merges and digest-gated promotions — the improvement window has a repeatable shape.
- **Open:** #69 (peer reviews, assignments still pending); the review `[minor]` (test-2 loop hardening, tied to any future `BOARD_REST_VY` retune); `DRILL_PROBE_5XX` env hygiene on dev (Render dashboard, owner); `ops/grafana-diagnose` keep-or-delete. Nothing in flight.
