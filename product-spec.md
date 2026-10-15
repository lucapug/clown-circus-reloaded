# Product Specification — Clown Circus Reloaded

**Status:** Approved by the owner (2026-10-15). Revision 3 records the approved decisions: physics canonicalized to 60 Hz logic ticks (explicit deviation: refresh-rate normalization), `submissionId` idempotency contract including 409-on-payload-mismatch, and `bonusJumps` option A as an explicit 2026 design decision.
**Spec date:** 2026-10-15.
**Behavioral baseline:** Clown Circus Carnival (2025), cloned read-only at commit `0d365e69a66245c29b9de258e23af1a612dd99c0` (main HEAD). Evidence citations below use paths in that repository, suffixed `@0d365e6`.
**Relationship to other artifacts:** execution plan in [`_docs/plan.md`](_docs/plan.md) (agreed 2026-10-15). The machine-readable `openapi.yaml` is derived in M3 from the frontend services layer (plan D4) and then becomes the API contract of record; §7 of this spec defines its required behavior.

---

## 1. Product overview

A browser remake of the arcade games *Circus* (Exidy, 1977) and *Clowns* (Midway, 1978): a seesaw-and-balloons arcade game on an 800×600 canvas, wrapped in a full-stack web application with a shared, persistent leaderboard. Desktop-only input: mouse + click/SPACE. Audio is synthesized at runtime (Web Audio API); no audio/image assets.

**Users:** single local player per browser session; all players share one global leaderboard.

## 2. User-facing flows

### 2.1 Start screen (pre-game overlay)

- Title "CIRCUS", tagline area, "Clear row = Bonus!" hint, START button; top-3 leaderboard shown when non-empty. Starting: click START or press SPACE.
- Evidence: `frontend/src/components/game/StartScreen.tsx@0d365e6`, `CircusGame.tsx` key handler.

### 2.2 Gameplay

- Footer controls text: "Move mouse to control seesaw • Click or SPACE to launch clown" plus inspiration credit line.
- The canvas shows the balloon grid, two clowns, the seesaw, four diving boards, and floating score texts (1 s lifetime).
- HUD (above canvas): score (6-digit zero-padded), "Jumps" counter, 3 life pips.

### 2.3 Game over

- Overlay with "GAME OVER", final score (6-digit), name input (max 10 chars, trimmed, non-empty to submit), "Save Score" → submit → "Score Saved!" state; leaderboard top-10 with auto-scroll animation; "Play Again" restarts.
- Evidence: `frontend/src/components/game/GameOver.tsx@0d365e6`.

**Acceptance criteria (flows):**
- [ ] From load, the start screen is visible with START and (if the API has data) top-3 leaderboard entries.
- [ ] SPACE on the start screen starts the game; SPACE during play launches; click during play launches.
- [ ] On reaching 0 lives, the game-over overlay shows the final score and the name form; submitting a valid name refreshes the leaderboard and shows the new entry set.
- [ ] Play Again returns to a fresh level-1 game.

## 3. Game rules and mechanics (constants pinned)

All values below are defined per **logic tick**.

**[2025 evidence]** In the baseline, physics values were applied once per `requestAnimationFrame` callback — the engine contains no delta-time anywhere (`useGameEngine.ts@0d365e6`; its only time calls, `Date.now()`, feed floating-text IDs, not physics). Consequence: on displays faster than 60 Hz the 2025 game itself ran faster than intended.

**[Decision — approved by owner, 2026-10-15]** **One logic tick = exactly 1/60 s**, all §3 constants unchanged per tick, implemented with an accumulator that decouples logic rate from rendering rate. This preserves 60 Hz behavior exactly and normalizes high-refresh displays — an **explicit deviation from 2025 behavior** (2025 speed was display-dependent), recorded here as such.

**[2025 evidence — tick order, pinned for golden-tick tests]** Within one tick the engine applies, in order: (1) gravity, then position integration (semi-implicit Euler: `vy += G` before `y += vy`); (2) wall-bounce clamp; (3) diving-board bounce (falling clowns only); (4) balloon collisions, in balloon-array order; (5) level-complete check; (6) seesaw landing rules and fall-off, in clown-array order; (7) launch of the other seated clown using the velocity updated this tick; (8) game-over check and seesaw tilt. Seesaw movement and launch inputs are event-driven and take effect between ticks.

