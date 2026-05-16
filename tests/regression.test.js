import test from "node:test";
import assert from "node:assert/strict";
import { detectRegression } from "../backend/src/services/regression.js";

test("detects unhealthy treatment latency and error deltas", () => {
  const result = detectRegression([
    { bucket: "control", time: "13:00", p95: 200, errorRate: 0.5, conversion: 10, completion: 90 },
    { bucket: "treatment", time: "13:00", p95: 400, errorRate: 3.0, conversion: 8, completion: 80 }
  ]);

  assert.equal(result.unhealthy, true);
  assert.equal(result.reasons.length, 3);
});

test("does not alert for small healthy deltas", () => {
  const result = detectRegression([
    { bucket: "control", time: "13:00", p95: 200, errorRate: 0.5, conversion: 10, completion: 90 },
    { bucket: "treatment", time: "13:00", p95: 220, errorRate: 0.7, conversion: 10.5, completion: 91 }
  ]);

  assert.equal(result.unhealthy, false);
});
