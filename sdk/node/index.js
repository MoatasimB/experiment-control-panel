export function createRcpClient({
  controlPlaneUrl,
  experimentId,
  service = "target-service",
  releaseSha = "local",
  fetchImpl = fetch
}) {
  if (!controlPlaneUrl) throw new Error("controlPlaneUrl is required");
  if (!experimentId) throw new Error("experimentId is required");

  const baseUrl = controlPlaneUrl.replace(/\/$/, "");

  async function assignUser(userId) {
    const response = await fetchImpl(`${baseUrl}/api/assignments`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ experimentId, userId })
    });

    if (!response.ok) throw new Error(`Assignment failed with status ${response.status}`);
    return response.json();
  }

  async function reportMetric(event) {
    const response = await fetchImpl(`${baseUrl}/api/metrics/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ experimentId, service, releaseSha, ...event })
    });

    if (!response.ok) throw new Error(`Metric ingestion failed with status ${response.status}`);
    return response.json();
  }

  async function runExperiment({
    userId,
    route = "unknown",
    control,
    treatment,
    toMetric = defaultMetric
  }) {
    if (!userId) throw new Error("userId is required");
    if (typeof control !== "function") throw new Error("control callback is required");
    if (typeof treatment !== "function") throw new Error("treatment callback is required");

    const assignment = await assignUser(userId);
    const callback = assignment.variant === "treatment" ? treatment : control;
    const traceId = createTraceId(userId);
    const started = performance.now();

    try {
      const result = await callback({ assignment, traceId });
      const durationMs = Math.round(performance.now() - started);
      const customMetric = toMetric(result, { assignment, durationMs, traceId });
      const metric = {
        ...customMetric,
        route,
        userId,
        bucket: assignment.variant,
        traceId: customMetric.traceId || traceId,
        durationMs: customMetric.durationMs || durationMs
      };

      await reportMetric(metric);
      return { assignment, result, durationMs, metric };
    } catch (error) {
      const durationMs = Math.round(performance.now() - started);
      const metric = {
        route,
        userId,
        bucket: assignment.variant,
        traceId,
        statusCode: 500,
        durationMs,
        conversion: false,
        completion: false
      };

      await reportMetric(metric).catch(() => undefined);
      throw error;
    }
  }

  return { assignUser, reportMetric, runExperiment };
}

function defaultMetric(result) {
  return {
    statusCode: result?.statusCode || 200,
    conversion: Boolean(result?.conversion),
    completion: result?.completion !== false
  };
}

function createTraceId(userId) {
  return `rcp-${Date.now().toString(36)}-${stableNumber(userId).toString(16)}`;
}

function stableNumber(input) {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
