import { healthBadge, healthHeading } from "../liveMetrics";
import { formatDelta, formatMs } from "../utils/format";

export function HealthPanel({
  unhealthy,
  controlP95,
  treatmentP95,
  errorDelta,
  latestWindow,
  hasLiveMetrics,
  hasComparableLiveMetrics,
  rolloutPercentage
}: {
  unhealthy: boolean;
  controlP95?: number;
  treatmentP95?: number;
  errorDelta?: number;
  latestWindow?: string;
  hasLiveMetrics: boolean;
  hasComparableLiveMetrics: boolean;
  rolloutPercentage: number;
}) {
  const state = { hasLiveMetrics, hasComparableLiveMetrics, unhealthy, rolloutPercentage };

  return (
    <article className="panel health-panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Health check</p>
          <h3>{healthHeading(state)}</h3>
        </div>
        <span className={`pill ${unhealthy ? "danger" : ""}`}>{healthBadge(state)}</span>
      </div>
      <div className="comparison">
        <div>
          <span>Current version p95</span>
          <strong>{formatMs(controlP95)}</strong>
        </div>
        <div>
          <span>Experimental version p95</span>
          <strong>{formatMs(treatmentP95)}</strong>
        </div>
        <div>
          <span>Error delta</span>
          <strong>{errorDelta === undefined ? "--" : formatDelta(errorDelta)}</strong>
        </div>
      </div>
      <p className="muted">
        {hasComparableLiveMetrics
          ? `Latest live target-app window: ${latestWindow}`
          : hasLiveMetrics && rolloutPercentage === 0
            ? "Rollback is active. New traffic updates the current version only; experimental data stays blank until rollout is increased."
            : hasLiveMetrics
              ? "Live current-version traffic arrived. Waiting for experimental traffic in the same window."
              : "Run npm run traffic -- 100 to generate live target-app metrics."}
      </p>
    </article>
  );
}
