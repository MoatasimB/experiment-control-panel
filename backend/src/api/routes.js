import { readFile } from "node:fs/promises";
import path from "node:path";
import { assignUser } from "../services/bucketing.js";
import { detectRegression } from "../services/regression.js";
import { summarizeMetrics } from "../services/metrics.js";
import { rollbackIncident, updateRollout } from "../services/rollout.js";

export function createRouter(store, publicDir) {
  return async function route(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);

    try {
      if (url.pathname.startsWith("/api/")) {
        await routeApi(req, res, url, store);
        return;
      }

      const filePath = url.pathname === "/"
        ? path.join(publicDir, "index.html")
        : path.join(publicDir, url.pathname);
      await serveStatic(res, filePath, publicDir);
    } catch (error) {
      sendJson(res, 500, { error: error.message });
    }
  };
}

async function routeApi(req, res, url, store) {
  if (req.method === "GET" && url.pathname === "/api/demo") {
    const experiment = await store.getExperiment("ranking-v2");
    const regression = detectRegression(await store.metricsFor(experiment.id));
    sendJson(res, 200, {
      experiment,
      metrics: regression.summary,
      regression,
      incidents: await store.listIncidents(),
      trace: await store.getTrace("trc-8f4a"),
      audit: await store.listAuditEvents()
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/experiments") {
    sendJson(res, 200, await store.listExperiments());
    return;
  }

  const experimentMatch = url.pathname.match(/^\/api\/experiments\/([^/]+)$/);
  if (req.method === "GET" && experimentMatch) {
    const experiment = await store.getExperiment(experimentMatch[1]);
    sendJson(res, experiment ? 200 : 404, experiment || { error: "Experiment not found" });
    return;
  }

  const rolloutMatch = url.pathname.match(/^\/api\/experiments\/([^/]+)\/rollout$/);
  if (req.method === "PATCH" && rolloutMatch) {
    const body = await readJson(req);
    const experiment = await updateRollout(store, rolloutMatch[1], body.rolloutPercentage, body.actor);
    sendJson(res, experiment ? 200 : 404, experiment || { error: "Experiment not found" });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/assignments") {
    const body = await readJson(req);
    const experiment = await store.getExperiment(body.experimentId);
    if (!experiment) {
      sendJson(res, 404, { error: "Experiment not found" });
      return;
    }
    sendJson(res, 200, assignUser({
      experimentId: body.experimentId,
      userId: body.userId,
      rolloutPercentage: experiment.rolloutPercentage
    }));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/metrics/events") {
    const body = await readJson(req);
    sendJson(res, 201, await store.addMetricEvent(body));
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/metrics/summary") {
    const experimentId = url.searchParams.get("experiment_id");
    sendJson(res, 200, summarizeMetrics(await store.metricsFor(experimentId)));
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/incidents") {
    sendJson(res, 200, await store.listIncidents());
    return;
  }

  const rollbackMatch = url.pathname.match(/^\/api\/incidents\/([^/]+)\/rollback$/);
  if (req.method === "POST" && rollbackMatch) {
    const body = await readJson(req);
    const result = await rollbackIncident(store, rollbackMatch[1], body.actor);
    sendJson(res, result ? 200 : 404, result || { error: "Incident not found" });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/audit") {
    sendJson(res, 200, await store.listAuditEvents());
    return;
  }

  const traceMatch = url.pathname.match(/^\/api\/traces\/([^/]+)$/);
  if (req.method === "GET" && traceMatch) {
    const trace = await store.getTrace(traceMatch[1]);
    sendJson(res, trace ? 200 : 404, trace || { error: "Trace not found" });
    return;
  }

  sendJson(res, 404, { error: "Route not found" });
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "content-type": "application/json",
    "access-control-allow-origin": "*"
  });
  res.end(JSON.stringify(payload));
}

async function serveStatic(res, filePath, publicDir) {
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(path.resolve(publicDir))) {
    sendJson(res, 403, { error: "Forbidden" });
    return;
  }

  let content;
  try {
    content = await readFile(resolved);
  } catch {
    sendJson(res, 404, { error: "File not found" });
    return;
  }
  const ext = path.extname(resolved);
  const types = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8"
  };
  res.writeHead(200, { "content-type": types[ext] || "application/octet-stream" });
  res.end(content);
}
