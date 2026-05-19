import type { AiAnalysis, Assignment, DemoPayload, Experiment, Incident } from "./types";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    headers: { "content-type": "application/json" },
    ...options
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(body.error || response.statusText);
  }

  return response.json() as Promise<T>;
}

export const api = {
  demo: () => request<DemoPayload>("/demo"),
  experiments: () => request<Experiment[]>("/experiments"),
  assignUser: (experimentId: string, userId: string) => request<Assignment>("/assignments", {
    method: "POST",
    body: JSON.stringify({ experimentId, userId })
  }),
  updateRollout: (experimentId: string, rolloutPercentage: number, actor: string) => request<Experiment>(
    `/experiments/${experimentId}/rollout`,
    {
      method: "PATCH",
      body: JSON.stringify({ rolloutPercentage, actor })
    }
  ),
  rollback: (incidentId: string, actor: string) => request<{ incident: Incident; experiment: Experiment }>(`/incidents/${incidentId}/rollback`, {
    method: "POST",
    body: JSON.stringify({ actor })
  }),
  analyzeIncident: (incidentId: string) => request<AiAnalysis>(`/incidents/${incidentId}/ai-analysis`, {
    method: "POST",
    body: JSON.stringify({})
  })
};
