import { useState } from "react";
import type { AuditEvent, Experiment, Trace } from "../types";
import { formatStatus, formatTime } from "../utils/format";

export function DetailsSection({ experiments, audit, trace }: {
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
            {[...liveEvents, ...seedEvents].map((event) => (
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

function isSeedAuditEvent(id: string) {
  return id === "aud-1" || id === "aud-2";
}
