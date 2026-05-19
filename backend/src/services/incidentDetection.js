import { STATUS } from "../models/domain.js";
import { detectRegression } from "./regression.js";

const LIVE_INCIDENT_TYPES = new Set(["live_metric", "recovery"]);

export async function updateIncidentFromLiveMetrics(store, experimentId) {
  if (!experimentId) return null;

  const experiment = await store.getExperiment(experimentId);
  if (!experiment) return null;

  if (experiment.rolloutPercentage === 0 || ["paused", "rolled_back"].includes(experiment.status)) {
    return null;
  }

  const metricWindows = await store.metricsFor(experimentId);
  const liveWindows = latestComparableLiveWindow(metricWindows);
  if (!liveWindows.length) return null;

  const regression = detectRegression(liveWindows);
  const incident = await findIncidentForExperiment(store, experimentId);
  if (!incident) return null;

  if (regression.unhealthy) {
    return markIncidentUnhealthy(store, experiment, incident, regression);
  }

  return markIncidentMonitoring(store, experiment, incident);
}

function latestComparableLiveWindow(metricWindows) {
  const windowsByTime = metricWindows
    .filter((window) => window.source === "live")
    .reduce((result, window) => {
      const windows = result.get(window.time) || [];
      windows.push(window);
      result.set(window.time, windows);
      return result;
    }, new Map());

  const comparableTimes = [...windowsByTime.entries()]
    .filter(([, windows]) => (
      windows.some((window) => window.bucket === "control")
        && windows.some((window) => window.bucket === "treatment")
    ))
    .map(([time]) => time)
    .sort((a, b) => b.localeCompare(a));

  return comparableTimes.length ? windowsByTime.get(comparableTimes[0]) : [];
}

async function findIncidentForExperiment(store, experimentId) {
  const incidents = await store.listIncidents();
  return incidents.find((incident) => incident.experimentId === experimentId) || null;
}

async function markIncidentUnhealthy(store, experiment, incident, regression) {
  if (!["paused", "rolled_back"].includes(experiment.status)) {
    await store.updateExperiment(experiment.id, { status: STATUS.DEGRADED });
  }

  const reasons = regression.reasons.join("; ");
  const summary = `Live target-app traffic is unhealthy: ${reasons}.`;
  const recommendedAction = "Rollback treatment to 0% or pause rollout while investigating the latest live traces.";

  let timeline = incident.timeline;
  if (shouldAppendLiveTimelineEvent(incident, "live_metric")) {
    timeline = [
      ...timeline,
      {
        time: currentTime(),
        type: "live_metric",
        text: `Live target-app detector: ${reasons}.`
      }
    ];
  }

  return store.updateIncident(incident.id, {
    title: "Live treatment regression detected from target-app traffic",
    severity: "SEV2",
    status: "open",
    mitigatedAt: null,
    summary,
    recommendedAction,
    timeline
  });
}

async function markIncidentMonitoring(store, experiment, incident) {
  if (!["paused", "rolled_back"].includes(experiment.status)) {
    await store.updateExperiment(experiment.id, { status: STATUS.HEALTHY });
  }

  const summary = "Live target-app traffic is currently within rollback thresholds.";
  const recommendedAction = "Continue monitoring before increasing rollout.";

  let timeline = incident.timeline;
  if (shouldAppendLiveTimelineEvent(incident, "recovery")) {
    timeline = [
      ...timeline,
      {
        time: currentTime(),
        type: "recovery",
        text: "Live target-app detector: control and treatment are currently within rollback thresholds."
      }
    ];
  }

  return store.updateIncident(incident.id, {
    title: "Live target-app traffic is being monitored",
    status: "monitoring",
    mitigatedAt: null,
    summary,
    recommendedAction,
    timeline
  });
}

function shouldAppendLiveTimelineEvent(incident, type) {
  const now = currentTime();
  return !incident.timeline.some((item) => item.time === now && LIVE_INCIDENT_TYPES.has(item.type))
    && incident.timeline.at(-1)?.type !== type;
}

function currentTime() {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/New_York"
  }).format(new Date());
}
