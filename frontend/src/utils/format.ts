export function formatStatus(status: string) {
  return status.replace("_", " ");
}

export function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

export function formatClock(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit"
  }).format(value);
}

export function formatMs(value?: number) {
  if (value === undefined) return "--";
  return `${Math.round(value)}ms`;
}

export function formatDelta(value: number) {
  return `${value >= 0 ? "+" : ""}${Math.round(value * 10) / 10}`;
}

export function formatRecommendation(value: string) {
  return value.replace("_", " ");
}
