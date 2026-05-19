export function summarizeMetrics(metricWindows) {
  const buckets = ["control", "treatment"];
  const latest = Object.fromEntries(
    buckets.map((bucket) => [
      bucket,
      [...metricWindows].reverse().find((window) => window.bucket === bucket) || null
    ])
  );

  const series = metricWindows.reduce((result, metric) => {
    const row = result.get(metric.time) || { time: metric.time };
    row[`${metric.bucket}P95`] = metric.p95;
    row[`${metric.bucket}Errors`] = metric.errorRate;
    row[`${metric.bucket}Conversion`] = metric.conversion;
    if (metric.source === "live") row.source = "live";
    result.set(metric.time, row);
    return result;
  }, new Map());

  return {
    latest,
    deltas: latest.control && latest.treatment ? calculateDeltas(latest.control, latest.treatment) : null,
    series: [...series.values()].sort((a, b) => a.time.localeCompare(b.time))
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
