import test from "node:test";
import assert from "node:assert/strict";
import { Store } from "../backend/src/repositories/store.js";
import { rollbackIncident } from "../backend/src/services/rollout.js";

test("rollback sets rollout to zero, mitigates incident, and writes audit event", async () => {
  const store = new Store();
  const result = await rollbackIncident(store, "inc-1042", "test@local");

  assert.equal(result.experiment.rolloutPercentage, 0);
  assert.equal(result.experiment.status, "rolled_back");
  assert.equal(result.incident.status, "mitigated");
  assert.equal(store.listAuditEvents()[0].action, "rollback.triggered");
});
