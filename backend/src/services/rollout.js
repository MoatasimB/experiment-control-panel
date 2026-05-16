import { STATUS } from "../models/domain.js";

export function updateRollout(store, experimentId, percentage, actor = "operator@local") {
  const experiment = store.getExperiment(experimentId);
  if (!experiment) return null;

  const previous = experiment.rolloutPercentage;
  const next = Math.max(0, Math.min(100, Number(percentage)));
  const status = next === 0 ? STATUS.PAUSED : experiment.status;

  const updated = store.updateExperiment(experimentId, {
    previousRolloutPercentage: previous,
    rolloutPercentage: next,
    status
  });

  store.addAuditEvent({
    actor,
    action: "rollout.updated",
    experimentId,
    from: `${previous}%`,
    to: `${next}%`
  });

  return updated;
}

export function rollbackIncident(store, incidentId, actor = "operator@local") {
  const incident = store.getIncident(incidentId);
  if (!incident) return null;

  const experiment = store.getExperiment(incident.experimentId);
  if (!experiment) return null;

  const previous = experiment.rolloutPercentage;
  store.updateExperiment(experiment.id, {
    previousRolloutPercentage: previous,
    rolloutPercentage: 0,
    status: STATUS.ROLLED_BACK
  });

  const updatedIncident = store.updateIncident(incidentId, {
    status: "mitigated",
    mitigatedAt: new Date().toISOString(),
    timeline: [
      ...incident.timeline,
      { time: currentTime(), type: "rollback", text: `Rollback triggered by ${actor}; rollout set to 0%.` }
    ]
  });

  store.addAuditEvent({
    actor,
    action: "rollback.triggered",
    experimentId: experiment.id,
    from: `${previous}%`,
    to: "0%"
  });

  return { incident: updatedIncident, experiment: store.getExperiment(experiment.id) };
}

function currentTime() {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/New_York"
  }).format(new Date());
}
