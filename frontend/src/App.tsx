import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "./api";
import { drawMetricChart } from "./chart";
import { calculateDisplayDeltas, getLiveMetrics, healthBadge, healthHeading, isUnhealthy } from "./liveMetrics";
import type {
  AiAnalysis,
  Assignment,
  AuditEvent,
  DemoPayload,
  Experiment,
  Incident,
  MetricSeriesPoint,
  Trace
} from "./types";

const ACTOR = "maya@company.com";
const ACTIVE_EXPERIMENT_ID = "ranking-v2";

export function App() {
  const [demo, setDemo] = useState<DemoPayload | null>(null);
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [userId, setUserId] = useState("user-90210");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<AiAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  async function load() {
    try {
      setError(null);
      const [demoPayload, experimentList] = await Promise.all([
        api.demo(),
        api.experiments()
      ]);
      setDemo(demoPayload);
      setExperiments(experimentList);
      setLastRefreshedAt(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load control plane data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      load();
    }, 10000);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadAssignment() {
      try {
        const result = await api.assignUser(ACTIVE_EXPERIMENT_ID, userId);
        if (!cancelled) setAssignment(result);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to assign user");
      }
    }

    loadAssignment();
    return () => {
      cancelled = true;
    };
  }, [userId, demo?.experiment.rolloutPercentage]);

  async function setRollout(value: number) {
    await api.updateRollout(ACTIVE_EXPERIMENT_ID, value, ACTOR);
    await load();
  }

  async function rollback() {
    await api.rollback("inc-1042", ACTOR);
    await load();
  }

  async function analyzeIncident() {
    try {
      setAnalyzing(true);
      setError(null);
      setAiAnalysis(await api.analyzeIncident("inc-1042"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI analysis failed");
    } finally {
      setAnalyzing(false);
    }
  }

  if (loading) {
    return <div className="loading">Loading reliability control plane...</div>;
  }

  if (!demo) {
    return <div className="loading">{error || "No dashboard data available."}</div>;
  }

  const { experiment, metrics, regression, incidents, trace, audit } = demo;
  const incident = incidents[0];
  const liveMetrics = getLiveMetrics(metrics.series);
  const currentControl = liveMetrics.latest.control;
  const currentTreatment = liveMetrics.latest.treatment;
  const displayDeltas = currentControl && currentTreatment
    ? calculateDisplayDeltas(currentControl, currentTreatment)
    : null;

  return (
    <div className="shell">
      <Sidebar />

      <main>
        <header className="topbar">
          <div>
            <p className="eyebrow">Release safety dashboard</p>
            <h1>Search Ranking V2 rollout</h1>
          </div>
          <div className="operator">Operator: <strong>{ACTOR}</strong></div>
        </header>

        {error ? <div className="error-banner">{error}</div> : null}

        <section className="hero" id="dashboard">
          <div>
            <p className="eyebrow">What is happening</p>
            <h2>{experiment.rolloutPercentage}% of users can see the new ranking feature.</h2>
            <p>Control users get the old search behavior. Treatment users get the new ranking model from the target app. This page compares the two groups and lets you roll back if treatment looks unhealthy.</p>
          </div>
          <div className="hero-actions">
            <button onClick={rollback}>Rollback to old version</button>
            <button className="secondary" onClick={load}>Refresh</button>
            {lastRefreshedAt ? <span className="refresh-note">Updated {formatClock(lastRefreshedAt)}</span> : null}
          </div>
        </section>

        <section className="grid two">
          <RolloutPanel experiment={experiment} setRollout={setRollout} />
          <HealthPanel
            unhealthy={Boolean(displayDeltas && isUnhealthy(displayDeltas))}
            controlP95={currentControl?.p95}
            treatmentP95={currentTreatment?.p95}
            errorDelta={displayDeltas?.errorRatePoints}
            latestWindow={liveMetrics.latestWindow}
            hasLiveMetrics={liveMetrics.hasLiveMetrics}
            hasComparableLiveMetrics={liveMetrics.hasComparableLiveMetrics}
            rolloutPercentage={experiment.rolloutPercentage}
          />
        </section>

        <section className="grid two">
          <AssignmentPanel userId={userId} setUserId={setUserId} assignment={assignment} />
          <TargetAppPanel onTrafficGenerated={load} />
        </section>

        <section className="panel" id="metrics">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Metrics</p>
              <h3>Control vs treatment</h3>
            </div>
            <span className={`pill ${regression.unhealthy ? "danger" : ""}`}>
              {liveMetrics.hasLiveMetrics
                ? regression.unhealthy ? "Regression detected" : "Healthy"
                : "Historical seed data"}
            </span>
          </div>
          <MetricChart series={metrics.series} />
          <RegressionReasons regression={regression} hasLiveMetrics={liveMetrics.hasLiveMetrics} />
        </section>

        <section className="grid two evidence-grid" id="evidence">
          <LiveEvidencePanel
            unhealthy={Boolean(displayDeltas && isUnhealthy(displayDeltas))}
            hasLiveMetrics={liveMetrics.hasLiveMetrics}
            controlP95={currentControl?.p95}
            treatmentP95={currentTreatment?.p95}
            latestWindow={liveMetrics.latestWindow}
            hasComparableLiveMetrics={liveMetrics.hasComparableLiveMetrics}
            rolloutPercentage={experiment.rolloutPercentage}
          />
          <IncidentPanel
            incident={incident}
            rollback={rollback}
            analyzeIncident={analyzeIncident}
            analyzing={analyzing}
            aiAnalysis={aiAnalysis}
          />
        </section>

        <DetailsSection experiments={experiments} audit={audit} trace={trace} />
      </main>
    </div>
  );
}

function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">RCP</div>
        <div>
          <strong>Reliability Control</strong>
          <span>Experiment operations</span>
        </div>
      </div>
      <nav>
        <a href="#dashboard" className="active">Overview</a>
        <a href="#rollout">Rollout</a>
        <a href="#metrics">Metrics</a>
        <a href="#evidence">Evidence</a>
      </nav>
    </aside>
  );
}

