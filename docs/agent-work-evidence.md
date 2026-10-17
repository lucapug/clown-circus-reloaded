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
