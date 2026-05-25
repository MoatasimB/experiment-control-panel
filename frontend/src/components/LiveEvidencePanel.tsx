import { formatMs } from "../utils/format";

export function LiveEvidencePanel({
  unhealthy,
  hasLiveMetrics,
  hasComparableLiveMetrics,
  controlP95,
  treatmentP95,
  latestWindow,
  rolloutPercentage
}: {
  unhealthy: boolean;
  hasLiveMetrics: boolean;
  hasComparableLiveMetrics: boolean;
  controlP95?: number;
  treatmentP95?: number;
  latestWindow?: string;
  rolloutPercentage: number;
}) {
  return (
    <article className="panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Live target app signal</p>
          <h3>{hasLiveMetrics ? `Latest live window: ${latestWindow}` : "Waiting for target-app traffic"}</h3>
        </div>
        <span className={`pill ${unhealthy ? "danger" : ""}`}>
          {hasComparableLiveMetrics ? unhealthy ? "Unhealthy" : "Healthy" : hasLiveMetrics ? "Current only" : "No live data"}
        </span>
      </div>
      <div className="live-signal">
        <div>
          <span>Current version p95</span>
          <strong>{formatMs(controlP95)}</strong>
        </div>
        <div>
          <span>Experimental version p95</span>
          <strong>{formatMs(treatmentP95)}</strong>
        </div>
      </div>
      <p className="muted">
        {hasComparableLiveMetrics
          ? "This card is based on metric events emitted by the target app."
          : hasLiveMetrics && rolloutPercentage === 0
            ? "Rollback is active, so new target-app traffic updates only the current version."
            : hasLiveMetrics
              ? "Live data exists, but experimental traffic has not arrived for the latest live window yet."
              : <>Run <code>npm run traffic -- 100</code>, then watch this card and the chart update.</>}
      </p>
    </article>
  );
}
