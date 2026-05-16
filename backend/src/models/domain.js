export const STATUS = Object.freeze({
  HEALTHY: "healthy",
  DEGRADED: "degraded",
  PAUSED: "paused",
  ROLLED_BACK: "rolled_back"
});

export const THRESHOLDS = Object.freeze({
  p95IncreasePercent: 35,
  errorRateIncreasePoints: 1.5,
  conversionDropPercent: 8
});
