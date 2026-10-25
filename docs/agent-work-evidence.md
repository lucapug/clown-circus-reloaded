# Agent Work Evidence — how to read this task tracker

This repository's development is executed by a **graph loop of AI agent roles** (PM → engineer → QA + reviewer, orchestrated by a main ZCode session, with the human owner merging). This page helps a reviewer verify that the GitHub tracker was genuinely used by the agents, as required by the project rubric's *Product Specification* criterion.

## Attribution constraint (disclosed)

All GitHub content — comments and commits — is posted through the **single owner account (`lucapug` / `Luca Pugliese`)**: no bot or secondary account exists. Attribution of agent roles is therefore **structural, not account-based**:

1. **Role files before behavior.** Each role's charter, boundaries, and exact comment/verdict formats are versioned in `.agents/agents/{pm,engineer,qa,reviewer}.md` and were committed *before* the comments following them (e.g. `503e725` on 2026-10-16 precedes all cycle-#3 verdicts).
2. **Causal chains with timestamps and SHAs.** Each cycle shows: PM brief on the issue → PR referencing the issue (`Closes #n`) → independent QA verdict → reviewer verdict → (if changes requested) fix commits cited verbatim in the approving verdict → re-verification. The ordering and cross-references are checkable by any reader.
3. **Role-consistent behavior.** QA never modified code; the engineer never commented on issues (PR body is its only channel); the orchestrator's notes are labeled. Absences are verifiable.
4. **Explicit headers (from 2026-10-17).** Every agent comment starts with a visible header: `[ROLE · role file <name>.md@<sha> · posted-by lucapug, content authored by the <role> agent]`. Commits carry a Git trailer `Assisted-by: ZCode-<role>` (filterable via `git log --grep`).
5. **Same-day diary.** `_docs/diary.md` records every cycle (per-pass tokens, verdicts, incidents) and is committed to git the same day.

## Verification index (issues closed before the header convention)

| Artifact | Role | Evidence (permalink / SHA) | Note |
|---|---|---|---|
| Issue #1 — PM implementation brief | PM | [comment](https://github.com/lucapug/clown-circus-reloaded/issues/1#issuecomment-6193837761) · 2026-10-15 13:57Z | Format matches later-committed `pm.md`; self-contained brief with DoD |
| PR #12 — QA VERDICT: PASS | QA | [comment](https://github.com/lucapug/clown-circus-reloaded/pull/12#issuecomment-6195420311) · 15:11Z | Full independent re-run of every DoD check (evidence table in comment) |
| PR #12 — REVIEW: REQUEST_CHANGES | Reviewer | [comment](https://github.com/lucapug/clown-circus-reloaded/pull/12#issuecomment-6195700193) · 15:24Z | 1 [minor]: template README residue |
| Commit `c15e847` | Engineer (rework) | `git show c15e847` · 15:2xZ | Removes exactly `frontend/README.md` |
| PR #12 — REVIEW: APPROVE | Reviewer | [comment](https://github.com/lucapug/clown-circus-reloaded/pull/12#issuecomment-6195846575) · 15:31Z | Cites `c15e847` as resolving its own finding |
| Issue #3 — PM implementation brief | PM | [comment](https://github.com/lucapug/clown-circus-reloaded/issues/3#issuecomment-6217903967) · 2026-10-16 14:39Z | Includes owner-facing open question, resolved by orchestrator |
| Issue #4 — orchestrator note | Orchestrator | [comment](https://github.com/lucapug/clown-circus-reloaded/issues/4#issuecomment-6194530724) · 2026-10-15 | Records a finding routed to a future PM brief |
| PR #13 — QA VERDICT: PASS | QA | [comment](https://github.com/lucapug/clown-circus-reloaded/pull/13#issuecomment-6218302675) · 15:00Z | 8/8 DoD checks + guardrails, re-run independently |
| PR #13 — REVIEW: REQUEST_CHANGES | Reviewer | [comment](https://github.com/lucapug/clown-circus-reloaded/pull/13#issuecomment-6218409910) · 15:06Z | 2 [minor] (unpinned uv tag; untested env path) |
| Commits `f0fbae9`, `4e6f5bc` | Mini-agent (rework) | `git show <sha>` · 17:10Z | Pin `uv:0.9.30`; add `database_from_env` tests |
| PR #13 — REVIEW: APPROVE | Reviewer | [comment](https://github.com/lucapug/clown-circus-reloaded/pull/13#issuecomment-6218569316) · 15:14Z | Verifies both SHAs; independence rule stated |
| PR #13 — QA VERDICT (rework): PASS | QA | [comment](https://github.com/lucapug/clown-circus-reloaded/pull/13#issuecomment-6218601332) · 15:16Z | Image rebuilt and re-verified after the pin |

