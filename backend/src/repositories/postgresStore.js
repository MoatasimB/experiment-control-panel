export class PostgresStore {
  constructor(pool) {
    this.pool = pool;
  }

  async listExperiments() {
    const { rows } = await this.pool.query(`
      SELECT
        e.*,
        COALESCE(
          json_agg(
            json_build_object('id', v.id, 'name', v.name, 'weight', v.weight)
            ORDER BY v.id
          ) FILTER (WHERE v.id IS NOT NULL),
          '[]'
        ) AS variants
      FROM experiments e
      LEFT JOIN variants v ON v.experiment_id = e.id
      GROUP BY e.id
      ORDER BY e.updated_at DESC
    `);
    return rows.map(mapExperiment);
  }

  async getExperiment(id) {
    const { rows } = await this.pool.query(`
      SELECT
        e.*,
        COALESCE(
          json_agg(
            json_build_object('id', v.id, 'name', v.name, 'weight', v.weight)
            ORDER BY v.id
          ) FILTER (WHERE v.id IS NOT NULL),
          '[]'
        ) AS variants
      FROM experiments e
      LEFT JOIN variants v ON v.experiment_id = e.id
      WHERE e.id = $1
      GROUP BY e.id
    `, [id]);
    return rows[0] ? mapExperiment(rows[0]) : null;
  }

  async updateExperiment(id, patch) {
    const updates = [];
    const values = [];
    const columns = {
      previousRolloutPercentage: "previous_rollout_percentage",
      rolloutPercentage: "rollout_percentage",
      status: "status"
    };

    for (const [key, column] of Object.entries(columns)) {
      if (patch[key] !== undefined) {
        values.push(patch[key]);
        updates.push(`${column} = $${values.length}`);
      }
    }

    if (updates.length) {
      values.push(id);
      await this.pool.query(`
        UPDATE experiments
        SET ${updates.join(", ")}, updated_at = now()
        WHERE id = $${values.length}
      `, values);
    }

    return this.getExperiment(id);
  }

  async addMetricEvent(event) {
    if (event.durationMs !== undefined) {
      await this.addRawMetricEvent(event);
      await this.refreshMetricWindow(event.experimentId, event.bucket);
      return event;
    }

    await this.pool.query(`
      INSERT INTO metric_windows (
        experiment_id,
        bucket,
        window_label,
        p50_ms,
        p95_ms,
        error_rate,
        conversion,
        completion
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (experiment_id, bucket, window_label)
      DO UPDATE SET
        p50_ms = EXCLUDED.p50_ms,
        p95_ms = EXCLUDED.p95_ms,
        error_rate = EXCLUDED.error_rate,
        conversion = EXCLUDED.conversion,
        completion = EXCLUDED.completion
    `, [
      event.experimentId,
      event.bucket,
      event.time,
      event.p50,
      event.p95,
      event.errorRate,
      event.conversion,
      event.completion
    ]);

    return event;
  }

  async addRawMetricEvent(event) {
    await this.pool.query(`
      INSERT INTO metric_events (
        experiment_id,
        bucket,
        user_id,
        service,
        route,
        status_code,
        duration_ms,
        conversion,
        completion,
        trace_id,
        release_sha
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `, [
      event.experimentId,
      event.bucket,
      event.userId,
      event.service || "target-search",
      event.route || "/search",
      event.statusCode,
      event.durationMs,
      Boolean(event.conversion),
      event.completion !== false,
      event.traceId,
      event.releaseSha
    ]);
  }

  async refreshMetricWindow(experimentId, bucket) {
    const { rows } = await this.pool.query(`
      WITH recent AS (
        SELECT *
        FROM metric_events
        WHERE experiment_id = $1
          AND bucket = $2
          AND created_at >= now() - interval '5 minutes'
      ),
      aggregate AS (
        SELECT
          COUNT(*)::numeric AS total,
          percentile_cont(0.5) WITHIN GROUP (ORDER BY duration_ms) AS p50_ms,
          percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms) AS p95_ms,
          (COUNT(*) FILTER (WHERE status_code >= 500)::numeric / NULLIF(COUNT(*), 0)) * 100 AS error_rate,
          (COUNT(*) FILTER (WHERE conversion)::numeric / NULLIF(COUNT(*), 0)) * 100 AS conversion,
          (COUNT(*) FILTER (WHERE completion)::numeric / NULLIF(COUNT(*), 0)) * 100 AS completion
        FROM recent
      )
      SELECT *
      FROM aggregate
      WHERE total > 0
    `, [experimentId, bucket]);

    if (!rows[0]) return;

    const windowLabel = new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "America/New_York"
    }).format(new Date());

    await this.pool.query(`
      INSERT INTO metric_windows (
        experiment_id,
        bucket,
        window_label,
        p50_ms,
        p95_ms,
        error_rate,
        conversion,
        completion
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (experiment_id, bucket, window_label)
      DO UPDATE SET
        p50_ms = EXCLUDED.p50_ms,
        p95_ms = EXCLUDED.p95_ms,
        error_rate = EXCLUDED.error_rate,
        conversion = EXCLUDED.conversion,
        completion = EXCLUDED.completion
    `, [
      experimentId,
      bucket,
      windowLabel,
      rows[0].p50_ms,
      rows[0].p95_ms,
      rows[0].error_rate,
      rows[0].conversion,
      rows[0].completion
    ]);
  }

  async metricsFor(experimentId) {
    const { rows } = await this.pool.query(`
      SELECT *
      FROM metric_windows
      WHERE experiment_id = $1
      ORDER BY window_label ASC
    `, [experimentId]);
    const windows = rows.map(mapMetricWindow);

    if (!windows.length) return windows;

    const live = await this.pool.query(`
      SELECT
        bucket,
        to_char(created_at AT TIME ZONE 'America/New_York', 'HH24:MI') AS window_label
      FROM metric_events
      WHERE experiment_id = $1
      GROUP BY bucket, window_label
    `, [experimentId]);

    const liveKeys = new Set(live.rows.map((row) => `${row.bucket}:${row.window_label}`));
    return windows.map((window) => ({
      ...window,
      source: liveKeys.has(`${window.bucket}:${window.time}`) ? "live" : "seed"
    }));
  }

  async listIncidents() {
    const { rows } = await this.pool.query(`
      SELECT *
      FROM incidents
      ORDER BY opened_at DESC
    `);

    return Promise.all(rows.map((row) => this.mapIncidentWithTimeline(row)));
  }

  async getIncident(id) {
    const { rows } = await this.pool.query("SELECT * FROM incidents WHERE id = $1", [id]);
    return rows[0] ? this.mapIncidentWithTimeline(rows[0]) : null;
  }

  async updateIncident(id, patch) {
    const updates = [];
    const values = [];

    if (patch.status !== undefined) {
      values.push(patch.status);
      updates.push(`status = $${values.length}`);
    }
    if (patch.mitigatedAt !== undefined) {
      values.push(patch.mitigatedAt);
      updates.push(`mitigated_at = $${values.length}`);
    }

    if (updates.length) {
      values.push(id);
      await this.pool.query(`UPDATE incidents SET ${updates.join(", ")} WHERE id = $${values.length}`, values);
    }

    if (Array.isArray(patch.timeline)) {
      await this.replaceTimeline(id, patch.timeline);
    }

    return this.getIncident(id);
  }

  async appendTimelineEvent(incidentId, event) {
    const { rows } = await this.pool.query(`
      SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order
      FROM incident_timeline_events
      WHERE incident_id = $1
    `, [incidentId]);

    await this.pool.query(`
      INSERT INTO incident_timeline_events (
        incident_id,
        event_time_label,
        event_type,
        event_text,
        sort_order
      ) VALUES ($1, $2, $3, $4, $5)
    `, [incidentId, event.time, event.type, event.text, rows[0].next_order]);
  }

  async getTrace(id) {
    const { rows } = await this.pool.query("SELECT * FROM traces WHERE id = $1", [id]);
    if (!rows[0]) return null;

    const spans = await this.pool.query(`
      SELECT *
      FROM trace_spans
      WHERE trace_id = $1
      ORDER BY sort_order ASC
    `, [id]);

    return {
      id: rows[0].id,
      experimentId: rows[0].experiment_id,
      bucket: rows[0].bucket,
      userId: rows[0].user_id,
      status: rows[0].status,
      durationMs: Number(rows[0].duration_ms),
      failureReason: rows[0].failure_reason,
      spans: spans.rows.map((span) => ({
        service: span.service,
        operation: span.operation,
        durationMs: Number(span.duration_ms),
        status: span.status
      }))
    };
  }

  async listAuditEvents() {
    const { rows } = await this.pool.query(`
      SELECT *
      FROM audit_events
      ORDER BY event_time DESC
    `);
    return rows.map(mapAuditEvent);
  }

  async addAuditEvent(event) {
    const { rows } = await this.pool.query("SELECT COUNT(*)::int AS count FROM audit_events");
    const id = `aud-${rows[0].count + 1}`;

    await this.pool.query(`
      INSERT INTO audit_events (
        id,
        actor,
        action,
        experiment_id,
        from_value,
        to_value
      ) VALUES ($1, $2, $3, $4, $5, $6)
    `, [id, event.actor, event.action, event.experimentId, event.from, event.to]);
  }

  async transaction(callback) {
    const client = await this.pool.connect();
    const txStore = new PostgresStore(client);

    try {
      await client.query("BEGIN");
      const result = await callback(txStore);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async mapIncidentWithTimeline(row) {
    const timeline = await this.pool.query(`
      SELECT *
      FROM incident_timeline_events
      WHERE incident_id = $1
      ORDER BY sort_order ASC
    `, [row.id]);

    return {
      id: row.id,
      experimentId: row.experiment_id,
      title: row.title,
      severity: row.severity,
      status: row.status,
      openedAt: row.opened_at.toISOString(),
      mitigatedAt: row.mitigated_at?.toISOString(),
      summary: row.summary,
      recommendedAction: row.recommended_action,
      timeline: timeline.rows.map((event) => ({
        time: event.event_time_label,
        type: event.event_type,
        text: event.event_text
      }))
    };
  }

  async replaceTimeline(incidentId, timeline) {
    await this.pool.query("DELETE FROM incident_timeline_events WHERE incident_id = $1", [incidentId]);

    for (const [index, event] of timeline.entries()) {
      await this.pool.query(`
        INSERT INTO incident_timeline_events (
          incident_id,
          event_time_label,
          event_type,
          event_text,
          sort_order
        ) VALUES ($1, $2, $3, $4, $5)
      `, [incidentId, event.time, event.type, event.text, index + 1]);
    }
  }
}

function mapExperiment(row) {
  return {
    id: row.id,
    name: row.name,
    serviceId: row.service_id,
    owner: row.owner,
    status: row.status,
    description: row.description,
    rolloutPercentage: Number(row.rollout_percentage),
    previousRolloutPercentage: Number(row.previous_rollout_percentage),
    targeting: row.targeting,
    variants: row.variants,
    createdBy: row.created_by,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  };
}

function mapMetricWindow(row) {
  return {
    experimentId: row.experiment_id,
    bucket: row.bucket,
    time: row.window_label,
    p50: Number(row.p50_ms),
    p95: Number(row.p95_ms),
    errorRate: Number(row.error_rate),
    conversion: Number(row.conversion),
    completion: Number(row.completion)
  };
}

function mapAuditEvent(row) {
  return {
    id: row.id,
    time: row.event_time.toISOString(),
    actor: row.actor,
    action: row.action,
    experimentId: row.experiment_id,
    from: row.from_value,
    to: row.to_value
  };
}
