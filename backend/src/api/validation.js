const BUCKETS = new Set(["control", "treatment"]);

export class RequestValidationError extends Error {
  constructor(details) {
    super("Invalid request");
    this.name = "RequestValidationError";
    this.details = details;
  }
}

export function validateAssignmentBody(body) {
  const errors = [];
  const experimentId = requiredString(body?.experimentId, "experimentId", errors);
  const userId = requiredString(body?.userId, "userId", errors);

  throwIfInvalid(errors);
  return { experimentId, userId };
}

export function validateRolloutBody(body) {
  const errors = [];
  const rolloutPercentage = requiredFiniteNumber(body?.rolloutPercentage, "rolloutPercentage", errors);
  const actor = optionalString(body?.actor, "actor", errors) || undefined;

  if (rolloutPercentage !== undefined && (rolloutPercentage < 0 || rolloutPercentage > 100)) {
    errors.push("rolloutPercentage must be between 0 and 100");
  }

  throwIfInvalid(errors);
  return { rolloutPercentage, actor };
}

export function validateMetricEventBody(body) {
  const errors = [];
  const experimentId = requiredString(body?.experimentId, "experimentId", errors);
  const bucket = requiredString(body?.bucket, "bucket", errors);
  const userId = requiredString(body?.userId, "userId", errors);
  const statusCode = requiredInteger(body?.statusCode, "statusCode", errors);
  const durationMs = requiredFiniteNumber(body?.durationMs, "durationMs", errors);

  if (bucket && !BUCKETS.has(bucket)) {
    errors.push("bucket must be control or treatment");
  }
  if (statusCode !== undefined && (statusCode < 100 || statusCode > 599)) {
    errors.push("statusCode must be an HTTP status code");
  }
  if (durationMs !== undefined && durationMs < 0) {
    errors.push("durationMs must be greater than or equal to 0");
  }

  const event = {
    experimentId,
    bucket,
    userId,
    statusCode,
    durationMs,
    service: optionalString(body?.service, "service", errors) || undefined,
    route: optionalString(body?.route, "route", errors) || undefined,
    traceId: optionalString(body?.traceId, "traceId", errors) || undefined,
    releaseSha: optionalString(body?.releaseSha, "releaseSha", errors) || undefined,
    conversion: optionalBoolean(body?.conversion, "conversion", errors),
    completion: optionalBoolean(body?.completion, "completion", errors)
  };

  throwIfInvalid(errors);
  return event;
}

export function validateActorBody(body) {
  const errors = [];
  const actor = optionalString(body?.actor, "actor", errors) || undefined;

  throwIfInvalid(errors);
  return { actor };
}

export function validateExperimentIdQuery(query) {
  const errors = [];
  const experimentId = requiredString(query?.experiment_id, "experiment_id", errors);

  throwIfInvalid(errors);
  return { experimentId };
}

export function handleValidationError(error, res) {
  if (!(error instanceof RequestValidationError)) return false;
  res.status(400).json({ error: "Invalid request", details: error.details });
  return true;
}

function requiredString(value, field, errors) {
  if (typeof value !== "string" || value.trim() === "") {
    errors.push(`${field} is required`);
    return undefined;
  }
  return value.trim();
}

function optionalString(value, field, errors) {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string" || value.trim() === "") {
    errors.push(`${field} must be a non-empty string`);
    return undefined;
  }
  return value.trim();
}

function requiredFiniteNumber(value, field, errors) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    errors.push(`${field} must be a number`);
    return undefined;
  }
  return value;
}

function requiredInteger(value, field, errors) {
  if (!Number.isInteger(value)) {
    errors.push(`${field} must be an integer`);
    return undefined;
  }
  return value;
}

function optionalBoolean(value, field, errors) {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "boolean") {
    errors.push(`${field} must be a boolean`);
    return undefined;
  }
  return value;
}

function throwIfInvalid(errors) {
  if (errors.length) {
    throw new RequestValidationError(errors);
  }
}
