import { THRESHOLDS } from "../models/domain.js";
import { summarizeMetrics } from "./metrics.js";

export function detectRegression(metricWindows, thresholds = THRESHOLDS) {
  const summary = summarizeMetrics(metricWindows);
  if (!summary.deltas) {
    return { unhealthy: false, reasons: [], summary };
  }

  const reasons = [];
  if (summary.deltas.p95Percent >= thresholds.p95IncreasePercent) {
    reasons.push(`p95 latency increased ${summary.deltas.p95Percent}% vs control`);
  }
  if (summary.deltas.errorRatePoints >= thresholds.errorRateIncreasePoints) {
    reasons.push(`error rate increased ${summary.deltas.errorRatePoints} points vs control`);
  }
  if (summary.deltas.conversionPercent <= -thresholds.conversionDropPercent) {
    reasons.push(`conversion dropped ${Math.abs(summary.deltas.conversionPercent)}% vs control`);
  }

  return {
    unhealthy: reasons.length > 0,
    reasons,
    summary
  };
}
