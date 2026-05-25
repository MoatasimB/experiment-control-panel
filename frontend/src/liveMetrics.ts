import type { MetricSeriesPoint } from "./types";

export function getLiveMetrics(series: MetricSeriesPoint[]) {
  const liveSeries = series.filter((point) => point.source === "live");
  const latestLivePoint = liveSeries.at(-1);
  const latestComparablePoint = liveSeries
    .filter((point) => point.controlP95 !== undefined && point.treatmentP95 !== undefined)
    .at(-1);
  const hasComparableLiveMetrics = Boolean(
    latestLivePoint
      && latestComparablePoint
      && latestLivePoint.time === latestComparablePoint.time
  );
  const displayPoint = hasComparableLiveMetrics ? latestComparablePoint : latestLivePoint;

  return {
    hasLiveMetrics: liveSeries.length > 0,
    hasComparableLiveMetrics,
    latestWindow: displayPoint?.time,
    latest: {
      control: displayPoint?.controlP95 !== undefined ? metricSnapshot(displayPoint, "control") : null,
      treatment: hasComparableLiveMetrics && displayPoint?.treatmentP95 !== undefined
        ? metricSnapshot(displayPoint, "treatment")
        : null
    }
  };
}

export function calculateDisplayDeltas(
  control: { p95: number; errorRate: number; conversion: number },
  treatment: { p95: number; errorRate: number; conversion: number }
) {
  return {
    p95Percent: percentDelta(control.p95, treatment.p95),
    errorRatePoints: round(treatment.errorRate - control.errorRate),
    conversionPercent: percentDelta(control.conversion, treatment.conversion)
  };
}

export function isUnhealthy(deltas: { p95Percent: number; errorRatePoints: number; conversionPercent: number }) {
  return deltas.p95Percent >= 35 || deltas.errorRatePoints >= 1.5 || deltas.conversionPercent <= -8;
}

export function healthHeading(state: LiveHealthState) {
  if (!state.hasLiveMetrics) return "Waiting for live traffic";
  if (!state.hasComparableLiveMetrics && state.rolloutPercentage === 0) return "Rollback is serving current version only";
  if (!state.hasComparableLiveMetrics) return "Waiting for experimental traffic";
  return state.unhealthy ? "Experimental version looks unsafe" : "Experimental version looks healthy";
}

export function healthBadge(state: LiveHealthState) {
  if (!state.hasLiveMetrics) return "No live data yet";
  if (!state.hasComparableLiveMetrics && state.rolloutPercentage === 0) return "Rolled back";
  if (!state.hasComparableLiveMetrics) return "Current only";
  return state.unhealthy ? "Rollback recommended" : "Continue rollout";
}

type LiveHealthState = {
  hasLiveMetrics: boolean;
  hasComparableLiveMetrics: boolean;
  unhealthy: boolean;
  rolloutPercentage: number;
};

function metricSnapshot(point: MetricSeriesPoint, bucket: "control" | "treatment") {
  return {
    time: point.time,
    p95: bucket === "control" ? point.controlP95 || 0 : point.treatmentP95 || 0,
    errorRate: bucket === "control" ? point.controlErrors || 0 : point.treatmentErrors || 0,
    conversion: bucket === "control" ? point.controlConversion || 0 : point.treatmentConversion || 0
  };
}

function percentDelta(baseline: number, current: number) {
  if (baseline === 0) return 0;
  return round(((current - baseline) / baseline) * 100);
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}
