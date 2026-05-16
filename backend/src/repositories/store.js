import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seedPath = path.resolve(__dirname, "../../data/seed.json");

export class Store {
  constructor(seed = JSON.parse(fs.readFileSync(seedPath, "utf8"))) {
    this.services = structuredClone(seed.services);
    this.experiments = structuredClone(seed.experiments);
    this.metricWindows = structuredClone(seed.metricWindows);
    this.incidents = structuredClone(seed.incidents);
    this.traces = structuredClone(seed.traces);
    this.auditEvents = structuredClone(seed.auditEvents);
  }

  listExperiments() {
    return this.experiments;
  }

  getExperiment(id) {
    return this.experiments.find((experiment) => experiment.id === id);
  }

  updateExperiment(id, patch) {
    const experiment = this.getExperiment(id);
    if (!experiment) return null;
    Object.assign(experiment, patch, { updatedAt: new Date().toISOString() });
    return experiment;
  }

  addMetricEvent(event) {
    this.metricWindows.push(event);
    return event;
  }

  metricsFor(experimentId) {
    return this.metricWindows.filter((metric) => metric.experimentId === experimentId);
  }

  listIncidents() {
    return this.incidents;
  }

  getIncident(id) {
    return this.incidents.find((incident) => incident.id === id);
  }

  updateIncident(id, patch) {
    const incident = this.getIncident(id);
    if (!incident) return null;
    Object.assign(incident, patch);
    return incident;
  }

  getTrace(id) {
    return this.traces.find((trace) => trace.id === id);
  }

  listAuditEvents() {
    return [...this.auditEvents].sort((a, b) => b.time.localeCompare(a.time));
  }

  addAuditEvent(event) {
    this.auditEvents.push({
      id: `aud-${this.auditEvents.length + 1}`,
      time: new Date().toISOString(),
      ...event
    });
  }
}
