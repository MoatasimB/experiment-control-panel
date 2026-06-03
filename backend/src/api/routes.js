import express from "express";
import { assignUser } from "../services/bucketing.js";
import { detectRegression } from "../services/regression.js";
import { summarizeMetrics } from "../services/metrics.js";
import { rollbackIncident, updateRollout } from "../services/rollout.js";
import { analyzeIncidentWithAi } from "../services/aiIncidentAnalysis.js";
import { updateIncidentFromLiveMetrics } from "../services/incidentDetection.js";
import {
  handleValidationError,
  validateActorBody,
  validateAssignmentBody,
  validateExperimentIdQuery,
  validateMetricEventBody,
  validateRolloutBody
} from "./validation.js";

export function createApiRouter(store) {
  const router = express.Router();

  router.get("/demo", asyncHandler(async (_req, res) => {
    const experiment = await store.getExperiment("ranking-v2");
    const regression = detectRegression(await store.metricsFor(experiment.id));

    res.json({
      experiment,
      metrics: regression.summary,
      regression,
      incidents: await store.listIncidents(),
      trace: await store.getTrace("trc-8f4a"),
      audit: await store.listAuditEvents()
    });
  }));

  router.get("/experiments", asyncHandler(async (_req, res) => {
    res.json(await store.listExperiments());
  }));

  router.get("/experiments/:id", asyncHandler(async (req, res) => {
    const experiment = await store.getExperiment(req.params.id);
    if (!experiment) {
      res.status(404).json({ error: "Experiment not found" });
      return;
    }
    res.json(experiment);
  }));

  router.patch("/experiments/:id/rollout", asyncHandler(async (req, res) => {
    const body = validateRolloutBody(req.body);
    const experiment = await updateRollout(store, req.params.id, body.rolloutPercentage, body.actor);
    if (!experiment) {
      res.status(404).json({ error: "Experiment not found" });
      return;
    }
    res.json(experiment);
  }));

  router.post("/assignments", asyncHandler(async (req, res) => {
    const body = validateAssignmentBody(req.body);
    const experiment = await store.getExperiment(body.experimentId);
    if (!experiment) {
      res.status(404).json({ error: "Experiment not found" });
      return;
    }

    res.json(assignUser({
      experimentId: body.experimentId,
      userId: body.userId,
      rolloutPercentage: experiment.rolloutPercentage
    }));
  }));

  router.post("/metrics/events", asyncHandler(async (req, res) => {
    const body = validateMetricEventBody(req.body);
    const event = await store.addMetricEvent(body);
    const incident = await updateIncidentFromLiveMetrics(store, body.experimentId);
    res.status(201).json({ event, incident });
  }));

  router.get("/metrics/summary", asyncHandler(async (req, res) => {
    const query = validateExperimentIdQuery(req.query);
    res.json(summarizeMetrics(await store.metricsFor(query.experimentId)));
  }));

  router.get("/incidents", asyncHandler(async (_req, res) => {
    res.json(await store.listIncidents());
  }));

  router.post("/incidents/:id/rollback", asyncHandler(async (req, res) => {
    const body = validateActorBody(req.body);
    const result = await rollbackIncident(store, req.params.id, body.actor);
    if (!result) {
      res.status(404).json({ error: "Incident not found" });
      return;
    }
    res.json(result);
  }));

  router.post("/incidents/:id/ai-analysis", asyncHandler(async (req, res) => {
    const result = await analyzeIncidentWithAi(store, req.params.id);
    if (!result) {
      res.status(404).json({ error: "Incident not found" });
      return;
    }
    res.json(result);
  }));

  router.get("/audit", asyncHandler(async (_req, res) => {
    res.json(await store.listAuditEvents());
  }));

  router.get("/traces/:traceId", asyncHandler(async (req, res) => {
    const trace = await store.getTrace(req.params.traceId);
    if (!trace) {
      res.status(404).json({ error: "Trace not found" });
      return;
    }
    res.json(trace);
  }));

  router.use((_req, res) => {
    res.status(404).json({ error: "Route not found" });
  });

  return router;
}

function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch((error) => {
      if (handleValidationError(error, res)) return;
      next(error);
    });
  };
}
