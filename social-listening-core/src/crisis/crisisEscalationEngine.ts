// Story 17.3 (ADR-0131 §4/§6/§7, BRD-0131, FDD-0131 §5.2/§5.3) — Z-score
// tier evaluation and the stateful escalation engine. Tier 1 dispatches for
// real through ADR-0091's webhookDispatcher.ts (Story 10.9/12.11); Tier 2/3
// record audited intent only — no SMS/PagerDuty/telephony integration
// exists or is authorized (ADR-0131 §4).

import { Pool } from 'pg';
import { getAdminPool } from '../db/adminPool';
import {
  CrisisBaselineMetricRow,
  CrisisEscalationRuleRow,
  CrisisMetricType,
} from './crisisBaselineStore';
import { deliverWebhookWithRetry, WebhookDeliveryOptions } from '../webhooks/webhookDispatcher';

// ADR-0131 §5 named its "suggested floor: 14" as an explicit implementation
// detail, reasoning about "at least one observation per day of the trailing
// window" — but a (day_of_week, hour_of_day) bucket recurs only weekly, so
// a 14-calendar-day trailing window can supply at most ~2-3 samples per
// bucket, never 14. A floor of 14 would make every bucket permanently
// uncalibrated, contradicting the ADR's own Consequences framing of the
// calibration gap as a temporary, first-14-days-only condition. 2 is the
// minimum sample size STDDEV_POP can compute a non-degenerate variance
// from, and is achievable within the stated 14-day/weekly-bucket design.
const MIN_SAMPLE_COUNT = 2;

export interface CrisisObservationInput {
  metricType: CrisisMetricType;
  observedValue: number;
  negativeSentimentPct: number;
}

export interface CrisisTierEvaluation {
  tier: 1 | 2 | 3;
  zScore: number;
  baselineMean: number;
  baselineStddev: number;
}

/**
 * Z = (Observed Hourly Volume - mean_14d) / stddev_14d (ADR-0131 §6).
 * Returns null (no incident) when the bucket is not yet calibrated
 * (stddev_14d = 0 or sample_count below the floor — structurally prevents
 * divide-by-zero rather than catching it after the fact, FDD-0131 §5.2),
 * when no tier's Z-score threshold is crossed, or when the negative-
 * sentiment floor isn't also met (BRU-002).
 */
export function evaluateCrisisZScore(
  baseline: Pick<CrisisBaselineMetricRow, 'mean_14d' | 'stddev_14d' | 'sample_count'> | null,
  rule: Pick<
    CrisisEscalationRuleRow,
    'tier1_z_threshold' | 'tier2_z_threshold' | 'tier3_z_threshold' | 'negative_sentiment_floor_pct'
  >,
  observation: CrisisObservationInput
): CrisisTierEvaluation | null {
  if (!baseline) return null;
  const stddev = Number(baseline.stddev_14d);
  if (stddev === 0 || baseline.sample_count < MIN_SAMPLE_COUNT) return null;

  if (observation.negativeSentimentPct < Number(rule.negative_sentiment_floor_pct)) return null;

  const mean = Number(baseline.mean_14d);
  const zScore = (observation.observedValue - mean) / stddev;

  let tier: 1 | 2 | 3 | null = null;
  if (zScore >= Number(rule.tier3_z_threshold)) tier = 3;
  else if (zScore >= Number(rule.tier2_z_threshold)) tier = 2;
  else if (zScore >= Number(rule.tier1_z_threshold)) tier = 1;

  if (tier === null) return null;
  return { tier, zScore, baselineMean: mean, baselineStddev: stddev };
}

export interface EscalationActionLogEntry {
  tier: 1 | 2 | 3;
  action: 'dispatched' | 'recorded_intent';
  channel: 'webhook' | 'sms' | 'pagerduty' | 'executive_phone_broadcast';
  recipientOrTarget: string;
  attemptedAt: string;
  outcome: 'delivered' | 'failed' | 'not_attempted_intent_only';
  detail?: string;
}

