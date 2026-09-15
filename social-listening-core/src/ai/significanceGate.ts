/**
 * Story 17.5 (ADR-0133, TDS-0133) — Statistical significance gate for
 * POST /v1/explain.
 *
 * Pre-generation gate: the observed metric delta |value − previousValue| is
 * Z-scored against the tenant's own rolling 30-day baseline distribution of
 * absolute day-over-day post-count deltas (days ending before the request's
 * timeRange.start). p >= 0.05 means the shift is background noise and the
 * caller gets a deterministic response with tokenCostSaved — no LLM call.
 * Significant shifts additionally get a real root-cause factor decomposition
 * injected into the prompt.
 *
 * See .claude/skills/metric-explainability/SKILL.md.
 */

import { PoolClient } from 'pg';
import { withTenant } from '../db/withTenant';
import { getPool } from '../db/pool';

export interface FactorDecomposition {
  volumeDeltaPercent: number;
  sentimentShiftContribution: number; // -1.0 to +1.0
  dominantPlatform: string;
  topContributingTopic: string;
  topAuthorImpactRatio: number;
}

export interface SignificanceEvaluation {
  isSignificant: boolean;
  zScore: number;
  pValue: number;
}

export interface BaselineDistribution {
  mean: number;
  stdDev: number;
  samples: number;
}

/** TDS-0133 §4.1 — standard normal CDF approximation. */
function normalCdf(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp((-x * x) / 2);
  const prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - prob : prob;
}

/** TDS-0133 §4.1 — Z = |Δ−μ|/σ, p = 2·(1−Φ(Z)), significant when p < 0.05. */
export function evaluateStatisticalSignificance(
  currentValue: number,
  historicalMean: number,
  historicalStdDev: number
): SignificanceEvaluation {
  if (historicalStdDev === 0) {
    return { isSignificant: false, zScore: 0, pValue: 1.0 };
  }

  const zScore = Math.abs(currentValue - historicalMean) / historicalStdDev;
  const pValue = Math.max(0.0001, Math.min(1.0, 2 * (1 - normalCdf(zScore))));

  return {
    isSignificant: pValue < 0.05,
    zScore: Math.round(zScore * 100) / 100,
    pValue: Math.round(pValue * 10000) / 10000,
  };
}

/**
 * Tenant's rolling 30-day baseline: daily social_posts counts over the 30 days
 * ending before `beforeDate`, reduced to the distribution of absolute
 * day-over-day deltas. `samples` counts days that actually had posts — TDS-0133
 * §8 treats <7 samples as insufficient history (gate stays open).
 */
export async function getBaselineDistribution(
  tenantId: string,
  beforeDate: string
): Promise<BaselineDistribution> {
  const dailyCounts = await withTenant(
    tenantId,
    async (client: PoolClient) => {
      const { rows } = await client.query<{ cnt: number }>(
        `SELECT COUNT(sp.id)::int AS cnt
         FROM generate_series(($2::date - 30)::date, ($2::date - 1)::date, interval '1 day') gs
         LEFT JOIN social_posts sp
           ON sp.tenant_id = $1
          AND sp.published_at >= gs::timestamptz
          AND sp.published_at <  (gs + interval '1 day')::timestamptz
         GROUP BY gs
         ORDER BY gs`,
        [tenantId, beforeDate]
      );
      return rows.map((r) => r.cnt);
    },
    getPool()
  );

  const samples = dailyCounts.filter((c) => c > 0).length;
  const deltas = dailyCounts.slice(1).map((c, i) => Math.abs(c - dailyCounts[i]));
  const mean = deltas.reduce((s, d) => s + d, 0) / deltas.length;
  const variance = deltas.reduce((s, d) => s + (d - mean) ** 2, 0) / deltas.length;

  return { mean, stdDev: Math.sqrt(variance), samples };
}

export interface GateDecision {
  /** true when the gate actually computed Z/p (numeric values + ≥7 samples). */
  evaluated: boolean;
  isSignificant: boolean;
  zScore?: number;
  pValue?: number;
}

const MIN_BASELINE_SAMPLES = 7;

/**
 * Evaluates the significance gate for one explain request. The gate defaults
 * open (isSignificant=true) when the delta isn't computable from the request
 * or the tenant lacks ≥7 days of baseline history.
 */
