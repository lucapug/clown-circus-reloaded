# ops/

Operational documentation: [dev-deploy-runbook.md](./dev-deploy-runbook.md) — how the Render + Neon dev deployment is set up and verified. [test-integration.sh](./test-integration.sh) (+ [docker-compose.test.yml](./docker-compose.test.yml)) is the integration battery — run it via `npm run test:integration` from the repo root (AGENTS.md "Testing").

[grafana/](./grafana/README.md) — Grafana Cloud dashboards-as-code (issue #58): the journey + env/version dashboards and their idempotent apply pipeline (`ops/grafana-apply.sh`, `gh workflow run grafana-apply.yml`).
