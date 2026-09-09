// Story 17.3 (ADR-0131 §1/§2/§5, BRD-0131, FDD-0131 §5.1/§7.3) — crisis
// baseline calibration and escalation-rule configuration storage.

import { Pool } from 'pg';
import { getAdminPool } from '../db/adminPool';
import { withTenant } from '../db/withTenant';
import { getPool } from '../db/pool';

export type CrisisMetricType = 'mention_velocity' | 'negative_sentiment_ratio';

export interface CrisisBaselineMetricRow {
  id: string;
  tenant_id: string;
  watchlist_id: string;
  metric_type: CrisisMetricType;
  day_of_week: number;
  hour_of_day: number;
  mean_14d: string;
  stddev_14d: string;
  sample_count: number;
  last_calibrated_at: Date;
}

export interface CrisisDeliveryConfig {
  channel: string;
  webhookUrls?: string[];
  secret?: string | null;
  vendor?: string;
  recipients?: string[];
}

export interface CrisisEscalationRuleRow {
  id: string;
  tenant_id: string;
  watchlist_id: string | null;
  tier1_z_threshold: string;
  tier2_z_threshold: string;
  tier3_z_threshold: string;
  negative_sentiment_floor_pct: string;
  ack_timeout_minutes: number;
  tier1_delivery: CrisisDeliveryConfig;
  tier2_delivery: CrisisDeliveryConfig;
  tier3_delivery: CrisisDeliveryConfig;
  is_active: boolean;
  created_by_user_id: string;
}

export interface CreateEscalationRuleInput {
  watchlistId?: string | null;
  tier1ZThreshold?: number;
  tier2ZThreshold?: number;
  tier3ZThreshold?: number;
  negativeSentimentFloorPct?: number;
  ackTimeoutMinutes?: number;
  tier1Delivery?: CrisisDeliveryConfig;
  tier2Delivery?: CrisisDeliveryConfig;
  tier3Delivery?: CrisisDeliveryConfig;
}

/**
 * Creates a crisis_escalation_rules row for a tenant (per-watchlist, or a
 * tenant-wide default when watchlistId is omitted). No dedicated CRUD
 * endpoint exists for this in Story 17.3 — its own Acceptance Criteria and
 * FDD-0131 §5 name only the calibration worker, evaluation engine,
 * escalation engine, and the two incident lifecycle endpoints; a
 * configuration UI/API is an explicit, named, not-yet-numbered follow-on
 * (BRD-0131 §4.2).
 */
export async function createEscalationRule(
  tenantId: string,
  userId: string,
  input: CreateEscalationRuleInput
): Promise<CrisisEscalationRuleRow> {
  return withTenant<CrisisEscalationRuleRow>(
    tenantId,
    async (client) => {
      const { rows } = await client.query(
        `INSERT INTO crisis_escalation_rules (
           tenant_id, watchlist_id, tier1_z_threshold, tier2_z_threshold, tier3_z_threshold,
           negative_sentiment_floor_pct, ack_timeout_minutes,
           tier1_delivery, tier2_delivery, tier3_delivery, created_by_user_id
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING *`,
        [
          tenantId,
          input.watchlistId ?? null,
          input.tier1ZThreshold ?? 2.0,
          input.tier2ZThreshold ?? 3.0,
          input.tier3ZThreshold ?? 4.5,
          input.negativeSentimentFloorPct ?? 40,
          input.ackTimeoutMinutes ?? 15,
          JSON.stringify(input.tier1Delivery ?? { channel: 'webhook', webhookUrls: [], secret: null }),
          JSON.stringify(input.tier2Delivery ?? { channel: 'intent_only', vendor: 'pagerduty_or_sms', recipients: [] }),
          JSON.stringify(input.tier3Delivery ?? { channel: 'intent_only', vendor: 'executive_phone_broadcast', recipients: [] }),
          userId,
        ]
      );
      return rows[0] as CrisisEscalationRuleRow;
    },
    getPool(),
    userId
  );
}

/**
 * Resolves the effective escalation rule for a watchlist: a rule scoped
 * directly to it, falling back to the tenant-wide default
 * (watchlist_id IS NULL) if no watchlist-specific row exists.
 */
export async function getEscalationRuleForWatchlist(
  tenantId: string,
  userId: string,
  watchlistId: string
): Promise<CrisisEscalationRuleRow | null> {
  return withTenant<CrisisEscalationRuleRow | null>(
    tenantId,
    async (client) => {
      const { rows } = await client.query(
        `SELECT * FROM crisis_escalation_rules
         WHERE tenant_id = $1 AND is_active = true AND (watchlist_id = $2 OR watchlist_id IS NULL)
         ORDER BY watchlist_id NULLS LAST
         LIMIT 1`,
        [tenantId, watchlistId]
      );
      return (rows[0] as CrisisEscalationRuleRow) || null;
    },
    getPool(),
    userId
  );
}