export interface Tier1WebhookPayload {
  incidentId: string;
  tenantId: string;
  watchlistId: string;
  tier: 1;
  triggeredAt: string;
  zScore: number;
  observedValue: number;
  negativeSentimentPct: number;
  summary: string;
}

interface DispatchIncidentContext {
  id: string;
  tenantId: string;
  watchlistId: string;
  zScore: number;
  observedValue: number;
  negativeSentimentPct: number;
}

/**
 * Dispatches the action for a single tier (ADR-0131 §4/§7, FDD-0131 §5.3):
 *  - Tier 1: a real, signed webhook call via ADR-0091's
 *    deliverWebhookWithRetry, targeting tier1_delivery.webhookUrls[0].
 *  - Tier 2/3: a recorded_intent audit entry only — no outbound call.
 * mockPoster is threaded through to deliverWebhookWithRetry so contract
 * tests can exercise the real call path against a local HTTP server rather
 * than mocking this function itself.
 */
export async function dispatchTierAction(
  tier: 1 | 2 | 3,
  rule: CrisisEscalationRuleRow,
  incident: DispatchIncidentContext,
  opts: { mockPoster?: WebhookDeliveryOptions['mockPoster'] } = {}
): Promise<EscalationActionLogEntry> {
  const attemptedAt = new Date().toISOString();

  if (tier === 1) {
    const delivery = rule.tier1_delivery || {};
    const webhookUrls = delivery.webhookUrls || [];
    if (webhookUrls.length === 0) {
      return {
        tier,
        action: 'dispatched',
        channel: 'webhook',
        recipientOrTarget: '',
        attemptedAt,
        outcome: 'failed',
        detail: 'No webhookUrls configured on tier1_delivery.',
      };
    }

    const url = webhookUrls[0];
    const payload: Tier1WebhookPayload = {
      incidentId: incident.id,
      tenantId: incident.tenantId,
      watchlistId: incident.watchlistId,
      tier: 1,
      triggeredAt: attemptedAt,
      zScore: incident.zScore,
      observedValue: incident.observedValue,
      negativeSentimentPct: incident.negativeSentimentPct,
      summary: `Mention velocity ${incident.zScore.toFixed(1)}σ above 14-day baseline`,
    };

    const result = await deliverWebhookWithRetry({
      url,
      secret: delivery.secret || 'crisis-escalation-tier1-secret',
      eventType: 'crisis.incident.tier1',
      tenantId: incident.tenantId,
      payload: payload as unknown as Record<string, any>,
      maxAttempts: 1,
      mockPoster: opts.mockPoster,
    });

    return {
      tier,
      action: 'dispatched',
      channel: 'webhook',
      recipientOrTarget: url,
      attemptedAt,
      outcome: result.success ? 'delivered' : 'failed',
      detail: result.success ? `HTTP ${result.statusCode}` : result.lastError,
    };
  }

  // Tier 2/3: fully modeled, recorded intent only (ADR-0131 §4).
  const deliveryConfig = tier === 2 ? rule.tier2_delivery : rule.tier3_delivery;
  const vendor = deliveryConfig?.vendor ?? (tier === 2 ? 'pagerduty_or_sms' : 'executive_phone_broadcast');
  const channel: EscalationActionLogEntry['channel'] =
    tier === 3 ? 'executive_phone_broadcast' : vendor === 'sms' ? 'sms' : 'pagerduty';

  return {
    tier,
    action: 'recorded_intent',
    channel,
    recipientOrTarget: JSON.stringify(deliveryConfig?.recipients ?? []),
    attemptedAt,
    outcome: 'not_attempted_intent_only',
    detail: `Would have paged via ${vendor} at ${attemptedAt} — no live ${vendor} integration exists (ADR-0131 §4).`,
  };
}

export interface CreatedCrisisIncident {
  id: string;
  tenant_id: string;
  watchlist_id: string;
  escalation_rule_id: string;
  metric_type: CrisisMetricType;
  observed_value: string;
  baseline_mean: string;
  baseline_stddev: string;
  z_score: string;
  negative_sentiment_pct: string;
  tier: 1 | 2 | 3;
  status: 'open';
  ack_timeout_at: Date;
  escalation_action_log: EscalationActionLogEntry[];
  created_at: Date;
}

