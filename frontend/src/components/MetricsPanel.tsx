import { useEffect, useMemo, useRef } from "react";
import { drawMetricChart } from "../chart";
import type { MetricSeriesPoint, Regression } from "../types";

export function MetricChart({ series }: { series: MetricSeriesPoint[] }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const max = useMemo(() => {
    const values = series.flatMap((point) => [point.controlP95, point.treatmentP95].filter(Boolean) as number[]);
    return Math.max(...values) * 1.15;
  }, [series]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (ctx) drawMetricChart(ctx, series, max);
  }, [max, series]);

  return (
    <div className="chart-wrap">
      <canvas ref={canvasRef} width="980" height="300" />
    </div>
  );
}

export function RegressionReasons({ regression, hasLiveMetrics }: { regression: Regression; hasLiveMetrics: boolean }) {
  if (!hasLiveMetrics) {
    return (
      <div className="reasons">
        <div className="reason neutral">Chart starts with historical seed data. Run <code>npm run traffic -- 100</code> to add live target-app metrics.</div>
      </div>
    );
  }

  const reasons = regression.reasons.length
    ? regression.reasons
    : ["No regression detected in the latest metric window."];

  return (
    <div className="reasons">
      {reasons.map((reason) => <div className="reason" key={reason}>{reason}</div>)}
    </div>
  );
}
