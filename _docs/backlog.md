# Backlog Map — Issue Dependency Graph

**Purpose:** read-only visualization of the groomed backlog's dependency DAG. The canonical task state lives in **GitHub Issues** (plan decision D2); this map is an index, not a second backlog. Regenerate it whenever issues are added, split, or re-linked.

**Snapshot date:** 2026-10-21 — M2 fully closed (6/6 MUSTs + #19/#20/#24/#27/#30/#33/#35), M3 groomed (#39–#41). M4–M7 issues are added as their milestones enter grooming.

```mermaid
graph TD
    subgraph M1["M1 — Walking skeleton + early pipeline (Oct 16–17)"]
        I1["#1 Scaffold monorepo ✅ merged"]
    I2["#2 CI on PRs ✅ merged"]
        I3["#3 Dockerfile + Compose ✅ merged"]
    I4["#4 OTel instrumentation (active) ✅ merged"]
    I5["#5 Dev deploy Render + Neon ✅ merged"]
    end

    subgraph M2["M2 — Game core + frontend-first (Oct 18–20)"]
        I6["#6 Deterministic core: ticks, RNG, physics ✅ merged"]
        I7["#7 Scoring module + lives/levels ✅ merged"]
        I8["#8 Progression + bonusJumps (2026 dec. A) ✅ merged"]
        I9["#9 Canvas shell, HUD, screens ✅ merged"]
    I30["#30 Session recorder ✅ merged"]
    I33["#33 Recorder download fix ✅ merged"]
        I10["#10 Services + mocks + offline queue ✅ merged"]
        I11["#11 Synthesized audio ✅ merged"]
        I19["#19 Free-side unification ✅ merged"]
        I20["#20 Entry-height randomization (level 4, 50/50) ✅ merged"]
        I24["#24 Jump earning v2: 25-launch streak ✅ merged"]
        I27["#27 Lives floor at 0 ✅ merged"]
    I35["#35 Lever-only launch ✅ merged"]
    end

    subgraph M3["M3 — Contract + backend (Oct 21–22)"]
        I39["#39 OpenAPI contract (openapi.yaml) ✅ merged"]
        I40["#40 Backend: FastAPI + SQLAlchemy + idempotent /scores + API tests (TDD) ✅ merged"]
        I41["#41 Switch services to real backend (compose + live §8) ✅ merged"]
    end

    I37["#37 CI-red fix: streak AC-3 × lever-only (PR #38 merge-ready)"]

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
    I8 --> I19
    I19 -.-> I20
    I11 -.-> I20
    I7 -.-> I24
    I9 --> I30
    I30 --> I33
    I24 -.-> I27
    I35 -.-> I27

    I10 --> I39
    I39 --> I40
    I40 --> I41
```

**Critical path (longest chain):** #1 → #6 → #7 → #8 → #9 → #10 → #39 → #40 → #41 — M2's tail completed ahead of C1 (Oct 21, PASSED: see diary); M3 runs Oct 21–22 toward C2 (Oct 23 EOD, CD gate). #37's PR awaits the owner's merge (independent of M3's DAG).

**Parallelism available:** after #1 landed, #3 and #4 are independent; #2 follows #3 (Docker-build job). After #9 lands, #10 and #11 are independent. These are the natural candidates for the worktree/parallelism experiments (deferred by default, plan §6 WONT v1).
