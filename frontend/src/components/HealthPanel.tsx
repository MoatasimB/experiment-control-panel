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
          <span>Old version p95</span>
          <strong>{formatMs(controlP95)}</strong>
        </div>
        <div>
          <span>New version p95</span>
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
            ? "Rollout is 0%, so generated traffic is control-only. Raise rollout to compare treatment again."
            : hasLiveMetrics
              ? "Live control traffic arrived. Waiting for treatment traffic in the same window."
              : "Run npm run traffic -- 100 to generate live target-app metrics."}
      </p>
    </article>
  );
}