function HealthPanel({
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
  const heading = healthHeading({ hasLiveMetrics, hasComparableLiveMetrics, unhealthy, rolloutPercentage });
  const badge = healthBadge({ hasLiveMetrics, hasComparableLiveMetrics, unhealthy, rolloutPercentage });

  return (
    <article className="panel health-panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Health check</p>
          <h3>{heading}</h3>
        </div>
        <span className={`pill ${unhealthy ? "danger" : ""}`}>
          {badge}
        </span>
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

function AssignmentPanel({ userId, setUserId, assignment }: {
  userId: string;
  setUserId: (userId: string) => void;
  assignment: Assignment | null;
}) {
  return (
    <article className="panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">User assignment</p>
          <h3>Who gets the new feature?</h3>
        </div>
        <input
          value={userId}
          aria-label="User id for assignment"
          onChange={(event) => setUserId(event.target.value)}
        />
      </div>
      <div className="assignment">
        {assignment ? (
          <>
            <strong>{assignment.userId}</strong> maps to <strong>{assignment.variant}</strong>
            <br />
            <small>Stable bucket {assignment.bucketNumber}; included={String(assignment.included)}</small>
          </>
        ) : "Calculating assignment..."}
      </div>
    </article>
  );
}

function TargetAppPanel({ onTrafficGenerated }: { onTrafficGenerated: () => Promise<void> }) {
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function generateTraffic() {
    try {
      setGenerating(true);
      setMessage(null);
      const response = await fetch("http://127.0.0.1:4180/traffic", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ count: 100 })
      });

      if (!response.ok) {
        throw new Error(`Target app returned ${response.status}`);
      }

      const result = await response.json();
      setMessage(`Generated ${result.generated} requests with ${result.failures} failures.`);
      await onTrafficGenerated();
    } catch (error) {
      setMessage(error instanceof Error
        ? `${error.message}. Make sure npm run dev:target is running.`
        : "Could not generate target-app traffic.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <article className="panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Target app</p>
          <h3>The app being rolled out</h3>
        </div>
      </div>
      <p className="muted">
        The target search app asks this control plane who should see the new feature, serves old or new behavior, then reports latency and errors back as metric events.
      </p>
      <div className="command-box">
        <span>Generate local traffic</span>
        <code>npm run traffic -- 100</code>
      </div>
      <div className="button-row traffic-actions">
        <button onClick={generateTraffic} disabled={generating}>
          {generating ? "Generating..." : "Generate 100 requests"}
        </button>
        {message ? <small className="muted">{message}</small> : null}
      </div>
    </article>
  );
}

function RolloutPanel({ experiment, setRollout }: {
  experiment: Experiment;
  setRollout: (value: number) => Promise<void>;
}) {
  return (
    <article className="panel" id="rollout">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Rollout control</p>
          <h3>Exposure guardrail</h3>
        </div>
        <span className="pill">{formatStatus(experiment.status)}</span>
      </div>
      <label className="range-label" htmlFor="rollout-slider">
        Treatment traffic
        <strong>{experiment.rolloutPercentage}%</strong>
      </label>
      <input
        id="rollout-slider"
        min="0"
        max="100"
        step="5"
        type="range"
        value={experiment.rolloutPercentage}
        onChange={(event) => setRollout(Number(event.target.value))}
      />
      <div className="button-row">
        {[10, 25, 50].map((value) => (
          <button key={value} onClick={() => setRollout(value)}>{value}%</button>
        ))}
        <button className="secondary" onClick={() => setRollout(0)}>Pause</button>
      </div>
    </article>
  );
}

function MetricChart({ series }: { series: MetricSeriesPoint[] }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const max = useMemo(() => {
    const values = series.flatMap((point) => [point.controlP95, point.treatmentP95].filter(Boolean) as number[]);
    return Math.max(...values) * 1.15;
  }, [series]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    drawMetricChart(ctx, series, max);
  }, [max, series]);

  return (
    <div className="chart-wrap">
      <canvas ref={canvasRef} width="980" height="300" />
    </div>
  );
}

function RegressionReasons({ regression, hasLiveMetrics }: { regression: Regression; hasLiveMetrics: boolean }) {
  if (!hasLiveMetrics) {
    return (
      <div className="reasons">
        <div className="reason neutral">Chart starts with historical seed data. Run <code>npm run traffic -- 100</code> to add live target-app metrics.</div>
      </div>
    );
  }

  return (
    <div className="reasons">
      {(regression.reasons.length ? regression.reasons : ["No regression detected in the latest metric window."]).map((reason) => (
        <div className="reason" key={reason}>{reason}</div>
      ))}
    </div>
  );
}

function LiveEvidencePanel({
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
          {hasComparableLiveMetrics ? unhealthy ? "Unhealthy" : "Healthy" : hasLiveMetrics ? "Control only" : "No live data"}
        </span>
      </div>
      <div className="live-signal">
        <div>
          <span>Control p95</span>
          <strong>{formatMs(controlP95)}</strong>
        </div>
        <div>
          <span>Treatment p95</span>
          <strong>{formatMs(treatmentP95)}</strong>
        </div>
      </div>
      <p className="muted">
        {hasComparableLiveMetrics
          ? "This card is based on metric events emitted by the target app."
          : hasLiveMetrics && rolloutPercentage === 0
            ? "Rollback is active, so new target-app traffic should only populate the control side."
            : hasLiveMetrics
              ? "Live data exists, but treatment has not arrived for the latest live window yet."
          : <>Run <code>npm run traffic -- 100</code>, then watch this card and the chart update.</>}
      </p>
    </article>
  );
}

function IncidentPanel({ incident, rollback, analyzeIncident, analyzing, aiAnalysis }: {
  incident: Incident;
  rollback: () => Promise<void>;
  analyzeIncident: () => Promise<void>;
  analyzing: boolean;
  aiAnalysis: AiAnalysis | null;
}) {
  return (
    <article className="panel" id="incident">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Incident</p>
          <h3>{incident.title}</h3>
        </div>
        <div className="hero-actions">
          <button className="secondary" onClick={analyzeIncident} disabled={analyzing}>
            {analyzing ? "Analyzing..." : "Analyze with AI"}
          </button>
          <button onClick={rollback}>Rollback</button>
        </div>
      </div>
      <p className="muted">{incident.severity} - {incident.status} - {incident.summary}</p>
      {aiAnalysis ? <AiAnalysisPanel analysis={aiAnalysis} /> : null}
      <div className="timeline">
        {incident.timeline.map((item) => (
          <div className={`timeline-item ${isSeedTimelineItem(item.type) ? "seeded-item" : "live-item"}`} key={`${item.time}-${item.type}-${item.text}`}>
            <span>{item.time}</span>
            <div>
              <strong>{item.type}</strong>
              <em>{isSeedTimelineItem(item.type) ? "seeded demo evidence" : "live action"}</em>
              <br />
              {item.text}
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}

function AiAnalysisPanel({ analysis }: { analysis: AiAnalysis }) {
  return (
    <div className="ai-panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">{analysis.source === "openai" ? "AI incident advisor" : "Local advisor fallback"}</p>
          <h3>{formatRecommendation(analysis.recommendation)} · {analysis.confidence} confidence</h3>
        </div>
        <span className={`pill ${analysis.recommendation === "rollback" ? "danger" : ""}`}>{analysis.model}</span>
      </div>
      <p>{analysis.summary}</p>
      <p className="muted"><strong>Likely cause:</strong> {analysis.suspectedCause}</p>
      {analysis.aiError ? <p className="muted"><strong>AI error:</strong> {analysis.aiError}</p> : null}
      <div className="ai-columns">
        <div>
          <strong>Evidence</strong>
          <ul>
            {analysis.evidence.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
        <div>
          <strong>Next steps</strong>
          <ul>
            {analysis.nextSteps.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
      </div>
    </div>
  );
}

function TracePanel({ trace }: { trace: Trace }) {
  return (
    <article className="panel" id="trace">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Trace explorer</p>
          <h3>{trace.id}</h3>
        </div>
        <span className="pill danger">{trace.status}</span>
      </div>
      <p className="muted">{trace.bucket} bucket - {trace.durationMs}ms - {trace.failureReason}</p>
      <div className="spans">
        {trace.spans.map((span) => (
          <div className="span" key={`${span.service}-${span.operation}`}>
            <div><strong>{span.service}</strong><small>{span.operation}</small></div>
            <span>{span.durationMs}ms</span>
            <span className={`pill ${span.status !== "ok" ? "danger" : ""}`}>{span.status}</span>
          </div>
        ))}
      </div>
    </article>
  );
}

function AuditPanel({ audit }: { audit: AuditEvent[] }) {
  const liveEvents = audit.filter((event) => !isSeedAuditEvent(event.id));
  const seedEvents = audit.filter((event) => isSeedAuditEvent(event.id));
  const visibleAudit = [...liveEvents, ...seedEvents];

  return (
    <section>
      <div className="panel-head">
        <div>
          <p className="eyebrow">Audit log</p>
          <h3>{liveEvents.length ? "Live changes and seed history" : "Seed history"}</h3>
        </div>
      </div>
      <p className="muted">
        {liveEvents.length
          ? "New rollout and rollback actions appear first. Seeded entries are kept for demo context."
          : "No live rollout or rollback actions yet. Use rollout controls or rollback to create live audit entries."}
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Change</th>
            </tr>
          </thead>
          <tbody>
            {visibleAudit.map((event) => (
              <tr className={isSeedAuditEvent(event.id) ? "seeded-item" : "live-item"} key={event.id}>
                <td>{formatTime(event.time)}</td>
                <td>{event.actor}</td>
                <td>{event.action}</td>
                <td>{event.from} -&gt; {event.to}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function DetailsSection({ experiments, audit, trace }: {
  experiments: Experiment[];
  audit: AuditEvent[];
  trace: Trace;
}) {
  const [open, setOpen] = useState(false);

  return (
    <section className="panel compact-details">
      <button className="secondary" onClick={() => setOpen((value) => !value)}>
        {open ? "Hide details" : "Show experiments and audit log"}
      </button>
      {open ? (
        <div className="details-grid">
          <div>
            <h3>Experiments</h3>
            <div className="experiment-list">
              {experiments.map((experiment) => (
                <div className="experiment" key={experiment.id}>
                  <div>
                    <strong>{experiment.name}</strong>
                    <small>{experiment.owner} - {experiment.targeting.regions.join(", ")}</small>
                  </div>
                  <span className={`pill ${experiment.status === "degraded" ? "danger" : ""}`}>
                    {formatStatus(experiment.status)}
                  </span>
                </div>
              ))}
            </div>
            <TracePanel trace={trace} />
          </div>
          <AuditPanel audit={audit} />
        </div>
      ) : null}
    </section>
  );
}

function formatStatus(status: string) {
  return status.replace("_", " ");
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatClock(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit"
  }).format(value);
}

function formatMs(value?: number) {
  if (value === undefined) return "--";
  return `${Math.round(value)}ms`;
}

function formatDelta(value: number) {
  return `${value >= 0 ? "+" : ""}${Math.round(value * 10) / 10}`;
}

function formatRecommendation(value: string) {
  return value.replace("_", " ");
}

function isSeedTimelineItem(type: string) {
  return !["rollback", "live_metric", "recovery"].includes(type);
}

function isSeedAuditEvent(id: string) {
  return id === "aud-1" || id === "aud-2";
}
