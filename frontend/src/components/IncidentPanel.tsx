import type { AiAnalysis, Incident } from "../types";
import { formatRecommendation } from "../utils/format";

export function IncidentPanel({ incident, rollback, analyzeIncident, analyzing, aiAnalysis }: {
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

function isSeedTimelineItem(type: string) {
  return !["rollback", "live_metric", "recovery"].includes(type);
}
