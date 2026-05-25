import { useEffect, useState } from "react";
import { api } from "./api";
import { AssignmentPanel } from "./components/AssignmentPanel";
import { DetailsSection } from "./components/DetailsSection";
import { HealthPanel } from "./components/HealthPanel";
import { IncidentPanel } from "./components/IncidentPanel";
import { LiveEvidencePanel } from "./components/LiveEvidencePanel";
import { MetricChart, RegressionReasons } from "./components/MetricsPanel";
import { RolloutPanel } from "./components/RolloutPanel";
import { Sidebar } from "./components/Sidebar";
import { TargetAppPanel } from "./components/TargetAppPanel";
import { calculateDisplayDeltas, getLiveMetrics, isUnhealthy } from "./liveMetrics";
import type { AiAnalysis, Assignment, DemoPayload, Experiment } from "./types";
import { formatClock } from "./utils/format";

const ACTOR = "maya@company.com";
const ACTIVE_EXPERIMENT_ID = "ranking-v2";
const ACTIVE_INCIDENT_ID = "inc-1042";

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
      const [demoPayload, experimentList] = await Promise.all([api.demo(), api.experiments()]);
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
    const interval = window.setInterval(load, 10000);
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
    await api.rollback(ACTIVE_INCIDENT_ID, ACTOR);
    await load();
  }

  async function analyzeIncident() {
    try {
      setAnalyzing(true);
      setError(null);
      setAiAnalysis(await api.analyzeIncident(ACTIVE_INCIDENT_ID));
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI analysis failed");
    } finally {
      setAnalyzing(false);
    }
  }

  if (loading) return <div className="loading">Loading reliability control plane...</div>;
  if (!demo) return <div className="loading">{error || "No dashboard data available."}</div>;

  const { experiment, metrics, regression, incidents, trace, audit } = demo;
  const incident = incidents[0];
  const liveMetrics = getLiveMetrics(metrics.series);
  const currentControl = liveMetrics.latest.control;
  const currentTreatment = liveMetrics.latest.treatment;
  const displayDeltas = currentControl && currentTreatment
    ? calculateDisplayDeltas(currentControl, currentTreatment)
    : null;
  const unhealthy = Boolean(displayDeltas && isUnhealthy(displayDeltas));

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
            <p>Current-version users get the stable search behavior. Experimental-version users get the new ranking model from the target app. This page compares the two groups and lets you roll back if experimental traffic looks unhealthy.</p>
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
            unhealthy={unhealthy}
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
              <h3>Current vs experimental</h3>
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
            unhealthy={unhealthy}
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
