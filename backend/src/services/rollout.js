import { STATUS } from "../models/domain.js";
import { executeRollbackAction } from "./rollbackAdapters.js";

export async function updateRollout(store, experimentId, percentage, actor = "operator@local") {
  const experiment = await store.getExperiment(experimentId);
  if (!experiment) return null;

  const previous = experiment.rolloutPercentage;
  const next = Math.max(0, Math.min(100, Number(percentage)));
  const status = next === 0 ? STATUS.PAUSED : experiment.status;

  const updated = await store.updateExperiment(experimentId, {
    previousRolloutPercentage: previous,
    rolloutPercentage: next,
    status
  });

  await store.addAuditEvent({
    actor,
    action: "rollout.updated",
    experimentId,
    from: `${previous}%`,
    to: `${next}%`
  });

  return updated;
}

export async function rollbackIncident(store, incidentId, actor = "operator@local") {
  const run = async (repository) => rollbackIncidentInStore(repository, incidentId, actor);

  if (typeof store.transaction === "function") {
    return store.transaction(run);
  }

  return run(store);
}

async function rollbackIncidentInStore(store, incidentId, actor) {
  const incident = await store.getIncident(incidentId);
  if (!incident) return null;

  const experiment = await store.getExperiment(incident.experimentId);
  if (!experiment) return null;

  const previous = experiment.rolloutPercentage;
  const rollbackAction = await executeRollbackAction({ experiment, actor });

  await store.updateExperiment(experiment.id, {
    previousRolloutPercentage: previous,
    rolloutPercentage: 0,
    status: STATUS.ROLLED_BACK
  });

  const updatedIncident = await store.updateIncident(incidentId, {
    status: "mitigated",
    mitigatedAt: new Date().toISOString(),
    timeline: [
      ...incident.timeline,
      { time: currentTime(), type: "rollback", text: `Rollback triggered by ${actor}; rollout set to 0%.` }
    ]
  });

  await store.addAuditEvent({
    actor,
    action: "rollback.triggered",
    experimentId: experiment.id,
    from: `${previous}%`,
    to: "0%"
  });

  return {
    incident: updatedIncident,
    experiment: await store.getExperiment(experiment.id),
    rollbackAction
  };
}

function currentTime() {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/New_York"
  }).format(new Date());
}