/**
 * Inserts exactly one crisis_incident_logs row (ADR-0131 §6/§7, BRU-003)
 * at the evaluated tier, then immediately dispatches that tier's own
 * action and appends it to escalation_action_log.
 */
export async function createCrisisIncident(
  tenantId: string,
  watchlistId: string,
  rule: CrisisEscalationRuleRow,
  evaluation: CrisisTierEvaluation,
  observation: CrisisObservationInput,
  pool: Pool = getAdminPool(),
  opts: { mockPoster?: WebhookDeliveryOptions['mockPoster'] } = {}
): Promise<CreatedCrisisIncident> {
  const { rows } = await pool.query<CreatedCrisisIncident>(
    `INSERT INTO crisis_incident_logs (
       tenant_id, watchlist_id, escalation_rule_id, metric_type, observed_value,
       baseline_mean, baseline_stddev, z_score, negative_sentiment_pct, tier,
       status, ack_timeout_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'open', now() + ($11 || ' minutes')::interval)
     RETURNING *`,
    [
      tenantId,
      watchlistId,
      rule.id,
      observation.metricType,
      observation.observedValue,
      evaluation.baselineMean,
      evaluation.baselineStddev,
      evaluation.zScore,
      observation.negativeSentimentPct,
      evaluation.tier,
      rule.ack_timeout_minutes,
    ]
  );
  const incident = rows[0];

  const logEntry = await dispatchTierAction(
    evaluation.tier,
    rule,
    {
      id: incident.id,
      tenantId,
      watchlistId,
      zScore: evaluation.zScore,
      observedValue: observation.observedValue,
      negativeSentimentPct: observation.negativeSentimentPct,
    },
    opts
  );

  const { rows: updated } = await pool.query<CreatedCrisisIncident>(
    `UPDATE crisis_incident_logs
     SET escalation_action_log = escalation_action_log || $1::jsonb
     WHERE id = $2
     RETURNING *`,
    [JSON.stringify([logEntry]), incident.id]
  );

  return updated[0];
}

/**
 * Ack-timeout sweep (ADR-0131 §7, FDD-0131 §5.3 step 3): re-notifies at the
 * *same* tier for every open incident past its ack_timeout_at, then pushes
 * ack_timeout_at forward. Tier is never promoted by this sweep (BRU-004).
 */
export async function sweepAckTimeoutIncidents(
  pool: Pool = getAdminPool(),
  opts: { mockPoster?: WebhookDeliveryOptions['mockPoster'] } = {}
): Promise<{ swept: number }> {
  const { rows: overdue } = await pool.query<
    CreatedCrisisIncident & { ack_timeout_minutes: number; escalation_rule_row: CrisisEscalationRuleRow }
  >(
    `SELECT cil.*, cer.ack_timeout_minutes AS ack_timeout_minutes, row_to_json(cer.*) AS escalation_rule_row
     FROM crisis_incident_logs cil
     JOIN crisis_escalation_rules cer ON cer.id = cil.escalation_rule_id
     WHERE cil.status = 'open' AND cil.ack_timeout_at < now()`
  );

  for (const row of overdue) {
    const rule = row.escalation_rule_row as unknown as CrisisEscalationRuleRow;
    const logEntry = await dispatchTierAction(
      row.tier,
      rule,
      {
        id: row.id,
        tenantId: row.tenant_id,
        watchlistId: row.watchlist_id,
        zScore: Number(row.z_score),
        observedValue: Number(row.observed_value),
        negativeSentimentPct: Number(row.negative_sentiment_pct),
      },
      opts
    );

    await pool.query(
      `UPDATE crisis_incident_logs
       SET escalation_action_log = escalation_action_log || $1::jsonb,
           ack_timeout_at = now() + ($2 || ' minutes')::interval
       WHERE id = $3 AND status = 'open'`,
      [JSON.stringify([logEntry]), row.ack_timeout_minutes, row.id]
    );
  }

  return { swept: overdue.length };
}
