# Experiment Reliability Control Plane

A full-stack internal engineering tool for managing staged rollouts, A/B experiments, reliability regressions, traces, incidents, and rollback workflows.

This project is intentionally scoped around one polished demo story: a ranking experiment moves from 10% to 50%, treatment latency and error rate spike, the detector opens an incident, traces reveal a downstream dependency issue, and rollback recovers the system.

The project is stronger than a generic dashboard because it demonstrates:

- deterministic user bucketing and rollout control
- metrics ingestion, aggregation, and baseline comparison
- automated regression detection
- trace-driven debugging
- incident timeline and rollback workflow
- auditability around production changes

## Run Locally

Install dependencies:

```bash
npm install
```

For API + built frontend:

```bash
npm run build
npm run dev
```

Then open:

```text
http://localhost:4173
```

For active React development, run two terminals:

```bash
npm run dev:api
npm run dev:web
```

Then open:

```text
http://localhost:5173
```

The Vite frontend proxies `/api` requests to the Node backend on port `4173`.

## Test

```bash
npm test
```

Tests cover deterministic bucketing, regression detection, and rollback behavior.

## Local Postgres

Start the local Postgres database:

```bash
npm run db:up
```

Connection string:

```text
postgresql://rcp_user:rcp_password@localhost:5432/rcp_dev
```

For backend integration, copy `.env.example` to `.env` and keep the same `DATABASE_URL` unless you change the database credentials.

Open a SQL shell:

```bash
npm run db:psql
```

Reset all local database data:

```bash
npm run db:reset
```

The schema and seed data live in:

```text
backend/db/schema.sql
backend/db/seed.sql
```

You can connect pgAdmin to the same database using:

```text
Host: localhost
Port: 5432
Database: rcp_dev
Username: rcp_user
Password: rcp_password
```

## Architecture

```text
frontend/
  src/
    App.tsx       React control-plane UI
    api.ts        typed API client
    types.ts      frontend domain types
    styles.css    dashboard/control-plane styling
backend/
  db/
    schema.sql    Postgres schema
    seed.sql      local database seed data
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
