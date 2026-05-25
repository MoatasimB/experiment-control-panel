import express from "express";
import { setTimeout as sleep } from "node:timers/promises";
import { createRcpClient } from "../../sdk/node/index.js";

const port = Number(process.env.TARGET_APP_PORT || 4180);
const host = process.env.HOST || "127.0.0.1";
const controlPlaneUrl = process.env.CONTROL_PLANE_URL || "http://127.0.0.1:4173";
const experimentId = process.env.EXPERIMENT_ID || "ranking-v2";
const service = process.env.SERVICE_NAME || "target-search";
const releaseSha = process.env.RELEASE_SHA || "local-ranking-v2";

const app = express();
const rcp = createRcpClient({ controlPlaneUrl, experimentId, service, releaseSha });

app.use((req, res, next) => {
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-methods", "GET,POST,OPTIONS");
  res.setHeader("access-control-allow-headers", "content-type");
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});

app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service, experimentId });
});

app.get("/search", asyncHandler(async (req, res) => {
  const userId = req.query.user_id || randomUserId();
  const query = req.query.q || "nyc pizza";

  const { assignment, result, durationMs } = await rcp.runExperiment({
    userId: String(userId),
    route: "/search",
    control: ({ traceId }) => simulateSearch({
      variant: "control",
      query: String(query),
      userId: String(userId),
      traceId
    }),
    treatment: ({ traceId }) => simulateSearch({
      variant: "treatment",
      query: String(query),
      userId: String(userId),
      traceId
    })
  });

  res.status(result.statusCode).json({
    query,
    userId,
    experimentId,
    variant: assignment.variant,
    rolloutIncluded: assignment.included,
    durationMs,
    traceId: result.traceId,
    results: result.results,
    error: result.error
  });
}));

app.post("/traffic", asyncHandler(async (req, res) => {
  const count = Math.max(1, Math.min(500, Number(req.body.count || 50)));
  const users = Array.from({ length: count }, (_value, index) => `load-user-${index + 1}`);
  const results = [];

  for (const userId of users) {
    const response = await fetch(`http://${host}:${port}/search?user_id=${encodeURIComponent(userId)}&q=ranking`);
    results.push({ userId, status: response.status });
  }

  res.json({
    generated: count,
    failures: results.filter((result) => result.status >= 500).length
  });
}));

app.use((_req, res) => {
  res.status(404).json({ error: "Route not found" });
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: error.message || "Internal server error" });
});

const server = app.listen(port, host, () => {
  console.log(`Target Search app running at http://${host}:${port}`);
  console.log(`Reporting metrics to ${controlPlaneUrl}`);
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Target app port ${port} is already in use. Set TARGET_APP_PORT to a free port.`);
    process.exit(1);
  }
  throw error;
});

async function simulateSearch({ variant, query, userId, traceId }) {
  const treatment = variant === "treatment";
  const base = treatment ? 120 : 55;
  const jitter = stableNumber(`${userId}:${query}`) % (treatment ? 260 : 80);
  const failure = treatment && (stableNumber(`${userId}:failure`) % 100) < 28;
  const durationMs = base + jitter + (failure ? 450 : 0);

  await sleep(Math.min(durationMs, 900));

  if (failure) {
    return {
      statusCode: 503,
      durationMs,
      conversion: false,
      completion: false,
      traceId,
      results: [],
      error: "feature-store timeout while scoring ranking-v2 candidates"
    };
  }

  return {
    statusCode: 200,
    durationMs,
    conversion: treatment ? durationMs < 260 : durationMs < 180,
    completion: true,
    traceId,
    results: [
      { title: "Local result", score: treatment ? 0.94 : 0.88 },
      { title: "Nearby result", score: treatment ? 0.91 : 0.84 }
    ]
  };
}

function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function randomUserId() {
  return `user-${Math.floor(Math.random() * 100000)}`;
}

function stableNumber(input) {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
