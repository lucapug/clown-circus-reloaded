# Graph Loop Tuning — Analysis and Proposal after Cycle #1

**Status:** Proposal — awaiting owner approval. No tuning change has been implemented yet.
**Date:** 2026-10-15.
**Evidence base:** the first-cycle diary entry (issue #1, PR #12), the PR #12 comment thread (PM brief, QA verdict, two reviewer verdicts), harness-reported subagent usage, and a live `ListModels` check (2026-10-15).
**Constraints honored:** independent QA/reviewer verdicts preserved; lifecycle unchanged (engineer never closes, QA never fixes, orchestrator closes only after PASS, human merges); product scope and approved spec untouched.
**Labels:** **[C]** = confirmed finding (measured/observed), **[H]** = hypothesis (to be tested next cycle).

---

## 1. Measured baseline (cycle #1, issue #1, ~306 hand-written lines)

| Pass | Tokens | Tool uses | Duration | Outcome |
|---|---|---|---|---|
| PM brief | 278,240 | 12 | ~19 min | brief posted on #1 |
| Engineer attempt 1 | *unmeasured* | — | 10 min stall | killed (interactive prompt); zero side effects |
| Engineer attempt 2 (escalation) | 683,584 | 23 | ~13 min | version analysis + OTel finding; zero code |
| Engineer implementation | 3,151,203 | 56 | ~21 min | PR #12, 4 commits, full §3 evidence |
| Engineer rework (1-file delete + PR body edit) | 520,003 | 5 | ~4.5 min | `c15e847` |
| QA (independent full re-run) | 1,499,404 | 58 | ~22 min | VERDICT: PASS |
| Reviewer | 320,609 | 16 | ~10 min | REQUEST_CHANGES (1 minor) |
| Reviewer close-out | 216,010 | 6 | ~2 min | APPROVE |
| **Total (measurable)** | **≈ 6.67M** | 176 | ~100 min agent time | + unmeasured main-session cost |

## 2. Findings by area

### A1 Role definitions **[C]**
Cycle-1 prompts were authored ad hoc by the orchestrator; ~70% of each prompt was repeated boilerplate (role charter, strict rules, anti-hang rules, output formats), re-authored per pass with drift risk. Two stall modes and one unbounded research pass trace directly to inconsistent prompt content. The course prescribes discoverable role files (`.agents/agents/<NAME>.md`, Module 5 — *Alexey On Data — Coding Agent Building Blocks: Reusable Skills and Specialized Subagents*, KB 04) and the rubric's extension pack explicitly wants a subagent artifact — role files serve both.

### A2 Context efficiency **[C]**
Each role was told to read AGENTS.md + plan §2/§5/§6 + spec §5/§7 + the issue — but the PM brief is *by design* self-contained ("an engineer who has never spoken to you could implement it from the issue", KB 02). We paid to load the same authoritative content twice (once into the brief, again into every role). Handoff artifacts (PR body, verdict comments) are already single-home.

### A3 QA/reviewer separation **[C duplication]**
Engineer and QA both executed the full 15-check §3 battery. The reviewer stayed diff-only (correct). The duplication is engineer-side: the engineer needs *smoke confidence*, not authoritative verification — QA owns that, independently, and is preserved untouched.

### A4 Model selection **[C constraint, H options]**
Confirmed: `GLM-5.3-Flash` exists in the plan (levels low/high/max), but the Agent tool exposes **no per-call model parameter** — only `subagent_type` — and the read-only `Explore` type maps to an unavailable model (incident 3). So per-role model assignment is *not currently reachable* through the Agent tool. The dynamic-workflows system (`CreateWorkflow`) does expose `subagent_model` — a migration path, not a mid-M1 move.

### A5 Orchestration reliability **[C]**
Three incidents, all with standing fixes that worked in later passes: anti-hang rules (no recurrence after adoption); execute-only-after-ratification (adopted); unavailable subagent type (fallback used once, undocumented as policy). Missing: an *early-stop escalation protocol* — the 684k research pass was valuable (OTel finding) but unbounded; a research cap would have cost a fraction.

### A6 Dependency accuracy **[C — reconciled in this change]**
Issue #2's CI includes a Docker-build job requiring #3's Dockerfile (verified in the issue body). Reconciled: issue #2 now depends on #3; `_docs/backlog.md` edge and parallelism notes updated. No orchestration change.

### A7 Resume-cost pattern **[C]**
Resuming an agent reloads its full conversation: 520k tokens to delete one file; 216k to verify one commit. Surgical, well-specified fixes don't need the author's whole context.

## 3. Proposals (prioritized)

### P1 — apply from the next cycle (#3), pending approval

| # | Change | Evidence | Expected benefit | Trade-off | Verification |
|---|---|---|---|---|---|
| P1.1 | **Role files** `.agents/agents/{pm,engineer,qa,reviewer}.md`: charters, strict rules, anti-hang rules, escalation protocol, comment/verdict formats, return format. Cycle prompts shrink to: repo path, issue/PR numbers, branch, cycle-specific deltas. | A1 | consistent enforcement; smaller orchestrator authoring (main-session savings); extension-pack artifact | one more versioned artifact — role-file version recorded per cycle in the diary | next-cycle ledger + zero rule-drift incidents |
| P1.2 | **Context diet:** the PM brief is authoritative and self-contained; engineer/QA load the brief + role file only (not plan/spec wholesale); reviewer adds only the targeted conformance sections. Orchestrator resumes reference artifacts, never re-paste them. | A2 | fewer large reads per subagent | brief quality becomes load-bearing (it already is, by design) | per-role token delta vs baseline |
| P1.3 | **Engineer smoke-only:** engineer runs fast smoke (backend pytest, frontend build, one curl each) and states what was run; the **full §3 battery is QA's alone** (unchanged, independent). PR body carries the change description + smoke results + pointers, not the full evidence mass. | A3 | engineer-pass reduction (hypothesis: 20–40%) | less runtime evidence in the PR body; mitigated by linking QA's verdict as the evidence of record | engineer-pass tokens; verdict integrity checklist (§4) |
| P1.4 | **Mini-agent for surgical rework/close-out:** fresh, minimal agent (finding + exact fix + verify + comment instructions) instead of resuming the full engineer context — for [minor]/mechanical findings only; [major]/[blocker] findings still resume the engineer. | A7 | rework cost from ~520k to an expected ≤150k per loop | loses author context on fixes; acceptable because the reviewer re-verifies regardless | rework/close-out pass tokens |
| P1.5 | **Escalation protocol in role files:** if a decision blocks implementation, stop early (research cap ≈ 10 tool uses), return a concise options question; never convert a blocked cycle into an unbounded analysis pass. | A5 | blocked cycles cost ~1/5 of attempt 2 | less serendipitous research (the OTel finding came from it); the cap still permits bounded lookups, and deliberate research can be commissioned separately | any future escalation's token count |
| P1.6 | **Standing reliability clauses in role files:** anti-hang rules (engineer, QA); explicit fallback policy for read-only roles (try `Explore`; on model-not-found, `general-purpose` + instruction-level wall, noted in the cycle record). | A5 | no repeat of incidents 1/3 as silent surprises | instruction-level walls remain weaker than structural ones — recorded as a harness limitation until P3 | incident count per cycle |

### P2 — optional experiments (measure before adopting)

- **QA artifact reuse:** QA may reuse existing `node_modules`/`.venv` when the branch is unchanged since the engineer's run, instead of reinstalling from scratch. Benefit: QA-pass reduction; trade-off: weaker "fresh environment" claim — flagged in the verdict comment whenever used.
- **Evidence verbosity caps:** cap pasted command output in comments/PR bodies to the decisive lines. Benefit: token + readability; trade-off: harder external audit of full outputs (mitigation: full logs storable as PR check artifacts once CI exists, #2).

### P3 — later, by design (not this milestone)

- **Workflow-based model assignment [H]:** migrate the loop to a dynamic workflow to unlock `subagent_model` — Flash for QA/reviewer/close-out, strongest model for PM/engineer. Aligns with the course's loop engineering and the M6 extension pack, but introduces a new execution model under deadline; pilot on one routine issue in M5, compared by ledger.
- **Off-peak cycles:** the idle-plan models exist; usable for genuinely deferred work only (out of critical path).

## 4. Measurement plan for the next cycle (#3, Docker/Compose)

Record in the diary, side by side with the baseline: per-pass tokens, tool uses, duration; total; passes lost to stalls (target 0); escalation tokens if any; rework tokens if any. Normalized measures (tokens per hand-written line, per tool use) reported too, since #3's scope differs from #1's. **Targets (for a comparable-complexity issue):** total ≤ 3.5M subagent tokens, engineer pass ≤ 2M, zero stalls. **Verdict-integrity checklist (must all hold — these are the non-negotiables):** QA performed the full independent DoD re-run; reviewer performed an independent diff-only review without reading QA's verdict first; any FAIL edge routed to the engineer (or mini-agent per P1.4) and never fixed by QA/orchestrator; human merged.

## 5. Approval checklist (owner)

1. P1.1–P1.6 as the next-cycle package? (individual items may be vetoed)
2. P2 experiments enabled or deferred?
3. P3 direction acknowledged (no action now)?
4. Orchestrator manages the `in-progress` label at cycle boundaries from now on (added at start, removed at merge)?