/**
 * Rolling 14-day baseline calibration for one watchlist (ADR-0131 §5,
 * FDD-0131 §5.1). Reads hourly mention counts and negative-sentiment ratios
 * from post_watchlist_matches/social_posts (the same join
 * dailyAggregatesWorker.ts uses for watchlist_daily_counts, but bucketed by
 * hour-of-day/day-of-week rather than by calendar date, since no
 * precomputed view carries that granularity) and upserts both metric_type
 * buckets in a single statement. Uses getAdminPool() (RLS bypass) the same
 * way dailyAggregatesWorker.ts does for its own cross-tenant rollups, with
 * tenant_id/watchlist_id as explicit query predicates rather than relying
 * on RLS for isolation here.
 */
export async function calibrateWatchlistBaselines(
  tenantId: string,
  watchlistId: string,
  pool: Pool = getAdminPool()
): Promise<CrisisBaselineMetricRow[]> {
  const { rows } = await pool.query<CrisisBaselineMetricRow>(
    `INSERT INTO crisis_baseline_metrics (
       tenant_id, watchlist_id, metric_type, day_of_week, hour_of_day,
       mean_14d, stddev_14d, sample_count, last_calibrated_at
     )
     WITH hourly AS (
       SELECT
         EXTRACT(DOW FROM sp.published_at)::smallint AS day_of_week,
         EXTRACT(HOUR FROM sp.published_at)::smallint AS hour_of_day,
         COUNT(*)::numeric AS mention_count,
         COUNT(*) FILTER (WHERE sp.enrichment->>'sentiment' = 'negative')::numeric AS negative_count
       FROM post_watchlist_matches pwm
       JOIN social_posts sp ON sp.id = pwm.post_id
       WHERE pwm.watchlist_id = $1
         AND sp.tenant_id = $2
         AND sp.published_at IS NOT NULL
         AND sp.published_at >= now() - interval '14 days'
       GROUP BY date_trunc('hour', sp.published_at), 1, 2
     ),
     velocity AS (
       SELECT day_of_week, hour_of_day,
         AVG(mention_count) AS mean_val,
         COALESCE(STDDEV_POP(mention_count), 0) AS stddev_val,
         COUNT(*)::int AS sample_count
       FROM hourly
       GROUP BY day_of_week, hour_of_day
     ),
     sentiment AS (
       SELECT day_of_week, hour_of_day,
         AVG(CASE WHEN mention_count > 0 THEN negative_count / mention_count ELSE 0 END) AS mean_val,
         COALESCE(STDDEV_POP(CASE WHEN mention_count > 0 THEN negative_count / mention_count ELSE 0 END), 0) AS stddev_val,
         COUNT(*)::int AS sample_count
       FROM hourly
       GROUP BY day_of_week, hour_of_day
     )
     SELECT $2::uuid, $1::uuid, 'mention_velocity', day_of_week, hour_of_day, mean_val, stddev_val, sample_count, now()
     FROM velocity
     UNION ALL
     SELECT $2::uuid, $1::uuid, 'negative_sentiment_ratio', day_of_week, hour_of_day, mean_val, stddev_val, sample_count, now()
     FROM sentiment
     ON CONFLICT (watchlist_id, metric_type, day_of_week, hour_of_day)
     DO UPDATE SET
       mean_14d = EXCLUDED.mean_14d,
       stddev_14d = EXCLUDED.stddev_14d,
       sample_count = EXCLUDED.sample_count,
       last_calibrated_at = now()
     RETURNING *`,
    [watchlistId, tenantId]
  );
  return rows;
}

/**
 * Looks up the calibrated bucket for the current (day_of_week, hour_of_day)
 * observation, if one exists (ADR-0131 §6 step 1).
 */
export async function getBaselineBucket(
  tenantId: string,
  watchlistId: string,
  metricType: CrisisMetricType,
  dayOfWeek: number,
  hourOfDay: number,
  pool: Pool = getAdminPool()
): Promise<CrisisBaselineMetricRow | null> {
  const { rows } = await pool.query<CrisisBaselineMetricRow>(
    `SELECT * FROM crisis_baseline_metrics
     WHERE tenant_id = $1 AND watchlist_id = $2 AND metric_type = $3 AND day_of_week = $4 AND hour_of_day = $5`,
    [tenantId, watchlistId, metricType, dayOfWeek, hourOfDay]
  );
  return rows[0] || null;
}
