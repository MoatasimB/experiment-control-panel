export function summarizeMetrics(metricWindows) {
  const buckets = ["control", "treatment"];
  const sortedWindows = [...metricWindows].sort(compareMetricWindows);
  const latest = Object.fromEntries(
    buckets.map((bucket) => [
      bucket,
      [...sortedWindows].reverse().find((window) => window.bucket === bucket) || null
    ])
  );

  const series = sortedWindows.reduce((result, metric) => {
    const row = result.get(metric.time) || { time: metric.time };
    row[`${metric.bucket}P95`] = metric.p95;
    row[`${metric.bucket}Errors`] = metric.errorRate;
    row[`${metric.bucket}Conversion`] = metric.conversion;
    if (metric.source === "live") row.source = "live";
    if (!row.createdAt || compareDateValues(row.createdAt, metric.createdAt) < 0) {
      row.createdAt = metric.createdAt;
    }
    result.set(metric.time, row);
    return result;
  }, new Map());

  return {
    latest,
    deltas: latest.control && latest.treatment ? calculateDeltas(latest.control, latest.treatment) : null,
    series: [...series.values()].sort(compareMetricWindows)
  };
}

export function calculateDeltas(control, treatment) {
  return {
    p95Percent: percentDelta(control.p95, treatment.p95),
    errorRatePoints: round(treatment.errorRate - control.errorRate),
    conversionPercent: percentDelta(control.conversion, treatment.conversion),
    completionPercent: percentDelta(control.completion, treatment.completion)
  };
}

function percentDelta(baseline, current) {
  if (baseline === 0) return 0;
  return round(((current - baseline) / baseline) * 100);
}

function round(value) {
  return Math.round(value * 10) / 10;
}

function compareMetricWindows(a, b) {
  const createdComparison = compareDateValues(a.createdAt, b.createdAt);
  if (createdComparison !== 0) return createdComparison;
  return a.time.localeCompare(b.time);
}

function compareDateValues(a, b) {
  if (!a && !b) return 0;
  if (!a) return -1;
  if (!b) return 1;
  return new Date(a).getTime() - new Date(b).getTime();
}