### 3.1 Playfield and entities

| Item | Value |
|---|---|
| Canvas | 800 × 600 |
| Gravity | +0.3 per tick on vy |
| Clown size | 24 (radius-ish box) |
| Balloon radius | 16 |
| Seesaw | width 120, y = 520, x follows mouse clamped to [60, 740] |
| Diving boards | 4 boards: x-sides at 40 and 760 (board rect: left x=22, right x=708, width 70, height 10), y = 250 and 350 |
| Balloon grid | 4 rows × 14; row 0 (top, y=60) **blue**, rows 1–2 (y=100/140) **green**, row 3 (bottom, y=180) **yellow**; x from 80 to 720 evenly spaced |
| Clowns | exactly 2; initial: one seated left on seesaw, one on the upper-right diving board |

### 3.2 Scoring

| Event | Points |
|---|---|
| Pop yellow balloon | 20 |
| Pop green balloon | 50 |
| Pop blue balloon | 100 |
| Clear yellow row | +200 |
| Clear green row | +500 |
| Clear blue row | +1000 |
| Bounce (land on seesaw edge) | +10 |

Row clear = all 14 balloons of that row popped (checked when any balloon pops). Floating text shows each gain; row clears show "+N ROW BONUS!" center-screen.

**[2025 evidence + 2026 requirement]** In the baseline, the tested pure module `utils/scoring.ts` was **never imported by the engine** — only by its own test file; the engine reimplemented the logic inline (`useGameEngine.ts:135–151`) with duplicated constants from `types/game.ts`. Tests could stay green while the live copy drifted. In 2026 the pure scoring module is the *only* implementation, consumed by the engine (single source of truth), and **tests must cover the live path** — asserting scoring outcomes through the core's consumption of the module (pop → row-clear → score / bonus-jump state), not only via direct calls to the standalone module.

### 3.3 `bonusJumps` — earning (2025 behavior, kept) and consumption (**2026 design decision, option A**)

- **Earning [2025 evidence]:** clearing the **blue row** (only) grants +1 bonus jump; the HUD displays the counter under the label "Jumps" (`scoring.ts:getExtraJumpsForRowClear`, `useGameEngine.ts:382`, `GameHUD.tsx`).
- **Consumption [2026 design decision — approved by owner 2026-10-15; *not* inferred 2025 intent]:** forensics found no consumption logic ever existed in the 2025 baseline (§10), so spending semantics are a new design decision. **Option A: when a death would occur and `bonusJumps > 0`, one bonus jump is consumed instead of one life.** The death sequence itself is otherwise unchanged — the clown still resets to a diving board, jump velocity still resets to −14, and the death sound/"SPLAT!" feedback still play.
- Alternatives considered and rejected: removing the stat (loses the advertised mechanic); free relaunch (changes core-loop pacing — larger design surface under deadline).

**Acceptance criteria:** [ ] A death with `bonusJumps > 0` decrements `bonusJumps`, not lives; all other death-reset rules still apply. [ ] A death with `bonusJumps = 0` decrements lives exactly as in 2025. [ ] The dead-end state (counter increments, nothing consumes it) cannot occur — guarded by tests covering the live path.

### 3.4 Clown lifecycle and physics

- **Launch input** (click or SPACE): if a clown is on a diving board, launch **that one first**: `vy = 2`, `vx = ±3 · levelMult` toward screen center. Otherwise launch the seated seesaw clown: `vy = currentJumpVelocity` (from −14, strengthening to −17 in −0.2 steps on each successful bounce; reset to −14 on any death), `vx = (rand − 0.5) · 4 · levelMult`.
- `levelMult = 1 + 0.25 · (level − 1)`.
- **In flight:** gravity applies; wall bounce reverses vx with 0.8 damping (x clamped at 24 / 776); falling onto a diving board bounces with 0.9 damping (only when vy > 0).
- **Balloon collision:** center distance < 40 (24 + 16) pops the balloon.
- **Seesaw landing** (falling clown at y ≥ 496): outer thirds of the seesaw are safe edges; middle third is death; landing on an edge already occupied by the other clown is death. Safe edge landing: +10 points, jump velocity strengthens (−0.2, clamped at −17), and the other seated clown is launched immediately.
- **Deaths** (each: lives −1, jump velocity resets to −14, "SPLAT!" text, dying clown respawns on a diving board on the free side): middle landing; occupied-edge landing; falling below y = 650.
- **Seesaw tilt:** one seated clown tilts to their side; otherwise level. Seesaw-follow moves seated clowns with it (±width/4).

