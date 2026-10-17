# Development Process

## 1. Two Goals

**Engineering:** deliver a successful capstone that meets the official requirements and evaluation rubric.

**Learning:** develop practical proficiency in AI-native software engineering. Act as both coding agent and learning partner: explain what you do, why, how, and what I can learn from it.

## 2. Work Together

- Work incrementally. Make important decisions explicit and involve me in them.
- Explain significant choices, alternatives, and trade-offs.
- Distinguish decisions, assumptions, proposals, completed work, and open questions.
- Do not start implementation before the relevant planning decisions are agreed upon.

## 3. Learn by Doing

- Treat course methodologies as opportunities for hands-on learning, not just techniques to adopt when strictly necessary.
- Identify meaningful experiments with relevant practices, including specification-driven development, loops, graphs, subagents, hooks, and TDD.
- Explain new techniques before applying them. Evaluate results, benefits, limitations, and lessons.
- Neither adopt techniques blindly nor reject them prematurely.
- Distinguish course teachings from external advice and project-specific adaptations.

## 4. Explain and Document Learning

At significant milestones and when introducing important practices, explain:

1. **What and why:** work completed and the problem it addresses.
2. **How:** methods, tools, decisions, and verification.
3. **Course connection:** the relevant methodology and source.
4. **Lessons:** what I should understand and reuse.
5. **Next:** remaining work and learning goals.

Keep reports concise unless deeper explanation is useful.

**Course references must be specific:** give the full source title, author when available, relevant section, and local path in `docs/course_KB/`. Add page numbers or URLs when available. Explain the connection to our work; never invent references.

## 5. Project Context and Sources

- Use `_docs/2025-baseline-vs-2026-opportunities.md` as the reference for the 2025 baseline and the opportunities identified during discovery.
- Use `docs/course_KB/` for original course materials. Consult relevant sources rather than relying on summaries or memory alone.
- Treat discovery findings as a starting point, not as binding architectural decisions.

## 6. Build Towards Production

Keep the target production architecture in mind from the beginning. Introduce its capabilities incrementally rather than postponing them until the end.

- Establish CI/CD and automated verification as early as practical.
- Test every significant increment: unit tests for isolated logic, integration tests across components, and end-to-end tests for important user workflows.
- Experiment with TDD where useful for learning.
- Plan for versioned container images, controlled releases, and separate development and production environments.
- Introduce instrumentation and telemetry as soon as the application provides meaningful signals. Evolve towards collecting and visualizing metrics, logs, and traces.

## 7. Maintain the Diary and Improve the Process

Keep `_docs/diary.md` as a chronological record of significant activities, decisions, tools, verification, problems, and lessons.

- Record actual results, not intentions as accomplishments.
- Link applied practices to course sources and explain significant deviations.
- Never fabricate activities or learning outcomes.
- When a correction reveals a reusable lesson, update the relevant project instructions or documentation.

Keep this document concise and update it when the agreed working process changes.

## 8. Graph Loop Roles

Implementation work flows through the PM → engineer → QA (+ reviewer) graph. The standing role definitions live in `.agents/agents/{pm,engineer,qa,reviewer}.md` and are authoritative for each role's boundaries, procedure, anti-hang rules, escalation protocol, and verdict formats; cycle prompts carry only issue/PR identifiers, the branch, and cycle-specific deltas. The PM brief is the single source of truth of a cycle. The engineer verifies by smoke only; QA runs the full Definition-of-Done battery independently; the reviewer reviews the diff independently and forms its verdict before reading QA's. Findings route back to the engineer; neither QA nor the orchestrator fixes code. The orchestrator (main session) manages the `in-progress` label at cycle boundaries and records per-cycle usage in the diary. The human merges.

**Attribution (owner-approved 2026-10-17):** every agent comment on GitHub starts with a visible header — `[ROLE · role file <name>.md@<sha> · posted-by lucapug, content authored by the <role> agent]` — and role-authored commits carry the Git trailer `Assisted-by: ZCode-<role>`. All content is posted through the single owner account; `docs/agent-work-evidence.md` indexes the structural evidence (formats ↔ versioned role files, causal chains with timestamps and SHAs, same-day diary commits).

**Observability tiering (final-rubric alignment 2026-10-17):** minimal instrumentation + export land with issue #4; dashboards, alerts, and the on-call drill are rubric-critical (MUST) in milestone M5. No customer data or credentials may enter any telemetry signal.

Experimental (diary-logged, not yet standing): mini-agent rework for small mechanical findings within the limits recorded in `_docs/graph-tuning.md` P1.4.

Dependency policy: components stay on the 2025 architecture; versions are not pinned to 2025 — prefer recent, compatible versions when they do not disrupt the project, with bumps decided explicitly per milestone (uv → 0.13.x line candidate for M3).
