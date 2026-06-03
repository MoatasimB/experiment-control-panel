import test from "node:test";
import assert from "node:assert/strict";
import {
  RequestValidationError,
  validateAssignmentBody,
  validateExperimentIdQuery,
  validateMetricEventBody,
  validateRolloutBody
} from "../backend/src/api/validation.js";

test("assignment validation requires experimentId and userId", () => {
  assertValidationDetails(
    () => validateAssignmentBody({ experimentId: "ranking-v2" }),
    ["userId is required"]
  );
});

test("rollout validation rejects percentages outside 0 to 100", () => {
  assertValidationDetails(
    () => validateRolloutBody({ rolloutPercentage: 125, actor: "test@local" }),
    ["rolloutPercentage must be between 0 and 100"]
  );
});

test("metric validation rejects malformed events", () => {
  assertValidationDetails(
    () => validateMetricEventBody({
      experimentId: "ranking-v2",
      bucket: "candidate",
      userId: "user-1",
      statusCode: 200,
      durationMs: -1
    }),
    [
      "bucket must be control or treatment",
      "durationMs must be greater than or equal to 0"
    ]
  );
});

test("metric validation returns a sanitized event", () => {
  const event = validateMetricEventBody({
    experimentId: " ranking-v2 ",
    bucket: "treatment",
    userId: " user-1 ",
    statusCode: 200,
    durationMs: 42,
    service: " target-search ",
    conversion: true
  });

  assert.deepEqual(event, {
    experimentId: "ranking-v2",
    bucket: "treatment",
    userId: "user-1",
    statusCode: 200,
    durationMs: 42,
    service: "target-search",
    route: undefined,
    traceId: undefined,
    releaseSha: undefined,
    conversion: true,
    completion: undefined
  });
});

test("metric summary validation requires experiment_id", () => {
  assertValidationDetails(
    () => validateExperimentIdQuery({}),
    ["experiment_id is required"]
  );
});

function assertValidationDetails(callback, details) {
  assert.throws(
    callback,
    (error) => error instanceof RequestValidationError
      && error.message === "Invalid request"
      && assert.deepEqual(error.details, details) === undefined
  );
}
