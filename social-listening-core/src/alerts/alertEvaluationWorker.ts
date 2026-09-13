// Story 15.1 (ADR-0123, BRD-0123, FDD-0123, TDS-0123) — Alert Evaluation Worker & Preview Simulation Engine
// Implements independent noise exclusions, rolling 24h daily cap enforcement, dual throttling, and pre-save volume simulation

import { Pool } from 'pg';
import { getAdminPool } from '../db/adminPool';
import { AlertRule, TenantAlert, triggerAlert } from './alertRulesStore';

export type SensitivityPreset = 'fewer' | 'balanced' | 'more';

export interface AlertRuleRefinements {
  excludedWatchlistIds: string[];
  excludedTopicIds: string[];
  maxAlertsPerDay: number;
}

export interface AlertRulePreviewRequest {
  type: string;
  watchlistId?: string;
  threshold?: Record<string, any>;
  excludedWatchlistIds?: string[];
  excludedTopicIds?: string[];
  lookbackDays?: number;
  sensitivity?: SensitivityPreset;
}

export interface AlertRulePreviewResponse {
  estimatedAlertCount: number;
  lookbackDays: number;
  sensitivity?: SensitivityPreset;
}

export interface SocialPostEvaluationContext {
  id?: string;
  tenantId: string;
  matchedWatchlistIds?: string[];
  topics?: string[];
  sentiment?: string;
  body?: string;
}

export type EvaluationResult =
  | { status: 'fired'; alert: TenantAlert }
  | { status: 'excluded'; reason: 'MATCHED_EXCLUDED_WATCHLIST' | 'MATCHED_EXCLUDED_TOPIC' }
  | { status: 'suppressed'; reason: 'DAILY_CAP_EXCEEDED' | 'COOLDOWN_ACTIVE' }
  | { status: 'ignored'; reason?: string };

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Computes rolling 24-hour alert count for a rule under a tenant.
 */
