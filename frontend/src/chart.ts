import type { MetricSeriesPoint } from "./types";

export function drawMetricChart(ctx: CanvasRenderingContext2D, series: MetricSeriesPoint[], max: number) {
  const { width, height } = ctx.canvas;
  const pad = 42;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = "#dbe1e8";
  ctx.lineWidth = 1;

  for (let index = 0; index < 4; index += 1) {
    const y = pad + ((height - pad * 2) / 3) * index;
    ctx.beginPath();
    ctx.moveTo(pad, y);
    ctx.lineTo(width - pad, y);
    ctx.stroke();
  }

  drawLine(ctx, series, "controlP95", "#1c7c54", max, pad);
  drawLine(ctx, series, "treatmentP95", "#b42318", max, pad);

  ctx.fillStyle = "#617080";
  ctx.font = "13px system-ui";
  series.forEach((point, index) => {
    ctx.fillText(point.time, xAt(index, series.length, width, pad) - 14, height - 12);
  });

  drawLegend(ctx, "Control p95", "#1c7c54", 64);
  drawLegend(ctx, "Treatment p95", "#b42318", 178);
}

function drawLine(
  ctx: CanvasRenderingContext2D,
  series: MetricSeriesPoint[],
  key: "controlP95" | "treatmentP95",
  color: string,
  max: number,
  pad: number
) {
  const { width, height } = ctx.canvas;

  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  series.forEach((point, index) => {
    const value = point[key];
    if (!value) return;
    const x = xAt(index, series.length, width, pad);
    const y = height - pad - (value / max) * (height - pad * 2);
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  ctx.fillStyle = color;
  series.forEach((point, index) => {
    const value = point[key];
    if (!value) return;
    const x = xAt(index, series.length, width, pad);
    const y = height - pad - (value / max) * (height - pad * 2);
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawLegend(ctx: CanvasRenderingContext2D, label: string, color: string, x: number) {
  ctx.fillStyle = color;
  ctx.fillRect(x, 18, 14, 4);
  ctx.fillStyle = "#17202a";
  ctx.font = "13px system-ui";
  ctx.fillText(label, x + 20, 24);
}

function xAt(index: number, count: number, width: number, pad: number) {
  return pad + (index / Math.max(1, count - 1)) * (width - pad * 2);
}
