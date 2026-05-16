import test from "node:test";
import assert from "node:assert/strict";
import { assignUser } from "../backend/src/services/bucketing.js";

test("assignment is deterministic for the same user and experiment", () => {
  const first = assignUser({ experimentId: "ranking-v2", userId: "user-1", rolloutPercentage: 50 });
  const second = assignUser({ experimentId: "ranking-v2", userId: "user-1", rolloutPercentage: 50 });
  assert.deepEqual(first, second);
});

test("zero percent rollout assigns everyone to control", () => {
  const assignment = assignUser({ experimentId: "ranking-v2", userId: "user-1", rolloutPercentage: 0 });
  assert.equal(assignment.included, false);
  assert.equal(assignment.variant, "control");
});

test("full rollout assigns everyone to treatment", () => {
  const assignment = assignUser({ experimentId: "ranking-v2", userId: "user-1", rolloutPercentage: 100 });
  assert.equal(assignment.included, true);
  assert.equal(assignment.variant, "treatment");
});
