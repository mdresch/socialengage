import { withTenant } from '../db/withTenant';
import { getPool } from '../db/pool';
import { PoolClient } from 'pg';

export interface AlertRule {
  id: string;
  tenant_id: string;
  name: string;
  type: 'volume_spike' | 'negative_sentiment_spike' | 'influential_post' | 'connector_error' | 'keyword_burst';
  thresholds: Record<string, any>;
  watchlist_id: string | null;
  platform_id: string | null;
  cooldown_minutes: number;
  last_triggered_at: string | null;
  channels: string[];
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface TenantAlert {
  id: string;
  tenant_id: string;
  alert_rule_id: string;
  triggered_at: string;
  severity: 'info' | 'warning' | 'critical';
  summary: string;
  payload: Record<string, any>;
  status: 'active' | 'acknowledged' | 'resolved' | 'snoozed';
  acknowledged_at: string | null;
  resolved_at: string | null;
  created_at: string;
}

export interface CreateAlertRuleInput {
  name: string;
  type: AlertRule['type'];
  thresholds?: Record<string, any>;
  watchlist_id?: string | null;
  platform_id?: string | null;
  cooldown_minutes?: number;
  channels?: string[];
  enabled?: boolean;
}

export interface UpdateAlertRuleInput {
  name?: string;
  type?: AlertRule['type'];
  thresholds?: Record<string, any>;
  watchlist_id?: string | null;
  platform_id?: string | null;
  cooldown_minutes?: number;
  channels?: string[];
  enabled?: boolean;
}

export async function createAlertRule(
  tenantId: string,
  userId: string,
  input: CreateAlertRuleInput
): Promise<AlertRule> {
  return withTenant<AlertRule>(
    tenantId,
    async (client: PoolClient) => {
      const { rows } = await client.query(
        `INSERT INTO alert_rules (
           tenant_id, name, type, thresholds, watchlist_id, platform_id,
           cooldown_minutes, channels, enabled, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now(), now())
         RETURNING *`,
        [
          tenantId,
          input.name.trim(),
          input.type,
          JSON.stringify(input.thresholds || {}),
          input.watchlist_id || null,
          input.platform_id || null,
          input.cooldown_minutes ?? 60,
          input.channels || ['in_app'],
          input.enabled ?? true,
        ]
      );
      return rows[0] as AlertRule;
    },
    getPool(),
    userId
  );
}

export async function listAlertRules(
  tenantId: string,
  userId: string
): Promise<AlertRule[]> {
  return withTenant<AlertRule[]>(
    tenantId,
    async (client: PoolClient) => {
      const { rows } = await client.query(
        `SELECT * FROM alert_rules WHERE tenant_id = $1 ORDER BY created_at DESC`,
        [tenantId]
      );
      return rows as AlertRule[];
    },
    getPool(),
    userId
  );
}

export async function getAlertRule(
  tenantId: string,
  userId: string,
  ruleId: string
): Promise<AlertRule | null> {
  return withTenant<AlertRule | null>(
    tenantId,
    async (client: PoolClient) => {
      const { rows } = await client.query(
        `SELECT * FROM alert_rules WHERE id = $1 AND tenant_id = $2`,
        [ruleId, tenantId]
      );
      return (rows[0] as AlertRule) || null;
    },
    getPool(),
    userId
  );
}

export async function updateAlertRule(
  tenantId: string,
  userId: string,
  ruleId: string,
  input: UpdateAlertRuleInput
): Promise<AlertRule | null> {
  return withTenant<AlertRule | null>(
    tenantId,
    async (client: PoolClient) => {
      const fields: string[] = [];
      const values: any[] = [ruleId, tenantId];
      let idx = 3;

      if (input.name !== undefined) {
        fields.push(`name = $${idx++}`);
        values.push(input.name.trim());
      }
      if (input.type !== undefined) {
        fields.push(`type = $${idx++}`);
        values.push(input.type);
      }
      if (input.thresholds !== undefined) {
        fields.push(`thresholds = $${idx++}`);
        values.push(JSON.stringify(input.thresholds));
      }
      if (input.watchlist_id !== undefined) {
        fields.push(`watchlist_id = $${idx++}`);
        values.push(input.watchlist_id);
      }
      if (input.platform_id !== undefined) {
        fields.push(`platform_id = $${idx++}`);
        values.push(input.platform_id);
      }
      if (input.cooldown_minutes !== undefined) {
        fields.push(`cooldown_minutes = $${idx++}`);
        values.push(input.cooldown_minutes);
      }
      if (input.channels !== undefined) {
        fields.push(`channels = $${idx++}`);
        values.push(input.channels);
      }
      if (input.enabled !== undefined) {
        fields.push(`enabled = $${idx++}`);
        values.push(input.enabled);
      }

      if (fields.length === 0) {
        return getAlertRule(tenantId, userId, ruleId);
      }

      fields.push(`updated_at = now()`);

      const { rows } = await client.query(
        `UPDATE alert_rules
         SET ${fields.join(', ')}
         WHERE id = $1 AND tenant_id = $2
         RETURNING *`,
        values
      );
      return (rows[0] as AlertRule) || null;
    },
    getPool(),
    userId
  );
}

export async function deleteAlertRule(
  tenantId: string,
  userId: string,
  ruleId: string
): Promise<boolean> {
  return withTenant<boolean>(
    tenantId,
    async (client: PoolClient) => {
      const { rowCount } = await client.query(
        `DELETE FROM alert_rules WHERE id = $1 AND tenant_id = $2`,
        [ruleId, tenantId]
      );
      return (rowCount ?? 0) > 0;
    },
    getPool(),
    userId
  );
}

export async function listTenantAlerts(
  tenantId: string,
  userId: string,
  options: { status?: string; limit?: number } = {}
): Promise<TenantAlert[]> {
  return withTenant<TenantAlert[]>(
    tenantId,
    async (client: PoolClient) => {
      const params: any[] = [tenantId, options.limit ?? 50];
      let query = `SELECT * FROM tenant_alerts WHERE tenant_id = $1`;
      if (options.status) {
        query += ` AND status = $3`;
        params.push(options.status);
      }
      query += ` ORDER BY triggered_at DESC LIMIT $2`;

      const { rows } = await client.query(query, params);
      return rows as TenantAlert[];
    },
    getPool(),
    userId
  );
}

export async function updateTenantAlertStatus(
  tenantId: string,
  userId: string,
  alertId: string,
  status: 'acknowledged' | 'resolved' | 'snoozed'
): Promise<TenantAlert | null> {
  return withTenant<TenantAlert | null>(
    tenantId,
    async (client: PoolClient) => {
      const isAck = status === 'acknowledged';
      const isRes = status === 'resolved';

      const { rows } = await client.query(
        `UPDATE tenant_alerts
         SET status = $1,
             acknowledged_at = CASE WHEN $2::boolean THEN now() ELSE acknowledged_at END,
             resolved_at = CASE WHEN $3::boolean THEN now() ELSE resolved_at END
         WHERE id = $4 AND tenant_id = $5
         RETURNING *`,
        [status, isAck, isRes, alertId, tenantId]
      );
      return (rows[0] as TenantAlert) || null;
    },
    getPool(),
    userId
  );
}

import { getAdminPool } from '../db/adminPool';

export async function triggerAlert(
  tenantId: string,
  ruleId: string,
  severity: 'info' | 'warning' | 'critical',
  summary: string,
  payload: Record<string, any> = {}
): Promise<TenantAlert | null> {
  const pool = getAdminPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Check cooldown
    const { rows: ruleRows } = await client.query<AlertRule>(
      `SELECT * FROM alert_rules WHERE id = $1 AND tenant_id = $2 AND enabled = true`,
      [ruleId, tenantId]
    );
    const rule = ruleRows[0];
    if (!rule) {
      await client.query('ROLLBACK');
      return null;
    }

    if (rule.last_triggered_at) {
      const elapsedMinutes = (Date.now() - new Date(rule.last_triggered_at).getTime()) / 60000;
      if (elapsedMinutes < rule.cooldown_minutes) {
        await client.query('ROLLBACK');
        return null; // Suppressed by cooldown
      }
    }

    // Insert alert
    const { rows: alertRows } = await client.query<TenantAlert>(
      `INSERT INTO tenant_alerts (
         tenant_id, alert_rule_id, severity, summary, payload, status, triggered_at, created_at
       ) VALUES ($1, $2, $3, $4, $5, 'active', now(), now())
       RETURNING *`,
      [tenantId, ruleId, severity, summary, JSON.stringify(payload)]
    );

    // Update rule last_triggered_at
    await client.query(
      `UPDATE alert_rules SET last_triggered_at = now() WHERE id = $1`,
      [ruleId]
    );

    await client.query('COMMIT');
    return alertRows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
