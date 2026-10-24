# Permissions — the per-role permission model

How the graph loop's permission boundaries work: who writes what, who
merges, and how the boundaries are enforced. The skeleton is the
orchestrator **Rules** list from the course's agent-methodology module
(*AI-Native Development: Specifications, Loop and Graph Engineering*,
`docs/course_KB/02…pdf`, pp.21–22), mirrored **verbatim**, then annotated
with this project's practice. The consolidation sources are
`_docs/process.md` §8 (Graph Loop Roles), `_docs/plan.md` §2 decision
**D3** (orchestration), and `_docs/graph-tuning.md` (the measured tuning
proposal the role system was built from).

## The KB-02 orchestrator skeleton (verbatim, [02] pp.21–22)

The rules refer to the orchestrator lifecycle defined on the same pages:

> 1. Pick the next open issue from the backlog
> 2. PM grooms it
> 3. Engineer implements it
> 4. QA verifies it
> 5. On FAIL, back to step 3 with the QA comment as input
> 6. On PASS, close the issue
> 7. Repeat until the backlog is empty

> **Rules**
>
> - Do not skip step 2
> - The engineer does not close the issue
> - QA does not fix the code, only outputs PASS or FAIL
> - The orchestrator closes the issue only after QA outputs PASS

## Rule-by-rule: our practice

**"Do not skip step 2" — matches our practice; no deviation.** Every
implementation cycle starts from a PM implementation brief posted as a
comment on a GitHub issue (`_docs/process.md` §8: "The PM brief is the
single source of truth of a cycle"). The brief must be self-contained —
"an engineer who has never spoken to you could implement it from the
issue", the standard the PM role file encodes. There is no engineer pass
without a groomed issue.

**"The engineer does not close the issue" — matches, and is tighter
here.** `.agents/agents/engineer.md` forbids the engineer from closing,
editing, or commenting on issues at all: the PR body is its only
communication channel to humans. Closing is one step further removed than
the KB rule requires.

**"QA does not fix the code, only outputs PASS or FAIL" — matches; no
deviation.** QA is read-only and posts exactly one verdict comment per PR
(`.agents/agents/qa.md`); a FAIL is reported, never repaired — it routes
back to the engineer via the orchestrator (`_docs/process.md` §8:
"neither QA nor the orchestrator fixes code").

**"The orchestrator closes the issue only after QA outputs PASS" —
matches, with one addition.** The orchestrator (main session) closes an
issue only after a QA PASS and manages the `in-progress` label at cycle
boundaries (`_docs/process.md` §8). The addition: between QA's PASS and
the close sits the **human merge** — see D3 below. This is an extension,
not a deviation: the graph itself still never merges.

## Who writes what / who merges

| Actor | May write | Must never do |
|---|---|---|
| **PM** (`.agents/agents/pm.md`) | one self-contained brief comment on the issue | implement, open PRs, merge |
| **Engineer** (`.agents/agents/engineer.md`) | code + docs on its branch, commits, the PR body (smoke results + deviations) | comment on or close issues; merge; substitute itself for QA's full battery |
| **QA** (`.agents/agents/qa.md`) | exactly one verdict comment per PR (PASS or FAIL) | edit files, commit, merge, fix anything |
| **Reviewer** (`.agents/agents/reviewer.md`) | review comments (verdict formed before reading QA's) | edit files, commit, merge |
| **Mini-agent** (ad-hoc rework, `_docs/graph-tuning.md` P1.4) | surgical [minor]/mechanical fixes + targeted verification | anything beyond the findings it was given |
| **On-call agent** (ad-hoc drill role, issue #60) | diagnosis comment + smallest-fix PRs | merge; act outside the alert-text scope it was paged with |
| **Orchestrator** (main session) | dispatches, findings routing, `in-progress` label, issue close after PASS | groom, implement, test, or fix code itself |
| **Human owner** | reviews, approves, and **merges** every PR; ratifies decisions | — |

**The human is the merge authority** (plan §2 **D3**: the human as
approver/merger) — no agent in the graph holds merge rights, in any role,
including the orchestrator.

## How the boundaries are enforced

1. **Role files, versioned before behavior.** Each role's charter,
   boundaries, verdict formats, anti-hang and escalation rules live in
   `.agents/agents/{pm,engineer,qa,reviewer}.md`, committed to git before
   the comments that follow them — structural, checkable enforcement,
   indexed in `docs/agent-work-evidence.md`.
2. **Attribution.** Every agent comment starts with the visible header
   `[ROLE · role file <name>.md@<sha> · posted-by lucapug, content authored by the <role> agent]`; role-authored commits carry the Git trailer
   `Assisted-by: ZCode-<role>` (owner-approved 2026-10-17;
   `_docs/process.md` §8).
3. **Instruction-level walls + independent verification.** The boundaries
   are enforced by role-file instructions (the harness exposes no
   per-agent permission switch — a recorded limitation until the P3
   workflow migration, `_docs/graph-tuning.md` §2/P1.6), and every claim
   is independently re-checked: QA re-runs the engineer's DoD claims, the
   reviewer re-verifies its findings' resolution, and the human verifies
   before merge.
4. **Single-account disclosure.** All GitHub content is posted through
   the owner account (`lucapug`); attribution is structural, not
   account-based — `docs/agent-work-evidence.md` is the verification
   index.

## Sources

- `docs/course_KB/02Alexey On Data - AI-Native Development_ Specifications, Loop and Graph Engineering.pdf`, pp.21–22 — orchestrator lifecycle + Rules (mirrored verbatim above).
- `_docs/process.md` §8 "Graph Loop Roles" — the standing consolidation (owner-approved).
- `_docs/plan.md` §2, decision **D3** "Orchestration: full graph, always-on".
- `_docs/graph-tuning.md` — §2 findings, §3 proposals P1.1–P1.6, §4 verdict-integrity checklist (the non-negotiables each cycle must hold).
- `.agents/agents/{pm,engineer,qa,reviewer}.md` — the authoritative role charters.
