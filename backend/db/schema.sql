CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS services (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS experiments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  service_id TEXT REFERENCES services(id),
  owner TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('healthy', 'degraded', 'paused', 'rolled_back')),
  description TEXT NOT NULL,
  rollout_percentage INTEGER NOT NULL CHECK (rollout_percentage BETWEEN 0 AND 100),
  previous_rollout_percentage INTEGER NOT NULL CHECK (previous_rollout_percentage BETWEEN 0 AND 100),
  targeting JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS variants (
  id TEXT NOT NULL,
  experiment_id TEXT NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  weight INTEGER NOT NULL CHECK (weight BETWEEN 0 AND 100),
  PRIMARY KEY (experiment_id, id)
);

CREATE TABLE IF NOT EXISTS metric_windows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id TEXT NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  bucket TEXT NOT NULL CHECK (bucket IN ('control', 'treatment')),
  window_label TEXT NOT NULL,
  p50_ms NUMERIC(10, 2) NOT NULL,
  p95_ms NUMERIC(10, 2) NOT NULL,
  error_rate NUMERIC(6, 3) NOT NULL,
  conversion NUMERIC(6, 3) NOT NULL,
  completion NUMERIC(6, 3) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (experiment_id, bucket, window_label)
);

CREATE TABLE IF NOT EXISTS incidents (
  id TEXT PRIMARY KEY,
  experiment_id TEXT NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  severity TEXT NOT NULL,
  status TEXT NOT NULL,
  opened_at TIMESTAMPTZ NOT NULL,
  mitigated_at TIMESTAMPTZ,
  summary TEXT NOT NULL,
  recommended_action TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS incident_timeline_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id TEXT NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  event_time_label TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_text TEXT NOT NULL,
  sort_order INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS traces (
  id TEXT PRIMARY KEY,
  experiment_id TEXT NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  bucket TEXT NOT NULL CHECK (bucket IN ('control', 'treatment')),
  user_id TEXT NOT NULL,
  status TEXT NOT NULL,
  duration_ms INTEGER NOT NULL,
  failure_reason TEXT
);

CREATE TABLE IF NOT EXISTS trace_spans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trace_id TEXT NOT NULL REFERENCES traces(id) ON DELETE CASCADE,
  service TEXT NOT NULL,
  operation TEXT NOT NULL,
  duration_ms INTEGER NOT NULL,
  status TEXT NOT NULL,
  sort_order INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  event_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  experiment_id TEXT REFERENCES experiments(id) ON DELETE SET NULL,
  from_value TEXT NOT NULL,
  to_value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cloud_run_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id TEXT REFERENCES experiments(id) ON DELETE CASCADE,
  service_name TEXT NOT NULL,
  region TEXT NOT NULL,
  revision_name TEXT NOT NULL,
  git_sha TEXT,
  traffic_percentage INTEGER NOT NULL CHECK (traffic_percentage BETWEEN 0 AND 100),
  is_stable BOOLEAN NOT NULL DEFAULT false,
  deployed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (service_name, region, revision_name)
);

CREATE INDEX IF NOT EXISTS idx_metric_windows_experiment_bucket ON metric_windows(experiment_id, bucket);
CREATE INDEX IF NOT EXISTS idx_audit_events_experiment_time ON audit_events(experiment_id, event_time DESC);
CREATE INDEX IF NOT EXISTS idx_incident_timeline_incident_order ON incident_timeline_events(incident_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_trace_spans_trace_order ON trace_spans(trace_id, sort_order);
