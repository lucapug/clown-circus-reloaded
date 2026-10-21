# Backlog Map — Issue Dependency Graph

**Purpose:** read-only visualization of the groomed backlog's dependency DAG. The canonical task state lives in **GitHub Issues** (plan decision D2); this map is an index, not a second backlog. Regenerate it whenever issues are added, split, or re-linked.

**Snapshot date:** 2026-10-21 (evening) — M2 fully closed (6/6 MUSTs + #19/#20/#24/#27/#30/#33/#35), **M3 complete 3/3** (#39/#40/#41), **M4 groomed (#45–#48)**. M5–M7 issues are added as their milestones enter grooming.

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

    subgraph M4["M4 — Integration, E2E, CD (Oct 22–23) → C2 Oct 23 EOD"]
        I45["#45 Integration suite in Compose, single-command tests"]
        I46["#46 Playwright E2E happy path (hooks)"]
        I47["#47 GHCR immutable tags + CD deploy-on-green dev (C2)"]
        I48["#48 Prod service + manual promotion + health monitor (C2)"]
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

    I41 --> I45
    I41 --> I46
    I41 --> I47
    I47 --> I48
```

**Critical path (longest chain):** #1 → #6 → #7 → #8 → #9 → #10 → #39 → #40 → #41 → **#47 → #48** — M3 closed on Oct 21 (one day early); C2 (Oct 23 EOD) watches #47 → #48 (CD green on dev + one manual promotion to prod). #45 and #46 are independent of the C2 chain and fill the parallel slots.

**Parallelism available (M4):** #45, #46 and #47 are mutually independent once #41 is merged; #48 waits for #47. Owner-side platform steps for #47/#48 (Render API key/deploy hook, prod Neon database, prod service) can start before the agent cycles.

**Parallelism available:** after #1 landed, #3 and #4 are independent; #2 follows #3 (Docker-build job). After #9 lands, #10 and #11 are independent. These are the natural candidates for the worktree/parallelism experiments (deferred by default, plan §6 WONT v1).
