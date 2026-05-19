import { detectRegression } from "./regression.js";

const DEFAULT_MODEL = process.env.OPENAI_MODEL || "gpt-5-mini";

export async function analyzeIncidentWithAi(store, incidentId) {
  const evidence = await collectIncidentEvidence(store, incidentId);
  if (!evidence.incident) return null;

  if (!process.env.OPENAI_API_KEY) {
    return heuristicAnalysis(evidence);
  }

  try {
    return await openAiAnalysis(evidence);
  } catch (error) {
    return {
      ...heuristicAnalysis(evidence),
      model: "local-heuristic-fallback",
      aiError: error.message
    };
  }
}

async function collectIncidentEvidence(store, incidentId) {
  const incident = await store.getIncident(incidentId);
  if (!incident) return { incident: null };

  const experiment = await store.getExperiment(incident.experimentId);
  const metrics = await store.metricsFor(incident.experimentId);
  const regression = detectRegression(metrics);
  const trace = await store.getTrace("trc-8f4a");
  const audit = await store.listAuditEvents();
  const recentEvents = typeof store.listRecentMetricEvents === "function"
    ? await store.listRecentMetricEvents(incident.experimentId, 30)
    : [];

  return {
    incident,
    experiment,
    metrics: regression.summary,
    regression: {
      unhealthy: regression.unhealthy,
      reasons: regression.reasons
    },
    trace,
    audit: audit.slice(0, 10),
    recentEvents
  };
}

async function openAiAnalysis(evidence) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      instructions: [
        "You are an incident commander reviewing rollout telemetry.",
        "Use only the provided evidence.",
        "Return strict JSON with these keys: recommendation, confidence, suspectedCause, summary, evidence, risks, nextSteps.",
        "recommendation must be one of rollback, pause_rollout, continue_monitoring, increase_rollout.",
        "Never claim certainty. If evidence is seeded or insufficient, say so."
      ].join(" "),
      input: JSON.stringify(evidence),
      max_output_tokens: 900
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI request failed: ${response.status} ${body}`);
  }

  const payload = await response.json();
  const text = extractResponseText(payload);
  const parsed = parseJson(text);

  return {
    model: DEFAULT_MODEL,
    generatedAt: new Date().toISOString(),
    source: "openai",
    ...parsed
  };
}

function heuristicAnalysis(evidence) {
  const liveEvents = evidence.recentEvents || [];
  const treatmentFailures = liveEvents.filter((event) => event.bucket === "treatment" && event.statusCode >= 500);
  const controlFailures = liveEvents.filter((event) => event.bucket === "control" && event.statusCode >= 500);
  const reasons = evidence.regression?.reasons || [];
  const shouldRollback = reasons.length > 0 || treatmentFailures.length > controlFailures.length;

  return {
    model: "local-heuristic",
    generatedAt: new Date().toISOString(),
    source: "local",
    recommendation: shouldRollback ? "rollback" : "continue_monitoring",
    confidence: liveEvents.length ? "medium" : "low",
    suspectedCause: evidence.trace?.failureReason || "Not enough live evidence to identify a cause.",
    summary: shouldRollback
      ? "Treatment traffic is showing worse health than control. Rollback is recommended unless this is expected test behavior."
      : "Live evidence does not currently justify rollback. Continue monitoring.",
    evidence: [
      ...reasons,
      `${treatmentFailures.length} recent treatment failures vs ${controlFailures.length} recent control failures`,
      evidence.trace?.failureReason ? `Trace evidence: ${evidence.trace.failureReason}` : "No trace evidence available"
    ],
    risks: [
      "Local heuristic is not a substitute for production incident review.",
      "Seeded demo evidence may not represent current live traffic."
    ],
    nextSteps: shouldRollback
      ? ["Rollback treatment to 0%.", "Inspect failed treatment traces.", "Check downstream feature-store behavior."]
      : ["Generate more target-app traffic.", "Watch p95 latency and error deltas.", "Avoid increasing rollout until enough live data exists."]
  };
}

function extractResponseText(payload) {
  if (payload.output_text) return payload.output_text;

  return (payload.output || [])
    .flatMap((item) => item.content || [])
    .filter((content) => content.type === "output_text" || content.type === "text")
    .map((content) => content.text)
    .join("\n");
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error("AI response did not contain parseable JSON");
  }
}