export async function getRolling24hAlertCount(
  tenantId: string,
  ruleId: string,
  pool: Pool = getAdminPool()
): Promise<number> {
  const { rows } = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::int AS count
     FROM tenant_alerts
     WHERE tenant_id = $1 AND alert_rule_id = $2 AND created_at >= now() - interval '24 hours'`,
    [tenantId, ruleId]
  );
  return parseInt(rows[0]?.count ?? '0', 10);
}

function isThresholdCrossed(rule: AlertRule, post: SocialPostEvaluationContext): boolean {
  const thresholds = rule.thresholds || {};
  if (rule.type === 'influential_post') {
    const minFollowers = Number(thresholds.min_followers ?? thresholds.minFollowers ?? 10000);
    return ((post as any).followerCount || 0) >= minFollowers;
  }
  if (rule.type === 'negative_sentiment_spike') {
    return post.sentiment === 'negative';
  }
  // Volume spike or keyword burst rules require windowed aggregations, not satisfied by a single post alone
  return false;
}

/**
 * Evaluates a rule against an incoming enriched social post adhering to the
 * strict Order of Evaluation Invariant (TDS-0123 §2.2 / ADR-0123 §1):
 * 1. Noise Exclusion (Watchlists and Topics evaluate independently)
 * 2. Rolling Daily Cap Enforcement (max_alerts_per_day)
 * 3. Cooldown Verification (cooldown_minutes)
 * 4. Threshold Evaluation
 * 5. Fire & Record
 */
export async function evaluateRuleForPost(
  rule: AlertRule,
  post: SocialPostEvaluationContext,
  pool: Pool = getAdminPool()
): Promise<EvaluationResult> {
  const excludedWatchlists = rule.excluded_watchlist_ids || [];
  const excludedTopics = rule.excluded_topic_ids || [];

  // 1. Noise Exclusion Check — Watchlists and Topics are independent disjunctive filters
  if (
    excludedWatchlists.length > 0 &&
    post.matchedWatchlistIds &&
    post.matchedWatchlistIds.some((id) => excludedWatchlists.includes(id))
  ) {
    return { status: 'excluded', reason: 'MATCHED_EXCLUDED_WATCHLIST' };
  }

  if (
    excludedTopics.length > 0 &&
    post.topics &&
    post.topics.some((topic) => excludedTopics.includes(topic))
  ) {
    return { status: 'excluded', reason: 'MATCHED_EXCLUDED_TOPIC' };
  }

  // 2. Rolling Daily Cap Enforcement
  const rollingCap = rule.max_alerts_per_day ?? 20;
  const currentCount = await getRolling24hAlertCount(rule.tenant_id, rule.id, pool);
  if (currentCount >= rollingCap) {
    return { status: 'suppressed', reason: 'DAILY_CAP_EXCEEDED' };
  }

  // 3. Cooldown Verification
  if (rule.last_triggered_at && rule.cooldown_minutes > 0) {
    const elapsedMinutes = (Date.now() - new Date(rule.last_triggered_at).getTime()) / 60000;
    if (elapsedMinutes < rule.cooldown_minutes) {
      return { status: 'suppressed', reason: 'COOLDOWN_ACTIVE' };
    }
  }

  // 4. Threshold Evaluation
  if (!isThresholdCrossed(rule, post)) {
    return { status: 'ignored', reason: 'THRESHOLD_NOT_MET' };
  }

  // 5. Fire & Record
  const alert = await triggerAlert(
    rule.tenant_id,
    rule.id,
    'warning',
    `Threshold reached for alert rule: ${rule.name}`,
    { postId: post.id },
    { matchedWatchlistIds: post.matchedWatchlistIds, topicIds: post.topics }
  );

  if (!alert) {
    return { status: 'ignored', reason: 'NOT_TRIGGERED_OR_SUPPRESSED' };
  }

  return { status: 'fired', alert };
}

/**
 * Pre-Save Alert Volume Preview Simulation Engine (ADR-0123 §4 / TDS-0123 §4.2).
 * Strictly read-only; never mutates alert_rules or tenant_alerts.
 */
export async function simulateAlertRulePreview(
  tenantId: string,
  req: AlertRulePreviewRequest,
  pool: Pool = getAdminPool()
): Promise<AlertRulePreviewResponse> {
  const lookbackDays = req.lookbackDays ?? (req as any).lookback_days ?? 7;

  // Validation: lookbackDays bounds [1, 30]
  if (
    typeof lookbackDays !== 'number' ||
    !Number.isInteger(lookbackDays) ||
    lookbackDays < 1 ||
    lookbackDays > 30
  ) {
    throw new Error('INVALID_LOOKBACK_WINDOW: lookbackDays must be an integer between 1 and 30.');
  }

  // Validation: excludedWatchlistIds UUID formatting
  const excludedWatchlists = req.excludedWatchlistIds ?? (req as any).excluded_watchlist_ids;
  if (excludedWatchlists && Array.isArray(excludedWatchlists)) {
    for (const id of excludedWatchlists) {
      if (!UUID_REGEX.test(id)) {
        throw new Error(`INVALID_EXCLUSION_ID: Invalid watchlist UUID: ${id}`);
      }
    }
  }

  const watchlistId = req.watchlistId ?? (req as any).watchlist_id ?? null;
  if (watchlistId && excludedWatchlists && excludedWatchlists.includes(watchlistId)) {
    return {
      estimatedAlertCount: 0,
      lookbackDays,
      sensitivity: req.sensitivity ?? 'balanced',
    };
  }

  const threshold = req.threshold ?? (req as any).thresholds ?? {};
  const minPosts = Number(threshold.min_posts ?? threshold.minPosts ?? 50);

  // Query historical precomputed daily views (ADR-0087)
  const { rows } = await pool.query<{ date: string; watchlist_id: string; post_count: number; negative_count: number }>(
    `SELECT date, watchlist_id, post_count, COALESCE(negative_count, 0) as negative_count
     FROM watchlist_daily_counts
     WHERE tenant_id = $1
       AND ($2::uuid IS NULL OR watchlist_id = $2::uuid)
       AND date >= CURRENT_DATE - ($3::int || ' days')::interval
     ORDER BY date ASC`,
    [tenantId, watchlistId, lookbackDays]
  );

  let simulatedAlertCount = 0;
  for (const row of rows) {
    if (excludedWatchlists && excludedWatchlists.includes(row.watchlist_id)) {
      continue;
    }
    if (req.type === 'negative_sentiment_spike') {
      const spikePct = Number(threshold.spike_pct ?? threshold.spikePct ?? 50);
      const negPct = row.post_count > 0 ? (row.negative_count / row.post_count) * 100 : 0;
      if (negPct >= spikePct) {
        simulatedAlertCount++;
      }
    } else {
      // Default: volume_spike
      if (row.post_count >= minPosts) {
        simulatedAlertCount++;
      }
    }
  }

  return {
    estimatedAlertCount: simulatedAlertCount,
    lookbackDays,
    sensitivity: req.sensitivity ?? 'balanced',
  };
}
