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