export async function evaluateSignificanceGate(
  tenantId: string,
  value: number | string,
  previousValue: number | string | undefined,
  windowStart: string
): Promise<GateDecision> {
  if (typeof value !== 'number' || typeof previousValue !== 'number') {
    return { evaluated: false, isSignificant: true };
  }

  const baseline = await getBaselineDistribution(tenantId, windowStart);
  if (baseline.samples < MIN_BASELINE_SAMPLES) {
    return { evaluated: false, isSignificant: true };
  }

  const observedDelta = Math.abs(value - previousValue);
  const evaluation = evaluateStatisticalSignificance(observedDelta, baseline.mean, baseline.stdDev);
  return { evaluated: true, ...evaluation };
}

/**
 * Multi-factor root-cause decomposition (TDS-0133 §3.1) — real per-tenant
 * aggregates over the request's timeRange window.
 */
export async function decomposeFactors(
  tenantId: string,
  value: number,
  previousValue: number | undefined,
  timeRange: { start: string; end: string }
): Promise<FactorDecomposition> {
  const volumeDeltaPercent =
    typeof previousValue === 'number' && previousValue !== 0
      ? Math.round(((value - previousValue) / Math.abs(previousValue)) * 10000) / 100
      : 0;

  return withTenant(
    tenantId,
    async (client: PoolClient) => {
      const windowParams = [tenantId, timeRange.start, timeRange.end];
      const windowWhere = `tenant_id = $1 AND published_at >= $2::timestamptz AND published_at <= $3::timestamptz`;

      const platformRows = await client.query<{ p: string; c: number }>(
        `SELECT COALESCE(raw_payload->>'providerId', 'unknown') AS p, COUNT(*)::int AS c
         FROM social_posts WHERE ${windowWhere}
         GROUP BY p ORDER BY c DESC LIMIT 1`,
        windowParams
      );

      const sentimentRows = await client.query<{ total: number; neg: number }>(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE enrichment->>'sentiment' = 'negative')::int AS neg
         FROM social_posts WHERE ${windowWhere}`,
        windowParams
      );

      const baselineSentimentRows = await client.query<{ total: number; neg: number }>(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE enrichment->>'sentiment' = 'negative')::int AS neg
         FROM social_posts
         WHERE tenant_id = $1
           AND published_at >= ($2::timestamptz - interval '30 days')
           AND published_at <  $2::timestamptz`,
        [tenantId, timeRange.start]
      );

      const authorRows = await client.query<{ max_share: number | null }>(
        `SELECT MAX(cnt)::float / NULLIF(SUM(cnt), 0) AS max_share
         FROM (SELECT COUNT(*) AS cnt FROM social_posts
               WHERE ${windowWhere} AND author_id IS NOT NULL
               GROUP BY author_id) s`,
        windowParams
      );

      const topicRows = await client.query<{ name: string }>(
        `SELECT t.name
         FROM post_topics pt
         JOIN topics t ON t.id = pt.topic_id
         JOIN social_posts sp ON sp.id = pt.post_id
         WHERE pt.tenant_id = $1
           AND sp.published_at >= $2::timestamptz
           AND sp.published_at <= $3::timestamptz
         GROUP BY t.name ORDER BY COUNT(*) DESC LIMIT 1`,
        windowParams
      );

      const windowTotal = sentimentRows.rows[0]?.total ?? 0;
      const windowNegShare = windowTotal > 0 ? (sentimentRows.rows[0]?.neg ?? 0) / windowTotal : 0;
      const baseTotal = baselineSentimentRows.rows[0]?.total ?? 0;
      const baseNegShare = baseTotal > 0 ? (baselineSentimentRows.rows[0]?.neg ?? 0) / baseTotal : 0;
      const sentimentShiftContribution = Math.max(
        -1,
        Math.min(1, Math.round((windowNegShare - baseNegShare) * 10000) / 10000)
      );

      return {
        volumeDeltaPercent,
        sentimentShiftContribution,
        dominantPlatform: platformRows.rows[0]?.p ?? 'none',
        topContributingTopic: topicRows.rows[0]?.name ?? 'none',
        topAuthorImpactRatio: Math.round((authorRows.rows[0]?.max_share ?? 0) * 10000) / 10000,
      };
    },
    getPool()
  );
}
