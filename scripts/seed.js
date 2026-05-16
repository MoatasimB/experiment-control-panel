import { Store } from "../backend/src/repositories/store.js";

const store = new Store();
console.log(JSON.stringify({
  experiments: store.listExperiments().length,
  incidents: store.listIncidents().length,
  auditEvents: store.listAuditEvents().length
}, null, 2));