### 3.5 Lives, levels, game state

- Start: 3 lives, level 1, score 0, bonusJumps 0.
- All balloons popped → "LEVEL UP!": +1 life, level +1, balloon grid regenerates.
- Lives ≤ 0 → game over (jingle plays, background music stops).
- Score submission is available only on the game-over screen.

**Acceptance criteria (rules):**
- [ ] Every constant in §3.1–3.5 is asserted by unit tests against the pure game-core modules (pinned values, not re-derived).
- [ ] A scripted, seeded scenario reproduces: pop → row-clear bonus → level-up (+1 life, new grid) → each of the three death causes (−1 life each, velocity reset) → game over at 0 lives.
- [ ] The `bonusJumps` decision (§3.3) is implemented as decided and covered by tests; the dead-end state cannot occur.

## 4. Audio (synthesized)

Pop (short square blip), bonus (ascending arpeggio C5–E5–G5–C6), death (descending 400→200 Hz), bounce (short tone), game over (Chopin Funeral March sequence), ambient background loop during play. All generated with Web Audio oscillators.
Evidence: `frontend/src/hooks/useAudio.ts@0d365e6`.

**Acceptance criteria:** [ ] Each event triggers its sound (unit-testable trigger mapping; actual timbre verified manually). [ ] No audio files in the repo.

## 5. Visuals

Dark background `hsl(240, 20%, 4%)`; balloons with white highlight dot; red-legged seesaw with gradient plank, white stripes, green end pads; colorful clowns (red shoes, gradient shirt, buttons, white eyes, skin-tone head, red nose and hair puffs); floating texts.
`frontend/src/components/game/GameCanvas.tsx@0d365e6` is the **normative visual reference** — visual parity is judged against it manually (2026 keeps test-after for rendering, plan D5).

