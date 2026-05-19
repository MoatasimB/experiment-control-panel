import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "./api";
import type {
  Assignment,
  AuditEvent,
  DemoPayload,
  Experiment,
  Incident,
  MetricSeriesPoint,
  Regression,
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

  if (loading || !demo) {
    return <div className="loading">Loading reliability control plane...</div>;
  }

  const { experiment, metrics, regression, incidents, trace, audit } = demo;
  const incident = incidents[0];
  const currentControl = metrics.latest.control;
  const currentTreatment = metrics.latest.treatment;

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
            regression={regression}
            controlP95={currentControl?.p95}
            treatmentP95={currentTreatment?.p95}
            errorDelta={metrics.deltas.errorRatePoints}
            latestWindow={currentTreatment?.time || currentControl?.time}
          />
        </section>

        <section className="grid two">
          <AssignmentPanel userId={userId} setUserId={setUserId} assignment={assignment} />
          <TargetAppPanel />
        </section>

        <section className="panel" id="metrics">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Metrics</p>
              <h3>Control vs treatment</h3>
            </div>
            <span className={`pill ${regression.unhealthy ? "danger" : ""}`}>
              {regression.unhealthy ? "Regression detected" : "Healthy"}
            </span>
          </div>
          <MetricChart series={metrics.series} />
          <RegressionReasons regression={regression} />
        </section>

        <section className="grid two evidence-grid" id="evidence">
          <LiveEvidencePanel regression={regression} controlP95={currentControl?.p95} treatmentP95={currentTreatment?.p95} />
          <IncidentPanel incident={incident} rollback={rollback} />
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

function HealthPanel({ regression, controlP95, treatmentP95, errorDelta, latestWindow }: {
  regression: Regression;
  controlP95?: number;
  treatmentP95?: number;
  errorDelta: number;
  latestWindow?: string;
}) {
  return (
    <article className="panel health-panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Health check</p>
          <h3>{regression.unhealthy ? "Treatment looks unsafe" : "Treatment looks healthy"}</h3>
        </div>
        <span className={`pill ${regression.unhealthy ? "danger" : ""}`}>
          {regression.unhealthy ? "Rollback recommended" : "Continue rollout"}
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
          <strong>{formatDelta(errorDelta)}</strong>
        </div>
      </div>
      <p className="muted">Latest metric window: {latestWindow || "waiting for target app traffic"}</p>
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

function TargetAppPanel() {
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

    const width = canvas.width;
    const height = canvas.height;
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

    drawLine(ctx, series, "controlP95", "#1c7c54", max, width, height, pad);
    drawLine(ctx, series, "treatmentP95", "#b42318", max, width, height, pad);

    ctx.fillStyle = "#617080";
    ctx.font = "13px system-ui";
    series.forEach((point, index) => {
      const x = xAt(index, series.length, width, pad);
      ctx.fillText(point.time, x - 14, height - 12);
    });

    drawLegend(ctx, "Control p95", "#1c7c54", 64);
    drawLegend(ctx, "Treatment p95", "#b42318", 178);
  }, [max, series]);

  return (
    <div className="chart-wrap">
      <canvas ref={canvasRef} width="980" height="300" />
    </div>
  );
}

function RegressionReasons({ regression }: { regression: Regression }) {
  return (
    <div className="reasons">
      {(regression.reasons.length ? regression.reasons : ["No regression detected in the latest metric window."]).map((reason) => (
        <div className="reason" key={reason}>{reason}</div>
      ))}
    </div>
  );
}

function LiveEvidencePanel({ regression, controlP95, treatmentP95 }: {
  regression: Regression;
  controlP95?: number;
  treatmentP95?: number;
}) {
  const latest = regression.summary.latest.treatment || regression.summary.latest.control;

  return (
    <article className="panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Live target app signal</p>
          <h3>{latest ? `Latest window: ${latest.time}` : "Waiting for traffic"}</h3>
        </div>
        <span className={`pill ${regression.unhealthy ? "danger" : ""}`}>
          {regression.unhealthy ? "Unhealthy" : "Healthy"}
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
        This card updates from metric events emitted by the target app. Run <code>npm run traffic -- 100</code>, then watch this section and the chart refresh.
      </p>
    </article>
  );
}

function IncidentPanel({ incident, rollback }: {
  incident: Incident;
  rollback: () => Promise<void>;
}) {
  return (
    <article className="panel" id="incident">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Incident</p>
          <h3>{incident.title}</h3>
        </div>
        <button onClick={rollback}>Rollback</button>
      </div>
      <p className="muted">{incident.severity} - {incident.status} - {incident.summary}</p>
      <div className="timeline">
        {incident.timeline.map((item) => (
          <div className="timeline-item" key={`${item.time}-${item.type}-${item.text}`}>
            <span>{item.time}</span>
            <div><strong>{item.type}</strong><br />{item.text}</div>
          </div>
        ))}
      </div>
    </article>
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
  return (
    <section>
      <div className="panel-head">
        <div>
          <p className="eyebrow">Audit log</p>
          <h3>Production changes</h3>
        </div>
      </div>
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
            {audit.map((event) => (
              <tr key={event.id}>
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

function drawLine(
  ctx: CanvasRenderingContext2D,
  series: MetricSeriesPoint[],
  key: "controlP95" | "treatmentP95",
  color: string,
  max: number,
  width: number,
  height: number,
  pad: number
) {
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
