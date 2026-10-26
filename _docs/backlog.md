# Backlog Map — Issue Dependency Graph

**Purpose:** read-only visualization of the groomed backlog's dependency DAG. The canonical task state lives in **GitHub Issues** (plan decision D2); this map is an index, not a second backlog. Regenerate it whenever issues are added, split, or re-linked.

**Snapshot date:** 2026-10-26 (evening) — **M0–M7 COMPLETE; project SUBMITTED** (pin `88d7593` = tag `v1.0.0`). Post-submission improvement window open: **#66 closed** via PR #74 (cycle #34) and promoted to prod as **`v1.0.1`** (`63dd895`); open by choice: #69 (3 peer reviews pending), #57 (awaiting a local recorder trace).

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
        I45["#45 Integration suite in Compose, single-command tests ✅ merged"]
        I46["#46 Playwright E2E happy path (hooks) ✅ merged"]
        I47["#47 GHCR immutable tags + CD deploy-on-green dev (C2) ✅ merged"]
        I48["#48 Prod service + manual promotion + health monitor (C2) ✅ merged"]
    end

    subgraph M5["M5 — Ops completion (Oct 23–24): dashboards, alert, on-call drill"]
        I58["#58 Grafana dashboards-as-code (journey + env/version) ✅ merged"]
        I59["#59 Alert on user impact (5xx), proven to fire ✅ merged"]
        I60["#60 On-call drill tier 1 + rollback drill ✅ closed (PR #67)"]
    end

    subgraph M6["M6 — Docs/demo (Oct 24–26): README, agent-work evidence, pack, demo artifacts"]
        I68["#68 README completed state + evidence/pack docs + demo artifacts ✅ closed (PRs #70, #71, #73)"]
    end

    subgraph M7["M7 — Submission (Oct 25–26): self-assessment, flip, submit, peer review"]
        I69["#69 Self-assessment + final promotion + D11 flip + submission ⏳ submitted; 3 peer reviews pending"]
    end

    subgraph POST["Post-submission — improvement window (Oct 26 →)"]
        I66["#66 Transient first-request-after-idle 500 → pool pre-ping ✅ closed (PR #74, cycle #34, prod = v1.0.1)"]
        I57["#57 Board clown strands at vx≈0 ⏳ awaiting local recorder trace; fix-vs-v2 call"]
    end

    I37["#37 CI-red fix: streak AC-3 × lever-only ✅ merged (PR #38)"]

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

    I48 --> I58
    I58 --> I59
    I59 --> I60
    I60 --> I68
    I68 --> I69

    I40 --> I66
    I48 -.-> I66
    I6 -.-> I57
    I30 -.-> I57
```

**Critical path (longest chain):** #1 → … → #48 → #58 → #59 → #60 → #68 → #69 — **fully executed**: M5 complete Oct 24 (#60 via PR #67), M6 complete Oct 26 (#68 via PRs #70/#71/#73), M7 submitted Oct 26 (self-assessment PR #72, digest-gated final promotion, D11 public flip, platform submission; pin `88d7593` = `v1.0.0`). #69 stays open until the owner's 3 mandatory peer reviews are done (assignments expected from Oct 27).

**Post-submission window:** #66 (the real prod incident found on drill day) was fixed through the full graph loop (cycle #34: PM brief → engineer PR #74 → independent QA + reviewer → supplemental QA with a real-pool proof), merged by the owner, validated on dev by real play, promoted to prod (run 40385200984, digest-gated) and accepted on prod by real play; tagged `v1.0.1` on `63dd895`. #57 depends on a recorder trace that can only be captured in a local `npm run dev` session (the recorder is DEV-gated and absent from deployed bundles); the fix-vs-v2 decision follows the trace. Dotted edges: #66 surfaced through the prod service of #48 and lands in the #40 DB layer; #57 lives in the #6 physics core and is evidenced through the #30 recorder.

**Parallelism available (M4):** #45, #46 and #47 are mutually independent once #41 is merged; #48 waits for #47. Owner-side platform steps for #47/#48 (Render API key/deploy hook, prod Neon database, prod service) can start before the agent cycles.

**Parallelism available:** after #1 landed, #3 and #4 are independent; #2 follows #3 (Docker-build job). After #9 lands, #10 and #11 are independent. These are the natural candidates for the worktree/parallelism experiments (deferred by default, plan §6 WONT v1).
