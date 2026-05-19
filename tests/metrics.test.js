import test from "node:test";
import assert from "node:assert/strict";
import { summarizeMetrics } from "../backend/src/services/metrics.js";

test("latest metrics prefer createdAt over the text time label", () => {
  const summary = summarizeMetrics([
    {
      experimentId: "ranking-v2",
      bucket: "control",
      time: "13:00",
      p50: 80,
      p95: 220,
      errorRate: 1,
      conversion: 10,
      completion: 90,
      source: "seed",
      createdAt: "2026-05-19T02:00:00.000Z"
    },
    {
      experimentId: "ranking-v2",
      bucket: "control",
      time: "00:10",
      p50: 70,
      p95: 180,
      errorRate: 0,
      conversion: 12,
      completion: 95,
      source: "live",
      createdAt: "2026-05-19T04:10:00.000Z"
    }
  ]);

  assert.equal(summary.latest.control.time, "00:10");
  assert.equal(summary.latest.control.source, "live");
});
