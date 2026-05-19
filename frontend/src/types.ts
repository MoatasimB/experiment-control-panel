export type Status = "healthy" | "degraded" | "paused" | "rolled_back";

export type Experiment = {
  id: string;
  name: string;
  serviceId: string;
  owner: string;
  status: Status;
  description: string;
  rolloutPercentage: number;
  previousRolloutPercentage: number;
  targeting: {
    regions: string[];
    segments: string[];
    services: string[];
  };
  variants: Array<{
    id: string;
    name: string;
    weight: number;
  }>;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type MetricWindow = {
  experimentId: string;
  bucket: "control" | "treatment";
  source?: "seed" | "live";
  time: string;
  p50: number;
  p95: number;
  errorRate: number;
  conversion: number;
  completion: number;
};

export type MetricSeriesPoint = {
  time: string;
  source?: "seed" | "live";
  controlP95?: number;
  treatmentP95?: number;
  controlErrors?: number;
  treatmentErrors?: number;
  controlConversion?: number;
  treatmentConversion?: number;
};

export type MetricsSummary = {
  latest: {
    control: MetricWindow | null;
    treatment: MetricWindow | null;
  };
  deltas: {
    p95Percent: number;
    errorRatePoints: number;
    conversionPercent: number;
    completionPercent: number;
  };
  series: MetricSeriesPoint[];
};

export type Regression = {
  unhealthy: boolean;
  reasons: string[];
  summary: MetricsSummary;
};

export type Incident = {
  id: string;
  experimentId: string;
  title: string;
  severity: string;
  status: string;
  openedAt: string;
  summary: string;
  recommendedAction: string;
  timeline: Array<{
    time: string;
    type: string;
    text: string;
  }>;
};

export type Trace = {
  id: string;
  experimentId: string;
  bucket: string;
  userId: string;
  status: string;
  durationMs: number;
  failureReason: string;
  spans: Array<{
    service: string;
    operation: string;
    durationMs: number;
    status: string;
  }>;
};

export type AuditEvent = {
  id: string;
  time: string;
  actor: string;
  action: string;
  experimentId: string;
  from: string;
  to: string;
};

export type DemoPayload = {
  experiment: Experiment;
  metrics: MetricsSummary;
  regression: Regression;
  incidents: Incident[];
  trace: Trace;
  audit: AuditEvent[];
};

export type Assignment = {
  experimentId: string;
  userId: string;
  bucketNumber: number;
  included: boolean;
  variant: "control" | "treatment";
};
