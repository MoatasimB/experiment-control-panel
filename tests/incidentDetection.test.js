import test from "node:test";
import assert from "node:assert/strict";
import { Store } from "../backend/src/repositories/store.js";
import { updateIncidentFromLiveMetrics } from "../backend/src/services/incidentDetection.js";
import { rollbackIncident } from "../backend/src/services/rollout.js";

test("live unhealthy target-app metrics update the incident timeline", async () => {
  const store = new Store();

  store.addMetricEvent({
    experimentId: "ranking-v2",
    bucket: "control",
    time: "14:10",
    p50: 80,
    p95: 200,
    errorRate: 0.5,
    conversion: 10,
    completion: 90,
    source: "live"
  });
  store.addMetricEvent({
    experimentId: "ranking-v2",
    bucket: "treatment",
    time: "14:10",
    p50: 170,
    p95: 520,
    errorRate: 5,
    conversion: 7,
    completion: 70,
    source: "live"
  });

  const incident = await updateIncidentFromLiveMetrics(store, "ranking-v2");

  assert.equal(store.getExperiment("ranking-v2").status, "degraded");
  assert.equal(incident.status, "open");
  assert.equal(incident.title, "Live treatment regression detected from target-app traffic");
  assert.equal(incident.timeline.at(-1).type, "live_metric");
  assert.match(incident.summary, /Live target-app traffic is unhealthy/);
});

test("rolled back experiments do not append new live regression events", async () => {
  const store = new Store();

  store.addMetricEvent({
    experimentId: "ranking-v2",
    bucket: "control",
    time: "14:10",
    p50: 80,
    p95: 200,
    errorRate: 0.5,
    conversion: 10,
    completion: 90,
    source: "live"
  });
  store.addMetricEvent({
    experimentId: "ranking-v2",
    bucket: "treatment",
    time: "14:10",
    p50: 170,
    p95: 520,
    errorRate: 5,
    conversion: 7,
    completion: 70,
    source: "live"
  });
  await updateIncidentFromLiveMetrics(store, "ranking-v2");
  await rollbackIncident(store, "inc-1042", "test@local");

  const timelineLengthAfterRollback = store.getIncident("inc-1042").timeline.length;
  store.addMetricEvent({
    experimentId: "ranking-v2",
    bucket: "control",
    time: "14:11",
    p50: 70,
    p95: 180,
    errorRate: 0,
    conversion: 12,
    completion: 95,
    source: "live"
  });

  const result = await updateIncidentFromLiveMetrics(store, "ranking-v2");

  assert.equal(result, null);
  assert.equal(store.getIncident("inc-1042").timeline.length, timelineLengthAfterRollback);
  assert.equal(store.getExperiment("ranking-v2").rolloutPercentage, 0);
  assert.equal(store.getExperiment("ranking-v2").status, "rolled_back");
});

test("detector does not compare stale treatment data with a newer control-only window", async () => {
  const store = new Store();

  store.addMetricEvent({
    experimentId: "ranking-v2",
    bucket: "control",
    time: "14:10",
    p50: 80,
    p95: 200,
    errorRate: 0.5,
    conversion: 10,
    completion: 90,
    source: "live"
  });
  store.addMetricEvent({
    experimentId: "ranking-v2",
    bucket: "treatment",
    time: "14:10",
    p50: 170,
    p95: 520,
    errorRate: 5,
    conversion: 7,
    completion: 70,
    source: "live"
  });
  await updateIncidentFromLiveMetrics(store, "ranking-v2");

  const timelineLengthAfterLiveIncident = store.getIncident("inc-1042").timeline.length;
  store.addMetricEvent({
    experimentId: "ranking-v2",
    bucket: "control",
    time: "14:11",
    p50: 75,
    p95: 185,
    errorRate: 0,
    conversion: 12,
    completion: 95,
    source: "live"
  });

  await updateIncidentFromLiveMetrics(store, "ranking-v2");

  assert.equal(store.getIncident("inc-1042").timeline.length, timelineLengthAfterLiveIncident);
});
