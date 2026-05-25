# Experiment Reliability Control Panel

A full-stack internal engineering tool for managing staged rollouts, A/B experiments, reliability regressions, traces, incidents, and rollback workflows.

Your team has an app, you built a new feature, and you do not want to give it to every user at once. This control panel lets you give the feature to a percentage of users, compare the new version against the old version, and roll back to the old version if the new feature causes problems.

This repo includes a small target search app so the control panel can be demoed locally. The target app simulates the project your team is deploying.

## How It Works

```text
User calls target app
  -> target app asks control plane: control or treatment?
  -> control = old feature behavior
  -> treatment = new feature behavior
  -> target app reports latency/error metrics back
  -> dashboard compares old vs new
  -> rollback sets treatment exposure to 0%
```

The important idea is that the target app does not decide rollout rules by itself. It asks the control plane for an assignment and reports what happened.

The easiest integration path is the local Node SDK in `sdk/node`. It wraps assignment lookup, control/treatment routing, request timing, error capture, and metric reporting:

```js
import { createRcpClient } from "./sdk/node/index.js";

const rcp = createRcpClient({
  controlPlaneUrl: "http://127.0.0.1:4173",
  experimentId: "ranking-v2",
  service: "target-search",
  releaseSha: "local-ranking-v2"
});

const { assignment, result } = await rcp.runExperiment({
  userId: "user-123",
  route: "/search",
  control: () => oldSearch(),
  treatment: () => newSearch()
});
```

Apps can also call the APIs directly. Direct integration requires two calls:

1. Ask for assignment before serving the feature:

```http
POST /api/assignments
```

Request body:

```json
{
  "experimentId": "ranking-v2",
  "userId": "user-123"
}
```

2. Report a metric event after serving the request:

```http
POST /api/metrics/events
```

Request body:

```json
{
  "experimentId": "ranking-v2",
  "bucket": "treatment",
  "userId": "user-123",
  "service": "target-search",
  "route": "/search",
  "statusCode": 503,
  "durationMs": 780,
  "conversion": false,
  "completion": false,
  "traceId": "trg-123",
  "releaseSha": "local-ranking-v2"
}
```

This project demonstrates:

- deterministic user bucketing and rollout control
- metrics ingestion, aggregation, and baseline comparison
- automated regression detection
- optional AI incident advisor for rollback recommendations
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

Run the local target app in a third terminal:

```bash
npm run dev:target
```

Then generate simulated search traffic via UI or:

```bash
npm run traffic -- 100
```

The target app runs at:

```text
http://127.0.0.1:4180
```

Example request:

```text
http://127.0.0.1:4180/search?user_id=user-90210&q=nyc%20pizza
```

The target app asks the control plane for a control/treatment assignment, simulates search latency and errors, then posts a metric event back to `POST /api/metrics/events`.

## Optional AI Advisor

The incident panel includes an **Analyze with AI** button. Set `OPENAI_API_KEY` in `.env` to call the OpenAI Responses API. Without a key, the app uses a local heuristic fallback so the demo still works.

```env
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5-mini
```

The advisor reviews the incident, live metrics, recent failed target-app events, trace evidence, and audit history. It returns a recommendation such as `rollback` or `continue_monitoring`; it does not automatically execute rollback.

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
postgresql://rcp_user:rcp_password@127.0.0.1:55432/rcp_dev
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
Port: 55432
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
sdk/
  node/
    index.js      Node client SDK for assignment, routing, and metrics
target-app/
  src/
    server.js     simulated app integrated through the SDK
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
- `POST /api/incidents/:id/ai-analysis`
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