**Acceptance criteria:** [ ] Side-by-side manual comparison against the baseline finds no substantive visual regressions. [ ] Clean scaffold: correct page title and package identity; no unused component mass (2025 defect #3, plan §3).

## 6. Testability requirements (2026 additions — binding on architecture)

1. **Pure core:** physics/collision/scoring/lives live in framework-free TypeScript modules; React/canvas code may not be imported by them.
2. **Determinism:** all gameplay randomness (launch `vx`) flows through an injectable seeded RNG; the simulation advances at the canonical fixed timestep (§3), independent of `requestAnimationFrame`; input events are queued and consumed at tick boundaries. Submission IDs and floating-text IDs are deliberately **outside** the seeded RNG — they must be unique, not reproducible.
3. **E2E hooks:** a debug interface enables Playwright to (a) fast-forward the simulation and (b) inject/read game state (e.g., force game-over), gated so it cannot ship enabled in production builds.

**Acceptance criteria:** [ ] Unit tests run the core headlessly with a seed and are reproducible. [ ] The E2E happy path completes in seconds, not minutes, using the hooks. [ ] **Golden-tick test:** a scripted input sequence with a fixed seed reproduces a recorded trajectory exactly (state-snapshot equality at chosen tick counts, including the §3 tick order). [ ] Same seed + same inputs → identical state across runs. [ ] On a 120 Hz display, gameplay speed matches the canonical 60 Hz behavior.

## 7. Leaderboard backend (behavioral contract for `openapi.yaml`, M3)

- `GET /health` → `200 {"status": "ok"}`.
- `POST /scores` body `{"name": str, "score": int}` → `201 {"id", "name", "score", "date"}`. Validation: name 1–10 chars matching `^[a-zA-Z0-9 ]+$` (trimmed by the client first); score integer ≥ 0; violations → 422.
  **[Decision — approved by owner 2026-10-15]** The body additionally carries `submissionId: str (UUIDv4, client-generated)`, persisted with a **unique constraint**, with these idempotency semantics:
  - Same `submissionId`, identical payload → inserts nothing, returns the originally stored record with `201`.
  - Same `submissionId`, different `name` or `score` → `409 Conflict`, no mutation of the stored record (a mismatch signals a client bug or ID reuse; it must never silently change data).
- `GET /leaderboard?limit=` (1–100, default 10) → `{"entries": [{"rank", "name", "score", "date"}...]}`, ordered by score descending, then `created_at` ascending.
- Serving: single container serves the built frontend with SPA fallback; `/docs` exposes generated OpenAPI. CORS: dev origins by default, configurable via env.
- Persistence: SQLite locally / Postgres (Neon) in cloud via `DATABASE_URL` (plan D6).
- Evidence: `backend/app/main.py`, `models.py`, `crud.py`@0d365e6.

**Acceptance criteria:** [ ] API test suite covers validation, ordering, tie-break, and limit bounds (2025's 22 pytest tests are the coverage baseline to match or exceed). [ ] Generated OpenAPI matches the committed `openapi.yaml` contract. [ ] Posting the same `submissionId` twice with identical payload yields exactly one persisted row, both calls returning the stored record with `201`. [ ] Posting an existing `submissionId` with a different name or score returns `409` and leaves the stored record unchanged.

## 8. Offline resilience (2025 defect #2 — the ADR-promised localStorage fallback, now specified)

1. **Leaderboard cache:** every successful `GET /leaderboard` response is cached to localStorage; on fetch failure the UI shows the cached list (or "No scores yet" if none).
2. **Pending submissions (idempotent queue):** if `POST /scores` does not produce a definitive response, the entry — with its `submissionId` — is persisted to a local pending queue and re-submitted on the next app load. **[Approved design]** Protection against the lost-response case (server persisted the row, but the client never received the 2xx) comes from the server-side idempotency key (§7): retrying the same `submissionId` cannot create a second row. Queue entries are removed on a definitive 2xx (synced) or a definitive 4xx — including `409` and `422` (dropped, surfaced in the UI); network errors and timeouts leave the entry queued for the next attempt.

**Acceptance criteria:** [ ] With the backend stopped, the start and game-over screens still render the last-known leaderboard. [ ] A score submitted offline appears on the leaderboard after the backend returns and the app reloads. [ ] Simulated lost response (server persists, client times out) followed by a reload produces **exactly one** leaderboard row for that score. [ ] A definitively rejected (422) pending entry is dropped, not retried forever.

## 9. Out of scope (first submission)

Mobile/touch input; new gameplay features beyond the §3.3 decision; performance work; multi-locale; accounts/authentication. (Deferred list in plan §6.)

## 10. Evidence index (pinned baseline `0d365e6`)

Rules and constants: `frontend/src/hooks/useGameEngine.ts`; types/points: `frontend/src/types/game.ts`; pure scoring: `frontend/src/utils/scoring.ts`; screens: `frontend/src/components/game/{CircusGame,StartScreen,GameOver,GameHUD}.tsx`; rendering: `GameCanvas.tsx`; audio: `frontend/src/hooks/useAudio.ts`; API base: `frontend/src/lib/api.ts`; backend: `backend/app/{main,models,schemas,crud,database}.py`. `bonusJumps` forensics: `git log -S bonusJumps --all` (no consumption in any commit); earning rule: `scoring.ts:getExtraJumpsForRowClear`, `useGameEngine.ts:382`; HUD label "Jumps": `GameHUD.tsx:14–21`. Fixed-timestep evidence: loop driven by `requestAnimationFrame` with no delta-time (`useGameEngine.ts:153–165,394`; `Date.now()` only for floating-text IDs). Scoring duplication: `utils/scoring.ts` imported only by `utils/scoring.test.ts`; engine row-clear logic inline at `useGameEngine.ts:135–151` with constants from `types/game.ts`.
