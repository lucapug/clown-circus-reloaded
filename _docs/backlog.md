# Backlog Map — Issue Dependency Graph

**Purpose:** read-only visualization of the groomed backlog's dependency DAG. The canonical task state lives in **GitHub Issues** (plan decision D2); this map is an index, not a second backlog. Regenerate it whenever issues are added, split, or re-linked.

**Snapshot date:** 2026-10-15, updated after PR #12 merged (#1 ✅) and the #3 → #2 dependency reconciliation (issue #2's Docker-build job needs #3's Dockerfile). M3–M7 issues are added as their milestones enter grooming.

```mermaid
graph TD
    subgraph M1["M1 — Walking skeleton + early pipeline (Oct 16–17)"]
        I1["#1 Scaffold monorepo ✅ merged"]
    I2["#2 CI on PRs"]
    I3["#3 Dockerfile + Compose"]
    I4["#4 OTel scaffold (dormant)"]
    I5["#5 Dev deploy Render + Neon"]
    end

    subgraph M2["M2 — Game core + frontend-first (Oct 18–20)"]
        I6["#6 Deterministic core: ticks, RNG, physics"]
        I7["#7 Scoring module + lives/levels"]
        I8["#8 Progression + bonusJumps (2026 dec. A)"]
        I9["#9 Canvas shell, HUD, screens"]
        I10["#10 Services + mocks + offline queue"]
        I11["#11 Synthesized audio"]
    end

    I1 --> I3
    I1 --> I4
    I3 --> I2
    I3 --> I5

    I1 --> I6
    I6 --> I7
    I7 --> I8
    I6 --> I9
    I8 --> I9
    I9 --> I10
    I9 --> I11
```

**Critical path (longest chain):** #1 → #6 → #7 → #8 → #9 → #10 — the sequence the C1 checkpoint (Oct 21 EOD, plan §6) effectively watches; slippage here triggers the ordered cut list.

**Parallelism available:** after #1 landed, #3 and #4 are independent; #2 follows #3 (Docker-build job). After #9 lands, #10 and #11 are independent. These are the natural candidates for the worktree/parallelism experiments (deferred by default, plan §6 WONT v1).
