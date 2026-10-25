---
name: prod-promotion
description: Promote the exact dev-validated image to prod, or roll prod back to the previous tag, via the digest-gated cd-promote dispatch. Use when asked to "promote to prod" or "roll back prod". Every dispatch requires explicit human approval.
---

# Prod promotion (digest-gated)

Distilled from `ops/dev-deploy-runbook.md` — the runbook is the primary
source; read it (section "Prod promotion (#48)", anchor
`#prod-promotion-48`) if anything here is unclear. The invariant:
**promotion identity = digest** — a tag alone is never enough (GHCR tags
are mutable). Dev: `https://clown-circus-reloaded.onrender.com`; prod:
`https://clown-circus-reloaded-prod.onrender.com`.

## Steps

1. **Verify dev health**: `curl -fsS https://clown-circus-reloaded.onrender.com/health`
   → exact body `{"status":"ok"}`.
2. **Collect tag + full digest** from the latest dev `CD dev` run summary
   (jobs "GHCR push" / "CD dev deploy" — the `Image:` and `Digest:` lines).
3. **Get explicit human approval** for the dispatch (see Enforcement
   point below).
4. **Dispatch**:
   ```sh
   gh workflow run cd-promote.yml --ref main \
     -f tag=<YYYYMMDD-HHMMSS-<shortsha>> \
     -f expected_digest=<sha256:…>
   ```
5. **Watch the run** to completion. The workflow resolves the requested
   tag's digest from GHCR before touching Render: a missing tag or a
   `expected_digest` mismatch fails the run before any Render call.
6. **Verify prod health**: `curl -fsS https://clown-circus-reloaded-prod.onrender.com/health`
   → exact body `{"status":"ok"}`.
7. **Functional verify** (the two-session test): play on prod → game over
   → submit → the new entry visible on the leaderboard.
8. **Rollback** = the same dispatch with the PREVIOUS tag + its full
   digest (runbook anchor `#rollback--re-promote-the-previous-tag`;
   previous tags: past dev `CD dev` run summaries), then repeat steps
   6–7. Steady-state promotions settle in ~3 min.

## Labelling rule (drill vs real)

Any drill or practice run MUST be labelled DRILL in whatever PR or record
cites it, with a cross-reference separating it from real incidents — see
the runbook's "Rollback drill record (issue #60, 2026-10-23) — DRILL
artifact" (anchor
`#rollback-drill-record-issue-60-2026-10-23--drill-artifact`). Never
present a drill as an incident response, and never fold a real incident
into a drill record (the real prod incident found on drill day is #66).

## Enforcement point (human approval)

The agent prepares steps 1–2 and PROPOSES the dispatch; the human owner
approves and performs step 4. The agent never dispatches a prod promotion
autonomously: prod deploys ONLY by explicit manual dispatch — nothing
auto-deploys prod, ever (`ops/dev-deploy-runbook.md`, "Prod promotion
(#48)").
