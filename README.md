# Experiment Reliability Control Plane

A full-stack internal engineering tool for managing staged rollouts, A/B experiments, reliability regressions, traces, incidents, and rollback workflows.

This project is intentionally scoped around one polished demo story: a ranking experiment moves from 10% to 50%, treatment latency and error rate spike, the detector opens an incident, traces reveal a downstream dependency issue, and rollback recovers the system.

## Why This Works For A Google TM Resume

The project is stronger than a generic dashboard because it demonstrates:

- deterministic user bucketing and rollout control
- metrics ingestion, aggregation, and baseline comparison
- automated regression detection
- trace-driven debugging
- incident timeline and rollback workflow
- auditability around production changes

Resume bullet direction:

- Built a full-stack experiment and rollout control plane for staged feature launches, deterministic user assignment, reliability monitoring, and rollback workflows.
- Implemented metric aggregation and regression detection for latency, error rate, and conversion deltas across control/treatment cohorts.
- Designed an incident investigation flow linking rollout changes, alerts, traces, downstream service failures, and audit events.

## Run Locally

```bash
npm install
npm run dev
```

Then open:

```text
http://localhost:4173
```

No third-party runtime dependencies are required. The backend uses Node's built-in HTTP server and serves both the REST API and the frontend.

## Test

```bash
npm test
```

Tests cover deterministic bucketing, regression detection, and rollback behavior.

## Architecture

```text
frontend/
  src/
    app.js        single-page product UI
    styles.css    dashboard/control-plane styling
backend/
  src/
    api/          route handling
    models/       domain defaults
    repositories/ in-memory data access
    services/     bucketing, metrics, regression, rollback
    server.js     HTTP server + static hosting
  data/
    seed.json     realistic demo data
tests/
  *.test.js       service-level tests
```

The implementation is deliberately dependency-light so hiring managers can run it quickly. A production version would swap the in-memory repository for Postgres, move aggregation to workers, add authentication/authorization, and expose the frontend through React + TypeScript.

## API Surface

- `GET /api/experiments`
- `GET /api/experiments/:id`
- `PATCH /api/experiments/:id/rollout`
- `POST /api/assignments`
- `POST /api/metrics/events`
- `GET /api/metrics/summary?experiment_id=ranking-v2`
- `GET /api/incidents`
- `POST /api/incidents/:id/rollback`
- `GET /api/audit`
- `GET /api/traces/:trace_id`
- `GET /api/demo`

## Demo Flow

1. Open the dashboard and review the active `Search Ranking V2` experiment.
2. Compare control vs treatment metrics. Treatment is unhealthy after the 50% rollout.
3. Open the incident timeline and inspect the rollout change, alert, trace, and rollback recommendation.
4. Trigger rollback from the UI.
5. Confirm the rollout drops to 0%, audit events update, and incident status changes.
