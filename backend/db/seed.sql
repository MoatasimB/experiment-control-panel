INSERT INTO services (id, name, owner) VALUES
  ('search-api', 'Search API', 'Discovery Platform'),
  ('ranker', 'Ranking Service', 'ML Ranking'),
  ('feature-store', 'Feature Store', 'Data Platform'),
  ('ads-mixer', 'Ads Mixer', 'Monetization'),
  ('checkout-api', 'Checkout API', 'Commerce Platform')
ON CONFLICT (id) DO NOTHING;

INSERT INTO experiments (
  id,
  name,
  service_id,
  owner,
  status,
  description,
  rollout_percentage,
  previous_rollout_percentage,
  targeting,
  created_by,
  created_at,
  updated_at
) VALUES
  (
    'ranking-v2',
    'Search Ranking V2',
    'search-api',
    'Discovery Platform',
    'degraded',
    'New ranking model for NYC query traffic with staged treatment rollout.',
    50,
    10,
    '{"regions":["NYC"],"segments":["signed_in","high_intent"],"services":["search-api","ranker"]}'::jsonb,
    'maya@company.com',
    '2026-05-12T14:00:00.000Z',
    '2026-05-16T13:25:00.000Z'
  ),
  (
    'checkout-hints',
    'Checkout Intent Hints',
    'checkout-api',
    'Commerce UX',
    'healthy',
    'Inline helper copy for checkout completion.',
    25,
    10,
    '{"regions":["US"],"segments":["signed_in"],"services":["checkout-api"]}'::jsonb,
    'leo@company.com',
    '2026-05-08T17:00:00.000Z',
    '2026-05-15T19:30:00.000Z'
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO variants (experiment_id, id, name, weight) VALUES
  ('ranking-v2', 'control', 'Control', 50),
  ('ranking-v2', 'treatment', 'Ranking V2', 50),
  ('checkout-hints', 'control', 'Control', 75),
  ('checkout-hints', 'treatment', 'Hints', 25)
ON CONFLICT (experiment_id, id) DO NOTHING;

INSERT INTO metric_windows (
  experiment_id,
  bucket,
  window_label,
  p50_ms,
  p95_ms,
  error_rate,
  conversion,
  completion
) VALUES
  ('ranking-v2', 'control', '09:00', 74, 210, 0.7, 6.8, 82),
  ('ranking-v2', 'treatment', '09:00', 78, 218, 0.8, 7.1, 83),
  ('ranking-v2', 'control', '10:00', 75, 214, 0.7, 6.9, 82),
  ('ranking-v2', 'treatment', '10:00', 82, 226, 0.9, 7.2, 83),
  ('ranking-v2', 'control', '11:00', 76, 219, 0.8, 6.8, 81),
  ('ranking-v2', 'treatment', '11:00', 94, 310, 1.9, 6.7, 78),
  ('ranking-v2', 'control', '12:00', 78, 225, 0.8, 6.9, 81),
  ('ranking-v2', 'treatment', '12:00', 132, 520, 4.6, 5.9, 70),
  ('ranking-v2', 'control', '13:00', 77, 221, 0.8, 6.7, 82),
  ('ranking-v2', 'treatment', '13:00', 141, 610, 5.2, 5.4, 66),
  ('checkout-hints', 'control', '13:00', 93, 260, 0.6, 11.4, 88),
  ('checkout-hints', 'treatment', '13:00', 95, 268, 0.6, 12.1, 89)
ON CONFLICT (experiment_id, bucket, window_label) DO NOTHING;

INSERT INTO incidents (
  id,
  experiment_id,
  title,
  severity,
  status,
  opened_at,
  summary,
  recommended_action
) VALUES (
  'inc-1042',
  'ranking-v2',
  'Treatment p95 latency and errors spiked after 50% rollout',
  'SEV2',
  'open',
  '2026-05-16T13:31:00.000Z',
  'The regression detector found a 176% p95 latency increase and elevated errors for treatment traffic.',
  'Rollback ranking-v2 to 0% and investigate feature-store timeout amplification.'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO incident_timeline_events (incident_id, event_time_label, event_type, event_text, sort_order) VALUES
  ('inc-1042', '12:04', 'rollout', 'Rollout increased from 10% to 50% for NYC signed-in traffic.', 1),
  ('inc-1042', '12:17', 'metric', 'Treatment p95 crossed 500ms while control remained near 225ms.', 2),
  ('inc-1042', '12:22', 'alert', 'Regression detector opened SEV2 incident for latency and error deltas.', 3),
  ('inc-1042', '12:29', 'trace', 'Trace trc-8f4a showed feature-store timeout retries from ranker.', 4)
ON CONFLICT DO NOTHING;

INSERT INTO traces (
  id,
  experiment_id,
  bucket,
  user_id,
  status,
  duration_ms,
  failure_reason
) VALUES (
  'trc-8f4a',
  'ranking-v2',
  'treatment',
  'user-90210',
  'failed',
  1240,
  'feature-store timed out after retry budget was exhausted'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO trace_spans (trace_id, service, operation, duration_ms, status, sort_order) VALUES
  ('trc-8f4a', 'search-api', 'GET /search', 1240, 'error', 1),
  ('trc-8f4a', 'ranker', 'scoreCandidates', 1110, 'error', 2),
  ('trc-8f4a', 'feature-store', 'batchFetchFeatures', 980, 'timeout', 3),
  ('trc-8f4a', 'ads-mixer', 'blendResults', 44, 'ok', 4)
ON CONFLICT DO NOTHING;

INSERT INTO audit_events (
  id,
  event_time,
  actor,
  action,
  experiment_id,
  from_value,
  to_value
) VALUES
  ('aud-1', '2026-05-16T12:04:00.000Z', 'maya@company.com', 'rollout.updated', 'ranking-v2', '10%', '50%'),
  ('aud-2', '2026-05-16T12:22:00.000Z', 'detector@system', 'incident.opened', 'ranking-v2', 'healthy', 'degraded')
ON CONFLICT (id) DO NOTHING;

INSERT INTO cloud_run_revisions (
  experiment_id,
  service_name,
  region,
  revision_name,
  git_sha,
  traffic_percentage,
  is_stable,
  deployed_at
) VALUES
  ('ranking-v2', 'search-api', 'us-east1', 'search-api-00017-stable', '8d1a2cb', 50, true, '2026-05-16T11:30:00.000Z'),
  ('ranking-v2', 'search-api', 'us-east1', 'search-api-00018-ranking-v2', 'c0ffee7', 50, false, '2026-05-16T12:04:00.000Z')
ON CONFLICT (service_name, region, revision_name) DO NOTHING;