Cycle #1 (2026-10-15) predates the role files; its formats match the process documented in the diary entry of the same day (and later codified in `503e725`). Workflow definition: `_docs/plan.md` §2 (D3), `_docs/graph-tuning.md`, `_docs/process.md` §8 (upon approval). Per-cycle metrics: `_docs/graph-tuning.md` §6.

## Representative causal chains (cycles #22–#31, issues #41/#52/#58/#59)

Each chain reads: **trigger → what was done → verifiable artifact (perma-linked PR/run + SHA) → same-day diary cross-ref.** These are the later-milestone counterparts of the pre-convention index above; every claim links its primary source.

### #41 — the mock→real switch (cycle #22, 2026-10-21)

- **Trigger:** the last M3 issue: live §8 offline-queue verification against the real backend — the frontend's mock leaderboard service replaced by the real HTTP one.
- **What was done:** a vitest integration file (jsdom, unmocked `storage.ts`, real fetch, env-gated skip) including a lost-response fault proxy (`node:net`); compose proof that the built bundle bakes in the HTTP service; the mock-vs-live dev recipe in `AGENTS.md`/README. The first engineer pass was killed by the inactivity timeout mid-cycle; a **fresh engineer resumed from the tree** (work lives in files, not agent memory) and opened the PR.
- **The chain:** the engineer's smoke (`npx tsc --noEmit` at the root tsconfig `"files": []`) was **vacuous** — it checked nothing while `@types/node` was missing, so `tsc -b`/`npm run build`/Docker build/CI failed → QA: FAIL (no separate FAIL comment exists — QA posted ONE verdict comment and amended it after the rework; the FAIL is attested by [the diary, cycle #22](https://github.com/lucapug/clown-circus-reloaded/blob/main/_docs/diary.md#2026-10-21--cycle-22-issue-41-pr-44)) → mini-agent trial #6 fix `867b736` → QA re-verified on the **real** build gate → PASS → the standing fix landed in the role file itself: `b0d2df9` (engineer.md now prescribes the real build gate).
- **Artifact:** [PR #44](https://github.com/lucapug/clown-circus-reloaded/pull/44) (merge `529df6b`); rework `867b736`; role-file fix `b0d2df9`; [QA: PASS after rework](https://github.com/lucapug/clown-circus-reloaded/pull/44#issuecomment-6316024396); [REVIEW: APPROVE](https://github.com/lucapug/clown-circus-reloaded/pull/44#issuecomment-6315948407) — the split verdict (reviewer normative pass, QA mechanical fail) working as designed.
- **Diary:** `_docs/diary.md`, section "2026-10-21 — Cycle #22 (issue #41, PR #44)".

### #52 — the error-visibility rework (cycle #25, 2026-10-22)

- **Trigger:** the first configured run of the Render environment path failed twice over: Render `PATCH` returned 400 (`envVars` is not a `servicePATCH` field), **and** the script had swallowed the error body (`curl -fsS … >/dev/null`) — a failure invisible by construction.
- **What was done:** switched to the separate bulk env-vars endpoint with a dynamically fetched `ownerId` (`GET /v1/owners`), and established the **error-visibility convention**: pipeline failures print response bodies verbatim; the swallowed-body anti-pattern is now banned in `ops/dev-deploy-runbook.md`. The reviewer's truthfulness [minor] was fixed by a mini-agent rework pass (260k tokens, diary ledger).
- **Artifact:** [PR #53](https://github.com/lucapug/clown-circus-reloaded/pull/53) (merge `84d7ba4`).
- **Reused with effect:** in cycle #29 the convention printed the Cloudflare error body verbatim on the first dashboard apply ([run 39955442024](https://github.com/lucapug/clown-circus-reloaded/actions/runs/39955442024)) — one run, one look, root cause obvious (see #58 below).
- **Diary:** `_docs/diary.md`, section "2026-10-22 — Cycles #24–#25 and the first configured runs".

### #58 — dashboards-as-code (cycle #29, 2026-10-23)

- **Trigger:** the observability criterion's concrete artifact: Grafana Cloud dashboards provisioned as committed code, not clicked together in a UI.
- **What was done:** `ops/grafana/` (the `ccr-journey` dashboard grouped by `deployment_environment_name`, and the `ccr-env-version` deploy dashboard) applied by `ops/grafana-apply.sh` (offline `validate` with 17 checks; `apply` idempotent by fixed UID), dispatched via a workflow; the three external constants parameterized as stated-not-invented comments.
- **The chain:** first real apply [run 39955442024](https://github.com/lucapug/clown-circus-reloaded/actions/runs/39955442024) → HTTP 530 (Cloudflare 1016, origin DNS error) — the #52 convention printed the body verbatim and the one-character root cause fell out immediately: the stack slug was `pinkmagpie3108`, not `pinkmaggie3108`. `GRAFANA_URL` corrected → re-dispatch → both dashboards applied ([run 39955716405](https://github.com/lucapug/clown-circus-reloaded/actions/runs/39955716405), HTTP 200).
- **Artifact:** [PR #61](https://github.com/lucapug/clown-circus-reloaded/pull/61) (merge `6f92303`); [QA: PASS](https://github.com/lucapug/clown-circus-reloaded/pull/61#issuecomment-6362348294) (mutations bite); [REVIEW: APPROVE](https://github.com/lucapug/clown-circus-reloaded/pull/61#issuecomment-6362148907).
- **Diary:** `_docs/diary.md`, section "2026-10-23 — Cycle #29 (issue #58, PR #61)".

### #59 — alert fire+clear (cycle #30, 2026-10-23)

- **Trigger:** the alerting criterion: a 5xx alert provisioned as code **and proven to fire and to clear** on the live dev deployment.
- **What was done:** `ops/grafana/alert-rule.json` (5xx rate > 0 per `deployment_environment_name`, `for: 2m`) + `apply-alert` in `grafana-apply.sh` (contact point, notification policy, idempotency by uid) + an env-gated `GET /__probe/5xx` probe (`# PROBE #59`, default 404, 2 tests) as the firing-proof vehicle. The probe was removed by PR #63 before the #60 drill so dev would carry exactly one drill gate.
- **Artifact:** [PR #62](https://github.com/lucapug/clown-circus-reloaded/pull/62) (merge `4af84f6`); [QA: PASS](https://github.com/lucapug/clown-circus-reloaded/pull/62#issuecomment-6366117230); [REVIEW: APPROVE](https://github.com/lucapug/clown-circus-reloaded/pull/62#issuecomment-6365920756); the live **fire-and-clear evidence comment** [on issue #59](https://github.com/lucapug/clown-circus-reloaded/issues/59#issuecomment-6367952810): Pending → **Firing** during a sustained 5xx burst on dev (notification email received; History tab records the event), → **Normal** autonomously once the rate window drained.
- **Diary:** `_docs/diary.md`, section "2026-10-23 — Cycle #30 (issue #59, PR #62)".

## The #60 on-call drill — reconstructable timeline (2026-10-23, DRILL)

A DRILL, not a real incident: the defect was an env-gated `# DRILL #60` gate injected by [PR #63](https://github.com/lucapug/clown-circus-reloaded/pull/63) (injection commit `09d3be2`) and activated on dev only. Recorded so a reader can reconstruct the arc from first alert to recovery ([01] p.9); timestamps UTC as recorded in the same-day diary section "2026-10-23 — Cycle #31 (issue #60, PR #63–#65)" and the [M5 drill record](https://github.com/lucapug/clown-circus-reloaded/issues/60#issuecomment-6369976023).

| # | Step (2026-10-23, UTC) | Verifiable record |
|---|---|---|
| 1 | **Inject (drill setup)** — PR #63 merged 15:44Z; owner set `DRILL_DEFECT_SCORES_500=1` on the dev service ~15:50Z | [PR #63](https://github.com/lucapug/clown-circus-reloaded/pull/63), injection commit `09d3be2`, merge `7eabd8a` |
| 2 | **Fire** — orchestrated burst of 140 × 500 on valid `POST /scores`, 18:03–18:08Z → alert `ccr-5xx-user-impact` **Firing**; notification email received by the owner; Grafana Alerting UI red (owner screenshot) | alert rule from [PR #62](https://github.com/lucapug/clown-circus-reloaded/pull/62); [M5 drill record](https://github.com/lucapug/clown-circus-reloaded/issues/60#issuecomment-6369976023) |
| 3 | **Page** — 18:08Z, on-call subagent spawned with the **alert text only** (no issue link, no drill design, no env-var name); post carries the ad-hoc attribution header quoted below | prompt-symmetry attested by the orchestrator in the drill record |
| 4 | **Diagnose** — root cause in ~8 min: `git log` → marker grep → the gate in `backend/app/routes_leaderboard.py`; env activation inferred deductively (CI-green code + live 500s = the service env carries the gate); impact characterized (valid payloads 500, invalid 422, zero data loss — the raise precedes every write) | [diagnosis comment](https://github.com/lucapug/clown-circus-reloaded/issues/60#issuecomment-6369437863) |
| 5 | **Smallest fix** — gate removal (+ unused import + 3 drill-only tests), 49 backend tests green; plus the docs-only runbook remediation entry | [PR #64](https://github.com/lucapug/clown-circus-reloaded/pull/64), commit `0e916a8`; [PR #65](https://github.com/lucapug/clown-circus-reloaded/pull/65) |
| 6 | **Human review + merge** — the owner reviewed and merged both PRs (merge commits `20c55c2`, `4e43707`); the on-call agent does not merge | `git show 20c55c2 4e43707` |
| 7 | **CD redeploy + clear** — auto-CD deployed the gate-free image → 5xx rate → 0 → alert → **Normal** (Grafana UI History); owner also removed the drill env (hygiene) | recorded in the [M5 drill record](https://github.com/lucapug/clown-circus-reloaded/issues/60#issuecomment-6369976023) |
| 8 | **Runbook updated** — drill-remediation entry in `ops/dev-deploy-runbook.md` (via PR #65); the companion **rollback drill** (three digest-gated `cd-promote` dispatches: promote `4e43707` → **rollback** to `20c55c2` → re-promote, runs [39987934565](https://github.com/lucapug/clown-circus-reloaded/actions/runs/39987934565) / [39988252897](https://github.com/lucapug/clown-circus-reloaded/actions/runs/39988252897) / [39988948328](https://github.com/lucapug/clown-circus-reloaded/actions/runs/39988948328)) recorded in the runbook by [PR #67](https://github.com/lucapug/clown-circus-reloaded/pull/67) (merge `7870896`) | `ops/dev-deploy-runbook.md`, section "Rollback drill record (issue #60, 2026-10-23) — DRILL artifact" |

**Ad-hoc ON-CALL attribution header (verbatim, as it appears on the on-call artifacts):**

```
**[ON-CALL · ad-hoc drill role, issue #60 · posted-by lucapug, content authored by the on-call agent]**
```

**Bounded access ([06] p.16):** the on-call agent received only the alert text plus standard tooling — a repo checkout, `gh`, and `curl` against dev. It had **no** issue link, **no** drill design, **no** env-var name, and **no merge rights**: the human review + merge (step 6) was the enforcement point, the drill's analogue of escalating to a human on-call.

**False-positive consideration ([06] p.17):** one transient `GET /leaderboard` 500 during the probe window — a free-tier restart one-off — was correctly triaged as NOT the defect (stable 200 on re-probe) and no code was changed for it; the triage is recorded in the diagnosis comment.

**Drill-vs-real labelling:** the injection/fix PRs carry the `drill` label; the runbook's rollback record states explicitly: *"This sequence is a DRILL, not a real incident — the real prod incident found the same day is issue #66"* (a first-write transient 500 on prod, tracked separately). The drill's known limitation is recorded, not hidden: the `# DRILL #60` marker made root-cause **confirmation** instant — the marker-free parts of the arc (valid-vs-invalid discrimination, persistence checks, cold-start triage, fix scoping) were the genuine on-call work.
